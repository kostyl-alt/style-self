export function topVolumeToScale(s: string): number {
  const map: Record<string, number> = {
    "タイト": 0.70,
    "ジャスト": 1.00,
    "ゆとりあり": 1.30,
  };
  return map[s] ?? 1.00;
}

export function bottomVolumeToScale(s: string): number {
  const map: Record<string, number> = {
    "スリム": 0.60,
    "テーパード": 0.80,
    "ジャスト": 1.00,
    "ワイド": 1.40,
    "フレア": 1.60,
  };
  return map[s] ?? 1.00;
}

export function parseRatio(s: string): { top: number; bottom: number } {
  const m = s.match(/(\d+)[^\d]+(\d+)/);
  if (!m) return { top: 5, bottom: 5 };
  const top = parseInt(m[1], 10);
  const bottom = parseInt(m[2], 10);
  if (top + bottom === 0) return { top: 5, bottom: 5 };
  return { top, bottom };
}
