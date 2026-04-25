export interface MaterialEntry {
  name: string;
  instinctiveImage: string[];
  culturalContext: string[];
  physicalSensation: string[];
  universalMood: string[];
  oppositeOf: string[];
}

export const MATERIAL_DICT: Record<string, MaterialEntry> = {
  "綿": {
    name: "綿",
    instinctiveImage: ["雲", "綿毛", "肌着", "清潔な布", "白い野原"],
    culturalContext: ["日常着・普段着（世界共通）", "農業・土地（歴史的）", "清潔・シンプル", "素朴・労働"],
    physicalSensation: ["柔らかく包まれる", "汗を吸う", "体温に馴染む", "重さがない"],
    universalMood: ["日常", "安心", "素直さ", "身近さ"],
    oppositeOf: ["シルク", "革"],
  },
  "麻": {
    name: "麻",
    instinctiveImage: ["乾いた草", "荒野", "海辺", "古い帆布", "夏の昼"],
    culturalContext: ["古代エジプト・神聖な布", "地中海・夏", "自然主義（現代）", "農耕・自然との共存"],
    physicalSensation: ["ざらっとした手触り", "乾いている", "涼しい", "張りがある"],
    universalMood: ["乾燥", "自由", "野性", "清潔な粗さ"],
    oppositeOf: ["カシミヤ", "ベルベット"],
  },
  "毛": {
    name: "毛",
    instinctiveImage: ["羊の群れ", "冬の牧場", "焚き火", "霜", "モコモコした動物"],
    culturalContext: ["寒冷地の生存（北欧・英国）", "牧畜・農耕文化", "冬・内側への引きこもり", "守護・保護"],
    physicalSensation: ["重い", "温かい", "包まれる", "少しチクチクする"],
    universalMood: ["保護", "冬", "動物的な温もり", "生き延びること"],
    oppositeOf: ["麻", "シルク"],
  },
  "ウール": {
    name: "ウール",
    instinctiveImage: ["羊の群れ", "冬の牧場", "焚き火", "霜", "モコモコした動物"],
    culturalContext: ["寒冷地の生存（北欧・英国）", "牧畜・農耕文化", "冬・内側への引きこもり", "守護・保護"],
    physicalSensation: ["重い", "温かい", "包まれる", "少しチクチクする"],
    universalMood: ["保護", "冬", "動物的な温もり", "生き延びること"],
    oppositeOf: ["麻", "シルク"],
  },
  "絹": {
    name: "絹",
    instinctiveImage: ["蛾の繭", "水面の反射", "月光", "蛇の鱗", "流れる川"],
    culturalContext: ["東洋の贅沢・権威（シルクロード）", "皇帝・宮廷", "婚礼・祝祭", "官能・非日常"],
    physicalSensation: ["滑らかで冷たい", "体温でじわっと温まる", "軽い", "衣擦れの音がする"],
    universalMood: ["官能", "流動", "非日常", "脆さ"],
    oppositeOf: ["デニム", "ウール"],
  },
  "シルク": {
    name: "シルク",
    instinctiveImage: ["蛾の繭", "水面の反射", "月光", "蛇の鱗", "流れる川"],
    culturalContext: ["東洋の贅沢・権威（シルクロード）", "皇帝・宮廷", "婚礼・祝祭", "官能・非日常"],
    physicalSensation: ["滑らかで冷たい", "体温でじわっと温まる", "軽い", "衣擦れの音がする"],
    universalMood: ["官能", "流動", "非日常", "脆さ"],
    oppositeOf: ["デニム", "ウール"],
  },
  "革": {
    name: "革",
    instinctiveImage: ["動物の皮膚", "傷口が塞がった後", "鎧", "蹄", "日に焼けた皮膚"],
    culturalContext: ["狩猟・原始（起源）", "鎧・保護・戦士", "権威・地位（歴史）", "反抗・バイカー（現代）"],
    physicalSensation: ["硬い", "重い", "冷たいが体温を吸収する", "独特の匂い"],
    universalMood: ["境界", "保護", "動物性", "不可侵"],
    oppositeOf: ["綿", "シルク"],
  },
  "ポリエステル": {
    name: "ポリエステル",
    instinctiveImage: ["工場", "透明なフィルム", "宇宙服の素材", "変形しない形"],
    culturalContext: ["大量生産・工業化（20世紀）", "機能主義・現代", "自然からの離脱", "民主的な服（安価・耐久）"],
    physicalSensation: ["滑らか（人工的に）", "水を通しにくい", "軽い", "静電気が起きやすい"],
    universalMood: ["機能", "人工", "均一", "実用"],
    oppositeOf: ["綿", "麻"],
  },
  "ナイロン": {
    name: "ナイロン",
    instinctiveImage: ["雨", "透明な膜", "蜘蛛の巣", "宇宙服", "工場"],
    culturalContext: ["第二次大戦・科学の勝利（起源）", "機能主義・現代", "スポーツ・効率", "自然からの離脱"],
    physicalSensation: ["冷たい", "滑らか（人工的に）", "水を通さない", "軽い"],
    universalMood: ["機能", "人工", "未来", "防御"],
    oppositeOf: ["綿", "麻"],
  },
  "カシミヤ": {
    name: "カシミヤ",
    instinctiveImage: ["山の霧", "子ヤギ", "雲の内側", "柔らかい光", "眠り"],
    culturalContext: ["ヒマラヤ・遊牧民（起源）", "西洋高級品・贅沢", "成功・地位（現代）", "「手に入れた人間」の象徴"],
    physicalSensation: ["羽のように軽い", "極めて柔らかい", "温かいのに重くない", "触れたくなる"],
    universalMood: ["贅沢", "静けさ", "成熟した快楽", "疑いのない安心"],
    oppositeOf: ["デニム", "ナイロン"],
  },
  "テンセル": {
    name: "テンセル",
    instinctiveImage: ["透明な水", "霞", "早朝の露", "清潔な川", "新緑"],
    culturalContext: ["現代の持続可能性", "「自然と技術の融合」という概念", "環境意識・誠実さ（現代）"],
    physicalSensation: ["なめらかで涼しい", "水のように軽い", "体に沿う", "乾きが早い"],
    universalMood: ["透明", "誠実", "軽やかな清潔感", "新しい自然"],
    oppositeOf: ["革", "ベルベット"],
  },
  "レーヨン": {
    name: "レーヨン",
    instinctiveImage: ["水面のゆらぎ", "薄い布", "蒸気", "柔らかい光"],
    culturalContext: ["シルクの代用として誕生（近代）", "大衆的な柔らかさ", "手頃な官能性"],
    physicalSensation: ["しっとりと柔らかい", "肌に吸い付く", "軽い", "しわになりやすい"],
    universalMood: ["柔らかさ", "流動", "日常の中の官能"],
    oppositeOf: ["革", "デニム"],
  },
  "モヘア": {
    name: "モヘア",
    instinctiveImage: ["アンゴラヤギ", "ふわふわした動物", "霜", "雲", "光をまとった毛"],
    culturalContext: ["贅沢な動物繊維", "冬の豊かさ", "北欧・英国の工芸"],
    physicalSensation: ["ふわふわと軽い", "肌に触れるとくすぐったい", "光を反射する", "柔らかい境界感"],
    universalMood: ["柔らかさ", "温もり", "遊び心", "ふわっとした存在感"],
    oppositeOf: ["デニム", "革"],
  },
  "アルパカ": {
    name: "アルパカ",
    instinctiveImage: ["アンデスの高原", "雲", "霧の中の動物", "静かな山"],
    culturalContext: ["南米・アンデス先住民（起源）", "高地の生存と温もり", "現代の高級繊維"],
    physicalSensation: ["非常に柔らかい", "軽いのに温かい", "チクチクしない", "繊細な手触り"],
    universalMood: ["静けさ", "高地", "繊細な温もり", "遠い場所"],
    oppositeOf: ["革", "ナイロン"],
  },
};
