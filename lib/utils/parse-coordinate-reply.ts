// Sprint H-4b1-a: LLM 応答の JSON パース + ★ フォールバック骨格(退行ゼロ)
//
// 設計: docs/STYLE-SELF_Sprint-H-4b_出力UI7+5_MB_context_object化_細部設計調査.md(2f9886e)§F / 論点 H4b-4(案A)
//
// 【H-4b1-a スコープ】★ 骨格のみ・どこからも未呼出(H-4b1-b で stylist-chat route が JSON 化する際に接続)。
// coordinate intent の LLM 応答(構造化 JSON 指示)を安全にパースし、★ 失敗時は旧プロース形式へ
// フォールバック(fallbackText)= 体験は劣化しても壊れない(退行ゼロ)。

import type { CoordinateReply } from "@/types/coordinate-reply";

export interface ParseResult {
  coordinate?:   CoordinateReply;  // パース + 最小スキーマ検証に成功
  fallbackText?: string;           // 失敗時: そのまま旧プロース reply として表示
}

// LLM はコードフェンス(```json ... ```)や前後ノイズを付けがちなので、最初の { 〜 最後の } を抽出。
// 既存 callClaudeJSON(CLAUDE.md 記載)と同型の寛容さ。
function extractJsonBlock(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

// CoordinateReply の ★ 最小スキーマ検証(必須フィールドの型のみ・寛容に)。
// 不足/型違いは ★ パース失敗扱い → フォールバックへ(壊れた UI を出さない)。
function isCoordinateReply(v: unknown): v is CoordinateReply {
  if (v === null || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    o.type === "coordinate_v2" &&
    typeof o.direction === "string" &&
    typeof o.summary === "string" &&
    Array.isArray(o.items) &&
    Array.isArray(o.sources) &&
    Array.isArray(o.quickActions)
  );
}

/**
 * coordinate intent の LLM raw 応答をパースする。
 * - 成功(JSON + 最小スキーマ OK)→ { coordinate }
 * - 失敗(非 JSON / スキーマ不一致)→ { fallbackText: 原文 }(旧プロース表示・退行ゼロ)
 */
export function parseCoordinateReply(raw: string): ParseResult {
  const block = extractJsonBlock(raw);
  if (block === null) {
    return { fallbackText: raw };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(block);
  } catch {
    return { fallbackText: raw };
  }
  if (!isCoordinateReply(parsed)) {
    return { fallbackText: raw };
  }
  return { coordinate: parsed };
}
