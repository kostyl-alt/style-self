import type { BodyProfile, BodyConcern, BodyShapeDescription } from "@/types/index";

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
