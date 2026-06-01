// Sprint G-1: 実商品候補 API(★ E-0f/E-0g 実装第一歩・Layer 1 = 楽天のみ)
//
// POST /api/products/candidates  body: { moodboardId: string, threadId?: string }
//
// 設計: docs/STYLE-SELF_Sprint-G_実商品検索本体_multi_source_product_catalog_設計調査.md(716bd3a)
// 戦略: E-0f(実商品試着主軸)/ E-0g(multi-source・服好き感度)
//
// フロー: moodboard 取得(RLS) → LLM① keyword 抽出 → 楽天検索 → LLM② score+reasoning → 再帰 strip → 返却
//
// 【G-1 スコープと実機 verify 由来の判断】
//   ・★ Layer 1 = 楽天のみ(source 別 query 枠組みは prompt 側に用意・実行は楽天)
//   ・★ product-match.scoreProduct は ★ 正規化済 ExternalProduct(normalizedColors/axes 等)前提。
//     楽天キーワード検索の生結果(RakutenProduct)は未正規化のため、G-1 は ★ LLM スコアリングを採用
//     (E-0g「属性一致より世界観適合」とも整合)。正規化 + 決定的 scoreProduct は G-5/G-7 で層化。
//   ・★ external_products への書込は G-1 では行わない(候補は live 楽天から都度・永続化は L2/G-5)。
//   ・★ どこからも未呼出(G-2 で UI 接続)。既存 route / system prompt / page.tsx は 0 変更。
//
// 【セキュリティ】createSupabaseServerClient(cookie-bound RLS)・service_role 不使用・
//   moodboard は本人所有を RLS で担保・三重防御(3): レスポンスに stripCanonicalSlugsRecursive。

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { callClaudeJSON, HAIKU_MODEL } from "@/lib/claude";
import { searchByKeyword } from "@/lib/rakuten";
import { stripCanonicalSlugsRecursive } from "@/lib/utils/strip-canonical-slugs";
import {
  CANDIDATE_CATEGORIES,
  KEYWORD_EXTRACTION_SYSTEM,
  buildKeywordExtractionUser,
  SCORE_REASONING_SYSTEM,
  buildScoreReasoningUser,
  type MoodboardSummaryForCandidates,
  type KeywordExtractionResult,
  type ScoreReasoningResult,
  type CandidateForScoring,
} from "@/lib/prompts/product-candidates-prompt";
import type {
  CandidatesResponse,
  ProductCandidate,
  CandidateCategory,
} from "@/types/product-candidate";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HITS_PER_CATEGORY = 6;   // 楽天検索 取得件数 / カテゴリ
const KEEP_PER_CATEGORY  = 3;  // LLM 評価に回す件数 / カテゴリ(コスト抑制)

interface CandidatesRequest {
  moodboardId?: unknown;
  threadId?:    unknown;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    let body: CandidatesRequest;
    try {
      body = (await request.json()) as CandidatesRequest;
    } catch {
      return NextResponse.json({ error: "JSON パースに失敗しました" }, { status: 400 });
    }
    if (typeof body.moodboardId !== "string" || !UUID_RE.test(body.moodboardId)) {
      return NextResponse.json({ error: "moodboardId が不正です" }, { status: 400 });
    }
    const moodboardId = body.moodboardId;

    // 1) moodboard 取得(RLS スコープ下で本人のみ)+ captions
    const { data: mb } = await supabase
      .from("moodboards")
      .select("id, name, description, worldview_name")
      .eq("id", moodboardId)
      .maybeSingle() as unknown as {
        data: { id: string; name: string; description: string; worldview_name: string | null } | null;
      };
    if (!mb) {
      return NextResponse.json({ error: "ムードボードが見つかりません" }, { status: 404 });
    }

    const { data: items } = await supabase
      .from("moodboard_items")
      .select("caption, order_index")
      .eq("moodboard_id", moodboardId)
      .order("order_index", { ascending: true }) as unknown as {
        data: { caption: string; order_index: number }[] | null;
      };
    const captionedItems = (items ?? [])
      .map((i) => i.caption)
      .filter((c) => typeof c === "string" && c.trim() !== "");

    const mbSummary: MoodboardSummaryForCandidates = {
      name:            mb.name,
      description:     mb.description ?? "",
      worldviewName:   mb.worldview_name,
      captionedItems,
      bodyProfileNote: null,  // ★ G-1 は体型注入なし(候補は世界観適合主体・体型は G-3 try-on で)
    };

    // 2) LLM① keyword 抽出(失敗時は fallbackText 返却・退行ゼロ)
    let keywords: KeywordExtractionResult;
    try {
      keywords = await callClaudeJSON<KeywordExtractionResult>({
        systemPrompt: KEYWORD_EXTRACTION_SYSTEM,
        userMessage:  buildKeywordExtractionUser(mbSummary),
        model:        HAIKU_MODEL,
        maxTokens:    1024,
      });
    } catch (err) {
      console.warn("[products/candidates] keyword LLM failed:", err instanceof Error ? err.message : String(err));
      const fallback: CandidatesResponse = {
        moodboardId, candidates: [], queriesUsed: [],
        fallbackText: "ムードボードから検索キーワードを生成できませんでした。もう一度お試しください。",
      };
      return NextResponse.json(fallback);
    }

    // 3) 楽天検索(★ Layer 1)・カテゴリ別・失敗は非致命(該当カテゴリ skip)
    const queriesUsed: string[] = [];
    const rawCandidates: Array<{ category: CandidateCategory; p: Awaited<ReturnType<typeof searchByKeyword>>[number] }> = [];
    let anySearchError = false;
    // ★ G-1 fix(429): 楽天は ★ 1 リクエスト/秒 制限。ループは元々順次だが間隔ゼロで超過していた。
    //   実際に検索を発行したカテゴリの 2 件目以降の前に 1.1 秒待機(安全マージン)。空カテゴリは待たない。
    let searchCount = 0;
    for (const category of CANDIDATE_CATEGORIES) {
      const kws = keywords[category];
      if (!Array.isArray(kws) || kws.length === 0) continue;
      const query = kws.join(" ");
      queriesUsed.push(`${category}: ${query}`);
      if (searchCount > 0) {
        await new Promise((resolve) => setTimeout(resolve, 1100));
      }
      searchCount++;
      try {
        const products = await searchByKeyword(query, { hits: HITS_PER_CATEGORY });
        for (const p of products.slice(0, KEEP_PER_CATEGORY)) {
          rawCandidates.push({ category, p });
        }
      } catch (err) {
        anySearchError = true;
        console.warn(`[products/candidates] rakuten search failed (${category}):`, err instanceof Error ? err.message : String(err));
      }
    }

    if (rawCandidates.length === 0) {
      if (anySearchError) {
        return NextResponse.json({ error: "商品検索に失敗しました" }, { status: 500 });
      }
      // 検索は走ったがヒット 0 → 200 空候補(壊さない)
      const empty: CandidatesResponse = { moodboardId, candidates: [], queriesUsed };
      return NextResponse.json(stripCanonicalSlugsRecursive(empty));
    }

    // 4) LLM② score + reasoning(失敗時は score=既定 / reasoning 空で続行・退行ゼロ)
    const forScoring: CandidateForScoring[] = rawCandidates.map((c, index) => ({
      index,
      category: c.category,
      title:    c.p.name,
      brand:    c.p.shopName || null,
      price:    c.p.price ?? null,
    }));

    const scoreMap = new Map<number, { score: number; reasoning: string }>();
    try {
      const sr = await callClaudeJSON<ScoreReasoningResult>({
        systemPrompt: SCORE_REASONING_SYSTEM,
        userMessage:  buildScoreReasoningUser(mbSummary, forScoring),
        model:        HAIKU_MODEL,
        maxTokens:    2048,
      });
      for (const e of sr.entries ?? []) {
        if (typeof e.index === "number") {
          const score = Math.max(0, Math.min(100, Math.round(e.score ?? 0)));
          scoreMap.set(e.index, { score, reasoning: typeof e.reasoning === "string" ? e.reasoning : "" });
        }
      }
    } catch (err) {
      console.warn("[products/candidates] scoring LLM failed, continuing without reasoning:", err instanceof Error ? err.message : String(err));
    }

    // 5) ProductCandidate 組立 + スコア降順
    const candidates: ProductCandidate[] = rawCandidates.map((c, index) => {
      const sr = scoreMap.get(index);
      return {
        source:            "rakuten" as const,
        source_product_id: c.p.externalId,
        title:             c.p.name,
        brand:             c.p.shopName || null,
        price:             c.p.price ?? null,
        image_url:         c.p.imageUrl,
        product_url:       c.p.productUrl,
        affiliate_url:     c.p.affiliateUrl,
        category:          c.category,
        score:             sr?.score ?? 50,
        reasoning:         sr?.reasoning ?? "",
      };
    }).sort((a, b) => b.score - a.score);

    // 6) 三重防御(3): 全 string 再帰 strip
    const response: CandidatesResponse = { moodboardId, candidates, queriesUsed };
    return NextResponse.json(stripCanonicalSlugsRecursive(response));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[products/candidates] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
