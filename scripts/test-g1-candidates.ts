// Sprint G-1 リグレッションテスト(候補プロンプト組立 + privacy strip)
//
// 実行: npx tsx scripts/test-g1-candidates.ts
// 終了コード: 全件成功で 0・1 件でも失敗で 1
//
// ★ route(/api/products/candidates)は Supabase + 楽天 + Anthropic への実接続が要るため、
//   本テストは ★ 純粋関数(プロンプト組立 / 型 / privacy)を検証する(CI セーフ)。
//   実 API 動作確認は route の curl(報告の verify 手順)で行う。
//
// 【検証カバレッジ】
//   kw-1  : KEYWORD_EXTRACTION_SYSTEM が JSON 強制 + 禁止語明示を含む
//   kw-2  : buildKeywordExtractionUser が moodboard サマリを反映
//   sr-1  : buildScoreReasoningUser が候補商品を index 付きで列挙
//   sr-2  : SCORE_REASONING_SYSTEM が 0-100 + reasoning ルールを含む
//   cat-1 : CANDIDATE_CATEGORIES が 5 カテゴリ(hair/makeup 除外)
//   priv-1: CandidatesResponse の reasoning 等に英語スラッグが混入しても再帰 strip で除去

import {
  CANDIDATE_CATEGORIES,
  KEYWORD_EXTRACTION_SYSTEM,
  buildKeywordExtractionUser,
  SCORE_REASONING_SYSTEM,
  buildScoreReasoningUser,
  type MoodboardSummaryForCandidates,
  type CandidateForScoring,
} from "../lib/prompts/product-candidates-prompt";
import { stripCanonicalSlugsRecursive, hasCanonicalSlug } from "../lib/utils/strip-canonical-slugs";
import type { CandidatesResponse } from "../types/product-candidate";

let pass = 0, fail = 0;
function check(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}`); }
}

console.log("== G-1: 候補プロンプト + privacy ==");

const mb: MoodboardSummaryForCandidates = {
  name: "冷たいアンドロジナス",
  description: "中性的で静かな緊張感",
  worldviewName: "ダーク・ミニマル",
  captionedItems: ["黒のロングコート", "厚底ブーツ"],
  bodyProfileNote: null,
};

// kw-1
check("kw-1 keyword system が JSON強制+禁止語",
  KEYWORD_EXTRACTION_SYSTEM.includes("JSON") && KEYWORD_EXTRACTION_SYSTEM.includes("補正"));
// kw-2
const kwUser = buildKeywordExtractionUser(mb);
check("kw-2 keyword user が moodboard 反映",
  kwUser.includes("冷たいアンドロジナス") && kwUser.includes("黒のロングコート"));
// sr-1
const products: CandidateForScoring[] = [
  { index: 0, category: "outer", title: "黒ロングコート ウール", brand: "SHOP-A", price: 12800 },
  { index: 1, category: "shoes", title: "厚底ブーツ", brand: null, price: 9800 },
];
const srUser = buildScoreReasoningUser(mb, products);
check("sr-1 score user が index 付き商品列挙",
  srUser.includes("index 0") && srUser.includes("黒ロングコート ウール") && srUser.includes("index 1"));
// sr-2
check("sr-2 score system が 0-100 + reasoning ルール",
  SCORE_REASONING_SYSTEM.includes("0-100") && SCORE_REASONING_SYSTEM.includes("120"));
// cat-1
check("cat-1 カテゴリ 5 種(hair/makeup 除外)",
  CANDIDATE_CATEGORIES.length === 5 &&
  !CANDIDATE_CATEGORIES.includes("hair" as never) &&
  CANDIDATE_CATEGORIES.includes("accessory"));
// priv-1
const dirty: CandidatesResponse = {
  moodboardId: "x",
  candidates: [{
    source: "rakuten", source_product_id: "i1", title: "minimal な黒コート", brand: null,
    price: 100, image_url: null, product_url: null, affiliate_url: null,
    category: "outer", score: 90, reasoning: "dark で gothic な世界観を反映",
  }],
  queriesUsed: ["outer: 黒 コート"],
};
const clean = stripCanonicalSlugsRecursive(dirty);
check("priv-1 候補内の英語スラッグを再帰 strip", hasCanonicalSlug(clean) === false);

console.log(`\n== 結果: ${pass} PASS / ${fail} FAIL ==`);
process.exit(fail === 0 ? 0 : 1);
