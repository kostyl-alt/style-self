import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createServiceClient } from "@/lib/supabase";
import { isAdminEmail } from "@/lib/utils/admin-check";
import { rowToExternalProduct } from "@/lib/utils/product-match";
import type {
  AdminProduct,
  AdminProductListResponse,
  CreateProductRequest,
  ProductConceptTag,
} from "@/types/index";

const VALID_CATEGORIES = new Set([
  "tops", "bottoms", "outerwear", "dress", "shoes", "bags", "accessories",
]);

const VALID_BODY_CONCERNS = new Set([
  "looks_young", "short_legs", "broad_shoulders",
  "wide_hips", "short_torso", "top_heavy", "bottom_heavy",
]);

// ---- 共通: admin チェック ----
async function requireAdmin() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "認証が必要です" }, { status: 401 }) };
  if (!isAdminEmail(user.email)) {
    return { error: NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 }) };
  }
  return { user };
}

// ---- GET: 一覧 ----
// クエリ: ?source=manual&limit=50&offset=0
// 並び順: source=manual を上位、curation_priority desc、created_at desc
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;

    const { searchParams } = new URL(request.url);
    const sourceFilter = searchParams.get("source");
    const limit = Math.min(Math.max(1, Number(searchParams.get("limit") ?? "50")), 200);
    const offset = Math.max(0, Number(searchParams.get("offset") ?? "0"));

    const service = createServiceClient();

    // 並び替え: manual かつ curation_priority desc を最優先で見せる
    let query = service
      .from("external_products")
      .select("*")
      .order("source", { ascending: true })          // manual が先頭（アルファベット順）
      .order("curation_priority", { ascending: false })
      .order("created_at" as never, { ascending: false })
      .range(offset, offset + limit - 1);

    if (sourceFilter && sourceFilter !== "all") {
      query = query.eq("source", sourceFilter);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const productRows = (data ?? []) as unknown as Record<string, unknown>[];
    const productIds = productRows.map((r) => r.id as string);

    // 関連 product_concept_tags を一括取得
    const tagsByProduct = new Map<string, ProductConceptTag[]>();
    if (productIds.length > 0) {
      const { data: tagRows } = await service
        .from("product_concept_tags")
        .select("*")
        .in("product_id", productIds);
      ((tagRows ?? []) as unknown as Record<string, unknown>[]).forEach((t) => {
        const pid = t.product_id as string;
        const arr = tagsByProduct.get(pid) ?? [];
        arr.push({
          conceptKeyword: t.concept_keyword as string,
          weight:         (t.weight as number | null) ?? 50,
        });
        tagsByProduct.set(pid, arr);
      });
    }

    const products: AdminProduct[] = productRows.map((row) => {
      const base = rowToExternalProduct(row);
      return { ...base, conceptTags: tagsByProduct.get(base.id) ?? [] };
    });

    const response: AdminProductListResponse = { products };
    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "商品一覧の取得に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ---- POST: 登録 ----
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;

    const body = await request.json() as CreateProductRequest;

    // バリデーション
    if (!body.brand?.trim()) return NextResponse.json({ error: "ブランド名は必須です" }, { status: 400 });
    if (!body.name?.trim()) return NextResponse.json({ error: "商品名は必須です" }, { status: 400 });
    if (!body.imageUrl?.trim()) return NextResponse.json({ error: "画像URLは必須です" }, { status: 400 });
    if (!body.productUrl?.trim()) return NextResponse.json({ error: "購入URLは必須です" }, { status: 400 });
    if (!body.normalizedCategory || !VALID_CATEGORIES.has(body.normalizedCategory)) {
      return NextResponse.json({ error: "有効なカテゴリを指定してください" }, { status: 400 });
    }

    const bodyCompatTags = (body.bodyCompatTags ?? []).filter((t) => VALID_BODY_CONCERNS.has(t));
    const worldviewTags  = (body.worldviewTags ?? []).map((s) => s.trim()).filter(Boolean);
    const priority       = Math.min(Math.max(0, body.curationPriority ?? 50), 100);

    const service = createServiceClient();
    const externalId = `manual:${crypto.randomUUID()}`;

    const insertRow = {
      source:                "manual",
      external_id:           externalId,
      name:                  body.name.trim(),
      brand:                 body.brand.trim(),
      price:                 body.price ?? null,
      product_url:           body.productUrl.trim(),
      affiliate_url:         body.affiliateUrl?.trim() || null,
      image_url:             body.imageUrl.trim(),
      normalized_category:   body.normalizedCategory,
      normalized_color:      body.normalizedColor?.trim() || null,
      normalized_material:   body.normalizedMaterial?.trim() || null,
      normalized_silhouette: body.normalizedSilhouette?.trim() || null,
      normalized_taste:      null,
      is_available:          true,
      worldview_tags:        worldviewTags,
      body_compat_tags:      bodyCompatTags,
      curation_notes:        body.curationNotes?.trim() || null,
      curation_priority:     priority,
      curated_by:            auth.user.id,
      synced_at:             new Date().toISOString(),
    };

    const { data: inserted, error } = await service
      .from("external_products")
      .insert(insertRow as never)
      .select()
      .single();

    if (error || !inserted) {
      return NextResponse.json({ error: error?.message ?? "登録に失敗しました" }, { status: 500 });
    }

    const product = rowToExternalProduct(inserted as unknown as Record<string, unknown>);

    // worldviewTags を product_concept_tags に weight=50 でも書く（重複は無視）
    if (worldviewTags.length > 0) {
      const tagRows = worldviewTags.map((kw) => ({
        product_id:      product.id,
        concept_keyword: kw,
        weight:          50,
      }));
      await service
        .from("product_concept_tags")
        .upsert(tagRows as never, { onConflict: "product_id,concept_keyword" });
    }

    const adminProduct: AdminProduct = {
      ...product,
      conceptTags: worldviewTags.map((kw) => ({ conceptKeyword: kw, weight: 50 })),
    };
    return NextResponse.json({ product: adminProduct });
  } catch (err) {
    const message = err instanceof Error ? err.message : "商品登録に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
