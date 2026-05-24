// D1 Phase 2 ムードボード API: item 個別削除 DELETE / item 更新 PATCH
//
// DELETE /api/moodboards/[id]/items/[itemId]
// PATCH  /api/moodboards/[id]/items/[itemId]
//
// 設計: docs/STYLE-SELF_D1_Sprint_C-2_段階2_API_設計調査.md(1c0a270)§4.4
// 段階1 基盤: supabase/migrations/026_d1_moodboards.sql(ec12f7b)
// 段階2-A/B: types/moodboard.ts + /api/moodboards GET/POST(b472fc2)
// 段階2-C:   /api/moodboards/[id] GET/PATCH/DELETE(e9cd0ad)
// 段階2-D:   /api/moodboards/[id]/items POST(3534179)
//
// 【セキュリティ】M3 posts/[id] + 段階2-C と同型(本人保証の三重防御)
//   ・createSupabaseServerClient()(cookie-bound RLS)のみ・★ service_role 不使用
//   ・moodboard_id / itemId は URL の動的セグメントから取得(body から一切受けない)
//   ・★ 親 MB 本人所有確認(moodboards.user_id === auth.uid())= 他人 MB の item を
//     操作できない(403)・MB 不在は 404
//   ・.eq("id", itemId).eq("moodboard_id", params.id) のアプリ層フィルタ + RLS
//     "users own moodboard_items" FOR ALL(親経由 EXISTS)= 三重防御
//
// 【DELETE 順序】DB 先 → Storage 後(M3 + 段階2-C と同型・孤児画像 MVP 許容)
//   ・削除前に items.image_url を取り戻し、Storage best-effort 削除
//   ・Storage 削除失敗時は console.warn のみ・成功扱い

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

interface RouteContext {
  params: { id: string; itemId: string };
}

interface UpdateItemBody {
  caption?:     unknown;
  order_index?: unknown;
}

// ====================================================================
// DELETE — item 個別削除 + Storage cleanup best-effort
// ====================================================================

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    // 1) UUID 二重検証(MB id + item id)
    if (!UUID_RE.test(params.id) || !UUID_RE.test(params.itemId)) {
      return NextResponse.json({ error: "id が不正です" }, { status: 400 });
    }

    // 2) 認証
    const supabase = createSupabaseServerClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // 3) ★ 親 MB 本人所有確認(段階2-D と同型)
    const { data: mb } = await supabase
      .from("moodboards")
      .select("id, user_id")
      .eq("id", params.id)
      .maybeSingle() as unknown as { data: { id: string; user_id: string } | null };

    if (!mb) {
      return NextResponse.json({ error: "ムードボードが見つかりません" }, { status: 404 });
    }
    if (mb.user_id !== user.id) {
      return NextResponse.json({ error: "このムードボードを操作する権限がありません" }, { status: 403 });
    }

    // 4) 削除前に image_url を取得(Storage cleanup 用)
    const { data: item } = await supabase
      .from("moodboard_items")
      .select("image_url")
      .eq("id", params.itemId)
      .eq("moodboard_id", params.id)
      .maybeSingle() as unknown as { data: { image_url: string } | null };

    if (!item) {
      return NextResponse.json({ error: "画像が見つかりません" }, { status: 404 });
    }

    // 5) DB delete(.eq 二重 + RLS 親経由 EXISTS の三重防御)
    const { error: delErr } = await supabase
      .from("moodboard_items")
      .delete()
      .eq("id", params.itemId)
      .eq("moodboard_id", params.id);

    if (delErr) {
      console.warn("[moodboards/items/[itemId] DELETE] db error:", delErr.message);
      return NextResponse.json({ error: delErr.message }, { status: 500 });
    }

    // 6) Storage best-effort 削除(M3 posts/[id] + 段階2-C 同型・孤児画像 MVP 許容)
    const path = extractStoragePath(item.image_url);
    if (path) {
      const { error: stErr } = await supabase.storage.from(MOODBOARD_BUCKET).remove([path]);
      if (stErr) {
        console.warn("[moodboards/items/[itemId] DELETE] storage cleanup error(orphan):", stErr.message);
      }
    } else {
      console.warn("[moodboards/items/[itemId] DELETE] storage path parse failed(orphan):", item.image_url);
    }

    return NextResponse.json({ ok: true, deletedId: params.itemId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[moodboards/items/[itemId] DELETE] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ====================================================================
// PATCH — item 更新(caption / order_index)
// ====================================================================

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    // 1) UUID 二重検証
    if (!UUID_RE.test(params.id) || !UUID_RE.test(params.itemId)) {
      return NextResponse.json({ error: "id が不正です" }, { status: 400 });
    }

    // 2) 認証
    const supabase = createSupabaseServerClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // 3) ★ 親 MB 本人所有確認
    const { data: mb } = await supabase
      .from("moodboards")
      .select("id, user_id")
      .eq("id", params.id)
      .maybeSingle() as unknown as { data: { id: string; user_id: string } | null };

    if (!mb) {
      return NextResponse.json({ error: "ムードボードが見つかりません" }, { status: 404 });
    }
    if (mb.user_id !== user.id) {
      return NextResponse.json({ error: "このムードボードを操作する権限がありません" }, { status: 403 });
    }

    // 4) body パース
    let body: UpdateItemBody;
    try {
      body = (await request.json()) as UpdateItemBody;
    } catch {
      return NextResponse.json({ error: "JSON パースに失敗しました" }, { status: 400 });
    }

    // 5) 更新項目構築(undefined は触らない)
    const updates: Record<string, unknown> = {};
    if (body.caption !== undefined) {
      if (typeof body.caption !== "string") {
        return NextResponse.json({ error: "caption は文字列が必要です" }, { status: 400 });
      }
      if (body.caption.length > CAPTION_MAX) {
        return NextResponse.json(
          { error: `caption は ${CAPTION_MAX} 文字以下にしてください(現在 ${body.caption.length} 文字)` },
          { status: 400 },
        );
      }
      updates.caption = body.caption;
    }
    if (body.order_index !== undefined) {
      if (typeof body.order_index !== "number" || !Number.isInteger(body.order_index)) {
        return NextResponse.json({ error: "order_index は整数が必要です" }, { status: 400 });
      }
      updates.order_index = body.order_index;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "更新項目がありません" }, { status: 400 });
    }

    // 6) UPDATE(.eq 二重 + RLS 親経由 EXISTS の三重防御)
    const { data: updated, error: updErr } = await supabase
      .from("moodboard_items")
      .update(updates as never)
      .eq("id", params.itemId)
      .eq("moodboard_id", params.id)
      .select("id, image_url, caption, source_url, order_index, created_at")
      .maybeSingle() as unknown as {
        data: MoodboardItemRow | null;
        error: { message: string } | null;
      };

    if (updErr) {
      console.warn("[moodboards/items/[itemId] PATCH] error:", updErr.message);
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }
    if (!updated) {
      return NextResponse.json({ error: "画像が見つかりません" }, { status: 404 });
    }

    return NextResponse.json({ item: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[moodboards/items/[itemId] PATCH] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ====================================================================
// helpers
// ====================================================================

// public URL から moodboard-images バケット配下のパスを抽出(段階2-C Route 2 と同型・独立再定義)。
// 形式: /storage/v1/object/public/moodboard-images/{userId}/{moodboardId}/{ts}.jpg
function extractStoragePath(publicUrl: string): string | null {
  try {
    const url = new URL(publicUrl);
    const parts = url.pathname.split(`/public/${MOODBOARD_BUCKET}/`);
    if (parts.length < 2) return null;
    return parts[1];
  } catch {
    return null;
  }
}
