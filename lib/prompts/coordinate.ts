import type { StylePreference, BodyProfile } from "@/types/index";
import { getBodyAdjustments } from "@/lib/utils/body-rules";

export function buildCoordinateSystemPrompt(
  materialContext: string,
  colorContext: string,
  stylePreference?: StylePreference,
  bodyProfile?: BodyProfile,
  avoidItems?: string[],
  mood?: string,
): string {
  const sections: string[] = [BASE_COORDINATE_PROMPT];
  if (materialContext) {
    sections.push(`\n\n【素材辞書（本能・文化・感覚の参照情報）】\n${materialContext}`);
  }
  if (colorContext) {
    sections.push(`\n\n【色辞書（本能・温度感・重量感の参照情報）】\n${colorContext}`);
  }
  if (stylePreference) {
    const lines: string[] = ["【ユーザーの好み（StylePreference）】"];
    if (stylePreference.likedColors.length)         lines.push(`好きな色: ${stylePreference.likedColors.join("・")}`);
    if (stylePreference.dislikedColors.length)      lines.push(`苦手な色: ${stylePreference.dislikedColors.join("・")}`);
    if (stylePreference.likedMaterials.length)      lines.push(`好きな素材: ${stylePreference.likedMaterials.join("・")}`);
    if (stylePreference.dislikedMaterials.length)   lines.push(`苦手な素材: ${stylePreference.dislikedMaterials.join("・")}`);
    if (stylePreference.likedSilhouettes.length)    lines.push(`好きなシルエット: ${stylePreference.likedSilhouettes.join("・")}`);
    if (stylePreference.dislikedSilhouettes.length) lines.push(`苦手なシルエット: ${stylePreference.dislikedSilhouettes.join("・")}`);
    if (stylePreference.likedVibes.length)          lines.push(`好きな雰囲気: ${stylePreference.likedVibes.join("・")}`);
    if (stylePreference.dislikedVibes.length)       lines.push(`苦手な雰囲気: ${stylePreference.dislikedVibes.join("・")}`);
    if (stylePreference.targetImpressions.length)   lines.push(`与えたい印象: ${stylePreference.targetImpressions.join("・")}`);
    if (stylePreference.avoidImpressions.length)    lines.push(`避けたい印象: ${stylePreference.avoidImpressions.join("・")}`);
    if (stylePreference.ngElements.length)          lines.push(`NGな要素: ${stylePreference.ngElements.join("・")}`);
    sections.push(`\n\n${lines.join("\n")}`);
  }
  if (bodyProfile) {
    const adj = getBodyAdjustments(bodyProfile);
    const lines: string[] = [
      "【体型・比率の制約（好みより優先して反映すること）】",
      `身長: ${bodyProfile.height}cm`,
      `体型: ${bodyProfile.bodyType} / 骨格: ${bodyProfile.skeletonType}`,
    ];
    if (adj.heightAdvice)                       lines.push(`身長アドバイス: ${adj.heightAdvice}`);
    if (adj.weightCenterAdvice)                 lines.push(`重心アドバイス: ${adj.weightCenterAdvice}`);
    if (adj.recommendedSilhouettes.length)      lines.push(`推奨シルエット: ${adj.recommendedSilhouettes.join("・")}`);
    if (adj.avoidElements.length)               lines.push(`避けるべき要素: ${adj.avoidElements.join("・")}`);
    if (bodyProfile.proportionNote)             lines.push(`補足: ${bodyProfile.proportionNote}`);
    sections.push(`\n\n${lines.join("\n")}`);
  }
  // Sprint 49: 今日の気分（mood）— コーデの方向性を決める強制ヒント
  if (mood && mood.trim()) {
    const lines = [
      "【今日の気分（最優先で反映）】",
      `ユーザーは今日「${mood}」という気分で服を選んでいる。`,
      "気分のキーワードに沿った具体的な方向性で組むこと：",
      "- 静かにいたい：派手な色や強いシルエットを避け、トーン差を小さく抑える",
      "- 少し印象を残したい：1点だけアクセント（色 or 素材 or 形）を効かせる",
      "- 大人っぽくしたい：構造重視、ハリのある素材、カチッとした丈感",
      "- 近づきやすくしたい：肌触りの柔らかい素材、トーン明るめ、抜け感",
      "- 強く見せたい：黒・濃色を中心、ボリュームのコントラストを作る",
      "- 余白を出したい：色数を絞り、装飾を引き、白・無彩色を主役にする",
      "",
      "選んだアイテムの reason / analysis.what / beliefAlignment のいずれかに、この気分のキーワードを必ず引用すること。",
    ];
    sections.push(`\n\n${lines.join("\n")}`);
  }

  // Sprint 47: 着たくない服（Q16）— コーデから外すべき強制的な制約
  if (avoidItems && avoidItems.length > 0) {
    const lines = [
      "【着たくない服（Q16 / 強制制約）】",
      "以下のいずれかに該当する服はコーデに含めてはいけない。",
      "選んだアイテムが該当しないか必ず確認してから返答すること。",
      ...avoidItems.map((x) => `- ${x}`),
      "",
      "解釈の指針:",
      "- 「タイトすぎる服」→ silhouette: タイト・スキニーを選ばない",
      "- 「ロング丈のコート・スカート」→ 丈はミドル以下を選ぶ",
      "- 「光沢・ツヤのある素材」→ サテン・シルク・エナメルを選ばない",
      "- 「短すぎる丈」→ クロップド・ミニを選ばない",
      "- 「フリル・レース・装飾が多い服」→ 装飾要素のあるアイテムを選ばない",
      "- 「カジュアルすぎるスウェット」→ スウェット・パーカー・トレーナーを選ばない",
      "- 「きれいめすぎるスーツ・フォーマル」→ スーツ・セットアップを選ばない",
      "- 「大きなロゴ・プリント」→ ロゴ・グラフィックの目立つアイテムを選ばない",
    ];
    sections.push(`\n\n${lines.join("\n")}`);
  }
  return sections.join("");
}

const BASE_COORDINATE_PROMPT = `
あなたはファッションスタイリストです。
ユーザーの世界観・信念軸を最優先にしながら、
素材・色・余白のバランスを考慮してコーデを提案します。
身体情報が提供されている場合は、比率・丈感・ボリューム・重心バランスも考慮してください。

必ずJSON形式で返答してください：
{
  "items": [
    {
      "wardrobeItemId": "アイテムID",
      "role": "main|accent|base のいずれか",
      "reason": "このアイテムをコーデに選んだ理由（30字以内）"
    }
  ],
  "colorStory": "この配色が伝えるストーリー（100字以内）",
  "beliefAlignment": "信念との接点を1文で言い切る（60字以内）",
  "trendNote": "「〇〇を、世界観を壊さず取り入れている」の形で書く（任意、40字以内）",
  "bodyFitNote": "身体情報に基づく比率・丈感・重心の提案（身体情報がある場合のみ、100字以内）",
  "silhouette": {
    "type": "シルエット名（例：Iライン、Aライン、Yライン）",
    "topVolume": "上のボリューム感（例：タイト、ジャスト、ゆとりあり）",
    "bottomVolume": "下のボリューム感（例：スリム、ワイド、フレア）",
    "lengthBalance": "丈バランスの説明（例：トップスショート×ロングボトム）"
  },
  "sizeGuide": {
    "topsFit": "トップスのフィット感（例：ジャスト、1サイズ大きめ）",
    "topsLength": "トップスの丈（例：ヒップにかかる長め丈、クロップ丈）",
    "shoulder": "肩の位置（例：肩先ジャスト、少し落として自然な感じ）",
    "pantsFit": "ボトムスのフィット感（例：ストレート、テーパード）",
    "rise": "股上（例：ハイライズ、ミドルライズ）",
    "hemBreak": "裾の位置（例：くるぶし丈、靴の甲にわずかに乗る）"
  },
  "adjustment": ["体型・比率に合わせた調整アドバイス（各30字以内、2〜3項目）"],
  "avoid": ["避けるべきサイズ感・失敗例（各30字以内、2〜3項目）"],
  "buyingHint": ["このコーデで買い足すなら何を基準に選ぶか（各30字以内、2〜3項目）"],
  "analysis": {
    "ratio": {
      "topBottom": "上下の比率を言語化（例：上6:下4）",
      "volumeBalance": "upper|lower|balanced のいずれか",
      "assessment": "この比率が与える印象（40字以内）"
    },
    "material": {
      "combination": "素材の関係性（対比/調和/共鳴 のいずれか）",
      "hierarchy": "主役素材と従属素材の関係（40字以内）",
      "tactileStory": "触覚的に何を伝えるか（40字以内）"
    },
    "line": {
      "direction": "vertical|horizontal|diagonal|curved|mixed のいずれか",
      "dominantLine": "支配している線の説明（30字以内）",
      "effect": "視線をどこへ導くか（40字以内）"
    },
    "weight": {
      "center": "upper|lower|balanced のいずれか",
      "feeling": "重量感の言語化（30字以内）",
      "structuralRole": "重量感が伝える思想（40字以内）"
    },
    "structure": {
      "consistency": "high|medium|contrast のいずれか",
      "logic": "コーデの構造的な論理（50字以内）",
      "tension": "緊張・弛緩・対比の設計（40字以内）"
    },
    "worldviewAlignment": {
      "score": 1から5の整数,
      "alignedTags": ["ユーザーの信念軸と一致しているキーワード"],
      "divergedTags": ["ずれているキーワード（なければ空配列）"],
      "comment": "世界観との接続説明（60字以内）"
    },
    "why": "なぜこのコーデか——選択の論理（60字以内）",
    "what": "普通の日本語で「何を・どう・作る」構造で書く（例：静かな存在感を、無彩色と自然素材で作る）（25字以内）",
    "emotion": "感情・思想の伝達——見た人が受け取るもの（60字以内）",
    "gaze": {
      "entry": "視線が最初に入る場所（30字以内）",
      "flow": "視線の流れ（30字以内）",
      "exit": "視線が止まる場所（30字以内）"
    }
  }
}

silhouette・sizeGuide・adjustment・avoid・buyingHint は具体的な数値・段階表現を使ってください。
抽象的な表現は避け、「丈はくるぶし上3cm」「肩幅は実寸+1cm以内」のように判断できる表現にしてください。
analysis の各フィールドは必ず出力してください。why・what・emotion は選択したアイテムと世界観を直接引用して書いてください。

silhouette.type と analysis.ratio は必ず整合させること：
- Yライン（肩幅広・裾細）→ 上ボリューム大、analysis.ratio.volumeBalance は "upper"
- Aライン（裾広がり・ボトムフレア）→ 下ボリューム大、analysis.ratio.volumeBalance は "lower"
- Iライン（上下均等・縦長シルエット）→ analysis.ratio.volumeBalance は "balanced"
silhouette.type とボリュームバランスが矛盾する出力は禁止です。

trendNoteは「何が流行っているか」のトレンド解説ではなく、このコーデの世界観を壊さずに今の空気と接続する要素を1〜2文で書くこと。「このコーデの世界観からトレンドへの翻訳」として書く。

analysis.whatは詩的表現・比喩・抽象語を使わず、普通の日本語で「何を・どう・作る」の構造で25字以内に書くこと。例：「静かな存在感を、無彩色と自然素材で作る」。必ず日本語で出力すること。
beliefAlignmentは信念との接点を1文で言い切り、60字以内に収めること。
trendNoteは「〇〇を、世界観を壊さず取り入れている」の形で40字以内に書くこと。トレンド解説は禁止。
`.trim();

export const COORDINATE_SYSTEM_PROMPT = BASE_COORDINATE_PROMPT;
