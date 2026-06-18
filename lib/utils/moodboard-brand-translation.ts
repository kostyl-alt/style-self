// 複数画像MB分析 A2: signals の主軸 → 近いブランド/検索ワードへ決定的に翻訳する純関数。
//
// 核心思想（CLAUDE.md「構造で強制」/ styling-quality §7）: ブランド・検索ワードは LLM に作らせず
//   コードが決定的に組む（固有名・国籍の捏造を構造的に防ぐ）。
//   入力 signals.styleSignals は Layer1/2 で STYLE_AXES 実在タグに正規化済み → matchBrands にそのまま渡せる。
//
// 流れ: signals 主軸(core/repeated) → StyleFacts(axis をキーに振り分け) → matchBrands(ローカル 105 辞書)
//   → BrandMatch[]。検索ワードは (a) ブランド由来(BrandMatch.searchKeywords) + (b) 主軸タグの決定的組合せ。
//
// 出力（BrandTranslation）は moodboard_analysis.brand_translation に保存される（A2-1 は消費者ゼロ・表示は A2-2）。

import { matchBrands, type StyleFacts } from "@/lib/knowledge/brand-match";
import type {
  MoodboardSignals,
  SignalAxis,
  BrandTranslation,
  BrandTranslationMatch,
} from "@/types/moodboard";

// (b) MB主軸組合せ検索ワードの上限（組合せ爆発と冗長を防ぐ）。
const MAX_COMBO_KEYWORDS = 8;
// searchKeywords 全体（(b) + (a)）の上限。
const MAX_SEARCH_KEYWORDS = 12;

// signals の主軸(core/repeated)のみを axis 別に分けて StyleFacts に変換する。
// ⚠️ accent(1枚だけ)は除外（Layer3 のA決定と一貫・1枚のノイズをブランド翻訳に持ち込まない）。
// signals の value は正規化済みなので変換不要。era 軸は signals に無いので eras は空。
function signalsToStyleFacts(signals: MoodboardSignals): {
  facts: StyleFacts;
  byAxis: Record<SignalAxis, string[]>;
} {
  const byAxis: Record<SignalAxis, string[]> = {
    color: [], material: [], silhouette: [], genre: [], culture: [],
  };
  for (const s of signals.signals) {
    if (s.strength === "accent") continue;  // 主軸のみ
    if (!byAxis[s.axis].includes(s.value)) byAxis[s.axis].push(s.value);
  }
  const facts: StyleFacts = {
    colors:      byAxis.color,
    silhouettes: byAxis.silhouette,
    genres:      byAxis.genre,
    materials:   byAxis.material,
    cultures:    byAxis.culture,
    eras:        [],  // signals に era 軸は無い
  };
  return { facts, byAxis };
}

// (b) 主軸タグの決定的組合せ検索ワード（genre×color / genre×material / color×silhouette）。
// 並びは byAxis の登録順（signals は strength→count 降順で決定的）なので出力も決定的。
function buildComboKeywords(byAxis: Record<SignalAxis, string[]>): string[] {
  const out: string[] = [];
  const pairs: [string[], string[]][] = [
    [byAxis.genre, byAxis.color],
    [byAxis.genre, byAxis.material],
    [byAxis.color, byAxis.silhouette],
  ];
  for (const [left, right] of pairs) {
    for (const l of left) {
      for (const r of right) {
        out.push(`${l} ${r}`);
        if (out.length >= MAX_COMBO_KEYWORDS) return out;
      }
    }
  }
  return out;
}

const uniq = (arr: string[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of arr) {
    const v = s.trim();
    if (v !== "" && !seen.has(v)) { seen.add(v); out.push(v); }
  }
  return out;
};

// signals → 近いブランド/検索ワード（決定的・LLM 不使用・純関数）。
// ⚠️ 主軸が空（全 accent＝小/疎MB）→ matchBrands が主軸一致ゼロで brands 空 → graceful（空 translation）。
export function translateSignalsToBrands(signals: MoodboardSignals | undefined): BrandTranslation {
  const empty: BrandTranslation = { schemaVersion: 1, brands: [], searchKeywords: [] };
  if (!signals || signals.signals.length === 0) return empty;

  const { facts, byAxis } = signalsToStyleFacts(signals);
  const matches = matchBrands(facts);  // 制約なし（発話が無いので全候補から主軸でスコア）

  const brands: BrandTranslationMatch[] = matches.map((m) => ({
    name:           m.name,
    score:          m.score,
    matchedReasons: m.matchedReasons,
    searchKeywords: m.searchKeywords,
  }));

  // 検索ワード = (b) 主軸組合せ を先頭 + (a) ブランド由来 を後ろ、重複除去・上限 cap。
  const comboKeywords = buildComboKeywords(byAxis);
  const brandKeywords = brands.flatMap((b) => b.searchKeywords);
  const searchKeywords = uniq([...comboKeywords, ...brandKeywords]).slice(0, MAX_SEARCH_KEYWORDS);

  return { schemaVersion: 1, brands, searchKeywords };
}
