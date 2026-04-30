import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { searchByBrand, searchForPairing, RAKUTEN_GENRE } from "@/lib/rakuten";
import type { RakutenProduct } from "@/lib/rakuten";
import { callClaudeJSON } from "@/lib/claude";
import { NORMALIZE_PRODUCT_PROMPT } from "@/lib/prompts/normalize-product";
import type { Database } from "@/types/database";

type ExternalProductInsert = {
  source: string;
  external_id: string;
  name: string;
  brand: string | null;
  price: number | null;
  product_url: string | null;
  affiliate_url: string | null;
  image_url: string | null;
  is_available: boolean;
  normalized_category: string | null;
  // Sprint 41.1: 配列カラム
  normalized_colors: string[];
  normalized_materials: string[];
  normalized_silhouette: string | null;
  normalized_taste: string[] | null;
  synced_at: string;
};

interface NormalizeResult {
  brand: string | null;
  normalized_category: string | null;
  // Sprint 41.1: 配列対応（互換のため単数値のレガシーキーも受ける）
  normalized_colors?: string[];
  normalized_color?: string;
  normalized_materials?: string[];
  normalized_material?: string;
  normalized_silhouette: string | null;
  normalized_taste: string[];
}

interface SyncRequest {
  brand?: string;
  keyword?: string;
  genreId?: string;
  hits?: number;
  dryRun?: boolean;
}

// admin用 service role クライアント
function createAdminClient() {
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars missing");
  return createClient<Database>(url, key);
}

// 楽天商品1件をClaudeで正規化
async function normalizeProduct(product: RakutenProduct): Promise<NormalizeResult> {
  const userMessage = [
    `商品名: ${product.name}`,
    `ショップ名: ${product.shopName}`,
    `説明文: ${product.rawCaption}`,
  ].join("\n");

  try {
    return await callClaudeJSON<NormalizeResult>({
      systemPrompt: NORMALIZE_PRODUCT_PROMPT,
      userMessage,
      maxTokens: 384,
    });
  } catch {
    // 正規化失敗時は空フィールドで登録
    return {
      brand: null,
      normalized_category: null,
      normalized_colors: [],
      normalized_materials: [],
      normalized_silhouette: null,
      normalized_taste: [],
    };
  }
}

// 旧形式（単数）と新形式（配列）の両方を吸収して配列に統一
function toColorArray(n: NormalizeResult): string[] {
  if (Array.isArray(n.normalized_colors) && n.normalized_colors.length > 0) return n.normalized_colors;
  if (typeof n.normalized_color === "string" && n.normalized_color) return [n.normalized_color];
  return [];
}
function toMaterialArray(n: NormalizeResult): string[] {
  if (Array.isArray(n.normalized_materials) && n.normalized_materials.length > 0) return n.normalized_materials;
  if (typeof n.normalized_material === "string" && n.normalized_material) return [n.normalized_material];
  return [];
}

// 1件ずつ正規化してDBにupsert
async function syncProducts(
  products: RakutenProduct[],
  supabase: ReturnType<typeof createAdminClient>,
  dryRun: boolean
): Promise<{ synced: number; errors: string[] }> {
  let synced = 0;
  const errors: string[] = [];

  for (const product of products) {
    try {
      const normalized = await normalizeProduct(product);

      const row: ExternalProductInsert = {
        source:               "rakuten",
        external_id:          product.externalId,
        name:                 product.name,
        brand:                normalized.brand ?? product.shopName ?? null,
        price:                product.price,
        product_url:          product.productUrl,
        affiliate_url:        product.affiliateUrl,
        image_url:            product.imageUrl,
        is_available:         product.isAvailable,
        normalized_category:  normalized.normalized_category,
        normalized_colors:    toColorArray(normalized),
        normalized_materials: toMaterialArray(normalized),
        normalized_silhouette: normalized.normalized_silhouette,
        normalized_taste:     normalized.normalized_taste?.length ? normalized.normalized_taste : null,
        synced_at:            new Date().toISOString(),
      };

      if (!dryRun) {
        const { error } = await supabase
          .from("external_products" as never)
          .upsert(row as never, { onConflict: "source,external_id" });

        if (error) {
          errors.push(`${product.name}: ${error.message}`);
          continue;
        }
      }

      synced++;

      // レート制限対策: 1件ごとに少し待つ
      await new Promise((r) => setTimeout(r, 300));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${product.name}: ${msg}`);
    }
  }

  return { synced, errors };
}

export async function POST(request: NextRequest) {
  // service role key を持つリクエストのみ許可
  const authHeader = request.headers.get("authorization");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!authHeader || authHeader !== `Bearer ${serviceKey}`) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  try {
    const body = await request.json() as SyncRequest;
    const { brand, keyword, genreId, hits = 20, dryRun = false } = body;

    if (!brand && !keyword) {
      return NextResponse.json(
        { error: "brand または keyword のいずれかが必要です" },
        { status: 400 }
      );
    }

    // 楽天APIで商品取得
    let products: RakutenProduct[];
    if (brand) {
      products = await searchByBrand(brand, {
        hits,
        genreId: genreId ?? RAKUTEN_GENRE.ladiesFashion,
      });
    } else {
      products = await searchForPairing(null, keyword!, {
        hits,
        genreId: genreId ?? RAKUTEN_GENRE.ladiesFashion,
      });
    }

    if (products.length === 0) {
      return NextResponse.json({ message: "商品が見つかりませんでした", synced: 0, errors: [] });
    }

    const supabase = createAdminClient();
    const { synced, errors } = await syncProducts(products, supabase, dryRun);

    return NextResponse.json({
      message: dryRun ? "dryRun完了（DBへの書き込みなし）" : `同期完了`,
      fetched:  products.length,
      synced,
      errors,
      ...(dryRun ? { preview: products.slice(0, 3).map((p) => ({ name: p.name, price: p.price })) } : {}),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
