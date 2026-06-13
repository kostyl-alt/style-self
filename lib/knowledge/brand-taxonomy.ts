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
export type EraTag = string; // STYLE_AXES key="era"

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
  /** STYLE_AXES key="era" のタグ名（写真から参照されやすい年代感・ブランド創業年ではない） */
  eraSignals: EraTag[];
  /** 価格帯 */
  priceTier: BrandPriceTier;
  /** 商品検索（楽天/ZOZO 等）に流す検索ワード候補 */
  searchKeywords: string[];
}

// 黒/モード/ミニマル/ストリート系の最初の 5 件（すべて STYLE_AXES 実在タグで構成）。
// 本格 seed（15〜30 件）は後続で追加。matcher・brand-learn 接続は Step3/4。
export const BRAND_TAXONOMY: BrandTaxonomyEntry[] = [
  {
    name: "Yohji Yamamoto",
    styleTags: ["黒一色", "ドレープ", "アヴァンギャルド", "ロング丈"],
    genreCandidates: ["モード", "ダーク/ブラックモード", "アヴァンギャルド/脱構築"],
    cultureCandidates: ["アーティスト/クリエイター", "パリ", "東京/原宿"],
    itemStrengths: ["ロングコート", "テーラードジャケット", "ワイドパンツ"],
    materialSignals: ["ウール", "コットン", "レザー"],
    colorSignals: ["オールブラック", "モノトーン", "ダークトーン"],
    silhouetteSignals: ["ドレープ", "ワイド", "オーバーサイズ", "Iライン"],
    eraSignals: ["1980s", "1990s"],
    priceTier: "luxury",
    searchKeywords: ["Yohji Yamamoto", "ヨウジヤマモト", "黒 モード コート", "Yohji Yamamoto wide pants"],
  },
  {
    name: "COMME des GARÇONS",
    styleTags: ["脱構築", "黒基調", "前衛的", "ボックスシルエット"],
    genreCandidates: ["アヴァンギャルド/脱構築", "モード", "ダーク/ブラックモード"],
    cultureCandidates: ["東京/原宿", "アーティスト/クリエイター", "パリ"],
    itemStrengths: ["変形ジャケット", "ニット", "アウター"],
    materialSignals: ["ウール", "コットン", "ナイロン"],
    colorSignals: ["オールブラック", "モノトーン", "ダークトーン"],
    silhouetteSignals: ["ボックス", "オーバーサイズ", "ドレープ"],
    eraSignals: ["1980s", "1990s"],
    priceTier: "luxury",
    searchKeywords: ["COMME des GARCONS", "コムデギャルソン", "黒 モード", "COMME des GARCONS jacket"],
  },
  {
    name: "stein",
    styleTags: ["ミニマルモード", "低彩度", "クリーン", "ワイドシルエット"],
    genreCandidates: ["ミニマルモード", "モード", "ミニマル"],
    cultureCandidates: ["中目黒/青山", "アーティスト/クリエイター", "編集者/スタイリスト"],
    itemStrengths: ["スラックス", "シャツ", "コート"],
    materialSignals: ["ウール", "コットン", "ナイロン"],
    colorSignals: ["モノトーン", "低彩度", "ニュートラル"],
    silhouetteSignals: ["ワイド", "ドレープ", "オーバーサイズ", "Iライン"],
    eraSignals: ["2010s", "2020s"],
    priceTier: "high",
    searchKeywords: ["stein", "シュタイン", "stein coat", "stein wide pants", "ミニマル モード"],
  },
  {
    name: "COMOLI",
    styleTags: ["上質ベーシック", "ニュートラル", "力の抜けたきれいめ", "ナチュラル"],
    genreCandidates: ["ミニマル", "エフォートレス", "ノームコア"],
    cultureCandidates: ["中目黒/青山", "編集者/スタイリスト", "モデル私服(オフデューティ)"],
    itemStrengths: ["シャツ", "スラックス", "アウター"],
    materialSignals: ["コットン", "ウール", "リネン"],
    colorSignals: ["ニュートラル", "低彩度", "アースカラー", "ネイビー基調"],
    silhouetteSignals: ["ワイド", "オーバーサイズ", "ドレープ", "Iライン"],
    eraSignals: ["2010s", "2020s"],
    priceTier: "high",
    searchKeywords: ["COMOLI", "コモリ", "COMOLI shirt", "COMOLI pants", "ミニマル きれいめ"],
  },
  {
    name: "LIDNM",
    styleTags: ["黒ベース", "きれいめストリート", "モノトーン", "ワイド"],
    genreCandidates: ["ミニマルストリート", "ブラックストリート", "ミニマル"],
    cultureCandidates: ["東京/原宿", "ソウル/弘大/江南"],
    itemStrengths: ["セットアップ", "アウター", "スラックス"],
    materialSignals: ["ウール", "ナイロン", "コットン"],
    colorSignals: ["オールブラック", "モノトーン", "低彩度"],
    silhouetteSignals: ["ワイド", "オーバーサイズ", "Iライン"],
    eraSignals: ["2020s"],
    priceTier: "mid",
    searchKeywords: ["LIDNM", "リドム", "黒 ストリート きれいめ", "LIDNM wide pants"],
  },
];
