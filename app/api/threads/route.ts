// Sprint H-2: Chat Thread API — 自分のスレッド一覧 GET / 新規作成 POST
//
// GET  /api/threads
// POST /api/threads
//
// 設計: docs/STYLE-SELF_Sprint-H_対話型AIスタイリスト_実装設計調査.md(0771ea6)§B
// 段階1 基盤: supabase/migrations/027_h1_chat_threads.sql
//
// 【セキュリティ(moodboards/route.ts と同型)】
//   ・createSupabaseServerClient()(cookie-bound RLS)のみ・service_role 不使用
//   ・user_id は body から受けない → auth.getUser() の user.id 固定使用
//   ・RLS "users own chat_threads" FOR ALL が DB 層の最終防御(027 で確立済)
//   ・添付 MB(moodboard_id)は本人所有を select で確認してから保存(他人 MB 添付防止)

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { ChatThreadRow } from "@/types/chat-thread";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TITLE_MAX = 200;

interface CreateThreadBody {
  title?:        unknown;
  moodboard_id?: unknown;
}

// ====================================================================
// GET — 自分のスレッド一覧(最新メッセージ順)
// ====================================================================

export async function GET() {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("chat_threads")
      .select("id, title, moodboard_id, created_at, updated_at, last_message_at")
      .eq("user_id", user.id)
      .order("last_message_at", { ascending: false });

    if (error) {
      console.warn("[threads GET] error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ threads: (data ?? []) as ChatThreadRow[] });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[threads GET] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ====================================================================
// POST — スレッド新規作成(title 任意・moodboard_id 任意)
// ====================================================================

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    let body: CreateThreadBody;
    try {
      body = (await request.json()) as CreateThreadBody;
    } catch {
      return NextResponse.json({ error: "JSON パースに失敗しました" }, { status: 400 });
    }

    // title 検証(任意・空可・200 字以下)
    let title = "";
    if (body.title !== undefined && body.title !== null) {
      if (typeof body.title !== "string") {
        return NextResponse.json({ error: "title は文字列が必要です" }, { status: 400 });
      }
      title = body.title.trim().slice(0, TITLE_MAX);
    }

    // moodboard_id 検証(任意・UUID 形式 + 本人所有を確認)
    let moodboard_id: string | null = null;
    if (body.moodboard_id !== undefined && body.moodboard_id !== null) {
      if (typeof body.moodboard_id !== "string" || !UUID_RE.test(body.moodboard_id)) {
        return NextResponse.json({ error: "moodboard_id が不正です" }, { status: 400 });
      }
      // RLS スコープ下で本人 MB のみ取得可能 → 見つからなければ他人 MB or 存在しない
      const { data: mb } = await supabase
        .from("moodboards")
        .select("id")
        .eq("id", body.moodboard_id)
        .eq("user_id", user.id)
        .maybeSingle() as unknown as { data: { id: string } | null };
      if (!mb) {
        return NextResponse.json({ error: "添付ムードボードが見つかりません" }, { status: 400 });
      }
      moodboard_id = body.moodboard_id;
    }

    // INSERT(user_id は user.id 固定・types/database.ts 非掲載のため as never で吸収)
    const { data: inserted, error: insErr } = await supabase
      .from("chat_threads")
      .insert({
        user_id: user.id,
        title,
        moodboard_id,
      } as never)
      .select("id, title, moodboard_id, created_at, updated_at, last_message_at")
      .single() as unknown as {
        data: ChatThreadRow | null;
        error: { message: string } | null;
      };

    if (insErr || !inserted) {
      console.warn("[threads POST] insert error:", insErr?.message ?? "no data");
      return NextResponse.json(
        { error: insErr?.message ?? "スレッドの作成に失敗しました" },
        { status: 500 },
      );
    }

    return NextResponse.json({ thread: inserted });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[threads POST] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
