#!/usr/bin/env tsx
// ③-c / 高速化 比較ツール: stylist-chat の KO 連携を 3方式で同一発話に通し、
// 最終 reply・使った rules・レイテンシ・品質ゲート mode・薄さ指標を並べる。
//   - get_*           : fetchKnowledgeOSContext（現状ベースライン）
//   - query_knowledge : fetchKnowledgeOSViaQueryKnowledge（合成あり・遅い・旧案）
//   - search_knowledge: fetchKnowledgeOSViaSearchKnowledge（合成なし・速い・新案）
//
// 設計: docs/phase3c-style-self-query-knowledge-plan.md §4-3 + search_knowledge 高速化。
// ・フラグに依らず各経路を直接呼ぶ（route の生成ロジックは lib/stylist-chat/context.ts に抽出済・挙動不変）。
// ・intent context は全方式で同一 baseline（差は KO 部分のみ）。
// ・query_knowledge / search_knowledge は品質ゲート（systemPrompt 自己チェック）+ resolveGatedReply を適用。
// ・(C) QK/search の koRequestId を KO の rule_applications で引いて記録 ✓/✗（KO Supabase env がある時のみ）。
//
// 前提:
//   - KO(:3001) 稼働（query_knowledge / search_knowledge 実呼び）。style-self .env.local の KNOWLEDGE_OS_URL/API_KEY を使う。
//   - service-role で style-self Supabase を読む（intent fetcher は明示 .eq(userId) なので RLS 不要）。
//   - 診断完了ユーザー（worldview_profiles に行がある）が対象。--user で明示も可。
//   - (C)の記録確認は KO_SUPABASE_URL / KO_SUPABASE_SERVICE_ROLE_KEY が両方ある時のみ実行。
//
// 実行（IPv4優先必須・重いので順次）:
//   set -a; source .env.local; set +a
//   # (任意) KO 記録確認するなら KO の Supabase を別名で:
//   #   export KO_SUPABASE_URL=...; export KO_SUPABASE_SERVICE_ROLE_KEY=...
//   NODE_OPTIONS=--dns-result-order=ipv4first npx tsx scripts/compare-chat.ts                 # 3方式
//   NODE_OPTIONS=--dns-result-order=ipv4first npx tsx scripts/compare-chat.ts --skip-qk --only A  # get_* vs search のみ(速い)
//   NODE_OPTIONS=--dns-result-order=ipv4first npx tsx scripts/compare-chat.ts --n 3 --user <uuid>

import { createClient } from "@supabase/supabase-js";
import {
  fetchDiagnoseContext,
  fetchStyleConsultContext,
  fetchCoordinateContext,
  fetchBrandLearnContext,
  fetchKnowledgeOSContext,
  fetchKnowledgeOSViaQueryKnowledge,
  fetchKnowledgeOSViaSearchKnowledge,
  stripCanonicalSlugs,
} from "@/lib/stylist-chat/context";
import {
  STYLIST_CHAT_SYSTEM_PROMPT,
  buildStylistChatUserMessage,
  buildQualityGateInstruction,
  type StylistChatContext,
} from "@/lib/prompts/stylist-chat";
import { parseGatedReply, applyThinGate } from "@/lib/utils/parse-gated-reply";
import { callClaude, HAIKU_MODEL } from "@/lib/claude";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が未設定です（set -a; source .env.local; set +a）。");
  process.exit(1);
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY が未設定です（reply 生成に必要）。");
  process.exit(1);
}

const onlyArg = process.argv.indexOf("--only");
const ONLY = onlyArg >= 0 ? (process.argv[onlyArg + 1] ?? "").toUpperCase() : "";
const userArg = process.argv.indexOf("--user");
const USER_OPT = userArg >= 0 ? process.argv[userArg + 1] : undefined;
const nArg = process.argv.indexOf("--n");
const N_LIMIT = nArg >= 0 ? Number(process.argv[nArg + 1]) || 999 : 999;
// query_knowledge は遅い(57-120s)ので除外して get_* と search_knowledge の2方式だけ速く回すオプション。
const SKIP_QK = process.argv.includes("--skip-qk");

const MAX_REPLY_TOKENS = 2048; // route の非MB値に合わせる
const ACTIONABLE_RE = /着|合わせ|足す|避け|抜く|外す|入れ|変え|寄せ|崩/;

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// (C) KO 側 Supabase（別プロジェクト・rule_applications 記録確認用）。env が無ければ null。
const KO_URL = process.env.KO_SUPABASE_URL;
const KO_KEY = process.env.KO_SUPABASE_SERVICE_ROLE_KEY;
const koSb = KO_URL && KO_KEY ? createClient(KO_URL, KO_KEY, { auth: { persistSession: false } }) : null;

type Method = "get_*" | "query_knowledge" | "search_knowledge";

const QUESTIONS: { id: string; q: string; intent: string }[] = [
  // A系（明確）
  { id: "A1", q: "全身黒で重心を下げたい", intent: "coordinate" },
  { id: "A2", q: "マットな素材で世界観を強くしたい", intent: "style-consult" },
  { id: "A3", q: "白Tとワイドパンツを、普通に見せず世界観化したい", intent: "coordinate" },
  { id: "A4", q: "ブランドの世界観を一貫させたい", intent: "brand-learn" },
  { id: "A5", q: "診断結果を踏まえて、次に何を足せばいい？", intent: "diagnose" },
  // B系（口語）
  { id: "B1", q: "なんか普通に見えるんだけどどうしたらいい？", intent: "style-consult" },
  { id: "B2", q: "この服、自分に合う？", intent: "style-consult" },
  { id: "B3", q: "黒でかっこよくしたいけど重く見える", intent: "coordinate" },
  { id: "B4", q: "もっと尖らせたい", intent: "style-consult" },
  { id: "B5", q: "小物って何足せばいい？", intent: "coordinate" },
];

async function intentContext(userId: string, intent: string): Promise<StylistChatContext> {
  switch (intent) {
    case "style-consult": return fetchStyleConsultContext(sb as never, userId);
    case "coordinate":    return fetchCoordinateContext(sb as never, userId);
    case "brand-learn":   return fetchBrandLearnContext(sb as never, userId);
    default:              return fetchDiagnoseContext(sb as never, userId);
  }
}

interface RunResult {
  reply: string;
  ko: StylistChatContext["knowledgeOS"];
  requestId: string | null;
  safeMode: boolean;
  mode: "answer" | "safe" | null; // QK のみ
  koMs: number;
  totalMs: number;
}

async function runOne(userId: string, text: string, intent: string, method: Method): Promise<RunResult> {
  const t0 = Date.now();
  const baseCtx = await intentContext(userId, intent);

  const k0 = Date.now();
  let ko: StylistChatContext["knowledgeOS"];
  let requestId: string | null = null;
  let safeMode = false;
  if (method === "get_*") {
    ko = await fetchKnowledgeOSContext(text);
  } else if (method === "query_knowledge") {
    const r = await fetchKnowledgeOSViaQueryKnowledge(text);
    ko = r.knowledgeOS;
    requestId = r.requestId;
    safeMode = r.safeMode;
  } else {
    // search_knowledge（合成なし・高速）
    const r = await fetchKnowledgeOSViaSearchKnowledge(text);
    ko = r.knowledgeOS;
    requestId = r.requestId;
    safeMode = r.safeMode;
  }
  const koMs = Date.now() - k0;

  // 品質ゲートは query_knowledge / search_knowledge（rules主素材）に適用。get_* は従来 raw。
  const useGate = method !== "get_*";
  const ctx: StylistChatContext = { ...baseCtx, knowledgeOS: ko };
  const systemPrompt = useGate
    ? `${STYLIST_CHAT_SYSTEM_PROMPT}\n\n${buildQualityGateInstruction({ forceSafe: safeMode })}`
    : STYLIST_CHAT_SYSTEM_PROMPT;
  const userMessage = buildStylistChatUserMessage({ text, intent, history: [], ctx });

  const replyRaw = await callClaude({ systemPrompt, userMessage, model: HAIKU_MODEL, maxTokens: MAX_REPLY_TOKENS });

  let mode: "answer" | "safe" | null = null;
  let replyForOutput = replyRaw;
  if (useGate) {
    const gated = parseGatedReply(replyRaw);
    mode = gated.mode;
    replyForOutput = applyThinGate(gated);
  }
  const reply = stripCanonicalSlugs(replyForOutput).cleaned;
  return { reply, ko, requestId, safeMode, mode, koMs, totalMs: Date.now() - t0 };
}

function rulesSummary(ko: StylistChatContext["knowledgeOS"]): string {
  if (!ko) return "（KO context なし＝安全モード）";
  const parts: string[] = [];
  parts.push(`decision ${ko.decisionRules.length}`);
  if (ko.decisionRules[0]) parts.push(`先頭"${clip(ko.decisionRules[0].rule, 28)}"`);
  parts.push(`failure ${ko.failurePatterns.length}`);
  parts.push(`influence ${ko.influences.length}`);
  if (ko.relatedEntries) parts.push(`related ${ko.relatedEntries.length}`);
  if (ko.answerSummary) parts.push(`answer補助"${clip(ko.answerSummary, 24)}"`);
  return parts.join(" / ");
}

function thinMetrics(reply: string): string {
  const len = reply.length;
  const actionable = ACTIONABLE_RE.test(reply) ? "有" : "無";
  const extremeShort = len < 12 ? "★極端短文" : "no";
  return `len ${len} / actionable語 ${actionable} / 極端短文 ${extremeShort}`;
}

const clip = (s: string, n: number) => (s ?? "").replace(/\s+/g, " ").slice(0, n);

async function checkRuleApplications(requestId: string | null): Promise<string> {
  if (!requestId) return "request_id なし（安全モード or 失敗）";
  if (!koSb) return "（KO_SUPABASE_URL/KEY 未設定＝記録確認スキップ）";
  try {
    const { count, error } = await koSb
      .from("rule_applications")
      .select("id", { count: "exact", head: true })
      .eq("request_id", requestId);
    if (error) return `✗ 確認エラー: ${error.message}`;
    return (count ?? 0) > 0 ? `✓ rule_applications ${count}行 記録あり` : "✗ 0行（記録なし）";
  } catch (e) {
    return `✗ 確認例外: ${e instanceof Error ? e.message : String(e)}`;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// NAT64 の間欠 "fetch failed" 対策。data が取れるまで最大4回リトライ（error/throw を握って再試行）。
async function selectWithRetry(
  label: string,
  run: () => PromiseLike<unknown>,
): Promise<unknown[]> {
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const { data, error } = (await run()) as {
        data: unknown;
        error: { message?: string } | null;
      };
      if (!error && data != null) return data as unknown[];
      if (error) console.warn(`  ⚠ ${label} (${attempt}/4): ${error.message ?? "error"}`);
    } catch (e) {
      console.warn(`  ⚠ ${label} (${attempt}/4): ${e instanceof Error ? e.message : String(e)}`);
    }
    if (attempt < 4) await sleep(1200);
  }
  return [];
}

// 対象 userId を決める。優先: 診断完了ユーザー（worldview_profiles）。無ければ users から。
// intent fetcher は診断が無くても null context で動くので、最小条件は「有効な user_id 1つ」。
async function detectUserId(): Promise<string> {
  if (USER_OPT) return USER_OPT;

  // 1) 診断完了ユーザー（推奨・worldview_profiles）
  const wp = (await selectWithRetry("worldview_profiles 検出", () =>
    sb.from("worldview_profiles").select("user_id").limit(50),
  )) as { user_id: string }[];
  const wpIds = Array.from(new Set(wp.map((r) => r.user_id)));
  if (wpIds.length === 1) {
    console.log(`対象ユーザー: ${wpIds[0]}（診断完了・worldview_profiles）`);
    return wpIds[0];
  }
  if (wpIds.length > 1) {
    console.error(`診断完了ユーザーが複数（${wpIds.length}）。--user <uuid> で指定してください: ${wpIds.join(", ")}`);
    process.exit(1);
  }

  // 2) フォールバック: users（診断未完了でも intent fetcher は null context で動く）
  console.warn("worldview_profiles に診断完了ユーザーが見つからないため users にフォールバックします。");
  const us = (await selectWithRetry("users 検出", () =>
    sb.from("users").select("id").limit(50),
  )) as { id: string }[];
  const ids = Array.from(new Set(us.map((r) => r.id)));
  if (ids.length === 0) {
    console.error("users も取得できませんでした（NAT64 fetch failed の可能性）。NODE_OPTIONS=--dns-result-order=ipv4first を付け、--user <uuid> で指定してください。");
    process.exit(1);
  }
  if (ids.length > 1) {
    console.error(`users が複数（${ids.length}）。--user <uuid> で指定してください。`);
    process.exit(1);
  }
  console.log(`対象ユーザー: ${ids[0]}（users・診断未完了の可能性）`);
  return ids[0];
}

async function main() {
  const userId = await detectUserId();
  const sets = QUESTIONS
    .filter((q) => (ONLY === "A" ? q.id.startsWith("A") : ONLY === "B" ? q.id.startsWith("B") : true))
    .slice(0, N_LIMIT);

  // 3方式（get_* / query_knowledge / search_knowledge）。--skip-qk で query_knowledge を除外。
  const methods: { method: Method; label: string }[] = [
    { method: "get_*", label: "get_*(現状)" },
    ...(SKIP_QK ? [] : [{ method: "query_knowledge" as Method, label: "query_knowledge(合成・遅)" }]),
    { method: "search_knowledge", label: "search_knowledge(合成なし・速)" },
  ];

  console.log(
    `比較対象 user=${userId} / 質問 ${sets.length}問 / 方式 ${methods.map((m) => m.label).join(" / ")} / KO記録確認=${koSb ? "ON" : "OFF"}` +
      (SKIP_QK ? "（--skip-qk: query_knowledge 除外）" : "") +
      "\n",
  );

  for (let i = 0; i < sets.length; i++) {
    const { id, q, intent } = sets[i];
    console.log(`\n================ ${id} [${intent}]: ${q} ================`);

    for (const { method, label } of methods) {
      try {
        const r = await runOne(userId, q, intent, method);
        const gateInfo =
          method === "get_*"
            ? ""
            : ` | gate mode: ${r.mode ?? "n/a"}${r.safeMode ? " (KO取得失敗→forceSafe)" : ""}`;
        console.log(`── [${label}]  KO ${r.koMs}ms / total ${r.totalMs}ms${gateInfo}`);
        console.log(`   rules: ${rulesSummary(r.ko)}`);
        console.log(`   [薄さ] ${thinMetrics(r.reply)}`);
        console.log(`   reply: ${r.reply}`);
        if (method !== "get_*") {
          console.log(`   [記録] ${await checkRuleApplications(r.requestId)}`);
        }
      } catch (e) {
        console.warn(`   [${label}] 失敗: ${e instanceof Error ? e.message : e}`);
      }
    }
  }

  console.log("\n========== 比較完了 ==========");
  console.log("8評価軸（直接回答/具体性/世界観色素材シルエット着方/足す避ける/KO判断軸の自然さ/長いだけで薄くない/ゴミ無し/レイテンシ）で目視採点してください。");
  console.log("特に: query_knowledge と search_knowledge で reply 品質が同等か（合成省略で落ちないか）× KO レイテンシ差。");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
