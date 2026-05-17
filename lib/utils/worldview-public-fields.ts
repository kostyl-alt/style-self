// フェーズB M2-3 判断B: HTML inline 漏洩対策ヘルパー
//
// /u/[userId] 公開ページは Server Component で SSR される。result jsonb 全体を
// そのまま <DiagnosisDisplay /> に渡すと、viewer="public" 側で表示しない
// 本人専用フィールド(avoidedImpression / unconsciousTendency / dailyAdvice 等)も
// HTML に inline されて View Source で見えてしまう。
//
// 本関数で result から「公開対象フィールド」だけを抜き出し、その結果を
// DiagnosisDisplay に渡すことで、HTML inline 自体に本人専用データを乗せない。
//
// 【重要】M2-2 の DiagnosisDisplay の public モードと公開対象を完全に一致させる。
// 片方だけ変えると事故になる(public でレンダリングされないけど HTML 上に残る、または
// HTML には無いけど public でレンダリングしようとして undefined エラー、等)。
//
// 【M2-3 漏洩修正(方向B)】フィールド単位の除外だけでは防げない、
// 「公開フィールドの中の自由文に本人の回答ラベル(避けたい印象 等)が
// AI によって引用される」漏洩を防ぐ。
//
// 対策:
//   (1) recommended* と culturalAffinities.* の各要素から「(括弧内)」を除去
//       例: 「Comme des Garçons(黒の哲学と非対称、量産型を避ける制約に直結)」
//           → 「Comme des Garçons」
//   (2) relatedInfluencers[].reason を空文字に(subject_name は残す)
//       DiagnosisDisplay 側で `{reason && ...}` ガードで空時非表示
//
// 公開対象(戻り値に含める・括弧除去後):
//   - worldviewName
//   - coreIdentity
//   - patternId (8 パターン版で coreTags 復元に必要)
//   - worldview_keywords (analyze-v2 版で coreTags 復元に必要)
//   - styleAxis.beliefKeywords (coreTags の最終フォールバック)
//   - idealSelf (Aspirations セクション・public で唯一の内面項目)
//   - attractedCulture (Culture Translation 冒頭)
//   - recommendedColors / Materials / Silhouettes / Accessories / Brands ★括弧除去
//   - firstPiece(name + zozoKeyword のみ・why 系は除く)
//   - culturalAffinities(music / films / fragrance / art) ★括弧除去
//   - relatedInfluencers[].subject_name のみ(reason は空文字)
//
// 非公開(戻り値に含めない・必須型項目は空値で埋める):
//   - plainSummary / coreIdentity を除く文章系: whyThisResult / styleStructure /
//     inputMapping / avoid / actionPlan / nextBuyingRule(全て必須型・空値で型を満たす)
//   - 内省項目: unconsciousTendency / avoidedImpression / avoidItems
//   - advisory 系: dailyAdvice / buyingPriority / avoidElements / preference
//   - firstPiece の why / whyLength / whyMaterial / whyWeight / whereToWear / photoLook
//   - メタ系: plainType / typeExplanation / worldview_tags(英語スラッグ・商品マッチ用で公開不要)

import type {
  StyleDiagnosisResult,
  StyleAxis,
  FirstPiece,
  CulturalAffinities,
  RelatedInfluencer,
} from "@/types/index";

// styleAxis 必須型を満たすための中立デフォルト(public では中身は表示されない)
const EMPTY_STYLE_AXIS: StyleAxis = {
  beliefKeywords:     [],
  colorTone:          "neutral",
  spaceFeeling:       "balanced",
  materialPreference: "mixed",
  summary:            "",
};

// 全角・半角の括弧と中身を除去。
// 例: 「墨黒(青みを含まない深い黒)」→「墨黒」
//     「Joy Division(ポスト・パンクの静かな緊張感)」→「Joy Division」
// AI が本人の回答ラベル(避けたい印象等)を括弧内に引用してくるパターンを潰す。
function stripParenthetical(s: string): string {
  return s.replace(/[(（][^)）]*[)）]/g, "").trim();
}

// 配列の各要素から括弧除去 + 空要素を除外(エッジケース対策)。
function stripParentheticalArray(arr: string[] | undefined): string[] | undefined {
  if (!arr) return undefined;
  return arr
    .map((s) => (typeof s === "string" ? stripParenthetical(s) : ""))
    .filter((s) => s.length > 0);
}

export function pickPublicFields(result: StyleDiagnosisResult): StyleDiagnosisResult {
  // firstPiece: name + zozoKeyword だけ復元。why は型必須なので空文字で埋める
  // (DiagnosisDisplay public 側は !isPublic && why のガードで非表示)。
  // why 系 5 つの optional は意図的に未設定 = HTML inline されない。
  // name は世界観の代表アイテム名(例: 「墨黒のウールギャバジン・オーバーサイズテーラードジャケット」)で
  // 本人回答ラベルが含まれる可能性は低いが、念のため括弧除去を適用。
  let firstPiece: FirstPiece | undefined;
  if (result.firstPiece && result.firstPiece.name) {
    const cleanedName = stripParenthetical(result.firstPiece.name);
    firstPiece = {
      name:        cleanedName || result.firstPiece.name, // 空になったら原文フォールバック
      why:         "",
      zozoKeyword: result.firstPiece.zozoKeyword ?? cleanedName,
    };
  }

  // culturalAffinities: 4 カテゴリすべて公開対象。各要素から括弧除去。
  let culturalAffinities: CulturalAffinities | undefined;
  if (result.culturalAffinities) {
    culturalAffinities = {
      music:     stripParentheticalArray(result.culturalAffinities.music) ?? [],
      films:     stripParentheticalArray(result.culturalAffinities.films) ?? [],
      fragrance: stripParentheticalArray(result.culturalAffinities.fragrance) ?? [],
      art:       stripParentheticalArray(result.culturalAffinities.art),
    };
  }

  // relatedInfluencers: subject_name は残す。reason は空文字(本人回答引用の温床)。
  // DiagnosisDisplay 側で `{reason && <p>}` ガードして空時非表示にする。
  let relatedInfluencers: RelatedInfluencer[] | undefined;
  if (result.relatedInfluencers && result.relatedInfluencers.length > 0) {
    relatedInfluencers = result.relatedInfluencers
      .filter((r) => r && typeof r.subject_name === "string" && r.subject_name.trim() !== "")
      .map((r) => ({
        subject_name: stripParenthetical(r.subject_name),
        reason:       "",
      }));
  }

  // styleAxis: beliefKeywords だけ残し、他フィールドは中立値
  const styleAxis: StyleAxis = {
    ...EMPTY_STYLE_AXIS,
    beliefKeywords: result.styleAxis?.beliefKeywords ?? [],
  };

  // 必須型項目を空値で埋めつつ、公開対象 optional を引き継ぐ
  const masked: StyleDiagnosisResult = {
    // 必須(public で非表示)— 空値で埋める
    plainSummary:   "",
    whyThisResult:  "",
    styleStructure: { color: "", line: "", material: "", density: "", silhouette: "", gaze: "" },
    inputMapping:   [],
    avoid:          [],
    actionPlan:     [],
    nextBuyingRule: [],
    // 必須(public で表示)
    coreIdentity:   result.coreIdentity ?? "",
    styleAxis,
    // optional(public で表示)— recommend 系も括弧除去
    worldviewName:          result.worldviewName,
    patternId:              result.patternId,
    worldview_keywords:     result.worldview_keywords,
    idealSelf:              result.idealSelf,
    attractedCulture:       result.attractedCulture,
    recommendedColors:      stripParentheticalArray(result.recommendedColors),
    recommendedMaterials:   stripParentheticalArray(result.recommendedMaterials),
    recommendedSilhouettes: stripParentheticalArray(result.recommendedSilhouettes),
    recommendedAccessories: stripParentheticalArray(result.recommendedAccessories),
    recommendedBrands:      stripParentheticalArray(result.recommendedBrands),
    firstPiece,
    culturalAffinities,
    relatedInfluencers,
    // 以下は意図的に未設定(StyleDiagnosisResult の optional のため undefined のまま):
    //   plainType / typeExplanation / unconsciousTendency / avoidedImpression /
    //   avoidElements / buyingPriority / dailyAdvice / preference / avoidItems /
    //   worldview_tags
  };

  return masked;
}
