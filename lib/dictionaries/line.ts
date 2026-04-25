export interface LineEntry {
  name: string;
  visualEffect: string[];
  psychologicalEffect: string[];
  bodyImpact: string[];
  universalMood: string[];
}

export const LINE_DICT: Record<string, LineEntry> = {
  "オーバーサイズ": {
    name: "オーバーサイズ",
    visualEffect: ["輪郭が曖昧になる", "体が服に飲み込まれる", "重心が下がる"],
    psychologicalEffect: ["包まれている感覚", "鎧・隠れ家", "脱力・脱構造"],
    bodyImpact: ["体型を隠す", "肩幅が強調されやすい", "首が短く見えることがある"],
    universalMood: ["余白", "無防備な強さ", "意図的なルーズさ"],
  },
  "スリム": {
    name: "スリム",
    visualEffect: ["輪郭がくっきり出る", "縦ラインが強調される", "動くたびに体が見える"],
    psychologicalEffect: ["緊張感・緊迫", "切れ味・鋭さ", "隠さない意志"],
    bodyImpact: ["体型がそのまま出る", "脚が長く見える", "腰位置が明確になる"],
    universalMood: ["鋭利", "自信", "都市的な緊張"],
  },
  "ワイド": {
    name: "ワイド",
    visualEffect: ["横への広がり", "体の重心が拡散する", "布が空気を含む"],
    psychologicalEffect: ["ゆとり・余裕", "風土的・大らか", "意図的な非構造"],
    bodyImpact: ["腰・脚の形を隠す", "上半身が小さく見える", "存在感が横に広がる"],
    universalMood: ["解放", "余裕", "動きの自由"],
  },
  "テーパード": {
    name: "テーパード",
    visualEffect: ["上から下へ向かって絞られる", "脚のラインが出る", "視線が下に引き寄せられる"],
    psychologicalEffect: ["収束・まとまり", "清潔感・整理", "完結する形"],
    bodyImpact: ["脚を長く・細く見せる", "裾に向かって引き締まる", "腰位置を上に見せやすい"],
    universalMood: ["洗練", "収束", "端正"],
  },
  "フレア": {
    name: "フレア",
    visualEffect: ["裾に向かって広がる", "動くたびに揺れる", "下に向かって軽さが増す"],
    psychologicalEffect: ["解放・広がり", "遊び・喜び", "重力に逆らわない"],
    bodyImpact: ["ヒップを目立たなくする", "脚の形を隠す", "腰から下が軽く見える"],
    universalMood: ["流動", "解放", "軽やかさ"],
  },
  "Aライン": {
    name: "Aライン",
    visualEffect: ["三角形のシルエット", "上が小さく下が広がる", "安定した視覚的重心"],
    psychologicalEffect: ["安定感・安心", "バランスの良さ", "古典的な美"],
    bodyImpact: ["上半身を小さく見せる", "腰・脚を包む", "全体的にすっきり"],
    universalMood: ["古典的均衡", "女性性", "安定"],
  },
  "Iライン": {
    name: "Iライン",
    visualEffect: ["縦一直線", "細く長く見える", "体が柱のように見える"],
    psychologicalEffect: ["高さ・垂直性", "ストイック・禁欲", "動じない強さ"],
    bodyImpact: ["縦に長く見せる", "体型の凹凸を吸収する", "重心が中央に集まる"],
    universalMood: ["垂直性", "静けさ", "建築的"],
  },
  "Yライン": {
    name: "Yライン",
    visualEffect: ["上が大きく下が小さい", "肩から首元に視線が集まる", "逆三角形"],
    psychologicalEffect: ["力強さ・権威", "存在感・威圧", "頂点への視線誘導"],
    bodyImpact: ["肩幅を強調する", "足を長く見せる", "上半身の存在感が増す"],
    universalMood: ["力", "威厳", "上方への引力"],
  },
  "コクーン": {
    name: "コクーン",
    visualEffect: ["卵型・まゆ型", "体が包まれる", "輪郭がぼんやりする"],
    psychologicalEffect: ["保護・籠もり", "内向き・内省", "殻の中の安心"],
    bodyImpact: ["体型を完全に隠す", "首と手首だけが出る", "存在感が丸く柔らかくなる"],
    universalMood: ["保護", "内側へ", "繭・再生"],
  },
  "クロップド": {
    name: "クロップド",
    visualEffect: ["丈が短い", "腰・ウエスト位置が見える", "上下の比率が変わる"],
    psychologicalEffect: ["軽さ・活動的", "見せる意志", "身軽さ"],
    bodyImpact: ["腰位置を高く見せる", "脚を長く見せる", "ウエストラインを強調"],
    universalMood: ["軽快", "比率操作", "露出の意図"],
  },
};
