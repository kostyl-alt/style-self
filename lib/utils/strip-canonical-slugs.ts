// Sprint H-4b1-a: 英語スラッグ除去(三重防御 (3))の ★ 再帰版(JSON 全 string フィールド対応)
//
// 設計: docs/STYLE-SELF_Sprint-H-4b_出力UI7+5_MB_context_object化_細部設計調査.md(2f9886e)追加論点
//
// 【背景】
// 現状 stripCanonicalSlugs は app/api/ai/stylist-chat/route.ts 内のローカル関数で、★ 単一 reply text
// だけを対象にしている。H-4b で reply が構造化 JSON(CoordinateReply)になると、direction / summary /
// items[].description ... 等 ★ 多数の string フィールドにスラッグが混入し得る。本モジュールは
// PRODUCT_WORLDVIEW_TAGS(31 語・単一真正源)を再利用して全 string を再帰的に浄化する。
//
// 【H-4b1-a スコープ】
// - ★ route のローカル stripCanonicalSlugs は ★ 0 変更(既存挙動 100% 維持)。
// - 本モジュールは ★ 新規・どこからも未呼出(H-4b1-b で route が JSON 化する際に接続)。
// - slug の LIST は PRODUCT_WORLDVIEW_TAGS を直参照 → 辞書追加が即反映(route と同じ単一真正源)。
//   H-4b1-b で route がこの関数へ寄せれば、関数本体の重複も解消される。

import { PRODUCT_WORLDVIEW_TAGS } from "@/lib/knowledge/product-worldview-tags";

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// 31 語を単語境界(\b)単位で gi 検出(route の SLUG_PATTERN と同型)
const SLUG_PATTERN = new RegExp(
  `\\b(?:${PRODUCT_WORLDVIEW_TAGS.map(escapeRegExp).join("|")})\\b`,
  "gi",
);

// 単一文字列の浄化(route のローカル関数と同一ロジック・将来 route はこちらへ寄せる)
export function stripCanonicalSlugs(text: string): { cleaned: string; removed: boolean } {
  let removed = false;
  const cleaned = text.replace(SLUG_PATTERN, () => {
    removed = true;
    return "";
  });
  if (!removed) {
    return { cleaned: text, removed: false };
  }
  // 残った句読点 / 連続空白を整える(自然文を壊しすぎない)
  const normalized = cleaned
    .replace(/[ \t]+/g, " ")
    .replace(/\s*([、。])\s*/g, "$1")
    .replace(/(^|\n)[ \t、。]+/g, "$1")
    .trim();
  return { cleaned: normalized, removed: true };
}

// ★ 再帰版: 任意の値(文字列 / 配列 / オブジェクトのネスト)の全 string を浄化して同型を返す。
//   number / boolean / null / undefined はそのまま(構造保持)。removed 有無は別途 wasSlugRemoved で判定可。
export function stripCanonicalSlugsRecursive<T>(input: T): T {
  if (typeof input === "string") {
    return stripCanonicalSlugs(input).cleaned as unknown as T;
  }
  if (Array.isArray(input)) {
    return input.map((v) => stripCanonicalSlugsRecursive(v)) as unknown as T;
  }
  if (input !== null && typeof input === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      out[key] = stripCanonicalSlugsRecursive(value);
    }
    return out as unknown as T;
  }
  // number / boolean / null / undefined / symbol / function 等はそのまま
  return input;
}

// 任意の値にスラッグが 1 つでも含まれるか(検出のみ・浄化はしない)。ログ / 監査用。
export function hasCanonicalSlug(input: unknown): boolean {
  if (typeof input === "string") {
    SLUG_PATTERN.lastIndex = 0;       // gi グローバル正規表現の状態リセット
    return SLUG_PATTERN.test(input);
  }
  if (Array.isArray(input)) {
    return input.some((v) => hasCanonicalSlug(v));
  }
  if (input !== null && typeof input === "object") {
    return Object.values(input as Record<string, unknown>).some((v) => hasCanonicalSlug(v));
  }
  return false;
}
