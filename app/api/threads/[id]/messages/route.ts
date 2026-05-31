// Sprint H-2: Chat Thread API — スレッド内メッセージ一覧 GET / メッセージ保存 POST
//
// GET  /api/threads/[id]/messages
// POST /api/threads/[id]/messages
//
// 設計: docs/STYLE-SELF_Sprint-H_対話型AIスタイリスト_実装設計調査.md(0771ea6)§B
// 段階1 基盤: supabase/migrations/027_h1_chat_threads.sql
//
// 【H-2 スコープ】メッセージの永続化のみ。AI 応答生成(stylist-chat 配線)は H-4。
//   POST は role/content を受けて messages に保存し、親 thread.last_message_at を now() に更新。
//
// 【セキュリティ】
//   ・RLS "users own messages via thread"(親 chat_threads 経由 EXISTS)が DB 層の最終防御
//   ・親スレッド本人所有を select で確認してから insert(クリーンな 404 + 二重防御)

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { MessageRow } from "@/types/chat-thread";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CONTENT_MAX = 16000;

interface RouteContext {
  params: { id: string };
}

interface PostMessageBody {
  role?:        unknown;
  content?:     unknown;
  attachments?: unknown;
  metadata?:    unknown;
}

// 親スレッドが本人所有か確認(RLS スコープ下)。見つからなければ null。
async function ownThread(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  threadId: string,
): Promise<{ id: string } | null> {
  const { data } = await supabase
    .from("chat_threads")
    .select("id")
    .eq("id", threadId)
    .maybeSingle() as unknown as { data: { id: string } | null };
  return data;
}

// ====================================================================
// GET — スレッド内メッセージ一覧(時系列)
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

    if (!(await ownThread(supabase, params.id))) {
      return NextResponse.json({ error: "見つかりません" }, { status: 404 });
    }

    const { data, error } = await supabase
      .from("messages")
      .select("id, thread_id, role, content, attachments, metadata, created_at")
      .eq("thread_id", params.id)
      .order("created_at", { ascending: true });

    if (error) {
      console.warn("[messages GET] error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ messages: (data ?? []) as MessageRow[] });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[messages GET] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ====================================================================
// POST — メッセージ保存(永続化のみ・AI 生成は H-4)
// ====================================================================

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    if (!UUID_RE.test(params.id)) {
      return NextResponse.json({ error: "id が不正です" }, { status: 400 });
    }

    const supabase = createSupabaseServerClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    if (!(await ownThread(supabase, params.id))) {
      return NextResponse.json({ error: "見つかりません" }, { status: 404 });
    }

    let body: PostMessageBody;
    try {
      body = (await request.json()) as PostMessageBody;
    } catch {
      return NextResponse.json({ error: "JSON パースに失敗しました" }, { status: 400 });
    }

    // role 検証(必須・user | assistant)
    if (body.role !== "user" && body.role !== "assistant") {
      return NextResponse.json({ error: "role は user または assistant が必要です" }, { status: 400 });
    }

    // content 検証(必須・空不可・16000 字以下)
    if (typeof body.content !== "string" || body.content.trim() === "") {
      return NextResponse.json({ error: "content は必須です" }, { status: 400 });
    }
    const content = body.content.slice(0, CONTENT_MAX);

    // attachments / metadata は jsonb(任意・オブジェクトのみ許可)
    const attachments = isPlainObject(body.attachments) ? body.attachments : null;
    const metadata = isPlainObject(body.metadata) ? body.metadata : null;

    const { data: inserted, error: insErr } = await supabase
      .from("messages")
      .insert({
        thread_id: params.id,
        role:      body.role,
        content,
        attachments,
        metadata,
      } as never)
      .select("id, thread_id, role, content, attachments, metadata, created_at")
      .single() as unknown as {
        data: MessageRow | null;
        error: { message: string } | null;
      };

    if (insErr || !inserted) {
      console.warn("[messages POST] insert error:", insErr?.message ?? "no data");
      return NextResponse.json(
        { error: insErr?.message ?? "メッセージの保存に失敗しました" },
        { status: 500 },
      );
    }

    // 親 thread の last_message_at を更新(一覧ソート用・失敗は致命ではない)
    const { error: touchErr } = await supabase
      .from("chat_threads")
      .update({ last_message_at: inserted.created_at } as never)
      .eq("id", params.id);
    if (touchErr) {
      console.warn("[messages POST] last_message_at touch failed:", touchErr.message);
    }

    return NextResponse.json({ message: inserted });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[messages POST] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
