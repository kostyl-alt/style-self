import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { isAdminEmail } from "@/lib/utils/admin-check";
import { callClaudeJSON } from "@/lib/claude";
import { ANALYZE_PRODUCT_TEXT_PROMPT } from "@/lib/prompts/analyze-product-text";
import type { AnalyzeProductTextResponse, MaterialComposition, ProductAxes } from "@/types/index";

// Sprint 41.2+: ペーストされた商品ページ本文から商品情報を抽出する管理者API
//
// URLが取得できない（ZOZOのAkamai 403等）かつ画像でなくテキストで持ち込みたい
// ケース向け。admin がブラウザで本文を選択コピーして貼り付けたプレーンテキストを
// Claude で構造化抽出する。
//
// レスポンス型は fetch-product-info / analyze-product-image と同型。

const MAX_TEXT_CHARS = 50_000;

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
    const n = Number(v.replace(/[,¥円\s]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
function normalizeWeightCenter(v: unknown): "upper" | "lower" | "balanced" | null {
  if (v === "upper" || v === "lower" || v === "balanced") return v;
  return null;
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

function normalizeAnalyzeResult(raw: Record<string, unknown>): AnalyzeProductTextResponse {
  const cat = asString(raw.normalizedCategory);
  return {
    brand:                asStringOrNull(raw.brand),
    name:                 asStringOrNull(raw.name),
    imageUrl:             asStringOrNull(raw.imageUrl),
    price:                asNumberOrNull(raw.price),
    productUrl:           asStringOrNull(raw.productUrl),
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

    const { text } = await request.json() as { text: string };

    if (typeof text !== "string" || !text.trim()) {
      return NextResponse.json({ error: "テキストを貼り付けてください" }, { status: 400 });
    }
    if (text.trim().length < 30) {
      return NextResponse.json({
        error: "テキストが短すぎます。商品名・価格・素材表記を含むブロックを貼り付けてください。",
      }, { status: 400 });
    }

    const trimmed = text.slice(0, MAX_TEXT_CHARS);

    const raw = await callClaudeJSON<Record<string, unknown>>({
      systemPrompt: ANALYZE_PRODUCT_TEXT_PROMPT,
      userMessage:  trimmed,
      maxTokens:    2500,
    });

    const response = normalizeAnalyzeResult(raw);
    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "テキスト解析に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
