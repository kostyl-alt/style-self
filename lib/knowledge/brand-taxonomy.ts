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
    cultureCandidates: ["東京/原宿", "モデル私服(オフデューティ)", "編集者/スタイリスト"],
    itemStrengths: ["セットアップ", "アウター", "スラックス"],
    materialSignals: ["ウール", "ナイロン", "コットン"],
    colorSignals: ["オールブラック", "モノトーン", "低彩度"],
    silhouetteSignals: ["ワイド", "オーバーサイズ", "Iライン"],
    eraSignals: ["2020s"],
    priceTier: "mid",
    searchKeywords: ["LIDNM", "リドム", "黒 ストリート きれいめ", "LIDNM wide pants"],
  },
  {
    name: "Rick Owens",
    styleTags: ["黒一色", "ドレープ", "ダーク", "アヴァンギャルド"],
    genreCandidates: ["ダーク/ブラックモード", "アヴァンギャルド/脱構築", "モード"],
    cultureCandidates: ["アーティスト/クリエイター", "パリ"],
    itemStrengths: ["レザージャケット", "ロングカットソー", "ブーツ"],
    materialSignals: ["レザー", "コットン", "ウール"],
    colorSignals: ["オールブラック", "ダークトーン", "モノトーン"],
    silhouetteSignals: ["ドレープ", "レイヤード", "Iライン"],
    eraSignals: ["2000s", "2010s"],
    priceTier: "luxury",
    searchKeywords: ["Rick Owens", "リックオウエンス", "Rick Owens leather", "黒 ダーク モード"],
  },
  {
    name: "Maison Margiela",
    styleTags: ["脱構築", "中性的", "アーティスティック", "モード"],
    genreCandidates: ["アヴァンギャルド/脱構築", "モード", "ジェンダーレスモード"],
    cultureCandidates: ["パリ", "アーティスト/クリエイター", "編集者/スタイリスト"],
    itemStrengths: ["テーラードジャケット", "コート", "ニット"],
    materialSignals: ["ウール", "レザー", "コットン"],
    colorSignals: ["モノトーン", "ニュートラル", "低彩度"],
    silhouetteSignals: ["オーバーサイズ", "ドレープ", "ボックス"],
    eraSignals: ["1990s", "2000s"],
    priceTier: "luxury",
    searchKeywords: ["Maison Margiela", "メゾンマルジェラ", "Margiela", "脱構築 モード"],
  },
  {
    name: "AURALEE",
    styleTags: ["上質素材", "ニュートラル", "クリーン", "きれいめ"],
    genreCandidates: ["ミニマル", "エフォートレス", "ノームコア"],
    cultureCandidates: ["中目黒/青山", "編集者/スタイリスト", "モデル私服(オフデューティ)"],
    itemStrengths: ["ニット", "シャツ", "コート"],
    materialSignals: ["ウール", "コットン", "ニット"],
    colorSignals: ["ニュートラル", "低彩度", "ベージュ系"],
    silhouetteSignals: ["ワイド", "Iライン", "オーバーサイズ"],
    eraSignals: ["2010s", "2020s"],
    priceTier: "high",
    searchKeywords: ["AURALEE", "オーラリー", "AURALEE knit", "AURALEE coat", "上質 ミニマル"],
  },
  {
    name: "Graphpaper",
    styleTags: ["ミニマル", "モノトーン", "モダンベーシック", "クリーン"],
    genreCandidates: ["ミニマル", "ミニマルモード", "エフォートレス"],
    cultureCandidates: ["中目黒/青山", "編集者/スタイリスト", "アーティスト/クリエイター"],
    itemStrengths: ["シャツ", "スラックス", "アウター"],
    materialSignals: ["コットン", "ウール", "ナイロン"],
    colorSignals: ["モノトーン", "低彩度", "ニュートラル"],
    silhouetteSignals: ["ワイド", "オーバーサイズ", "Iライン"],
    eraSignals: ["2010s", "2020s"],
    priceTier: "high",
    searchKeywords: ["Graphpaper", "グラフペーパー", "Graphpaper shirt", "ミニマル モード"],
  },
  {
    name: "ATON",
    styleTags: ["上質ベーシック", "ニュートラル", "ナチュラル", "クリーン"],
    genreCandidates: ["ミニマル", "エフォートレス", "ノームコア"],
    cultureCandidates: ["中目黒/青山", "モデル私服(オフデューティ)", "編集者/スタイリスト"],
    itemStrengths: ["ニット", "カットソー", "スラックス"],
    materialSignals: ["コットン", "ウール", "ニット"],
    colorSignals: ["ニュートラル", "低彩度", "ベージュ系"],
    silhouetteSignals: ["ワイド", "Iライン", "オーバーサイズ"],
    eraSignals: ["2010s", "2020s"],
    priceTier: "high",
    searchKeywords: ["ATON", "エイトン", "ATON knit", "上質 ベーシック"],
  },
  {
    name: "Lemaire",
    styleTags: ["フレンチミニマル", "ニュートラル", "ドレープ", "力の抜けた"],
    genreCandidates: ["ミニマル", "エフォートレス", "ミニマルモード"],
    cultureCandidates: ["パリ", "編集者/スタイリスト", "モデル私服(オフデューティ)"],
    itemStrengths: ["コート", "シャツ", "バッグ"],
    materialSignals: ["ウール", "コットン", "レザー"],
    colorSignals: ["ニュートラル", "ベージュ系", "低彩度"],
    silhouetteSignals: ["ドレープ", "ワイド", "Iライン"],
    eraSignals: ["2010s", "2020s"],
    priceTier: "luxury",
    searchKeywords: ["Lemaire", "ルメール", "Lemaire coat", "フレンチ ミニマル"],
  },
  {
    name: "Our Legacy",
    styleTags: ["北欧モダン", "ニュートラル", "アーティスティック", "きれいめ"],
    genreCandidates: ["ミニマルモード", "モード", "エフォートレス"],
    cultureCandidates: ["編集者/スタイリスト", "アーティスト/クリエイター", "モデル私服(オフデューティ)"],
    itemStrengths: ["シャツ", "アウター", "ニット"],
    materialSignals: ["コットン", "ウール", "レザー"],
    colorSignals: ["低彩度", "ニュートラル", "アースカラー"],
    silhouetteSignals: ["ワイド", "オーバーサイズ", "ボックス"],
    eraSignals: ["2010s", "2020s"],
    priceTier: "high",
    searchKeywords: ["Our Legacy", "アワーレガシー", "Our Legacy shirt", "北欧 モード"],
  },
  {
    name: "ADER ERROR",
    styleTags: ["韓国ストリート", "オーバーサイズ", "モノトーン", "差し色"],
    genreCandidates: ["韓国ストリート", "ミニマルストリート", "ストリート"],
    cultureCandidates: ["ソウル/弘大/江南", "K-POP私服/空港"],
    itemStrengths: ["スウェット", "アウター", "ニット"],
    materialSignals: ["コットン", "ナイロン", "ウール"],
    colorSignals: ["モノトーン", "低彩度", "差し色アクセント"],
    silhouetteSignals: ["オーバーサイズ", "ワイド", "ボックス"],
    eraSignals: ["2010s", "2020s"],
    priceTier: "high",
    searchKeywords: ["ADER ERROR", "アーダーエラー", "ADER", "韓国 ストリート"],
  },
  {
    name: "thisisneverthat",
    styleTags: ["韓国ストリート", "ロゴグラフィック", "カジュアル", "オーバーサイズ"],
    genreCandidates: ["韓国ストリート", "ストリート", "スポーツストリート"],
    cultureCandidates: ["ソウル/弘大/江南", "K-POP私服/空港", "スケーター"],
    itemStrengths: ["パーカー", "スウェット", "ナイロンジャケット"],
    materialSignals: ["コットン", "ナイロン", "フリース"],
    colorSignals: ["モノトーン", "アースカラー", "差し色アクセント"],
    silhouetteSignals: ["オーバーサイズ", "ワイド", "ボックス"],
    eraSignals: ["2010s", "2020s"],
    priceTier: "mid",
    searchKeywords: ["thisisneverthat", "ディスイズネバーザット", "韓国 ストリート", "thisisneverthat hoodie"],
  },
  {
    name: "UNDERCOVER",
    styleTags: ["裏原モード", "ダーク", "コンセプチュアル", "パンク"],
    genreCandidates: ["裏原系", "パンク", "モード"],
    cultureCandidates: ["東京/原宿", "パンク/ロック", "アーティスト/クリエイター"],
    itemStrengths: ["アウター", "カットソー", "ニット"],
    materialSignals: ["コットン", "ウール", "レザー"],
    colorSignals: ["モノトーン", "ダークトーン", "オールブラック"],
    silhouetteSignals: ["レイヤード", "オーバーサイズ", "Iライン"],
    eraSignals: ["1990s", "2000s"],
    priceTier: "high",
    searchKeywords: ["UNDERCOVER", "アンダーカバー", "UNDERCOVER jacket", "モード パンク"],
  },
  {
    name: "and wander",
    styleTags: ["日本アウトドア", "テック", "機能的", "ミニマル"],
    genreCandidates: ["ゴープコア", "アウトドア", "アーバンアウトドア"],
    cultureCandidates: ["登山家/アウトドア"],
    itemStrengths: ["シェル/マウンテンパーカー", "フリース", "バックパック"],
    materialSignals: ["ナイロン", "フリース", "化繊光沢"],
    colorSignals: ["低彩度", "アースカラー", "ニュートラル"],
    silhouetteSignals: ["ワイド", "オーバーサイズ", "レイヤード"],
    eraSignals: ["2010s", "2020s"],
    priceTier: "high",
    searchKeywords: ["and wander", "アンドワンダー", "and wander jacket", "ゴープコア"],
  },
  {
    name: "Goldwin",
    styleTags: ["機能美", "ミニマル", "テック", "アウトドア"],
    genreCandidates: ["アウトドア", "ゴープコア", "テックウェア"],
    cultureCandidates: ["登山家/アウトドア"],
    itemStrengths: ["シェルジャケット", "ダウン", "機能パンツ"],
    materialSignals: ["ナイロン", "フリース", "化繊光沢"],
    colorSignals: ["オールブラック", "低彩度", "ニュートラル"],
    silhouetteSignals: ["Iライン", "ワイド", "オーバーサイズ"],
    eraSignals: ["2010s", "2020s"],
    priceTier: "high",
    searchKeywords: ["Goldwin", "ゴールドウィン", "Goldwin jacket", "テックウェア"],
  },
  {
    name: "The North Face",
    styleTags: ["アウトドア定番", "機能的", "ストリート転用", "ロゴ"],
    genreCandidates: ["アウトドア", "ゴープコア", "アーバンアウトドア"],
    cultureCandidates: ["登山家/アウトドア"],
    itemStrengths: ["ヌプシダウン", "マウンテンパーカー", "フリース"],
    materialSignals: ["ナイロン", "フリース", "化繊光沢"],
    colorSignals: ["オールブラック", "アースカラー", "差し色アクセント", "ニュートラル"],
    silhouetteSignals: ["オーバーサイズ", "ボックス", "レイヤード"],
    eraSignals: ["2010s", "2020s"],
    priceTier: "mid",
    searchKeywords: ["The North Face", "ザノースフェイス", "ノースフェイス", "ヌプシ"],
  },
  {
    name: "Arc'teryx",
    styleTags: ["高機能", "テック", "ミニマル", "都市アウトドア"],
    genreCandidates: ["ゴープコア", "アウトドア", "テックウェア"],
    cultureCandidates: ["登山家/アウトドア"],
    itemStrengths: ["ハードシェル", "ウィンドシェル", "バックパック"],
    materialSignals: ["ナイロン", "化繊光沢", "フリース"],
    colorSignals: ["オールブラック", "低彩度", "ニュートラル"],
    silhouetteSignals: ["Iライン", "レイヤード"],
    eraSignals: ["2010s", "2020s"],
    priceTier: "high",
    searchKeywords: ["Arc'teryx", "アークテリクス", "Arcteryx jacket", "ゴープコア"],
  },
  {
    name: "Salomon",
    styleTags: ["トレイルシューズ", "ゴープコア", "テック", "機能"],
    genreCandidates: ["ゴープコア", "アウトドア", "アーバンアウトドア"],
    cultureCandidates: ["登山家/アウトドア"],
    itemStrengths: ["トレイルスニーカー", "シューズ"],
    materialSignals: ["ナイロン", "メッシュ", "化繊光沢"],
    colorSignals: ["オールブラック", "低彩度", "差し色アクセント", "ニュートラル"],
    silhouetteSignals: [],
    eraSignals: ["2010s", "2020s"],
    priceTier: "mid",
    searchKeywords: ["Salomon", "サロモン", "Salomon XT-6", "トレイルスニーカー"],
  },
  {
    name: "DIESEL",
    styleTags: ["Y2Kデニム", "ロゴ", "光沢", "タイト"],
    genreCandidates: ["Y2K/McBling", "Y2K/00sストリート", "ストリート"],
    cultureCandidates: ["クラブ/レイヴ/テクノ"],
    itemStrengths: ["デニム", "ロゴT", "アウター"],
    materialSignals: ["デニム", "レザー", "化繊光沢"],
    colorSignals: ["ビビッド", "差し色アクセント", "ダークトーン"],
    silhouetteSignals: ["タイト", "ジャストサイズ", "ワイド"],
    eraSignals: ["2000s", "2020s"],
    priceTier: "mid",
    searchKeywords: ["DIESEL", "ディーゼル", "Diesel denim", "Y2K デニム"],
  },
  {
    name: "HYSTERIC GLAMOUR",
    styleTags: ["ロックY2K", "グラフィック", "挑発的", "ガーリーロック"],
    genreCandidates: ["Y2K/McBling", "ロック", "ストリート"],
    cultureCandidates: ["東京/原宿", "パンク/ロック"],
    itemStrengths: ["グラフィックT", "デニム", "レザー"],
    materialSignals: ["デニム", "レザー", "コットン"],
    colorSignals: ["ビビッド", "差し色アクセント", "モノトーン", "ダークトーン"],
    silhouetteSignals: ["タイト", "ジャストサイズ", "上短め下太め"],
    eraSignals: ["1990s", "2000s"],
    priceTier: "mid",
    searchKeywords: ["HYSTERIC GLAMOUR", "ヒステリックグラマー", "ヒステリック", "ロックT"],
  },
  {
    name: "X-girl",
    styleTags: ["ガーリーストリート", "Y2K", "ロゴ", "スケート"],
    genreCandidates: ["Y2K/McBling", "Y2K/00sストリート", "ストリート"],
    cultureCandidates: ["東京/原宿", "スケーター"],
    itemStrengths: ["ロゴT", "ミニスカート", "スウェット"],
    materialSignals: ["コットン", "ナイロン", "デニム"],
    colorSignals: ["ビビッド", "差し色アクセント", "パステル", "モノトーン"],
    silhouetteSignals: ["上短め下太め", "タイト", "ワイド"],
    eraSignals: ["2000s", "2020s"],
    priceTier: "mid",
    searchKeywords: ["X-girl", "エックスガール", "X-girl tee", "Y2K ストリート"],
  },
  {
    name: "Ed Hardy",
    styleTags: ["McBling", "タトゥーグラフィック", "派手", "セレブY2K"],
    genreCandidates: ["Y2K/McBling", "ストリート"],
    cultureCandidates: ["LA", "クラブ/レイヴ/テクノ"],
    itemStrengths: ["タトゥーグラフィックT", "トラッカーキャップ", "デニム"],
    materialSignals: ["コットン", "デニム", "化繊光沢"],
    colorSignals: ["ビビッド", "差し色アクセント", "ダークトーン"],
    silhouetteSignals: ["タイト", "ジャストサイズ", "上短め下太め"],
    eraSignals: ["2000s"],
    priceTier: "mid",
    searchKeywords: ["Ed Hardy", "エドハーディー", "Ed Hardy tee", "McBling"],
  },
  {
    name: "Von Dutch",
    styleTags: ["McBling", "トラッカーキャップ", "セレブY2K", "派手"],
    genreCandidates: ["Y2K/McBling", "ストリート"],
    cultureCandidates: ["LA", "クラブ/レイヴ/テクノ"],
    itemStrengths: ["トラッカーキャップ", "グラフィックT", "デニム"],
    materialSignals: ["コットン", "デニム", "メッシュ"],
    colorSignals: ["ビビッド", "差し色アクセント", "モノトーン"],
    silhouetteSignals: ["タイト", "ジャストサイズ"],
    eraSignals: ["2000s"],
    priceTier: "low",
    searchKeywords: ["Von Dutch", "ヴォンダッチ", "Von Dutch cap", "McBling"],
  },
];
