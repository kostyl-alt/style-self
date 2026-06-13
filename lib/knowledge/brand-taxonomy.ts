// ブランドマッチング v1 の型定義（Step1：型のみ・無挙動変更）。
//
// 目的: 写真分析/診断で得た世界観の軸（色・シルエット・ジャンル・年代…）を、
//   決定的（非AI）に近いブランド候補へ橋渡しするための辞書スキーマ。
//   v1 のマッチは 色 / シルエット / ジャンル / 年代 を主軸にする。
//
// ⚠️ 語彙ドリフト防止の方針:
//   genre/culture/color/silhouette/material 系のフィールドには、必ず
//   lib/style-taxonomy.ts の STYLE_AXES に存在するタグ「名」を入れる。
//   ここでズレると検索/マッチが静かに当たらなくなる。
//
//   型での厳密強制（リテラル union）は今回見送る。理由:
//   STYLE_AXES は `StyleAxis[]`（tags は `StyleTag[]`／name: string）で、
//   `as const` ではないため TypeScript からタグ名のリテラル union を導出できない。
//   厳密化するには style-taxonomy.ts 側を `as const`＋union export に改修する必要があり、
//   今回の「STYLE_AXES 無改修」制約に反する。ローカルでタグ名を再列挙するのは
//   ドリフトの温床になるので採らない。
//   → よって「軸別の型エイリアス（実体は string）＋出典軸コメント」で意図を固定し、
//      逸脱は後段（Step で追加する）テストで STYLE_AXES と突き合わせて検出する。

// ── 軸別タグ型（実体は string・出典は STYLE_AXES の対応する key）──
// いずれも STYLE_AXES に実在するタグ名のみを入れること（test で逸脱検出予定）。
export type GenreTag = string; // STYLE_AXES key="genre"
export type CultureTag = string; // STYLE_AXES key="culture"
export type ColorTag = string; // STYLE_AXES key="color"
export type SilhouetteTag = string; // STYLE_AXES key="silhouette"
export type MaterialTag = string; // STYLE_AXES key="material"

export type BrandPriceTier = "low" | "mid" | "high" | "luxury";

export interface BrandTaxonomyEntry {
  /** ブランド名（表示・検索の主キー的識別子） */
  name: string;
  /** 自由記述のスタイルタグ（STYLE_AXES 縛りなし・ニュアンス補助） */
  styleTags: string[];
  /** STYLE_AXES key="genre" のタグ名 */
  genreCandidates: GenreTag[];
  /** STYLE_AXES key="culture" のタグ名 */
  cultureCandidates: CultureTag[];
  /** 得意なアイテム種別（自由記述・例: アウター/レザー/ニット） */
  itemStrengths: string[];
  /** STYLE_AXES key="material" のタグ名 */
  materialSignals: MaterialTag[];
  /** STYLE_AXES key="color" のタグ名 */
  colorSignals: ColorTag[];
  /** STYLE_AXES key="silhouette" のタグ名 */
  silhouetteSignals: SilhouetteTag[];
  /** 価格帯 */
  priceTier: BrandPriceTier;
  /** 商品検索（楽天/ZOZO 等）に流す検索ワード候補 */
  searchKeywords: string[];
}

// 本格 seed（黒/モード/ミニマル/ストリート系 15〜30 件）は Step2 で投入する。
// ここでは型を検証するためのサンプルのみ（すべて STYLE_AXES 実在タグで構成）。
export const BRAND_TAXONOMY: BrandTaxonomyEntry[] = [
  {
    name: "Yohji Yamamoto",
    styleTags: ["黒", "ドレープ", "アヴァンギャルド"],
    genreCandidates: ["モード", "ダーク/ブラックモード", "アヴァンギャルド/脱構築"],
    cultureCandidates: ["アーティスト/クリエイター", "パリ"],
    itemStrengths: ["ロングコート", "テーラードジャケット", "ワイドパンツ"],
    materialSignals: ["ウール", "レザー"],
    colorSignals: ["オールブラック", "モノトーン"],
    silhouetteSignals: ["ドレープ", "ワイド", "Iライン"],
    priceTier: "luxury",
    searchKeywords: ["Yohji Yamamoto", "ヨウジヤマモト", "黒 モード コート"],
  },
  {
    name: "STUDIOUS",
    styleTags: ["ミニマル", "モノトーン", "きれいめ"],
    genreCandidates: ["ミニマルモード", "ミニマル", "ブラックストリート"],
    cultureCandidates: ["中目黒/青山", "モデル私服(オフデューティ)"],
    itemStrengths: ["セットアップ", "ニット", "ワイドパンツ"],
    materialSignals: ["ウール", "ニット"],
    colorSignals: ["モノトーン", "低彩度", "オールブラック"],
    silhouetteSignals: ["ワイド", "Iライン", "オーバーサイズ"],
    priceTier: "mid",
    searchKeywords: ["STUDIOUS", "ステュディオス", "ミニマル モノトーン"],
  },
];
