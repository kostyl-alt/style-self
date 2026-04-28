import type { BodyProfile } from "@/types/index";

const BASE_VIRTUAL_COORDINATE_PROMPT = `
あなたは理想のコーデを設計するスタイリストです。
ユーザーの診断結果・好み・体型情報をもとに、シーンに合った「理想のコーデ5アイテム」を提案してください。
ユーザーは手持ち服がない前提で、これから買い揃えるアイテムを推薦します。

[絶対的なルール]
- 「諦めてください」「向いていません」は禁止。体型の悩みも必ず「こうすれば理想に近づける」で答える
- 抽象語禁止：世界観・存在感・余白・信念軸・静けさ・哲学・美意識・共鳴・構築感・絶妙・完璧・洗練
- 説明は「〇〇するとどう見える」の形式で書く
- 具体的なアイテム名・色・素材・丈・シルエットを使う
- ユーザーの未設定項目（身長・骨格・好み等）は無視して標準的な日本人体型を想定して提案する

[itemsの構成]
- 必ず5アイテム（多すぎず少なすぎず、トータルコーディネートとして成立する組み合わせ）
- role は "main" / "base" / "accent" のいずれか
  - main: コーデの主役（1〜2個）
  - base: 土台となる定番アイテム（2〜3個）
  - accent: 差し色・小物（0〜2個）
- category は次のいずれか: tops, bottoms, outerwear, jacket, vest, inner, dress, setup, shoes, bags, accessories, hat, jewelry

[各アイテムのフィールド]
- name: 表示用のシンプル商品名 15字以内（例：「白リネンシャツ」「黒ワイドパンツ」「ベージュトレンチコート」）
- color: 色名（例：「ホワイト」「ブラック」「ベージュ」）
- reason: なぜこのアイテムか・どう着るか 40字以内（「〇〇するとどう見える」の形式）
- zozoKeyword: ZOZOTOWNで実際に検索したときヒットしやすいシンプルなキーワード15字以内
  - name と同じか更にシンプル化したもの（例：name=「白リネンシャツ」→ zozoKeyword=「リネンシャツ」または「白リネンシャツ」）
  - 素材説明・色説明・丈・シルエットの羅列は禁止
  - 一般名詞のみ（ブランド名禁止）

[conceptの書き方]
- このコーデ全体のコンセプトを一行で表現（30字以内）
- 例：「シルエットで遊ぶ静かな黒コーデ」「肌見せ最小で重心を上げる縦長ライン」
- 抽象語は最小限にし、具体的な要素（色・形・比率）を含める

[stylingTipsの書き方]
- 着こなしのポイント3点
- 「〇〇すると〇〇に見える」の形式
- 優先度の高い順に並べる
- 各40字以内

以下のJSON形式で必ず返答してください（Markdownコードブロックは付けない）：
{
  "scene":      "（受け取ったscene値をそのまま）",
  "concept":    "（コーデのコンセプト、30字以内）",
  "items": [
    {
      "role":        "main",
      "category":    "tops",
      "name":        "（商品名、15字以内）",
      "color":       "（色名）",
      "reason":      "（なぜこのアイテムか、40字以内）",
      "zozoKeyword": "（検索キーワード、15字以内）"
    }
  ],
  "stylingTips": [
    "（ポイント1、40字以内）",
    "（ポイント2、40字以内）",
    "（ポイント3、40字以内）"
  ]
}
`.trim();

export function buildVirtualCoordinatePrompt(
  scene: string,
  bodyProfile?: BodyProfile | null,
  stylePreference?: Record<string, unknown> | null,
  styleAnalysis?: Record<string, unknown> | null,
  worldview?: Record<string, unknown> | null,
): string {
  const sections: string[] = [BASE_VIRTUAL_COORDINATE_PROMPT];

  sections.push(`\n\n[今回のシーン]\n${scene}`);

  if (bodyProfile) {
    const lines: string[] = ["[ユーザーの体型情報]"];
    lines.push(`身長: ${bodyProfile.height}cm`);
    if (bodyProfile.weight)        lines.push(`体重: ${bodyProfile.weight}kg`);
    lines.push(`体型: ${bodyProfile.bodyType} / 骨格: ${bodyProfile.skeletonType}`);
    if (bodyProfile.concerns.length) {
      const concernLabels: Record<string, string> = {
        looks_young:     "子どもっぽく見える",
        short_legs:      "脚が短く見える",
        broad_shoulders: "肩幅が広い",
        wide_hips:       "腰回りが気になる",
        short_torso:     "胴が短い",
        top_heavy:       "上半身が重い",
        bottom_heavy:    "下半身が重い",
      };
      lines.push(`悩み: ${bodyProfile.concerns.map((c) => concernLabels[c] ?? c).join("・")}`);
    }
    if (bodyProfile.proportionNote) lines.push(`補足: ${bodyProfile.proportionNote}`);
    sections.push(`\n\n${lines.join("\n")}`);
  }

  if (stylePreference) {
    const pref = stylePreference as Record<string, string[]>;
    const lines: string[] = ["[ユーザーの好み]"];
    if (pref.likedVibes?.length)         lines.push(`好きな雰囲気: ${pref.likedVibes.join("・")}`);
    if (pref.dislikedVibes?.length)      lines.push(`苦手な雰囲気: ${pref.dislikedVibes.join("・")}`);
    if (pref.likedColors?.length)        lines.push(`好きな色: ${pref.likedColors.join("・")}`);
    if (pref.likedMaterials?.length)     lines.push(`好きな素材: ${pref.likedMaterials.join("・")}`);
    if (pref.likedSilhouettes?.length)   lines.push(`好きなシルエット: ${pref.likedSilhouettes.join("・")}`);
    if (pref.targetImpressions?.length)  lines.push(`与えたい印象: ${pref.targetImpressions.join("・")}`);
    if (pref.ngElements?.length)         lines.push(`NGな要素: ${pref.ngElements.join("・")}`);
    if (lines.length > 1) sections.push(`\n\n${lines.join("\n")}`);
  }

  if (styleAnalysis) {
    const analysis = styleAnalysis as Record<string, unknown>;
    const lines: string[] = ["[スタイル診断結果]"];
    if (analysis.plainType)        lines.push(`タイプ: ${analysis.plainType}`);
    if (analysis.plainSummary)     lines.push(`診断まとめ: ${analysis.plainSummary}`);
    if (Array.isArray(analysis.recommendedColors) && analysis.recommendedColors.length)
      lines.push(`推奨色: ${(analysis.recommendedColors as string[]).join("・")}`);
    if (Array.isArray(analysis.recommendedMaterials) && analysis.recommendedMaterials.length)
      lines.push(`推奨素材: ${(analysis.recommendedMaterials as string[]).join("・")}`);
    if (Array.isArray(analysis.recommendedSilhouettes) && analysis.recommendedSilhouettes.length)
      lines.push(`推奨シルエット: ${(analysis.recommendedSilhouettes as string[]).join("・")}`);
    if (lines.length > 1) sections.push(`\n\n${lines.join("\n")}`);
  }

  if (worldview) {
    const lines: string[] = ["[世界観・信念]"];
    lines.push(JSON.stringify(worldview));
    sections.push(`\n\n${lines.join("\n")}`);
  }

  return sections.join("");
}
