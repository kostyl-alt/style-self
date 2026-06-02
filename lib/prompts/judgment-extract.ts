// Phase 3: フィードバック → judgment_rules 抽出プロンプト
//
// ユーザーの「好き/違う/保存」評価（+世界観軸の理由）から、次回相談に効く
// 永続ルール（preference / ng / style_rule）を 0〜2 件抽出する。
//
// 品質方針:
//   - 既存ルールを渡して重複/矛盾を回避（同義は出さない・反対なら上書き示唆）。
//   - 「違う」理由なしは低信頼 → 出力ゼロ or priority 低。
//   - 世界観軸の語彙（方向性/素材/シルエット/装飾・演出/重心）に沿ってルール化し、
//     moodboard_analysis の構成要素とマッピングしやすくする。
//   - 日本語のみ・英語スラッグ/内部 ID 禁止。

import { callClaudeJSON, HAIKU_MODEL } from "@/lib/claude";

export type JudgmentRuleKind = "preference" | "ng" | "style_rule";

export interface ExtractedRule {
  rule:     string;
  kind:     JudgmentRuleKind;
  priority: number; // 1-10
}

export interface ExtractJudgmentInput {
  feedbackKind: "like" | "dislike" | "save" | string;
  feedbackNote: string;            // content（理由チップ＋提案の核）
  existingRules: { rule: string; kind: string }[];
}

const SYSTEM_PROMPT = `あなたはユーザーのファッション世界観を学習するアシスタントです。
チャットのコーデ提案に対するユーザーの評価から、次回以降の提案に効く「判断ルール」を抽出します。

【ルールの種類】
- preference: 好む傾向（例: 落ち感のある黒のロングシャツ系を好む）
- ng:         避けるべき要素（例: 光沢の強い化繊は避ける）
- style_rule: 全体方針（例: 華美より日常で着られる構成を優先）

【世界観軸の語彙にマッピングする】
理由は方向性 / 素材 / シルエット / 装飾・演出 / 重心 のいずれかに対応する。
例: 「素材感が違う」→ ng（合わない素材傾向）/「この世界観じゃない」→ style_rule（方向性）/
    「装飾が多い/演出っぽい」→ ng（過度な装飾を避ける）/「重い」→ ng or style_rule（重心）。

【厳守】
- 出力は日本語のみ。英語スラッグ・ブランド名・内部 ID は使わない。
- ★ 既存ルールと ★ 同義のものは出さない（重複禁止）。反対の内容なら新しい方を優先する形で言い換える。
- 「違う」評価で理由が無い等、信号が弱い場合は ★ rules を空配列にする（無理に作らない）。
- 1 回の評価から作るルールは ★ 0〜2 件。priority は 1-10（強い明示的評価ほど高め・最大 7 目安）。

【出力 JSON 形式】
{ "rules": [ { "rule": "…", "kind": "preference|ng|style_rule", "priority": 5 } ] }
ルールを作らない場合は { "rules": [] }。`;

export async function extractJudgmentRules(input: ExtractJudgmentInput): Promise<ExtractedRule[]> {
  const lines: string[] = [];
  lines.push(`[ユーザーの評価] ${input.feedbackKind}`);
  if (input.feedbackNote.trim() !== "") lines.push(`[詳細] ${input.feedbackNote}`);
  if (input.existingRules.length > 0) {
    lines.push("");
    lines.push("[既存の判断ルール（重複・矛盾を避ける）]");
    for (const r of input.existingRules) lines.push(`- (${r.kind}) ${r.rule}`);
  }
  lines.push("");
  lines.push("上記から、指定 JSON 形式で判断ルールを抽出してください（信号が弱ければ空配列）。");

  const result = await callClaudeJSON<{ rules?: unknown }>({
    systemPrompt: SYSTEM_PROMPT,
    userMessage:  lines.join("\n"),
    model:        HAIKU_MODEL,
    maxTokens:    1024,
  });

  if (!result || !Array.isArray(result.rules)) return [];
  const VALID_KINDS: JudgmentRuleKind[] = ["preference", "ng", "style_rule"];
  return (result.rules as unknown[])
    .map((r): ExtractedRule | null => {
      if (r === null || typeof r !== "object") return null;
      const o = r as Record<string, unknown>;
      const rule = typeof o.rule === "string" ? o.rule.trim() : "";
      const kind = o.kind as JudgmentRuleKind;
      if (rule === "" || !VALID_KINDS.includes(kind)) return null;
      const rawP = typeof o.priority === "number" ? o.priority : 5;
      const priority = Math.min(10, Math.max(1, Math.round(rawP)));
      return { rule, kind, priority };
    })
    .filter((r): r is ExtractedRule => r !== null)
    .slice(0, 2);
}
