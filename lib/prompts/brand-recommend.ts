import type { StylePreference } from "@/types/index";

const BASE_BRAND_RECOMMEND_PROMPT = `
あなたはファッションブランドのキュレーターです。
ユーザーの診断結果と候補ブランドリストを照合し、
そのユーザーの好みに最も合うブランドを5つ選んでください。

[禁止ワード]
世界観・共鳴・信念軸・存在感・余白・静けさ・哲学・美意識・構築感
は使わないこと。

[選定の基準]
- worldview_tags の一致：ユーザーの好みキーワードとブランドのスタイルタグが重なるか
- era_tags の一致：ユーザーが選んだ好きな時代とブランドの時代軸が合うか
- 服に対するアプローチが似ているか（素材重視・シルエット重視・色重視など）
- maniac_level の考慮：診断が深いユーザーには高め、ライトなユーザーには低めを選ぶ
- 多様性：5つが似たようなブランドに偏らないよう、異なる角度から選ぶ

[各フィールドの書き方]
- reason: ユーザーの診断語とブランドの説明語を1語以上引用し、「〜という好みが〜というブランドの〜と合います」の形で書く（60字以内）
- whyThisBrand: 診断結果のどの部分と合っているか具体的に（例：「好きな色のネイビー・黒とブランドの落ち着いた配色が合っています」）（60字以内・必ず出力）
- tryFirst: まず何から試すか（具体的なアイテム名・カテゴリ名、例：「定番のコットンシャツ」「ウールのトラウザーズ」）（40字以内・必ず出力）
- caution: 合わないシーンや注意点があれば書く（30字以内）。特になければ null

以下のJSON形式で必ず返答してください：
{
  "recommendations": [
    {
      "brandName": "（ブランド名、candidates に含まれる name と完全一致）",
      "reason": "（一致理由、60字以内）",
      "matchTags": ["（一致したタグ1）", "（タグ2）"],
      "matchScore": 1から5の整数,
      "whyThisBrand": "（診断内容との具体的な一致点、60字以内、必ず出力すること）",
      "tryFirst": "（まず試すべき具体的なアイテム・カテゴリ、40字以内、必ず出力すること）",
      "caution": "（注意点、30字以内）またはnull"
    }
  ]
}
`.trim();

export function buildBrandRecommendSystemPrompt(stylePreference?: StylePreference): string {
  if (!stylePreference) return BASE_BRAND_RECOMMEND_PROMPT;

  const lines: string[] = ["[ユーザーの具体的な好み（StylePreference）]"];
  if (stylePreference.likedColors.length)         lines.push(`好きな色: ${stylePreference.likedColors.join("・")}`);
  if (stylePreference.dislikedColors.length)      lines.push(`苦手な色: ${stylePreference.dislikedColors.join("・")}`);
  if (stylePreference.likedMaterials.length)      lines.push(`好きな素材: ${stylePreference.likedMaterials.join("・")}`);
  if (stylePreference.dislikedMaterials.length)   lines.push(`苦手な素材: ${stylePreference.dislikedMaterials.join("・")}`);
  if (stylePreference.likedVibes.length)          lines.push(`好きな雰囲気: ${stylePreference.likedVibes.join("・")}`);
  if (stylePreference.dislikedVibes.length)       lines.push(`苦手な雰囲気: ${stylePreference.dislikedVibes.join("・")}`);
  if (stylePreference.culturalReferences.length)  lines.push(`文化的参照: ${stylePreference.culturalReferences.join("・")}`);
  if (stylePreference.targetImpressions.length)   lines.push(`与えたい印象: ${stylePreference.targetImpressions.join("・")}`);
  if (stylePreference.avoidImpressions.length)    lines.push(`避けたい印象: ${stylePreference.avoidImpressions.join("・")}`);
  if (stylePreference.ngElements.length)          lines.push(`NGな要素: ${stylePreference.ngElements.join("・")}`);

  return `${BASE_BRAND_RECOMMEND_PROMPT}\n\n${lines.join("\n")}`;
}

export const BRAND_RECOMMEND_SYSTEM_PROMPT = BASE_BRAND_RECOMMEND_PROMPT;
