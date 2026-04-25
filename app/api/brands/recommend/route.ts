import { NextRequest, NextResponse } from "next/server";
import { callClaudeJSON } from "@/lib/claude";
import { buildBrandRecommendSystemPrompt } from "@/lib/prompts/brand-recommend";
import { createServiceClient } from "@/lib/supabase";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { Brand, BrandRecommendation, StyleDiagnosisResult, StylePreference } from "@/types/index";
import type { Database } from "@/types/database";

type BrandRow = Database["public"]["Tables"]["brands"]["Row"];

function rowToBrand(row: BrandRow): Brand {
  return {
    id: row.id,
    name: row.name,
    nameJa: row.name_ja,
    country: row.country,
    city: row.city,
    description: row.description,
    worldviewTags: row.worldview_tags,
    tasteTags: row.taste_tags,
    eraTags: row.era_tags,
    sceneTags: row.scene_tags,
    priceRange: row.price_range as Brand["priceRange"],
    maniacLevel: row.maniac_level,
    officialUrl: row.official_url,
    instagramUrl: row.instagram_url,
  };
}

function scoreOverlap(brandTags: string[], userKeywords: string[]): number {
  const lower = userKeywords.map((k) => k.toLowerCase());
  return brandTags.filter((t) => lower.some((k) => t.includes(k) || k.includes(t))).length;
}

interface ClaudeRecommendItem {
  brandName: string;
  reason: string;
  matchTags: string[];
  matchScore: number;
  whyThisBrand?: string;
  tryFirst?: string;
  caution?: string | null;
}

interface ClaudeRecommendResponse {
  recommendations: ClaudeRecommendItem[];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      styleAnalysis?: StyleDiagnosisResult;
      userId?: string;
    };

    let styleAnalysis = body.styleAnalysis;
    let stylePreference: StylePreference | undefined;

    const supabaseAuth = createSupabaseServerClient();
    const { data: { user } } = await supabaseAuth.auth.getUser();

    if (user) {
      const supabase = createServiceClient();
      const { data } = await supabase
        .from("users")
        .select("style_analysis, style_preference")
        .eq("id", user.id)
        .single() as unknown as { data: { style_analysis: unknown; style_preference: unknown } | null };
      if (data?.style_analysis && !styleAnalysis) {
        styleAnalysis = data.style_analysis as StyleDiagnosisResult;
      }
      if (data?.style_preference) {
        stylePreference = data.style_preference as StylePreference;
      }
    } else if (!styleAnalysis && body.userId) {
      const supabase = createServiceClient();
      const { data } = await supabase
        .from("users")
        .select("style_analysis, style_preference")
        .eq("id", body.userId)
        .single() as unknown as { data: { style_analysis: unknown; style_preference: unknown } | null };
      if (data?.style_analysis) {
        styleAnalysis = data.style_analysis as StyleDiagnosisResult;
      }
      if (data?.style_preference) {
        stylePreference = data.style_preference as StylePreference;
      }
    }

    if (!styleAnalysis) {
      return NextResponse.json({ error: "スタイル診断結果が必要です" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data: brandRows } = await supabase
      .from("brands")
      .select("*")
      .eq("is_active", true) as unknown as { data: BrandRow[] | null };

    if (!brandRows) {
      return NextResponse.json({ error: "ブランドデータの取得に失敗しました" }, { status: 500 });
    }

    const userKeywords = [
      ...(styleAnalysis.styleAxis?.beliefKeywords ?? []),
      ...(styleAnalysis.avoid ?? []),
    ];

    const scored = brandRows
      .map((row) => ({
        row,
        score: scoreOverlap(row.worldview_tags, userKeywords),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);

    const candidateList = scored
      .map(({ row }) =>
        `name: ${row.name} | worldview_tags: ${row.worldview_tags.join(",")} | era_tags: ${row.era_tags.join(",")} | description: ${row.description} | maniac_level: ${row.maniac_level}`
      )
      .join("\n");

    const userMessage = `
【ユーザーのスタイル診断】
coreIdentity: ${styleAnalysis.coreIdentity}
plainSummary: ${styleAnalysis.plainSummary}
beliefKeywords: ${styleAnalysis.styleAxis?.beliefKeywords?.join("、") ?? ""}
colorTone: ${styleAnalysis.styleAxis?.colorTone ?? ""}
avoid: ${styleAnalysis.avoid?.join("、") ?? ""}

【候補ブランド一覧】
${candidateList}
`.trim();

    const claudeResult = await callClaudeJSON<ClaudeRecommendResponse>({
      systemPrompt: buildBrandRecommendSystemPrompt(stylePreference),
      userMessage,
      maxTokens: 2500,
    });

    const brandMap = new Map(brandRows.map((row) => [row.name, row]));

    const recommendations: BrandRecommendation[] = claudeResult.recommendations
      .filter((item) => brandMap.has(item.brandName))
      .map((item) => ({
        brand: rowToBrand(brandMap.get(item.brandName)!),
        reason: item.reason,
        matchTags: item.matchTags,
        matchScore: item.matchScore,
        ...(item.whyThisBrand ? { whyThisBrand: item.whyThisBrand } : {}),
        ...(item.tryFirst     ? { tryFirst: item.tryFirst }         : {}),
        ...(item.caution !== undefined ? { caution: item.caution }  : {}),
      }));

    return NextResponse.json({ recommendations });
  } catch {
    return NextResponse.json({ error: "ブランド提案に失敗しました" }, { status: 500 });
  }
}
