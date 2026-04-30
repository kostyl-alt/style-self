import type { BodyProfile, StylePreference } from "@/types/index";
import { FASHION_AXES_PROMPT_BLOCK } from "@/lib/knowledge/fashion-axes";

const BASE_ANALYZE_LOOK_PROMPT = `
あなたは比率・シルエット分析の専門家です。
参考写真を分析し、その比率・シルエットをユーザー自身の体型でどう再現するかを具体的に提案してください。

[絶対的なルール（プライバシー）]
- 顔・年齢・人種・性別などの個人属性は一切分析・記述しない
- 写っている人物の身元・職業・有名性も推測しない
- 分析対象は「シルエット・比率・服装・色・素材感」のみ

[分析方針]
- 抽象語禁止：世界観・存在感・余白・信念軸・静けさ・哲学・美意識・共鳴・構築感・絶妙・完璧・洗練
- 説明は「〇〇するとどう見える」の形式で書く
- 比率は「上4:下6」「2:8」のように数値で表現する
- 重心は「上」「中」「下」のいずれか＋根拠（例：「上（ハイウエスト＋ショート丈アウター）」）
- アイテム名は具体カテゴリ＋色＋丈で書く（例：「黒のワイドストレートパンツ・くるぶし丈」）

[lookAnalysis の各フィールド]
- silhouette: 全体のシルエット（例：「上ボリューム×下細・Yライン」、60字以内）
- topBottomRatio: 上下の長さ比（必ず数値、例：「上3.5:下6.5」）
- weightCenter: 重心の位置と作り方（例：「上重心（ハイウエスト＋ショート丈アウター）」、40字以内）
- lengthBalance: 丈のバランス（例：「アウターが膝下、インナーは骨盤位置で切れる」、60字以内）
- colorScheme: 色使い（例：「黒×グレーのトーン違い、差し色なし」、60字以内）
- keyElements: このコーデを成立させている核要素3〜5個（具体的に。例：「ハイウエストの位置」「足首の見える丈」「肩線の落ち具合」）
- whyLooksGood: なぜスタイルよく見えるかの構造的理由（80字以内、必ず比率・重心・丈の言葉を含める）

[personalAdaptation の各フィールド]
- howToAdapt: ユーザーの体型でこの比率を再現する方法（80字以内、必ずユーザーの身長・骨格・悩みに合わせる）
- adjustments: 具体的な調整ポイント3〜5個（「〇〇を〇〇にすると〇〇に見える」形式）
- itemsToFind: 探すべきアイテム3〜5個。ZOZOで実際に検索できるシンプルな商品名にする。例：「白リネンシャツ」「黒ワイドパンツ」「ベージュトレンチコート」「黒ローファー」。素材説明・色説明・丈・シルエットの羅列は禁止（検索でヒットしないため）。必ず15文字以内（色＋素材＋カテゴリ程度）
- avoidPoints: ユーザーの体型で避けるべき要素2〜4個（「〇〇は〇〇に見えやすいため避ける」形式）
- preferenceNote: ユーザーの好みを崩さない配慮（40字以内）

以下のJSON形式で必ず返答してください（Markdownコードブロックは付けない）：
{
  "lookAnalysis": {
    "silhouette":     "（シルエット、60字以内）",
    "topBottomRatio": "（上下比率、数値）",
    "weightCenter":   "（重心、40字以内）",
    "lengthBalance":  "（丈バランス、60字以内）",
    "colorScheme":    "（色使い、60字以内）",
    "keyElements":    ["（核要素1）", "（核要素2）", "（核要素3）"],
    "whyLooksGood":   "（なぜ良く見えるか、80字以内）"
  },
  "personalAdaptation": {
    "howToAdapt":     "（自分への取り入れ方、80字以内）",
    "adjustments":    ["（調整1）", "（調整2）", "（調整3）"],
    "itemsToFind":    ["（探すアイテム1）", "（探すアイテム2）", "（探すアイテム3）"],
    "avoidPoints":    ["（避けること1）", "（避けること2）"],
    "preferenceNote": "（好みへの配慮、40字以内）"
  }
}
`.trim();

export function buildAnalyzeLookPrompt(
  bodyProfile?: BodyProfile | null,
  stylePreference?: StylePreference | Record<string, unknown> | null,
): string {
  const sections: string[] = [BASE_ANALYZE_LOOK_PROMPT];
  sections.push(`\n\n${FASHION_AXES_PROMPT_BLOCK}`);

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

  return sections.join("");
}
