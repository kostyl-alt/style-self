// M5-2: 商品 worldview_tags の正準辞書(31 語・小文字英語スラッグ)
//
// 設計: docs/STYLE-SELF_M5_実装設計.md セクション 4
//
// 【3 経路で同じ辞書を使う】
// - lib/prompts/extract-product-info.ts(URL→属性抽出)
// - lib/prompts/analyze-product-image.ts(画像→属性抽出)
// - lib/prompts/analyze-product-text.ts(本文→属性抽出)
// 3 経路が同じ語彙体系で worldviewTags を返すことを構造的に担保する
// (定数 1 箇所参照・ズレ防止)。
//
// 【出典】
// - coreTags 25 語: lib/knowledge/worldview-patterns.ts の 8 パターン × coreTags 4 から
//   重複除去したもの
// - 拡張 6 語: lib/prompts/analyze-v2-details.ts で例示された + オーナーアンカー実値で
//   観測された語(deconstruction, gothic, preppy, glam, monochrome, avant-garde)
//
// 【M5-3 / M5-5 でも参照】
// - M5-3: concept-translate.ts プロンプトで「coreTags を併産する」指示にも同じ辞書を使う
// - M5-5: 直接マッチ API でも同じ辞書を前提に動く

export const PRODUCT_WORLDVIEW_TAGS = [
  // coreTags 25 語(worldview-patterns.ts 8 パターン × 4 を重複除去)
  "quiet", "minimal", "intellectual", "nostalgic",
  "clean", "structured", "refined", "mature",
  "rebellious", "raw", "dark", "expressive",
  "soft", "romantic", "approachable", "open",
  "sensual", "mysterious", "heavy",
  "natural", "relaxed",
  "futuristic", "sharp",
  "youthful", "light",
  // 拡張 6 語(analyze-v2 例示 + オーナーアンカー実値)
  "deconstruction", "gothic", "preppy", "glam", "monochrome", "avant-garde",
] as const;

// プロンプト 3 経路の worldviewTags 抽出指示ブロック(共通)。
// 既存の他フィールド(category / colors / materials / silhouettes / brands /
// axes / material_composition / body_compat_tags / curation_notes / curationPriority)
// は各プロンプトで個別管理。本ブロックは worldviewTags 行のみを置き換える用途。
export const WORLDVIEW_TAGS_PROMPT_BLOCK =
  `- worldviewTags:    以下の coreTags 正準辞書 31 語からのみ選ぶ(最大 5 個・英語スラッグ・小文字)
  日本語タグ・自由形・辞書外の語は禁止(辞書外を返すとマッチング機構が機能しない)。
  該当が無い場合は空配列。迷う場合は最も近い 1 語を選ぶ。
  辞書: ${PRODUCT_WORLDVIEW_TAGS.join(", ")}`;
