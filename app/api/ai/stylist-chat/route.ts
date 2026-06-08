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
  COORDINATE_JSON_OUTPUT_INSTRUCTION,
  COORDINATE_ACTIONABLE_OUTPUT_INSTRUCTION,
  buildStylistChatUserMessage,
  buildMbAnalysisUserMessage,
  buildQualityGateInstruction,
  GENERAL_BRAIN_SYSTEM_PROMPT,
  buildGeneralBrainUserMessage,
  type StylistChatContext,
  type StylistChatHistoryItem,
} from "@/lib/prompts/stylist-chat";
import { MB_CONTEXT_OBJECT, FEEDBACK_LOOP, STYLE_SELF_QUERY_KNOWLEDGE_CHAT } from "@/lib/flags";
import { resolveGatedReply } from "@/lib/utils/parse-gated-reply";
import { getMoodboardAnalysis } from "@/lib/utils/moodboard-analysis-service";
import { getJudgmentRules } from "@/lib/utils/judgment-rules-service";
// ★ H-4b1-b-1: coordinate(MB 経由)の JSON 化接続(privacy 再帰 strip + parse フォールバック)
import { stripCanonicalSlugsRecursive } from "@/lib/utils/strip-canonical-slugs";
import { parseCoordinateReply } from "@/lib/utils/parse-coordinate-reply";
import type { CoordinateReply } from "@/types/coordinate-reply";
// ③-c: context fetcher 群は lib/stylist-chat/context.ts に抽出（挙動不変・compare-chat と共有）。
import {
  fetchDiagnoseContext,
  fetchClosetContext,
  fetchCoordinateContext,
  fetchStyleConsultContext,
  fetchBrandLearnContext,
  fetchKnowledgeOSContext,
  fetchKnowledgeOSViaSearchKnowledge,
  stripCanonicalSlugs,
} from "@/lib/stylist-chat/context";
// ★ B-2(X2): MB 経路の判別に使用。MB prompt は冒頭が MB_PROMPT_SIGNATURE で始まる。
import { MB_PROMPT_SIGNATURE } from "@/lib/prompts/moodboard-prompt";
// ★ C-2c-1: エディタ AI(E-0c 凡庸脱却・案 α・MB 経由 coordinate のみ適用)
import { evaluateCoordinate, buildRegenInstruction, type EditorResult } from "@/lib/prompts/editor-prompt";

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
  text?:        unknown;
  intent?:      unknown;
  history?:     unknown;
  moodboardId?: unknown;  // ★ Phase 2: MB context object 経路（指定時 moodboard_analysis を読んで短文応答）
}

const MB_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  // ③-c-2: query_knowledge 経路(フラグ ON・非MB)で付与。c-3 で message.metadata.ko に永続化する核。
  koRequestId?: string | null;
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

    // 方針C本体(案イ): 本対話モード = 分野横断の外部脳。
    //   fashion intent/persona/context/品質ゲート/エディタAI は一切触らず、ここで隔離して早期 return。
    //   context は search_knowledge passages のみ(worldview/wardrobe を引かない=ノイズ排除)。Haiku 合成(軽い)。
    if (intent === "general") {
      const gHistory = sanitizeHistory(body.history);
      const ko = await fetchKnowledgeOSViaSearchKnowledge(text, true); // 修正B: 本(book_learning)だけ検索
      let gRaw: string;
      try {
        gRaw = await callClaude({
          systemPrompt: GENERAL_BRAIN_SYSTEM_PROMPT,
          userMessage:  buildGeneralBrainUserMessage({ text, history: gHistory, knowledgeOS: ko.knowledgeOS }),
          model:        HAIKU_MODEL,
          maxTokens:    MAX_REPLY_TOKENS,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn("[stylist-chat] general claude failed:", message);
        return NextResponse.json({ error: message }, { status: 500 });
      }
      const { cleaned } = stripCanonicalSlugs(gRaw);
      return NextResponse.json<StylistChatResponse>({
        ok:          true,
        reply:       cleaned.length > 0 ? cleaned : "うまく言葉にできませんでした。もう一度教えてください。",
        koRequestId: ko.requestId, // ③-c-4: feedback 突合（passages由来の request_id）
      });
    }

    // ★ MVP-1 スコープ厳守: 1.5a は diagnose のみ
    if (!STYLIST_CHAT_INTENTS.has(intent)) {
      return NextResponse.json<StylistChatResponse>({
        ok:     true,
        reason: "intent_out_of_scope",
      });
    }
    const history = sanitizeHistory(body.history);

    // ★ Phase 2: MB context object 経路。
    //   moodboardId 指定 + intent=coordinate + フラグ ON のとき、moodboard_analysis（Phase 1）を
    //   読んで「探す/避ける/検索ワード/条件」を短く行動可能に返す（長文 buildMoodboardPrompt 不使用）。
    //   analysis が見つからない場合のみ下の既存ロジックへフォールスルー（退行ゼロ）。
    //   ★ editorScore は本経路では走らせない（評価ルーブリックは旧長文形式向けのため・既存挙動は不変）。
    const mbId = typeof body.moodboardId === "string" ? body.moodboardId : "";
    if (MB_CONTEXT_OBJECT && intent === "coordinate" && MB_UUID_RE.test(mbId)) {
      const analysis = await getMoodboardAnalysis(supabase, mbId);
      if (analysis) {
        // ★ Phase 3: 学習ルール注入（FEEDBACK_LOOP 時のみ・空なら Phase 2 と同一出力）
        const mbRules = FEEDBACK_LOOP ? await getJudgmentRules(supabase, userId) : [];
        const mbSystemPrompt = `${STYLIST_CHAT_SYSTEM_PROMPT}\n\n${COORDINATE_ACTIONABLE_OUTPUT_INSTRUCTION}`;
        const mbUserMessage  = buildMbAnalysisUserMessage(analysis, text, history, mbRules);
        let mbRaw: string;
        try {
          mbRaw = await callClaude({
            systemPrompt: mbSystemPrompt,
            userMessage:  mbUserMessage,
            model:        HAIKU_MODEL,
            maxTokens:    MB_REPLY_TOKENS,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.warn("[stylist-chat] MB context object claude failed:", message);
          return NextResponse.json({ error: message }, { status: 500 });
        }
        const parsed = parseCoordinateReply(mbRaw);
        if (parsed.coordinate) {
          const safeCoordinate = stripCanonicalSlugsRecursive<CoordinateReply>(parsed.coordinate);
          return NextResponse.json<StylistChatResponse>({
            ok:         true,
            coordinate: safeCoordinate,
            actions:    buildActions(intent),
          });
        }
        // parse 失敗 → strip して reply フォールバック（退行ゼロ）
        const { cleaned } = stripCanonicalSlugs(mbRaw);
        return NextResponse.json<StylistChatResponse>({
          ok:      true,
          reply:   cleaned.length > 0 ? cleaned : "うまく言葉にできませんでした。もう一度教えてください。",
          actions: buildActions(intent),
        });
      }
      // analysis 未生成 → 既存ロジックへフォールスルー（通常 coordinate として処理）
    }

    // 3) ★ contextData はサーバ自前 SELECT(client 渡しは受けない)
    //    intent ごとに取得先テーブルを切替(各分岐とも ★ 列絞り SELECT で worldview_tags 構造遮断)
    //    - diagnose:   worldview_profiles から jsonb 列絞り(1.5a)
    //    - closet:     wardrobe_items から category, color のみ列絞り(1.5b-i)
    //    - coordinate: worldview + body_profile + wardrobe の 3 並列 SELECT(MVP-1c)
    // ③-c-2 / 高速化: KO 連携の源を分岐する。MB 経由 coordinate は従来どおり get_*（editor 経路を乱さない）。
    //   フラグ ON かつ非 MB のときだけ KO 意味検索（search_knowledge・合成なし高速版）に寄せる。
    //   OFF/MB は完全に従来（get_* 3並列）。フラグ名は据置（意味は同じ・実装を search に差し替え）。
    const isMbCoordinate = intent === "coordinate" && text.startsWith(MB_PROMPT_SIGNATURE);
    const useKnowledgeSearch = STYLE_SELF_QUERY_KNOWLEDGE_CHAT && !isMbCoordinate;

    // A-10: 各 intent fetcher と Knowledge OS フェッチを ★ Promise.all で並列化(レイテンシ抑制)。
    //       A-6b は 5 intent 共通注入(diagnose / closet / coordinate / style-consult / brand-learn)。
    const [baseCtx, koResult] = await Promise.all([
      intent === "closet"          ? fetchClosetContext(supabase, userId)
      : intent === "coordinate"     ? fetchCoordinateContext(supabase, userId)
      : intent === "style-consult"  ? fetchStyleConsultContext(supabase, userId)
      : intent === "brand-learn"    ? fetchBrandLearnContext(supabase, userId)
      :                                fetchDiagnoseContext(supabase, userId),
      useKnowledgeSearch
        ? fetchKnowledgeOSViaSearchKnowledge(text)
        : fetchKnowledgeOSContext(text).then((knowledgeOS) => ({
            knowledgeOS,
            requestId: null as string | null,
            safeMode: false,
          })),
    ]);
    const ctx: StylistChatContext = { ...baseCtx, knowledgeOS: koResult.knowledgeOS };
    const koRequestId = koResult.requestId;     // c-3 で永続化する核（OFF/MB/失敗時は null）
    const koSafeMode  = koResult.safeMode;       // query_knowledge 失敗/タイムアウト → 安全モード固定

    // ★ Phase 3: 学習ルール注入（FEEDBACK_LOOP 時のみ・空なら ctx.judgmentRules=undefined＝従来と同一）
    if (FEEDBACK_LOOP) {
      const rules = await getJudgmentRules(supabase, userId);
      if (rules.length > 0) ctx.judgmentRules = rules;
    }

    // ★ B-2(X2)+ B-4: MB 経路の判別(buildMoodboardPrompt の固定 signature 検出)。
    //   B-2 X2: bodyProfile 注入を skip(2 重 leak 根絶・案 F 同思想で MB は client 完結)。
    //   B-4   : maxTokens を MB_REPLY_TOKENS(6144)へ引き上げ(B-1 具体化 + 11 項目 + 3 分類で 2048 超過)。
    //   他 5 intent(MVP-1c 直接 coordinate / diagnose / closet / style-consult / brand-learn)は ★ 完全不変。
    if (isMbCoordinate) {
      ctx.bodyProfile = undefined;
    }

    // 4) Claude(Haiku 4.5)呼出
    // ★ H-4b1-b-1: coordinate(MB 経由)★ のみ ★ JSON 出力指示を append(他 4 intent は完全不変)
    // ③-c-2: 非 MB かつフラグ ON は品質ゲートの JSON 出力指示を append（§3.5・案A）。
    //   query_knowledge 失敗時(koSafeMode)は forceSafe で安全モード固定。MB/OFF は完全不変。
    const systemPrompt = isMbCoordinate
      ? `${STYLIST_CHAT_SYSTEM_PROMPT}\n\n${COORDINATE_JSON_OUTPUT_INSTRUCTION}`
      : useKnowledgeSearch
        ? `${STYLIST_CHAT_SYSTEM_PROMPT}\n\n${buildQualityGateInstruction({ forceSafe: koSafeMode })}`
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

    // ③-c-2: フラグ ON(非MB)は品質ゲートの JSON 出力をパース → mode 適用（§3.5・案C）。
    //   parse 失敗時は raw をそのまま本文扱い（退行ゼロ）。mode:safe / 薄い機械検査で安全モード文に倒す。
    //   OFF/MB は replyRaw のまま（従来不変）。
    const replyForOutput = useKnowledgeSearch ? resolveGatedReply(replyRaw) : replyRaw;

    // 5) 出力フィルタ(三重防御の 3 つ目・31 語辞書で検出削除)
    const { cleaned, removed } = stripCanonicalSlugs(replyForOutput);
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
      koRequestId, // ③-c-2: c-3 で message.metadata.ko に永続化（OFF/MB/失敗時は null）
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

// ③-c: fetchDiagnose/Closet/Coordinate/StyleConsult/BrandLearn・KO fetcher・stripCanonicalSlugs 等は
//   lib/stylist-chat/context.ts に移設（挙動不変）。本ファイルは import して使う。

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
