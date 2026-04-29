// Sprint 40: 楽天商品マッチング - スコアリング・ヘルパー

import { isColorMatch } from "./color-aliases";
import type { ExternalProduct, VirtualCoordinateItem } from "@/types/index";

export interface ScoringResult {
  score:        number;
  matchReasons: string[];
}

// VirtualCoordinateItem と ExternalProduct のスコアを計算する。
// カテゴリ一致は前提（呼び出し側でフィルタ済み）なので +50 スタート。
export function scoreProduct(
  item: VirtualCoordinateItem,
  product: ExternalProduct,
): ScoringResult {
  let score = 50;
  const reasons: string[] = ["カテゴリ"];

  // 色一致（COLOR_ALIASES経由）
  if (isColorMatch(item.color, product.normalizedColor)) {
    score += 30;
    reasons.push("色");
  }

  // 素材一致：item の name / materialNote / reason に
  // product.normalizedMaterial が部分一致するか
  if (product.normalizedMaterial) {
    const haystack = `${item.name} ${item.materialNote} ${item.reason}`;
    if (haystack.includes(product.normalizedMaterial)) {
      score += 20;
      reasons.push("素材");
    }
  }

  // キーワード一致：item.zozoKeyword が product.name に含まれるか
  if (item.zozoKeyword && product.name.includes(item.zozoKeyword)) {
    score += 10;
    reasons.push("キーワード");
  }

  return { score, matchReasons: reasons };
}

// マッチ理由を1行の日本語に変換
export function buildMatchReason(reasons: string[]): string {
  return reasons.join("・") + "が一致";
}

// アフィリエイトURL優先で商品ページURLを取得
export function pickProductUrl(product: ExternalProduct): string {
  return product.affiliateUrl ?? product.productUrl ?? "";
}

// DB行（snake_case）→ ExternalProduct（camelCase）への変換
export function rowToExternalProduct(row: Record<string, unknown>): ExternalProduct {
  return {
    id:                   row.id as string,
    source:               row.source as string,
    externalId:           row.external_id as string,
    name:                 row.name as string,
    brand:                (row.brand as string | null) ?? null,
    price:                (row.price as number | null) ?? null,
    imageUrl:             (row.image_url as string | null) ?? null,
    productUrl:           (row.product_url as string | null) ?? null,
    affiliateUrl:         (row.affiliate_url as string | null) ?? null,
    normalizedCategory:   (row.normalized_category as string | null) ?? null,
    normalizedColor:      (row.normalized_color as string | null) ?? null,
    normalizedMaterial:   (row.normalized_material as string | null) ?? null,
    normalizedSilhouette: (row.normalized_silhouette as string | null) ?? null,
    normalizedTaste:      (row.normalized_taste as string[] | null) ?? [],
    isAvailable:          (row.is_available as boolean) ?? false,
  };
}

// カテゴリ・フォールバック（候補ゼロ時のみ近隣カテゴリを試す）
export const FALLBACK_CATEGORIES: Record<string, string[]> = {
  setup:   ["tops", "bottoms"],
  dress:   ["tops"],
  jacket:  ["outerwear"],
  vest:    ["tops"],
  inner:   ["tops"],
};
