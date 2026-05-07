import type { BodyProfile, ConceptInterpretation } from "@/types/index";
import { getSeasonContext } from "@/lib/utils/season";
import { FASHION_AXES_PROMPT_BLOCK } from "@/lib/knowledge/fashion-axes";

// ---- 共通の文脈ブロック生成 ----

function buildContextSections(
  scene: string,
  season: string,
  bodyProfile?: BodyProfile | null,
  stylePreference?: Record<string, unknown> | null,
  styleAnalysis?: Record<string, unknown> | null,
  worldview?: Record<string, unknown> | null,
  mood?: string | null,
): string[] {
  const sections: string[] = [];
  const ctx = getSeasonContext(season);

  sections.push(`\n\n[今回のシーン]\n${scene}`);

  if (mood && mood.trim()) {
    sections.push(
      `\n\n[今日の気分（最優先で反映）]\n` +
      `ユーザーは今日「${mood}」という気分で服を選んでいる。\n` +
      `この気分が items の reason / whyThisCoordinate に必ず引用されるよう、方向性を統一すること。\n` +
      `- 静かにいたい：派手色・強シルエットを避け、トーン差を小さく\n` +
      `- 少し印象を残したい：1点だけアクセントを効かせる\n` +
      `- 大人っぽくしたい：構造重視、ハリ素材、カチッとした丈\n` +
      `- 近づきやすくしたい：柔らかい素材、明るめトーン、抜け感\n` +
      `- 強く見せたい：黒・濃色中心、ボリュームのコントラスト\n` +
      `- 余白を出したい：色数を絞り、装飾を引き、白・無彩色を主役に`,
    );
  }
  sections.push(
    `\n\n[現在の季節・地域]\n` +
    `季節: ${season}\n` +
    `地域: 日本（東京）\n` +
    `想定気温: ${ctx.tempRange}\n` +
    `避ける素材: ${ctx.ngMaterials}\n` +
    `推奨される素材傾向: ${ctx.okMaterials}\n` +
    `※ items の materialNote と name には季節と矛盾する素材を絶対に入れないこと。`,
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

  return sections;
}

// ---- Stage 3: コーデ設計プロンプト（Sprint 36 v1.2 書き換え） ----

const BASE_VIRTUAL_COORDINATE_PROMPT = `
あなたは理想のコーデを設計するスタイリストです。
[コンセプト解釈] にある推奨要素を厳格に守って、シーンと季節に合った理想のコーデ5〜7アイテムを構成してください。
ユーザーは手持ち服がない前提で、これから買い揃えるアイテムを推薦します。

[絶対的なルール]
- 「諦めてください」「向いていません」は禁止。体型の悩みも必ず「こうすれば理想に近づける」で答える
- 抽象語禁止：世界観・存在感・余白・信念軸・静けさ・哲学・美意識・共鳴・構築感・絶妙・完璧・洗練
- 説明は「〇〇するとどう見える」の形式で書く
- 具体的なアイテム名・色・素材・丈・シルエットを使う
- ユーザーの未設定項目（身長・骨格・好み等）は無視して標準的な日本人体型を想定して提案する

[コンセプト解釈の遵守（最重要）]
- [コンセプト解釈] の recommendedColors を items の color に必ず反映する（独自に色を増やさない）
- [コンセプト解釈] の recommendedMaterials を items の materialNote に必ず反映する
- [コンセプト解釈] の recommendedSilhouettes を items の sizeNote / reason に必ず反映する
- [コンセプト解釈] の requiredAccessories を items に最低1点必ず含める（複数推奨）
- [コンセプト解釈] の ngElements は items に絶対に含めない

[季節の遵守]
- [現在の季節・地域] の「避ける素材」を items に絶対に含めない
- [現在の季節・地域] の「想定気温」に合った厚み・丈・露出度を選ぶ

[itemsの構成]
- 5〜7アイテム（小物・アクセサリー含む。トータルコーディネートとして成立すること）
- role は "main" / "base" / "accent" のいずれか
  - main: コーデの主役（1〜2個）
  - base: 土台となる定番アイテム（2〜3個）
  - accent: 差し色・小物（1〜3個、コンセプト解釈の requiredAccessories を含む）
- category は次のいずれか: tops, bottoms, outerwear, jacket, vest, inner, dress, setup, shoes, bags, accessories, hat, jewelry
- 5〜7アイテムのうち shoes・bags・accessories・hat・jewelry のいずれかを最低1点必ず含めること

[各アイテムのフィールド]
- name: 表示用のシンプル商品名 15字以内（例：「白リネンシャツ」「黒ワイドパンツ」「ベージュトレンチコート」）
- color: 色名（[コンセプト解釈] の recommendedColors から選ぶ）
- reason: なぜこのアイテムか・どう着るか 40字以内（「〇〇するとどう見える」の形式）
- zozoKeyword: ZOZOTOWNで実際に検索したときヒットしやすいシンプルなキーワード15字以内（一般名詞のみ、ブランド名禁止）
- sizeNote: サイズ選びの注意 30字以内（[コンセプト解釈] の recommendedSilhouettes を反映）
- materialNote: 素材の注意 30字以内（[コンセプト解釈] の recommendedMaterials から選び、季節と整合させる）
- alternative: 代替案 30字以内（例：「ネイビーでも可」「同色のカーディガンで代替可」）

[conceptの書き方]
- 受け取った [指定コンセプト] をそのまま、または最小限の整理で concept フィールドに入れる
- 抽象的な指定でも内容を変えない（翻訳結果は items 側に反映済みのため）

[seasonNoteの書き方]
- 現在の季節がこのコーデにどう影響しているか1行 40字以内
- 例：「春は薄手リネンで重さを抜き、足首を見せて軽快に」

[whyThisCoordinateの書き方]
- なぜこのコーデが [コンセプト解釈] の世界観・思想に合うか 60字以内
- 抽象語を使わず具体的に（色・形・素材の選択がコンセプトのどの要素に対応するか）

[ngExampleの書き方]
- このコンセプトでは避けるべき具体例 60字以内
- 例：「光沢素材のシャツや派手なロゴ入りスニーカーは静謐の世界観を壊す」

[stylingTipsの書き方]
- 着こなしのポイント3点。「〇〇すると〇〇に見える」の形式。優先度順。各40字以内

以下のJSON形式で必ず返答してください（Markdownコードブロックは付けない）：
{
  "scene":             "（受け取ったscene値をそのまま）",
  "concept":           "（指定コンセプトをそのまま、または最小限の整理）",
  "seasonNote":        "（季節がこのコーデにどう影響しているか、40字以内）",
  "whyThisCoordinate": "（コンセプトとの整合性、60字以内）",
  "ngExample":         "（このコンセプトで避けるべき具体例、60字以内）",
  "items": [
    {
      "role":         "main",
      "category":     "tops",
      "name":         "（商品名、15字以内）",
      "color":        "（色名、recommendedColorsから）",
      "reason":       "（なぜこのアイテムか、40字以内）",
      "zozoKeyword":  "（検索キーワード、15字以内）",
      "sizeNote":     "（サイズの注意、30字以内）",
      "materialNote": "（素材の注意、30字以内）",
      "alternative":  "（代替案、30字以内）"
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
  season: string,
  concept: string,
  conceptInterpretation: ConceptInterpretation,
  bodyProfile?: BodyProfile | null,
  stylePreference?: Record<string, unknown> | null,
  styleAnalysis?: Record<string, unknown> | null,
  worldview?: Record<string, unknown> | null,
  mood?: string | null,
): string {
  const sections: string[] = [BASE_VIRTUAL_COORDINATE_PROMPT];
  sections.push(`\n\n${FASHION_AXES_PROMPT_BLOCK}`);
  sections.push(...buildContextSections(scene, season, bodyProfile, stylePreference, styleAnalysis, worldview, mood));

  // 指定コンセプト（原文）
  sections.push(`\n\n[指定コンセプト]\n${concept}`);

  // コンセプト解釈（Stage 1 の出力）
  const ci = conceptInterpretation;
  const interpLines: string[] = ["[コンセプト解釈]"];
  if (ci.keywords.length)               interpLines.push(`キーワード: ${ci.keywords.join("・")}`);
  if (ci.emotion)                       interpLines.push(`感情: ${ci.emotion}`);
  if (ci.personaImage)                  interpLines.push(`人物像: ${ci.personaImage}`);
  if (ci.culture)                       interpLines.push(`文化的文脈: ${ci.culture}`);
  if (ci.era)                           interpLines.push(`時代: ${ci.era}`);
  if (ci.philosophy)                    interpLines.push(`思想: ${ci.philosophy}`);
  if (ci.recommendedColors.length)      interpLines.push(`推奨色: ${ci.recommendedColors.join("・")}`);
  if (ci.recommendedMaterials.length)   interpLines.push(`推奨素材: ${ci.recommendedMaterials.join("・")}`);
  if (ci.recommendedSilhouettes.length) interpLines.push(`推奨シルエット: ${ci.recommendedSilhouettes.join("・")}`);
  if (ci.requiredAccessories.length)    interpLines.push(`必須の小物: ${ci.requiredAccessories.join("・")}`);
  if (ci.ngElements.length)             interpLines.push(`NG要素（絶対に含めない）: ${ci.ngElements.join("・")}`);
  sections.push(`\n\n${interpLines.join("\n")}`);

  return sections.join("");
}

// ---- コンセプト候補3案プロンプト（v1.1 のまま維持） ----

const BASE_VIRTUAL_CONCEPTS_PROMPT = `
あなたは理想のコーデのコンセプトを設計するスタイリストです。
ユーザーの診断結果・好み・体型情報・季節・シーンをもとに、コーデの方向性となる「コンセプト候補3案」を提案してください。
ユーザーは候補から1つを選び、そのコンセプトに沿った具体的なコーデが後で作られます。

[絶対的なルール]
- 抽象語禁止：世界観・存在感・余白・信念軸・静けさ・哲学・美意識・共鳴・構築感・絶妙・完璧・洗練
- 各候補は明確に違う方向性を提示する（同じ路線で微差を3つ並べない）
- 季節・シーンに整合する内容にする
- ユーザーの未設定項目は無視して標準的な日本人体型を想定する

[各候補のフィールド]
- title: コンセプトの短いタイトル 30字以内（例：「黒を中心にした静かな大人っぽさ」）
- description: 具体的な説明 60字以内（例：「黒ワイドパンツ＋ホワイト無地で縦長ラインを作る、装飾を抑えた構成」）

以下のJSON形式で必ず返答してください（Markdownコードブロックは付けない）：
{
  "concepts": [
    { "title": "（タイトル1、30字以内）", "description": "（説明1、60字以内）" },
    { "title": "（タイトル2、30字以内）", "description": "（説明2、60字以内）" },
    { "title": "（タイトル3、30字以内）", "description": "（説明3、60字以内）" }
  ]
}
`.trim();

export function buildVirtualConceptsPrompt(
  scene: string,
  season: string,
  bodyProfile?: BodyProfile | null,
  stylePreference?: Record<string, unknown> | null,
  styleAnalysis?: Record<string, unknown> | null,
  worldview?: Record<string, unknown> | null,
  mood?: string | null,
): string {
  const sections: string[] = [BASE_VIRTUAL_CONCEPTS_PROMPT];
  sections.push(`\n\n${FASHION_AXES_PROMPT_BLOCK}`);
  sections.push(...buildContextSections(scene, season, bodyProfile, stylePreference, styleAnalysis, worldview, mood));
  return sections.join("");
}
