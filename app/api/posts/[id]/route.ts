// M3-5: 投稿削除 API
//
// DELETE /api/posts/[id]
//
// 【セキュリティ】M2-4 publicity API と同型(本人保証の二重防御)
// - createSupabaseServerClient()(認証 client) のみ。service_role 使わない
// - postId は URL の動的セグメント [id] から取得(body から一切受けない)
// - body から author_user_id を一切受けない → 認証から取った user.id を固定使用
// - .eq("author_user_id", user.id) のアプリ層フィルタ + RLS "users own posts" FOR ALL
//   = 他人の投稿 ID を渡しても DB 削除が走らない二重防御
//
// 【Storage 画像削除の順序】DB 先 → Storage 後(ベストエフォート)
// - DB 削除が確実に成功してから Storage 削除を試みる
// - Storage 削除失敗時は console.warn のみ・成功扱い(M3-2 で「孤児画像 MVP 許容」確定済み)
// - 逆順(Storage 先・DB 後)だと「投稿は見える + 画像 broken」という重い問題が起きうるため不採用
//
// 【表示側との整合】M3-4 fallback が削除を自動吸収
// - 削除後の /p/[postId] → posts is_public=true 行なし → PostNotFound「見られません」
// - 削除後の /u/[userId] Posts 一覧 → 行が返らず自然に消える
// - = 表示側は M3-5 で一切手を入れない

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

// post-images バケット名は lib/storage.ts と同じ source of truth。
// import すると server route に client モジュールが連鎖するので独立定数として持つ。
const POST_BUCKET = "post-images";

// Postgres UUID 形式の正規表現(M3-4 と同じ)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface RouteContext {
  params: { id: string };
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const postId = params.id;
    if (!UUID_RE.test(postId)) {
      return NextResponse.json({ error: "postId が不正です" }, { status: 400 });
    }

    const supabase = createSupabaseServerClient();

    // 1) 認証
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // 2) DB 削除(本人投稿のみ・アプリ層 .eq + RLS の二重防御)
    //    .select("image_url").maybeSingle() で削除した行の image_url を取り戻し、
    //    Storage 削除に使う。
    //    types/database.ts に posts 行型が未掲載のため as 経由で吸収(既存パターン)。
    const { data: deleted, error: delErr } = await supabase
      .from("posts")
      .delete()
      .eq("id", postId)
      .eq("author_user_id", user.id)
      .select("image_url")
      .maybeSingle() as unknown as {
        data: { image_url: string | null } | null;
        error: { message: string } | null;
      };

    if (delErr) {
      console.warn("[posts DELETE] db error:", delErr.message);
      return NextResponse.json({ error: delErr.message }, { status: 500 });
    }

    if (!deleted) {
      // 該当行なし: 他人の投稿 / 既削除 / 存在しない
      // = "ない" を表現する 404(本人だが見つからない場合と他人の投稿を区別しない)
      return NextResponse.json({ error: "投稿が見つかりません" }, { status: 404 });
    }

    // 3) Storage 画像をベストエフォート削除(失敗してもログ・成功扱い)
    //    Storage RLS は "post-images: users can delete own files" で
    //    foldername[1] = auth.uid() を要求する。本 API 経由なら user.id 認証 client
    //    で削除権限あり(file は同じ user.id フォルダ配下の前提)。
    if (deleted.image_url) {
      try {
        const url = new URL(deleted.image_url);
        const parts = url.pathname.split(`/public/${POST_BUCKET}/`);
        if (parts.length >= 2) {
          const path = parts[1];
          const { error: stErr } = await supabase.storage.from(POST_BUCKET).remove([path]);
          if (stErr) {
            // 孤児になるが MVP は許容(M3-2 確定)。将来 cron で清掃する設計余地あり
            console.warn("[posts DELETE] storage remove error(orphan):", stErr.message);
          }
        } else {
          console.warn("[posts DELETE] storage path parse failed(orphan):", deleted.image_url);
        }
      } catch (e) {
        console.warn("[posts DELETE] storage cleanup failed(orphan):", e instanceof Error ? e.message : e);
      }
    }

    return NextResponse.json({ ok: true, deletedId: postId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[posts DELETE] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
