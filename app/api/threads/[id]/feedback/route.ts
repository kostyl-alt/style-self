// Sprint H-2: Chat Thread API — フィードバック保存 POST
//
// POST /api/threads/[id]/feedback
//
// 設計: docs/STYLE-SELF_Sprint-H_対話型AIスタイリスト_実装設計調査.md(0771ea6)§B
// 段階1 基盤: supabase/migrations/027_h1_chat_threads.sql
//
// 【H-2 スコープ】feedback の永続化のみ。judgment_rules 抽出・次回反映は H-6。
//   E-0e: ユーザーの「好き / 違う / もっと寄せる / 日常化 / このアイテムだけ変える」を残す器。
//
// 【セキュリティ】
//   ・RLS "users own feedback via thread"(親 chat_threads 経由 EXISTS)が DB 層の最終防御
//   ・親スレッド本人所有を select で確認してから insert

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { FEEDBACK_LOOP, STYLE_SELF_KO_FEEDBACK } from "@/lib/flags";
import { extractAndSaveJudgmentRules } from "@/lib/utils/judgment-rules-service";
import { submitFeedback as submitKoFeedback, type KoFeedbackRating } from "@/lib/knowledge-os/client";
import type { FeedbackRow } from "@/types/chat-thread";

export const dynamic = "force-dynamic";
export const maxDuration = 30;  // ★ Phase 3: FEEDBACK_LOOP 時の judgment_rules 抽出（LLM）分

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KIND_MAX = 50;
const CONTENT_MAX = 2000;

interface RouteContext {
  params: { id: string };
}

interface PostFeedbackBody {
  message_id?:     unknown;
  kind?:           unknown;
  content?:        unknown;
  ko_request_id?:  unknown;  // ③-c-5b: KO 書き戻し用の request_id（任意・UUID）
}

// ③-c-5b: STYLE-SELF feedback kind → KO rating。設計どおり like→good / save→save / dislike→bad。
//   それ以外の kind（more_x 等）は KO 書き戻し対象外（null＝送らない）。
function koRatingFromKind(kind: string): KoFeedbackRating | null {
  if (kind === "like") return "good";
  if (kind === "save") return "save";
  if (kind === "dislike") return "bad";
  return null;
}

// ====================================================================
// POST — フィードバック保存
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

    // 親スレッド本人所有を確認(RLS スコープ下)
    const { data: thread } = await supabase
      .from("chat_threads")
      .select("id")
      .eq("id", params.id)
      .maybeSingle() as unknown as { data: { id: string } | null };
    if (!thread) {
      return NextResponse.json({ error: "見つかりません" }, { status: 404 });
    }

    let body: PostFeedbackBody;
    try {
      body = (await request.json()) as PostFeedbackBody;
    } catch {
      return NextResponse.json({ error: "JSON パースに失敗しました" }, { status: 400 });
    }

    // kind 検証(必須・空不可・50 字以下。自由文字列 = like/dislike/more_x/change_item 等)
    if (typeof body.kind !== "string" || body.kind.trim() === "") {
      return NextResponse.json({ error: "kind は必須です" }, { status: 400 });
    }
    const kind = body.kind.trim().slice(0, KIND_MAX);

    // content 検証(任意・2000 字以下)
    let content = "";
    if (body.content !== undefined && body.content !== null) {
      if (typeof body.content !== "string") {
        return NextResponse.json({ error: "content は文字列が必要です" }, { status: 400 });
      }
      content = body.content.slice(0, CONTENT_MAX);
    }

    // message_id 検証(任意・UUID 形式 + 同一スレッド所属を確認)
    let message_id: string | null = null;
    if (body.message_id !== undefined && body.message_id !== null) {
      if (typeof body.message_id !== "string" || !UUID_RE.test(body.message_id)) {
        return NextResponse.json({ error: "message_id が不正です" }, { status: 400 });
      }
      const { data: msg } = await supabase
        .from("messages")
        .select("id")
        .eq("id", body.message_id)
        .eq("thread_id", params.id)
        .maybeSingle() as unknown as { data: { id: string } | null };
      if (!msg) {
        return NextResponse.json({ error: "対象メッセージが見つかりません" }, { status: 400 });
      }
      message_id = body.message_id;
    }

    // ③-c-5b: ko_request_id 検証(任意・UUID)。学習シグナルなので不正でも 400 にせず無視(best-effort)。
    let koRequestId: string | null = null;
    if (typeof body.ko_request_id === "string" && UUID_RE.test(body.ko_request_id)) {
      koRequestId = body.ko_request_id;
    }

    const { data: inserted, error: insErr } = await supabase
      .from("feedback")
      .insert({
        thread_id: params.id,
        message_id,
        kind,
        content,
      } as never)
      .select("id, thread_id, message_id, kind, content, created_at")
      .single() as unknown as {
        data: FeedbackRow | null;
        error: { message: string } | null;
      };

    if (insErr || !inserted) {
      console.warn("[feedback POST] insert error:", insErr?.message ?? "no data");
      return NextResponse.json(
        { error: insErr?.message ?? "フィードバックの保存に失敗しました" },
        { status: 500 },
      );
    }

    // ★ Phase 3: 保存成功後、judgment_rules を抽出（FEEDBACK_LOOP 時のみ・best-effort）。
    //   保存契約は不変＝抽出が失敗しても feedback 保存レスポンスには影響させない。
    if (FEEDBACK_LOOP) {
      try {
        await extractAndSaveJudgmentRules(supabase, user.id, params.id, kind, content);
      } catch (extractErr) {
        console.warn("[feedback POST] judgment extract failed:", extractErr instanceof Error ? extractErr.message : extractErr);
      }
    }

    // ③-c-5b: KO 由来の返信(ko_request_id 有り)について、評価を KO へ best-effort 書き戻す。
    //   STYLE_SELF_KO_FEEDBACK が ON のときだけ。OFF/未設定なら完全無送信＝退行ゼロ。
    //   KO 送信失敗は feedback 保存にも会話にも一切影響させない(try/catch 握り潰し)。
    if (STYLE_SELF_KO_FEEDBACK && koRequestId) {
      const rating = koRatingFromKind(kind);
      if (rating) {
        try {
          await submitKoFeedback({
            request_id: koRequestId,
            rating,
            note: content || undefined,
          });
        } catch (koErr) {
          console.warn("[feedback POST] KO submit_feedback failed:", koErr instanceof Error ? koErr.message : koErr);
        }
      }
    }

    return NextResponse.json({ feedback: inserted });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[feedback POST] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
