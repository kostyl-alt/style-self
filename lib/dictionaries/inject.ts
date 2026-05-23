import { MATERIAL_DICT } from "./material";
import { COLOR_DICT } from "./color";
import { LINE_DICT } from "./line";
import { RATIO_DICT } from "./ratio";

export function getMaterialContext(materials: string[]): string {
  const entries = materials.flatMap((m) => {
    const candidates = m.split(/[・,、\s]+/).map((s) => s.trim());
    return candidates.map((c) => MATERIAL_DICT[c]).filter(Boolean);
  });
  const unique = Array.from(new Map(entries.map((e) => [e.name, e])).values());
  if (unique.length === 0) return "";
  return unique
    .map(
      (e) =>
        `【${e.name}】${e.instinctiveImage.slice(0, 3).join("・")} | ${e.physicalSensation.slice(0, 2).join("・")} | ${e.universalMood.join("・")}`
    )
    .join("\n");
}

export function getColorContext(colors: string[]): string {
  const entries = colors
    .map((c) => COLOR_DICT[c.trim()])
    .filter(Boolean);
  const unique = Array.from(new Map(entries.map((e) => [e.name, e])).values());
  if (unique.length === 0) return "";
  return unique
    .map(
      (e) =>
        `【${e.name}】${e.instinctiveImage.slice(0, 3).join("・")} | ${e.temperatureFeel}・${e.weightFeel} | ${e.universalAssociation.slice(0, 2).join("・")}`
    )
    .join("\n");
}

export function getLineContext(silhouettes: string[]): string {
  const entries = silhouettes
    .map((s) => LINE_DICT[s.trim()])
    .filter(Boolean);
  const unique = Array.from(new Map(entries.map((e) => [e.name, e])).values());
  if (unique.length === 0) return "";
  return unique
    .map(
      (e) =>
        `【${e.name}】${e.visualEffect.slice(0, 2).join("・")} | ${e.psychologicalEffect.slice(0, 2).join("・")} | ${e.universalMood.join("・")}`
    )
    .join("\n");
}

// A-10: 比率辞書 8 種(getMaterialContext / getColorContext / getLineContext と同形)
// 入力は ratio.ts のキー(例: "上3:下7")。発話に関連するパターン語のみ抽出して日本語文脈文字列を返す。
export function getRatioContext(ratios: string[]): string {
  const entries = ratios
    .map((r) => RATIO_DICT[r.trim()])
    .filter(Boolean);
  const unique = Array.from(new Map(entries.map((e) => [e.pattern, e])).values());
  if (unique.length === 0) return "";
  return unique
    .map(
      (e) =>
        `【${e.pattern}】重心=${e.weightCenter} | ${e.instinctiveFeel.slice(0, 2).join("・")} | ${e.silhouetteEffect.slice(0, 2).join("・")} | ${e.universalMood.join("・")}`
    )
    .join("\n");
}
