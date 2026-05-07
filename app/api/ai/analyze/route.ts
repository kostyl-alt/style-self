import { NextRequest, NextResponse } from "next/server";
import { callClaudeJSON } from "@/lib/claude";
import { ANALYZE_SYSTEM_PROMPT } from "@/lib/prompts/analyze";
import { validateAndFixStyleDiagnosis, applyPatternToResult } from "@/lib/validators/analyze";
import { createServiceClient } from "@/lib/supabase";
import { insertAiHistory } from "@/lib/utils/history-helper";
import { matchWorldview, extractHintAnswers, extractAvoidItems, buildInputMapping } from "@/lib/utils/worldview-matcher";
import { getPatternById } from "@/lib/knowledge/worldview-patterns";
import { DIAGNOSIS_QUESTIONS, getQuestionById } from "@/lib/knowledge/diagnosis-questions";
import type { Json } from "@/types/database";
import type { DiagnosisAnswerV2, OnboardingAnswer, StyleDiagnosisResult } from "@/types/index";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      answers?: DiagnosisAnswerV2[];
      userId?:  string;
    };
    const { answers, userId } = body;

    if (!answers || answers.length === 0) {
      return NextResponse.json({ error: "回答が必要です" }, { status: 400 });
    }

    // Step 1: アプリ側でパターンを確定
    const match = matchWorldview(answers);
    const pattern = getPatternById(match.patternId);
    if (!pattern) {
      return NextResponse.json({ error: "パターン判定に失敗しました" }, { status: 500 });
    }

    // Step 2: Claude へ渡す入力を構築
    const { troubleLabel, freeText } = extractHintAnswers(answers);
    const avoidItems = extractAvoidItems(answers);
    const labeledAnswers = answers.map((a) => {
      const q = getQuestionById(a.questionId);
      if (!q) return null;
      if (q.kind === "free_text") {
        return a.freeText?.trim() ? { question: q.question, answer: a.freeText.trim() } : null;
      }
      const labels = a.optionIds.map((id) => q.options.find((o) => o.id === id)?.label).filter(Boolean);
      const reasonLabels = a.reasonIds && q.kind === "single_with_reasons"
        ? a.reasonIds.flatMap((rid) => q.options.flatMap((o) => o.reasons?.find((r) => r.id === rid)?.label ?? []))
        : [];
      const answer = [labels.join("、"), reasonLabels.length ? `（理由: ${reasonLabels.join("、")}）` : ""].filter(Boolean).join(" ");
      return { question: q.question, answer };
    }).filter((x): x is { question: string; answer: string } => !!x);

    const userMessage = [
      "[確定パターン]",
      `id: ${pattern.id}`,
      `name: ${pattern.name}`,
      `coreTags: ${pattern.coreTags.join(", ")}`,
      `psychologicalCore: ${pattern.psychologicalCore}`,
      `clothingRole: ${pattern.clothingRole}`,
      `idealSelf雛形: ${pattern.idealSelf}`,
      `avoidImpressions雛形: ${pattern.avoidImpressions.join("、")}`,
      `colors: ${pattern.colors.join("、")}`,
      `materials: ${pattern.materials.join("、")}`,
      `silhouettes: ${pattern.silhouettes.join("、")}`,
      `topTags(集計上位): ${match.topTags.join(", ")}`,
      "",
      "[ユーザー回答]",
      ...labeledAnswers.map((a) => `【${a.question}】${a.answer}`),
      "",
      `[Q14 困りごと（dailyAdvice/buyingPriorityのヒント）]: ${troubleLabel ?? "未回答"}`,
      `[Q15 自由記述（任意）]: ${freeText ?? "なし"}`,
      `[Q16 着たくない服 / avoidItems]: ${avoidItems.length > 0 ? avoidItems.join("、") : "なし"}`,
    ].join("\n");

    // Step 3: Claude で文章フィールドのみ生成
    const rawResult = await callClaudeJSON<StyleDiagnosisResult>({
      systemPrompt: ANALYZE_SYSTEM_PROMPT,
      userMessage,
      maxTokens: 3500,
    });

    // Step 4: パターン値で確定フィールドを上書き + 整合性チェック
    let result = validateAndFixStyleDiagnosis(rawResult);
    result = applyPatternToResult(result, pattern);

    // Step 5: inputMapping はアプリ側で組み立てる（Claude に頼らない）
    result.inputMapping = buildInputMapping(answers);

    // Sprint 47: Q16 で選んだ avoidItems を結果オブジェクトにも保持（プロンプト出力ではなく入力由来）
    result.avoidItems = avoidItems;

    // Step 6: 永続化
    if (userId) {
      const supabase = createServiceClient();

      await supabase.from("users").update({
        style_axis:        result.styleAxis as unknown as Json,
        style_analysis:    result as unknown as Json,
        style_preference:  (result.preference ?? null) as unknown as Json,
        avoid_items:       avoidItems,
        onboarding_completed: true,
      } as never).eq("id", userId);

      // diagnosis_sessions / worldview_profiles はマイグレーション適用前でも
      // レスポンスを返せるよう、失敗してもユーザー体験を止めない（fire-and-forget）
      try {
        await supabase.from("diagnosis_sessions").insert({
          user_id:         userId,
          answers:         answers as unknown as Json,
          matched_pattern: pattern.id,
          scores:          match.scores as unknown as Json,
          result:          result as unknown as Json,
          completed:       true,
        } as never);
      } catch (e) {
        console.warn("[diagnosis_sessions] insert skipped:", e instanceof Error ? e.message : e);
      }

      try {
        await supabase.from("worldview_profiles").upsert({
          user_id:      userId,
          pattern_id:   pattern.id,
          pattern_name: pattern.name,
          result:       result as unknown as Json,
          updated_at:   new Date().toISOString(),
        } as never, { onConflict: "user_id" });
      } catch (e) {
        console.warn("[worldview_profiles] upsert skipped:", e instanceof Error ? e.message : e);
      }

      // ai_history に簡易参照
      const compactInput: { answers: OnboardingAnswer[] } = {
        answers: DIAGNOSIS_QUESTIONS
          .map((q) => {
            const ans = answers.find((a) => a.questionId === q.id);
            if (!ans) return null;
            const labels = ans.optionIds.map((id) => q.options.find((o) => o.id === id)?.label).filter(Boolean);
            const text = q.kind === "free_text" ? (ans.freeText ?? "") : labels.join("、");
            if (!text) return null;
            return { step: q.step, question: q.question, answer: text };
          })
          .filter((x): x is OnboardingAnswer => !!x),
      };
      await insertAiHistory(supabase, userId, "diagnosis", compactInput, result, { patternId: pattern.id });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.warn("[analyze] failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "分析に失敗しました" }, { status: 500 });
  }
}
