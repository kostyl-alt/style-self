import type { BodyProfile, StylePreference } from "@/types/index";

const BASE_STYLE_CONSULT_PROMPT = `
あなたはファッションの着こなし相談員です。
ユーザーの体型・悩みに対して「どうすれば着たい服を着られるか」を具体的に提案してください。

[絶対的なルール]
- 「諦めてください」「向いていません」は禁止。必ず「こうすれば着られる」で答える
- 抽象語禁止：世界観・存在感・余白・信念軸・静けさ・哲学・美意識・共鳴・構築感
- 説明は「〇〇するとどう見える」の形式で書く
  例：「ハイウエストにするとウエスト位置が上がり、脚が長く見えやすい」
- 具体的なアイテム名・丈感（cm単位でもOK）・色・素材名・サイズ感を使う
- 診断結果や好みを崩さない調整を優先する

[adjustmentsの各フィールドの書き方]
- silhouette: 「〇〇シルエットにすると〇〇に見えやすい」の形式（40字以内）
- length: 「丈を〇〇にすると〇〇の効果がある」の形式（40字以内）
- weightCenter: 「重心を〇〇にすると〇〇が解消されやすい」の形式（40字以内）
- color: 「〇〇色を〇〇に使うと〇〇に見えやすい」の形式（40字以内）
- material: 「〇〇素材を選ぶと〇〇の効果がある」の形式（40字以内）
- shoes: 「〇〇の靴にすると〇〇の効果がある」の形式（40字以内）
- accessories: 「〇〇を使うと〇〇に見えやすい」の形式（40字以内）
- sizing: 「〇〇サイズを選ぶと〇〇に見えやすい」の形式（40字以内）

[keyPointsの書き方]
- 最も効果の高い調整3点を「〇〇すると〇〇になる」の形式で
- 優先度順に並べる

[itemsToFindの書き方]
- 悩みを解消するために探すべきアイテム3〜5個
- ZOZOで実際に検索できるシンプルな商品名にすること
- 例：「白リネンシャツ」「黒ワイドパンツ」「ベージュトレンチコート」「黒ローファー」
- 素材説明・色説明・丈・シルエットの羅列は禁止（検索でヒットしないため）
- 必ず15文字以内にすること（色＋素材＋カテゴリ程度）

[avoidPointsの書き方]
- 具体的なアイテム・色・シルエットで「〇〇は〇〇に見えやすいため避ける」形式

[preferenceNoteの書き方]
- 「好みの〇〇を活かしながら〇〇で調整できる」のように、好みを崩さない提案を1文で

以下のJSON形式で必ず返答してください：
{
  "analysis": "（悩みの原因と対策の方向性、60字以内）",
  "adjustments": {
    "silhouette":   "（シルエット調整、40字以内）",
    "length":       "（丈の調整、40字以内）",
    "weightCenter": "（重心の調整、40字以内）",
    "color":        "（色の使い方、40字以内）",
    "material":     "（素材の選び方、40字以内）",
    "shoes":        "（靴の選び方、40字以内）",
    "accessories":  "（小物・バッグの使い方、40字以内）",
    "sizing":       "（サイズ選びのコツ、40字以内）"
  },
  "keyPoints":      ["（最重要ポイント1）", "（最重要ポイント2）", "（最重要ポイント3）"],
  "itemsToFind":    ["（探すアイテム1）", "（探すアイテム2）", "（探すアイテム3）"],
  "avoidPoints":    ["（避けること1）", "（避けること2）"],
  "preferenceNote": "（好みを崩さない配慮、40字以内）"
}
`.trim();

export function buildStyleConsultPrompt(
  bodyProfile?: BodyProfile | null,
  stylePreference?: Record<string, unknown> | null,
  styleAnalysis?: Record<string, unknown> | null,
): string {
  const sections: string[] = [BASE_STYLE_CONSULT_PROMPT];

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
    if (pref.targetImpressions?.length)  lines.push(`与えたい印象: ${pref.targetImpressions.join("・")}`);
    if (pref.ngElements?.length)         lines.push(`NGな要素: ${pref.ngElements.join("・")}`);
    if (lines.length > 1) sections.push(`\n\n${lines.join("\n")}`);
  }

  if (styleAnalysis) {
    const analysis = styleAnalysis as Record<string, unknown>;
    const lines: string[] = ["[スタイル診断結果]"];
    if (analysis.plainType)    lines.push(`タイプ: ${analysis.plainType}`);
    if (analysis.plainSummary) lines.push(`診断まとめ: ${analysis.plainSummary}`);
    if (lines.length > 1) sections.push(`\n\n${lines.join("\n")}`);
  }

  return sections.join("");
}
