// 🔴 生JSON素通しバグ B(安全網): LLM が「自然文」契約を破って JSON / ```json を吐いた
// reply を中和する純関数。
//
// 背景: MB 添付中にブランド等を聞くと intent が coordinate 強制になり、Haiku が
//   coordinate_v2 でない JSON(例: 捏造の brand_guide_v2)を返すことがある。これは
//   parseCoordinateReply で弾かれ fallback の reply に raw のまま流れ、画面に生 JSON が出る。
//   本 helper を fallback の reply 直前に噛ませ、生 JSON を画面に出さない受け皿にする。
//
// ⚠️ JSON 様でなければ完全な no-op(通常プロース=brand-learn カード/自然文は素通し)。
//   呼び出し側は、戻り値が空文字なら定型フォールバック文に置換する。

// JSON.parse 可能な裸の {...} ブロックだけ除去(parse できた span のみ・プロース内の波括弧は誤爆させない)。
export function stripRawJsonReply(text: string): string {
  const trimmed = text.trim();
  // looksJson 前置きガード: JSON 様でなければ即 return(通常プロースは完全 no-op)。
  const looksJson = /```json/i.test(trimmed) || /```\s*\{/.test(trimmed) || trimmed.startsWith("{");
  if (!looksJson) return text;
  // ① フェンス除去(```json ... ``` / ``` ... ```)。
  let out = trimmed.replace(/```(?:json)?\s*[\s\S]*?```/gi, " ");
  // ② 裸の {...} ブロックは JSON.parse できたときだけ除去(プロース内の波括弧は残す)。
  const s = out.indexOf("{");
  const e = out.lastIndexOf("}");
  if (s !== -1 && e > s) {
    const span = out.slice(s, e + 1);
    try {
      JSON.parse(span);
      out = out.slice(0, s) + " " + out.slice(e + 1);
    } catch {
      /* プロース内の波括弧(JSON でない)は残す */
    }
  }
  return out.trim();
}
