import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  scoreProduct,
  buildMatchReason,
  pickProductUrl,
  rowToExternalProduct,
  toProductCategory,
  FALLBACK_CATEGORIES,
} from "@/lib/utils/product-match";
import type {
  ExternalProduct,
  MatchedProduct,
  ProductMatch,
  ProductMatchResponse,
  VirtualCoordinateItem,
} from "@/types/index";
import type { SupabaseClient } from "@supabase/supabase-js";

const POOL_SIZE = 30;     // 候補プール最大件数（DBから取得）
const TOP_N = 3;          // 返却件数

// 候補プール取得：is_available + 画像あり + カテゴリ一致 + 中古品除外
async function fetchCandidates(
  supabase: SupabaseClient,
  category: string,
): Promise<ExternalProduct[]> {
  const { data, error } = await supabase
    .from("external_products")
    .select("*")
    .eq("is_available", true)
    .eq("normalized_category", category)
    .not("image_url", "is", null)
    .not("name", "ilike", "%中古%")
    .order("synced_at", { ascending: false })
    .limit(POOL_SIZE);

  if (error) {
    console.warn(`[product-match] candidate fetch failed for category=${category}:`, error.message);
    return [];
  }
  const rows = (data ?? []) as unknown as Record<string, unknown>[];
  return rows.map(rowToExternalProduct);
}

// 1アイテムに対する商品マッチング（カテゴリ一致なしならフォールバック）
async function matchOne(
  supabase: SupabaseClient,
  item: VirtualCoordinateItem,
): Promise<MatchedProduct[]> {
  // item.category（15種）→ product.normalized_category（7種）にマッピング
  const productCategory = toProductCategory(item.category);

  // 主カテゴリで検索
  let candidates = await fetchCandidates(supabase, productCategory);
  console.log(
    `[match] item="${item.name}" category=${item.category} → productCategory=${productCategory} → primary=${candidates.length}件`,
  );

  // ゼロ時のみフォールバック
  if (candidates.length === 0) {
    const fallbacks = FALLBACK_CATEGORIES[productCategory] ?? [];
    for (const fb of fallbacks) {
      candidates = await fetchCandidates(supabase, fb);
      console.log(`[match]   fallback=${fb} → ${candidates.length}件`);
      if (candidates.length > 0) break;
    }
  }

  if (candidates.length === 0) {
    console.log(`[match]   → 該当なし（item="${item.name}"）`);
    return [];
  }

  // スコアリング → 上位N件
  const scored = candidates
    .map((p) => {
      const { score, matchReasons } = scoreProduct(item, p);
      return { product: p, score, matchReasons };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_N);

  console.log(
    `[match]   → top${scored.length}: ` +
      scored.map((s) => `${s.product.name.slice(0, 30)} (score=${s.score})`).join(" / "),
  );

  return scored.map(({ product, score, matchReasons }): MatchedProduct => ({
    id:           product.id,
    name:         product.name,
    brand:        product.brand ?? "（ブランド不明）",
    price:        product.price,
    imageUrl:     product.imageUrl ?? "",
    productUrl:   pickProductUrl(product),
    matchReason:  buildMatchReason(matchReasons),
    matchScore:   score,
  }));
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

    const { items } = await request.json() as { items: VirtualCoordinateItem[] };
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "items 配列が必要です" }, { status: 400 });
    }

    console.log(`[match] items received: ${items.length}`);

    // 全アイテム並列でマッチング
    const matches: ProductMatch[] = await Promise.all(
      items.map(async (item, itemIndex): Promise<ProductMatch> => {
        const products = await matchOne(supabase, item);
        return { itemIndex, products };
      }),
    );

    const response: ProductMatchResponse = { matches };
    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "商品マッチングに失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
