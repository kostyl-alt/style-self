import type { CoordinateAIResponse } from "@/types/index";

const VALID_ROLES = new Set(["main", "accent", "base"]);
const VALID_LINE_DIRECTIONS = new Set(["vertical", "horizontal", "diagonal", "curved", "mixed"]);
const VALID_WEIGHT_CENTERS = new Set(["upper", "lower", "balanced"]);
const VALID_STRUCTURE_CONSISTENCY = new Set(["high", "medium", "contrast"]);

export function validateAndFixCoordinate(coordinate: CoordinateAIResponse): CoordinateAIResponse {
  // items[].role のフォールバック
  if (Array.isArray(coordinate.items)) {
    coordinate.items = coordinate.items.map((item) => ({
      ...item,
      role: VALID_ROLES.has(item.role) ? item.role : "base" as const,
    }));
  }

  if (!coordinate.analysis) return coordinate;

  const { silhouette, analysis } = coordinate;

  // シルエット名と volumeBalance の整合性
  if (silhouette?.type && analysis.ratio) {
    const type = silhouette.type;
    if (type.includes("Y") && analysis.ratio.volumeBalance !== "upper") {
      analysis.ratio.volumeBalance = "upper";
    }
    if (type.includes("A") && analysis.ratio.volumeBalance !== "lower") {
      analysis.ratio.volumeBalance = "lower";
    }
    if (type.includes("I") && analysis.ratio.volumeBalance !== "balanced") {
      analysis.ratio.volumeBalance = "balanced";
    }
  }

  // worldviewAlignment スコア範囲クランプ
  if (analysis.worldviewAlignment?.score != null) {
    analysis.worldviewAlignment.score = Math.max(1, Math.min(5, analysis.worldviewAlignment.score));
  }

  // line.direction enum フォールバック
  if (analysis.line && !VALID_LINE_DIRECTIONS.has(analysis.line.direction)) {
    analysis.line.direction = "mixed";
  }

  // weight.center enum フォールバック
  if (analysis.weight && !VALID_WEIGHT_CENTERS.has(analysis.weight.center)) {
    analysis.weight.center = "balanced";
  }

  // structure.consistency enum フォールバック
  if (analysis.structure && !VALID_STRUCTURE_CONSISTENCY.has(analysis.structure.consistency)) {
    analysis.structure.consistency = "medium";
  }

  // why/what/emotion の空文字フォールバック
  if (!analysis.why)     analysis.why     = "選択の意図は記録されませんでした";
  if (!analysis.what)    analysis.what    = "表現内容は記録されませんでした";
  if (!analysis.emotion) analysis.emotion = "感情的な文脈は記録されませんでした";

  return coordinate;
}
