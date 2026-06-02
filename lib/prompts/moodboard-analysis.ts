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
- 参考の判断ルール・影響源（Knowledge OS）があれば、世界観コア/素材/シルエット/NG/買う判断軸の
  言語化に活かす。ただし固有名（人名・作品名）の丸写しはせず、世界観の言葉に翻訳する。日本語のみ。

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
  }
}

【各配列の目安】colors/materials/silhouettes/ng_elements は各 3〜6 個。
shopping_axis の各配列は 2〜4 個。`;

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
  lines.push("上記から、指定の JSON 形式で世界観コアと買う判断軸を出力してください。");

  return lines.join("\n");
}

export async function analyzeMoodboard(
  input: MoodboardAnalysisInput,
): Promise<MoodboardAnalysisLLM> {
  return callClaudeJSON<MoodboardAnalysisLLM>({
    systemPrompt: SYSTEM_PROMPT,
    userMessage:  buildMoodboardAnalysisUserMessage(input),
    maxTokens:    2048,
  });
}
