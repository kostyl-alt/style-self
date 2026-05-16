// /api/ai/analyze-v2 の偏り検証スクリプト
// 実行: npx tsx scripts/test-analyze-v2-multi.ts
//
// 3つの対照的な回答パターン(A: 明るい / B: 可愛い / C: ミニマル知的) を
// 順次投げ、worldviewName・色・関連影響源・レイテンシを比較表示する。
//
// 注意: 1パターン約100秒、合計5分前後かかる可能性あり。

import { readFileSync } from "node:fs";
import { join } from "node:path";

try {
  const envText = readFileSync(join(process.cwd(), ".env.local"), "utf8");
  for (const line of envText.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
} catch {
  // .env.local が無くても続行
}

interface AnswerInput {
  questionId: string;
  optionIds:  string[];
  reasonIds?: string[];
  freeText?:  string;
}

interface TestPattern {
  label:   string;
  answers: AnswerInput[];
}

// === Pattern A: 明るい・カラフル・社交的 =================================
// 「人前に出るのが好き」「目立ちたい」「カラフル・ポップ」
const PATTERN_A: TestPattern = {
  label: "A: 明るい・カラフル・社交的",
  answers: [
    { questionId: "q1",  optionIds: ["q1a"] },             // 近づきやすい安心感
    { questionId: "q2",  optionIds: ["q2c", "q2g"] },      // 地味・気取っている を避けたい
    { questionId: "q3",  optionIds: ["q3c"] },             // 気分を切り替えてくれる
    { questionId: "q4",  optionIds: ["q4a"] },             // もう少し目立っていい
    { questionId: "q5",  optionIds: ["q5b"] },             // 特にない
    { questionId: "q6",  optionIds: ["q6b"] },             // 色
    { questionId: "q7",  optionIds: ["q7b", "q7g"] },      // ライブハウス / スタジアム
    { questionId: "q8",  optionIds: ["q8b", "q8f"] },      // Y2K / NY・LA
    { questionId: "q9",  optionIds: ["q9c"] },             // 自由でエネルギーがある
    { questionId: "q10", optionIds: ["q10d"] },            // テンポが速くてハイな感じ
    { questionId: "q11", optionIds: ["q11d"] },            // 甘くてフローラル
    { questionId: "q12", optionIds: ["q12d"] },            // 鮮やかで強い色
    { questionId: "q13", optionIds: ["q13b"] },            // やわらかくてくったり
    { questionId: "q14", optionIds: ["q14a"] },            // 何を合わせていいかわからない
    {
      questionId: "q15",
      optionIds:  [],
      freeText:   "カラフルなのに洗練されてる人。NYブルックリンの公園で見るような自由さ",
    },
    { questionId: "q16", optionIds: ["q16a", "q16g"] },    // タイトすぎる / きれいめすぎるスーツ
  ],
};

// === Pattern B: 可愛い・フェミニン・やわらかい ============================
// 「親しみやすさ重視」「柔らかい印象になりたい」「ロマンティック」
const PATTERN_B: TestPattern = {
  label: "B: 可愛い・フェミニン・やわらかい",
  answers: [
    { questionId: "q1",  optionIds: ["q1a"] },             // 近づきやすい安心感
    { questionId: "q2",  optionIds: ["q2d", "q2g"] },      // 派手すぎ・気取っている を避けたい
    { questionId: "q3",  optionIds: ["q3c"] },             // 気分を切り替えてくれる
    { questionId: "q4",  optionIds: ["q4c"] },             // もう少し大人っぽく
    { questionId: "q5",  optionIds: ["q5a"], reasonIds: ["q5a3"] }, // ある(着こなす自信がない)
    { questionId: "q6",  optionIds: ["q6b"] },             // 色
    { questionId: "q7",  optionIds: ["q7e", "q7f"] },      // 自然・森・海 / 静かなカフェ
    { questionId: "q8",  optionIds: ["q8d", "q8e"] },      // 韓国 / ヨーロッパ
    { questionId: "q9",  optionIds: ["q9d"] },             // 温かくて人間的
    { questionId: "q10", optionIds: ["q10c"] },            // メロディアスで感情的
    { questionId: "q11", optionIds: ["q11d"] },            // 甘くてフローラル
    { questionId: "q12", optionIds: ["q12e"] },            // パステル・やわらかい色
    { questionId: "q13", optionIds: ["q13b"] },            // やわらかくてくったり
    { questionId: "q14", optionIds: ["q14c"] },            // 着たい服が似合わない
    {
      questionId: "q15",
      optionIds:  [],
      freeText:   "春の朝のような柔らかさを持つ人。優しい色合いを纏える人になりたい",
    },
    { questionId: "q16", optionIds: ["q16c", "q16f"] },    // ロゴ・スウェット
  ],
};

// === Pattern C: ミニマル・知的・静か ======================================
// 「削ぎ落とし」「構造」「無彩色寄り」(前回の「夜の輪郭」と方向は近いが別の選択肢)
const PATTERN_C: TestPattern = {
  label: "C: ミニマル・知的・静か",
  answers: [
    { questionId: "q1",  optionIds: ["q1d"] },             // 清潔で整った信頼感
    { questionId: "q2",  optionIds: ["q2a", "q2d"] },      // 量産型・派手すぎ を避けたい
    { questionId: "q3",  optionIds: ["q3g"] },             // 何も考えなくても整って見せてくれる
    { questionId: "q4",  optionIds: ["q4f"] },             // 今の方向性をもっと洗練させたい
    { questionId: "q5",  optionIds: ["q5b"] },             // 特にない
    { questionId: "q6",  optionIds: ["q6a"] },             // 形・シルエット
    { questionId: "q7",  optionIds: ["q7a", "q7f"] },      // 美術館・ギャラリー / 静かなカフェ
    { questionId: "q8",  optionIds: ["q8c", "q8e"] },      // 現代ミニマル / ヨーロッパ
    { questionId: "q9",  optionIds: ["q9b"] },             // 静かで詩的
    { questionId: "q10", optionIds: ["q10a"] },            // ミニマルで静かな音楽
    { questionId: "q11", optionIds: ["q11b"] },            // クリーンで石けん
    { questionId: "q12", optionIds: ["q12b"] },            // 白・グレー・無彩色
    { questionId: "q13", optionIds: ["q13a"] },            // ハリがあって形が決まる
    { questionId: "q14", optionIds: ["q14b"] },            // 似たような服ばかりになる
    {
      questionId: "q15",
      optionIds:  [],
      freeText:   "美術館の白壁に佇むキュレーターのような静けさを持つ人",
    },
    { questionId: "q16", optionIds: ["q16c", "q16d", "q16e"] }, // ロゴ・フリル・光沢
  ],
};

const ALL_PATTERNS = [PATTERN_A, PATTERN_B, PATTERN_C];
const ENDPOINT = process.env.STYLE_SELF_URL ?? "http://localhost:3000/api/ai/analyze-v2";

interface PatternResult {
  label:          string;
  status:         number;
  elapsedMs:      number;
  worldviewName?: string;
  worldview_keywords?: string[];
  recommendedColors?:  string[];
  recommendedMaterials?: string[];
  relatedInfluencers?: { subject_name: string; reason: string }[];
  unconsciousTendency?: string;
  attractedCulture?:    string;
  firstPieceName?:      string;
  rawError?:    string;
}

async function runOne(pat: TestPattern): Promise<PatternResult> {
  console.log(`\n========================================`);
  console.log(`[${pat.label}] starting...`);
  console.log(`========================================`);

  const started = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 300_000); // 5分タイムアウト

  try {
    const res = await fetch(ENDPOINT, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ answers: pat.answers }),
      signal:  ctrl.signal,
    });
    const elapsedMs = Date.now() - started;
    const text = await res.text();

    if (!res.ok) {
      return { label: pat.label, status: res.status, elapsedMs, rawError: text.slice(0, 500) };
    }
    const r = JSON.parse(text) as Record<string, unknown>;
    const result: PatternResult = {
      label:                pat.label,
      status:               res.status,
      elapsedMs,
      worldviewName:        r.worldviewName as string | undefined,
      worldview_keywords:   r.worldview_keywords as string[] | undefined,
      recommendedColors:    r.recommendedColors as string[] | undefined,
      recommendedMaterials: r.recommendedMaterials as string[] | undefined,
      relatedInfluencers:   r.relatedInfluencers as { subject_name: string; reason: string }[] | undefined,
      unconsciousTendency:  r.unconsciousTendency as string | undefined,
      attractedCulture:     r.attractedCulture as string | undefined,
      firstPieceName:       ((r.firstPiece as Record<string, unknown> | undefined)?.name) as string | undefined,
    };

    console.log(`  HTTP ${res.status}  elapsed=${(elapsedMs / 1000).toFixed(1)}s`);
    console.log(`  worldviewName: ${result.worldviewName}`);
    console.log(`  keywords:      ${(result.worldview_keywords ?? []).join(", ")}`);
    console.log(`  colors[0..3]:  ${(result.recommendedColors ?? []).slice(0, 3).join(", ")}`);
    console.log(`  materials[0..3]: ${(result.recommendedMaterials ?? []).slice(0, 3).join(", ")}`);
    console.log(`  influencers:   ${(result.relatedInfluencers ?? []).map((i) => i.subject_name).join(" / ")}`);
    return result;
  } catch (err) {
    const elapsedMs = Date.now() - started;
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`  FAILED  elapsed=${(elapsedMs / 1000).toFixed(1)}s  err=${msg}`);
    return { label: pat.label, status: 0, elapsedMs, rawError: msg };
  } finally {
    clearTimeout(timer);
  }
}

function truncate(s: string | undefined, n: number): string {
  if (!s) return "-";
  return s.length > n ? s.slice(0, n) + "…" : s;
}

function printComparison(rows: PatternResult[]) {
  console.log("\n\n========================================");
  console.log("=== 3パターン比較サマリ ===");
  console.log("========================================");
  const headers = ["項目", ...rows.map((r) => r.label.split(":")[0])];
  console.log(`\n${headers.join(" | ")}`);
  console.log(headers.map(() => "---").join("-|-"));

  const fmt = (vals: (string | undefined)[]) => vals.map((v) => truncate(v, 50)).join(" | ");

  console.log(`worldviewName     | ${fmt(rows.map((r) => r.worldviewName))}`);
  console.log(`keywords          | ${fmt(rows.map((r) => (r.worldview_keywords ?? []).join("・")))}`);
  console.log(`colors[0..3]      | ${fmt(rows.map((r) => (r.recommendedColors ?? []).slice(0, 3).join("・")))}`);
  console.log(`materials[0..3]   | ${fmt(rows.map((r) => (r.recommendedMaterials ?? []).slice(0, 3).join("・")))}`);
  console.log(`influencers       | ${fmt(rows.map((r) => (r.relatedInfluencers ?? []).map((i) => i.subject_name).join("/")))}`);
  console.log(`firstPiece        | ${fmt(rows.map((r) => r.firstPieceName))}`);
  console.log(`attractedCulture  | ${fmt(rows.map((r) => r.attractedCulture))}`);
  console.log(`elapsed(s)        | ${rows.map((r) => (r.elapsedMs / 1000).toFixed(1)).join(" | ")}`);

  console.log(`\n--- unconsciousTendency 全文 ---`);
  for (const r of rows) {
    console.log(`\n[${r.label}]\n${r.unconsciousTendency ?? "-"}`);
  }
}

async function main() {
  console.log(`[multi] endpoint = ${ENDPOINT}`);
  console.log(`[multi] patterns = ${ALL_PATTERNS.length}`);

  const results: PatternResult[] = [];
  for (const pat of ALL_PATTERNS) {
    const r = await runOne(pat);
    results.push(r);
  }

  printComparison(results);
  console.log("\n[multi] DONE");
}

main().catch((err) => {
  console.error("[multi] FAILED:", err);
  process.exit(1);
});
