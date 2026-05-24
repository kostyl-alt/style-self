// D1 Phase 2 ムードボード API: 画像追加 POST(moodboard_items に新規 row 追加)
//
// POST /api/moodboards/[id]/items
//
// 設計: docs/STYLE-SELF_D1_Sprint_C-2_段階2_API_設計調査.md(1c0a270)§4.3
// 段階1 基盤: supabase/migrations/026_d1_moodboards.sql(ec12f7b)
// 段階2-A/B: types/moodboard.ts + /api/moodboards GET/POST(b472fc2)
// 段階2-C:   /api/moodboards/[id] GET/PATCH/DELETE(e9cd0ad)
//
// 【責務分担】案 X(M3 posts/route.ts と同形)
// - クライアント: uploadMoodboardImage(lib/storage.ts・ec12f7b)で
//   EXIF 除去(processImageForUpload・Canvas 再エンコード)+ Storage upload
//   → 確定した image_url(moodboard-images bucket の public URL)を取得して API に POST
// - API(本ルート): body 検証 + 親 MB 本人所有確認 + moodboard_items INSERT のみ
//
// 【セキュリティ / プライバシー】M3 posts/route.ts と同型(本人保証の二重防御)
//   ・createSupabaseServerClient()(cookie-bound RLS)のみ・★ service_role 不使用
//   ・moodboard_id は URL の動的セグメント [id] から取得(body から一切受けない)
//   ・user.id は auth.getUser() 固定使用(body から受けない)
//   ・★ 親 MB 本人所有確認:moodboards.user_id === auth.uid()(403 if 他人 / 404 if 不在)
//     = 他人の MB ID を渡しても items 追加が走らない二重防御
//   ・RLS "users own moodboard_items" FOR ALL(親経由 EXISTS)が DB 層の最終防御
//   ・★ image_url SSRF 防止:moodboard-images bucket の public URL prefix 一致のみ許可
//     = 任意の外部 URL を items に保存させない(XSS / 漏洩経路の予防)
//
// 【孤児画像の扱い】M3 と同様に MVP は許容
//   クライアントで画像 Storage upload → 本 API call が 401/403/500 で失敗、というケースで
//   items に紐付かない画像が Storage に残る可能性がある。MVP は許容(将来 cron で清掃可)。

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { MoodboardItemRow } from "@/types/moodboard";

export const dynamic = "force-dynamic";

// moodboard-images バケット名は lib/storage.ts と同じ source of truth。
// import すると server route に client モジュールが連鎖するので独立定数として持つ(M3 posts/[id] 同型)。
const MOODBOARD_BUCKET = "moodboard-images";

// Postgres UUID 形式の正規表現
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CAPTION_MAX = 500;
const SOURCE_URL_MAX = 2000;

interface RouteContext {
  params: { id: string };
}

interface AddItemBody {
  image_url?:   unknown;
  caption?:     unknown;
  source_url?:  unknown;
  order_index?: unknown;
}

// image_url の許可プレフィックスを環境変数から組む(M3 posts/route.ts と同形)。
// 形式: <NEXT_PUBLIC_SUPABASE_URL>/storage/v1/object/public/moodboard-images/
// → 任意 URL の丸呑みを構造的に拒否(SSRF・悪意ある外部 URL の予防)。
function buildAllowedImageUrlPrefix(): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base.replace(/\/+$/, "")}/storage/v1/object/public/${MOODBOARD_BUCKET}/`;
}

// ====================================================================
// POST — 画像追加(items 新規 row)
// ====================================================================

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
    let body: AddItemBody;
    try {
      body = (await request.json()) as AddItemBody;
    } catch {
      return NextResponse.json({ error: "JSON パースに失敗しました" }, { status: 400 });
    }

    // 4) image_url 検証(必須・文字列・空でない・Supabase Storage prefix 一致)
    if (typeof body.image_url !== "string" || body.image_url.trim() === "") {
      return NextResponse.json({ error: "image_url は必須です" }, { status: 400 });
    }
    const image_url = body.image_url.trim();
    const allowedPrefix = buildAllowedImageUrlPrefix();
    if (!allowedPrefix) {
      // env var 未設定は実装/デプロイ事故なので 500
      return NextResponse.json(
        { error: "サーバ設定が不正です(SUPABASE_URL 未設定)" },
        { status: 500 },
      );
    }
    if (!image_url.startsWith(allowedPrefix)) {
      // 任意の外部 URL を items に保存させない(SSRF 的悪用の予防)
      return NextResponse.json(
        { error: "image_url は moodboard-images バケットの公開URLである必要があります" },
        { status: 400 },
      );
    }

    // 5) caption 検証(任意・500 字以下)
    let caption = "";
    if (body.caption !== undefined && body.caption !== null) {
      if (typeof body.caption !== "string") {
        return NextResponse.json({ error: "caption は文字列が必要です" }, { status: 400 });
      }
      if (body.caption.length > CAPTION_MAX) {
        return NextResponse.json(
          { error: `caption は ${CAPTION_MAX} 文字以下にしてください(現在 ${body.caption.length} 文字)` },
          { status: 400 },
        );
      }
      caption = body.caption;
    }

    // 6) source_url 検証(任意・2000 字以下)
    let source_url: string | null = null;
    if (body.source_url !== undefined && body.source_url !== null) {
      if (typeof body.source_url !== "string") {
        return NextResponse.json({ error: "source_url は文字列が必要です" }, { status: 400 });
      }
      if (body.source_url.length > SOURCE_URL_MAX) {
        return NextResponse.json(
          { error: `source_url は ${SOURCE_URL_MAX} 文字以下にしてください` },
          { status: 400 },
        );
      }
      source_url = body.source_url.trim() === "" ? null : body.source_url;
    }

    // 7) order_index 検証(任意・integer・default 0)
    let order_index = 0;
    if (body.order_index !== undefined && body.order_index !== null) {
      if (typeof body.order_index !== "number" || !Number.isInteger(body.order_index)) {
        return NextResponse.json({ error: "order_index は整数が必要です" }, { status: 400 });
      }
      order_index = body.order_index;
    }

    // 8) ★ 親 MB 本人所有確認(RLS でも担保されるが二重防御で明示)
    //    user_id を取得して === auth.uid() を判定
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

    // 9) INSERT moodboard_items
    //    types/database.ts に moodboard_items 行型が未掲載のため as never で型を吸収(既存パターン)
    const { data: inserted, error: insErr } = await supabase
      .from("moodboard_items")
      .insert({
        moodboard_id: params.id,
        image_url,
        caption,
        source_url,
        order_index,
      } as never)
      .select("id, image_url, caption, source_url, order_index, created_at")
      .single() as unknown as {
        data: MoodboardItemRow | null;
        error: { message: string } | null;
      };

    if (insErr || !inserted) {
      console.warn("[moodboards/[id]/items POST] insert error:", insErr?.message ?? "no data");
      return NextResponse.json(
        { error: insErr?.message ?? "画像の追加に失敗しました" },
        { status: 500 },
      );
    }

    return NextResponse.json({ item: inserted });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[moodboards/[id]/items POST] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
