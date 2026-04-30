// Sprint 40: 楽天商品マッチング - スコアリング・ヘルパー
// Sprint 41: 手動キュレーション情報を含めた拡張スコアリング

import { isAnyColorMatch } from "./color-aliases";
import type { ExternalProduct, VirtualCoordinateItem } from "@/types/index";

export interface ScoringResult {
  score:        number;
  matchReasons: string[];
}

export interface ScoringContext {
  conceptKeywords?: string[];   // interpretation.keywords + matchedRuleKeywords
  ngElements?:      string[];   // interpretation.ngElements + user.preference.ngElements
  bodyConcerns?:    string[];   // user.body_profile.concerns
}

// VirtualCoordinateItem と ExternalProduct のスコアを計算する。
// カテゴリ一致は前提（呼び出し側でフィルタ済み）なので +50 スタート。
export function scoreProduct(
  item: VirtualCoordinateItem,
  product: ExternalProduct,
  ctx: ScoringContext = {},
): ScoringResult {
  let score = 50;
  const reasons: string[] = ["カテゴリ"];

  // ---- Sprint 40 既存スコアリング（Sprint 41.1で配列対応） ----

  if (isAnyColorMatch(item.color, product.normalizedColors)) {
    score += 30;
    reasons.push("色");
  }

  if (product.normalizedMaterials.length > 0) {
    const haystack = `${item.name} ${item.materialNote} ${item.reason}`;
    if (product.normalizedMaterials.some((m) => haystack.includes(m))) {
      score += 20;
      reasons.push("素材");
    }
  }

  if (item.zozoKeyword && product.name.includes(item.zozoKeyword)) {
    score += 10;
    reasons.push("キーワード");
  }

  // ---- Sprint 41 拡張スコアリング ----

  // worldview_tags がコンセプトキーワードと共通項を持つ → +40
  if (ctx.conceptKeywords && ctx.conceptKeywords.length > 0 && product.worldviewTags.length > 0) {
    const overlap = product.worldviewTags.some((t) =>
      ctx.conceptKeywords!.some((c) => c.includes(t) || t.includes(c)),
    );
    if (overlap) {
      score += 40;
      reasons.push("世界観");
    }
  }

  // body_compat_tags がユーザーの concerns を解決 → +30
  if (ctx.bodyConcerns && ctx.bodyConcerns.length > 0 && product.bodyCompatTags.length > 0) {
    const overlap = product.bodyCompatTags.some((t) => ctx.bodyConcerns!.includes(t));
    if (overlap) {
      score += 30;
      reasons.push("体型適性");
    }
  }

  // 手動キュレーション優遇 → +25
  if (product.source === "manual") {
    score += 25;
    reasons.push("キュレーション");
  }

  // curation_priority のスケール反映（0-100 → 0-20）
  if (product.curationPriority > 0) {
    score += Math.round((product.curationPriority / 100) * 20);
  }

  // NG ペナルティ → -50
  if (ctx.ngElements && ctx.ngElements.length > 0) {
    const ngHit = ctx.ngElements.some((ng) => {
      if (!ng) return false;
      if (product.name.includes(ng)) return true;
      if (product.normalizedMaterials.some((m) => m.includes(ng))) return true;
      if (product.normalizedSilhouette?.includes(ng)) return true;
      return false;
    });
    if (ngHit) {
      score -= 50;
    }
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
    // Sprint 41.1: 配列カラム
    normalizedColors:     (row.normalized_colors as string[] | null) ?? [],
    normalizedMaterials:  (row.normalized_materials as string[] | null) ?? [],
    normalizedSilhouette: (row.normalized_silhouette as string | null) ?? null,
    normalizedTaste:      (row.normalized_taste as string[] | null) ?? [],
    isAvailable:          (row.is_available as boolean) ?? false,
    // Sprint 41
    worldviewTags:        (row.worldview_tags as string[] | null) ?? [],
    bodyCompatTags:       (row.body_compat_tags as string[] | null) ?? [],
    curationNotes:        (row.curation_notes as string | null) ?? null,
    curationPriority:     (row.curation_priority as number | null) ?? 0,
    curatedBy:            (row.curated_by as string | null) ?? null,
    matchReasonTemplate:  (row.match_reason_template as string | null) ?? null,
    // Sprint 41.1: 8軸 jsonb
    axes:                 (row.axes as Record<string, unknown> | null) ?? {},
    // Sprint 41.2: 素材混率 jsonb 配列
    materialComposition:  Array.isArray(row.material_composition)
      ? (row.material_composition as { name: string; percentage: number | null }[])
      : [],
  };
}

// VirtualCoordinateItem.category（15種 = WardrobeCategory）を
// external_products.normalized_category（7種 = Sprint 40 統合後）に
// マッピングする。これを primary lookup の前段で適用する。
export const ITEM_TO_PRODUCT_CATEGORY: Record<string, string> = {
  // 7種そのまま
  tops:        "tops",
  bottoms:     "bottoms",
  outerwear:   "outerwear",
  dress:       "dress",
  shoes:       "shoes",
  bags:        "bags",
  accessories: "accessories",
  // 15→7 統合
  jacket:      "outerwear",
  vest:        "outerwear",
  inner:       "tops",
  setup:       "dress",
  hat:         "accessories",
  jewelry:     "accessories",
  roomwear:    "tops",
  other:       "tops",
};

export function toProductCategory(itemCategory: string): string {
  return ITEM_TO_PRODUCT_CATEGORY[itemCategory] ?? "tops";
}

// 候補ゼロ時のみ近隣カテゴリを試す（マッピング後の7種を起点）
export const FALLBACK_CATEGORIES: Record<string, string[]> = {
  outerwear:   ["tops"],
  tops:        ["outerwear"],
  dress:       ["tops", "bottoms"],
  bottoms:     ["dress"],
  shoes:       [],
  bags:        ["accessories"],
  accessories: ["bags"],
};
