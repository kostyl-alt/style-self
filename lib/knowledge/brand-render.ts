// ブランド説明の決定的レンダリング（LLM 自由生成を止めて構造的に固有名の盛り/捏造を防ぐ）。
//
// matchBrands の出力（name / matchedReasons / searchKeywords）だけからコード側で紹介文を組み立てる。
// LLM の役割は「前置き + この候補文をそのまま + 最後に質問1つ」に限定（中身はここが真実源）。
// ⚠️ 使う材料は brand.name / matchedReasons / searchKeywords のみ。一致していない辞書タグ・固有名・細部は足さない。

import type { BrandMatch } from "@/lib/knowledge/brand-match";

const RENDER_LIMIT = 3; // 上位2〜3件（matches は既にスコア順）

// matchedReasons は「色が一致: …」等の事実文。先頭ラベルを落として中身だけ「 / 」で繋ぐ。
function formatReasons(reasons: string[]): string {
  const cleaned = reasons
    .map((r) => r.replace(/^[^:：]+[:：]\s*/, "").trim()) // 「色が一致: A・B」→「A・B」
    .filter(Boolean);
  return cleaned.join(" / ");
}

function formatKeywords(keywords: string[]): string {
  return keywords
    .slice(0, 2)
    .map((k) => `「${k}」`)
    .join("");
}

// 候補を決定的テンプレートで文字列化（純関数）。matches が空なら空文字。
export function renderBrandMatchCards(matches: BrandMatch[]): string {
  const cards: string[] = [];
  for (const m of matches.slice(0, RENDER_LIMIT)) {
    const lines = [`**${m.name}**`];
    const reasons = formatReasons(m.matchedReasons);
    if (reasons) lines.push(`一致している点: ${reasons}`);
    const kw = formatKeywords(m.searchKeywords);
    if (kw) lines.push(`探すなら: ${kw}`);
    cards.push(lines.join("\n"));
  }
  return cards.join("\n\n");
}
