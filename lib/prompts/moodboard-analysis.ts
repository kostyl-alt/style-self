// Phase 1: ムードボード board単位解析プロンプト（context object 生成）
//
// 目的: MB（テーマ/コンセプト/参考画像キャプション/世界観）を 1 回だけ構造化解析し、
//   moodboard_analysis に保存する。チャットはこの context object を読むだけにして、
//   長文プロンプト往復をやめる（短文化の起点）。
//
// 三重防御 1（M2-3 踏襲）:
//   - 入力に英語スラッグ（worldview_tags 等）を含めない（呼び出し側で除外）
//   - 出力も日本語のみ・英語スラッグ/技術用語（minimal / streetwear 等）禁止
//
// 出力は MoodboardAnalysisLLM（types/moodboard.ts）に一致する JSON。

import { callClaudeJSON } from "@/lib/claude";
import type { MoodboardAnalysisLLM } from "@/types/moodboard";

export interface MoodboardAnalysisInput {
  name:                 string;
  description:          string;
  worldviewName:        string | null;
  worldviewKeywords:    string[];        // 日本語キーワードのみ（英語スラッグは渡さない）
  itemCaptions:         string[];        // items の caption 群（既存 per-image 解析資産）
  worldviewProfileNote: string | null;   // worldview_profiles 由来の短い文脈（任意）
  // ★ 案A: Knowledge OS の参考知見（best-effort・空なら何も足さない＝従来出力と同一）
  koDecisionRules?:     string[];        // 判断ルール文
  koInfluences?:        string[];        // 影響源（subject_name：fusion_essence 等）
}

const SYSTEM_PROMPT = `あなたはファッションの世界観を言語化する専門家です。
ユーザーのムードボード（テーマ・コンセプト・参考画像のメモ・世界観）から、
「どこで買うにせよ、自分の世界観に合う服を選べる判断軸」を構造化して出力します。

【厳守】
- 出力は日本語のみ。英語のスラッグや技術用語（minimal / street / mode 等）は使わない。
- 固有のブランド名・店名は出さない（どこで買うかに依存しない普遍的な判断軸にする）。
- 抽象語の羅列ではなく、実際に服を選べる粒度で具体的に書く。
- 入力に無い要素は世界観・コンセプトから自然に推定して補完してよい。
- 参考の判断ルール・影響源（Knowledge OS）があれば、世界観コア/素材/シルエット/NG/買う判断軸/
  着こなし操作の言語化に活かす。ただし固有名（人名・作品名）の丸写しはせず、世界観の言葉に翻訳する。日本語のみ。
- ★ おしゃれは「良い服」ではなく「スタイリングが上手い」ことで決まる。同じ服でも丈・腰位置・
  ベルト・裾のため・小物・髪型・崩し・視線設計で印象が変わる。styling_axis では「何を着るか」ではなく
  「どう着るか＝操作」を、実際に手を動かせる粒度で書く（例:「丈を上げて腰位置を見せる」「裾を靴にためる」）。

【出力 JSON 形式】
{
  "worldview_core": "この人の世界観の核を1〜2文で。何を大切にし、何を目指すか。",
  "colors": ["主に使う色（例: 黒, チャコール, オフホワイト）"],
  "materials": ["合う素材（例: ウール, レザー, コットンブロード）"],
  "silhouettes": ["合うシルエット・丈（例: ロング丈アウター, ストレートパンツ）"],
  "mood": "全体の空気感を短く（例: 静かで余白のある大人っぽさ）",
  "ng_elements": ["世界観に合わない・避けるべき要素（例: 過度なロゴ, 光沢の強い化繊）"],
  "shopping_axis": {
    "where_to_look": ["どんな店・売り場で探すと出会いやすいか（店種の指針・固有店名は不可）"],
    "check_points": ["買う前に必ず確認する点（素材/丈/シルエット/色味 等）"],
    "avoid_when": ["この条件なら見送る、という判断基準"]
  },
  "styling_axis": {
    "layering": ["レイヤードの組み方（例: 短丈を上に重ねて縦のリズムを作る）"],
    "lengths": ["丈・袖・裾の扱い（例: 袖をたくし上げて手首を見せる）"],
    "silhouetteBuild": ["シルエットの組み立て方（例: 上をコンパクト・下をボリュームでYライン）"],
    "colorBalance": ["色配分（例: 黒を主役に1色だけ差し色を小面積で）"],
    "materialMix": ["素材の混ぜ方（例: マット素材に光沢を一点だけ）"],
    "accessories": ["小物の置き方（例: ベルトで腰を主役にし手首で色を拾う）"],
    "shoesConnection": ["靴との接続（例: 裾を靴にためて下半身に重心）"],
    "hairMakeup": ["髪型・メイクとの接続（例: タイトなまとめ髪で抜けを作る）"],
    "anomaly": ["普通に見えないための違和感（例: スカーフを巻いて視線を一点に集める）"],
    "mbStylingRules": ["このMB世界観特有の着こなしルール"],
    "avoidStyling": ["避けるべき着方（例: 全部をジャストサイズで揃えて平坦にしない）"]
  },
  "brief": {
    "concept":   { "value": "世界観の短いラベル（3〜10字・詩的禁止・例: 静かな硬質ミニマル）", "basis": "inferred" },
    "story":     { "value": "場面・物語を1〜2文（例: 夜明け前の無人の街を一人歩く）", "basis": "inferred" },
    "person":    { "value": "この理想像の人物を1文（性別感/年齢感/体型/雰囲気・例: 20代前半・中性的・細身・硬質で静か）", "basis": "inferred" },
    "lifestyle": { "value": "生活/カルチャー像を1文", "basis": "inferred" },
    "hair":      { "value": "髪型/長さ/質感", "basis": "inferred" },
    "makeup":    { "value": "メイク系統（ナチュラル/ダーク/ノーメイク等）", "basis": "inferred" },
    "location":  { "value": "場所/空間", "basis": "inferred" },
    "light":     { "value": "光の種類/時間帯/影/明暗", "basis": "inferred" },
    "colorPalette": { "main": ["メインカラー"], "accent": ["差し色"], "saturation": "彩度の傾向（例: 低彩度・無彩色寄り）", "basis": "inferred" }
  }
}

【各配列の目安】colors/materials/silhouettes/ng_elements は各 3〜6 個。
shopping_axis の各配列は 2〜4 個。styling_axis の各配列は 1〜3 個（操作は具体的に・空でよい項目は省略可）。

【brief（注釈付きMBの追加情報）】各テキスト項目は { value, basis } で持つ。
- ★ basis: 視覚的に確認できない値は "inferred"（推測）。caption/世界観に明記がある場合のみ "observed"。確証が薄い項目はキーごと省略してよい（無理に埋めない）。
- concept は詩的表現・比喩・装飾を禁止し、短いタグ的ラベルにする。
- ★ person は「このムードボードが描く“理想像”の人物」を表す。ユーザー本人の体型・体ではない（混同禁止）。
- colorPalette は既存 colors と重複してよい（main/accent/saturation に構造化した追加ビュー）。`;

export function buildMoodboardAnalysisUserMessage(input: MoodboardAnalysisInput): string {
  const lines: string[] = [];

  lines.push("[ムードボード]");
  lines.push(`テーマ: ${input.name}`);
  if (input.description.trim() !== "") {
    lines.push(`コンセプト: ${input.description}`);
  }
  if (input.worldviewName !== null && input.worldviewName !== "") {
    lines.push(`世界観: ${input.worldviewName}`);
  }
  if (input.worldviewKeywords.length > 0) {
    lines.push(`世界観キーワード: ${input.worldviewKeywords.join(" / ")}`);
  }

  if (input.itemCaptions.length > 0) {
    lines.push("");
    lines.push("[参考画像メモ]");
    input.itemCaptions.forEach((c, i) => lines.push(`${i + 1}. ${c}`));
  }

  if (input.worldviewProfileNote !== null && input.worldviewProfileNote.trim() !== "") {
    lines.push("");
    lines.push("[診断プロフィール（参考）]");
    lines.push(input.worldviewProfileNote);
  }

  // ★ 案A: Knowledge OS 参考（空なら何も足さない＝従来出力と同一）
  const koRules = input.koDecisionRules ?? [];
  const koInfl  = input.koInfluences ?? [];
  if (koRules.length > 0 || koInfl.length > 0) {
    lines.push("");
    lines.push("[Knowledge OS 参考（判断ルール / 影響源・固有名は丸写しせず世界観に翻訳）]");
    if (koRules.length > 0) {
      lines.push("判断ルール:");
      koRules.forEach((r) => lines.push(`- ${r}`));
    }
    if (koInfl.length > 0) {
      lines.push("影響源:");
      koInfl.forEach((i) => lines.push(`- ${i}`));
    }
  }

  lines.push("");
  lines.push("上記から、指定の JSON 形式で世界観コア・買う判断軸・着こなし操作を出力してください。");

  return lines.join("\n");
}

export async function analyzeMoodboard(
  input: MoodboardAnalysisInput,
): Promise<MoodboardAnalysisLLM> {
  return callClaudeJSON<MoodboardAnalysisLLM>({
    systemPrompt: SYSTEM_PROMPT,
    userMessage:  buildMoodboardAnalysisUserMessage(input),
    // ★ Phase 4-a: styling_axis で 2048→3072。★ Moodboard First Step 1: brief 追加で 3072→4096（途中切れ防止）
    maxTokens:    4096,
  });
}
