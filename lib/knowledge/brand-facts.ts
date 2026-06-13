// ブランドマッチング Step4-a：facts 組み立て（決定的・純関数）。
//
// 3 ソースを union して StyleFacts を作り、matchBrands に渡す。
//   (主)   style_signals: 育成で蓄積した事実タグ（colors/silhouettes/genres/eras）を頻度上位 N。moods は matcher 非対応で捨てる。
//   (補助) stylePreference: liked 系を STYLE_AXES 実在タグだけ採用（colors/silhouettes/materials）。disliked は v1 未使用。
//   (明示) 今のユーザー発言: 最小キーワードマップ（部分文字列マッチ・配管確認用）。否定/比較は Step4-b 以降。
//
// ⚠️ 発言マップの RHS・採用タグは全て STYLE_AXES 実在タグ（語彙ドリフト防止）。

import { STYLE_AXES } from "@/lib/style-taxonomy";
import { matchBrands, type StyleFacts, type BrandMatch, type BrandHardConstraints } from "@/lib/knowledge/brand-match";

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
// hard: 狭い軸（韓国/Y2K/ゴープコア/裏原 等）を明示指定したときの所属条件（ハード制約）。
//   ⚠️ 一元化：1 エントリで「facts 加点(colors/silhouettes/genres)」と「ハード制約(hard)」を両方定義し二重メンテを防ぐ。
//   ⚠️ 広い美学軸（モード/ミニマル/ストリート）と color/silhouette/material には hard を付けない（加点のまま）。
interface UtteranceRule {
  kw:          string;
  colors?:     string[];
  silhouettes?: string[];
  genres?:     string[];
  hard?:       BrandHardConstraints;
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
  // ↓ 狭い軸：加点 + ハード制約
  { kw: "韓国",           genres: ["韓国ストリート", "韓国ノームコア"], hard: { requiredGenres: ["韓国ストリート", "韓国ノームコア"], requiredCultures: ["K-POP私服/空港", "ソウル/弘大/江南"] } },
  { kw: "K-POP",          genres: ["韓国ストリート", "韓国ノームコア"], hard: { requiredGenres: ["韓国ストリート", "韓国ノームコア"], requiredCultures: ["K-POP私服/空港", "ソウル/弘大/江南"] } },
  { kw: "ソウル",         genres: ["韓国ストリート", "韓国ノームコア"], hard: { requiredGenres: ["韓国ストリート", "韓国ノームコア"], requiredCultures: ["K-POP私服/空港", "ソウル/弘大/江南"] } },
  { kw: "裏原",           genres: ["裏原系"], hard: { requiredGenres: ["裏原系"] } },
  { kw: "Y2K",            genres: ["Y2K/McBling"], hard: { requiredGenres: ["Y2K/McBling", "Y2K/00sストリート"] } },
  { kw: "ゴープコア",     genres: ["ゴープコア"], hard: { requiredGenres: ["ゴープコア", "アウトドア", "アーバンアウトドア"] } },
  { kw: "テックウェア",   genres: ["テックウェア"], hard: { requiredGenres: ["テックウェア"] } },
  // ↓ 狭い軸（追加）：soft genres は hard と同じタグでミラー（hard だけだと facts.genres 空→0件になる）
  { kw: "地雷",           genres: ["地雷系"], hard: { requiredGenres: ["地雷系"] } },
  { kw: "量産",           genres: ["量産型"], hard: { requiredGenres: ["量産型"] } },
  { kw: "サブカル",       genres: ["サブカル/病みかわ"], hard: { requiredGenres: ["サブカル/病みかわ"] } },
  { kw: "病みかわ",       genres: ["サブカル/病みかわ"], hard: { requiredGenres: ["サブカル/病みかわ"] } },
  { kw: "テックストリート", genres: ["テックストリート"], hard: { requiredGenres: ["テックストリート"] } },
  { kw: "近未来",         genres: ["サイバーパンク/近未来"], hard: { requiredGenres: ["サイバーパンク/近未来"] } },
  { kw: "サイバーパンク", genres: ["サイバーパンク/近未来"], hard: { requiredGenres: ["サイバーパンク/近未来"] } },
  { kw: "アメカジ",       genres: ["アメカジ"], hard: { requiredGenres: ["アメカジ"] } },
  { kw: "ミリタリー",     genres: ["ミリタリー"], hard: { requiredGenres: ["ミリタリー"] } },
  // ↓ 狭い軸（追加・40→55拡張）：soft genres は hard と同じタグでミラー。
  { kw: "アメリカ古着",   genres: ["アメリカ古着"], hard: { requiredGenres: ["アメリカ古着"] } },
  { kw: "ワーク",         genres: ["ワークスタイル"], hard: { requiredGenres: ["ワークスタイル"] } },
  { kw: "アイビー",       genres: ["アイビー/トラッド"], hard: { requiredGenres: ["アイビー/トラッド"] } },
  { kw: "トラッド",       genres: ["アイビー/トラッド"], hard: { requiredGenres: ["アイビー/トラッド"] } },
  // ⚠️ 「韓国ガーリー」は hard 追加しない（既存「韓国」hard が部分一致で先に拾い、韓国ストリートと混線するため）。
  //    フレンチ/韓国ガーリーを効かせたいときは「フレンチガーリー」kw を使う。「ガーリー」単体は下の soft で拾う。
  { kw: "フレンチガーリー", genres: ["フレンチ/韓国ガーリー"], hard: { requiredGenres: ["フレンチ/韓国ガーリー"] } },
  { kw: "ロマンティック", genres: ["ロマンティック"], hard: { requiredGenres: ["ロマンティック"] } },
  { kw: "ゴス",           genres: ["ゴシック/ゴス"], hard: { requiredGenres: ["ゴシック/ゴス"] } },
  { kw: "ゴシック",       genres: ["ゴシック/ゴス"], hard: { requiredGenres: ["ゴシック/ゴス"] } },
  { kw: "ダークアカデミア", genres: ["ダークアカデミア"], hard: { requiredGenres: ["ダークアカデミア"] } },
  { kw: "ヴィジュアル系", genres: ["ヴィジュアル系"], hard: { requiredGenres: ["ヴィジュアル系"] } },
  { kw: "ロリータ",       genres: ["ロリータ"], hard: { requiredGenres: ["ロリータ"] } },
  { kw: "ゴシックロリータ", genres: ["ゴシックロリータ"], hard: { requiredGenres: ["ゴシックロリータ"] } },
  // ↓ 狭い軸（追加・55→70拡張）：soft genres は hard と同じタグでミラー。
  { kw: "ギャル",         genres: ["ギャル"], hard: { requiredGenres: ["ギャル"] } },
  { kw: "オールドマネー", genres: ["オールドマネー"], hard: { requiredGenres: ["オールドマネー"] } },
  { kw: "プレッピー",     genres: ["プレッピー"], hard: { requiredGenres: ["プレッピー"] } },
  // ⚠️ 「ドレス」単体は kw にしない（ワンピース/ドレス文脈で誤爆回避）。kw は「クラシック」のみ。
  { kw: "クラシック",     genres: ["クラシック/ドレス"], hard: { requiredGenres: ["クラシック/ドレス"] } },
  // ↓ 広い軸：加点のみ（hard なし）。フェミニン/ガーリーは広い傘なので絞りすぎ回避で soft 据え置き。
  { kw: "ストリート",     genres: ["ストリート"] },
  { kw: "テック",         genres: ["テックウェア"] },
  { kw: "フェミニン",     genres: ["フェミニン/ガーリー"] },
  { kw: "ガーリー",       genres: ["フェミニン/ガーリー"] },
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

// 発言から明示条件（ハード制約）を作る。hard を持つルールがマッチした分の required を union する。
// マッチが無ければ undefined（matchBrands は従来通り全候補・後方互換）。
function constraintsFromUtterance(text: string): BrandHardConstraints | undefined {
  const reqG: string[] = [], reqC: string[] = [];
  for (const rule of UTTERANCE_RULES) {
    if (!rule.hard || !text.includes(rule.kw)) continue;
    if (rule.hard.requiredGenres)   reqG.push(...rule.hard.requiredGenres);
    if (rule.hard.requiredCultures) reqC.push(...rule.hard.requiredCultures);
  }
  if (reqG.length === 0 && reqC.length === 0) return undefined;
  const out: BrandHardConstraints = {};
  if (reqG.length > 0) out.requiredGenres   = Array.from(new Set(reqG));
  if (reqC.length > 0) out.requiredCultures = Array.from(new Set(reqC));
  return out;
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

// facts 組み立て → 明示条件（ハード制約）抽出 → matchBrands。配管確認・ログ用に facts も返す。
// constraintsActive: 発言に狭い軸の明示指定があり、ハードフィルタが効いたか（会話層の graceful 分岐用）。
export function computeBrandMatches(args: BuildBrandFactsArgs): {
  facts: StyleFacts;
  matches: BrandMatch[];
  constraintsActive: boolean;
} {
  const facts = buildBrandFacts(args);
  const constraints = constraintsFromUtterance(args.text ?? "");
  return { facts, matches: matchBrands(facts, constraints), constraintsActive: constraints !== undefined };
}
