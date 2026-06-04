// ③-c-2: 品質ゲートの JSON 応答パース + 薄い機械検査（設計 §3.5・案C）。
//
// stylist-chat が STYLE_SELF_QUERY_KNOWLEDGE_CHAT ON（非 MB-coordinate）のとき、
// buildQualityGateInstruction で LLM に { mode, reply, missing? } の JSON を出力させる。
// 本モジュールはそれを安全にパースし、最終的にユーザーへ見せる reply 文字列を返す。
//
// 方針:
//   - 案A（プロンプト自己チェック）が主。本モジュールは案B（薄い安全網）+ パース。
//   - パース失敗時は raw をそのまま reply とみなす（フォールバック＝退行ゼロ・mode は answer 扱い）。
//   - 薄い機械検査: mode:"answer" なのに reply が極端に短い場合のみ safe に倒す（再生成しない）。
//     ※ アイテム名羅列等の高度な判定は誤検出リスクが高いので入れない（保守的）。

export type GateMode = "answer" | "safe";

export interface GatedReply {
  mode: GateMode;
  reply: string;
  missing?: string;
}

// LLM はコードフェンスや前後ノイズを付けがちなので、最初の { 〜 最後の } を抽出（callClaudeJSON 同型）。
function extractJsonBlock(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

// 安全モード時にユーザーへ見せる既定の確認文（薄い機械検査で倒したとき等の保険）。
export const SAFE_MODE_FALLBACK_REPLY =
  "もう少しだけ教えてください。どんな雰囲気に寄せたいか、または手持ちのどのアイテムと合わせたいか、ひとつだけ教えてもらえますか？";

// 極端に短い reply の閾値（これ未満は中身が無いとみなす）。
const MIN_ANSWER_LEN = 12;

// raw（LLM 出力）→ GatedReply。パース失敗時は raw を answer 本文として返す（退行ゼロ）。
export function parseGatedReply(raw: string): GatedReply {
  const block = extractJsonBlock(raw);
  if (block) {
    try {
      const o = JSON.parse(block) as Record<string, unknown>;
      const mode: GateMode = o.mode === "safe" ? "safe" : "answer";
      const reply = typeof o.reply === "string" ? o.reply.trim() : "";
      const missing = typeof o.missing === "string" && o.missing.trim() ? o.missing.trim() : undefined;
      if (reply) return { mode, reply, missing };
      // reply 空 → パース失敗扱いでフォールバックへ
    } catch {
      // フォールバックへ
    }
  }
  // フォールバック: JSON でなければ raw をそのまま本文扱い（ゲート未適用・従来プロース）。
  return { mode: "answer", reply: raw.trim() };
}

// 薄い機械検査（案B）: mode:"answer" なのに中身が極端に薄ければ safe に倒す。再生成しない。
// 戻り: ユーザーへ見せる最終 reply 文字列。
export function applyThinGate(parsed: GatedReply): string {
  if (parsed.mode === "safe") {
    return parsed.reply || SAFE_MODE_FALLBACK_REPLY;
  }
  // mode:"answer"
  if (parsed.reply.length < MIN_ANSWER_LEN) {
    return SAFE_MODE_FALLBACK_REPLY;
  }
  return parsed.reply;
}

// 便宜: raw から最終 reply を一気に解決する（route 側の1行用）。
export function resolveGatedReply(raw: string): string {
  return applyThinGate(parseGatedReply(raw));
}
