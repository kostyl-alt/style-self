// Sprint 48: 世界観パターンごとに「インスピレーション用コンセプト語」をキュレーション
//
// /discover タブ1（インスピレーション）の上部に表示するチップの出所。
// パターン定数の coreTags は英語タグ（quiet, minimal, ...）でユーザーには伝わりにくいため、
// 日本語の具体的な phrase（場所・年代・質感を含む語）を別途キュレーションする。
//
// 各パターン 6〜8 件。チップタップで InspirationView の addWord() に流し込まれる。

export const WORLDVIEW_CONCEPTS: Record<string, string[]> = {
  "quiet-observer": [
    "美術館の白壁",
    "古書店の沈黙",
    "墨の濃淡",
    "布の質量",
    "雨の路面",
    "余白の重み",
    "和紙の白",
    "影だけで輪郭",
  ],
  "refined-urban": [
    "鉄筋コンクリート",
    "ビジネス街の朝",
    "都市の白壁",
    "無音の構造",
    "石畳の冷たさ",
    "建築の骨格",
    "鏡面ガラス",
    "黒いレザーの机",
  ],
  "rebel-creator": [
    "90年代グランジ",
    "退色した黒",
    "工業的な影",
    "ヴィンテージの傷",
    "整いすぎへの反抗",
    "夜の地下シーン",
    "粗さの中の美",
    "古着の重なり",
  ],
  "soft-intimate": [
    "日曜の朝光",
    "肌触りの記憶",
    "乳白色の柔らかさ",
    "窓辺のシフォン",
    "淡いラベンダーの霞",
    "綿菓子のような距離感",
    "柔らかい西日",
    "起毛の温度",
  ],
  "night-gravitas": [
    "都市の夜",
    "煙の立ち昇る部屋",
    "深いボルドー",
    "黒のドレープ",
    "湿度のある夜風",
    "ろうそくの揺らぎ",
    "倉庫街の闇",
    "革の匂い",
  ],
  "natural-editor": [
    "森の朝霧",
    "古い木の書斎",
    "麻の風合い",
    "海辺の塩気",
    "日に焼けた紙",
    "陶器の素朴さ",
    "畑の土の色",
    "余白のある暮らし",
  ],
  "futuristic-minimalist": [
    "鏡面の白壁",
    "テック素材の光沢",
    "オゾンの空気感",
    "余白だけの空間",
    "シリコンの滑らかさ",
    "近未来の研究室",
    "雪原の静寂",
    "月光の冷たさ",
  ],
  "expressive-light": [
    "南仏の昼下がり",
    "ポップな水彩",
    "シトラスの軽さ",
    "夏の海風",
    "屋外のフェス",
    "色の組み合わせ遊び",
    "朝市のにぎわい",
    "ピクニックの陽射し",
  ],
};

export function getConceptsForPattern(patternId: string | undefined): string[] {
  if (!patternId) return [];
  return WORLDVIEW_CONCEPTS[patternId] ?? [];
}

import type { StyleDiagnosisResult } from "@/types/index";

// フェーズB Step 3: analyze-v2 は patternId を持たないため、
// patternId 経由のキュレーション辞書が空になる。AI 生成の worldview_keywords を
// 代替のチップソースとして使う。styleAxis.beliefKeywords は最終フォールバック。
//
// 過去診断(patternId あり)は引き続き WORLDVIEW_CONCEPTS の手キュレーション語が出る。
export function getInspiredConceptsForAnalysis(
  analysis: StyleDiagnosisResult | null | undefined,
): string[] {
  if (!analysis) return [];
  const fromPattern = getConceptsForPattern(analysis.patternId);
  if (fromPattern.length > 0) return fromPattern;
  if (analysis.worldview_keywords && analysis.worldview_keywords.length > 0) {
    return analysis.worldview_keywords;
  }
  const belief = analysis.styleAxis?.beliefKeywords;
  if (belief && belief.length > 0) return belief;
  return [];
}
