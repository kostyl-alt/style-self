import { NextRequest, NextResponse } from "next/server";
import { callClaudeJSON } from "@/lib/claude";
import { ANALYZE_SYSTEM_PROMPT } from "@/lib/prompts/analyze";
import { validateAndFixStyleDiagnosis } from "@/lib/validators/analyze";
import { createServiceClient } from "@/lib/supabase";
import { insertAiHistory } from "@/lib/utils/history-helper";
import type { Json } from "@/types/database";
import type { OnboardingAnswer, StyleDiagnosisResult } from "@/types/index";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { answers: OnboardingAnswer[]; userId?: string };
    const { answers, userId } = body;

    if (!answers || answers.length === 0) {
      return NextResponse.json({ error: "回答が必要です" }, { status: 400 });
    }

    const userMessage = answers
      .map((a) => `【${a.question}】\n${a.answer}`)
      .join("\n\n");

    const rawResult = await callClaudeJSON<StyleDiagnosisResult>({
      systemPrompt: ANALYZE_SYSTEM_PROMPT,
      userMessage,
      maxTokens: 4000,
    });
    const result = validateAndFixStyleDiagnosis(rawResult);

    if (userId) {
      const supabase = createServiceClient();
      await supabase.from("users").update({
        style_axis:        result.styleAxis as unknown as Json,
        style_analysis:    result as unknown as Json,
        style_preference:  (result.preference ?? null) as unknown as Json,
        onboarding_completed: true,
      } as never).eq("id", userId);

      // Sprint 39: 履歴保存（fire-and-forget）
      await insertAiHistory(supabase, userId, "diagnosis", { answers }, result);
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "分析に失敗しました" }, { status: 500 });
  }
}
