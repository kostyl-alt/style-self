// /api/ai/analyze-v2 のスモークテスト
// 実行: npx tsx scripts/test-analyze-v2.ts
// 事前: STYLE-SELF dev server (localhost:3000) と Knowledge OS dev server (localhost:3001)
//       の両方を起動し、style-self/.env.local に
//       KNOWLEDGE_OS_API_KEY / ANTHROPIC_API_KEY を設定しておくこと。
//
// 既存 analyze と並べて比較できるよう、サンプル回答は同一値を用いる。

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

// 16問のサンプル回答 (rebel-creator / night-gravitas 寄りの暗・深方向)
const SAMPLE_ANSWERS = [
  { questionId: "q1",  optionIds: ["q1f"] },                   // 色気や深さを感じる
  { questionId: "q2",  optionIds: ["q2a", "q2d"] },            // 量産型・派手すぎ
  { questionId: "q3",  optionIds: ["q3e"] },                   // 距離感を調整
  { questionId: "q4",  optionIds: ["q4e"] },                   // 色気を出したい
  { questionId: "q5",  optionIds: ["q5a"], reasonIds: [] },    // (理由はサンプルでは空)
  { questionId: "q6",  optionIds: ["q6a"] },
  { questionId: "q7",  optionIds: ["q7a", "q7b"] },
  { questionId: "q8",  optionIds: ["q8a", "q8b"] },
  { questionId: "q9",  optionIds: ["q9a"] },
  { questionId: "q10", optionIds: ["q10a"] },
  { questionId: "q11", optionIds: ["q11a"] },
  { questionId: "q12", optionIds: ["q12a"] },
  { questionId: "q13", optionIds: ["q13a"] },
  { questionId: "q14", optionIds: ["q14a"] },                  // 困りごと
  { questionId: "q15", optionIds: [], freeText: "夜に似合う静かな深さが欲しい" },
  { questionId: "q16", optionIds: ["q16a"] },                  // 着たくない服
];

const ENDPOINT = process.env.STYLE_SELF_URL ?? "http://localhost:3000/api/ai/analyze-v2";

async function main() {
  console.log("[test-analyze-v2] endpoint =", ENDPOINT);
  console.log("[test-analyze-v2] answers count =", SAMPLE_ANSWERS.length);

  const started = Date.now();
  const res = await fetch(ENDPOINT, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ answers: SAMPLE_ANSWERS }),
  });
  const elapsedMs = Date.now() - started;

  console.log(`\n[test-analyze-v2] HTTP ${res.status}  elapsed=${elapsedMs}ms`);

  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    console.log("[test-analyze-v2] response is not JSON:");
    console.log(text.slice(0, 2000));
    return;
  }

  // 重要フィールドを順番に表示
  const r = parsed as Record<string, unknown>;
  console.log("\n--- worldviewName ---");
  console.log(r.worldviewName);
  console.log("\n--- worldview_keywords ---");
  console.log(r.worldview_keywords);
  console.log("\n--- worldview_tags ---");
  console.log(r.worldview_tags);
  console.log("\n--- unconsciousTendency ---");
  console.log(r.unconsciousTendency);
  console.log("\n--- idealSelf ---");
  console.log(r.idealSelf);
  console.log("\n--- avoidedImpression ---");
  console.log(r.avoidedImpression);
  console.log("\n--- attractedCulture ---");
  console.log(r.attractedCulture);
  console.log("\n--- recommendedColors ---");
  console.log(r.recommendedColors);
  console.log("\n--- recommendedMaterials ---");
  console.log(r.recommendedMaterials);
  console.log("\n--- recommendedSilhouettes ---");
  console.log(r.recommendedSilhouettes);
  console.log("\n--- recommendedAccessories ---");
  console.log(r.recommendedAccessories);
  console.log("\n--- recommendedBrands ---");
  console.log(r.recommendedBrands);
  console.log("\n--- culturalAffinities ---");
  console.log(r.culturalAffinities);
  console.log("\n--- firstPiece ---");
  console.log(r.firstPiece);
  console.log("\n--- relatedInfluencers ---");
  console.log(r.relatedInfluencers);

  if (Array.isArray(r._timings)) {
    console.log("\n--- _timings (server-side perf.now) ---");
    for (const t of r._timings as { label: string; ms: number; cum_ms: number }[]) {
      console.log(`  ${String(t.ms).padStart(7)}ms  (cum ${String(t.cum_ms).padStart(7)}ms)  ${t.label}`);
    }
  }

  console.log("\n[test-analyze-v2] DONE");
}

main().catch((err) => {
  console.error("[test-analyze-v2] FAILED:", err);
  process.exit(1);
});
