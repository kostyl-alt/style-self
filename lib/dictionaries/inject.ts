import { MATERIAL_DICT } from "./material";
import { COLOR_DICT } from "./color";
import { LINE_DICT } from "./line";

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
