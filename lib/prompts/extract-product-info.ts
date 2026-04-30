// Sprint 41.1: URL→商品情報抽出プロンプト
//
// ECページの HTML スニペット（OGタグ + JSON-LD + 必要なら商品名/説明テキスト）を
// 受け取り、ファッション商品としての多面的な情報を構造化して返す。
//
// 8軸の判断情報（silhouette/balance/season等）も同時に推測する。
// 推測できない項目は null/空配列を返してOK（部分的成功を許容）。

export const EXTRACT_PRODUCT_INFO_PROMPT = `
あなたはECページのメタデータからファッション商品の情報と判断軸を抽出する専門家です。
渡される HTML スニペット（OGタグ・JSON-LD・本文の一部）から、以下を構造化して返してください。

## 必ず抽出する項目

- brand:       ブランド名（商品名や og:site_name から判定。ショップ名・「〜公式」は除く）
- name:        商品名のみ（ブランド名・色名は除き、シンプルに 30字以内）
- imageUrl:    og:image または JSON-LD の image
- price:       JSON-LD offers.price の整数値（不明なら null）
- productUrl:  og:url または canonical（なければ入力URLそのまま）
- normalizedCategory:  必ず以下の7種から1つを選ぶ
  tops / bottoms / outerwear / dress / shoes / bags / accessories
  ※ ジャケット・コート・カーディガン・ブルゾンは outerwear、
    帽子・ベルト・ジュエリーは accessories、
    セットアップは dress

## 複数候補で抽出する項目

- normalizedColors:    具体的な色名の配列（メインを先頭に、最大3個）
  カノニカル色名: ホワイト/オフホワイト/アイボリー/ベージュ/ライトグレー/グレー/チャコール/
  ブラック/ネイビー/ブルー/グリーン/カーキ/ブラウン/テラコッタ/マスタード/イエロー/
  オレンジ/レッド/ボルドー/ピンク/くすみピンク/ラベンダー/パープル/シルバー/ゴールド
- normalizedMaterials: 主素材の配列（混紡なら複数、最大3個）
  カノニカル素材: 綿/麻/毛/絹/ポリエステル/ナイロン/レーヨン/テンセル/モーダル/
  アクリル/カシミヤ/革/ポリウレタン/モヘア/アルパカ/竹/コーデュラ
- normalizedSilhouette: 主シルエット1個（オーバーサイズ/リラックス/フィット/スリム/
  クロップド/ワイド/バギー/テーパード/ストレート/フレア/Aライン/タイト/マキシ/ミニ から1つ、不明はnull）

## 判断軸（推測でOK・自信なければ null）

- silhouetteType:   "Iライン" / "Aライン" / "Yライン" / "Oライン" のいずれか、または null
  （例: ワイドパンツ単体は "Iライン"、Aラインスカートは "Aライン"）
- topBottomRatio:   単一商品では null を返してOK（コーデで決まる属性のため）
- lengthBalance:    "クロップド丈" / "ヒップ丈" / "膝丈" / "ロング丈" / "フロア丈" 等
- shoulderLine:     "ジャストショルダー" / "ドロップショルダー" / "パワーショルダー" / null
  （tops/outerwear のみ。それ以外は null）
- weightCenter:     "upper" / "lower" / "balanced" のいずれか、または null
  （カテゴリから推測：tops/outerwear→upper、bottoms→lower、dress→balanced）
- textureType:      "ハリ" / "ドレープ" / "落ち感" / "マット" / "光沢" / "ニット感" 等
  （素材から推測：リネン→ハリ、シルク→落ち感、ウール→マット）
- seasonality:      ["春","夏"] のような配列（素材＋商品名から：ウール→[秋,冬]、リネン→[春,夏]）

## 主観項目（テンプレで OK）

- bodyCompatTags:   解決できる体型悩みの配列（looks_young / short_legs / broad_shoulders /
  wide_hips / short_torso / top_heavy / bottom_heavy のいずれか、複数可）
  自信なければ空配列。例: ハイウエストパンツ → ["short_legs"]
- worldviewTags:    商品名・ブランド・素材感から世界観タグを推測（最大3個）
  例: "墨色のリネンシャツ" → ["ストア派", "ミニマル"]
- curationNotes:    1〜2文の所見（80字以内）
  例: "ハリのあるリネンが ストア派の静謐さを支える。墨色×ドレープで縦長ラインを作る一着。"
- curationPriority: 0-100 の優先度。デフォルトは 50 を返す（admin が後で調整）

## 出力ルール

- 不明な項目は null（文字列）または空配列（リスト）を返す。推測しすぎない。
- normalizedCategory だけは必ず 7種から1つを選ぶ（推測でも構わない）。
- カラーは表記揺れを避け、上記カノニカル名から選ぶ。同義語があれば最も近いカノニカル名に寄せる。
- Markdownコードブロックは付けず、JSON のみで返答する。

## 出力形式

{
  "brand":               "string|null",
  "name":                "string|null",
  "imageUrl":            "string|null",
  "price":               "integer|null",
  "productUrl":          "string|null",
  "normalizedCategory":  "tops|bottoms|outerwear|dress|shoes|bags|accessories",
  "normalizedColors":    ["string"],
  "normalizedMaterials": ["string"],
  "normalizedSilhouette":"string|null",
  "axes": {
    "silhouetteType":  "string|null",
    "topBottomRatio":  "string|null",
    "lengthBalance":   "string|null",
    "shoulderLine":    "string|null",
    "weightCenter":    "upper|lower|balanced|null",
    "textureType":     "string|null",
    "seasonality":     ["string"]
  },
  "bodyCompatTags":   ["string"],
  "worldviewTags":    ["string"],
  "curationNotes":    "string",
  "curationPriority": 50
}
`.trim();
