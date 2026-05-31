// Sprint G-1: 実商品候補 LLM プロンプト(2 呼出: ① keyword 抽出 ② score+reasoning 生成)
//
// 設計: docs/STYLE-SELF_Sprint-G_実商品検索本体_multi_source_product_catalog_設計調査.md(716bd3a)§D/§E
// 戦略: E-0f 実商品試着主軸 / E-0g multi-source・服好き感度
//
// ★ 出力は JSON 強制(callClaudeJSON でパース・失敗時は route 側でフォールバック)。
// ★ 応答制約: stylist-chat と同じ 7 禁止語(短い/狭い/重い/悩み/弱点/欠点/逆算/補正)を JSON 全 string で禁止。
// ★ Layer 1 は楽天向け query。将来 source 別 query(ZOZO/SSENSE)は別関数で拡張(E-0g)。

import type { CandidateCategory } from "@/types/product-candidate";

// ムードボードの LLM 入力サマリ(route が moodboard から組立てて渡す)
export interface MoodboardSummaryForCandidates {
  name:            string;
  description:     string;
  worldviewName:   string | null;
  captionedItems:  string[];   // moodboard_items の caption 配列
  bodyProfileNote: string | null;   // 体型成立条件(任意・英語スラッグ非含)
}

export const CANDIDATE_CATEGORIES: CandidateCategory[] = ["outer", "tops", "bottoms", "shoes", "accessory"];

const CATEGORY_LABEL_JA: Record<CandidateCategory, string> = {
  outer: "アウター", tops: "トップス", bottoms: "ボトムス", shoes: "シューズ", accessory: "小物",
};

const FORBIDDEN_WORDS = "短い・狭い・重い・悩み・弱点・欠点・逆算・補正";

// ====================================================================
// 呼出 1: moodboard → カテゴリ別 楽天検索キーワード
// ====================================================================

export interface KeywordExtractionResult {
  // 各カテゴリ 2-4 個の日本語検索キーワード(楽天でヒットする語)
  outer:     string[];
  tops:      string[];
  bottoms:   string[];
  shoes:     string[];
  accessory: string[];
}

export const KEYWORD_EXTRACTION_SYSTEM = `あなたは STYLE-SELF のファッション AI です。ムードボードの世界観を、実在商品を探すための日本語検索キーワードに翻訳します。

【役割】
ムードボードのテーマ・参考画像キャプション・世界観から、アウター/トップス/ボトムス/シューズ/小物 の各カテゴリで、★ 楽天市場で実際にヒットする日本語検索キーワードを生成する。

【ルール】
・各カテゴリ 2〜4 個のキーワード(例: 「黒 ロングコート オーバーサイズ」「ウール チェスターコート」)
・★ 表面的な英単語・ブランド名スラッグではなく、商品が見つかる具体語(色+アイテム名+特徴)
・世界観の「核」を服に翻訳する(E-0a: 表面の真似でなく本質の翻訳)
・体型成立条件があれば縦比率・重心などの観点を反映(ただし ${FORBIDDEN_WORDS} の語は使わない)
・★ 内部 ID・英語スラッグ(quiet/minimal/dark 等)・URL は出力しない

【出力】以下の JSON のみ(前後に文章を付けない):
{
  "outer": ["...", "..."],
  "tops": ["...", "..."],
  "bottoms": ["...", "..."],
  "shoes": ["...", "..."],
  "accessory": ["...", "..."]
}`;

export function buildKeywordExtractionUser(mb: MoodboardSummaryForCandidates): string {
  const lines: string[] = [];
  lines.push("[ムードボード]");
  lines.push(`テーマ: ${mb.name}`);
  if (mb.description.trim() !== "") lines.push(`コンセプト: ${mb.description}`);
  if (mb.worldviewName) lines.push(`世界観: ${mb.worldviewName}`);
  if (mb.captionedItems.length > 0) {
    lines.push("[参考画像キャプション]");
    mb.captionedItems.forEach((c, i) => lines.push(`画像${i + 1}: ${c}`));
  }
  if (mb.bodyProfileNote) lines.push(`[体型成立条件] ${mb.bodyProfileNote}`);
  lines.push("");
  lines.push("上記の世界観に合う実在商品を探すための検索キーワードを、各カテゴリで JSON で出力してください。");
  return lines.join("\n");
}

// ====================================================================
// 呼出 2: 候補商品 → score(0-100) + reasoning(なぜ合うか)
// ====================================================================

// route が候補商品を LLM に渡す最小形(index で対応付け)
export interface CandidateForScoring {
  index:    number;
  category: CandidateCategory;
  title:    string;
  brand:    string | null;
  price:    number | null;
}

export interface ScoreReasoningEntry {
  index:     number;
  score:     number;    // 0-100
  reasoning: string;    // 80-120 字
}

export interface ScoreReasoningResult {
  entries: ScoreReasoningEntry[];
}

export const SCORE_REASONING_SYSTEM = `あなたは STYLE-SELF のファッション AI です。実在商品が、ユーザーのムードボード世界観にどれだけ合うかを評価します(★ E-0g: 服好き・インフルエンサーの審美眼に応える)。

【役割】
各商品に対して、世界観適合スコア(0-100)と「なぜ合うか」を生成する。

【スコア基準(0-100)】
・90-100: 世界観の核を強く体現・「真似したい/これ欲しい」と感じる
・70-89: 方向性が合致・日常的に取り入れられる
・50-69: 部分的に合う・小物や差し色として機能
・0-49: 世界観とずれる

【reasoning ルール】
・80〜120 字
・ムードボードの「どの要素」を「どう体現/反映/機能」させるかを ★ 具体的に(抽象禁止)
・「○○な要素を反映」「○○として機能」のように具体的対応を明示
・★ ${FORBIDDEN_WORDS} の語は使わない・英語スラッグ・内部 ID・URL は出力しない

【出力】以下の JSON のみ:
{
  "entries": [
    { "index": 0, "score": 85, "reasoning": "..." }
  ]
}`;

export function buildScoreReasoningUser(
  mb: MoodboardSummaryForCandidates,
  products: CandidateForScoring[],
): string {
  const lines: string[] = [];
  lines.push("[ムードボード]");
  lines.push(`テーマ: ${mb.name}`);
  if (mb.description.trim() !== "") lines.push(`コンセプト: ${mb.description}`);
  if (mb.worldviewName) lines.push(`世界観: ${mb.worldviewName}`);
  lines.push("");
  lines.push("[評価対象の実在商品]");
  for (const p of products) {
    const price = p.price !== null ? `¥${p.price}` : "価格不明";
    const brand = p.brand ? `[${p.brand}] ` : "";
    lines.push(`index ${p.index}(${CATEGORY_LABEL_JA[p.category]}): ${brand}${p.title}(${price})`);
  }
  lines.push("");
  lines.push("各 index の商品について score(0-100)と reasoning を JSON で出力してください。");
  return lines.join("\n");
}
