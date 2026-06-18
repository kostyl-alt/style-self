// チャット複数写真 → 構造抽出 + 共通点抽出（ムードボードを作らない・決定的）。
//
// POST /api/ai/photos-structure
// body: { images: { base64: string; mediaType?: string }[] }
// returns: { ok, photos: { vision }[], signals } / { ok:false, reason } / { error }
//
// フロー: auth(cookie RLS) → 各画像を analyzeImage（構造化 vision・1 枚ずつ）→
//   aggregateMoodboardSignals で「何に繰り返し惹かれているか」(signals=repeated/core/accent) を集約。
// ⚠️ brief も matchBrands も呼ばない（構造＋共通点だけ・LLM 意味づけ不要・決定的集約）。
// ⚠️ MB 行は作らない（純関数は MB 非依存）。DB 書き込みなし（分析体験のみ）。
//
// ⚠️ 複数画像を 1 リクエストで送るヘルパは無い（CLAUDE.md）→ 画像ごとに analyzeImage を 1 回ずつ呼ぶ。

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { type ImageMediaType } from "@/lib/claude";
import { analyzeImageFromBase64 } from "@/lib/utils/vision-analyzer";
import { aggregateMoodboardSignals } from "@/lib/utils/moodboard-aggregate";
import type { MoodboardItemVision, MoodboardSignals } from "@/types/moodboard";

export const dynamic = "force-dynamic";
// 画像ごとに Vision を順次呼ぶため、analyze 系より長めに確保。
export const maxDuration = 120;

const VALID_MEDIA_TYPES = new Set<ImageMediaType>(["image/jpeg", "image/png", "image/gif", "image/webp"]);
const MAX_IMAGES = 8; // 1 リクエストの上限（順次 Vision 呼び出しの暴発防止）。

interface PhotosStructureRequest {
  images?: unknown;
}

interface PhotoStructure {
  index:  number;  // 送信画像配列での元インデックス（サムネイル対応用・vision 失敗で脱落しても対応が崩れない）
  vision: MoodboardItemVision;
}

interface PhotosStructureResponse {
  ok:      boolean;
  photos?: PhotoStructure[];
  signals?: MoodboardSignals;
  reason?: "auth_required" | "empty_images";
}

export async function POST(request: NextRequest) {
  try {
    // 1) 認証（本人のみ・DB は触らないが体験を本人に閉じる）
    const supabase = createSupabaseServerClient();
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
      return NextResponse.json<PhotosStructureResponse>({ ok: true, reason: "auth_required" });
    }

    // 2) body 解析（client 信頼は最小化）
    const body = await request.json() as PhotosStructureRequest;
    const rawImages = Array.isArray(body.images) ? body.images : [];
    const images: { base64: string; mediaType: ImageMediaType }[] = [];
    for (const it of rawImages) {
      if (!it || typeof it !== "object") continue;
      const o = it as Record<string, unknown>;
      const base64 = typeof o.base64 === "string" ? o.base64 : "";
      if (base64.length === 0) continue;
      const mediaType: ImageMediaType =
        VALID_MEDIA_TYPES.has(o.mediaType as ImageMediaType) ? (o.mediaType as ImageMediaType) : "image/jpeg";
      images.push({ base64, mediaType });
      if (images.length >= MAX_IMAGES) break;
    }
    if (images.length === 0) {
      return NextResponse.json<PhotosStructureResponse>({ ok: true, reason: "empty_images" });
    }

    // 3) 各画像を構造化 vision に（1 枚ずつ Vision・1 枚失敗は無視して継続）。
    const photos: PhotoStructure[] = [];
    const aggregateItems: { id: string; vision: unknown }[] = [];
    for (let i = 0; i < images.length; i++) {
      try {
        const result = await analyzeImageFromBase64(images[i].base64, images[i].mediaType);
        const vision = result.vision;
        if (!vision) continue;
        photos.push({ index: i, vision });
        aggregateItems.push({ id: String(i), vision });
      } catch (visionErr) {
        console.warn("[photos-structure] vision failed:", visionErr instanceof Error ? visionErr.message : visionErr);
      }
    }
    if (photos.length === 0) {
      return NextResponse.json({ error: "画像の解析に失敗しました" }, { status: 502 });
    }

    // 4) 共通点を決定的に集約（何に繰り返し惹かれているか）。brief/ブランドは呼ばない。
    const signals = aggregateMoodboardSignals(aggregateItems);

    return NextResponse.json<PhotosStructureResponse>({ ok: true, photos, signals });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[photos-structure] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
