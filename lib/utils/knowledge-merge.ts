// Sprint 37: 複数の knowledge_rules を1つの ConceptInterpretation にマージする。
// weight 降順で並べ替え、配列フィールドはユニオン、単一フィールドは最も信頼度の高いルールから採用する。

import type { ConceptInterpretation, KnowledgeRule } from "@/types/index";

function dedupe<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function pickFirst(values: (string | null | undefined)[]): string {
  return values.find((s) => typeof s === "string" && s.length > 0) ?? "";
}

export function mergeRulesToInterpretation(rules: KnowledgeRule[]): ConceptInterpretation {
  // weight 降順で並べる（より信頼度の高いルールを優先採用）
  const sorted = [...rules].sort((a, b) => b.weight - a.weight);

  return {
    keywords:               dedupe(sorted.flatMap((r) => [r.conceptKeyword, ...r.aliases])).slice(0, 5),
    emotion:                pickFirst(sorted.map((r) => r.emotion)),
    personaImage:           pickFirst(sorted.map((r) => r.personaImage)),
    culture:                pickFirst(sorted.map((r) => r.culturalContext)),
    era:                    pickFirst(sorted.map((r) => r.era)),
    philosophy:             pickFirst(sorted.map((r) => r.philosophy)),
    recommendedColors:      dedupe(sorted.flatMap((r) => r.recommendedColors)).slice(0, 6),
    recommendedMaterials:   dedupe(sorted.flatMap((r) => r.recommendedMaterials)).slice(0, 5),
    recommendedSilhouettes: dedupe(sorted.flatMap((r) => r.recommendedSilhouettes)).slice(0, 5),
    requiredAccessories:    dedupe(sorted.flatMap((r) => r.requiredAccessories)).slice(0, 4),
    // NG要素は ngElements の和集合（より厳しい側を採用）
    ngElements:             dedupe(sorted.flatMap((r) => r.ngElements)).slice(0, 6),
  };
}

// DB行（snake_case）→ KnowledgeRule（camelCase）への変換
export function rowToKnowledgeRule(row: Record<string, unknown>): KnowledgeRule {
  return {
    id:                     row.id as string,
    sourceId:               (row.source_id as string | null) ?? null,
    userId:                 (row.user_id as string | null) ?? null,
    conceptKeyword:         row.concept_keyword as string,
    aliases:                (row.aliases as string[] | null) ?? [],
    emotion:                (row.emotion as string | null) ?? null,
    personaImage:           (row.persona_image as string | null) ?? null,
    culturalContext:        (row.cultural_context as string | null) ?? null,
    era:                    (row.era as string | null) ?? null,
    philosophy:             (row.philosophy as string | null) ?? null,
    recommendedColors:      (row.recommended_colors as string[] | null) ?? [],
    recommendedMaterials:   (row.recommended_materials as string[] | null) ?? [],
    recommendedSilhouettes: (row.recommended_silhouettes as string[] | null) ?? [],
    requiredAccessories:    (row.required_accessories as string[] | null) ?? [],
    ngElements:             (row.ng_elements as string[] | null) ?? [],
    weight:                 (row.weight as number) ?? 50,
    visibility:             (row.visibility as KnowledgeRule["visibility"]) ?? "private",
    isActive:               (row.is_active as boolean) ?? true,
    createdAt:              row.created_at as string,
    updatedAt:              row.updated_at as string,
  };
}
