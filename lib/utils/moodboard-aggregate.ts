// 複数画像MB分析 Layer2: per-image vision.styleSignals を画像横断で決定的に集約する純関数。
//
// 核心思想（CLAUDE.md「構造で強制」）: 事実の集約は決定的（LLM 不要）・意味づけだけ LLM。
//   ここは「どのタグが何枚に出たか」を数えて strength（core/repeated/accent）を付けるだけ。
//   入力 vision.styleSignals は Layer1（vision-analyzer）で STYLE_AXES 実在タグに正規化済みなので exact count。
//   visualFacts（自由文寄り）は集約に使わない（per-image 根拠として保持・ドリフトを集約に持ち込まない）。
//
// 出力（MoodboardSignals）は moodboard_analysis.signals に保存され、Layer3 以降が読む（現状 消費者ゼロ）。

import type {
  MoodboardSignals,
  AggregatedSignal,
  SignalAxis,
  SignalStrength,
  VisionStyleSignals,
} from "@/types/moodboard";

// ---- チューニング可能な閾値（ratio = count / imageCount）----
export const CORE_RATIO = 0.6;       // この比率以上 かつ count>=2 で core（主軸）
export const REPEATED_RATIO = 0.3;   // この比率以上 かつ count>=2 で repeated（繰り返し）
export const MIN_STRONG_COUNT = 2;   // ⚠️ core/repeated は最低 2 枚に出ること（1 枚だけは絶対に主軸にしない）

// styleSignals の 5 タグ → 集約軸の対応。
const AXES: { axis: SignalAxis; key: keyof VisionStyleSignals }[] = [
  { axis: "color",      key: "colorTags" },
  { axis: "material",   key: "materialTags" },
  { axis: "silhouette", key: "silhouetteTags" },
  { axis: "genre",      key: "genreTags" },
  { axis: "culture",    key: "cultureTags" },
];

// 集約対象の最小入力（DB の moodboard_items 行から id と vision だけ受け取る）。
// vision は jsonb 由来で形が壊れている可能性があるため unknown で受けて防御的に読む。
export interface AggregateInputItem {
  id:     string;
  vision: unknown;
}

function readStyleSignals(vision: unknown): VisionStyleSignals | null {
  if (!vision || typeof vision !== "object") return null;
  const ss = (vision as Record<string, unknown>).styleSignals;
  if (!ss || typeof ss !== "object") return null;
  return ss as VisionStyleSignals;
}

// 同一画像内の同タグ重複を除いた tag 配列（Set のイテレーションは tsconfig target 制約で避ける）。
function readTags(ss: VisionStyleSignals | null, key: keyof VisionStyleSignals): string[] {
  if (!ss) return [];
  const arr = ss[key];
  if (!Array.isArray(arr)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of arr) {
    if (typeof t !== "string") continue;
    const v = t.trim();
    if (v !== "" && !seen.has(v)) { seen.add(v); out.push(v); }
  }
  return out;
}

// strength 判定。⚠️ 小MBガード: imageCount<2 は「繰り返し」が定義できないため全 accent。
function classify(count: number, imageCount: number): SignalStrength {
  if (imageCount < 2) return "accent";
  const ratio = count / imageCount;
  if (count >= MIN_STRONG_COUNT && ratio >= CORE_RATIO) return "core";
  if (count >= MIN_STRONG_COUNT && ratio >= REPEATED_RATIO) return "repeated";
  return "accent";
}

const STRENGTH_RANK: Record<SignalStrength, number> = { core: 0, repeated: 1, accent: 2 };

export function aggregateMoodboardSignals(items: AggregateInputItem[]): MoodboardSignals {
  const imageCount = items.length;
  const signals: AggregatedSignal[] = [];

  for (const { axis, key } of AXES) {
    // value → その値を含む画像 id 配列（readTags が画像内で uniq 済みなので各 item は 1 回しか push しない＝枚数）。
    // imageIds の順は items 順（route が order_index 昇順）で決定的。
    const byValue = new Map<string, string[]>();
    for (const item of items) {
      const tags = readTags(readStyleSignals(item.vision), key);
      for (const value of tags) {
        const ids = byValue.get(value);
        if (ids) ids.push(item.id); else byValue.set(value, [item.id]);
      }
    }
    byValue.forEach((imageIds, value) => {
      const count = imageIds.length;
      signals.push({ axis, value, count, imageIds, strength: classify(count, imageCount) });
    });
  }

  // 決定的な並び: strength(core>repeated>accent) → count 降順 → axis → value。
  signals.sort((a, b) =>
    STRENGTH_RANK[a.strength] - STRENGTH_RANK[b.strength] ||
    b.count - a.count ||
    a.axis.localeCompare(b.axis) ||
    a.value.localeCompare(b.value),
  );

  return { schemaVersion: 1, imageCount, signals };
}
