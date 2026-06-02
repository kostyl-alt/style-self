// Phase 3: judgment_rules の読み取り / 抽出保存サービス
//
// - getJudgmentRules: 次回反映用に上位 N 件（priority desc, created_at desc）を読む。
//   各 rule は stripCanonicalSlugs を通す（英語スラッグ混入防止・三重防御）。
// - extractAndSaveJudgmentRules: feedback から判断ルールを抽出し、重複を避けて upsert。
//   best-effort（呼び出し側が失敗を握りつぶす前提）・DB 変更なし（既存 judgment_rules テーブル）。

import type { SupabaseClient } from "@supabase/supabase-js";
import { stripCanonicalSlugs } from "@/lib/utils/strip-canonical-slugs";
import { extractJudgmentRules, type JudgmentRuleKind } from "@/lib/prompts/judgment-extract";

export interface JudgmentRuleLite {
  rule:     string;
  kind:     JudgmentRuleKind;
  priority: number;
}

const READ_LIMIT = 10;

// 次回反映用：上位 N 件を取得し rule を strip。0 件なら []（呼び出し側は無注入）。
export async function getJudgmentRules(
  supabase: SupabaseClient,
  userId: string,
): Promise<JudgmentRuleLite[]> {
  const { data } = await supabase
    .from("judgment_rules")
    .select("rule, kind, priority")
    .eq("user_id", userId)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(READ_LIMIT) as unknown as {
      data: { rule: string; kind: JudgmentRuleKind; priority: number }[] | null;
    };
  return (data ?? []).map((r) => ({
    rule:     stripCanonicalSlugs(r.rule ?? "").cleaned,
    kind:     r.kind,
    priority: r.priority,
  })).filter((r) => r.rule !== "");
}

// feedback → judgment_rules 抽出・保存（best-effort）。
export async function extractAndSaveJudgmentRules(
  supabase: SupabaseClient,
  userId: string,
  threadId: string,
  feedbackKind: string,
  feedbackNote: string,
): Promise<void> {
  // 既存ルール（重複/矛盾回避のため抽出器に渡す）
  const { data: existing } = await supabase
    .from("judgment_rules")
    .select("rule, kind")
    .eq("user_id", userId)
    .limit(50) as unknown as { data: { rule: string; kind: string }[] | null };
  const existingRules = existing ?? [];

  const extracted = await extractJudgmentRules({
    feedbackKind,
    feedbackNote,
    existingRules,
  });
  if (extracted.length === 0) return;

  // 完全一致の重複は除外（同義回避は抽出器側に任せ、ここは素朴な exact 防御）。
  const existingTexts = new Set(existingRules.map((r) => r.rule.trim()));
  const rows = extracted
    .filter((r) => !existingTexts.has(r.rule.trim()))
    .map((r) => ({
      user_id:                  userId,
      rule:                     stripCanonicalSlugs(r.rule).cleaned,
      kind:                     r.kind,
      priority:                 r.priority,
      extracted_from_thread_id: threadId,
    }))
    .filter((r) => r.rule !== "");
  if (rows.length === 0) return;

  await supabase.from("judgment_rules").insert(rows as never);
}
