// Sprint H-4b1-a リグレッションテスト(再帰 strip + JSON parse フォールバック)
//
// 実行: npx tsx scripts/test-h4b1a-privacy-fallback.ts
// 終了コード: 全件成功で 0・1 件でも失敗で 1
//
// 【検証カバレッジ】docs/STYLE-SELF_Sprint-H-4b_..._細部設計調査.md(2f9886e)追加論点
//   strip-1 : 既存挙動(単一文字列)スラッグ除去
//   strip-2 : スラッグ無し文字列は不変
//   strip-3 : 配列内文字列を再帰除去
//   strip-4 : オブジェクト内文字列を再帰除去
//   strip-5 : ネスト(配列の配列 / オブジェクトの配列)再帰除去
//   strip-6 : number / boolean / null / undefined を構造保持
//   strip-7 : ★ privacy 退行ゼロ — PRODUCT_WORLDVIEW_TAGS 全 31 語が深いネストでも漏洩しない
//   has-1   : hasCanonicalSlug が検出する / しない
//   parse-1 : 正しい CoordinateReply JSON → coordinate 返却
//   parse-2 : コードフェンス付き JSON → 抽出して coordinate
//   parse-3 : 非 JSON(旧プロース)→ fallbackText
//   parse-4 : 壊れた JSON → fallbackText
//   parse-5 : JSON だがスキーマ不一致(必須欠落)→ fallbackText

import {
  stripCanonicalSlugs,
  stripCanonicalSlugsRecursive,
  hasCanonicalSlug,
} from "../lib/utils/strip-canonical-slugs";
import { parseCoordinateReply } from "../lib/utils/parse-coordinate-reply";
import { PRODUCT_WORLDVIEW_TAGS } from "../lib/knowledge/product-worldview-tags";
import type { CoordinateReply } from "../types/coordinate-reply";

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}`); }
}

console.log("== H-4b1-a: 再帰 strip + parse フォールバック ==");

// ---- strip ----
check("strip-1 単一文字列でスラッグ除去", stripCanonicalSlugs("これは minimal な服").removed === true);
check("strip-2 スラッグ無しは不変", stripCanonicalSlugs("これは静かな服").removed === false);

const arr = stripCanonicalSlugsRecursive(["minimal な服", "普通の服"]) as string[];
check("strip-3 配列内を再帰除去", !arr[0].includes("minimal") && arr[1] === "普通の服");

const obj = stripCanonicalSlugsRecursive({ a: "gothic テイスト", b: "和風" }) as { a: string; b: string };
check("strip-4 オブジェクト内を再帰除去", !obj.a.includes("gothic") && obj.b === "和風");

const nested = stripCanonicalSlugsRecursive({
  items: [{ description: "dark で minimal" }, { description: "明るい" }],
  meta: { tags: ["preppy", "無地"] },
}) as { items: { description: string }[]; meta: { tags: string[] } };
check(
  "strip-5 ネスト再帰除去",
  !nested.items[0].description.includes("dark") &&
  !nested.items[0].description.includes("minimal") &&
  !nested.meta.tags[0].includes("preppy") &&
  nested.meta.tags[1] === "無地",
);

const preserved = stripCanonicalSlugsRecursive({ n: 42, b: true, z: null, u: undefined }) as Record<string, unknown>;
check("strip-6 非文字列を構造保持", preserved.n === 42 && preserved.b === true && preserved.z === null && preserved.u === undefined);

// strip-7: ★ 全 31 語が深いネストでも漏洩しない
const deepWithAllSlugs = {
  level1: { level2: PRODUCT_WORLDVIEW_TAGS.map((t) => ({ text: `これは ${t} な雰囲気` })) },
};
const cleaned7 = stripCanonicalSlugsRecursive(deepWithAllSlugs);
check("strip-7 ★ 全31語 深いネストで漏洩ゼロ", hasCanonicalSlug(cleaned7) === false);

// ---- hasCanonicalSlug ----
check("has-1a スラッグ検出", hasCanonicalSlug({ x: ["a", "gothic"] }) === true);
check("has-1b 非検出", hasCanonicalSlug({ x: ["a", "和風"] }) === false);

// ---- parse ----
const valid: CoordinateReply = {
  type: "coordinate_v2",
  direction: "方向性", summary: "要約",
  items: [{ category: "トップス", description: "黒ニット" }],
  sources: [], quickActions: [{ label: "もっと日常的に", prompt: "もっと日常的に" }],
  customActions: [], imageAnalysis: [], items11: [], koRules: [],
  promptDebug: { systemPrompt: "", userPrompt: "" },
};
const r1 = parseCoordinateReply(JSON.stringify(valid));
check("parse-1 正しい JSON → coordinate", r1.coordinate?.type === "coordinate_v2" && r1.fallbackText === undefined);

const r2 = parseCoordinateReply("```json\n" + JSON.stringify(valid) + "\n```");
check("parse-2 コードフェンス付き → 抽出成功", r2.coordinate?.direction === "方向性");

const r3 = parseCoordinateReply("黒のロングコートに白ニットを合わせると…");
check("parse-3 非 JSON → fallbackText", r3.fallbackText !== undefined && r3.coordinate === undefined);

const r4 = parseCoordinateReply('{ "type": "coordinate_v2", "direction": ');
check("parse-4 壊れた JSON → fallbackText", r4.fallbackText !== undefined && r4.coordinate === undefined);

const r5 = parseCoordinateReply('{ "type": "coordinate_v2", "direction": "x" }');  // items/sources 等 欠落
check("parse-5 スキーマ不一致 → fallbackText", r5.fallbackText !== undefined && r5.coordinate === undefined);

console.log(`\n== 結果: ${pass} PASS / ${fail} FAIL ==`);
process.exit(fail === 0 ? 0 : 1);
