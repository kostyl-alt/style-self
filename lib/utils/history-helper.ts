// Sprint 39: AI履歴の保存ヘルパー
//
// 4つのAIルート（analyze / style-consult / analyze-look / virtual-coordinate）から
// 共通で呼ばれる薄いラッパー。
//
// 設計方針:
// - 失敗してもユーザー操作は止めない（fire-and-forget）
// - 写真分析の base64 画像は呼び出し側で除外して渡す（ここではそのまま保存）

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AiHistoryType } from "@/types/index";
import type { AiHistory } from "@/types/index";

export async function insertAiHistory(
  supabase: SupabaseClient,
  userId: string,
  type: AiHistoryType,
  input: unknown,
  output: unknown,
  metadata?: unknown,
): Promise<void> {
  try {
    const { error } = await supabase
      .from("ai_history")
      .insert({
        user_id: userId,
        type,
        input,
        output,
        metadata: metadata ?? null,
      } as never);

    if (error) {
      console.warn(`[ai_history] insert failed for type=${type}:`, error.message);
    }
  } catch (err) {
    const reason = err instanceof Error ? err.message : "unknown";
    console.warn(`[ai_history] insert exception for type=${type}: ${reason}`);
  }
}

// DB行（snake_case）→ AiHistory（camelCase）への変換
export function rowToAiHistory(row: Record<string, unknown>): AiHistory {
  return {
    id:        row.id as string,
    userId:    row.user_id as string,
    type:      row.type as AiHistoryType,
    input:     row.input as never,
    output:    row.output as never,
    metadata:  (row.metadata ?? null) as never,
    createdAt: row.created_at as string,
  } as AiHistory;
}
