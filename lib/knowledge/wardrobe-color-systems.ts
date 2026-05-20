// P1-C-1.5b-i: wardrobe_items.color の色系統 正準辞書 + normalizeColor 関数
//
// 設計: docs/STYLE-SELF_D1_P1-C-1.5b_設計調査.md(458c0be)L6
//
// 【3 経路で同じ辞書を使う】
//   M5 PRODUCT_WORLDVIEW_TAGS と同パターン:
//   - lib/prompts/stylist-chat.ts 経由で closet 集計に使用(本ファイル直接 import)
//   - 将来 lib/utils/closet-color-summary.ts 等で再利用予定
//   - 1 箇所参照・ズレ防止
//
// 【設計方針】
//   - 12 系統(主要色)+ 「その他」フォールバック = 13 ラベル
//   - 各系統は representative なシノニム配列(自由文字列 wardrobe_items.color に
//     対する寛容なマッチング)
//   - 部分一致(includes)ではなく完全一致(===)で系統判定 → 入力を
//     normalizeColor 内で先頭一致 / 含有判定で判断
//   - マッチなし = 「その他」(集計可能・捨てない)

export const WARDROBE_COLOR_SYSTEMS = [
  {
    label: "ブラック系",
    synonyms: ["黒", "ブラック", "black", "チャコール", "墨", "ダークグレー", "炭"],
  },
  {
    label: "ホワイト系",
    synonyms: ["白", "ホワイト", "white", "オフホワイト", "アイボリー", "生成り", "クリーム"],
  },
  {
    label: "グレー系",
    synonyms: ["グレー", "gray", "grey", "ライトグレー", "シルバー", "灰"],
  },
  {
    label: "ベージュ系",
    synonyms: ["ベージュ", "beige", "キャメル", "camel", "タン", "tan", "サンドベージュ", "ヌーディ"],
  },
  {
    label: "ブラウン系",
    synonyms: ["茶", "ブラウン", "brown", "コーヒー", "モカ", "チョコレート", "ココア"],
  },
  {
    label: "ネイビー系",
    synonyms: ["ネイビー", "navy", "紺", "紺色", "ダークブルー"],
  },
  {
    label: "ブルー系",
    synonyms: ["青", "ブルー", "blue", "サックス", "サックスブルー", "スカイブルー", "水色", "ライトブルー"],
  },
  {
    label: "グリーン系",
    synonyms: ["緑", "グリーン", "green", "オリーブ", "olive", "モス", "フォレスト"],
  },
  {
    label: "カーキ系",
    synonyms: ["カーキ", "khaki", "サンドカーキ"],
  },
  {
    label: "レッド系",
    synonyms: ["赤", "レッド", "red", "ワイン", "ワインレッド", "ボルドー", "バーガンディ", "クリムゾン"],
  },
  {
    label: "ピンク系",
    synonyms: ["ピンク", "pink", "ローズ", "サーモン", "コーラル", "サーモンピンク"],
  },
  {
    label: "イエロー・オレンジ系",
    synonyms: [
      "黄", "イエロー", "yellow", "マスタード", "mustard", "レモン",
      "オレンジ", "orange", "テラコッタ", "アプリコット",
    ],
  },
  {
    label: "パープル系",
    synonyms: ["紫", "パープル", "purple", "ラベンダー", "lavender", "バイオレット", "モーブ"],
  },
] as const;

export const OTHER_COLOR_LABEL = "その他";

// 色系統名(WARDROBE_COLOR_SYSTEMS の label + "その他")の Union 文字列。
// 集計 Map のキーや UI 表示で型安全に扱いたい場合に使う。
export type WardrobeColorSystem =
  | (typeof WARDROBE_COLOR_SYSTEMS)[number]["label"]
  | typeof OTHER_COLOR_LABEL;

// 自由文字列の色名を「ブラック系」「ベージュ系」等の系統ラベルに正規化する。
// マッチなしは「その他」を返す(捨てない・件数集計可能)。
//
// 判定:
//   1. 入力を trim + 小文字化(英語スラッグ対応)
//   2. WARDROBE_COLOR_SYSTEMS を順に走査
//   3. 系統の synonyms のいずれかが入力に **部分一致**(includes)すれば、その label を返す
//      → 「ライトブラウン系」「ダーク・ブラック」のような複合表記も拾える
//   4. どの系統にも該当しなければ OTHER_COLOR_LABEL
export function normalizeColor(rawColor: string | null | undefined): WardrobeColorSystem {
  if (typeof rawColor !== "string") return OTHER_COLOR_LABEL;
  const lower = rawColor.trim().toLowerCase();
  if (lower.length === 0) return OTHER_COLOR_LABEL;
  for (const sys of WARDROBE_COLOR_SYSTEMS) {
    for (const syn of sys.synonyms) {
      if (lower.includes(syn.toLowerCase())) {
        return sys.label;
      }
    }
  }
  return OTHER_COLOR_LABEL;
}
