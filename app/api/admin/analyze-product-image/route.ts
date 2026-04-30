import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { isAdminEmail } from "@/lib/utils/admin-check";
import { callClaudeWithImage, type ImageMediaType } from "@/lib/claude";
import { ANALYZE_PRODUCT_IMAGE_PROMPT } from "@/lib/prompts/analyze-product-image";
import type {
  AnalyzeProductImageResponse,
  MaterialComposition,
  ProductAxes,
} from "@/types/index";

// Sprint 41.2: 商品ページのスクショから商品情報を抽出する管理者API
//
// URLが取得できない（ZOZOのAkamai 403等）場合のフォールバック。
// admin がスクショをアップロード → Claude Vision で構造化抽出。
// 画像は保存しない（解析専用、容量・プライバシー保護）。
//
// レスポンス型は fetch-product-info と同型（imageUrl/productUrlは常にnull）。

const VALID_MEDIA_TYPES = new Set<ImageMediaType>([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

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
      return {
        name,
        percentage: asNumberOrNull(o.percentage),
      };
    })
    .filter((x): x is MaterialComposition => x !== null)
    .slice(0, 5);
}

function normalizeAnalyzeResult(raw: Record<string, unknown>): AnalyzeProductImageResponse {
  const cat = asString(raw.normalizedCategory);
  return {
    brand:                asStringOrNull(raw.brand),
    name:                 asStringOrNull(raw.name),
    imageUrl:             null,                                           // スクショからは取得不能（admin が別途貼り付ける）
    price:                asNumberOrNull(raw.price),
    productUrl:           null,                                           // 同上
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

    const { base64, mediaType } = await request.json() as { base64: string; mediaType: string };

    if (!base64) {
      return NextResponse.json({ error: "画像データが必要です" }, { status: 400 });
    }
    if (!VALID_MEDIA_TYPES.has(mediaType as ImageMediaType)) {
      return NextResponse.json({
        error: "対応していない画像形式です（jpeg/png/webp/gif のみ）",
      }, { status: 400 });
    }

    const safeMediaType = mediaType as ImageMediaType;

    const raw = await callClaudeWithImage<Record<string, unknown>>(
      ANALYZE_PRODUCT_IMAGE_PROMPT,
      base64,
      safeMediaType,
      "この商品ページのスクリーンショットから商品情報と8軸判断、素材混率を抽出してください。顔・人物属性は分析対象外です。",
      2500,
    );

    const response = normalizeAnalyzeResult(raw);
    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "画像解析に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
