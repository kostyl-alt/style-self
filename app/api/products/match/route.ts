import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  scoreProduct,
  buildMatchReason,
  pickProductUrl,
  rowToExternalProduct,
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
  // 主カテゴリで検索
  let candidates = await fetchCandidates(supabase, item.category);

  // ゼロ時のみフォールバック
  if (candidates.length === 0) {
    const fallbacks = FALLBACK_CATEGORIES[item.category] ?? [];
    for (const fb of fallbacks) {
      candidates = await fetchCandidates(supabase, fb);
      if (candidates.length > 0) break;
    }
  }

  if (candidates.length === 0) return [];

  // スコアリング → 上位N件
  const scored = candidates
    .map((p) => {
      const { score, matchReasons } = scoreProduct(item, p);
      return { product: p, score, matchReasons };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_N);

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
