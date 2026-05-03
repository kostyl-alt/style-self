// Sprint 42: 15問の診断フローのデータ定義
//
// scoring="score" の質問のタグだけが worldview-matcher の集計対象になる。
// scoring="hint" の質問（Q14, Q15）は世界観判定には使わず、
// Claude の文章化プロンプトに参考情報として渡される。
//
// 単一選択は 1 タグあたり 2 点、複数選択は 1 点（worldview-matcher.ts で重み付け）。

import type { DiagnosisQuestion } from "@/types/index";

export const DIAGNOSIS_QUESTIONS: DiagnosisQuestion[] = [
  {
    id: "q1", step: 1, kind: "single", scoring: "score", required: true,
    question: "街で自分を見た人に残したい余韻は？",
    hint:     "1つだけ選んでください",
    options: [
      { id: "q1a", label: "近づきやすい安心感",       tags: ["approachable", "open", "light"] },
      { id: "q1b", label: "静かだけど印象に残る",     tags: ["quiet", "mysterious", "distance"] },
      { id: "q1c", label: "少し距離を感じる緊張感",   tags: ["sharp", "structured", "distance"] },
      { id: "q1d", label: "清潔で整った信頼感",       tags: ["clean", "refined", "minimal"] },
      { id: "q1e", label: "自由で型にはまらない",     tags: ["expressive", "rebellious", "relaxed"] },
      { id: "q1f", label: "色気や深さを感じる",       tags: ["sensual", "dark", "heavy"] },
      { id: "q1g", label: "知的で考えがありそう",     tags: ["intellectual", "mature", "elegant"] },
    ],
  },
  {
    id: "q2", step: 2, kind: "multi", scoring: "score", required: true,
    question: "絶対に思われたくない印象は？",
    hint:     "複数選択可",
    options: [
      { id: "q2a", label: "量産型・みんなと同じ", tags: ["expressive", "rebellious"] },
      { id: "q2b", label: "子どもっぽい・幼い",   tags: ["mature", "structured"] },
      { id: "q2c", label: "地味・印象が薄い",     tags: ["sharp", "expressive"] },
      { id: "q2d", label: "派手すぎ・目立ちすぎ", tags: ["quiet", "minimal"] },
      { id: "q2e", label: "清潔感がない",         tags: ["clean", "refined"] },
      { id: "q2f", label: "服に着られている",     tags: ["structured"] },
      { id: "q2g", label: "気取っている",         tags: ["approachable", "open"] },
    ],
  },
  {
    id: "q3", step: 3, kind: "single", scoring: "score", required: true,
    question: "服があなたにしてくれると嬉しいことは？",
    hint:     "1つだけ選んでください",
    options: [
      { id: "q3a", label: "自分を守ってくれる",                       tags: ["protective", "distance"] },
      { id: "q3b", label: "自信を出しやすくしてくれる",               tags: ["structured", "sharp"] },
      { id: "q3c", label: "気分を切り替えてくれる",                   tags: ["expressive", "light"] },
      { id: "q3d", label: "自分の考えや価値観を伝えてくれる",         tags: ["intellectual", "expressive"] },
      { id: "q3e", label: "人との距離感を調整してくれる",             tags: ["distance", "mysterious"] },
      { id: "q3f", label: "まだ見えていない自分を引き出してくれる",   tags: ["rebellious", "raw"] },
      { id: "q3g", label: "何も考えなくても整って見せてくれる",       tags: ["clean", "minimal"] },
    ],
  },
  {
    id: "q4", step: 4, kind: "single", scoring: "score", required: true,
    question: "今の自分から変わるなら？",
    hint:     "1つだけ選んでください",
    options: [
      { id: "q4a", label: "もう少し目立っていい",             tags: ["sharp", "expressive"] },
      { id: "q4b", label: "もう少し落ち着いた雰囲気に",       tags: ["quiet", "minimal"] },
      { id: "q4c", label: "もう少し大人っぽく",               tags: ["mature", "elegant"] },
      { id: "q4d", label: "もう少し自由に",                   tags: ["rebellious", "relaxed"] },
      { id: "q4e", label: "もう少し色気を出したい",           tags: ["sensual", "dark"] },
      { id: "q4f", label: "今の方向性をもっと洗練させたい",   tags: ["refined"] },
    ],
  },
  {
    id: "q5", step: 5, kind: "single_with_reasons", scoring: "score", required: true,
    question: "気になるけど選べない服はある？",
    hint:     "1つ選択。「ある」を選んだ場合は理由も複数選択可",
    options: [
      {
        id: "q5a", label: "ある",
        reasons: [
          { id: "q5a1", label: "似合わないと思う",       tags: ["structured"] },
          { id: "q5a2", label: "周りの目が気になる",     tags: ["quiet", "distance"] },
          { id: "q5a3", label: "着こなす自信がない",     tags: ["protective"] },
          { id: "q5a4", label: "自分らしくない気がする", tags: ["rebellious"] },
        ],
      },
      { id: "q5b", label: "特にない", tags: [] },
    ],
  },
  {
    id: "q6", step: 6, kind: "single", scoring: "score", required: true,
    question: "服を選ぶとき最初に見るものは？",
    hint:     "1つだけ選んでください",
    options: [
      { id: "q6a", label: "形・シルエット", tags: ["structured", "sharp"] },
      { id: "q6b", label: "色",             tags: ["expressive"] },
      { id: "q6c", label: "素材・手触り",   tags: ["sensual", "raw"] },
      { id: "q6d", label: "ブランド",       tags: ["refined", "intellectual"] },
      { id: "q6e", label: "価格",           tags: ["practical"] },
      { id: "q6f", label: "着やすさ",       tags: ["relaxed", "approachable"] },
      { id: "q6g", label: "トレンド",       tags: ["youthful", "open"] },
    ],
  },
  {
    id: "q7", step: 7, kind: "multi", scoring: "score", required: true,
    question: "自分らしくいられる場所は？",
    hint:     "複数選択可",
    options: [
      { id: "q7a", label: "美術館・ギャラリー",         tags: ["intellectual", "minimal", "quiet"] },
      { id: "q7b", label: "ライブハウス・クラブ",       tags: ["rebellious", "raw", "expressive"] },
      { id: "q7c", label: "古書店・ヴィンテージショップ", tags: ["nostalgic", "intellectual"] },
      { id: "q7d", label: "夜の都市",                   tags: ["dark", "urban", "sensual"] },
      { id: "q7e", label: "自然・森・海",               tags: ["natural", "relaxed", "open"] },
      { id: "q7f", label: "静かなカフェ",               tags: ["quiet", "minimal", "approachable"] },
      { id: "q7g", label: "スタジアム・スポーツ施設",   tags: ["structured", "light"] },
    ],
  },
  {
    id: "q8", step: 8, kind: "multi", scoring: "score", required: true,
    question: "惹かれる時代・文化は？",
    hint:     "複数選択可",
    options: [
      { id: "q8a", label: "90年代（グランジ・モード）",         tags: ["rebellious", "raw", "nostalgic"] },
      { id: "q8b", label: "2000年代（Y2K・ストリート）",         tags: ["youthful", "expressive", "urban"] },
      { id: "q8c", label: "現代ミニマル",                       tags: ["minimal", "clean", "refined"] },
      { id: "q8d", label: "韓国（Kポップ・韓国ファッション）", tags: ["structured", "clean", "youthful"] },
      { id: "q8e", label: "ヨーロッパ（パリ・ロンドン）",       tags: ["elegant", "intellectual", "refined"] },
      { id: "q8f", label: "アメリカ（NY・LA）",                 tags: ["urban", "relaxed", "expressive"] },
      { id: "q8g", label: "日本（裏原・渋谷・京都）",           tags: ["quiet", "structured", "nostalgic"] },
    ],
  },
  {
    id: "q9", step: 9, kind: "single", scoring: "score", required: true,
    question: "好きな映画の雰囲気は？",
    hint:     "1つだけ選んでください",
    options: [
      { id: "q9a", label: "スタイリッシュで緊張感がある", tags: ["sharp", "dark", "structured"] },
      { id: "q9b", label: "静かで詩的",                   tags: ["quiet", "minimal", "intellectual"] },
      { id: "q9c", label: "自由でエネルギーがある",       tags: ["expressive", "rebellious", "raw"] },
      { id: "q9d", label: "温かくて人間的",               tags: ["approachable", "open", "natural"] },
      { id: "q9e", label: "美しくて退廃的",               tags: ["sensual", "dark", "elegant"] },
    ],
  },
  {
    id: "q10", step: 10, kind: "single", scoring: "score", required: true,
    question: "好きな音楽の空気感は？",
    hint:     "1つだけ選んでください",
    options: [
      { id: "q10a", label: "ミニマルで静かな音楽",       tags: ["quiet", "minimal", "intellectual"] },
      { id: "q10b", label: "重くてエネルギーがある",     tags: ["raw", "dark", "heavy"] },
      { id: "q10c", label: "メロディアスで感情的",       tags: ["romantic", "sensual", "open"] },
      { id: "q10d", label: "テンポが速くてハイな感じ",   tags: ["expressive", "youthful", "light"] },
      { id: "q10e", label: "渋くて時代を感じる",         tags: ["nostalgic", "mature", "refined"] },
    ],
  },
  {
    id: "q11", step: 11, kind: "single", scoring: "score", required: true,
    question: "惹かれる香りは？",
    hint:     "1つだけ選んでください",
    options: [
      { id: "q11a", label: "木や土のような自然な香り",       tags: ["natural", "raw"] },
      { id: "q11b", label: "クリーンで石けんのような香り",   tags: ["clean", "minimal"] },
      { id: "q11c", label: "重くてスパイシーな香り",         tags: ["dark", "sensual", "heavy"] },
      { id: "q11d", label: "甘くてフローラルな香り",         tags: ["romantic", "soft", "youthful"] },
      { id: "q11e", label: "古本や革のような香り",           tags: ["nostalgic", "intellectual", "raw"] },
    ],
  },
  {
    id: "q12", step: 12, kind: "single", scoring: "score", required: true,
    question: "色の空気感で選ぶなら？",
    hint:     "1つだけ選んでください",
    options: [
      { id: "q12a", label: "黒・墨・ダークトーン",       tags: ["dark", "heavy", "mysterious"] },
      { id: "q12b", label: "白・グレー・無彩色",         tags: ["minimal", "clean", "quiet"] },
      { id: "q12c", label: "くすんだ・土の色",           tags: ["natural", "nostalgic", "raw"] },
      { id: "q12d", label: "鮮やかで強い色",             tags: ["expressive", "sharp", "rebellious"] },
      { id: "q12e", label: "パステル・やわらかい色",     tags: ["soft", "romantic", "approachable"] },
    ],
  },
  {
    id: "q13", step: 13, kind: "single", scoring: "score", required: true,
    question: "素材の感触で選ぶなら？",
    hint:     "1つだけ選んでください",
    options: [
      { id: "q13a", label: "ハリがあって形が決まる",         tags: ["structured", "sharp", "refined"] },
      { id: "q13b", label: "やわらかくてくったりした感じ",   tags: ["relaxed", "natural", "soft"] },
      { id: "q13c", label: "ざらっとした素朴な質感",         tags: ["raw", "natural", "nostalgic"] },
      { id: "q13d", label: "なめらかで上質な感触",           tags: ["elegant", "sensual", "refined"] },
      { id: "q13e", label: "重くてどっしりした素材",         tags: ["heavy", "protective", "mature"] },
    ],
  },
  {
    id: "q14", step: 14, kind: "single", scoring: "hint", required: true,
    question: "コーデで一番困ることは？",
    hint:     "1つだけ選んでください（世界観判定には使わず、アドバイス生成のヒントとして使われます）",
    options: [
      { id: "q14a", label: "何を合わせていいかわからない" },
      { id: "q14b", label: "似たような服ばかりになる" },
      { id: "q14c", label: "着たい服が似合わない" },
      { id: "q14d", label: "流行に乗れているか不安" },
      { id: "q14e", label: "服はあるのに「ない」と感じる" },
    ],
  },
  {
    id: "q15", step: 15, kind: "free_text", scoring: "hint", required: false,
    question: "今の自分にはないが気になる服・雰囲気・人物像は？",
    hint:     "任意入力。例：「90年代のNYブルックリンの空気」「ローブ・ディシャンブルみたいな佇まい」「制服のように整った人」など。スキップ可能。",
    options: [],
  },
];

export function getQuestionById(id: string): DiagnosisQuestion | undefined {
  return DIAGNOSIS_QUESTIONS.find((q) => q.id === id);
}
