// Stage 1: コンセプト翻訳プロンプト（Sprint 36 v1.2 新規）
//
// ユーザーが入力する抽象的・文化的・哲学的なコンセプト（例：「マルクス・アウレリウスの休日」
// 「Yohji Yamamoto の哲学」「静かな大人っぽさ」など）を、ファッションの具体要素
// （色・素材・シルエット・小物・NG）に翻訳することに専念するプロンプト。
//
// このステージでは「抽象語禁止」のルールは外す（むしろ翻訳の入口として歓迎）。
// 後段の Stage 3 でこの翻訳結果を厳格な制約として使う。

import type { BodyProfile } from "@/types/index";
import { getSeasonContext } from "@/lib/utils/season";

const BASE_CONCEPT_TRANSLATE_PROMPT = `
あなたはファッションコンセプトの翻訳専門家です。
ユーザーから渡される抽象的・文化的・哲学的なコンセプトを、ファッションの具体要素（色・素材・シルエット・小物・NG）に分解してください。

[役割と方針]
- 抽象表現・哲学的引用・人物名・時代名は歓迎する（読み解いて具体化することがあなたの仕事）
- 例：「マルクス・アウレリウスの休日」→ ストア哲学、古代ローマの石造、内省、静謐 → 墨色・生成り・リネン・ドレープ・サンダル
- 例：「Yohji Yamamoto」→ 黒の哲学・解体・非対称・余白 → 黒・ウール・ドレープ・ブーツ
- 例：「シンプルで動きやすい休日」→ 機能性・気楽さ → ネイビー・コットン・ストレート・スニーカー
- 季節と矛盾する要素は推奨に含めない（例：夏に厚手ウール、冬にサマーリネン）
- ユーザーの体型悩みも踏まえた推奨にする

[各フィールドの書き方]
- keywords: コンセプトを構成するキーワード3〜5個（抽象でも具体でも可。例：「静謐」「古代ローマ」「孤独」「思想」）
- emotion: コンセプトが伝える感情を1行 30字以内（例：「落ち着き／内省／自己との対話」）
- personaImage: 想起される人物像を1行 40字以内（例：「石造りの広場を歩く思想家」）
- culture: 文化的文脈を1行 40字以内（例：「ストア哲学・古代ローマ」）。該当なしなら空文字
- era: 想起される時代を1行 30字以内（例：「古代〜現代の連続性」）。該当なしなら空文字
- philosophy: コンセプト背後の思想を1行 40字以内（例：「外界に依らない自己」）。該当なしなら空文字
- recommendedColors: 具体的な色名 4〜6個（抽象禁止・必ず具体名。例：「墨色」「生成り」「石灰グレー」「土色」「オフホワイト」）
- recommendedMaterials: 具体的な素材名 3〜5個（例：「リネン」「コットン」「マットレザー」「シルク」）
- recommendedSilhouettes: 具体的なシルエット 3〜5個（例：「縦長」「ドレープ」「ストレート」「ゆったり」「Aライン」）
- requiredAccessories: 必須の小物・アクセサリー 2〜4個（カテゴリ＋具体形・例：「細いシルバーリング」「レザーサンダル」「薄ベルト」「シルバーピアス」）
- ngElements: 避ける要素 3〜5個（例：「光沢」「派手な色」「装飾過多」「ロゴ」「テカリ素材」）

以下のJSON形式で必ず返答してください（Markdownコードブロックは付けない）：
{
  "keywords":               ["キーワード1", "キーワード2", "キーワード3"],
  "emotion":                "（感情、30字以内）",
  "personaImage":           "（人物像、40字以内）",
  "culture":                "（文化的文脈、40字以内、該当なしなら空文字）",
  "era":                    "（時代、30字以内、該当なしなら空文字）",
  "philosophy":             "（思想、40字以内、該当なしなら空文字）",
  "recommendedColors":      ["色1", "色2", "色3", "色4"],
  "recommendedMaterials":   ["素材1", "素材2", "素材3"],
  "recommendedSilhouettes": ["シルエット1", "シルエット2", "シルエット3"],
  "requiredAccessories":    ["小物1", "小物2"],
  "ngElements":             ["NG1", "NG2", "NG3"]
}
`.trim();

export function buildConceptTranslatePrompt(
  concept: string,
  scene: string,
  season: string,
  bodyProfile?: BodyProfile | null,
  stylePreference?: Record<string, unknown> | null,
): string {
  const sections: string[] = [BASE_CONCEPT_TRANSLATE_PROMPT];
  const ctx = getSeasonContext(season);

  sections.push(`\n\n[翻訳するコンセプト]\n${concept}`);
  sections.push(`\n\n[今回のシーン]\n${scene}`);
  sections.push(
    `\n\n[現在の季節・地域]\n` +
    `季節: ${season}\n` +
    `地域: 日本（東京）\n` +
    `想定気温: ${ctx.tempRange}\n` +
    `避ける素材: ${ctx.ngMaterials}\n` +
    `推奨される素材傾向: ${ctx.okMaterials}\n` +
    `※ recommendedMaterials には季節と矛盾する素材を絶対に入れないこと。`,
  );

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
      lines.push(`※ 上記悩みを解消する方向の recommendedSilhouettes を選ぶこと。`);
    }
    if (bodyProfile.proportionNote) lines.push(`補足: ${bodyProfile.proportionNote}`);
    sections.push(`\n\n${lines.join("\n")}`);
  }

  if (stylePreference) {
    const pref = stylePreference as Record<string, string[]>;
    const lines: string[] = ["[ユーザーの好み（参考。ただしコンセプトを優先）]"];
    if (pref.likedColors?.length)        lines.push(`好きな色: ${pref.likedColors.join("・")}`);
    if (pref.likedMaterials?.length)     lines.push(`好きな素材: ${pref.likedMaterials.join("・")}`);
    if (pref.likedSilhouettes?.length)   lines.push(`好きなシルエット: ${pref.likedSilhouettes.join("・")}`);
    if (pref.ngElements?.length)         lines.push(`好みのNG要素: ${pref.ngElements.join("・")}`);
    if (lines.length > 1) sections.push(`\n\n${lines.join("\n")}`);
  }

  return sections.join("");
}
