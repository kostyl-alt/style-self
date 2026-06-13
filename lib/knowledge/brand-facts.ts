// ブランドマッチング Step4-a：facts 組み立て（決定的・純関数）。
//
// 3 ソースを union して StyleFacts を作り、matchBrands に渡す。
//   (主)   style_signals: 育成で蓄積した事実タグ（colors/silhouettes/genres/eras）を頻度上位 N。moods は matcher 非対応で捨てる。
//   (補助) stylePreference: liked 系を STYLE_AXES 実在タグだけ採用（colors/silhouettes/materials）。disliked は v1 未使用。
//   (明示) 今のユーザー発言: 最小キーワードマップ（部分文字列マッチ・配管確認用）。否定/比較は Step4-b 以降。
//
// ⚠️ 発言マップの RHS・採用タグは全て STYLE_AXES 実在タグ（語彙ドリフト防止）。

import { STYLE_AXES } from "@/lib/style-taxonomy";
import { matchBrands, type StyleFacts, type BrandMatch } from "@/lib/knowledge/brand-match";

const norm = (s: string): string => s.trim();

function validTagSet(axisKey: string): Set<string> {
  const axis = STYLE_AXES.find((a) => a.key === axisKey);
  return new Set((axis?.tags ?? []).map((t) => norm(t.name)));
}
const VALID = {
  color:      validTagSet("color"),
  silhouette: validTagSet("silhouette"),
  genre:      validTagSet("genre"),
  era:        validTagSet("era"),
  material:   validTagSet("material"),
};

// style_signals.attributes（写真分析が保存する日本語事実タグ・moods は使わない）。
export interface SignalAttributes {
  colors?:      unknown;
  silhouettes?: unknown;
  genres?:      unknown;
  eras?:        unknown;
  moods?:       unknown;
}

// 頻度上位 N（指定軸が STYLE_AXES 実在のものだけカウント＝matcher で当たり得るものに絞る）。
function topTags(rows: SignalAttributes[], key: keyof SignalAttributes, valid: Set<string>, topN: number): string[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const arr = r[key];
    if (!Array.isArray(arr)) continue;
    for (const raw of arr) {
      const t = typeof raw === "string" ? norm(raw) : "";
      if (t && valid.has(t)) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([t]) => t);
}

// 発言キーワードマップ（最小・配管確認用）。kw が text に部分一致したら対応タグを足す。
// ⚠️ RHS は全て STYLE_AXES 実在タグ。否定/比較は扱わない（単語過剰反応を避けるため最小に留める）。
interface UtteranceRule {
  kw:          string;
  colors?:     string[];
  silhouettes?: string[];
  genres?:     string[];
}
const UTTERANCE_RULES: UtteranceRule[] = [
  { kw: "黒モード",       genres: ["ダーク/ブラックモード"] },
  { kw: "黒",             colors: ["オールブラック", "モノトーン", "ダークトーン"] },
  { kw: "グレー",         colors: ["モノトーン", "低彩度"] },
  { kw: "ベージュ",       colors: ["ベージュ系", "ニュートラル"] },
  { kw: "ワイド",         silhouettes: ["ワイド"] },
  { kw: "オーバーサイズ", silhouettes: ["オーバーサイズ"] },
  { kw: "モード",         genres: ["モード"] },
  { kw: "ミニマル",       genres: ["ミニマル"] },
  { kw: "ノームコア",     genres: ["ノームコア"] },
  { kw: "韓国",           genres: ["韓国ストリート", "韓国ノームコア"] },
  { kw: "ストリート",     genres: ["ストリート"] },
  { kw: "裏原",           genres: ["裏原系"] },
  { kw: "Y2K",            genres: ["Y2K/McBling"] },
  { kw: "ゴープコア",     genres: ["ゴープコア"] },
  { kw: "テック",         genres: ["テックウェア"] },
];

function factsFromUtterance(text: string): { colors: string[]; silhouettes: string[]; genres: string[] } {
  const colors: string[] = [], silhouettes: string[] = [], genres: string[] = [];
  for (const rule of UTTERANCE_RULES) {
    if (!text.includes(rule.kw)) continue;
    if (rule.colors)      colors.push(...rule.colors);
    if (rule.silhouettes) silhouettes.push(...rule.silhouettes);
    if (rule.genres)      genres.push(...rule.genres);
  }
  return { colors, silhouettes, genres };
}

const uniq = (...arrs: string[][]): string[] =>
  Array.from(new Set(arrs.flat().map(norm).filter(Boolean)));

const onlyValid = (arr: string[] | undefined, valid: Set<string>): string[] =>
  (arr ?? []).map(norm).filter((t) => valid.has(t));

// stylist-chat の stylePreference 抽出形（必要な liked 系のみ・自由記述は実在タグで弾く）。
export interface BrandFactsPreference {
  likedColors?:      string[];
  likedSilhouettes?: string[];
  likedMaterials?:   string[];
}

export interface BuildBrandFactsArgs {
  signals?:    SignalAttributes[];      // (主)
  preference?: BrandFactsPreference;    // (補助)
  text?:       string;                  // (明示)
}

// 頻度上位 N（/self の StyleTrendSection と同方針）。
const TOP_COLORS = 3, TOP_SILHOUETTES = 3, TOP_GENRES = 3, TOP_ERAS = 2;

// 3 ソースを union して StyleFacts を作る純関数。
export function buildBrandFacts(args: BuildBrandFactsArgs): StyleFacts {
  const signals = args.signals ?? [];
  const pref    = args.preference ?? {};
  const utter   = factsFromUtterance(args.text ?? "");

  const sigColors      = topTags(signals, "colors",      VALID.color,      TOP_COLORS);
  const sigSilhouettes = topTags(signals, "silhouettes", VALID.silhouette, TOP_SILHOUETTES);
  const sigGenres      = topTags(signals, "genres",      VALID.genre,      TOP_GENRES);
  const sigEras        = topTags(signals, "eras",        VALID.era,        TOP_ERAS);

  const facts: StyleFacts = {
    colors:      uniq(sigColors,      onlyValid(pref.likedColors, VALID.color),           utter.colors),
    silhouettes: uniq(sigSilhouettes, onlyValid(pref.likedSilhouettes, VALID.silhouette), utter.silhouettes),
    genres:      uniq(sigGenres,      utter.genres),
    eras:        uniq(sigEras),
    materials:   uniq(onlyValid(pref.likedMaterials, VALID.material)), // 補助
    cultures:    [],                                                    // 供給源なし（補助・将来用）
  };
  return facts;
}

// facts 組み立て → matchBrands。配管確認・ログ用に facts も返す。
export function computeBrandMatches(args: BuildBrandFactsArgs): { facts: StyleFacts; matches: BrandMatch[] } {
  const facts = buildBrandFacts(args);
  return { facts, matches: matchBrands(facts) };
}
