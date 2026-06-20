// Style Match Result 第2段: 「買える言葉」=アプリ別の自然な検索ワードを LLM で生成する。
//
// ⚠️ 設計の肝（A2 失敗の教訓）: 事実(signals/items)は決定的に集約済み。LLM の仕事は「検索語化」だけ。
//   タグ直結（「Y2K/00sストリート モノトーン」のような抽象語の羅列）は誰も検索窓に打たない＝ゴミ。
//   ユーザーが実際に ZOZO/メルカリ/Pinterest の検索窓に打つ自然な短いフレーズに変換させる。
//   無い情報（ブランド名・国籍・存在しない素材）は創作させない（捏造防止）。
//
// ⚠️ 共通構造の再現（修正）: 検索ワードは「複数写真で繰り返し惹かれている共通の芯（core/repeated）」を
//   再現する語を最優先。1枚だけに出た小物・バッグ・色（accent / 単発 item）に寄らない。
//   items（観察アイテム）は補助。core/repeated と結びつく時だけ具体アイテム名として使う。

import type { MoodboardSignals, SignalAxis } from "@/types/moodboard";

// LLM 出力（アプリ別検索ワード）。
export interface StyleMatchKeywords {
  zozo_rakuten:   string[];  // 日本語・新品EC（ZOZO/楽天）用
  mercari_furugi: string[];  // 日本語・フリマ/古着（メルカリ）用
  pinterest_en:   string[];  // 英語・着こなし発見（Pinterest）用
}

// 本人に寄せる任意情報（無くてもエラーにしない・無ければ従来どおり）。
export interface StyleMatchOptions {
  items?:       string[];  // 観察アイテム名（補助・1枚だけのものは弱め扱い）
  gender?:      string;    // "メンズ" | "レディース" 等（任意・不明なら断定しない）
  targetStyle?: string;    // 本人が寄せたい方向（任意・自由文）
}

const AXIS_LABEL_JA: Record<SignalAxis, string> = {
  color: "色", material: "素材", silhouette: "シルエット", genre: "ジャンル", culture: "カルチャー",
};

// ★ 検索ワード生成のシステムプロンプト（質が全て・タグ直結を構造とプロンプトの両面で禁止）。
export const STYLE_MATCH_KEYWORDS_SYSTEM = `あなたは日本のファッションEC（ZOZO・楽天）、フリマ/古着（メルカリ）、画像SNS（Pinterest）の検索に精通したアシスタントです。
複数の理想写真から抽出された「繰り返し惹かれている共通の要素（=事実）」を、ユーザーが実際に各アプリの検索窓に打ち込む“自然な検索ワード”に変換するのが、あなたの唯一の仕事です。

# 何を再現するか（最重要・共通構造の優先）
- 検索ワードは「複数の写真で繰り返し惹かれている共通の芯」を再現する語を最優先にする。入力の「共通の芯」が主役。
- 各要素には「○枚」と出た枚数が付く。枚数が多い＝芯が強い。枚数の多い要素を優先して検索ワードに反映する。
- 「観察されたアイテム（補助）」は補助情報。1枚だけに出た小物・バッグ・色・単発のアイテムに寄ってはいけない。
  共通の芯（色・シルエット・ジャンル等）と結びつく時だけ、具体的なアイテム名として使う。
- バッグ・帽子・小物は、複数写真で共通している、または見た目の核として明らかに重要な時だけ出す。1枚だけの小物は出さない。

# 絶対ルール（タグ直結の禁止）
- 抽象語・スタイル名の羅列を検索ワードにしてはいけない。それは誰も検索窓に打たない＝ゴミ。
  - 悪い例（禁止）: 「Y2K/00sストリート モノトーン」「ミニマル 上品」「ブラックストリート 90s」「韓国 カルチャー」
- 良い検索ワード = 「色 ＋ 形/シルエット ＋ アイテム名（＋ 素材 / 年代 / 性別）」の具体的な組合せ。実際に人が打つ短いフレーズにする。
- 与えられた事実（色 / 素材 / シルエット / ジャンル / カルチャー / 観察アイテム）に書かれている語だけを使う。
  ブランド名・国籍・存在しない素材など、与えられていない情報を創作しない。
- 1要素を全身でまとめず、アイテム単位（パンツ・トップス・アウター・靴・小物）で具体的に分けてよい。

# 良い方向 / 悪い方向（共通構造の再現か、1枚に寄っているか）
- 良い（共通構造の再現）: 「黒 ワイドパンツ」「黒 フレアデニム」「黒 オーバーサイズ カーディガン」「黒 クロップドトップス」「黒 バケットハット」「黒 レイヤード コーデ」
- 悪い（1枚だけの色・アイテムに寄りすぎ）: 「黒 レザー トートバッグ」「黒 レザー ボストンバッグ」「古着 グラフィック パーカー ブルー」
  ※写真に写っていても、共通の芯に弱ければ検索ワードにしない。

# 構造を説明する語は、必ず実際に検索されるアイテム名に変換する（最後の詰め）
- シルエットや比率の説明語（「上短め」「下太め」「重心低め」「ハイウエスト」的な構造の言い方）を、そのまま検索ワードにしてはいけない。誰も「上短め」では検索しない。
- それを実現する具体的なアイテム名（短丈トップス / クロップド / ワイドパンツ / フレアデニム 等）に必ず置き換える。
  - 悪い: 「上短め 下太め セットアップ メンズ」
  - 良い: 「短丈 トップス ワイドパンツ メンズ」
  - 良い: 「ショート丈 Tシャツ ワイドパンツ メンズ」
  - 良い: 「短丈 パーカー ワイドパンツ メンズ」

# 本人に寄せる（任意）
- 性別（メンズ/レディース）が与えられた時だけ反映する。不明なら性別を断定しすぎない（付けないか、必要最小限）。
- 寄せたい方向が与えられたら、共通の芯を壊さない範囲でその方向に寄せる。

# アプリ別の最適化
- zozo_rakuten（日本語・新品EC）: 一般的な商品名＋色＋（必要なら性別）。新品で探す前提。例「黒 ワイドパンツ メンズ」「白 オーバーサイズ シャツ」。
- mercari_furugi（日本語・フリマ/古着）: 「古着」「ヴィンテージ」「90s」などの中古/レトロ寄りの語を色・アイテムと組合せる。例「古着 ブラックデニム ワイド」「ヴィンテージ レザージャケット 黒」。
- pinterest_en（英語・着こなし発見）: 英語で、なるべく具体的に。outfit / style を添えてよいが抽象語だけにしない。例「black wide leg pants outfit men」「oversized leather jacket street style」。

# 出力
- 各配列は 3〜6個。短く具体的な検索ワードのみ。共通の芯を再現する語から並べる。
- 次の JSON だけを出力する（説明・前置き・他のキーは一切禁止）:
{"zozo_rakuten": ["..."], "mercari_furugi": ["..."], "pinterest_en": ["..."]}`;

// 主軸を user message に整形する。
//   ⚠️ core/repeated（共通の芯）を主役・枚数(count)付きで強調。core を上に・repeated を下に。
//   items（観察アイテム）は「補助・1枚だけのものは弱め」と明示して別枠で渡す（accent=1枚だけは渡さない）。
export function buildStyleMatchKeywordsUserMessage(
  signals: MoodboardSignals,
  options: StyleMatchOptions = {},
): string {
  const { items = [], gender, targetStyle } = options;

  // axis ごとに core / repeated を枚数付きで整形（強い順）。
  function formatStrength(strength: "core" | "repeated"): string[] {
    const lines: string[] = [];
    (["color", "silhouette", "material", "genre", "culture"] as SignalAxis[]).forEach((axis) => {
      const vals = signals.signals
        .filter((s) => s.strength === strength && s.axis === axis)
        .sort((a, b) => b.count - a.count)
        .map((s) => `${s.value}（${s.count}枚）`);
      if (vals.length > 0) lines.push(`${AXIS_LABEL_JA[axis]}: ${vals.join("、")}`);
    });
    return lines;
  }
  const coreLines = formatStrength("core");
  const repeatedLines = formatStrength("repeated");

  const uniqItems = Array.from(new Set(items.map((s) => s.trim()).filter(Boolean))).slice(0, 12);

  const blocks: string[] = [];
  blocks.push("以下は複数の理想写真から抽出された要素です。「最も強い共通の芯」を主役に、各アプリの自然な検索ワードに変換してください。");

  if (coreLines.length > 0) {
    blocks.push(`## 最も強い共通の芯（最優先で再現する）\n${coreLines.join("\n")}`);
  }
  if (repeatedLines.length > 0) {
    blocks.push(`## 繰り返し出ている要素（次に優先）\n${repeatedLines.join("\n")}`);
  }
  if (coreLines.length === 0 && repeatedLines.length === 0) {
    blocks.push("（複数枚に共通する芯は弱め。下の観察アイテムや色から、ありそうな具体検索ワードを最小限で。1枚だけの小物には寄らない。）");
  }
  if (uniqItems.length > 0) {
    blocks.push(`## 観察されたアイテム（補助・1枚だけのものは弱め。共通の芯と結びつく時だけ使う）\n${uniqItems.join("、")}`);
  }
  if (gender && gender.trim()) {
    blocks.push(`## 性別（反映する）\n${gender.trim()}`);
  }
  if (targetStyle && targetStyle.trim()) {
    blocks.push(`## 寄せたい方向（共通の芯を壊さない範囲で反映）\n${targetStyle.trim()}`);
  }

  return blocks.join("\n\n");
}
