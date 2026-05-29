// C-2c-1: エディタ AI(★ ★ E-0c 評価 AI の MVP 実装)。
//
// 設計: docs/STYLE-SELF_D1_Sprint_C-2b_エディタAI_設計調査.md(26d94c2)・案 α 採用
//   E-0c 戦略文書(dfdec56)の 10 評価軸 + 6 チェック + 6 再生成条件 を実装。
//
// 役割: コーデ提案テキスト(stylist-chat reply)を ★ Sonnet 4.6 で評価し、
//       10 軸スコア + 6 チェック + verdict(pass / compromise / fail)+ 改善指示を JSON で返す。
//
// 不合格(fail)時は ★ stylist-chat 側で N=1 max 再生成(本ファイル外・route 側で実施)。
//
// セキュリティ:
//   ・ANTHROPIC_API_KEY は callClaudeJSON 経由のサーバー側 process.env のみ
//   ・ログに評価本文は出さない(verdict と total のみ・PII リスクなし)
//
// コスト: 1 件 ≈ ¥7-8(Sonnet 4.6・入力 1000 + 出力 500 tokens 想定)

import { callClaudeJSON, MODEL } from "@/lib/claude";

const SYSTEM_PROMPT = `あなたは服好き / インフルエンサー視点のスタイリング編集者 AI です。
E-0c 戦略文書に基づき、与えられたコーデ提案を厳しく評価してください。

[評価軸 10 項目(各 0-10 整数スコア)]
1. novelty: 新規性(Pinterest 上位 100 件にあるか 0 / この組み合わせを見たことがない 10)
2. rarity: 既視感の少なさ(#ootd 海に埋もれる 0 / スクロール止まる 10)
3. mb_translation: ムードボード翻訳精度(表面語のみ 0 / 奥のムード + テクスチャ + 文化参照を翻訳 10)
4. daily_use: 日常化のうまさ(コスプレ 0 / 日常的に着られる + 反骨 10)
5. photogenic: 写真映え(平面的 0 / 光・影・質感対比が映える 10)
6. post_worthy: 投稿したくなるか(メモして終わり 0 / 今すぐ試したい 10)
7. searchable: 商品検索できる具体性(「黒い服」止まり 0 / ブランド・素材・丈・形 10)
8. personal: その人らしさ(誰が着ても同じ 0 / この体型・世界観でしか映えない 10)
9. whitespace: 余白(全部主張 0 / 主役と余白の対比が機能 10)
10. signature_anomaly: ★ 1 点の強い違和感(均等 0 / 必ず 1 点・顔周り or 手元 or 足元 10)

[6 チェック(★ 各 "ok" / "ng")]
- shallow: 服好き / インフルエンサーにとって ★ 浅くないか(浅い=ng / 深い=ok)
- pinterest_degrade: Pinterest の劣化版になっていないか(劣化=ng / 独自=ok)
- mb_translated: MB の本質を日常服に翻訳できているか(NO=ng / YES=ok)
- memorable: 記憶に残る要素があるか(NO=ng / YES=ok)
- post_worthy_check: 写真にした時に投稿したくなるか(NO=ng / YES=ok)
- searchable_specificity: 商品として探せる粒度か(NO=ng / YES=ok)

[判定]
- "pass": ★ total ≥ 70 + signature_anomaly ≥ 6 + 6 チェック全て ok
- "compromise": ★ total ≥ 55 + signature_anomaly ≥ 3 + 6 チェック 1 ng まで
- "fail": それ以外

[★ 凡庸ポイント・即 fail 例]
・黒ロングコート + 白ニット + 黒パンツ + ローファー(Pinterest 劣化版の代名詞)
・モード / ミニマル / アンドロジナス 等の一般語のみで説明
・MB の不穏さ・90 年代の危うさを「上品に丸めた」案

[改善指示 improvementHints(fail / compromise 時)]
コーデを ★ どう書き直すべきか ★ 具体的に 100-200 字で書く。必ず以下を含める:
・不足している核アイテム例(★ ID タグ風ネックレス / グラフィックロン T / 黒エナメル / フェードチャコール 等)
・反映されていない MB 本質要素(★ 不穏さ / 90 年代の危うさ / 距離感 等)
・★ 凡庸 4 点セット(黒コート + 白ニット + 黒パンツ + ローファー)から離れる方向

[★ ★ 出力 JSON のみ・前置き / マークダウン / コードブロック禁止]
{
  "scores": {
    "novelty": <0-10>, "rarity": <0-10>, "mb_translation": <0-10>, "daily_use": <0-10>,
    "photogenic": <0-10>, "post_worthy": <0-10>, "searchable": <0-10>, "personal": <0-10>,
    "whitespace": <0-10>, "signature_anomaly": <0-10>
  },
  "total": <0-100>,
  "checks": {
    "shallow": "ok" | "ng", "pinterest_degrade": "ok" | "ng",
    "mb_translated": "ok" | "ng", "memorable": "ok" | "ng",
    "post_worthy_check": "ok" | "ng", "searchable_specificity": "ok" | "ng"
  },
  "verdict": "pass" | "compromise" | "fail",
  "reasonShort": "<60 字以内の判定理由>",
  "improvementHints": "<fail / compromise 時の改善指示 100-200 字・pass 時は空文字でも可>"
}`;

export interface EditorScores {
  novelty:           number;
  rarity:            number;
  mb_translation:    number;
  daily_use:         number;
  photogenic:        number;
  post_worthy:       number;
  searchable:        number;
  personal:          number;
  whitespace:        number;
  signature_anomaly: number;
}

export interface EditorChecks {
  shallow:                 "ok" | "ng";
  pinterest_degrade:       "ok" | "ng";
  mb_translated:           "ok" | "ng";
  memorable:               "ok" | "ng";
  post_worthy_check:       "ok" | "ng";
  searchable_specificity:  "ok" | "ng";
}

export type EditorVerdict = "pass" | "compromise" | "fail";

export interface EditorResult {
  scores:           EditorScores;
  total:            number;
  checks:           EditorChecks;
  verdict:          EditorVerdict;
  reasonShort:      string;
  improvementHints: string;
}

interface RawEditorOutput {
  scores?:           Partial<Record<keyof EditorScores, unknown>>;
  total?:            unknown;
  checks?:           Partial<Record<keyof EditorChecks, unknown>>;
  verdict?:          unknown;
  reasonShort?:      unknown;
  improvementHints?: unknown;
}

export interface EvaluateCoordinateOpts {
  // AI のコーデ提案(評価対象)
  coordinateText:  string;
  // ユーザーの元依頼文(MB 世界観 / 体型を含む・editor が翻訳精度を見る材料)
  originalRequest: string;
}

function clampScore(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(10, Math.round(n)));
}

function normalizeCheck(v: unknown): "ok" | "ng" {
  return v === "ok" ? "ok" : "ng";
}

function normalizeEditorResult(raw: RawEditorOutput): EditorResult {
  const scores: EditorScores = {
    novelty:           clampScore(raw.scores?.novelty),
    rarity:            clampScore(raw.scores?.rarity),
    mb_translation:    clampScore(raw.scores?.mb_translation),
    daily_use:         clampScore(raw.scores?.daily_use),
    photogenic:        clampScore(raw.scores?.photogenic),
    post_worthy:       clampScore(raw.scores?.post_worthy),
    searchable:        clampScore(raw.scores?.searchable),
    personal:          clampScore(raw.scores?.personal),
    whitespace:        clampScore(raw.scores?.whitespace),
    signature_anomaly: clampScore(raw.scores?.signature_anomaly),
  };
  const totalProvided = typeof raw.total === "number" ? raw.total : Number(raw.total);
  const totalComputed = Object.values(scores).reduce((s, v) => s + v, 0);
  const total = Number.isFinite(totalProvided) && totalProvided >= 0 && totalProvided <= 100
    ? Math.round(totalProvided)
    : totalComputed;
  const checks: EditorChecks = {
    shallow:                normalizeCheck(raw.checks?.shallow),
    pinterest_degrade:      normalizeCheck(raw.checks?.pinterest_degrade),
    mb_translated:          normalizeCheck(raw.checks?.mb_translated),
    memorable:              normalizeCheck(raw.checks?.memorable),
    post_worthy_check:      normalizeCheck(raw.checks?.post_worthy_check),
    searchable_specificity: normalizeCheck(raw.checks?.searchable_specificity),
  };
  const ngCount = Object.values(checks).filter((c) => c === "ng").length;
  // verdict 取得(LLM 判定優先・サーバー側でも基準と矛盾しないよう再計算)
  const rawVerdict: EditorVerdict =
    raw.verdict === "pass" || raw.verdict === "compromise" || raw.verdict === "fail"
      ? raw.verdict
      : "fail";
  // ★ E-0c 基準で再計算(LLM が緩い場合の保険)
  let computedVerdict: EditorVerdict;
  if (total >= 70 && scores.signature_anomaly >= 6 && ngCount === 0) {
    computedVerdict = "pass";
  } else if (total >= 55 && scores.signature_anomaly >= 3 && ngCount <= 1) {
    computedVerdict = "compromise";
  } else {
    computedVerdict = "fail";
  }
  // LLM が「pass」と言っても基準を満たさなければ降格(逆もまた・厳しい方を採用)
  const ORDER: EditorVerdict[] = ["fail", "compromise", "pass"];
  const verdict = ORDER[Math.min(ORDER.indexOf(rawVerdict), ORDER.indexOf(computedVerdict))];

  const reasonShort = typeof raw.reasonShort === "string" && raw.reasonShort.trim() !== ""
    ? raw.reasonShort.trim().slice(0, 80)
    : "";
  const improvementHints = typeof raw.improvementHints === "string"
    ? raw.improvementHints.trim().slice(0, 300)
    : "";

  return { scores, total, checks, verdict, reasonShort, improvementHints };
}

function buildUserMessage(opts: EvaluateCoordinateOpts): string {
  const lines: string[] = [];
  lines.push("[評価対象コーデ提案]");
  const coord = opts.coordinateText.length > 4000
    ? `${opts.coordinateText.slice(0, 4000)}\n(以下省略)`
    : opts.coordinateText;
  lines.push(coord);
  lines.push("");
  lines.push("[元の依頼文(MB 世界観 / 体型 / 文脈 を含む・翻訳精度の評価材料)]");
  const orig = opts.originalRequest.length > 3000
    ? `${opts.originalRequest.slice(0, 3000)}\n(以下省略)`
    : opts.originalRequest;
  lines.push(orig);
  return lines.join("\n");
}

export async function evaluateCoordinate(opts: EvaluateCoordinateOpts): Promise<EditorResult> {
  const userMessage = buildUserMessage(opts);
  const raw = await callClaudeJSON<RawEditorOutput>({
    systemPrompt: SYSTEM_PROMPT,
    userMessage,
    model:        MODEL, // Sonnet 4.6(★ 案 α 採用)
    maxTokens:    1024,
  });
  return normalizeEditorResult(raw);
}

// 再生成時に stylist-chat の userMessage 末尾に注入する改善指示ブロックを組み立てる。
// ★ E-0c §1.3 #2「核アイテム必須」+ §1.3 #5「再生成 6 条件」を ★ 改善方向として明示。
export function buildRegenInstruction(prev: EditorResult): string {
  const lines: string[] = [];
  lines.push("");
  lines.push("【★ 編集者からの改善指示・前回の提案は不合格でした】");
  lines.push(`判定: ${prev.verdict}(合計 ${prev.total}/100・1 点の違和感 ${prev.scores.signature_anomaly}/10)`);
  if (prev.reasonShort) {
    lines.push(`理由: ${prev.reasonShort}`);
  }
  if (prev.improvementHints) {
    lines.push(`★ 改善方向: ${prev.improvementHints}`);
  }
  lines.push("");
  lines.push("★ 凡庸 4 点セット(黒ロングコート + 白ニット + 黒パンツ + ローファー)から離れること。");
  lines.push("★ 各コーデに必ず ★ 核アイテム を 1 つ以上含めること(ID タグ風 / グラフィック / エナメル / フェード等)。");
  lines.push("★ MB の不穏さ / 90 年代の危うさ / 距離感 等の本質要素を ★ 上品に丸めず反映すること。");
  return lines.join("\n");
}
