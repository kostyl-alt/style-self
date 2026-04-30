import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { isAdminEmail } from "@/lib/utils/admin-check";
import { callClaudeJSON } from "@/lib/claude";
import { EXTRACT_PRODUCT_INFO_PROMPT } from "@/lib/prompts/extract-product-info";
import type { FetchProductInfoResponse, MaterialComposition, ProductAxes } from "@/types/index";

// Sprint 41.1: 商品ページURLから情報を抽出する管理者API
//
// フロー:
// 1. URLバリデーション + admin チェック
// 2. fetch(url) — ブラウザ風 User-Agent
// 3. HTML から <head> + JSON-LD を抽出（5-10KBに圧縮）
// 4. Claude で構造化抽出（8軸情報含む）
// 5. 部分的成功も許容、null/空配列フィールドはそのまま返す
//
// ZOZOTOWN は Akamai でブロックされる可能性大（403）。
// 失敗時はエラーメッセージで手入力誘導。

const FETCH_TIMEOUT_MS = 12_000;
const MAX_HTML_CHARS   = 10_000;

const VALID_CATEGORIES = new Set([
  "tops", "bottoms", "outerwear", "dress", "shoes", "bags", "accessories",
]);

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}
function asStringOrNull(v: unknown): string | null {
  return typeof v === "string" && v ? v : null;
}
function asStringArray(v: unknown, max = 5): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.length > 0).slice(0, max);
}
function asNumberOrNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
function normalizeWeightCenter(v: unknown): "upper" | "lower" | "balanced" | null {
  if (v === "upper" || v === "lower" || v === "balanced") return v;
  return null;
}

// HTML から <head> セクション + JSON-LD だけを抽出して送信量を抑える
function extractMetadataSnippet(html: string): string {
  const head = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i)?.[0] ?? "";
  const jsonLdMatches = Array.from(html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi));
  const jsonLds = jsonLdMatches.map((m) => m[0]).join("\n");
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[0] ?? "";
  const combined = `${titleMatch}\n${head}\n${jsonLds}`;
  return combined.slice(0, MAX_HTML_CHARS);
}

async function fetchHtml(url: string): Promise<string> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9",
        "Accept-Language": "ja,en-US;q=0.7,en;q=0.3",
      },
      signal: controller.signal,
      redirect: "follow",
    });
  } catch (err) {
    clearTimeout(t);
    const reason = err instanceof Error ? err.message : "unknown";
    throw new Error(`fetch失敗: ${reason}`);
  }
  clearTimeout(t);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function normalizeMaterialComposition(raw: unknown): MaterialComposition[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item): MaterialComposition | null => {
      if (!item || typeof item !== "object") return null;
      const o = item as Record<string, unknown>;
      const name = asString(o.name).trim();
      if (!name) return null;
      return { name, percentage: asNumberOrNull(o.percentage) };
    })
    .filter((x): x is MaterialComposition => x !== null)
    .slice(0, 5);
}

function normalizeAxes(raw: unknown): ProductAxes {
  const o = (raw ?? {}) as Record<string, unknown>;
  return {
    silhouetteType:  asStringOrNull(o.silhouetteType),
    topBottomRatio:  asStringOrNull(o.topBottomRatio),
    lengthBalance:   asStringOrNull(o.lengthBalance),
    shoulderLine:    asStringOrNull(o.shoulderLine),
    weightCenter:    normalizeWeightCenter(o.weightCenter),
    textureType:     asStringOrNull(o.textureType),
    seasonality:     asStringArray(o.seasonality, 4),
  };
}

function normalizeFetchedInfo(raw: Record<string, unknown>, fallbackUrl: string): FetchProductInfoResponse {
  const cat = asString(raw.normalizedCategory);
  return {
    brand:                asStringOrNull(raw.brand),
    name:                 asStringOrNull(raw.name),
    imageUrl:             asStringOrNull(raw.imageUrl),
    price:                asNumberOrNull(raw.price),
    productUrl:           asStringOrNull(raw.productUrl) ?? fallbackUrl,
    normalizedCategory:   VALID_CATEGORIES.has(cat) ? cat : "tops",
    normalizedColors:     asStringArray(raw.normalizedColors, 3),
    normalizedMaterials:  asStringArray(raw.normalizedMaterials, 3),
    materialComposition:  normalizeMaterialComposition(raw.materialComposition),
    normalizedSilhouette: asStringOrNull(raw.normalizedSilhouette),
    axes:                 normalizeAxes(raw.axes),
    bodyCompatTags:       asStringArray(raw.bodyCompatTags, 5),
    worldviewTags:        asStringArray(raw.worldviewTags, 5),
    curationNotes:        asString(raw.curationNotes),
    curationPriority:     Math.min(Math.max(0, Number(raw.curationPriority) || 50), 100),
  };
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    if (!isAdminEmail(user.email)) {
      return NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 });
    }

    const { url } = await request.json() as { url: string };
    if (!url?.trim()) {
      return NextResponse.json({ error: "URLを指定してください" }, { status: 400 });
    }
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return NextResponse.json({ error: "URL形式が不正です" }, { status: 400 });
    }
    if (!/^https?:$/.test(parsed.protocol)) {
      return NextResponse.json({ error: "http(s):// のURLを指定してください" }, { status: 400 });
    }

    // HTML 取得
    let html: string;
    try {
      html = await fetchHtml(url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "URL取得失敗";
      return NextResponse.json({
        error: `URLの取得に失敗しました（${msg}）。手動入力してください。`,
      }, { status: 502 });
    }

    const snippet = extractMetadataSnippet(html);
    if (snippet.length < 50) {
      return NextResponse.json({
        error: "ページからメタデータを抽出できませんでした。手動入力してください。",
      }, { status: 422 });
    }

    // Claude で抽出
    const userMsg = [
      `URL: ${url}`,
      `[HTMLスニペット]`,
      snippet,
    ].join("\n\n");

    const raw = await callClaudeJSON<Record<string, unknown>>({
      systemPrompt: EXTRACT_PRODUCT_INFO_PROMPT,
      userMessage:  userMsg,
      maxTokens:    1500,
    });

    const response = normalizeFetchedInfo(raw, url);
    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "商品情報の取得に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
