import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getRanking } from "@/lib/rakuten";
import { callClaudeJSON } from "@/lib/claude";
import { TREND_EXTRACT_SYSTEM_PROMPT } from "@/lib/prompts/trend-extract";
import type { Database } from "@/types/database";

// メンズファッション: 楽天の正ジャンルID
const MENS_GENRE_ID    = "551177";
const LADIES_GENRE_ID  = "100371";

interface ExtractedTrend {
  keyword: string;
  category: string;
  description: string;
  applicable_styles: string[];
  incompatible_styles: string[];
  adaptation_hint: string;
  observed_items: string[];
}

interface TrendExtractResponse {
  trends: ExtractedTrend[];
}

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars missing");
  return createClient<Database>(url, key);
}

function getCurrentSeason(): string {
  const month = new Date().getMonth() + 1;
  const year  = new Date().getFullYear();
  return month >= 4 && month <= 9 ? `${year}SS` : `${year}AW`;
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!authHeader || authHeader !== `Bearer ${serviceKey}`) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({})) as { dryRun?: boolean; season?: string };
  const dryRun = body.dryRun ?? true;
  const season = body.season ?? getCurrentSeason();
  const year   = parseInt(season.slice(0, 4), 10);

  const errors: string[] = [];

  // ── Step 1: ランキング取得 ──────────────────────────────────
  let ladiesItems: string[] = [];
  let mensItems:   string[] = [];

  try {
    const products = await getRanking(LADIES_GENRE_ID, 30);
    ladiesItems = products.map((p) => p.name).filter(Boolean);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`レディースランキング取得失敗: ${msg}`);
  }

  await new Promise(resolve => setTimeout(resolve, 1000));

  try {
    const products = await getRanking(MENS_GENRE_ID, 30);
    mensItems = products.map((p) => p.name).filter(Boolean);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`メンズランキング取得失敗: ${msg}`);
  }

  const allItems = [...ladiesItems, ...mensItems];

  if (allItems.length === 0) {
    return NextResponse.json({
      error: "楽天APIから商品を取得できませんでした",
      errors,
      hint: "APIキーが有効か確認してください（UUID形式・pk_形式は拒否される場合があります）",
    }, { status: 502 });
  }

  // ── Step 2: Claude でトレンド抽出 ─────────────────────────
  const userMessage = [
    `【レディースファッション ランキング（${ladiesItems.length}件）】`,
    ladiesItems.slice(0, 30).map((n, i) => `${i + 1}. ${n}`).join("\n"),
    "",
    `【メンズファッション ランキング（${mensItems.length}件）】`,
    mensItems.slice(0, 30).map((n, i) => `${i + 1}. ${n}`).join("\n"),
  ].join("\n");

  let extracted: ExtractedTrend[] = [];
  try {
    const result = await callClaudeJSON<TrendExtractResponse>({
      systemPrompt: TREND_EXTRACT_SYSTEM_PROMPT,
      userMessage,
      maxTokens: 2000,
    });
    extracted = result.trends ?? [];
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Claude API失敗: ${msg}`, errors }, { status: 500 });
  }

  if (extracted.length === 0) {
    return NextResponse.json({ error: "トレンドを抽出できませんでした", errors }, { status: 500 });
  }

  // ── Step 3: dryRun の場合はここで返す ─────────────────────
  if (dryRun) {
    return NextResponse.json({
      message: "dryRun完了（DBへの書き込みなし）",
      season,
      fetched:   { ladies: ladiesItems.length, mens: mensItems.length },
      extracted: extracted.length,
      preview:   extracted,
      errors,
    });
  }

  // ── Step 4: Supabase に INSERT ─────────────────────────────
  const supabase = createAdminClient();

  // 同シーズンの rakuten_api 由来レコードのみ削除して差し替え
  // （手動登録: source_type IS NULL or 'manual' は保護）
  await supabase
    .from("trends" as never)
    .delete()
    .eq("season", season)
    .eq("source_type", "rakuten_api");

  let inserted = 0;
  for (const [idx, t] of Array.from(extracted.entries())) {
    const row = {
      season,
      year,
      keyword:             t.keyword,
      category:            t.category,
      description:         t.description,
      applicable_styles:   t.applicable_styles  ?? [],
      incompatible_styles: t.incompatible_styles ?? [],
      adaptation_hint:     t.adaptation_hint ?? null,
      is_active:           true,
      display_order:       100 + idx,
      source_type:         "rakuten_api",
      source_label:        `楽天ランキング ${season}`,
      observed_items:      t.observed_items ?? [],
      fetched_at:          new Date().toISOString(),
    };

    const { error } = await supabase.from("trends" as never).insert(row as never);
    if (error) {
      errors.push(`INSERT失敗 (${t.keyword}): ${error.message}`);
    } else {
      inserted++;
    }
  }

  return NextResponse.json({
    message: "同期完了",
    season,
    fetched:   { ladies: ladiesItems.length, mens: mensItems.length },
    extracted: extracted.length,
    inserted,
    errors,
  });
}
