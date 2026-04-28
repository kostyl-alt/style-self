// JST（Asia/Tokyo）の現在月から季節を判定する。
// Vercel は UTC で動くため、必ず Asia/Tokyo 指定で月を取得する。
//
// 季節区分（Sprint 36 v1.1）:
//  4〜6月 → 春
//  7〜9月 → 夏
//  10〜11月 → 秋
//  12〜3月 → 冬
//
// Sprint 36 v1.2 のバグ修正:
// ロケール "ja-JP" は month: "numeric" でも "4月" のように「月」字を付加するため、
// Number("4月") = NaN となり全月で「冬」が返っていた。
// "en-US" 等の ASCII ロケールに変更して数値のみを取得する。

export interface SeasonContext {
  tempRange:    string;
  ngMaterials:  string;
  okMaterials:  string;
}

export const SEASON_CONTEXT: Record<string, SeasonContext> = {
  "春": {
    tempRange:   "15〜22度",
    ngMaterials: "厚手ウール・ボアフリース・ダウン・モヘア・厚手レザー",
    okMaterials: "リネン・コットン・薄手ニット・スウェット・薄手シャツ",
  },
  "夏": {
    tempRange:   "26〜35度",
    ngMaterials: "厚手ニット・ウール・厚手レザー・ダウン・コーデュロイ",
    okMaterials: "リネン・薄コットン・レーヨン・ドライ素材・シアー素材",
  },
  "秋": {
    tempRange:   "13〜22度",
    ngMaterials: "厚手ダウン・サマーリネン・シアー素材・薄手レーヨン",
    okMaterials: "ウール・コーデュロイ・カシミヤ・スウェード・厚手コットン",
  },
  "冬": {
    tempRange:   "0〜10度",
    ngMaterials: "薄手リネン・サマーコットン・薄手レーヨン・シアー素材",
    okMaterials: "厚手ウール・ダウン・カシミヤ・ボアフリース・ヘビーウール",
  },
};

export function getSeasonJST(date: Date = new Date()): string {
  const month = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", month: "numeric" }).format(date),
  );
  if (month >= 4 && month <= 6)   return "春";
  if (month >= 7 && month <= 9)   return "夏";
  if (month >= 10 && month <= 11) return "秋";
  return "冬"; // 12, 1, 2, 3
}

export function getSeasonContext(season: string): SeasonContext {
  return SEASON_CONTEXT[season] ?? SEASON_CONTEXT["春"];
}
