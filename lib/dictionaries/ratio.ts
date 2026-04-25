export interface RatioEntry {
  pattern: string;
  weightCenter: "upper" | "lower" | "balanced";
  instinctiveFeel: string[];
  silhouetteEffect: string[];
  universalMood: string[];
}

export const RATIO_DICT: Record<string, RatioEntry> = {
  "上3:下7": {
    pattern: "上3:下7",
    weightCenter: "lower",
    instinctiveFeel: ["重力に沿っている", "下に引っ張られる", "脚が主役"],
    silhouetteEffect: ["脚が長く見える", "上半身が軽く見える", "縦の伸びを感じる"],
    universalMood: ["伸び・高さ", "モード感", "洗練"],
  },
  "上4:下6": {
    pattern: "上4:下6",
    weightCenter: "lower",
    instinctiveFeel: ["ほどよく下重心", "自然な立ち姿", "余裕がある"],
    silhouetteEffect: ["脚がきれいに見える", "腰位置が高く見える", "無理のないバランス"],
    universalMood: ["自然な均衡", "日常の洗練", "着やすさ"],
  },
  "上5:下5": {
    pattern: "上5:下5",
    weightCenter: "balanced",
    instinctiveFeel: ["ど真ん中", "安定している", "揺れない"],
    silhouetteEffect: ["体が真ん中に分割される", "バランスが読みやすい", "安定した印象"],
    universalMood: ["均衡", "正直", "クラシック"],
  },
  "上6:下4": {
    pattern: "上6:下4",
    weightCenter: "upper",
    instinctiveFeel: ["上に視線が集まる", "顔・首元が主役", "重心が胸より上"],
    silhouetteEffect: ["上半身の存在感が増す", "ボトムスが軽くなる", "顔周りへの視線誘導"],
    universalMood: ["存在感", "上半身の主張", "肩・胸のフレーミング"],
  },
  "上7:下3": {
    pattern: "上7:下3",
    weightCenter: "upper",
    instinctiveFeel: ["トップスが圧倒的", "ボトムスは土台", "上から見下ろすような視点"],
    silhouetteEffect: ["Yラインに近い印象", "脚が短く見えることがある", "上半身に全視線が集まる"],
    universalMood: ["権威", "圧倒感", "上半身のドラマ"],
  },
  "タック・イン（ウエスト見せ）": {
    pattern: "タック・イン",
    weightCenter: "balanced",
    instinctiveFeel: ["くびれを意識させる", "腰位置が明確になる", "境界線を作る"],
    silhouetteEffect: ["ウエストが細く見える", "上下の境界が明確になる", "腰が高く見える"],
    universalMood: ["意図的な分割", "ウエストの強調", "境界の美学"],
  },
  "ハイウエスト": {
    pattern: "ハイウエスト",
    weightCenter: "lower",
    instinctiveFeel: ["腰が高い", "脚が長く伸びる感覚", "上半身が短縮される"],
    silhouetteEffect: ["脚が長く見える", "ウエストが胸下に来る", "縦の比率が操作される"],
    universalMood: ["垂直性", "レトロ", "優雅な比率"],
  },
  "ローウエスト": {
    pattern: "ローウエスト",
    weightCenter: "lower",
    instinctiveFeel: ["腰が低い", "重心が下がる", "ストリート的な脱力感"],
    silhouetteEffect: ["腰・ヒップが目立つ", "2000年代的な印象", "上半身が長くなる"],
    universalMood: ["脱力", "ストリート", "重力への服従"],
  },
};
