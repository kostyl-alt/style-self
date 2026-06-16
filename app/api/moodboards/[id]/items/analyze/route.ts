// D1 Phase 2 ムードボード API v3: 画像自動分析 + items INSERT
//
// POST /api/moodboards/[id]/items/analyze
//
// 設計: docs/STYLE-SELF_D1_Sprint_C-2_段階3-B_v3_革新設計_調査.md(cd1b01a)§2
// 段階1 基盤: supabase/migrations/026_d1_moodboards.sql(ec12f7b)
// v3 helper: lib/utils/vision-analyzer.ts(本セッション)
//
// 【責務】
// - クライアント側で uploadMoodboardImage 済の image_url を受け取る
// - Claude Vision で自動分析(カテゴリ + caption + 主要色)
// - caption に [category] プレフィックス自動付与 → moodboard_items INSERT
// - 結果(item + analysis)を返却
//
// 【fallback】
// - Vision API 失敗時: caption 空で items INSERT(画像のみ保存・v2 手動編集可)
//
// 【セキュリティ】
// - 既存 段階2-D /items POST と同型(本人 RLS 二重防御 + Storage URL prefix 検証)

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { analyzeImage } from "@/lib/utils/vision-analyzer";
import { withCategoryPrefix } from "@/lib/utils/moodboard-essentials";
import type { MoodboardItemRow } from "@/types/moodboard";

export const dynamic = "force-dynamic";
export const maxDuration = 60;  // Vision API は秒単位かかる

const MOODBOARD_BUCKET = "moodboard-images";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface RouteContext {
  params: { id: string };
}

interface AnalyzeBody {
  image_url?: unknown;
}

function buildAllowedImagePrefix(): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base.replace(/\/+$/, "")}/storage/v1/object/public/${MOODBOARD_BUCKET}/`;
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
    let body: AnalyzeBody;
    try {
      body = (await request.json()) as AnalyzeBody;
    } catch {
      return NextResponse.json({ error: "JSON パースに失敗しました" }, { status: 400 });
    }

    // 4) image_url 検証(★ moodboard-images bucket prefix のみ・SSRF 防止)
    if (typeof body.image_url !== "string" || body.image_url.trim() === "") {
      return NextResponse.json({ error: "image_url は必須です" }, { status: 400 });
    }
    const image_url = body.image_url.trim();
    const allowedPrefix = buildAllowedImagePrefix();
    if (allowedPrefix === null) {
      return NextResponse.json(
        { error: "サーバ設定が不正です(SUPABASE_URL 未設定)" },
        { status: 500 },
      );
    }
    if (!image_url.startsWith(allowedPrefix)) {
      return NextResponse.json(
        { error: "image_url は moodboard-images バケットの公開URLである必要があります" },
        { status: 400 },
      );
    }

    // 5) 親 MB 本人所有確認(本人 RLS 二重防御)
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

    // 6) 既存 items 数取得(order_index 採番)
    const { count: existingCount } = await supabase
      .from("moodboard_items")
      .select("id", { count: "exact", head: true })
      .eq("moodboard_id", params.id);
    const orderIndex = existingCount ?? 0;

    // 7) ★ Claude Vision で自動分析(失敗時 fallback: caption 空)
    let caption = "";
    let analysis: Awaited<ReturnType<typeof analyzeImage>> | null = null;
    try {
      analysis = await analyzeImage(image_url);
      const primaryCategory = analysis.categories[0] ?? "";
      caption = withCategoryPrefix(primaryCategory, analysis.caption);
    } catch (visionErr) {
      // ★ fallback: Vision 失敗時は caption 空で続行(v2 手動編集モーダルで補正可能)
      const msg = visionErr instanceof Error ? visionErr.message : String(visionErr);
      console.warn("[items/analyze] vision failed:", msg);
    }

    // 8) moodboard_items INSERT
    const { data: inserted, error: insErr } = await supabase
      .from("moodboard_items")
      .insert({
        moodboard_id: params.id,
        image_url,
        caption,
        source_url: null,
        order_index: orderIndex,
        // ★ 複数画像MB分析 Step 1: 画像ごとの構造化 vision を保存(Vision 失敗時は {})。caption は温存。
        vision: analysis?.vision ?? {},
      } as never)
      .select("id, image_url, caption, source_url, order_index, created_at")
      .single() as unknown as {
        data: MoodboardItemRow | null;
        error: { message: string } | null;
      };

    if (insErr || !inserted) {
      console.warn("[items/analyze] insert error:", insErr?.message ?? "no data");
      return NextResponse.json(
        { error: insErr?.message ?? "画像追加に失敗しました" },
        { status: 500 },
      );
    }

    return NextResponse.json({ item: inserted, analysis });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[items/analyze] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
