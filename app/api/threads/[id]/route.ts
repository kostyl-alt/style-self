// Sprint H-2: Chat Thread API — スレッド詳細 GET(messages 含む)/ 更新 PATCH / 削除 DELETE
//
// GET    /api/threads/[id]
// PATCH  /api/threads/[id]
// DELETE /api/threads/[id]
//
// 設計: docs/STYLE-SELF_Sprint-H_対話型AIスタイリスト_実装設計調査.md(0771ea6)§B
// 段階1 基盤: supabase/migrations/027_h1_chat_threads.sql
//
// 【セキュリティ(moodboards/[id]/route.ts と同型)】
//   ・createSupabaseServerClient()(cookie-bound RLS)のみ・service_role 不使用
//   ・RLS "users own chat_threads" FOR ALL が DB 層の最終防御
//   ・DELETE 時は messages / feedback が FK ON DELETE CASCADE で自動削除(027)

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { ChatThreadRow, MessageRow, ChatThreadWithMessages } from "@/types/chat-thread";
import { ASPIRATION_BUCKET } from "@/lib/storage";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TITLE_MAX = 200;

interface RouteContext {
  params: { id: string };
}

interface UpdateThreadBody {
  title?:        unknown;
  moodboard_id?: unknown;
}

// ====================================================================
// GET — スレッド詳細(messages 時系列含む)
// ====================================================================

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    if (!UUID_RE.test(params.id)) {
      return NextResponse.json({ error: "id が不正です" }, { status: 400 });
    }

    const supabase = createSupabaseServerClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // RLS スコープ下で本人スレッドのみ取得可能
    const { data: thread } = await supabase
      .from("chat_threads")
      .select("id, title, moodboard_id, created_at, updated_at, last_message_at")
      .eq("id", params.id)
      .maybeSingle() as unknown as { data: ChatThreadRow | null };

    if (!thread) {
      return NextResponse.json({ error: "見つかりません" }, { status: 404 });
    }

    const { data: messages, error: msgErr } = await supabase
      .from("messages")
      .select("id, thread_id, role, content, attachments, metadata, created_at")
      .eq("thread_id", params.id)
      .order("created_at", { ascending: true });

    if (msgErr) {
      console.warn("[threads/[id] GET] messages error:", msgErr.message);
      return NextResponse.json({ error: msgErr.message }, { status: 500 });
    }

    const response: ChatThreadWithMessages = {
      ...thread,
      messages: (messages ?? []) as MessageRow[],
    };
    return NextResponse.json({ thread: response });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[threads/[id] GET] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ====================================================================
// PATCH — title / moodboard_id 更新
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

    let body: UpdateThreadBody;
    try {
      body = (await request.json()) as UpdateThreadBody;
    } catch {
      return NextResponse.json({ error: "JSON パースに失敗しました" }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};

    if (body.title !== undefined) {
      if (typeof body.title !== "string") {
        return NextResponse.json({ error: "title は文字列が必要です" }, { status: 400 });
      }
      updates.title = body.title.trim().slice(0, TITLE_MAX);
    }

    if (body.moodboard_id !== undefined) {
      if (body.moodboard_id === null) {
        updates.moodboard_id = null;  // 添付解除
      } else if (typeof body.moodboard_id !== "string" || !UUID_RE.test(body.moodboard_id)) {
        return NextResponse.json({ error: "moodboard_id が不正です" }, { status: 400 });
      } else {
        // 本人所有 MB のみ添付可能
        const { data: mb } = await supabase
          .from("moodboards")
          .select("id")
          .eq("id", body.moodboard_id)
          .eq("user_id", user.id)
          .maybeSingle() as unknown as { data: { id: string } | null };
        if (!mb) {
          return NextResponse.json({ error: "添付ムードボードが見つかりません" }, { status: 400 });
        }
        updates.moodboard_id = body.moodboard_id;
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "更新項目がありません" }, { status: 400 });
    }

    const { data: updated, error: updErr } = await supabase
      .from("chat_threads")
      .update(updates as never)
      .eq("id", params.id)
      .select("id, title, moodboard_id, created_at, updated_at, last_message_at")
      .maybeSingle() as unknown as {
        data: ChatThreadRow | null;
        error: { message: string } | null;
      };

    if (updErr) {
      console.warn("[threads/[id] PATCH] error:", updErr.message);
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }
    if (!updated) {
      return NextResponse.json({ error: "見つかりません" }, { status: 404 });
    }

    return NextResponse.json({ thread: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[threads/[id] PATCH] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ====================================================================
// DELETE — スレッド削除(messages / feedback は FK CASCADE で自動削除)
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

    // ★ Storage 削除連動: 削除前に この thread の image message から aspiration 画像の storagePath を収集
    //   (CASCADE で messages が消える前に取得)。多層防御: thread_id scope + kind==="image" +
    //   storagePath 文字列 + ${user.id}/ 始まり(own folder)。upload 失敗の text message は storagePath
    //   無しでスキップ(誤検出なし)。RLS(messages 本人 via thread)で本人 thread のみ読める。
    const { data: msgRows } = await supabase
      .from("messages")
      .select("metadata")
      .eq("thread_id", params.id) as unknown as { data: { metadata: unknown }[] | null };

    const imagePaths = (msgRows ?? [])
      .map((r) => {
        const content = (r.metadata as { message?: { content?: { kind?: string; storagePath?: unknown } } } | null)
          ?.message?.content;
        return content?.kind === "image" && typeof content.storagePath === "string" ? content.storagePath : null;
      })
      .filter((p): p is string => p !== null && p.startsWith(`${user.id}/`));

    const { data: deleted, error: delErr } = await supabase
      .from("chat_threads")
      .delete()
      .eq("id", params.id)
      .select("id")
      .maybeSingle() as unknown as {
        data: { id: string } | null;
        error: { message: string } | null;
      };

    if (delErr) {
      console.warn("[threads/[id] DELETE] error:", delErr.message);
      return NextResponse.json({ error: delErr.message }, { status: 500 });
    }
    if (!deleted) {
      return NextResponse.json({ error: "見つかりません" }, { status: 404 });
    }

    // ★ best-effort: aspiration 画像を Storage から削除(moodboards/[id] DELETE 同型・失敗は warn・graceful)。
    //   own-folder delete RLS が DB 層の最終防御。失敗してもオーファンが残るだけで thread 削除は成功扱い。
    if (imagePaths.length > 0) {
      console.warn(`[threads/[id] DELETE] removing ${imagePaths.length} aspiration image(s):`, imagePaths);
      const { error: stErr } = await supabase.storage.from(ASPIRATION_BUCKET).remove(imagePaths);
      if (stErr) {
        console.warn("[threads/[id] DELETE] storage cleanup error(orphan):", stErr.message);
      }
    }

    return NextResponse.json({ ok: true, deletedId: params.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[threads/[id] DELETE] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
