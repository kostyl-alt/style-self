// C-2a: 着用イメージ用 FASHN.ai prompt 変換 helper(★ Claude Haiku 動的変換)。
//
// 設計: docs/STYLE-SELF_D1_着用イメージ_リアル試着_ビジュアル対話_設計調査.md(ac33f90) C-Phase1
//   C-2 設計合意の判断 3「Claude Haiku 動的変換」+ 判断 4「体型反映は判断 3 に統合」
//
// 役割: MB 世界観 + 体型(R-1)+ コーデ提案(B-4 stylist-chat reply)を、
//       FASHN.ai product-to-model 用の英語 prompt(100-200 単語)1 文に翻訳。
//
// 中核制約:
//   ・体型は ★ 否定形ゼロ(B-2/R-2 整合・short/narrow/heavy 等の翻訳禁止)
//   ・E-0a「表面を真似しない」: 「黒服」→ "black clothing" の直訳でなく
//                                  "matte black layered texture" 等の質感翻訳
//
// コスト: 1 件 ≈ ¥0.5(Claude Haiku 4.5・500 token budget)

import { callClaude, HAIKU_MODEL } from "@/lib/claude";
import { describeBodyShape } from "@/lib/utils/body-rules";
import type { BodyProfile } from "@/types/index";

// 簡略な MB プロジェクション(generate route が DB から SELECT して渡す形)。
export interface TryonMoodboardInput {
  name:           string;
  description:    string | null;
  worldviewName?: string | null;
}

export interface BuildTryonPromptOpts {
  coordinateText: string;
  moodboard?:     TryonMoodboardInput;
  bodyProfile?:   BodyProfile;
}

const SYSTEM_PROMPT = `あなたは FASHN.ai の product-to-model モデル用の英語 prompt 翻訳者です。
入力された日本語の MB(ムードボード)世界観 + 体型 + コーデ提案を、★ 英語 100-200 単語の prompt 1 段落に翻訳してください。

【★ 厳守 1: 体型は ★ 否定形ゼロ】
・以下の語彙を出力に含めない(★ 英訳含む):
  日本語: 短い / 狭い / 重い / 悩み / 弱点 / 欠点 / 逆算 / 補正
  英語: short / narrow / heavy / concern / flaw / weakness / problem / fix / correct
・代わりに以下の中立英語を使用:
  - 身長低め → "shorter stature" は使わず "compact stature" / "petite frame"
  - 身長標準 → "average height"
  - 身長高め → "tall stature"
  - 肩幅しっかりめ → "structured shoulder line"
  - 肩幅華奢め → "refined shoulder line"
  - 重心高めの構成 → "elevated center of gravity" / "high-waist balance"
  - 首が長め → "elongated neckline focus"
  - 首がコンパクト → "open neckline focus"
  - 骨格ストレート → "straight body line"
  - 骨格ウェーブ → "curved body line"
  - 骨格ナチュラル → "natural body frame"

【★ 厳守 2: E-0a「表面を真似しない」原則】
・服の名称を直訳しない(★ 「黒服」→ "black clothing" 不可)
・代わりに ★ 質感 / 重なり / 光沢 / 構造 として翻訳:
  - 「黒のロングコート」→ "matte black layered outer, draped silhouette"
  - 「白シャツ」→ "soft white woven layer, refined collar"
  - 「ワイドパンツ」→ "wide tailored bottom, flowing line"
・MB 世界観の奥のムード(匿名性 / 距離感 / 不穏さ / 乾いたノスタルジー / 人工と自然のズレ 等)を抽出
  - 「冷たいアンドロジナス」→ "cold androgynous mood, neutral expression, quiet detachment"
  - 「乾いたノスタルジー」→ "muted nostalgic palette, soft grain texture"

【★ 厳守 3: シーン要素を必ず含める】
・シーン: studio / minimalist composition / cinematic setting 等
・照明: moody side lighting / soft backlit / neutral diffuse 等
・表情 / 姿勢: neutral expression / confident posture / contemplative stance 等
・構図: editorial framing / centered portrait / three-quarter view 等

【★ 出力形式】
・★ 英語 100-200 単語の prompt 本文のみ
・★ 1 段落のフラットな英語(改行禁止)
・★ 前置き禁止(「Here is the prompt:」「Prompt:」等 全て不可)
・★ コードブロック / マークダウン禁止
・★ 引用符 / 説明文 禁止`;

function buildUserMessage(opts: BuildTryonPromptOpts): string {
  const lines: string[] = [];
  if (opts.moodboard) {
    lines.push("[MB 世界観]");
    lines.push(`テーマ: ${opts.moodboard.name}`);
    if (opts.moodboard.description && opts.moodboard.description.trim() !== "") {
      lines.push(`コンセプト: ${opts.moodboard.description.trim()}`);
    }
    if (opts.moodboard.worldviewName && opts.moodboard.worldviewName.trim() !== "") {
      lines.push(`世界観: ${opts.moodboard.worldviewName.trim()}`);
    }
    lines.push("");
  }
  if (opts.bodyProfile) {
    const shape = describeBodyShape(opts.bodyProfile);
    lines.push("[体型(★ 否定形ゼロで英訳すること)]");
    lines.push(shape.natural);
    if (shape.features.length > 0) {
      lines.push(`特徴タグ: ${shape.features.join(" / ")}`);
    }
    lines.push("");
  }
  lines.push("[コーデ提案テキスト(B-4 reply・★ 表面を真似せず質感に翻訳)]");
  // 1500 字以上は切り詰め(token 予算保護)
  const trimmed = opts.coordinateText.length > 1500
    ? `${opts.coordinateText.slice(0, 1500)}\n(以下省略)`
    : opts.coordinateText;
  lines.push(trimmed);
  return lines.join("\n");
}

// FASHN への投入直前に、Claude 応答に紛れがちな前置きを除去。
function sanitizePrompt(text: string): string {
  let s = text.trim();
  // ``` フェンス除去(念のため)
  s = s.replace(/^```[a-zA-Z]*\s*/, "").replace(/```\s*$/, "");
  // 改行を空白に(FASHN は単一 prompt 推奨)
  s = s.replace(/\s*\n+\s*/g, " ");
  // 先頭の "Prompt:" 等を除去
  s = s.replace(/^(Prompt|prompt|Here is the prompt|Output)\s*[:：]\s*/i, "");
  return s.trim();
}

export async function buildTryonPrompt(opts: BuildTryonPromptOpts): Promise<string> {
  const userMessage = buildUserMessage(opts);
  const raw = await callClaude({
    systemPrompt: SYSTEM_PROMPT,
    userMessage,
    model:        HAIKU_MODEL,
    maxTokens:    500,
  });
  return sanitizePrompt(raw);
}
