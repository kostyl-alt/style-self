import type { BodyProfile, BodyConcern } from "@/types/index";

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
