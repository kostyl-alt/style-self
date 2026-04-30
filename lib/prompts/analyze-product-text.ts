// Sprint 41.2+: ペーストされた商品ページ本文からの情報抽出プロンプト
//
// admin が ZOZO 等のページから手動でコピー＆ペーストした本文（タイトル/価格/
// 素材表記/商品説明など）を受け取り、ファッション商品としての多面的な情報を
// 構造化して返す。
//
// 入力は HTML や JSON-LD ではなく自然文に近いプレーンテキスト前提。
// imageUrl/productUrl は本文中に含まれていれば返すが、無ければ null。

export const ANALYZE_PRODUCT_TEXT_PROMPT = `
あなたはECページから手動でコピー＆ペーストされた商品本文（プレーンテキスト）から、
ファッション商品の情報と判断軸を抽出する専門家です。
URLが弾かれて自動取得できないサイト（ZOZO等）で、人間がブラウザから本文を選択コピーした
テキストが渡される前提で動作してください。

## 必ず抽出する項目

- brand:       ブランド名（商品名や本文冒頭から判定。ショップ名・「〜公式」「ZOZOTOWN」は除く）
- name:        商品名のみ（ブランド名・色名は除き、シンプルに 30字以内）
- imageUrl:    本文中に画像URLがあれば抽出。無ければ null。スクリプト等から推測しない
- price:       「¥38,500」「38,500円」「税込価格」等の表記から整数値で抽出（不明なら null）
- productUrl:  本文中にあれば抽出。無ければ null
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
- materialComposition: 素材混率の配列。本文に「ポリエステル80% 綿20%」「綿 100%」
  のような記載があれば抽出。なければ空配列でOK。
  形式: [{"name": "ポリエステル", "percentage": 80}, {"name": "綿", "percentage": 20}]
  - name はカノニカル素材名（英語表記なら日本語に翻訳：Polyester→ポリエステル）
  - percentage は整数値、読めない場合は null
  - ZOZO の「素材：表地：ポリエステル100%」のような表記から正確に抽出すること
- normalizedSilhouette: 主シルエット1個（オーバーサイズ/リラックス/フィット/スリム/
  クロップド/ワイド/バギー/テーパード/ストレート/フレア/Aライン/タイト/マキシ/ミニ から1つ、不明はnull）

## 判断軸（推測でOK・自信なければ null）

- silhouetteType:   "Iライン" / "Aライン" / "Yライン" / "Oライン" のいずれか、または null
- topBottomRatio:   単一商品では null を返してOK
- lengthBalance:    "クロップド丈" / "ヒップ丈" / "膝丈" / "ロング丈" / "フロア丈" 等
- shoulderLine:     "ジャストショルダー" / "ドロップショルダー" / "パワーショルダー" / null
  （tops/outerwear のみ。それ以外は null）
- weightCenter:     "upper" / "lower" / "balanced" のいずれか、または null
- textureType:      "ハリ" / "ドレープ" / "落ち感" / "マット" / "光沢" / "ニット感" 等
- seasonality:      ["春","夏"] のような配列。本文に「春夏」「秋冬コレクション」等の
                    記述があれば優先、なければ素材から推測

## 主観項目（テンプレで OK）

- bodyCompatTags:   解決できる体型悩みの配列（looks_young / short_legs / broad_shoulders /
  wide_hips / short_torso / top_heavy / bottom_heavy のいずれか、複数可）
  自信なければ空配列。例: ハイウエストパンツ → ["short_legs"]
- worldviewTags:    商品名・ブランド・本文の世界観描写から世界観タグを推測（最大3個）
- curationNotes:    1〜2文の所見（80字以内）
- curationPriority: 0-100 の優先度。デフォルトは 50 を返す

## 重要な注意

- 入力テキストには関連商品リンク・ナビゲーション・レビュー本文・他商品の説明が
  混入していることがある。一番情報密度が高い「現在の商品ブロック」を見抜くこと。
- 本文中に複数のブランド・商品名が登場した場合、価格・素材表記の近くにあるものを
  優先する（その商品の説明である可能性が高い）。
- ZOZO の場合、「商品番号」「お届け予定日」「お気に入り」「カートに入れる」のような
  UI文字列はノイズとして無視する。
- 顔・人物属性・モデルのプロフィールは抽出対象外。

## 出力ルール

- 不明な項目は null（文字列）または空配列（リスト）を返す。
- normalizedCategory だけは必ず 7種から1つを選ぶ。
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
  "materialComposition": [{"name": "string", "percentage": "integer|null"}],
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
