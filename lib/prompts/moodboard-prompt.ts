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
import {
  ESSENTIAL_CATEGORIES,
  ESSENTIAL_LABELS,
  detectEssentials,
  extractCategory,
  stripCategoryPrefix,
} from "@/lib/utils/moodboard-essentials";

export function buildMoodboardPrompt(mb: MoodboardWithItems): string {
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
  lines.push("以下の世界観・参考画像から、アウター・トップス・ボトムス・シューズ・小物の具体的な組み合わせを文章で提案してください。");
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
  }

  // ---- LLM 補完指示 ----
  // ★ Sprint C-3 hotfix v2(本 commit): 旧版「このムードボードに合うコーディネートを提案して
  //   ください」(冒頭と重複)と「コンセプトから推定」(virtual-coordinate 判定誘発キーワード)を
  //   廃止し、不明要素補完指示のみ残す(コンセプト → 世界観 に言い換え)。
  lines.push("");
  lines.push("不明な要素は上記の世界観から推定して補完してください。");

  return lines.join("\n");
}
