// Phase 2: moodboard_analysis の読み取りサービス（共有ヘルパ）
//
// analyze route の GET と stylist-chat route の context object 経路で共用する。
// 生成・保存（POST）は app/api/moodboards/[id]/analyze/route.ts のままで、ここは ★ 読み取りのみ。
// RLS（本人 / public は親 is_public）が DB 層の最終防御なので、ここでは moodboard_id 一致で取得する。

import type { SupabaseClient } from "@supabase/supabase-js";
import type { MoodboardAnalysisRow } from "@/types/moodboard";

const ANALYSIS_COLUMNS =
  "moodboard_id, worldview_core, colors, materials, silhouettes, mood, ng_elements, shopping_axis, styling_axis, brief, signals, brand_translation, source, created_at, updated_at";

// moodboard_analysis を1行取得（無ければ null）。RLS で本人/public のみ読める。
export async function getMoodboardAnalysis(
  supabase: SupabaseClient,
  moodboardId: string,
): Promise<MoodboardAnalysisRow | null> {
  const { data } = await supabase
    .from("moodboard_analysis")
    .select(ANALYSIS_COLUMNS)
    .eq("moodboard_id", moodboardId)
    .maybeSingle() as unknown as { data: MoodboardAnalysisRow | null };
  return data ?? null;
}
