// アプローチ2: AI が世界観を毎回構築する診断 (フェーズA)
//
// 既存 /api/ai/analyze は一切触らない。並行で動かす新エンドポイント。
//
// 流れ:
//   Step 1: Knowledge OS から influences/categories/decision_rules を並列取得
//   Step 2: 1回目 AI コール - 世界観名・キーワード・関連影響源 5人 の選定
//   Step 3: 選ばれた 5人の詳細を Knowledge OS から個別取得
//   Step 4: 2回目 AI コール - 13項目を全て生成
//   Step 5: バリデーション + worldview_profiles へ保存 (pattern_id は null で OK)

import { NextRequest, NextResponse } from "next/server";
import { callClaudeJSON } from "@/lib/claude";
import { validateAndFixStyleDiagnosis } from "@/lib/validators/analyze";
import { createServiceClient } from "@/lib/supabase";
import { insertAiHistory } from "@/lib/utils/history-helper";
import {
  extractHintAnswers,
  extractAvoidItems,
  buildInputMapping,
} from "@/lib/utils/worldview-matcher";
import { getQuestionById, DIAGNOSIS_QUESTIONS } from "@/lib/knowledge/diagnosis-questions";
import {
  getInfluences,
  getDecisionRules,
  getCategories,
  type InfluenceData,
} from "@/lib/knowledge-os/client";
import {
  ANALYZE_V2_WORLDVIEW_SYSTEM_PROMPT,
  type WorldviewStep1Output,
} from "@/lib/prompts/analyze-v2-worldview";
import {
  ANALYZE_V2_DETAILS_SYSTEM_PROMPT,
  type DetailsStep2Output,
} from "@/lib/prompts/analyze-v2-details";
import type { Json } from "@/types/database";
import type {
  DiagnosisAnswerV2,
  OnboardingAnswer,
  StyleDiagnosisResult,
} from "@/types/index";

// 2回の AI コール合計で 30 秒を超える可能性があるため余裕を持って延長。
export const maxDuration = 60;

interface LabeledAnswer {
  question: string;
  answer:   string;
}

function buildLabeledAnswers(answers: DiagnosisAnswerV2[]): LabeledAnswer[] {
  const out: LabeledAnswer[] = [];
  for (const a of answers) {
    const q = getQuestionById(a.questionId);
    if (!q) continue;
    if (q.kind === "free_text") {
      const t = a.freeText?.trim();
      if (t) out.push({ question: q.question, answer: t });
      continue;
    }
    const labels = a.optionIds
      .map((id) => q.options.find((o) => o.id === id)?.label)
      .filter((x): x is string => !!x);
    const reasonLabels =
      a.reasonIds && q.kind === "single_with_reasons"
        ? a.reasonIds.flatMap((rid) =>
            q.options.flatMap((o) => o.reasons?.find((r) => r.id === rid)?.label ?? []),
          )
        : [];
    if (labels.length === 0) continue;
    const answer = [
      labels.join("、"),
      reasonLabels.length ? `（理由: ${reasonLabels.join("、")}）` : "",
    ]
      .filter(Boolean)
      .join(" ");
    out.push({ question: q.question, answer });
  }
  return out;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      answers?: DiagnosisAnswerV2[];
      userId?:  string;
    };
    const { answers, userId } = body;

    if (!answers || answers.length === 0) {
      return NextResponse.json({ error: "回答が必要です" }, { status: 400 });
    }

    const { troubleLabel, freeText } = extractHintAnswers(answers);
    const avoidItems = extractAvoidItems(answers);
    const labeledAnswers = buildLabeledAnswers(answers);

    // ----- Step 1: Knowledge OS から並列取得 -----
    const [influences, decisionRules, categories] = await Promise.all([
      getInfluences({ limit: 30 }),
      getDecisionRules({ importance_min: 4, limit: 20 }),
      getCategories({ include_counts: true }),
    ]);

    const knownInfluenceNames = new Set(influences.map((i) => i.subject_name));

    // ----- Step 2: 1回目 AI コール (世界観の言語化) -----
    const step1UserMessage = [
      "[16問の回答]",
      ...labeledAnswers.map((a) => `【${a.question}】${a.answer}`),
      "",
      `[Q14 困りごと]: ${troubleLabel ?? "未回答"}`,
      `[Q15 自由記述]: ${freeText ?? "なし"}`,
      `[Q16 着たくない服]: ${avoidItems.length ? avoidItems.join("、") : "なし"}`,
      "",
      "[Knowledge OS - influences (概要)]",
      ...influences.map((i) =>
        `- ${i.subject_name} (importance=${i.importance ?? "-"}): ${i.subject_summary ?? ""} / fusion=${i.fusion_essence ?? ""}`
          .slice(0, 320),
      ),
      "",
      "[Knowledge OS - categories]",
      ...categories.map((c) =>
        `- ${c.slug} (${c.name}) parent=${c.parent_slug ?? "-"} infCount=${c.influence_count ?? "-"}`,
      ),
      "",
      "[Knowledge OS - decision rules (上位)]",
      ...decisionRules.map((r) => `- ${r.rule}`),
      "",
      "上記を踏まえて、指定の JSON スキーマで返答してください。",
    ].join("\n");

    const step1 = await callClaudeJSON<WorldviewStep1Output>({
      systemPrompt: ANALYZE_V2_WORLDVIEW_SYSTEM_PROMPT,
      userMessage:  step1UserMessage,
      maxTokens:    1500,
      temperature:  0.4,
    });

    // Claude が捏造した名前を弾き、Knowledge OS に存在するものだけ採用。
    const validInfluences = (step1.selected_influences ?? []).filter((s) =>
      knownInfluenceNames.has(s.subject_name),
    );

    // ----- Step 3: 選ばれた 5人の詳細を Step 1 の取得結果からローカル絞り込み -----
    // 以前は getInfluences({ subject_name }) を 5 回 sequential に叩いていたが、
    // Step 1 の getInfluences({ limit: 30 }) で同じデータを既に取得済みなので
    // ローカル filter で十分。5〜25秒のレイテンシ短縮 + 余計な MCP RPC 削減。
    const namesToFind = new Set(validInfluences.map((s) => s.subject_name));
    const influenceDetails: InfluenceData[] = influences.filter((i) =>
      namesToFind.has(i.subject_name),
    );

    // ----- Step 4: 2回目 AI コール (13項目の詳細生成) -----
    const step2UserMessage = [
      "[ステップ1 出力]",
      `worldview_name: ${step1.worldview_name}`,
      `worldview_keywords: ${(step1.worldview_keywords ?? []).join(", ")}`,
      "selected_influences:",
      ...validInfluences.map((s) => `  - ${s.subject_name}: ${s.reason}`),
      "selected_categories:",
      `  ${(step1.selected_categories ?? []).join(", ")}`,
      "",
      "[影響源 5人の詳細]",
      ...influenceDetails.map((d) =>
        [
          `### ${d.subject_name}`,
          `summary: ${d.subject_summary ?? ""}`,
          `fusion_essence: ${d.fusion_essence ?? ""}`,
          `worldview: ${(d.influences?.worldview ?? []).join("、")}`,
          `philosophy: ${(d.influences?.philosophy ?? []).join("、")}`,
          `culture: ${(d.influences?.culture ?? []).join("、")}`,
          `music: ${(d.influences?.music ?? []).join("、")}`,
          `fashion: ${(d.influences?.fashion ?? []).join("、")}`,
          `art: ${(d.influences?.art ?? []).join("、")}`,
        ].join("\n"),
      ),
      "",
      "[16問の回答]",
      ...labeledAnswers.map((a) => `【${a.question}】${a.answer}`),
      "",
      `[Q14 困りごと]: ${troubleLabel ?? "未回答"}`,
      `[Q15 自由記述]: ${freeText ?? "なし"}`,
      `[Q16 着たくない服]: ${avoidItems.length ? avoidItems.join("、") : "なし"}`,
      "",
      "上記を踏まえて、指定の JSON スキーマで 13項目を全て返してください。",
    ].join("\n");

    const step2 = await callClaudeJSON<DetailsStep2Output>({
      systemPrompt: ANALYZE_V2_DETAILS_SYSTEM_PROMPT,
      userMessage:  step2UserMessage,
      // 13項目の JSON は 5000+ 文字に達するため 4000 では切り詰められて
      // parse 失敗していた。Sonnet 4.6 は 64K 出力対応なので 8000 まで広げる。
      maxTokens:    8000,
      temperature:  0.4,
    });

    // ----- Step 5: バリデーション + 永続化 -----
    const result: StyleDiagnosisResult = {
      // 既存型の必須フィールドを埋める。AI が返さなかった場合の最小フォールバック。
      plainSummary:    step2.plainSummary ?? "",
      coreIdentity:    step2.coreIdentity ?? "",
      whyThisResult:   step2.whyThisResult ?? "",
      styleStructure:  step2.styleStructure ?? {
        color: "未設定", line: "未設定", material: "未設定",
        density: "未設定", silhouette: "未設定", gaze: "未設定",
      },
      inputMapping:    buildInputMapping(answers),
      avoid:           step2.avoid ?? [],
      actionPlan:      step2.actionPlan ?? [],
      nextBuyingRule:  step2.nextBuyingRule ?? [],
      styleAxis:       step2.styleAxis ?? {
        beliefKeywords: [],
        colorTone: "neutral",
        spaceFeeling: "balanced",
        materialPreference: "mixed",
        summary: "",
      },
      // v2/v3 既存 optional フィールド
      recommendedColors:      step2.recommendedColors,
      recommendedMaterials:   step2.recommendedMaterials,
      recommendedSilhouettes: step2.recommendedSilhouettes,
      avoidElements:          step2.avoidElements,
      buyingPriority:         step2.buyingPriority,
      dailyAdvice:            step2.dailyAdvice,
      worldviewName:          step2.worldviewName ?? step1.worldview_name,
      unconsciousTendency:    step2.unconsciousTendency,
      idealSelf:              step2.idealSelf,
      avoidedImpression:      step2.avoidedImpression,
      attractedCulture:       step2.attractedCulture,
      culturalAffinities:     step2.culturalAffinities,
      firstPiece:             step2.firstPiece,
      avoidItems,
      // v6 (analyze-v2) 新フィールド
      recommendedAccessories: step2.recommendedAccessories,
      recommendedBrands:      step2.recommendedBrands,
      relatedInfluencers:     (step2.relatedInfluencers ?? []).filter((r) =>
        knownInfluenceNames.has(r.subject_name),
      ),
      worldview_tags:         step2.worldview_tags,
      worldview_keywords:     step1.worldview_keywords,
      // patternId は意図的に未設定(アプローチ2 ではパターン非依存)
    };

    const validated = validateAndFixStyleDiagnosis(result);

    if (userId) {
      const supabase = createServiceClient();

      await supabase.from("users").update({
        style_axis:        validated.styleAxis as unknown as Json,
        style_analysis:    validated as unknown as Json,
        avoid_items:       avoidItems,
        onboarding_completed: true,
      } as never).eq("id", userId);

      try {
        await supabase.from("diagnosis_sessions").insert({
          user_id:         userId,
          answers:         answers as unknown as Json,
          matched_pattern: null,
          scores:          {} as unknown as Json,
          result:          validated as unknown as Json,
          completed:       true,
        } as never);
      } catch (e) {
        console.warn("[analyze-v2 diagnosis_sessions] insert skipped:", e instanceof Error ? e.message : e);
      }

      try {
        await supabase.from("worldview_profiles").upsert({
          user_id:      userId,
          pattern_id:   null,
          pattern_name: validated.worldviewName ?? step1.worldview_name,
          result:       validated as unknown as Json,
          updated_at:   new Date().toISOString(),
        } as never, { onConflict: "user_id" });
      } catch (e) {
        console.warn("[analyze-v2 worldview_profiles] upsert skipped:", e instanceof Error ? e.message : e);
      }

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
      await insertAiHistory(supabase, userId, "diagnosis", compactInput, validated, {
        engine: "analyze-v2",
        worldviewName: validated.worldviewName,
      });
    }

    return NextResponse.json(validated);
  } catch (err) {
    console.warn("[analyze-v2] failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "分析に失敗しました" }, { status: 500 });
  }
}
