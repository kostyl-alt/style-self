// D1 Phase 2 ムードボード API: 個別 MB 詳細 GET / 更新 PATCH / 削除 DELETE
//
// GET    /api/moodboards/[id]
// PATCH  /api/moodboards/[id]
// DELETE /api/moodboards/[id]
//
// 設計: docs/STYLE-SELF_D1_Sprint_C-2_段階2_API_設計調査.md(1c0a270)§4.2
// 段階1 基盤: supabase/migrations/026_d1_moodboards.sql(ec12f7b)
// 段階2-A/B: types/moodboard.ts + /api/moodboards GET/POST(b472fc2)
//
// 【セキュリティ / プライバシー(三重防御維持・posts/[id]/route.ts と同型)】
//   ・createSupabaseServerClient()(cookie-bound RLS)のみ・★ service_role 不使用
//   ・id は URL の動的セグメント [id] から取得(body から一切受けない)
//   ・PATCH/DELETE は user.id 固定使用 + .eq("user_id", user.id) のアプリ層フィルタ +
//     RLS "users own moodboards" FOR ALL = 他人の MB ID を渡しても DB が動かない二重防御
//   ・GET は anon 含めて呼び出し可能(RLS "public moodboards readable by anyone" SELECT で
//     is_public=true 行のみ返る・本人なら全行返る)
//   ・★ 列絞り SELECT: worldview_tags / worldview_keywords は SELECT 句に書かない
//     (三重防御 1・worldview_name のみ取得)
//
// 【DELETE 順序】DB 先 → Storage 後(M3 posts/[id] と同型・孤児画像 MVP 許容)
//   ・items は moodboard_items.moodboard_id FK + ON DELETE CASCADE で自動削除
//   ・削除前に items の image_url を取り戻し、Storage best-effort 削除
//   ・Storage 削除失敗時は console.warn のみ・成功扱い

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { MoodboardRow, MoodboardItemRow, MoodboardWithItems } from "@/types/moodboard";

export const dynamic = "force-dynamic";

// moodboard-images バケット名は lib/storage.ts と同じ source of truth。
// import すると server route に client モジュールが連鎖するので独立定数として持つ(M3 posts/[id] 同型)。
const MOODBOARD_BUCKET = "moodboard-images";

// Postgres UUID 形式の正規表現(posts/[id] と同じ)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const NAME_MAX = 200;
const DESCRIPTION_MAX = 2000;

interface RouteContext {
  params: { id: string };
}

interface UpdateMoodboardBody {
  name?:            unknown;
  description?:     unknown;
  is_public?:       unknown;
  cover_image_url?: unknown;
}

// ====================================================================
// GET — MB 詳細(items 含む)・anon 公開対応
// ====================================================================

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    if (!UUID_RE.test(params.id)) {
      return NextResponse.json({ error: "id が不正です" }, { status: 400 });
    }

    const supabase = createSupabaseServerClient();
    // ★ auth は任意(anon でも公開 MB は閲覧可・RLS が is_public=true を強制)

    // ★ 列絞り SELECT: worldview_tags / worldview_keywords は含めない(三重防御 1)
    //   本人なら is_public 問わず取得・anon/他人は is_public=true のみ取得(RLS)
    const { data: mb } = await supabase
      .from("moodboards")
      .select("id, user_id, name, description, is_public, cover_image_url, worldview_name, created_at, updated_at")
      .eq("id", params.id)
      .maybeSingle() as unknown as { data: MoodboardRow | null };

    if (!mb) {
      // 該当行なし: MB 不在 or 非公開で他人 / anon
      return NextResponse.json({ error: "見つかりません" }, { status: 404 });
    }

    // items 取得(同 RLS で本人 or 公開のみ・親経由 EXISTS)
    const { data: items } = await supabase
      .from("moodboard_items")
      .select("id, image_url, caption, source_url, order_index, created_at")
      .eq("moodboard_id", params.id)
      .order("order_index", { ascending: true }) as unknown as { data: MoodboardItemRow[] | null };

    const response: MoodboardWithItems = { ...mb, items: items ?? [] };
    return NextResponse.json({ moodboard: response });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[moodboards/[id] GET] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ====================================================================
// PATCH — MB 更新(本人のみ)
// ====================================================================

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    if (!UUID_RE.test(params.id)) {
      return NextResponse.json({ error: "id が不正です" }, { status: 400 });
    }

    const supabase = createSupabaseServerClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // body パース
    let body: UpdateMoodboardBody;
    try {
      body = (await request.json()) as UpdateMoodboardBody;
    } catch {
      return NextResponse.json({ error: "JSON パースに失敗しました" }, { status: 400 });
    }

    // 更新項目を構築(undefined は触らない・型と長さを検証)
    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) {
      if (typeof body.name !== "string" || body.name.trim() === "") {
        return NextResponse.json({ error: "name は空文字不可です" }, { status: 400 });
      }
      updates.name = body.name.trim().slice(0, NAME_MAX);
    }
    if (body.description !== undefined) {
      if (typeof body.description !== "string") {
        return NextResponse.json({ error: "description は文字列が必要です" }, { status: 400 });
      }
      updates.description = body.description.slice(0, DESCRIPTION_MAX);
    }
    if (body.is_public !== undefined) {
      if (typeof body.is_public !== "boolean") {
        return NextResponse.json({ error: "is_public は boolean が必要です" }, { status: 400 });
      }
      updates.is_public = body.is_public;
    }
    if (body.cover_image_url !== undefined) {
      if (body.cover_image_url !== null && typeof body.cover_image_url !== "string") {
        return NextResponse.json({ error: "cover_image_url は文字列または null が必要です" }, { status: 400 });
      }
      updates.cover_image_url = body.cover_image_url;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "更新項目がありません" }, { status: 400 });
    }

    // 本人 MB のみ更新可(アプリ層 .eq + RLS の二重防御)
    const { data: updated, error: updErr } = await supabase
      .from("moodboards")
      .update(updates as never)
      .eq("id", params.id)
      .eq("user_id", user.id)
      .select("id, name, description, is_public, cover_image_url, worldview_name, created_at, updated_at")
      .maybeSingle() as unknown as {
        data: MoodboardRow | null;
        error: { message: string } | null;
      };

    if (updErr) {
      console.warn("[moodboards/[id] PATCH] error:", updErr.message);
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }
    if (!updated) {
      // 該当行なし: 他人の MB / 既削除 / 存在しない
      return NextResponse.json({ error: "見つかりません" }, { status: 404 });
    }

    return NextResponse.json({ moodboard: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[moodboards/[id] PATCH] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ====================================================================
// DELETE — MB 削除(items は CASCADE)+ Storage cleanup best-effort
// ====================================================================

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    if (!UUID_RE.test(params.id)) {
      return NextResponse.json({ error: "id が不正です" }, { status: 400 });
    }

    const supabase = createSupabaseServerClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // 1) 削除前に items の image_url を取得(Storage cleanup 用)
    //    RLS で本人 MB の items のみ返る
    const { data: items } = await supabase
      .from("moodboard_items")
      .select("image_url")
      .eq("moodboard_id", params.id) as unknown as { data: { image_url: string }[] | null };

    // 2) DB delete(CASCADE で moodboard_items も自動削除)
    //    本人 MB のみ削除可(アプリ層 .eq + RLS の二重防御)
    const { data: deleted, error: delErr } = await supabase
      .from("moodboards")
      .delete()
      .eq("id", params.id)
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle() as unknown as {
        data: { id: string } | null;
        error: { message: string } | null;
      };

    if (delErr) {
      console.warn("[moodboards/[id] DELETE] db error:", delErr.message);
      return NextResponse.json({ error: delErr.message }, { status: 500 });
    }
    if (!deleted) {
      // 該当行なし: 他人の MB / 既削除 / 存在しない
      return NextResponse.json({ error: "見つかりません" }, { status: 404 });
    }

    // 3) Storage 配下を best-effort 削除(M3 posts/[id] 同型・孤児画像 MVP 許容)
    if (items && items.length > 0) {
      const paths = items
        .map((it) => extractStoragePath(it.image_url))
        .filter((p): p is string => p !== null);
      if (paths.length > 0) {
        const { error: stErr } = await supabase.storage.from(MOODBOARD_BUCKET).remove(paths);
        if (stErr) {
          // 孤児になるが MVP は許容(M3-2 確定)。将来 cron で清掃する設計余地あり
          console.warn("[moodboards/[id] DELETE] storage cleanup error(orphan):", stErr.message);
        }
      }
    }

    return NextResponse.json({ ok: true, deletedId: params.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[moodboards/[id] DELETE] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ====================================================================
// helpers
// ====================================================================

// public URL から moodboard-images バケット配下のパスを抽出。
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
