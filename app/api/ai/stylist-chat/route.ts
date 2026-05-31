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
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { callClaude, HAIKU_MODEL } from "@/lib/claude";
import {
  STYLIST_CHAT_SYSTEM_PROMPT,
  COORDINATE_JSON_OUTPUT_INSTRUCTION,
  buildStylistChatUserMessage,
  type StylistChatContext,
  type StylistChatHistoryItem,
} from "@/lib/prompts/stylist-chat";
// ★ H-4b1-b-1: coordinate(MB 経由)の JSON 化接続(privacy 再帰 strip + parse フォールバック)
import { stripCanonicalSlugsRecursive } from "@/lib/utils/strip-canonical-slugs";
import { parseCoordinateReply } from "@/lib/utils/parse-coordinate-reply";
import type { CoordinateReply } from "@/types/coordinate-reply";
import { PRODUCT_WORLDVIEW_TAGS } from "@/lib/knowledge/product-worldview-tags";
import { normalizeColor } from "@/lib/knowledge/wardrobe-color-systems";
import { getDecisionRules, getFailurePatterns, getInfluences } from "@/lib/knowledge-os/client";
import {
  getMaterialContext,
  getColorContext,
  getLineContext,
  getRatioContext,
} from "@/lib/dictionaries/inject";
import { MATERIAL_DICT, COLOR_DICT, LINE_DICT, RATIO_DICT } from "@/lib/dictionaries";
// ★ B-2(X2): MB 経路の判別に使用。MB prompt は冒頭が MB_PROMPT_SIGNATURE で始まる。
import { MB_PROMPT_SIGNATURE } from "@/lib/prompts/moodboard-prompt";
// ★ C-2c-1: エディタ AI(E-0c 凡庸脱却・案 α・MB 経由 coordinate のみ適用)
import { evaluateCoordinate, buildRegenInstruction, type EditorResult } from "@/lib/prompts/editor-prompt";
import type { Database } from "@/types/database";

export const dynamic = "force-dynamic";

// MVP-1 P1-C-1.5a + 1.5b-i + MVP-1c + A-6 + A-6b 対応 intent(段階B を通す対象)
// ★ ここを広げる前に system prompt の対応領域 + 出力フィルタの再点検が必要
// ★ UI 側 `app/(app)/ai/page.tsx` の同名 Set と完全一致させる(両側同期)
const STYLIST_CHAT_INTENTS = new Set<string>(["diagnose", "closet", "coordinate", "style-consult", "brand-learn"]);

// history 抑制(設計書 7.4 抑制策・client 過剰送信に対する二重防御)
const MAX_HISTORY = 3;

// ★ C-2c-1: MB 経由 coordinate は ★ Haiku 生成 + Sonnet 評価 + 場合により再生成・再評価で
//   最大 4 回 Claude 呼出になる(最悪 ~80 秒)。ローカル開発は無制限・Vercel hobby/Pro は 60/300 秒。
export const maxDuration = 120;

// reply 抑制(設計書 7.4・Haiku max_tokens)
// ★ Sprint C-3 hotfix(c3f3ea4 案 4 Step 1): MB → coordinate 連鎖で 11 項目 + アクセサリー
//   詳細応答に対応するため 400 → 2048 へ拡大。短文 intent(diagnose/closet/style-consult/
//   brand-learn)は LLM が必要分しか生成しないため退行なし(実出力分のみ課金)。
const MAX_REPLY_TOKENS = 2048;
// ★ B-4(案 Y): MB 経路は B-1 具体化 + 11 項目 + 3 分類で 2048 超過(オーナー実機で「テーマ」
//   途中切れ発見)。MB 経路のみ条件分岐で 6144 へ拡大。他 5 intent(2048)は ★ 完全不変。
const MB_REPLY_TOKENS = 6144;

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
  // ★ H-4b1-b-1: MB 経由 coordinate で LLM が構造化 JSON を返し parse 成功した場合のみ付与
  //   (parse 失敗時は従来どおり reply にフォールバック = 退行ゼロ)
  coordinate?: CoordinateReply;
  actions?: StylistChatActionItem[];
  reason?:  "auth_required" | "empty_input" | "intent_out_of_scope";
  // ★ C-2c-1: MB 経由 coordinate のみ付与(エディタ AI 評価結果 + 試行回数)
  editorScore?: EditorResult & { attempts: 1 | 2 };
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
    //    intent ごとに取得先テーブルを切替(各分岐とも ★ 列絞り SELECT で worldview_tags 構造遮断)
    //    - diagnose:   worldview_profiles から jsonb 列絞り(1.5a)
    //    - closet:     wardrobe_items から category, color のみ列絞り(1.5b-i)
    //    - coordinate: worldview + body_profile + wardrobe の 3 並列 SELECT(MVP-1c)
    // A-10: 各 intent fetcher と Knowledge OS フェッチを ★ Promise.all で並列化(レイテンシ抑制)。
    //       A-6b は 5 intent 共通注入(diagnose / closet / coordinate / style-consult / brand-learn)。
    const [baseCtx, knowledgeOS] = await Promise.all([
      intent === "closet"          ? fetchClosetContext(supabase, userId)
      : intent === "coordinate"     ? fetchCoordinateContext(supabase, userId)
      : intent === "style-consult"  ? fetchStyleConsultContext(supabase, userId)
      : intent === "brand-learn"    ? fetchBrandLearnContext(supabase, userId)
      :                                fetchDiagnoseContext(supabase, userId),
      fetchKnowledgeOSContext(text),
    ]);
    const ctx: StylistChatContext = { ...baseCtx, knowledgeOS };

    // ★ B-2(X2)+ B-4: MB 経路の判別(buildMoodboardPrompt の固定 signature 検出)。
    //   B-2 X2: bodyProfile 注入を skip(2 重 leak 根絶・案 F 同思想で MB は client 完結)。
    //   B-4   : maxTokens を MB_REPLY_TOKENS(6144)へ引き上げ(B-1 具体化 + 11 項目 + 3 分類で 2048 超過)。
    //   他 5 intent(MVP-1c 直接 coordinate / diagnose / closet / style-consult / brand-learn)は ★ 完全不変。
    const isMbCoordinate = intent === "coordinate" && text.startsWith(MB_PROMPT_SIGNATURE);
    if (isMbCoordinate) {
      ctx.bodyProfile = undefined;
    }

    // 4) Claude(Haiku 4.5)呼出
    // ★ H-4b1-b-1: coordinate(MB 経由)★ のみ ★ JSON 出力指示を append(他 4 intent は完全不変)
    const systemPrompt = isMbCoordinate
      ? `${STYLIST_CHAT_SYSTEM_PROMPT}\n\n${COORDINATE_JSON_OUTPUT_INSTRUCTION}`
      : STYLIST_CHAT_SYSTEM_PROMPT;
    const userMessage  = buildStylistChatUserMessage({ text, intent, history, ctx });

    let replyRaw: string;
    try {
      replyRaw = await callClaude({
        systemPrompt,
        userMessage,
        model:     HAIKU_MODEL,
        maxTokens: isMbCoordinate ? MB_REPLY_TOKENS : MAX_REPLY_TOKENS,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn("[stylist-chat] claude failed:", message);
      return NextResponse.json({ error: message }, { status: 500 });
    }

    // ★ ★ C-2c-1: エディタ AI 評価 + N=1 max 再生成(★ MB 経由 coordinate のみ・MVP-1c 直接 coordinate は対象外)
    //   設計: docs/STYLE-SELF_D1_Sprint_C-2b_エディタAI_設計調査.md(26d94c2)案 α MVP
    //   ・Sonnet 4.6 で 10 軸 + 6 チェック評価
    //   ・fail なら改善指示付きで再生成 1 回(最終結果は ★ 合否問わず採用)
    //   ・compromise / pass はそのまま採用
    //   ・コスト: 評価 ≈ ¥7-8 / 件・再生成時 +¥7.5(Haiku 再呼出)+ ¥7-8(再評価)= 最悪 ¥22-25 / 件
    let editorScore: (EditorResult & { attempts: 1 | 2 }) | undefined;
    if (isMbCoordinate) {
      try {
        const firstResult = await evaluateCoordinate({
          coordinateText:  replyRaw,
          originalRequest: text,
        });
        if (firstResult.verdict === "fail") {
          // ★ N=1 max 再生成(改善指示を userMessage 末尾に注入)
          const regenUserMessage = userMessage + buildRegenInstruction(firstResult);
          try {
            const regenRaw = await callClaude({
              systemPrompt,
              userMessage: regenUserMessage,
              model:     HAIKU_MODEL,
              maxTokens: MB_REPLY_TOKENS,
            });
            replyRaw = regenRaw;
            const secondResult = await evaluateCoordinate({
              coordinateText:  regenRaw,
              originalRequest: text,
            });
            editorScore = { ...secondResult, attempts: 2 };
          } catch {
            // 再生成失敗 → 初回結果を採用(N=1 max・暴走防止)
            console.warn("[stylist-chat] editor regen failed, keeping initial");
            editorScore = { ...firstResult, attempts: 1 };
          }
        } else {
          editorScore = { ...firstResult, attempts: 1 };
        }
      } catch {
        // エディタ評価失敗 → 既存挙動にフォールバック(★ レイテンシ / コスト退行ゼロ)
        console.warn("[stylist-chat] editor failed, falling back without score");
      }
    }

    // ★ H-4b1-b-1: coordinate(MB 経由)は構造化 JSON 応答 → parse + 再帰 strip して新形式で返す。
    //   parse 失敗時は ★ early-return せず下の既存 strip+reply 経路へフォールスルー(旧プロース・退行ゼロ)。
    //   ★ editor / MB_PROMPT_SIGNATURE 判定 / KO は H-4c まで不変(本分岐は応答の組み立てのみ)。
    if (isMbCoordinate) {
      const parsed = parseCoordinateReply(replyRaw);
      if (parsed.coordinate) {
        // 三重防御 (3): JSON 全 string フィールドを再帰浄化(privacy 退行ゼロ)
        const safeCoordinate = stripCanonicalSlugsRecursive<CoordinateReply>(parsed.coordinate);
        const coordActions = buildActions(intent);
        return NextResponse.json<StylistChatResponse>({
          ok:          true,
          coordinate:  safeCoordinate,
          actions:     coordActions.length > 0 ? coordActions : undefined,
          editorScore,
        });
      }
      // parsed.fallbackText(= replyRaw)→ 既存経路で strip し reply として返す
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
      ok:          true,
      reply,
      actions:     actions.length > 0 ? actions : undefined,
      editorScore,
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

// ====================================================================
// contextData fetchers(intent 別に取得先テーブル + 列絞り SELECT を切替)
// ====================================================================

// diagnose: worldview_profiles から jsonb 列絞り SELECT(1.5a 既存ロジック)。
// ★ worldview_tags(英語スラッグ)は SELECT 句に書かない → 取得経路無し(三重防御 1)
async function fetchDiagnoseContext(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<StylistChatContext> {
  const { data: profileRow } = await supabase
    .from("worldview_profiles")
    .select(
      "name:result->worldviewName,keywords:result->worldview_keywords,core:result->coreIdentity,ideal:result->idealSelf",
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
  return extractContext(profileRow);
}

// closet: wardrobe_items から category, color のみ列絞り SELECT(1.5b-i 新規)。
// ★ worldview_tags 列は SELECT 句に書かない → 取得経路無し(三重防御 1)
// ★ .eq("user_id", userId) で本人データのみ(cookie-bound RLS + 二重 guard)
async function fetchClosetContext(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<StylistChatContext> {
  const { data: itemsRaw } = await supabase
    .from("wardrobe_items")
    .select("category, color")
    .eq("user_id", userId);
  const items = (itemsRaw ?? []) as Array<{
    category: string | null;
    color:    string | null;
  }>;

  // 集計: 色系統別(normalizeColor で正規化) + カテゴリ別 件数
  const colorCounts: Map<string, number> = new Map();
  const categoryCounts: Map<string, number> = new Map();
  for (const it of items) {
    const system = normalizeColor(it.color);
    colorCounts.set(system, (colorCounts.get(system) ?? 0) + 1);
    const cat = (typeof it.category === "string" && it.category.trim() !== "")
      ? it.category.trim()
      : "(その他)";
    categoryCounts.set(cat, (categoryCounts.get(cat) ?? 0) + 1);
  }

  const colorBuckets = Array.from(colorCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
  const categoryBuckets = Array.from(categoryCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return {
    // diagnose 用フィールドは空(closet では使わない)
    worldviewName:     null,
    worldviewKeywords: [],
    coreIdentity:      null,
    idealSelf:         null,
    // closet 用サマリ
    closetSummary: {
      totalItems: items.length,
      colorBuckets,
      categoryBuckets,
    },
  };
}

// coordinate: worldview + body_profile + wardrobe の 3 並列 SELECT(MVP-1c)
// ★ いずれも列絞り SELECT で worldview_tags 取得経路を遮断(三重防御 1)
// ★ .eq("...", userId) で本人データのみ(cookie-bound RLS + 二重 guard)
// body_profile パターンは lib/prompts/concept-translate.ts:81-99 を踏襲。
async function fetchCoordinateContext(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<StylistChatContext> {
  const [diagCtx, closetCtx, bodyRow] = await Promise.all([
    fetchDiagnoseContext(supabase, userId),
    fetchClosetContext(supabase, userId),
    supabase
      .from("users")
      .select("body_profile")
      .eq("id", userId)
      .maybeSingle() as unknown as Promise<{ data: { body_profile: unknown } | null }>,
  ]);

  return {
    // diagnose 由来(worldview)
    worldviewName:     diagCtx.worldviewName,
    worldviewKeywords: diagCtx.worldviewKeywords,
    coreIdentity:      diagCtx.coreIdentity,
    idealSelf:         diagCtx.idealSelf,
    // closet 由来(集計サマリ)
    closetSummary:     closetCtx.closetSummary,
    // body_profile 由来(日本語サマリ化)
    bodyProfile:       extractBodyProfile(bodyRow?.data?.body_profile),
  };
}

// A-6: style-consult intent 用 contextData fetcher。
// ★ worldview + body_profile + style_preference + avoid_items の 4 ソース統合(wardrobe_items は読まない)
// ★ いずれも列絞り SELECT で worldview_tags 取得経路を遮断(三重防御 1)
// ★ .eq("id", userId) で本人データのみ(cookie-bound RLS + 二重 guard)
async function fetchStyleConsultContext(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<StylistChatContext> {
  const [diagCtx, userRow] = await Promise.all([
    fetchDiagnoseContext(supabase, userId),
    supabase
      .from("users")
      .select("body_profile, style_preference, avoid_items")
      .eq("id", userId)
      .maybeSingle() as unknown as Promise<{ data: {
        body_profile:     unknown;
        style_preference: unknown;
        avoid_items:      unknown;
      } | null }>,
  ]);

  return {
    // diagnose 由来(worldview)
    worldviewName:     diagCtx.worldviewName,
    worldviewKeywords: diagCtx.worldviewKeywords,
    coreIdentity:      diagCtx.coreIdentity,
    idealSelf:         diagCtx.idealSelf,
    // body_profile 由来(coordinate と同形 extractor 流用)
    bodyProfile:       extractBodyProfile(userRow?.data?.body_profile),
    // style_preference 由来(★ A-6 新規 extractor)
    stylePreference:   extractStylePreference(userRow?.data?.style_preference),
    // avoid_items 由来(Sprint 47 text[]・★ A-6 新規 extractor)
    avoidItems:        extractAvoidItems(userRow?.data?.avoid_items),
  };
}

// A-6b: brand-learn intent 用 contextData fetcher。
// ★ worldview + brands(curated 12件・maniac_level 順)+ style_preference の 3 ソース統合
// ★ wardrobe_items / body_profile / ai_history は読まない(コスト削減・学習型相談)
// ★ brands.worldview_tags は日本語タグ(PRODUCT_WORLDVIEW_TAGS とは別語彙・構造的安全)
// ★ KOS getInfluences は fetchKnowledgeOSContext で共通注入(本 fetcher 内では呼ばない)
const BRAND_LEARN_CURATED_LIMIT = 12;
const BRAND_DESC_TRUNCATE_LEN   = 80;

async function fetchBrandLearnContext(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<StylistChatContext> {
  const [diagCtx, brandsRow, prefRow] = await Promise.all([
    fetchDiagnoseContext(supabase, userId),
    supabase
      .from("brands")
      .select("name, name_ja, country, description, worldview_tags, era_tags, maniac_level, price_range")
      .eq("is_active", true)
      .order("maniac_level", { ascending: false }) as unknown as Promise<{ data: Array<{
        name:           string;
        name_ja:        string | null;
        country:        string | null;
        description:    string;
        worldview_tags: string[];
        era_tags:       string[];
        maniac_level:   number;
        price_range:    string;
      }> | null }>,
    supabase
      .from("users")
      .select("style_preference")
      .eq("id", userId)
      .maybeSingle() as unknown as Promise<{ data: { style_preference: unknown } | null }>,
  ]);

  return {
    worldviewName:     diagCtx.worldviewName,
    worldviewKeywords: diagCtx.worldviewKeywords,
    coreIdentity:      diagCtx.coreIdentity,
    idealSelf:         diagCtx.idealSelf,
    stylePreference:   extractStylePreference(prefRow?.data?.style_preference),
    brandsCurated:     summarizeBrands(brandsRow?.data ?? []),
  };
}

// A-6b: brands 配列を ctx.brandsCurated 形式に簡略化(LLM トークン抑制・上位 N 件 + description truncate)。
function summarizeBrands(rows: Array<{
  name:           string;
  name_ja:        string | null;
  country:        string | null;
  description:    string;
  worldview_tags: string[];
  era_tags:       string[];
  maniac_level:   number;
  price_range:    string;
}>): StylistChatContext["brandsCurated"] {
  if (rows.length === 0) return undefined;
  return rows.slice(0, BRAND_LEARN_CURATED_LIMIT).map((r) => ({
    name:          r.name,
    nameJa:        r.name_ja,
    country:       r.country,
    description:   r.description.length <= BRAND_DESC_TRUNCATE_LEN ? r.description : r.description.slice(0, BRAND_DESC_TRUNCATE_LEN) + "…",
    worldviewTags: Array.isArray(r.worldview_tags) ? r.worldview_tags : [],
    eraTags:       Array.isArray(r.era_tags)       ? r.era_tags       : [],
    maniacLevel:   typeof r.maniac_level === "number" ? r.maniac_level : 1,
    priceRange:    typeof r.price_range  === "string" ? r.price_range  : "mid",
  }));
}

// A-6: users.style_preference jsonb を日本語表示用に正規化(未登録なら undefined)。
// 型は types/index.ts:277 StylePreference 13 フィールドから stylist-chat に必要な 8 フィールド抽出。
function extractStylePreference(raw: unknown): StylistChatContext["stylePreference"] {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const arr = (v: unknown): string[] =>
    Array.isArray(v)
      ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "")
      : [];
  const pref = {
    likedColors:         arr(r.likedColors),
    dislikedColors:      arr(r.dislikedColors),
    likedMaterials:      arr(r.likedMaterials),
    dislikedMaterials:   arr(r.dislikedMaterials),
    likedSilhouettes:    arr(r.likedSilhouettes),
    dislikedSilhouettes: arr(r.dislikedSilhouettes),
    targetImpressions:   arr(r.targetImpressions),
    avoidImpressions:    arr(r.avoidImpressions),
  };
  // 全フィールド空なら未登録扱い
  const hasAny = Object.values(pref).some((v) => v.length > 0);
  return hasAny ? pref : undefined;
}

// A-6: users.avoid_items text[] を正規化(未登録 or 空配列なら undefined)。
function extractAvoidItems(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out = raw.filter((x): x is string => typeof x === "string" && x.trim() !== "");
  return out.length > 0 ? out : undefined;
}

// users.body_profile jsonb を日本語表示用に正規化(未登録なら undefined)。
// 型は types/index.ts:302 BodyProfile に対応(コンセプト翻訳実装と整合)。
function extractBodyProfile(raw: unknown): StylistChatContext["bodyProfile"] {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const concerns = Array.isArray(r.concerns)
    ? r.concerns.filter((c): c is string => typeof c === "string" && c.trim() !== "")
    : [];
  const height       = typeof r.height === "number" ? r.height : null;
  const bodyType     = typeof r.bodyType === "string" && r.bodyType.trim() !== "" ? r.bodyType.trim() : null;
  const skeletonType = typeof r.skeletonType === "string" && r.skeletonType.trim() !== "" ? r.skeletonType.trim() : null;
  const proportionNote = typeof r.proportionNote === "string" && r.proportionNote.trim() !== "" ? r.proportionNote.trim() : null;
  // 全フィールドが null/空 なら未登録扱い
  if (height === null && bodyType === null && skeletonType === null && concerns.length === 0 && proportionNote === null) {
    return undefined;
  }
  return { height, bodyType, skeletonType, concerns, proportionNote };
}

// jsonb 列絞り SELECT の戻り値を日本語サマリ型に正規化(fetchDiagnoseContext から使う)。
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

// ====================================================================
// A-10: Knowledge OS 連携(案A フル統合)
// ====================================================================
// stylist-chat 段階 B 専用の Knowledge OS context fetcher。
// ・getDecisionRules + getFailurePatterns を並列フェッチ(MCP client が 5 分 in-memory cache 持つ)
// ・dictionaries(material 14 / color 15 / line 10 / ratio 8)から発話に関連する語彙を抽出
// ・★ 入口 sanitize: stripCanonicalSlugs を contextData 注入前に適用(三重防御 (1) 同型再適用)
// ・★ KOS 接続失敗時は全フィールド空で undefined 相当 → buildStylistChatUserMessage 側で
//    ブロック自体を出さない(段階 B reply 退行ゼロ)
// ・getFashionRules は worldview_tags 配列を返すため使わない(構造的排除・A-10 設計案 9bfb0cc §3.4)
const KOS_DECISION_RULES_LIMIT   = 10;
const KOS_FAILURE_PATTERNS_LIMIT = 5;
const KOS_INFLUENCES_LIMIT       = 15;

async function fetchKnowledgeOSContext(text: string): Promise<StylistChatContext["knowledgeOS"]> {
  try {
    // A-6b: getInfluences を 3 関数並列に昇格(全 5 intent 共通注入・brand-learn で特に活用)
    const [rulesRaw, failuresRaw, influencesRaw] = await Promise.all([
      getDecisionRules({ importance_min: 4, limit: KOS_DECISION_RULES_LIMIT }),
      getFailurePatterns({ context: "fashion-coordinate", related_features: undefined }),
      getInfluences({ limit: KOS_INFLUENCES_LIMIT }),
    ]);

    // ★ 入口 sanitize: KOS 戻り値の rule / pattern / lesson / influence 文字列にも 31 語フィルタを適用
    const decisionRules = rulesRaw.slice(0, KOS_DECISION_RULES_LIMIT)
      .map((r) => ({
        rule:       stripCanonicalSlugs(r.rule ?? "").cleaned,
        importance: r.importance,
      }))
      .filter((r) => r.rule.trim().length > 0);

    const failurePatterns = failuresRaw.slice(0, KOS_FAILURE_PATTERNS_LIMIT)
      .map((f) => ({
        title:   stripCanonicalSlugs(f.pattern ?? "").cleaned,
        summary: stripCanonicalSlugs(`${f.what_went_wrong ?? ""}${f.lesson ? "  教訓: " + f.lesson : ""}`).cleaned,
      }))
      .filter((f) => f.title.trim().length > 0);

    // A-6b: 影響源(subject_name / subject_summary / fusion_essence の 3 フィールド・入口 sanitize 適用)
    const influences = influencesRaw.slice(0, KOS_INFLUENCES_LIMIT)
      .map((i) => ({
        subjectName: stripCanonicalSlugs(i.subject_name ?? "").cleaned,
        summary:     stripCanonicalSlugs(i.subject_summary ?? "").cleaned,
        fusion:      stripCanonicalSlugs(i.fusion_essence ?? "").cleaned,
      }))
      .filter((i) => i.subjectName.trim().length > 0);

    // dictionaries: 発話 text に出てくる語彙のみ抽出(全 47 エントリ全載せはトークン浪費 + ノイズ)
    const matched = matchDictionaryKeys(text);

    return {
      decisionRules,
      failurePatterns,
      influences,
      dictionaries: {
        materials:   getMaterialContext(matched.materials),
        colors:      getColorContext(matched.colors),
        silhouettes: getLineContext(matched.silhouettes),
        ratios:      getRatioContext(matched.ratios),
      },
    };
  } catch (err) {
    // KOS / dictionaries 失敗時は undefined 相当(空オブジェクト)で段階 B 退行ゼロ
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[stylist-chat] knowledge-os fetch failed:", message);
    return {
      decisionRules:   [],
      failurePatterns: [],
      influences:      [],
      dictionaries:    { materials: "", colors: "", silhouettes: "", ratios: "" },
    };
  }
}

// 発話 text に含まれる dictionary キー(日本語)を 4 種類抽出。
// 単純な部分一致(辞書キーは日本語短語のため誤検出は低い)。
function matchDictionaryKeys(text: string): {
  materials:   string[];
  colors:      string[];
  silhouettes: string[];
  ratios:      string[];
} {
  return {
    materials:   Object.keys(MATERIAL_DICT).filter((k) => text.includes(k)),
    colors:      Object.keys(COLOR_DICT).filter((k) => text.includes(k)),
    silhouettes: Object.keys(LINE_DICT).filter((k) => text.includes(k)),
    ratios:      Object.keys(RATIO_DICT).filter((k) => text.includes(k)),
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

// 補助 actions(navigate-map 9 entries 既存転用・新規エントリー追加なし)
// - diagnose: 「診断を始める →」 (既存 /onboarding)
// - closet:   「一覧で見る →」 (既存 /outfit?tab=closet)
// ★ 「コーデを組む →」(coordinate intent)は navigate-map 9 entries に未登録のため
//   本 1.5b-i では追加しない(指示通り対象外として報告)。
// navigate-map 既存 entries のラベルと整合させる(ChatPage 側で resolveNavigateTarget で
// URL 解決するため、本ルートは intent / label の組だけを返す)。
function buildActions(intent: string): StylistChatActionItem[] {
  if (intent === "diagnose") {
    return [{ intent: "diagnose", label: "診断を始める →" }];
  }
  if (intent === "closet") {
    return [{ intent: "closet", label: "一覧で見る →" }];
  }
  return [];
}
