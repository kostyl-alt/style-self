import type { ItemAnalysisAIResponse, WardrobeCategory } from "@/types/index";

const VALID_CATEGORIES = new Set<WardrobeCategory>([
  "tops", "bottoms", "outerwear", "shoes", "accessories", "bags", "dress", "setup",
  "jacket", "vest", "inner", "roomwear", "hat", "jewelry", "other",
]);

const VALID_COLORS = new Set([
  "ホワイト", "オフホワイト", "アイボリー", "ベージュ",
  "ライトグレー", "グレー", "チャコール", "ブラック",
  "ネイビー", "ブルー", "グリーン", "カーキ",
  "ブラウン", "テラコッタ", "マスタード", "イエロー",
  "オレンジ", "レッド", "ボルドー", "ピンク",
  "くすみピンク", "ラベンダー", "パープル", "シルバー", "ゴールド",
]);

const VALID_TASTES = new Set([
  "ミニマル", "カジュアル", "エレガント", "クリーン",
  "ストリート", "スポーティ", "フェミニン", "マスキュリン",
  "ヴィンテージ", "アーティスティック",
]);

export function validateAndFixItemAnalysis(result: ItemAnalysisAIResponse): ItemAnalysisAIResponse {
  if (!VALID_CATEGORIES.has(result.category)) {
    result.category = "other";
  }
  if (!VALID_COLORS.has(result.color)) {
    result.color = "";
  }
  if (result.subColor !== null && !VALID_COLORS.has(result.subColor)) {
    result.subColor = null;
  }
  if (!Array.isArray(result.taste)) {
    result.taste = [];
  } else {
    result.taste = result.taste.filter((t) => VALID_TASTES.has(t));
  }
  if (!Array.isArray(result.worldviewTags)) {
    result.worldviewTags = [];
  }
  return result;
}
