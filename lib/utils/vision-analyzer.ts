// D1 Phase 2 ムードボード v3: 画像自動分析(Claude Vision)
//   + 複数画像MB分析 Step 1: 画像ごとの構造化 observed facts(vision)を rich 化して返す。
//
// 設計: docs/STYLE-SELF_D1_Sprint_C-2_段階3-B_v3_革新設計_調査.md(cd1b01a)§2
// 既存先例: app/api/admin/analyze-product-image/route.ts(Sprint 41.2)
//           + lib/claude.ts callClaudeWithImage(L100-147)を流用
//
// 機能:
//   - 画像 URL を受け取り、Claude Vision で必須要素 8 のカテゴリ判定 + caption + 主要色（既存・温存）
//   - ★ Step 1: 画像ごとの構造化 vision(roles/visualFacts/styleSignals/freeText)も併せて返す
//     ・visualFacts(colors/items/locations/lighting)は画像から見える事実・各 basis+confidence
//     ・styleSignals は ★ STYLE_AXES 実在タグに正規化(コード側で valid フィルタ＝ドリフト防止)
//   - 失敗時 throw(caller 側で fallback)
//
// 三重防御維持:
//   - prompt に英語スラッグ非露出指示(worldview_tags 等)
//   - 出力カテゴリは ESSENTIAL_CATEGORIES に厳格制限
//   - styleSignals は STYLE_AXES 実在タグのみ採用(自由文/造語は弾く)

import { callClaudeWithImage, type ImageMediaType } from "@/lib/claude";
import {
  ESSENTIAL_CATEGORIES,
  type EssentialCategory,
} from "@/lib/utils/moodboard-essentials";
import { STYLE_AXES } from "@/lib/style-taxonomy";
import type {
  MoodboardItemVision,
  VisionFactEntry,
  VisionBasis,
  VisionConfidence,
} from "@/types/moodboard";

export interface VisionAnalysisResult {
  categories:      EssentialCategory[];  // 必須要素 8 から 1-3 個（既存・caption prefix 用に温存）
  caption:         string;               // 50 字以内・日本語（既存・温存）
  dominant_colors: string[];             // hex 2-3 個（既存・温存）
  // ★ Step 1: 画像ごとの構造化 observed facts（moodboard_items.vision に保存）
  vision:          MoodboardItemVision;
}

// hex カラーコード(#RRGGBB / #RRGGBBAA / #RGB)の検証
const HEX_RE = /^#([0-9a-f]{3,8})$/i;

// ---- STYLE_AXES 実在タグ（styleSignals 正規化用 + プロンプト語彙）----
function axisNames(key: string): string[] {
  return (STYLE_AXES.find((a) => a.key === key)?.tags ?? []).map((t) => t.name.trim());
}
const VALID_TAGS = {
  color:      new Set(axisNames("color")),
  material:   new Set(axisNames("material")),
  silhouette: new Set(axisNames("silhouette")),
  genre:      new Set(axisNames("genre")),
  culture:    new Set(axisNames("culture")),
};
const VOCAB = {
  color:      axisNames("color").join(" / "),
  material:   axisNames("material").join(" / "),
  silhouette: axisNames("silhouette").join(" / "),
  genre:      axisNames("genre").join(" / "),
  culture:    axisNames("culture").join(" / "),
};

const SYSTEM_PROMPT = `あなたはファッション画像分析の専門家です。
ムードボード(ファッション制作プロセス)に保存される参考画像 1 枚を分析し、以下の JSON で出力してください。

【出力 JSON 形式】
{
  "categories": ["hair", "light"],
  "caption": "濡れ髪のラフな束ね・横顔・暗いトーン",
  "dominant_colors": ["#000000", "#888888"],
  "vision": {
    "schemaVersion": 1,
    "roles": ["model", "color", "silhouette"],
    "primaryRole": "model",
    "visualFacts": {
      "colors":    [{ "value": "黒", "basis": "observed", "confidence": "high" }],
      "items":     [{ "value": "レザージャケット", "basis": "observed", "confidence": "medium" }],
      "locations": [{ "value": "夜の街路", "basis": "inferred", "confidence": "low" }],
      "lighting":  [{ "value": "低照度・硬い影", "basis": "observed", "confidence": "medium" }]
    },
    "styleSignals": {
      "colorTags": ["オールブラック"],
      "materialTags": ["レザー"],
      "silhouetteTags": ["タイト"],
      "genreTags": ["ダーク/ブラックモード"],
      "cultureTags": []
    },
    "freeText": { "caption": "濡れ髪のラフな束ね・横顔・暗いトーン", "notes": [] }
  }
}

【categories】★ 以下の 8 種類から 1-3 個（caption 用）:
- model … 人物(年齢層/性別/体型/雰囲気) / lifestyle … 生活シーン/職業性 / hair … 髪 / makeup … 化粧
- clothes … 服(シルエット/素材/カテゴリ) / light … 光 / location … 場所/背景 / color … 主要色/配色

【caption】★ 50 字以内・日本語・事実描写のみ(感想/評価/主観形容詞は禁止・英語スラッグ禁止)

【dominant_colors】★ hex 形式(#RRGGBB)・2-3 個

【vision.roles】★ この画像が担う役割を上記 8 種(model/lifestyle/hair/makeup/clothes/light/location/color)から複数可で。primaryRole は主役を 1 つ(任意)。

【vision.visualFacts】★ 画像から見える事実。colors/items/locations/lighting それぞれに { value, basis, confidence }:
- basis: "observed"(画像から確認できる) または "inferred"(推測)。★ 色/アイテム/場所/光は基本 observed・確信が低いものは inferred。
  ★ 素材感・ヘア・メイク・ムードなど見ただけで断定できないものは inferred にする(断定しない)。
- confidence: "high" | "medium" | "low"。

【vision.styleSignals】★ STYLE_AXES の実在タグに正規化する(★ 下の語彙から該当するものだけ選ぶ・無理に作らない・無ければ空配列 [])。
- ★ 自由文・造語・表記ゆれを入れない(語彙に無い言葉は使わない)。日本語・英語スラッグ禁止。
- 語彙:
  - colorTags: ${VOCAB.color}
  - materialTags: ${VOCAB.material}
  - silhouetteTags: ${VOCAB.silhouette}
  - genreTags: ${VOCAB.genre}
  - cultureTags: ${VOCAB.culture}

【vision.freeText】★ 表示/説明用の自由文。caption(短い事実描写) と notes(補足の短文・任意)。★ styleSignals と混ぜない。

【出力】★ JSON のみ・前置きや説明文を含めない`;

export async function analyzeImage(imageUrl: string): Promise<VisionAnalysisResult> {
  // 1) 画像 URL → base64 + mediaType(server-side fetch)
  const { base64, mediaType } = await fetchImageAsBase64(imageUrl);
  // 2-3) base64 経路に委譲（Vision 呼出 + 正規化）。
  return analyzeImageFromBase64(base64, mediaType);
}

// ★ チャット複数写真→構造: base64 を直接受ける入口（URL/Storage 不要・MB 非依存・既存 analyzeImage と同じ Vision+正規化）。
//   チャットの📎写真は base64 で来るため、アップロードせず構造化 vision を得るのに使う。
export async function analyzeImageFromBase64(
  base64: string,
  mediaType: ImageMediaType,
): Promise<VisionAnalysisResult> {
  // Claude Vision 呼出(既存 callClaudeWithImage 流用・vision 拡張で 2048)
  const raw = await callClaudeWithImage<Record<string, unknown>>(
    SYSTEM_PROMPT,
    base64,
    mediaType,
    "この画像を分析してください。",
    2048,
  );
  // JSON 検証 + 正規化
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

// ---- vision 正規化ヘルパ ----
function normBasis(v: unknown): VisionBasis {
  return v === "observed" ? "observed" : "inferred";
}
function normConfidence(v: unknown): VisionConfidence {
  return v === "high" || v === "medium" || v === "low" ? v : "low";
}
function normFactEntries(raw: unknown): VisionFactEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: VisionFactEntry[] = [];
  for (const e of raw) {
    if (e && typeof e === "object") {
      const o = e as Record<string, unknown>;
      const value = typeof o.value === "string" ? o.value.trim() : "";
      if (value !== "") out.push({ value, basis: normBasis(o.basis), confidence: normConfidence(o.confidence) });
    } else if (typeof e === "string" && e.trim() !== "") {
      // 文字列だけで来た場合の許容(basis/confidence は控えめ既定)
      out.push({ value: e.trim(), basis: "inferred", confidence: "low" });
    }
    if (out.length >= 8) break;
  }
  return out;
}
// styleSignals は STYLE_AXES 実在タグのみ採用(ドリフト防止)・重複除去。
function normTags(raw: unknown, valid: Set<string>): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of raw) {
    if (typeof c !== "string") continue;
    const t = c.trim();
    if (t !== "" && valid.has(t) && !seen.has(t)) { seen.add(t); out.push(t); }
  }
  return out;
}
function normStrings(raw: unknown, max: number): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of raw) {
    if (typeof c !== "string") continue;
    const t = c.trim();
    if (t !== "" && !seen.has(t)) { seen.add(t); out.push(t); }
    if (out.length >= max) break;
  }
  return out;
}

// Vision JSON を検証 + 型化
function normalizeAnalysisResult(raw: Record<string, unknown>): VisionAnalysisResult {
  // categories: ESSENTIAL_CATEGORIES に含まれる文字列のみ・最大 3 個（既存）
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

  // caption: 50 字以内（既存）
  const rawCaption = typeof raw.caption === "string" ? raw.caption.trim() : "";
  const caption = rawCaption.slice(0, 50);

  // dominant_colors: hex 形式のみ・最大 3 個（既存）
  const rawColors = Array.isArray(raw.dominant_colors) ? raw.dominant_colors : [];
  const dominant_colors: string[] = [];
  for (const c of rawColors) {
    if (typeof c === "string" && HEX_RE.test(c.trim())) {
      dominant_colors.push(c.trim().toLowerCase());
    }
    if (dominant_colors.length >= 3) break;
  }

  // ★ Step 1: vision を正規化（styleSignals は STYLE_AXES 実在タグに寄せる）
  const v = (raw.vision && typeof raw.vision === "object") ? raw.vision as Record<string, unknown> : {};
  const vf = (v.visualFacts && typeof v.visualFacts === "object") ? v.visualFacts as Record<string, unknown> : {};
  const ss = (v.styleSignals && typeof v.styleSignals === "object") ? v.styleSignals as Record<string, unknown> : {};
  const ft = (v.freeText && typeof v.freeText === "object") ? v.freeText as Record<string, unknown> : {};
  const ftCaption = typeof ft.caption === "string" && ft.caption.trim() !== "" ? ft.caption.trim() : caption;
  const primaryRole = typeof v.primaryRole === "string" && v.primaryRole.trim() !== "" ? v.primaryRole.trim() : undefined;

  const vision: MoodboardItemVision = {
    schemaVersion: 1,
    roles:       normStrings(v.roles, 8),
    ...(primaryRole ? { primaryRole } : {}),
    visualFacts: {
      colors:    normFactEntries(vf.colors),
      items:     normFactEntries(vf.items),
      locations: normFactEntries(vf.locations),
      lighting:  normFactEntries(vf.lighting),
    },
    styleSignals: {
      colorTags:      normTags(ss.colorTags,      VALID_TAGS.color),
      materialTags:   normTags(ss.materialTags,   VALID_TAGS.material),
      silhouetteTags: normTags(ss.silhouetteTags, VALID_TAGS.silhouette),
      genreTags:      normTags(ss.genreTags,      VALID_TAGS.genre),
      cultureTags:    normTags(ss.cultureTags,    VALID_TAGS.culture),
    },
    freeText: {
      caption: ftCaption,
      notes:   normStrings(ft.notes, 5),
    },
  };

  return { categories, caption, dominant_colors, vision };
}
