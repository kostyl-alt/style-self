// D1 Phase 2 ムードボード API v3: 外部 URL から画像追加(OpenGraph + 自動分析)
//
// POST /api/moodboards/[id]/items/from-url
//
// 設計: docs/STYLE-SELF_D1_Sprint_C-2_段階3-B_v3_革新設計_調査.md(cd1b01a)§3
// 段階1 基盤: supabase/migrations/026_d1_moodboards.sql(ec12f7b)
// v3 helpers: lib/utils/og-image-extractor.ts + lib/utils/vision-analyzer.ts
//
// 【フロー】
//   外部 URL(Pinterest/Instagram/Vogue 等)受け取り
//     ↓
//   extractOgImageUrl(★ SSRF 5 重防御適用)→ og:image URL 取得
//     ↓
//   fetchImageBuffer(★ SSRF 5 重防御再適用)→ 画像 Buffer + content-type
//     ↓
//   Supabase Storage(moodboard-images bucket)へ upload(本人 userId フォルダ)
//     ↓
//   ★ analyzeImage(public URL)→ Vision で自動分析
//     ↓
//   moodboard_items INSERT(source_url = 元 URL)
//
// 【fallback】
// - Vision 失敗時: caption 空・画像のみ追加(v2 手動編集可)
// - extractOgImageUrl / fetchImageBuffer 失敗時: 400 で拒否
//
// 【EXIF】MVP は直接 upload(web 経由画像は通常 EXIF stripping 済・将来検討)

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { extractOgImageUrl, fetchImageBuffer } from "@/lib/utils/og-image-extractor";
import { analyzeImage } from "@/lib/utils/vision-analyzer";
import { withCategoryPrefix } from "@/lib/utils/moodboard-essentials";
import type { MoodboardItemRow } from "@/types/moodboard";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MOODBOARD_BUCKET = "moodboard-images";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface RouteContext {
  params: { id: string };
}

interface FromUrlBody {
  url?: unknown;
}

function pickExt(contentType: string): string {
  const ct = contentType.toLowerCase();
  if (ct.includes("png"))  return "png";
  if (ct.includes("webp")) return "webp";
  if (ct.includes("gif"))  return "gif";
  return "jpg";
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    // 1) moodboard_id 検証
    if (!UUID_RE.test(params.id)) {
      return NextResponse.json({ error: "moodboard_id が不正です" }, { status: 400 });
    }

    // 2) 認証
    const supabase = createSupabaseServerClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // 3) body パース
    let body: FromUrlBody;
    try {
      body = (await request.json()) as FromUrlBody;
    } catch {
      return NextResponse.json({ error: "JSON パースに失敗しました" }, { status: 400 });
    }

    // 4) url 検証
    if (typeof body.url !== "string" || body.url.trim() === "") {
      return NextResponse.json({ error: "url は必須です" }, { status: 400 });
    }
    const sourceUrl = body.url.trim();

    // 5) URL parse 可能か(ここで形式不正は弾く)
    let parsedSource: URL;
    try {
      parsedSource = new URL(sourceUrl);
    } catch {
      return NextResponse.json({ error: "URL の形式が不正です" }, { status: 400 });
    }
    if (parsedSource.protocol !== "https:") {
      return NextResponse.json({ error: "https URL のみ対応しています" }, { status: 400 });
    }

    // 6) 親 MB 本人所有確認(本人 RLS 二重防御)
    const { data: mb } = await supabase
      .from("moodboards")
      .select("id, user_id")
      .eq("id", params.id)
      .maybeSingle() as unknown as { data: { id: string; user_id: string } | null };

    if (!mb) {
      return NextResponse.json({ error: "ムードボードが見つかりません" }, { status: 404 });
    }
    if (mb.user_id !== user.id) {
      return NextResponse.json({ error: "このムードボードに追加する権限がありません" }, { status: 403 });
    }

    // 7) ★ SSRF 5 重防御適用で og:image 抽出 → 画像 Buffer 取得
    let imageBuffer: Buffer;
    let imageContentType: string;
    try {
      const ogImageUrl = await extractOgImageUrl(sourceUrl);
      const fetched = await fetchImageBuffer(ogImageUrl);
      imageBuffer = fetched.buffer;
      imageContentType = fetched.contentType;
    } catch (fetchErr) {
      const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    // 8) Supabase Storage へ upload(本人 userId フォルダ・Storage RLS Schema Policies 経由)
    //    パスは段階1-C `uploadMoodboardImage` 同型(3 階層・MB 単位束ね)
    const ext = pickExt(imageContentType);
    const path = `${user.id}/${params.id}/${Date.now()}.${ext}`;
    const { error: stErr } = await supabase.storage
      .from(MOODBOARD_BUCKET)
      .upload(path, imageBuffer, {
        upsert: false,
        contentType: imageContentType,
      });
    if (stErr) {
      console.warn("[items/from-url] storage upload error:", stErr.message);
      return NextResponse.json(
        { error: `画像の保存に失敗しました: ${stErr.message}` },
        { status: 500 },
      );
    }
    const { data: { publicUrl } } = supabase.storage
      .from(MOODBOARD_BUCKET)
      .getPublicUrl(path);

    // 9) ★ Vision で自動分析(失敗時 fallback: caption 空)
    let caption = "";
    let analysis: Awaited<ReturnType<typeof analyzeImage>> | null = null;
    try {
      analysis = await analyzeImage(publicUrl);
      const primaryCategory = analysis.categories[0] ?? "";
      caption = withCategoryPrefix(primaryCategory, analysis.caption);
    } catch (visionErr) {
      const msg = visionErr instanceof Error ? visionErr.message : String(visionErr);
      console.warn("[items/from-url] vision failed:", msg);
    }

    // 10) 既存 items 数取得(order_index 採番)
    const { count: existingCount } = await supabase
      .from("moodboard_items")
      .select("id", { count: "exact", head: true })
      .eq("moodboard_id", params.id);
    const orderIndex = existingCount ?? 0;

    // 11) moodboard_items INSERT(source_url = 元 URL)
    const { data: inserted, error: insErr } = await supabase
      .from("moodboard_items")
      .insert({
        moodboard_id: params.id,
        image_url: publicUrl,
        caption,
        source_url: sourceUrl,
        order_index: orderIndex,
      } as never)
      .select("id, image_url, caption, source_url, order_index, created_at")
      .single() as unknown as {
        data: MoodboardItemRow | null;
        error: { message: string } | null;
      };

    if (insErr || !inserted) {
      // ★ insert 失敗時の Storage 孤児画像は MVP 許容(M3-2 同型・将来 cron 清掃)
      console.warn("[items/from-url] insert error:", insErr?.message ?? "no data");
      return NextResponse.json(
        { error: insErr?.message ?? "画像追加に失敗しました" },
        { status: 500 },
      );
    }

    return NextResponse.json({ item: inserted, analysis, source_url: sourceUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[items/from-url] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
