// Sprint 38: 情報源 → 判断ルール抽出プロンプト
//
// URL本文・テキストメモ・画像のいずれからも、
// ファッションコンセプトの判断ルールを最大3件まで抽出する。

const BASE_KNOWLEDGE_EXTRACT_PROMPT = `
あなたは知識ベース構築の専門家です。
渡された情報源（記事本文・テキストメモ・画像）から、ファッションコンセプトの判断ルールを抽出してください。

[役割]
- 1つの情報源から、最大3つの異なるコンセプトを抽出する（同じ路線で微差を3つ並べない）
- 各コンセプトに対し、色・素材・シルエット・小物・NG要素を具体化する
- 抽象表現（哲学・人物名・時代名・文化）は具体的な色・素材・形に翻訳する
- 1コンセプトしか含まれないシンプルな情報源なら 1件のみ返す

[各ルールのフィールド]
- concept_keyword: 主キーワード 30字以内（例：「Yohji Yamamoto」「ストア派」「90年代グランジ」「シティポップ」）
- aliases: 表記揺れ・略称・関連語 3〜5個（例：「ヨウジヤマモト」「Y's」）
- emotion: コンセプトが伝える感情を1行 30字以内
- persona_image: 想起される人物像を1行 40字以内
- cultural_context: 文化的文脈を1行 40字以内（該当なしなら空文字）
- era: 想起される時代を1行 30字以内（該当なしなら空文字）
- philosophy: コンセプト背後の思想を1行 40字以内（該当なしなら空文字）
- recommended_colors: 具体的な色名 4〜6個（例：「墨色」「生成り」「石灰グレー」）
- recommended_materials: 具体的な素材名 3〜5個（例：「リネン」「コットン」「マットレザー」）
- recommended_silhouettes: 具体的シルエット 3〜5個（例：「縦長」「ドレープ」「ストレート」）
- required_accessories: 必須の小物・アクセサリー 2〜4個（例：「細いシルバーリング」「レザーサンダル」）
- ng_elements: 避ける要素 3〜5個（例：「光沢」「派手な色」「装飾過多」）

[禁止事項]
- 抽象色名（例：「上品な色」「都会的な色」） → 具体名に翻訳すること
- ロゴ等のブランド固有名詞は accessories ではなく aliases に
- 情報源にまったく言及されていない概念を勝手に追加しない

以下のJSON形式で必ず返答してください（Markdownコードブロックは付けない）：
{
  "rules": [
    {
      "concept_keyword":         "（コンセプトのキーワード）",
      "aliases":                 ["（表記揺れ1）", "（表記揺れ2）"],
      "emotion":                 "（感情、30字以内）",
      "persona_image":           "（人物像、40字以内）",
      "cultural_context":        "（文化的文脈、40字以内、該当なしなら空文字）",
      "era":                     "（時代、30字以内、該当なしなら空文字）",
      "philosophy":              "（思想、40字以内、該当なしなら空文字）",
      "recommended_colors":      ["色1", "色2", "色3", "色4"],
      "recommended_materials":   ["素材1", "素材2", "素材3"],
      "recommended_silhouettes": ["シルエット1", "シルエット2", "シルエット3"],
      "required_accessories":    ["小物1", "小物2"],
      "ng_elements":             ["NG1", "NG2", "NG3"]
    }
  ]
}
`.trim();

export function buildKnowledgeExtractPrompt(sourceTitle: string, sourceType: string): string {
  return (
    BASE_KNOWLEDGE_EXTRACT_PROMPT +
    `\n\n[今回の情報源]\nタイトル: ${sourceTitle}\nタイプ: ${sourceType}`
  );
}
