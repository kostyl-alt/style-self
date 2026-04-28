// Stage 1（コンセプト翻訳）AIレスポンスの正規化ヘルパー（Sprint 36 v1.2）

import type { ConceptInterpretation } from "@/types/index";

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function asStringArray(v: unknown, max: number): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.length > 0).slice(0, max);
}

export function normalizeInterpretation(raw: unknown): ConceptInterpretation {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    keywords:               asStringArray(r.keywords, 5),
    emotion:                asString(r.emotion),
    personaImage:           asString(r.personaImage),
    culture:                asString(r.culture),
    era:                    asString(r.era),
    philosophy:             asString(r.philosophy),
    recommendedColors:      asStringArray(r.recommendedColors, 6),
    recommendedMaterials:   asStringArray(r.recommendedMaterials, 5),
    recommendedSilhouettes: asStringArray(r.recommendedSilhouettes, 5),
    requiredAccessories:    asStringArray(r.requiredAccessories, 4),
    ngElements:             asStringArray(r.ngElements, 5),
  };
}
