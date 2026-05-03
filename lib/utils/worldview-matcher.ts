// Sprint 42: タグスコア集計→世界観パターン判定
//
// アルゴリズム:
// 1. 各回答のタグを集める。単一選択は1タグあたり2点、複数選択は1点。
// 2. scoring="hint" の質問（Q14, Q15）は集計対象外。
// 3. 各パターンについて score = sum(tagFreq[t] for t in pattern.coreTags)
// 4. 最高スコアのパターンを返す。同点なら Q1（最重要）の選択タグを多く含む方を優先。

import { DIAGNOSIS_QUESTIONS, getQuestionById } from "@/lib/knowledge/diagnosis-questions";
import { WORLDVIEW_PATTERNS } from "@/lib/knowledge/worldview-patterns";
import type { DiagnosisAnswerV2, WorldviewMatchResult } from "@/types/index";

export function aggregateTagFrequencies(
  answers: DiagnosisAnswerV2[],
): Map<string, number> {
  const freq = new Map<string, number>();
  const add = (tag: string, weight: number) => {
    freq.set(tag, (freq.get(tag) ?? 0) + weight);
  };

  for (const ans of answers) {
    const q = getQuestionById(ans.questionId);
    if (!q || q.scoring !== "score") continue;

    if (q.kind === "single" || q.kind === "single_with_reasons") {
      const optionId = ans.optionIds[0];
      if (!optionId) continue;
      const opt = q.options.find((o) => o.id === optionId);
      if (!opt) continue;
      for (const t of opt.tags ?? []) add(t, 2);
      // single_with_reasons: 理由のタグは複数選択扱いで1点
      if (q.kind === "single_with_reasons" && ans.reasonIds && opt.reasons) {
        for (const rid of ans.reasonIds) {
          const r = opt.reasons.find((rr) => rr.id === rid);
          if (r) for (const t of r.tags) add(t, 1);
        }
      }
    } else if (q.kind === "multi") {
      for (const optionId of ans.optionIds) {
        const opt = q.options.find((o) => o.id === optionId);
        if (!opt) continue;
        for (const t of opt.tags ?? []) add(t, 1);
      }
    }
  }

  return freq;
}

export function matchWorldview(
  answers: DiagnosisAnswerV2[],
): WorldviewMatchResult {
  const freq = aggregateTagFrequencies(answers);

  const scores: Record<string, number> = {};
  for (const p of WORLDVIEW_PATTERNS) {
    let s = 0;
    for (const t of p.coreTags) s += freq.get(t) ?? 0;
    scores[p.id] = s;
  }

  // Tie-break: Q1 の選択タグを多く含むパターンを優先
  const q1Answer = answers.find((a) => a.questionId === "q1");
  const q1 = getQuestionById("q1");
  const q1Tags = new Set<string>();
  if (q1Answer && q1) {
    const opt = q1.options.find((o) => o.id === q1Answer.optionIds[0]);
    for (const t of opt?.tags ?? []) q1Tags.add(t);
  }

  const ranked = WORLDVIEW_PATTERNS
    .map((p) => ({
      pattern: p,
      score: scores[p.id],
      q1Overlap: p.coreTags.filter((t) => q1Tags.has(t)).length,
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.q1Overlap - a.q1Overlap;
    });

  const top = ranked[0]?.pattern ?? WORLDVIEW_PATTERNS[0];

  // 上位5タグを返す
  const topTags = Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([t]) => t);

  return { patternId: top.id, scores, topTags };
}

// Q14（コーデで困ること）と Q15（自由記述）を取り出すヘルパー
export function extractHintAnswers(answers: DiagnosisAnswerV2[]): {
  troubleLabel: string | null;
  freeText:     string | null;
} {
  let troubleLabel: string | null = null;
  let freeText: string | null = null;

  for (const ans of answers) {
    const q = getQuestionById(ans.questionId);
    if (!q || q.scoring !== "hint") continue;
    if (q.id === "q14") {
      const opt = q.options.find((o) => o.id === ans.optionIds[0]);
      troubleLabel = opt?.label ?? null;
    }
    if (q.id === "q15") {
      freeText = ans.freeText?.trim() || null;
    }
  }
  return { troubleLabel, freeText };
}

// inputMapping をアプリ側で組み立てる（Claude に頼らない）
export function buildInputMapping(
  answers: DiagnosisAnswerV2[],
): { question: string; answer: string; effect: string }[] {
  const mapping: { question: string; answer: string; effect: string }[] = [];
  for (const ans of answers) {
    const q = getQuestionById(ans.questionId);
    if (!q) continue;
    if (q.kind === "free_text") {
      if (ans.freeText?.trim()) {
        mapping.push({
          question: q.question,
          answer:   ans.freeText.trim(),
          effect:   "気になる方向のヒントとして反映",
        });
      }
      continue;
    }
    const labels = ans.optionIds
      .map((id) => q.options.find((o) => o.id === id)?.label)
      .filter((x): x is string => !!x);
    if (labels.length === 0) continue;

    const tags = collectTagsForAnswer(q.id, ans);
    const effect = q.scoring === "score" && tags.length > 0
      ? `タグ ${tags.slice(0, 3).join("・")} に寄与`
      : "アドバイス生成のヒントに使用";
    mapping.push({
      question: q.question,
      answer:   labels.join("、"),
      effect,
    });
  }
  return mapping.slice(0, 6);
}

function collectTagsForAnswer(questionId: string, ans: DiagnosisAnswerV2): string[] {
  const q = DIAGNOSIS_QUESTIONS.find((x) => x.id === questionId);
  if (!q) return [];
  const tags: string[] = [];
  for (const id of ans.optionIds) {
    const opt = q.options.find((o) => o.id === id);
    if (opt?.tags) tags.push(...opt.tags);
    if (q.kind === "single_with_reasons" && ans.reasonIds && opt?.reasons) {
      for (const rid of ans.reasonIds) {
        const r = opt.reasons.find((rr) => rr.id === rid);
        if (r) tags.push(...r.tags);
      }
    }
  }
  return Array.from(new Set(tags));
}
