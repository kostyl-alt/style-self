// Sprint 40: 楽天商品マッチング - スコアリング・ヘルパー
// Sprint 41: 手動キュレーション情報を含めた拡張スコアリング
// Sprint 41.3: シルエット / 季節 / テイスト / 素材双方向 / NG誤爆対策を追加

import { isAnyColorMatch } from "./color-aliases";
import { getSeasonJST } from "./season";
import type { ExternalProduct, VirtualCoordinateItem } from "@/types/index";

export interface ScoringResult {
  score:        number;
  matchReasons: string[];
}

export interface ScoringContext {
  conceptKeywords?: string[];   // interpretation.keywords + matchedRuleKeywords
  ngElements?:      string[];   // interpretation.ngElements + user.preference.ngElements
  bodyConcerns?:    string[];   // user.body_profile.concerns
  currentSeason?:   string;     // "春"/"夏"/"秋"/"冬"。未指定時は getSeasonJST() で算出
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

  // ---- Sprint 40 既存スコアリング ----

  if (isAnyColorMatch(item.color, product.normalizedColors)) {
    score += 30;
    reasons.push("色");
  }

  // 素材一致（双方向）→ +20
  // 1) product.normalizedMaterials のいずれかが item.name/reason/materialNote に含まれる
  // 2) item.materialNote のトークンが product.normalizedMaterials のいずれかに含まれる
  // どちらかが当たれば加点（重複加点はしない）
  if (product.normalizedMaterials.length > 0) {
    const haystack    = `${item.name} ${item.materialNote} ${item.reason}`;
    const productHits = product.normalizedMaterials.some((m) => haystack.includes(m));
    const itemNote    = (item.materialNote ?? "").trim();
    const itemHits    = itemNote.length > 0
      && product.normalizedMaterials.some((m) => itemNote.includes(m) || m.includes(itemNote));
    if (productHits || itemHits) {
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

  // ---- Sprint 41.3 追加スコアリング ----

  // シルエット一致 → +15
  // product.normalizedSilhouette（"オーバーサイズ" 等の単一文字列）が
  // item.reason / item.sizeNote に含まれていれば加点
  const silhouette = (product.normalizedSilhouette ?? "").trim();
  if (silhouette.length > 0) {
    const styleNotes = `${item.reason} ${item.sizeNote}`;
    if (styleNotes.includes(silhouette)) {
      score += 15;
      reasons.push("シルエット");
    }
  }

  // 季節整合 → +10 / 矛盾 -15
  // axes.seasonality は ["春","夏"] 等の text[]。空配列はオールシーズン扱いで加減点なし
  const productSeasons = readProductSeasons(product);
  if (productSeasons.length > 0) {
    const currentSeason = ctx.currentSeason ?? getSeasonJST();
    if (productSeasons.includes(currentSeason)) {
      score += 10;
      reasons.push("季節");
    } else {
      // 完全矛盾（productが特定季節のみで、現在季節を含まない）→ ペナルティ
      score -= 15;
    }
  }

  // テイスト一致 → +15
  // product.normalizedTaste（["ミニマル","クリーン"] 等）と
  // ctx.conceptKeywords の双方向 includes で重なりを検出
  if (
    ctx.conceptKeywords && ctx.conceptKeywords.length > 0
    && product.normalizedTaste.length > 0
  ) {
    const overlap = product.normalizedTaste.some((t) =>
      ctx.conceptKeywords!.some((c) => c.includes(t) || t.includes(c)),
    );
    if (overlap) {
      score += 15;
      reasons.push("テイスト");
    }
  }

  // ---- NG ペナルティ（Sprint 41.3 で誤爆対策） ----
  // 配列・enum 値はトークンの「完全一致」、自由文 name のみ substring を許可。
  // これにより NG「ロング」が normalized_silhouette="ロングシルエット" に誤爆するのを防ぐ。
  if (ctx.ngElements && ctx.ngElements.length > 0) {
    const ngHit = ctx.ngElements.some((ng) => isNgHit(ng, product));
    if (ngHit) {
      score -= 50;
    }
  }

  return { score, matchReasons: reasons };
}

// ---- ヘルパー（Sprint 41.3） ----

// product.axes.seasonality を安全に読み出す。jsonb 由来なので unknown 扱い。
function readProductSeasons(product: ExternalProduct): string[] {
  const axes = product.axes as Record<string, unknown> | null | undefined;
  const raw  = axes?.seasonality;
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string" && x.length > 0);
}

// NG ヒット判定。canonical な配列・enum 値はトークン完全一致、
// 自由文 name は length>=2 の substring を許可。
function isNgHit(ng: string, product: ExternalProduct): boolean {
  const term = ng.trim();
  if (term.length < 2) return false;

  // canonical な enum/配列：完全一致のみ
  if (product.normalizedMaterials.includes(term)) return true;
  if (product.normalizedColors.includes(term))    return true;
  if (product.normalizedTaste.includes(term))     return true;
  if (product.normalizedSilhouette === term)      return true;

  // 自由文 name のみ substring を許可
  if (product.name && product.name.includes(term)) return true;

  return false;
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
