import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { callClaudeJSON } from "@/lib/claude";
import { PROFILE_FIT_PROMPT } from "@/lib/prompts/profile-fit";

interface FitAIResponse {
  fitRecommendation: string;
  reasoning: string;
}

const BODY_TYPE_LABELS: Record<string, string> = {
  straight: "ストレート（筋肉質・ハリ感）",
  wave:     "ウェーブ（華奢・曲線的）",
  natural:  "ナチュラル（骨感・フレーム大きめ）",
  unknown:  "不明",
};

const FIT_LABELS: Record<string, string> = {
  tight:     "タイト",
  just:      "ジャスト",
  relaxed:   "ややリラックス",
  oversized: "オーバーサイズ",
};

export async function POST() {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

    const { data } = await supabase
      .from("users")
      .select("style_axis, height, weight, body_type, body_tendency, weight_center, shoulder_width, upper_body_thickness, muscle_type, leg_length, preferred_fit, style_impression, emphasize_parts, hide_parts")
      .eq("id", user.id)
      .single() as unknown as {
        data: {
          style_axis: unknown;
          height: number | null;
          weight: number | null;
          body_type: string | null;
          body_tendency: string | null;
          weight_center: string | null;
          shoulder_width: string | null;
          upper_body_thickness: string | null;
          muscle_type: string | null;
          leg_length: string | null;
          preferred_fit: string | null;
          style_impression: string | null;
          emphasize_parts: string[] | null;
          hide_parts: string[] | null;
        } | null;
      };

    if (!data) return NextResponse.json({ error: "ユーザーが見つかりません" }, { status: 404 });

    const lines: string[] = [];
    if (data.style_axis)           lines.push(`世界観・信念軸: ${JSON.stringify(data.style_axis)}`);
    if (data.height)                lines.push(`身長: ${data.height}cm`);
    if (data.weight)                lines.push(`体重: ${data.weight}kg`);
    if (data.body_type)             lines.push(`骨格タイプ: ${BODY_TYPE_LABELS[data.body_type] ?? data.body_type}`);
    if (data.body_tendency)         lines.push(`体型傾向: ${data.body_tendency}`);
    if (data.weight_center)         lines.push(`重心: ${data.weight_center}`);
    if (data.shoulder_width)        lines.push(`肩幅: ${data.shoulder_width}`);
    if (data.upper_body_thickness)  lines.push(`上半身の厚み: ${data.upper_body_thickness}`);
    if (data.muscle_type)           lines.push(`筋肉感・肉付き: ${data.muscle_type}`);
    if (data.leg_length)            lines.push(`脚の見え方: ${data.leg_length}`);
    if (data.preferred_fit)         lines.push(`希望サイズ感: ${FIT_LABELS[data.preferred_fit] ?? data.preferred_fit}`);
    if (data.style_impression)      lines.push(`見せたい印象: ${data.style_impression}`);
    if (data.emphasize_parts?.length) lines.push(`強調したい部位: ${data.emphasize_parts.join("・")}`);
    if (data.hide_parts?.length)      lines.push(`隠したい部位: ${data.hide_parts.join("・")}`);

    const result = await callClaudeJSON<FitAIResponse>({
      systemPrompt: PROFILE_FIT_PROMPT,
      userMessage: lines.join("\n"),
      maxTokens: 512,
    });

    await supabase
      .from("users")
      .update({ fit_recommendation: result.fitRecommendation, updated_at: new Date().toISOString() } as never)
      .eq("id", user.id);

    return NextResponse.json({ fitRecommendation: result.fitRecommendation, reasoning: result.reasoning });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
