// JST（Asia/Tokyo）の現在月から季節を判定する。
// Vercel は UTC で動くため、必ず Asia/Tokyo 指定で月を取得する。
//
// 季節区分（Sprint 36 v1.1）:
//  4〜6月 → 春
//  7〜9月 → 夏
//  10〜11月 → 秋
//  12〜3月 → 冬

export function getSeasonJST(date: Date = new Date()): string {
  const month = Number(
    new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric" }).format(date),
  );
  if (month >= 4 && month <= 6)   return "春";
  if (month >= 7 && month <= 9)   return "夏";
  if (month >= 10 && month <= 11) return "秋";
  return "冬"; // 12, 1, 2, 3
}
