// P1-C-1.5a: 会話 AI スタイリスト・診断 1 種(MVP-1)
//
// POST /api/ai/stylist-chat
// body: { text: string, intent: string, history?: {role,text}[] }
// returns: { ok, reply, actions? } / { ok:false, reason }
//
// 設計: docs/STYLE-SELF_D1_実装設計.md(41e9139)Section 4.7 / 判断 9
// 確認: P1-C-1.5a 実装前確認レポート(A/B/C/D)
//
// 【スコープ】MVP-1 P1-C-1.5a = intent="diagnose" のみ段階B(本ルート)を通す。
//             他 intent は ChatPage 側で従来通り NavigateConfirm 等で表示(本ルートに来ない)。
//             intent=closet は 1.5b で追加。
//
// 【セキュリティ / プライバシー(設計書 4.4 不可侵境界線・厳守)】
//   ・createSupabaseServerClient()(cookie-bound RLS) のみ・★service_role 使わない
//   ・★contextData は body で受けず、本ルートが auth.uid() で自前 SELECT
//     (client 渡しは信頼しない・改竄防止)
//   ・★worldview_profiles から jsonb 列絞り SELECT(result 丸ごと禁止)
//     列単位指定で worldview_tags 英語スラッグの取得経路を構造的に遮断(防御 1)
//   ・★出力 reply を PRODUCT_WORLDVIEW_TAGS 31 語の正規表現で検出 →
//     検出時 console.warn + 該当削除(防御 3 = 三重防御の最終段)
//   ・★三重防御 1+2+3:
//     (1) jsonb 列絞り SELECT(本ルート・worldview_tags 取得経路を遮断)
//     (2) system prompt で出力禁止明示(lib/prompts/stylist-chat.ts)
//     (3) 出力フィルタ(本ルート・31 語辞書で検出削除)
//   ・未認証は 200 + reason("auth_required")(M3-4 fallback 思想・既存 intent route 同型)
//
// 【コスト(設計書 7.4)】
//   ・モデル: Haiku 4.5(まず検証・本体判断 2)・max_tokens: 400
//   ・history は N=3 で client から受けるが本ルートでも slice -3 して二重抑制
//   ・1 相談あたり概算 ¥0.50(段階A Haiku + 段階B Haiku 計)

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { callClaude, HAIKU_MODEL } from "@/lib/claude";
import {
  STYLIST_CHAT_SYSTEM_PROMPT,
  buildStylistChatUserMessage,
  type StylistChatContext,
  type StylistChatHistoryItem,
} from "@/lib/prompts/stylist-chat";
import { PRODUCT_WORLDVIEW_TAGS } from "@/lib/knowledge/product-worldview-tags";

export const dynamic = "force-dynamic";

// MVP-1 P1-C-1.5a 対応 intent(段階B を通す対象)
// ★ ここを広げる前に system prompt の対応領域 + 出力フィルタの再点検が必要
const STYLIST_CHAT_INTENTS = new Set<string>(["diagnose"]);

// history 抑制(設計書 7.4 抑制策・client 過剰送信に対する二重防御)
const MAX_HISTORY = 3;

// reply 抑制(設計書 7.4・Haiku max_tokens)
const MAX_REPLY_TOKENS = 400;

interface StylistChatRequest {
  text?:    unknown;
  intent?:  unknown;
  history?: unknown;
}

interface StylistChatActionItem {
  intent: string;
  label:  string;
}

interface StylistChatResponse {
  ok:       boolean;
  reply?:   string;
  actions?: StylistChatActionItem[];
  reason?:  "auth_required" | "empty_input" | "intent_out_of_scope";
}

// ====================================================================
// POST
// ====================================================================
export async function POST(request: NextRequest) {
  try {
    // 1) 認証(本人のみ・他人データ防止の起点)
    const supabase = createSupabaseServerClient();
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
      return NextResponse.json<StylistChatResponse>({
        ok:     true,
        reason: "auth_required",
      });
    }
    const userId = authData.user.id;

    // 2) body 解析(client 信頼は最小化)
    const body = await request.json() as StylistChatRequest;
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (text.length === 0) {
      return NextResponse.json<StylistChatResponse>({
        ok:     true,
        reason: "empty_input",
      });
    }
    const intent = typeof body.intent === "string" ? body.intent : "";
    // ★ MVP-1 スコープ厳守: 1.5a は diagnose のみ
    if (!STYLIST_CHAT_INTENTS.has(intent)) {
      return NextResponse.json<StylistChatResponse>({
        ok:     true,
        reason: "intent_out_of_scope",
      });
    }
    const history = sanitizeHistory(body.history);

    // 3) ★ contextData はサーバ自前 SELECT(client 渡しは受けない)
    //    ★ worldview_profiles を jsonb 列絞り SELECT
    //    (result 丸ごと禁止・worldview_tags 取得経路を構造的に遮断)
    //
    //    PostgREST の `result->key` は jsonb の特定キーを取り出して、
    //    rightmost key 名のカラムとして返す(alias で明示)。
    //    worldview_tags(英語スラッグ)は ★ そもそも SELECT 句に書かない ★ → 取得経路無し
    //
    //    types/database.ts に worldview_profiles 行型が無いため、as 経由で
    //    型を吸収(既存 posts/route.ts 同型パターン)。
    //    maybeSingle: 行が無い(診断未完了)= null → 「未診断」として扱う
    const { data: profileRow } = await supabase
      .from("worldview_profiles")
      .select(
        "name:result->worldviewName,keywords:result->worldview_keywords,core:result->coreIdentity,ideal:result->idealSelf"
      )
      .eq("user_id", userId)
      .maybeSingle() as unknown as {
        data: {
          name:     unknown;
          keywords: unknown;
          core:     unknown;
          ideal:    unknown;
        } | null;
      };
    const ctx = extractContext(profileRow);

    // 4) Claude(Haiku 4.5)呼出
    const systemPrompt = STYLIST_CHAT_SYSTEM_PROMPT;
    const userMessage  = buildStylistChatUserMessage({ text, intent, history, ctx });

    let replyRaw: string;
    try {
      replyRaw = await callClaude({
        systemPrompt,
        userMessage,
        model:     HAIKU_MODEL,
        maxTokens: MAX_REPLY_TOKENS,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn("[stylist-chat] claude failed:", message);
      return NextResponse.json({ error: message }, { status: 500 });
    }

    // 5) 出力フィルタ(三重防御の 3 つ目・31 語辞書で検出削除)
    const { cleaned, removed } = stripCanonicalSlugs(replyRaw);
    if (removed) {
      console.warn("[stylist-chat] english slug detected in reply, removed");
    }

    // 6) 補助 actions(navigate-map 転用・MVP-1 は diagnose のみ)
    //    ChatPage 側で resolveNavigateTarget(intent) を呼ぶため、
    //    本ルートは intent/label の組のみ返す(navigate-map 直接参照しない)。
    const actions = buildActions(intent);

    // 7) 念のため reply の空・極端短文化を guard
    const reply = cleaned.length > 0 ? cleaned : "うまく言葉にできませんでした。もう一度教えてください。";

    return NextResponse.json<StylistChatResponse>({
      ok:      true,
      reply,
      actions: actions.length > 0 ? actions : undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[stylist-chat] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ====================================================================
// helpers
// ====================================================================

// history 入力の sanitize(client 過剰送信に対する二重防御)
function sanitizeHistory(raw: unknown): StylistChatHistoryItem[] {
  if (!Array.isArray(raw)) return [];
  const tail = raw.slice(-MAX_HISTORY);  // ★ N=3 抑制
  const out: StylistChatHistoryItem[] = [];
  for (const h of tail) {
    if (h && typeof h === "object") {
      const obj = h as Record<string, unknown>;
      const role = obj.role;
      const t    = obj.text;
      if ((role === "user" || role === "assistant") && typeof t === "string") {
        const trimmed = t.trim();
        if (trimmed.length > 0) {
          out.push({ role, text: trimmed.slice(0, 500) });
        }
      }
    }
  }
  return out;
}

// jsonb 列絞り SELECT の戻り値を日本語サマリ型に正規化。
// row が null = 診断未完了 → 全 null。
function extractContext(row: {
  name:     unknown;
  keywords: unknown;
  core:     unknown;
  ideal:    unknown;
} | null): StylistChatContext {
  const str = (v: unknown): string | null =>
    typeof v === "string" && v.trim() !== "" ? v.trim() : null;
  const arr = (v: unknown): string[] =>
    Array.isArray(v)
      ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "")
      : [];
  if (!row) {
    return { worldviewName: null, worldviewKeywords: [], coreIdentity: null, idealSelf: null };
  }
  return {
    worldviewName:     str(row.name),
    worldviewKeywords: arr(row.keywords),
    coreIdentity:      str(row.core),
    idealSelf:         str(row.ideal),
  };
}

// 出力フィルタ(三重防御の 3 つ目)。
// PRODUCT_WORLDVIEW_TAGS 31 語(M5 正準辞書・小文字英語スラッグ)を
// 単語境界(\b)単位で検出 → 該当削除 + console.warn。
// 構造的同期: 31 語の定数を直参照しているため、辞書追加が即フィルタにも反映される。
const SLUG_PATTERN = new RegExp(
  `\\b(?:${PRODUCT_WORLDVIEW_TAGS.map(escapeRegExp).join("|")})\\b`,
  "gi",
);

function stripCanonicalSlugs(text: string): { cleaned: string; removed: boolean } {
  let removed = false;
  const cleaned = text.replace(SLUG_PATTERN, () => {
    removed = true;
    return "";
  });
  if (!removed) {
    return { cleaned: text, removed: false };
  }
  // 残った句読点 / 連続空白 を整える(自然文を壊しすぎない)
  const normalized = cleaned
    .replace(/[ \t]+/g, " ")
    .replace(/\s*([、。])\s*/g, "$1")
    .replace(/(^|\n)[ \t、。]+/g, "$1")
    .trim();
  return { cleaned: normalized, removed: true };
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// 補助 actions(MVP-1: intent=diagnose → 「診断を始める」)
// navigate-map 既存 entries のラベルと整合させる(ChatPage 側で resolveNavigateTarget で
// URL 解決するため、本ルートは intent / label の組だけを返す)。
function buildActions(intent: string): StylistChatActionItem[] {
  if (intent === "diagnose") {
    return [{ intent: "diagnose", label: "診断を始める →" }];
  }
  return [];
}
