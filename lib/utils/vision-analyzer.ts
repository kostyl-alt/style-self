// D1 Phase 2 ムードボード v3: 画像自動分析(Claude Vision)
//
// 設計: docs/STYLE-SELF_D1_Sprint_C-2_段階3-B_v3_革新設計_調査.md(cd1b01a)§2
// 既存先例: app/api/admin/analyze-product-image/route.ts(Sprint 41.2)
//           + lib/claude.ts callClaudeWithImage(L100-147)を流用
//
// 機能:
//   - 画像 URL を受け取り、Claude Vision で必須要素 8 のカテゴリ判定 + caption + 主要色を出力
//   - 失敗時 throw(caller 側で fallback)
//
// 三重防御維持:
//   - prompt に英語スラッグ非露出指示(worldview_tags 等)
//   - 出力カテゴリは ESSENTIAL_CATEGORIES に厳格制限
//   - caption は事実描写のみ(評価語禁止)

import { callClaudeWithImage, type ImageMediaType } from "@/lib/claude";
import {
  ESSENTIAL_CATEGORIES,
  type EssentialCategory,
} from "@/lib/utils/moodboard-essentials";

export interface VisionAnalysisResult {
  categories:      EssentialCategory[];  // 必須要素 8 から 1-3 個
  caption:         string;               // 50 字以内・日本語
  dominant_colors: string[];             // hex 2-3 個(例: "#000000")
}

// hex カラーコード(#RRGGBB / #RRGGBBAA / #RGB)の検証
const HEX_RE = /^#([0-9a-f]{3,8})$/i;

const SYSTEM_PROMPT = `あなたはファッション画像分析の専門家です。
ムードボード(ファッション制作プロセス)に保存される参考画像を分析し、以下の JSON で出力してください。

【出力 JSON 形式】
{
  "categories": ["hair", "light"],
  "caption": "濡れ髪のラフな束ね・横顔・暗いトーン",
  "dominant_colors": ["#000000", "#888888"]
}

【categories】★ 以下の 8 種類から 1-3 個を選ぶ:
- model      … モデル(人物の年齢層・性別・体型・雰囲気を写した画像)
- lifestyle  … ライフスタイル(生活シーン・職業性・文化的背景)
- hair       … ヘア(髪型・髪色)
- makeup     … メイク(化粧・リップ・アイメイク・印象)
- clothes    … 服(服のシルエット・素材・カテゴリ)
- light      … 光(自然光・人工光・夕方・逆光等の光の質感)
- location   … ロケーション(場所・空間・背景)
- color      … 色(主要色・配色・トーン)

【caption】★ 50 字以内・日本語
- 画像の事実描写のみ(感想・評価・主観形容詞は禁止)
- 「濡れ髪のラフな束ね・暗トーン」のような客観的記述
- 英語のスラッグや技術用語(minimal / dark / streetwear 等)は使わない

【dominant_colors】★ hex 形式(#RRGGBB)・2-3 個
- 画像の主要な色を hex で抽出(例: "#000000", "#A0826D")
- 黒系は "#000000"〜"#333333" を使い分け
- 抽出が難しい場合は最小 1 個

【出力】★ JSON のみ・前置きや説明文を含めない`;

export async function analyzeImage(imageUrl: string): Promise<VisionAnalysisResult> {
  // 1) 画像 URL → base64 + mediaType(server-side fetch)
  const { base64, mediaType } = await fetchImageAsBase64(imageUrl);

  // 2) Claude Vision 呼出(既存 callClaudeWithImage 流用・Sprint 41.2 同型作法)
  const raw = await callClaudeWithImage<Record<string, unknown>>(
    SYSTEM_PROMPT,
    base64,
    mediaType,
    "この画像を分析してください。",
    1024,
  );

  // 3) JSON 検証
  return normalizeAnalysisResult(raw);
}

// public URL 経由で画像取得 → base64 + mediaType 返却
async function fetchImageAsBase64(
  imageUrl: string,
): Promise<{ base64: string; mediaType: ImageMediaType }> {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`画像取得に失敗(status=${res.status})`);

  const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
  const mediaType: ImageMediaType =
    contentType.includes("png")  ? "image/png"  :
    contentType.includes("webp") ? "image/webp" :
    contentType.includes("gif")  ? "image/gif"  :
    "image/jpeg";

  const arrayBuf = await res.arrayBuffer();
  const base64 = Buffer.from(arrayBuf).toString("base64");
  return { base64, mediaType };
}

// Vision JSON を検証 + 型化
function normalizeAnalysisResult(raw: Record<string, unknown>): VisionAnalysisResult {
  // categories: ESSENTIAL_CATEGORIES に含まれる文字列のみ・最大 3 個
  const rawCats = Array.isArray(raw.categories) ? raw.categories : [];
  const categories: EssentialCategory[] = [];
  for (const c of rawCats) {
    if (typeof c === "string") {
      const normalized = c.toLowerCase().trim();
      if (
        (ESSENTIAL_CATEGORIES as readonly string[]).includes(normalized) &&
        !categories.includes(normalized as EssentialCategory)
      ) {
        categories.push(normalized as EssentialCategory);
      }
    }
    if (categories.length >= 3) break;
  }

  // caption: 50 字以内
  const rawCaption = typeof raw.caption === "string" ? raw.caption.trim() : "";
  const caption = rawCaption.slice(0, 50);

  // dominant_colors: hex 形式のみ・最大 3 個
  const rawColors = Array.isArray(raw.dominant_colors) ? raw.dominant_colors : [];
  const dominant_colors: string[] = [];
  for (const c of rawColors) {
    if (typeof c === "string" && HEX_RE.test(c.trim())) {
      dominant_colors.push(c.trim().toLowerCase());
    }
    if (dominant_colors.length >= 3) break;
  }

  return { categories, caption, dominant_colors };
}
