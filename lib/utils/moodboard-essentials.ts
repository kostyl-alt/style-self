// D1 Phase 2 ムードボード必須要素 8 検出ユーティリティ
//
// 設計: docs/STYLE-SELF_D1_Sprint_C-2_段階3-B_v2_改訂_設計調査.md(d515428)§6.2
//
// プロのファッション制作プロセスの必須要素 8(モデル / ライフスタイル / ヘア / メイク /
// 服 / 光 / ロケーション / 色)を、moodboards.description + moodboard_items[].caption の
// 自由記述から ★ ヒューリスティック判定 で検出する。
//
// 判定優先順位:
//   1. プレフィックス `[hair]` 等(画像追加 / caption 編集モーダルで自動付与)
//   2. 日本語キーワード fallback(8 要素 × 各 9-12 keywords)
//
// 誤判定許容(MVP)。将来 LLM 推定への置換余地あり。

export type EssentialCategory =
  | "model" | "lifestyle" | "hair" | "makeup"
  | "clothes" | "light" | "location" | "color";

export const ESSENTIAL_CATEGORIES: EssentialCategory[] = [
  "model", "lifestyle", "hair", "makeup",
  "clothes", "light", "location", "color",
];

export const ESSENTIAL_LABELS: Record<EssentialCategory, string> = {
  model:     "モデル",
  lifestyle: "ライフスタイル",
  hair:      "ヘア",
  makeup:    "メイク",
  clothes:   "服",
  light:     "光",
  location:  "ロケーション",
  color:     "色",
};

// 日本語キーワード辞書(★ プレフィックスがない自由記述からの fallback 判定用)
export const ESSENTIAL_KEYWORDS: Record<EssentialCategory, string[]> = {
  model: [
    "歳", "代", "アンドロジナス", "細身", "太め",
    "冷たい", "印象", "雰囲気", "性別", "男性", "女性",
  ],
  lifestyle: [
    "旅行", "都会", "孤独", "富裕", "芸術家",
    "学生", "若者", "サラリーマン", "セレブ", "アーティスト",
  ],
  hair: [
    "髪", "ヘア", "オールバック", "濡れ", "ロング",
    "ショート", "ボブ", "パーマ", "ストレート", "アップ",
  ],
  makeup: [
    "メイク", "リップ", "アイライン", "ノーメイク",
    "ナチュラル", "ダーク", "マスカラ", "チーク",
  ],
  clothes: [
    "服", "テーラード", "レザー", "ドレス", "シャツ",
    "パンツ", "スカート", "ジャケット", "ニット",
    "コート", "ストリート",
  ],
  light: [
    "光", "自然光", "逆光", "夕方", "朝", "夜",
    "強い影", "低照度", "明るい", "暗い", "陽射し",
  ],
  location: [
    "海", "都市", "森", "廃墟", "室内", "海岸",
    "ホテル", "ストリート", "公園", "ビーチ", "山", "砂漠",
  ],
  color: [
    "黒", "白", "赤", "青", "緑", "黄", "モノクロ",
    "ビビッド", "パステル", "アースカラー", "濃紺", "砂色", "グレー",
  ],
};

// description + 全 items.caption から必須要素 8 のカバー状況を検出
export function detectEssentials(
  description: string | null,
  items: Array<{ caption: string | null }>,
): Set<EssentialCategory> {
  const covered = new Set<EssentialCategory>();

  const textParts: string[] = [];
  if (description !== null && description !== "") textParts.push(description);
  for (const item of items) {
    if (item.caption !== null && item.caption !== "") textParts.push(item.caption);
  }
  const combined = textParts.join(" ").toLowerCase();

  if (combined === "") return covered;

  // ★ 優先 1: プレフィックス `[xxx]` 明示
  for (const category of ESSENTIAL_CATEGORIES) {
    const prefix = `[${category}]`;
    if (combined.includes(prefix)) covered.add(category);
  }

  // ★ 優先 2: 日本語キーワード fallback
  for (const category of ESSENTIAL_CATEGORIES) {
    if (covered.has(category)) continue;
    const keywords = ESSENTIAL_KEYWORDS[category];
    for (const kw of keywords) {
      if (combined.includes(kw.toLowerCase())) {
        covered.add(category);
        break;
      }
    }
  }

  return covered;
}

// 未カバー要素のリストを返す
export function getUncoveredEssentials(
  covered: Set<EssentialCategory>,
): EssentialCategory[] {
  return ESSENTIAL_CATEGORIES.filter((c) => !covered.has(c));
}

// caption から `[xxx]` プレフィックスを抽出(items Card バッジ用)
const CATEGORY_PREFIX_RE = /^\[(model|lifestyle|hair|makeup|clothes|light|location|color)\]\s*/i;

export function extractCategory(caption: string | null): EssentialCategory | null {
  if (caption === null || caption === "") return null;
  const m = caption.match(CATEGORY_PREFIX_RE);
  if (!m) return null;
  return m[1].toLowerCase() as EssentialCategory;
}

// caption から `[xxx]` プレフィックスを除いた本体を返す
export function stripCategoryPrefix(caption: string | null): string {
  if (caption === null || caption === "") return "";
  return caption.replace(CATEGORY_PREFIX_RE, "").trim();
}

// caption に category プレフィックスを付与(既存プレフィックスがあれば置換)
export function withCategoryPrefix(category: EssentialCategory | "", body: string): string {
  const trimmed = body.trim();
  if (category === "") return trimmed;
  return `[${category}] ${trimmed}`.trim();
}
