// フェーズB Step 4: 世界観 → 商品マッチングの配線(client-side fetcher)
//
// users.style_analysis.worldview_tags(または fallback)を conceptKeywords として
// 既存 /api/products/match に渡し、世界観に合う商品を取得する。
//
// 重要:
// - product-match.ts のコアは触らない方針のため、既存 API がそのまま受け入れる
//   形式(items[] + conceptKeywords[])に変換して渡す。
// - 「世界観だけで商品を選びたい」が API は item(category)を要求するので、
//   category だけを持つ synthetic VirtualCoordinateItem を生成する。
//   scoreProduct 内で base=50(category 一致) + worldview_tags overlap +40
//   が効くため、ソート結果は world view に沿ったものになる。
//
// フォールバック方針:
//   worldview_tags(analyze-v2 出力)
//     ↓ なし
//   worldview_keywords(analyze-v2 1回目AI 出力・日本語キーワード)
//     ↓ なし
//   styleAxis.beliefKeywords(8パターン形式・analyze-v2 両方が持つ場合あり)
//     ↓ なし
//   []

import type {
  MatchedProduct,
  ProductMatchResponse,
  StyleDiagnosisResult,
  VirtualCoordinateItem,
} from "@/types/index";

// /self は per-category 表示、/home は flat 表示。両方とも tops/bottoms/outerwear の3カテゴリで安定供給を狙う。
export const DEFAULT_WORLDVIEW_CATEGORIES = ["tops", "bottoms", "outerwear"] as const;

export interface WorldviewProductsResult {
  byCategory: { category: string; products: MatchedProduct[] }[];
  flat:       MatchedProduct[];
}

export function deriveConceptKeywords(
  analysis: StyleDiagnosisResult | null | undefined,
): string[] {
  if (!analysis) return [];
  if (analysis.worldview_tags && analysis.worldview_tags.length > 0) {
    return analysis.worldview_tags;
  }
  if (analysis.worldview_keywords && analysis.worldview_keywords.length > 0) {
    return analysis.worldview_keywords;
  }
  return analysis.styleAxis?.beliefKeywords ?? [];
}

function buildSyntheticItem(category: string, analysis: StyleDiagnosisResult): VirtualCoordinateItem {
  // 必要最小限の VirtualCoordinateItem。category だけがマッチング上意味を持つ。
  // 他フィールドは空でよい(scoreProduct は色・素材一致を加点するだけで、空でも減点しない)。
  return {
    role:         "main",
    category,
    name:         analysis.worldviewName ?? "世界観マッチ",
    color:        "",
    reason:       analysis.worldviewName ?? "",
    zozoKeyword:  "",
    sizeNote:     "",
    materialNote: "",
    alternative:  "",
  };
}

export async function fetchWorldviewProducts(
  analysis: StyleDiagnosisResult | null | undefined,
  options: { categories?: readonly string[]; flatMax?: number } = {},
): Promise<WorldviewProductsResult> {
  const empty: WorldviewProductsResult = { byCategory: [], flat: [] };
  if (!analysis) return empty;

  const conceptKeywords = deriveConceptKeywords(analysis);
  const categories = options.categories ?? DEFAULT_WORLDVIEW_CATEGORIES;

  const items: VirtualCoordinateItem[] = categories.map((c) => buildSyntheticItem(c, analysis));

  try {
    const res = await fetch("/api/products/match", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ items, conceptKeywords }),
    });
    if (!res.ok) return empty;
    const data = await res.json() as ProductMatchResponse;

    const byCategory = data.matches.map((m, idx) => ({
      // /api/products/match の itemIndex は items の入力順に対応するので、
      // categories[m.itemIndex] で安全に逆引きできる。
      category: categories[m.itemIndex] ?? categories[idx] ?? "",
      products: m.products,
    }));

    // /home 等の flat 表示用: カテゴリを round-robin で混ぜて上位 flatMax 件を取る。
    const flatMax = options.flatMax ?? 6;
    const flat: MatchedProduct[] = [];
    let i = 0;
    while (flat.length < flatMax) {
      let added = false;
      for (const bc of byCategory) {
        if (bc.products[i]) {
          flat.push(bc.products[i]);
          added = true;
          if (flat.length >= flatMax) break;
        }
      }
      if (!added) break;
      i++;
    }

    return { byCategory, flat };
  } catch (err) {
    console.warn("[fetchWorldviewProducts] failed:", err);
    return empty;
  }
}
