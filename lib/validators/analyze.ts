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

  if (result.styleStructure) {
    const s = result.styleStructure;
    if (!s.color)      s.color      = "未設定";
    if (!s.line)       s.line       = "未設定";
    if (!s.material)   s.material   = "未設定";
    if (!s.density)    s.density    = "未設定";
    if (!s.silhouette) s.silhouette = "未設定";
    if (!s.gaze)       s.gaze       = "未設定";
  }

  return result;
}
