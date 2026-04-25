import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createServiceClient } from "@/lib/supabase";
import { callClaudeJSON } from "@/lib/claude";
import { TREND_TRANSLATE_SYSTEM_PROMPT } from "@/lib/prompts/trend-translate";
import type { StylePreference, TrendTranslationResult } from "@/types/index";

interface TrendRow {
  keyword: string;
  category: string;
  description: string;
  applicable_styles: string[];
  incompatible_styles: string[];
  adaptation_hint: string | null;
}

export async function POST(request: NextRequest) {
  try {
    const supabaseAuth = createSupabaseServerClient();
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

    const { trendId } = await request.json() as { trendId: string };
    if (!trendId) return NextResponse.json({ error: "trendIdが必要です" }, { status: 400 });

    const supabase = createServiceClient();

    const [userResult, trendResult] = await Promise.all([
      supabase
        .from("users")
        .select("style_preference, style_analysis")
        .eq("id", user.id)
        .single() as unknown as Promise<{ data: { style_preference: unknown; style_analysis: unknown } | null }>,
      supabase
        .from("trends")
        .select("keyword, category, description, applicable_styles, incompatible_styles, adaptation_hint")
        .eq("id", trendId)
        .single() as unknown as Promise<{ data: TrendRow | null }>,
    ]);

    const trend = trendResult.data;
    if (!trend) return NextResponse.json({ error: "トレンドが見つかりません" }, { status: 404 });

    const pref = userResult.data?.style_preference as StylePreference | null;

    const prefLines: string[] = [];
    if (pref) {
      if (pref.likedVibes.length)          prefLines.push(`好きな雰囲気: ${pref.likedVibes.join("・")}`);
      if (pref.dislikedVibes.length)       prefLines.push(`苦手な雰囲気: ${pref.dislikedVibes.join("・")}`);
      if (pref.likedColors.length)         prefLines.push(`好きな色: ${pref.likedColors.join("・")}`);
      if (pref.dislikedColors.length)      prefLines.push(`苦手な色: ${pref.dislikedColors.join("・")}`);
      if (pref.likedMaterials.length)      prefLines.push(`好きな素材: ${pref.likedMaterials.join("・")}`);
      if (pref.dislikedMaterials.length)   prefLines.push(`苦手な素材: ${pref.dislikedMaterials.join("・")}`);
      if (pref.likedSilhouettes.length)    prefLines.push(`好きな形: ${pref.likedSilhouettes.join("・")}`);
      if (pref.dislikedSilhouettes.length) prefLines.push(`苦手な形: ${pref.dislikedSilhouettes.join("・")}`);
      if (pref.targetImpressions.length)   prefLines.push(`与えたい印象: ${pref.targetImpressions.join("・")}`);
      if (pref.avoidImpressions.length)    prefLines.push(`避けたい印象: ${pref.avoidImpressions.join("・")}`);
      if (pref.ngElements.length)          prefLines.push(`NGな要素: ${pref.ngElements.join("・")}`);
    }

    const userMessage = [
      "【今季トレンド】",
      `トレンド名: ${trend.keyword}`,
      `カテゴリ: ${trend.category}`,
      `説明: ${trend.description}`,
      trend.applicable_styles.length ? `合いやすいスタイル: ${trend.applicable_styles.join("・")}` : "",
      trend.incompatible_styles.length ? `合いにくいスタイル: ${trend.incompatible_styles.join("・")}` : "",
      trend.adaptation_hint ? `取り入れ方ヒント: ${trend.adaptation_hint}` : "",
      "",
      prefLines.length
        ? `【ユーザーの好み】\n${prefLines.join("\n")}`
        : "【ユーザーの好み】\n未設定（一般的な提案をしてください）",
    ].filter((l) => l !== "").join("\n");

    const result = await callClaudeJSON<TrendTranslationResult>({
      systemPrompt: TREND_TRANSLATE_SYSTEM_PROMPT,
      userMessage,
      maxTokens: 1200,
    });

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "翻訳に失敗しました" }, { status: 500 });
  }
}
