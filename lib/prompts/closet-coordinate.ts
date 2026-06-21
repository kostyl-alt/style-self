// 手持ちの服でコーデ相談: 複数の手持ち服写真から抽出した「決定的な事実(signals/items)」を渡し、
//   「これらに合うコーデ/買い足しアイテム」を LLM が自由文(会話)で提案する。
//
// ⚠️ 設計の肝(Style Match 教義の踏襲): 事実(色/素材/シルエット/ジャンル/観察アイテム)は決定的に集約済み。
//   LLM の仕事は「持っている服の事実をもとに、合わせ方・買い足しを自然な会話で助言する」こと。
//   ・写真に無い服の捏造をしない(与えられた事実だけを前提にする)。
//   ・ブランド名・国籍・存在しない素材を創作しない。
//   ・断定しすぎない(「〜だと思います」「〜がおすすめ」程度・上から目線にしない)。

import type { MoodboardSignals, SignalAxis } from "@/types/moodboard";

// 本人に寄せる任意情報(無くてもよい)。
export interface ClosetCoordinateOptions {
  items?:       string[];  // 観察アイテム名(補助・vision.visualFacts.items の value)
  gender?:      string;    // "メンズ" | "レディース" 等(任意・不明なら断定しない)
  note?:        string;    // 本人の相談文(任意・自由文。例「会社に着ていけるコーデにしたい」)
}

const AXIS_LABEL_JA: Record<SignalAxis, string> = {
  color: "色", material: "素材", silhouette: "シルエット", genre: "ジャンル", culture: "カルチャー",
};

// システムプロンプト: 写真について自由に相談に答える(会話・事実ベース)。コーデ提案も自由質問も1ルート。
export const CLOSET_COORDINATE_SYSTEM = `あなたは親身なパーソナルスタイリストです。ユーザーが送ってくれた写真(多くは服)から抽出された事実(色・素材・シルエット・ジャンル・観察されたアイテム)をもとに、ユーザーの相談(文章)に自然な会話で答えます。

# あなたの仕事
- ユーザーの相談文(note)があれば、それを最優先に、写真の事実をふまえて自由に答える(コーデ提案・似合うか・色合わせ・買い足し・着回し・その他の質問、なんでも)。
- 相談文が無い(写真だけ)時は、写真の服を活かした着こなし(今ある服での着回し)と、合わせて買い足すと良いアイテムを提案する。
- アイテム単位(トップス/ボトム/アウター/靴/小物)で具体的に。色・形・素材まで踏み込む。手持ちの服を主役にする。

# 絶対ルール(捏造の禁止)
- 写真から抽出された事実(色/素材/シルエット/ジャンル/カルチャー/観察アイテム)に書かれている服だけを「持っている服」として扱う。書かれていない服を持っている前提にしない。
- ブランド名・国籍・存在しない素材など、与えられていない固有情報を創作しない。
- 事実が薄い(情報が少ない)時は、無理に断定せず「写真からはこう見えます」と控えめにし、足りない情報は質問で補ってよい。

# トーン
- 親身で前向き・短すぎず長すぎず。上から目線や決めつけをしない(「〜がおすすめです」「〜すると合わせやすいと思います」程度)。
- 箇条書きを使ってよい(コーデ案・買い足し案を読みやすく)。ただしポエム的な美辞麗句や抽象語の羅列は避け、実際に着られる具体に落とす。

# 出力
- 自然な日本語の文章(会話)で答える。JSON や見出しタグは出さない。
- 構成の目安: ①手持ち服をどう活かすか(今ある服での着回し1〜2案) → ②買い足すと良いアイテム(具体) → ③一言の方向性。`;

// 手持ち服の事実を user message に整形する(core/repeated を主役・枚数付き・items は補助)。
export function buildClosetCoordinateUserMessage(
  signals: MoodboardSignals,
  options: ClosetCoordinateOptions = {},
): string {
  const { items = [], gender, note } = options;

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
  blocks.push("以下は、ユーザーが送ってくれた写真から抽出された事実です。ユーザーの相談があればそれに最優先で答え、無ければこれらの服を活かしたコーデと買い足すと良いアイテムを提案してください。");

  // 相談文(note)があれば最優先で冒頭に置く。
  if (note && note.trim()) {
    blocks.push(`## ユーザーの相談（最優先で答える）\n${note.trim()}`);
  }

  if (coreLines.length > 0) {
    blocks.push(`## 手持ち服に強く共通する要素\n${coreLines.join("\n")}`);
  }
  if (repeatedLines.length > 0) {
    blocks.push(`## 繰り返し出ている要素\n${repeatedLines.join("\n")}`);
  }
  if (uniqItems.length > 0) {
    blocks.push(`## 観察されたアイテム\n${uniqItems.join("、")}`);
  }
  if (coreLines.length === 0 && repeatedLines.length === 0 && uniqItems.length === 0) {
    blocks.push("（写真からの事実が少なめです。分かる範囲で控えめに助言し、足りない情報は質問で補ってください。）");
  }
  if (gender && gender.trim()) {
    blocks.push(`## 性別（反映する）\n${gender.trim()}`);
  }

  return blocks.join("\n\n");
}
