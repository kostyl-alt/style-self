// ブランドマッチング v1：決定的（非LLM）スコアラー（Step3）。
//
// 目的: 写真分析 style_signals 等の「事実属性」を入力に、BRAND_TAXONOMY から
//   近いブランド候補を 5〜8 件、スコア順＋理由つきで返す。
//   ⚠️ LLM を使わずコードで算出する（候補・理由のハルシネーション防止）。
//   理由は「実際に一致したタグ」だけから生成する（創作しない）。
//
// v1 主軸: color / silhouette / genre / era（重み高め）。
// 補助: material / culture（重み低め・主に理由文）。
//
// 純関数。副作用なし。matcher を呼び出す配線（brand-learn / stylist-chat）は Step4。

import { STYLE_AXES } from "@/lib/style-taxonomy";
import { BRAND_TAXONOMY, type BrandTaxonomyEntry } from "@/lib/knowledge/brand-taxonomy";

// 入力：事実属性（すべて任意・style_signals 由来 + 任意の preference）。
export interface StyleFacts {
  colors?: string[]; // STYLE_AXES key="color"
  silhouettes?: string[]; // STYLE_AXES key="silhouette"
  genres?: string[]; // STYLE_AXES key="genre"
  eras?: string[]; // STYLE_AXES key="era"
  materials?: string[]; // STYLE_AXES key="material"（preference 由来・補助）
  cultures?: string[]; // STYLE_AXES key="culture"（補助）
}

// 出力：候補1件。score は 0..1（正規化済み）。
export interface BrandMatch {
  name: string;
  score: number;
  matchedReasons: string[]; // 一致した事実タグから生成（「色が一致: オールブラック・モノトーン」等）
  searchKeywords: string[];
}

// 明示条件フィルタ：ユーザーが狭い軸（韓国/Y2K/ゴープコア等）を明示指定したときの所属条件（ハード）。
// ⚠️ color/silhouette/material は加点のまま（ハード化しない）。genre/culture の狭い軸だけここに来る。
export interface BrandHardConstraints {
  requiredGenres?:   string[]; // STYLE_AXES key="genre"
  requiredCultures?: string[]; // STYLE_AXES key="culture"
}

// 主軸は重み高め・補助は低め。genre は最も識別力が高いので僅かに加点、era は揺れやすいので僅かに減点。
const AXIS_CONFIG = [
  { key: "color", label: "色", weight: 1.0, factsKey: "colors", brandKey: "colorSignals" },
  { key: "silhouette", label: "シルエット", weight: 1.0, factsKey: "silhouettes", brandKey: "silhouetteSignals" },
  { key: "genre", label: "ジャンル", weight: 1.2, factsKey: "genres", brandKey: "genreCandidates" },
  { key: "era", label: "年代", weight: 0.8, factsKey: "eras", brandKey: "eraSignals" },
  { key: "material", label: "素材", weight: 0.3, factsKey: "materials", brandKey: "materialSignals" },
  { key: "culture", label: "カルチャー", weight: 0.3, factsKey: "cultures", brandKey: "cultureCandidates" },
] as const;

// 候補通過の必須条件＝この軸のいずれかが一致していること。
// ⚠️ era はスコア計算（重み0.8）には残すが、候補入りの必須条件からは外す
//    （年代だけ一致の薄い候補を弾く。色/シルエット/ジャンルのどれかは当たっていること）。
const MAIN_AXES = new Set(["color", "silhouette", "genre"]);
const MIN_SCORE = 0.15; // これ未満は候補に出さない（薄い一致を弾く）
const MAX_RESULTS = 8;

const norm = (s: string): string => s.trim();

function intersect(facts: string[], brandTags: string[]): string[] {
  const set = new Set(brandTags.map(norm));
  const out: string[] = [];
  const seen = new Set<string>();
  for (const f of facts) {
    const n = norm(f);
    if (set.has(n) && !seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  }
  return out;
}

interface ScoredBrand {
  brand: BrandTaxonomyEntry;
  score: number;
  matchedReasons: string[];
  hasMainOverlap: boolean;
}

function scoreBrand(facts: StyleFacts, brand: BrandTaxonomyEntry): ScoredBrand {
  let weightedSum = 0;
  let weightTotal = 0;
  const matchedReasons: string[] = [];
  let hasMainOverlap = false;

  for (const axis of AXIS_CONFIG) {
    const factTags = (facts[axis.factsKey] ?? []).filter(Boolean);
    if (factTags.length === 0) continue; // ユーザーが出していない軸は正規化に含めない（少ない軸でも公平）

    const brandTags = brand[axis.brandKey] as string[];
    const matched = intersect(factTags, brandTags);
    const ratio = matched.length / factTags.length; // 0..1（その軸の一致率）

    weightedSum += axis.weight * ratio;
    weightTotal += axis.weight;

    if (matched.length > 0) {
      matchedReasons.push(`${axis.label}が一致: ${matched.join("・")}`);
      if (MAIN_AXES.has(axis.key)) hasMainOverlap = true;
    }
  }

  const score = weightTotal > 0 ? weightedSum / weightTotal : 0;
  return { brand, score, matchedReasons, hasMainOverlap };
}

// 明示条件（ハード制約）を満たすか。requiredGenres / requiredCultures のどちらかが一致すれば通過（OR）。
// ⚠️ 制約が空（どちらも未指定）なら常に通過。指定された側のみ評価する。
function passesConstraints(brand: BrandTaxonomyEntry, c: BrandHardConstraints): boolean {
  const reqG = c.requiredGenres ?? [];
  const reqC = c.requiredCultures ?? [];
  if (reqG.length === 0 && reqC.length === 0) return true;
  const genreSet   = new Set(brand.genreCandidates.map(norm));
  const cultureSet = new Set(brand.cultureCandidates.map(norm));
  const genreHit   = reqG.some((t) => genreSet.has(norm(t)));
  const cultureHit = reqC.some((t) => cultureSet.has(norm(t)));
  return genreHit || cultureHit;
}

// 事実属性 → 近いブランド候補（上位 5〜8・スコア順・理由つき）。決定的・純関数。
// constraints があれば ★ スコアリング前に候補集合を絞る（top8 slice 後の後フィルタではない）。
// ⚠️ constraints 省略時は従来と完全に同一（後方互換）。スコア式・閾値・sort・slice は不変。
export function matchBrands(facts: StyleFacts, constraints?: BrandHardConstraints): BrandMatch[] {
  const pool = constraints
    ? BRAND_TAXONOMY.filter((b) => passesConstraints(b, constraints))
    : BRAND_TAXONOMY;
  return pool.map((brand) => scoreBrand(facts, brand))
    .filter((s) => s.hasMainOverlap && s.score >= MIN_SCORE) // 主軸一致ゼロは出さない（補助だけの偶然一致を弾く）
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESULTS)
    .map((s) => ({
      name: s.brand.name,
      score: Math.round(s.score * 100) / 100,
      matchedReasons: s.matchedReasons,
      searchKeywords: s.brand.searchKeywords,
    }));
}

// ── 語彙ドリフトの砦（軽量アサーション・テスト/CI から呼べる純関数）──
// 辞書の color/silhouette/genre/culture/material/era 系タグが STYLE_AXES に実在するか検証する。
// styleTags / itemStrengths / searchKeywords は自由記述なので対象外。
export interface DriftedTag {
  brand: string;
  field: string;
  tag: string;
}

function validTagsByAxis(): Record<string, Set<string>> {
  const out: Record<string, Set<string>> = {};
  for (const axis of STYLE_AXES) {
    out[axis.key] = new Set(axis.tags.map((t) => norm(t.name)));
  }
  return out;
}

const DRIFT_CHECK_FIELDS = [
  { field: "colorSignals", axis: "color" },
  { field: "silhouetteSignals", axis: "silhouette" },
  { field: "genreCandidates", axis: "genre" },
  { field: "cultureCandidates", axis: "culture" },
  { field: "materialSignals", axis: "material" },
  { field: "eraSignals", axis: "era" },
] as const;

export function findDriftedTags(): DriftedTag[] {
  const valid = validTagsByAxis();
  const drifted: DriftedTag[] = [];
  for (const brand of BRAND_TAXONOMY) {
    for (const { field, axis } of DRIFT_CHECK_FIELDS) {
      const validSet = valid[axis];
      for (const tag of brand[field] as string[]) {
        if (!validSet || !validSet.has(norm(tag))) {
          drifted.push({ brand: brand.name, field, tag });
        }
      }
    }
  }
  return drifted;
}
