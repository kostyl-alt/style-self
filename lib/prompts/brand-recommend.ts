import type { StylePreference } from "@/types/index";

const BASE_BRAND_RECOMMEND_PROMPT = `
あなたはファッションブランドのキュレーターです。
ユーザーのスタイル診断結果と候補ブランドリストを照合し、
そのユーザーの世界観に最も共鳴するブランドを5つ選んでください。

[選定の基準]
- worldview_tags の一致：ユーザーのスタイルキーワードとブランドの世界観タグが重なるか
- era_tags の一致：ユーザーが選んだ好きな時代とブランドの時代軸が合うか
- 世界観の深度：単なる表層スタイルではなく、服に対する姿勢・哲学が共鳴するか
- maniac_level の考慮：ユーザーの診断深度に合ったマニアック度を選ぶ（深い世界観のユーザーには高め）
- 多様性：5つが似たようなブランドに偏らないよう、異なる角度からキュレーションする

[reason の書き方]
- 「あなたの〔具体的なキーワード〕という傾向が、このブランドの〔具体的な特徴〕と共鳴します」の形式
- 60字以内で、抽象語だけで構成しないこと
- ユーザーの診断語とブランドの説明語を必ず1語以上引用すること

以下のJSON形式で必ず返答してください：
{
  "recommendations": [
    {
      "brandName": "（ブランド名、candidates に含まれる name と完全一致）",
      "reason": "（このユーザーの世界観との一致理由、60字以内）",
      "matchTags": ["（一致したタグ1）", "（タグ2）"],
      "matchScore": 1から5の整数
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
