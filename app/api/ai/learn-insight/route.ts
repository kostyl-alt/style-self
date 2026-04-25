import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { callClaudeJSON } from "@/lib/claude";
import { LEARN_INSIGHT_SYSTEM_PROMPT } from "@/lib/prompts/learn-insight";
import type { StyleDiagnosisResult, LearnInsight, LearnInsightTheme, LearnInsightType } from "@/types/index";

const THEMES: LearnInsightTheme[] = ["material", "silhouette", "ratio"];
const TYPES:  LearnInsightType[]  = ["insight", "breakdown", "action"];

function validateInsight(raw: LearnInsight, theme: LearnInsightTheme, type: LearnInsightType): LearnInsight {
  return {
    theme:      THEMES.includes(raw.theme) ? raw.theme : theme,
    type:       TYPES.includes(raw.type)   ? raw.type  : type,
    title:      raw.title      || "今日の気づき",
    conclusion: raw.conclusion || "",
    example:    raw.example    || "",
    action:     raw.action     || "",
    keyword:    raw.keyword    || "",
  };
}

export async function POST() {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

    const { data } = await supabase
      .from("users")
      .select("style_analysis")
      .eq("id", user.id)
      .single() as unknown as { data: { style_analysis: unknown } | null };

    if (!data?.style_analysis) {
      return NextResponse.json({ error: "診断が完了していません" }, { status: 400 });
    }

    const styleAnalysis = data.style_analysis as StyleDiagnosisResult;
    const beliefKeywords = styleAnalysis.styleAxis?.beliefKeywords ?? [];
    const theme = THEMES[Math.floor(Math.random() * THEMES.length)];
    const type  = TYPES[Math.floor(Math.random() * TYPES.length)];

    const userMessage = [
      `タイプ: ${type}`,
      `テーマ: ${theme}`,
      `coreIdentity: ${styleAnalysis.coreIdentity ?? ""}`,
      `beliefKeywords: ${beliefKeywords.join("、")}`,
      `styleStructure: ${JSON.stringify(styleAnalysis.styleStructure ?? {})}`,
      `avoid: ${(styleAnalysis.avoid ?? []).join("、")}`,
    ].join("\n");

    const raw = await callClaudeJSON<LearnInsight>({
      systemPrompt: LEARN_INSIGHT_SYSTEM_PROMPT,
      userMessage,
      maxTokens: 512,
    });
    const insight = validateInsight(raw, theme, type);

    return NextResponse.json({ insight, beliefKeywords });
  } catch {
    return NextResponse.json({ error: "気づきの生成に失敗しました" }, { status: 500 });
  }
}
