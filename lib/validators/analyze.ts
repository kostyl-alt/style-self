import type { StyleDiagnosisResult } from "@/types/index";

const VALID_COLOR_TONES   = new Set(["warm", "cool", "neutral", "earthy", "vivid"]);
const VALID_SPACE_FEELINGS = new Set(["minimal", "layered", "balanced", "maximalist"]);
const VALID_MATERIAL_PREFS = new Set(["natural", "synthetic", "mixed", "luxury", "casual"]);

export function validateAndFixStyleDiagnosis(result: StyleDiagnosisResult): StyleDiagnosisResult {
  if (result.styleAxis) {
    if (!VALID_COLOR_TONES.has(result.styleAxis.colorTone)) {
      result.styleAxis.colorTone = "neutral";
    }
    if (!VALID_SPACE_FEELINGS.has(result.styleAxis.spaceFeeling)) {
      result.styleAxis.spaceFeeling = "balanced";
    }
    if (!VALID_MATERIAL_PREFS.has(result.styleAxis.materialPreference)) {
      result.styleAxis.materialPreference = "mixed";
    }
    if (!Array.isArray(result.styleAxis.beliefKeywords)) {
      result.styleAxis.beliefKeywords = [];
    }
  }

  if (!Array.isArray(result.avoid))          result.avoid          = [];
  if (!Array.isArray(result.actionPlan))     result.actionPlan     = [];
  if (!Array.isArray(result.nextBuyingRule)) result.nextBuyingRule = [];
  if (!Array.isArray(result.inputMapping))   result.inputMapping   = [];

  if (result.avoidElements !== undefined && !Array.isArray(result.avoidElements))   result.avoidElements   = [];
  if (result.recommendedColors !== undefined && !Array.isArray(result.recommendedColors))         result.recommendedColors         = [];
  if (result.recommendedMaterials !== undefined && !Array.isArray(result.recommendedMaterials))   result.recommendedMaterials   = [];
  if (result.recommendedSilhouettes !== undefined && !Array.isArray(result.recommendedSilhouettes)) result.recommendedSilhouettes = [];
  if (result.buyingPriority !== undefined && !Array.isArray(result.buyingPriority)) result.buyingPriority = [];
  if (result.dailyAdvice !== undefined && !Array.isArray(result.dailyAdvice))       result.dailyAdvice    = [];

  if (result.preference !== undefined) {
    const p = result.preference;
    const ensureArray = (v: unknown) => (Array.isArray(v) ? v : []);
    p.likedColors         = ensureArray(p.likedColors);
    p.dislikedColors      = ensureArray(p.dislikedColors);
    p.likedMaterials      = ensureArray(p.likedMaterials);
    p.dislikedMaterials   = ensureArray(p.dislikedMaterials);
    p.likedSilhouettes    = ensureArray(p.likedSilhouettes);
    p.dislikedSilhouettes = ensureArray(p.dislikedSilhouettes);
    p.likedVibes          = ensureArray(p.likedVibes);
    p.dislikedVibes       = ensureArray(p.dislikedVibes);
    p.culturalReferences  = ensureArray(p.culturalReferences);
    p.targetImpressions   = ensureArray(p.targetImpressions);
    p.avoidImpressions    = ensureArray(p.avoidImpressions);
    p.clothingRole        = ensureArray(p.clothingRole);
    p.ngElements          = ensureArray(p.ngElements);
  }

  if (result.styleStructure) {
    const s = result.styleStructure;
    if (!s.color)      s.color      = "未設定";
    if (!s.line)       s.line       = "未設定";
    if (!s.material)   s.material   = "未設定";
    if (!s.density)    s.density    = "未設定";
    if (!s.silhouette) s.silhouette = "未設定";
    if (!s.gaze)       s.gaze       = "未設定";
  }

  // Sprint 41.5: 新フィールドの正規化（不正な型は削除して旧UIにフォールバック）
  if (result.worldviewName !== undefined && typeof result.worldviewName !== "string") {
    delete result.worldviewName;
  }
  if (result.unconsciousTendency !== undefined && typeof result.unconsciousTendency !== "string") {
    delete result.unconsciousTendency;
  }
  if (result.idealSelf !== undefined && typeof result.idealSelf !== "string") {
    delete result.idealSelf;
  }
  if (result.avoidedImpression !== undefined && typeof result.avoidedImpression !== "string") {
    delete result.avoidedImpression;
  }
  if (result.attractedCulture !== undefined && typeof result.attractedCulture !== "string") {
    delete result.attractedCulture;
  }
  if (result.culturalAffinities !== undefined) {
    const c = result.culturalAffinities;
    if (!c || typeof c !== "object") {
      delete result.culturalAffinities;
    } else {
      c.music     = Array.isArray(c.music)     ? c.music.filter((x): x is string => typeof x === "string")     : [];
      c.films     = Array.isArray(c.films)     ? c.films.filter((x): x is string => typeof x === "string")     : [];
      c.fragrance = Array.isArray(c.fragrance) ? c.fragrance.filter((x): x is string => typeof x === "string") : [];
    }
  }
  if (result.firstPiece !== undefined) {
    const f = result.firstPiece;
    if (!f || typeof f !== "object" || typeof f.name !== "string" || !f.name.trim()) {
      delete result.firstPiece;
    } else {
      f.name        = f.name.trim();
      f.why         = typeof f.why === "string" ? f.why.trim() : "";
      f.zozoKeyword = typeof f.zozoKeyword === "string" ? f.zozoKeyword.trim() : f.name;
    }
  }

  return result;
}
