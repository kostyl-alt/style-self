// D1 Sprint C-3: MB → coordinate 連鎖 prompt 構築(クライアント側 helper)
//
// 設計: docs/STYLE-SELF_D1_Sprint_C-3_MB_coordinate_連鎖_設計調査.md(7e9921d)§4
// 既存資産: lib/utils/moodboard-essentials.ts(段階3-B v2 1e79de8)を完全流用
//
// 【責務】
//   MoodboardWithItems を受け取り、段階 B coordinate に渡す日本語 prompt を構築。
//   クライアント側構築(★ サーバー stylist-chat API は不変)。
//   ChatPage / 撮影前 CTA の両経路から呼出可能。
//
// 【三重防御 1: 構造遮断】
//   - mb.worldview_tags / mb.worldview_keywords を ★ 含めない(英語スラッグ非露出)
//   - mb.worldview_name(日本語名)のみ使用
//   - 出口フィルタ(stylist-chat の stripCanonicalSlugs)は既存のまま動作
//
// 【LLM 補完指示】
//   不明な要素はコンセプトから推定して補完するよう明示。
//   これによりユーザーが必須要素 8 全て埋めずとも自然なコーデ提案が得られる。

import type { MoodboardWithItems } from "@/types/moodboard";
import type { BodyProfile } from "@/types/index";
import {
  ESSENTIAL_CATEGORIES,
  ESSENTIAL_LABELS,
  detectEssentials,
  extractCategory,
  stripCategoryPrefix,
} from "@/lib/utils/moodboard-essentials";
import { describeBodyShape, recommendSilhouette } from "@/lib/utils/body-rules";

// ★ ★ ★ 案 F(統合 Sprint hotfix v2): MB prompt 検出用の固定 signature。
// 設計: 体型データ密度により段階 A(Haiku)が JSON 出力を override する根本問題を
//   構造的に回避するため、★ MB prompt 経由は段階 A を ★ skip し intent="coordinate" を
//   client side で直接確定する。本 signature は buildMoodboardPrompt の ★ 1 行目と
//   ★ 完全一致させる(誤検出ゼロ:固定の長い日本語定型文・他経路から偶然一致しない)。
// ★ ChatPage handleSubmit が text.startsWith(MB_PROMPT_SIGNATURE) で分岐。
export const MB_PROMPT_SIGNATURE =
  "以下の世界観・参考画像から、アウター・トップス・ボトムス・シューズ・小物の具体的な組み合わせを文章で提案してください。";

// ★ 統合 Sprint: 世界観フィッティング(体型 × 世界観 × MB)。
// 設計: docs/STYLE-SELF_D1_リアル試着_MVP_スコープ_R-1〜R-3_設計調査.md §5
// ★ クライアント側方式(stylist-chat route 0 変更・C-3 と同じ方式)。
// ★ bodyProfile は optional → 体型未登録ユーザーは ★ 既存 MB coordinate と完全に同じ出力。
export function buildMoodboardPrompt(
  mb: MoodboardWithItems,
  bodyProfile?: BodyProfile,
): string {
  const covered = detectEssentials(mb.description, mb.items);
  const lines: string[] = [];

  // ---- ヘッダ ----
  // ★ Sprint C-3 hotfix v2(0cf6759 後の追加修正): 段階 A LLM 判定誘導の精緻化
  //   - 旧 案 C(f1867e6): 「コーデ提案依頼: ...」→ moodboard placeholder 回避は OK だが
  //                       「コンセプト」「テーマ」キーワードで virtual-coordinate(試着)判定された
  //   - 新 案 D: アウター/トップス/ボトムス等の具体的アイテム名を冒頭で明示
  //              + 「試着シミュレーションや概念翻訳ではなく日常コーデ提案」明示
  //              → 段階 A 判定ルール 4(アイテム指定 + 日常コーデ = coordinate)を強く誘導
  //   サーバー側(overlay-intent.ts / NoneNotice / 5 intent reply 経路)★ 完全不変。
  lines.push(MB_PROMPT_SIGNATURE);
  lines.push("(試着シミュレーションや概念翻訳ではなく、日常的なコーディネート提案です。)");
  lines.push("");
  lines.push("[ムードボードの世界観]");
  lines.push(`テーマ: ${mb.name}`);
  if (mb.description.trim() !== "") {
    lines.push(`コンセプト: ${mb.description}`);
  }
  if (mb.worldview_name !== null && mb.worldview_name !== "") {
    // ★ 三重防御 1: worldview_name(日本語名)のみ使用・worldview_tags は含めない
    lines.push(`世界観: ${mb.worldview_name}`);
  }
  lines.push("");

  // ---- 必須要素 8 hit/miss ----
  lines.push(`[必須要素カバー: ${covered.size}/8]`);
  for (const cat of ESSENTIAL_CATEGORIES) {
    const label = ESSENTIAL_LABELS[cat];
    // 該当 category の items.caption から既存値抽出(プレフィックス除去後)
    const examples = mb.items
      .map((it) => (extractCategory(it.caption) === cat ? stripCategoryPrefix(it.caption) : null))
      .filter((s): s is string => s !== null && s.trim() !== "");
    if (examples.length > 0) {
      lines.push(`- ${label}: ${examples.join(" / ")}`);
    } else if (covered.has(cat)) {
      // description で hit(キーワード fallback)・items の明示メモなし
      lines.push(`- ${label}: コンセプト記述から推定`);
    } else {
      lines.push(`- ${label}: 不明(コンセプトから補完してください)`);
    }
  }

  // ---- 参考画像メモ ----
  const captionedItems = mb.items.filter((it) => it.caption.trim() !== "");
  if (captionedItems.length > 0) {
    lines.push("");
    lines.push("[参考画像メモ]");
    captionedItems.forEach((it, i) => {
      lines.push(`${i + 1}. ${it.caption}`);
    });
    // ★ B-1 改善 3: 参考画像ごとの反映を明記(各画像 → どのコーデ要素に変換したか短く)
    lines.push("");
    lines.push("[参考画像の反映]");
    lines.push("・各参考画像が ★ どのコーデ要素に変換されたかを 1 行ずつ短く記述");
    lines.push("・形式例:「画像 N(キャプション)→ 抽出された雰囲気 + 反映先アイテム」");
  }

  // ---- ★ 統合 Sprint: 体型軸(★ bodyProfile があれば追加・なければ ★ 既存 MB 出力と完全互換)----
  // ★ E-0b 中核思想:「ロングコートが世界観に合っても体型的に合わないなら代替案・体型を否定せず・
  //                   その体型で世界観成立する構造」を反映。
  if (bodyProfile) {
    const shape       = describeBodyShape(bodyProfile);
    const silhouette  = recommendSilhouette(bodyProfile, shape);
    lines.push("");
    lines.push("[あなたの体型(世界観フィッティング軸)]");
    lines.push(shape.natural);
    if (shape.features.length > 0) {
      lines.push(`特徴タグ: ${shape.features.join(" / ")}`);
    }
    if (silhouette.recommendedLengths.length > 0) {
      lines.push(`似合う丈・シルエット: ${silhouette.recommendedLengths.join(" / ")}`);
    }
    if (silhouette.recommendedShoes.length > 0) {
      lines.push(`似合う靴: ${silhouette.recommendedShoes.join(" / ")}`);
    }
    if (silhouette.recommendedAccessories.length > 0) {
      lines.push(`似合う小物: ${silhouette.recommendedAccessories.join(" / ")}`);
    }
    if (silhouette.alternativeChoices.length > 0) {
      lines.push(`別の選択肢として: ${silhouette.alternativeChoices.join(" / ")}`);
    }
    if (silhouette.reasoning) {
      lines.push(`理由: ${silhouette.reasoning}`);
    }
  }

  // ---- ★ Sprint C-3 案 4 Step 2(c3f3ea4): MB 由来コーデ提案の応答形式希望(11 項目 + アクセサリー)----
  // 通常 coordinate(「コーデ提案して」等)は ★ 不変・MB 由来のみクライアント側で詳細指示
  lines.push("");
  lines.push("【応答形式の希望】");
  lines.push("提案アイテムには以下を含めてください:");
  lines.push("アウター・トップス・ボトムス・シューズ・アクセサリー(時計・カラコン・ピアス・ネックレス等)・ヘア・メイク");
  lines.push("");
  lines.push("以下の 11 項目の観点で説明してください:");
  lines.push("比率・素材・色・カット・シルエット・ライン・重量・構造・調和・機能・テーマ");

  // ---- ★ B-1 改善 2: 必須具体化(抽象語のみ禁止・実際に服を探せる粒度)----
  lines.push("");
  lines.push("[各アイテムの必須具体化(★ 抽象語のみは禁止)]");
  lines.push("・アウター / トップス / ボトムス: 丈 / 素材 / 光沢 / 厚み / カット / シルエット / 縫製ディテール");
  lines.push("・シューズ: 形(ローファー / スニーカー / ブーツ 等)/ ヒール高さ / 色 / 素材");
  lines.push("・アクセサリー: 種類(リング / ネックレス / ピアス / 時計 / バッグ 等)/ 位置 / サイズ感");
  lines.push("・ヘア: 長さ / 質感(ウェット / マット 等)/ 分け方");
  lines.push("・メイク: 質感(マット / グロウ 等)/ 色味 / 強調ポイント");
  lines.push("・「黒のロングコート」だけ等の抽象語のみは ★ 不可");
  lines.push("・ユーザーが実際に服を探せる粒度で記述");

  // ---- ★ B-1 改善 1: 応答制約(★ 厳守・常に適用)----
  // 「腕が短い」「短い脚」等の否定的言及を防止。R-2/R-3 self 表示(否定形ゼロ)と一貫。
  lines.push("");
  lines.push("[応答制約(★ 厳守)]");
  lines.push("・出力に含めない語彙:「短い」「狭い」「重い」「悩み」「弱点」「欠点」「逆算」「補正」");
  lines.push("・代わりに使う表現:「縦比率を強調」「重心を高く見せる」「均衡を取る」「世界観が成立する構造」等");
  lines.push("・体型の特徴は ★ 「成立条件」として記述(★ 「問題」として記述しない)");

  // ---- ★ 統合 Sprint: 提案理由の 3 分類(bodyProfile がある時のみ・E-0b 中核思想)----
  // ★ ★ ★ 統合 hotfix v1(7216e24): 命令形(「示してください」「提案してください」)が段階 A intent
  //   userMessage に混入すると Haiku 4.5 が system prompt より優先解釈 → JSON parse 失敗。
  //   → 命令動詞を排除し中立的なデータ提示形へ。
  // ★ ★ ★ 統合 hotfix v2(6ef5744 案 F): MB prompt 経由は段階 A skip(intent=coordinate 直接)
  //   なので命令形混入による Haiku override は構造的に起こらないが、中立形は維持(自然な記述)。
  if (bodyProfile) {
    lines.push("");
    lines.push("[応答に望ましい要素]");
    lines.push("・MB 由来 / 体型補正由来 / 世界観由来 の 3 分類で理由が示されると望ましい");
    lines.push("  - MB 由来: 世界観・空気感から導かれる要素");
    lines.push("  - 体型補正由来: あなたの体型で世界観が成立する構造");
    lines.push("  - 世界観由来: 診断結果や核となる世界観に対応する要素");
  }

  // ---- LLM 補完指示 ----
  lines.push("");
  lines.push("不明な要素は上記の世界観から推定して補完してください。");

  return lines.join("\n");
}
