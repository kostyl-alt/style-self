import type {
  BodyProfile, BodyConcern, BodyShapeDescription, SilhouetteRecommendation,
} from "@/types/index";

interface BodyAdjustments {
  recommendedSilhouettes: string[];
  avoidElements: string[];
  weightCenterAdvice: string;
  heightAdvice: string;
}

const CONCERN_RULES: Record<BodyConcern, { recommend: string[]; avoid: string[] }> = {
  looks_young: {
    recommend: ["きれいめシルエット", "落ち着いたカラーの組み合わせ"],
    avoid:     ["全身パステルカラー", "ベビーフェイス強調のハイウエスト"],
  },
  short_legs: {
    recommend: ["ハイウエスト", "テーパードシルエット", "縦ラインを強調するコーデ"],
    avoid:     ["ローウエスト", "ワイドストレート", "足首を隠す丈"],
  },
  broad_shoulders: {
    recommend: ["Vネック", "視線を下に誘導するボトムスへのアクセント"],
    avoid:     ["ノースリーブ", "ボートネック", "肩パッド入りアウター"],
  },
  wide_hips: {
    recommend: ["Aライン", "ストレートシルエット"],
    avoid:     ["ヒップ周りの大柄・ポケット装飾", "タイトスカート"],
  },
  short_torso: {
    recommend: ["ロング丈トップス", "ウエストを強調しないシルエット"],
    avoid:     ["ハイウエスト", "クロップドトップス"],
  },
  top_heavy: {
    recommend: ["Aラインボトムス", "フレアスカート", "ボリュームのあるボトムス"],
    avoid:     ["タイトボトムス", "上半身に視線を集める大柄・装飾"],
  },
  bottom_heavy: {
    recommend: ["Yラインシルエット", "ボリュームのあるトップス", "ドロップショルダー"],
    avoid:     ["細身トップス×ワイドボトムスの組み合わせ", "ロールアップで足首強調"],
  },
};

export function getBodyAdjustments(profile: BodyProfile): BodyAdjustments {
  const recommended = new Set<string>();
  const avoid = new Set<string>();

  for (const concern of profile.concerns) {
    const rule = CONCERN_RULES[concern];
    rule.recommend.forEach((r) => recommended.add(r));
    rule.avoid.forEach((a) => avoid.add(a));
  }

  // skeletonType による追加ルール
  if (profile.skeletonType === "straight") {
    recommended.add("ジャストサイズ〜やや大きめのシルエット");
    recommended.add("シンプルなテクスチャー素材");
  } else if (profile.skeletonType === "wave") {
    recommended.add("フィット感のあるシルエット");
    recommended.add("ウエストマークのあるデザイン");
    avoid.add("オーバーサイズ全体");
  } else if (profile.skeletonType === "natural") {
    recommended.add("素材感のあるナチュラルテクスチャー");
    recommended.add("ゆったりめのシルエット");
  }

  // height帯アドバイス
  let heightAdvice = "";
  if (profile.height <= 155) {
    heightAdvice = "ハイウエストのボトムスで脚長効果を出す。ロング丈は避け、縦ラインを意識する。";
    recommended.add("ハイウエスト");
    avoid.add("ロング丈アウター・マキシ丈");
  } else if (profile.height >= 166) {
    heightAdvice = "ロング丈やローウエストも取り入れられる。丈感のバリエーションを楽しめる。";
  } else {
    heightAdvice = "丈感の制約が少なく、多様なシルエットが合わせやすい。";
  }

  // 重心アドバイス（concerns の組み合わせから総合判断）
  let weightCenterAdvice = "バランスの取れたシルエットを意識する。";
  const hasTopHeavy    = profile.concerns.includes("top_heavy");
  const hasBottomHeavy = profile.concerns.includes("bottom_heavy");
  const hasShortLegs   = profile.concerns.includes("short_legs");

  if (hasTopHeavy) {
    weightCenterAdvice = "視線を下半身に誘導するAラインやフレアシルエットで重心を下げる。";
  } else if (hasBottomHeavy) {
    weightCenterAdvice = "トップスにボリュームを持たせたYラインで重心を上げる。";
  } else if (hasShortLegs) {
    weightCenterAdvice = "ハイウエストで脚の付け根を高く見せ、縦のラインを強調する。";
  }

  return {
    recommendedSilhouettes: Array.from(recommended),
    avoidElements:          Array.from(avoid),
    weightCenterAdvice,
    heightAdvice,
  };
}

// R-2: 体型特徴の中立的・前向き言語化。
// 設計: docs/STYLE-SELF_D1_リアル試着_MVP_スコープ_R-1〜R-3_設計調査.md §3.2
// ★ ルールベース(Vision/Claude 不使用・コスト 0・決定論的)
// ★ E-0b 中核思想「体型を否定せず・その体型で世界観が成立する構造」を反映
//   → 「短所」ではなく「特徴」として言語化(例: ×「胴長で脚短い」○「重心高めの構成」)
const CONCERN_REFRAME: Record<BodyConcern, string> = {
  looks_young:     "若見えしやすい雰囲気",
  short_legs:      "重心高めの構成",
  broad_shoulders: "肩幅しっかりめ",
  wide_hips:       "下半身の安定感",
  short_torso:     "上半身のコンパクトさ",
  top_heavy:       "上半身に存在感",
  bottom_heavy:    "下半身に存在感",
};

export function describeBodyShape(profile: BodyProfile): BodyShapeDescription {
  const features:  string[] = [];
  const sentences: string[] = [];
  const push = (tag: string) => { if (!features.includes(tag)) features.push(tag); };

  // height 帯(R-1 値必須)
  if (profile.height > 0) {
    if (profile.height <= 155) {
      push("身長低め");
      sentences.push("身長は低めで、縦のラインを活かす着こなしが映えるタイプです。");
    } else if (profile.height >= 166) {
      push("身長高め");
      sentences.push("身長は高めで、丈感のバリエーションを楽しめるプロポーションです。");
    } else {
      push("標準身長");
    }
  }

  // 肩幅(R-1 cm 値 / 身長比で判定)
  if (profile.shoulderWidthCm && profile.height > 0) {
    const ratio = profile.shoulderWidthCm / profile.height;
    if (ratio >= 0.245) {
      push("肩幅しっかりめ");
      sentences.push("肩幅はしっかりめで、上半身に芯を持たせる構造が似合います。");
    } else if (ratio <= 0.22) {
      push("肩幅華奢め");
      sentences.push("肩幅は華奢めで、繊細なネックラインや小物が映えます。");
    }
  }

  // 股下 / 身長比で脚バランス(R-1 inseam)
  if (profile.inseamCm && profile.height > 0) {
    const ratio = profile.inseamCm / profile.height;
    if (ratio >= 0.47) {
      push("脚のラインが長め");
      sentences.push("脚のラインが長めで、ロング丈やストレートシルエットを綺麗に着こなせます。");
    } else if (ratio <= 0.43) {
      push("重心高めの構成");
      sentences.push("重心がやや高めの構成で、ハイウエストや短丈トップスとの相性が良いタイプです。");
    }
  }

  // 首の長さ(R-1 neckLength)
  if (profile.neckLength === "long") {
    push("首が長め");
    sentences.push("首が長めで、ハイネックや存在感のあるネックラインが似合います。");
  } else if (profile.neckLength === "short") {
    push("首がコンパクト");
    sentences.push("首はコンパクトで、Vネックや開きのあるカットラインがすっきり映えます。");
  }

  // 骨格・体型(既存 BodyProfile フィールド)
  if (profile.skeletonType === "straight") push("ストレート骨格");
  if (profile.skeletonType === "wave")     push("ウェーブ骨格");
  if (profile.skeletonType === "natural")  push("ナチュラル骨格");
  if (profile.bodyType     === "slim")     push("スリム体型");
  if (profile.bodyType     === "muscular") push("筋肉質体型");
  if (profile.bodyType     === "curvy")    push("カーヴィ体型");

  // concerns の re-frame(★ 否定的にならない言い換え)
  for (const c of profile.concerns) {
    const tag = CONCERN_REFRAME[c];
    if (tag) push(tag);
  }

  // 全文が空なら、最低限の中立メッセージ
  if (sentences.length === 0) {
    sentences.push("基本のプロポーションで、多様なシルエットを試せるタイプです。");
  }

  return { natural: sentences.join(" "), features };
}

// R-3: 体型別シルエット推奨。
// 設計: docs/STYLE-SELF_D1_リアル試着_MVP_スコープ_R-1〜R-3_設計調査.md §4
// ★ ルールベース(Vision/Claude 不使用・決定論的・コスト 0)。
// ★ 「低身長ロングコート 3 法則」(lib/prompts/stylist-chat.ts 良い例 5)のルール化を含む。
// ★ E-0b 中核思想:「避ける」を「別の選択肢として」前向きに表現(否定形ゼロ)。
//
// concerns ごとの「別の選択肢」言い換え(★ 否定形を使わない・前向き提案として表記)。
const CONCERN_ALTERNATIVES: Record<BodyConcern, string[]> = {
  looks_young:     ["落ち着いた色面 → ベビーフェイス印象から大人の余白へ"],
  short_legs:      ["ロー位置トップス → ハイウエストで縦比率を強調"],
  broad_shoulders: ["ノースリーブ・ボートネック → V ネックで視線を下へ流す"],
  wide_hips:       ["タイトスカート → A ラインで腰回りを自然に流す"],
  short_torso:     ["ハイウエスト極端 → ロング丈トップスで縦を確保"],
  top_heavy:       ["タイトボトム → A ライン or フレアで重心を下げる"],
  bottom_heavy:    ["細身トップス × ワイドボトム → Y ライン or ドロップショルダーで上に重心"],
};

export function recommendSilhouette(
  profile: BodyProfile,
  shape:   BodyShapeDescription,
): SilhouetteRecommendation {
  const lengths:      string[] = [];
  const shoes:        string[] = [];
  const accessories:  string[] = [];
  const alternatives: string[] = [];
  const reasons:      string[] = [];
  const push = (arr: string[], v: string) => { if (!arr.includes(v)) arr.push(v); };

  // ---- height 帯 ----
  // ★ 「低身長ロングコート 3 法則」(lib/prompts/stylist-chat.ts 良い例 5)をルール化:
  //   ①上半身を短く ②ボトム長め+前だけタックイン ③靴は厚底か濃色で縦に伸ばす
  if (profile.height > 0 && profile.height <= 155) {
    push(lengths, "短丈トップス(上半身を短く見せる)");
    push(lengths, "ロング丈アウター(縦比率の演出で着られる)");
    push(lengths, "ボトムスは丈長め + 前だけタックイン");
    push(shoes,   "厚底・濃色シューズ(縦に伸ばす)");
    push(accessories, "縦長ネックレス");
    push(accessories, "縦ラインのスカーフ");
    reasons.push("縦比率を強調すると、低身長でも世界観成立するシルエットになります。");
  } else if (profile.height >= 166) {
    push(lengths, "ロング丈アウター・マキシ丈");
    push(lengths, "ミディ丈ボトム");
    push(shoes,   "ヒール・フラットどちらも");
    push(accessories, "大ぶりアクセサリー");
    reasons.push("丈感のバリエーションを活かせるプロポーションです。");
  } else if (profile.height > 0) {
    push(lengths, "ジャスト丈〜ミディ丈");
    reasons.push("丈感の制約が少なく、多様なシルエットが合わせやすいプロポーションです。");
  }

  // ---- 股下 / 身長比 ----
  if (profile.inseamCm && profile.height > 0) {
    const ratio = profile.inseamCm / profile.height;
    if (ratio <= 0.43) {
      push(lengths, "ハイウエストボトム(脚の付け根を高く見せる)");
      push(accessories, "縦のラインを意識する小物(縦長ペンダント等)");
      reasons.push("重心高めの構成を活かし、縦のラインで脚長効果を引き出すと映えます。");
    } else if (ratio >= 0.47) {
      push(lengths, "ストレートシルエットのロングボトム");
      reasons.push("脚のラインが長めなので、ストレートシルエットを綺麗に着こなせます。");
    }
  }

  // ---- 骨格 ----
  if (profile.skeletonType === "straight") {
    push(lengths, "ジャストサイズ〜やや大きめ");
    push(accessories, "シンプルなテクスチャーの小物");
    reasons.push("ストレート骨格はシンプルな素材感で芯を保つと映えます。");
  } else if (profile.skeletonType === "wave") {
    push(lengths, "ウエストマークのあるシルエット");
    push(shoes,   "華奢めシューズ");
    reasons.push("ウェーブ骨格は曲線を活かすフィット感が似合います。");
  } else if (profile.skeletonType === "natural") {
    push(lengths, "ゆったり丈・落ち感のあるシルエット");
    push(shoes,   "ボリュームのあるシューズ");
    push(accessories, "素材感のあるアクセサリー");
    reasons.push("ナチュラル骨格は素材感のあるテクスチャーが似合います。");
  }

  // ---- 首の長さ(R-1 neckLength)----
  if (profile.neckLength === "long") {
    push(accessories, "ハイネック・存在感のあるネックライン");
    reasons.push("首が長めなので、首元に存在感を持たせると映えます。");
  } else if (profile.neckLength === "short") {
    push(accessories, "V ネック・開きのあるカットライン");
    reasons.push("首はコンパクトなので、ネック開きで縦の抜けを作るとすっきり映えます。");
  }

  // ---- 肩幅(R-1 shoulderWidthCm)----
  if (profile.shoulderWidthCm && profile.height > 0) {
    const r = profile.shoulderWidthCm / profile.height;
    if (r >= 0.245) {
      push(accessories, "視線を下に誘導する縦長アクセサリー");
      alternatives.push("ボリュームのある肩パッド → 視線を下に誘導する縦長アクセサリー");
    } else if (r <= 0.22) {
      push(accessories, "繊細なネックラインや小物");
    }
  }

  // ---- concerns の「別の選択肢」(★ 否定形でなく前向き提案)----
  for (const c of profile.concerns) {
    const alts = CONCERN_ALTERNATIVES[c];
    if (alts) {
      for (const a of alts) { if (!alternatives.includes(a)) alternatives.push(a); }
    }
  }

  // ---- 何も推奨されない場合のフォールバック ----
  if (lengths.length === 0 && shoes.length === 0 && accessories.length === 0) {
    push(lengths, "ジャスト丈・標準シルエット");
    reasons.push("基本のプロポーションで、多様なシルエットを試せるタイプです。");
  }

  // ★ shape.features に応じた追補(R-2 連携・ 重複は push() で吸収)
  if (shape.features.includes("重心高めの構成")) {
    push(lengths, "ハイウエストで縦比率を演出");
  }

  return {
    recommendedLengths:     lengths,
    recommendedShoes:       shoes,
    recommendedAccessories: accessories,
    alternativeChoices:     alternatives,
    reasoning:              reasons.join(" "),
  };
}
