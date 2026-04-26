import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getRanking } from "@/lib/rakuten";
import { callClaudeJSON } from "@/lib/claude";
import { TREND_EXTRACT_SYSTEM_PROMPT } from "@/lib/prompts/trend-extract";
import type { Database } from "@/types/database";

const MENS_GENRE_ID   = "551177";
const LADIES_GENRE_ID = "100371";

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

function authenticate(request: NextRequest): { ok: boolean; isCron: boolean } {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return { ok: true, isCron: true };
  }
  if (serviceKey && authHeader === `Bearer ${serviceKey}`) {
    return { ok: true, isCron: false };
  }
  return { ok: false, isCron: false };
}

async function runSync(dryRun: boolean, season: string) {
  const year   = parseInt(season.slice(0, 4), 10);
  const errors: string[] = [];

  // ── Step 1: ランキング取得 ─────────────────────────────────
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
      hint: "APIキーが有効か確認してください",
    }, { status: 502 });
  }

  // ── Step 2: Claude でトレンド抽出 ────────────────────────
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

  // ── Step 3: dryRun の場合はここで返す ────────────────────
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

  // ── Step 4: Supabase に INSERT ────────────────────────────
  const supabase = createAdminClient();

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

// Vercel Cron からの GET リクエスト（常に本番実行）
export async function GET(request: NextRequest) {
  const auth = authenticate(request);
  if (!auth.ok) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }
  return runSync(false, getCurrentSeason());
}

// 手動実行用 POST リクエスト（dryRun 対応）
export async function POST(request: NextRequest) {
  const auth = authenticate(request);
  if (!auth.ok) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({})) as { dryRun?: boolean; season?: string };
  const dryRun = auth.isCron ? false : (body.dryRun ?? true);
  const season = body.season ?? getCurrentSeason();

  return runSync(dryRun, season);
}
