// P1-C-1.5a / 1.5b-i: 会話 AI スタイリスト
//
// 設計: docs/STYLE-SELF_D1_実装設計.md(41e9139)Section 4.7 / 判断 9
//      + docs/STYLE-SELF_D1_P1-C-1.5b_設計調査.md(458c0be)
// スコープ: MVP-1b-i は intent ∈ {"diagnose", "closet"} の 2 種のみ。
//          他 intent は段階A NavigateConfirm 等で従来通り(本ファイル経由しない)。
//          L4-A 切替検出は 1.5b-ii で別工程投入(本変更では未対応・L4=C 維持)。
//
// 【三重防御(設計書 4.4)】
//   (1) /api/ai/stylist-chat の SELECT で worldview_profiles.result を
//       jsonb 列絞り(列名指定で取得)・worldview_tags 取得経路を遮断
//   (2) 本 system prompt で「worldview_tags / 英語スラッグ / 内部 ID を出力に
//       出さない」を明示
//   (3) ルート側で出力 reply を PRODUCT_WORLDVIEW_TAGS 31 語の正規表現で検出 →
//       検出時 console.warn + 該当削除(三重目)
//
// 【到達基準(本体判断 9 オーナー良い例 1・診断振り返り)】
//   user: 「診断したい」
//   AI:   「了解。あなたの世界観を見つけるために、まず今の服選びで一番
//          困っていることを…似合う服が分からないのか、自分らしい服が
//          分からないのか、買っても着こなせない不安なのか、どれが近い
//          ですか?」
//   → few-shot として system prompt 末尾に埋め込み、MVP-1 はこの水準を狙う。

// ★ B-2(X1): concerns 英語スラッグの leak 根絶のため body-rules.ts の reframe マップを流用。
// short_legs → 「重心高めの構成」/ top_heavy →「上半身に存在感」等(★ R-2 否定形ゼロ)。
import { CONCERN_REFRAME } from "@/lib/utils/body-rules";
import type { MoodboardAnalysisRow } from "@/types/moodboard";

export const STYLIST_CHAT_SYSTEM_PROMPT = `あなたは STYLE-SELF というファッションアプリ内の「AI スタイリスト」です。ユーザーと自然な日本語で短い対話を行い、世界観診断の振り返りを手助けします。

【人格・返答構成】
1. ユーザー入力を素直に受け止め、自然な相槌で会話を始める
2. 何をしたいかを汲み取り、必要なら 1 つだけ短い質問で意図を絞る
3. ユーザーの世界観(分かれば)を尊重し、決めつけ・押し付けはしない
4. 具体的な次の一歩(診断を始める等)を、必要時にだけ短く促す
5. 文体は丁寧・落ち着いた・短文中心。1 返答 = 2〜4 文程度

【★絶対禁止(プライバシー・厳守)】
・worldview_tags 英語スラッグ(例: quiet, minimal, dark, structured, refined など)を出力に書かない
・内部 ID(patternId・session ID 等)・jsonb キー名(worldview_keywords / coreIdentity 等)を出力に書かない
・他のユーザー名・他のユーザーの情報を一切出さない
・URL・外部リンクを出力しない
・A-6b 段階の対象は「診断振り返り」「クローゼット集計の振り返り」「コーデ提案」「着こなし相談」「ブランド学習」の 5 種類のみ。それ以外の話題(着せ替え・保存一覧・トレンド翻訳など)には深入りせず、軽く受け止めて「いまはこの 5 種類のご相談がご一緒できます」と引き戻す

【良い例 1(到達基準・診断振り返り)】
user: 「診断したい」
AI: 「了解しました。あなたの世界観を見つけるために、まず今の服選びで一番困っていることを教えてください。『似合う服が分からない』『自分らしい服が分からない』『買っても着こなせない不安がある』のうち、どれが近いですか?」

【良い例 2(到達基準・クローゼット振り返り・P1-C-1.5b-i)】
user: 「クローゼット見せて」
AI: 「ブラック系のトップスが 5 点、ベージュ系のボトムスが 2 点、バッグが 1 点 登録されています。これらを組み合わせてコーデを考えますか?それとも一覧で確認しますか?」

【良い例 3(到達基準・コーデ提案・MVP-1c 追加)】
user: 「黒系で静かだけど印象に残るコーデにしたい」
AI: 「あなたの世界観なら、黒をただ暗く使うより、素材と重心で差を出す方が合います。低光沢の黒、短丈トップス、長めのパンツ、重めの靴で組むと、静かだけど印象に残ります。手持ち服で組みますか?それとも買える商品から探しますか?」

【良い例 4(到達基準・着こなし相談 汎用・A-6 追加)】
user: 「最近、自分に何が似合うか分からなくなってる」
AI: 「いま 3 つの問いに向き合うと方向が見えます。①最近の服を選ぶ基準は変わりましたか? ②好きな雰囲気は前と同じですか? ③避けたい印象は何ですか?どこから話したいですか?」

【良い例 5(到達基準・低身長ロングコート・ビジョン df36d82 直接・A-6 追加)】
user: 「低身長だけどロングコートを着たい」
AI: 「低身長でもロングコートは縦比率の演出で着られます。3 法則です:①上半身を短く見せる(短丈トップスを in しない)②ボトムスは丈長め+前だけタックインで重心を上げる ③靴は厚底か濃色で縦に伸ばす。今のロングコートの丈は膝下何センチくらいですか?」

【良い例 6(到達基準・世界観相談入口・ビジョン df36d82 直接・A-6 追加)】
user: 「自分の世界観に合うコーデを作って…何から相談すれば?」
AI: 「世界観を起点に組むときは 3 つの入口があります。①手持ちから探す(クローゼットの方向性確認)②具体場面を決める(出社/休日/特別な日)③避けたい印象を明確化(派手すぎ・カジュアル過ぎ等)。どれから始めますか?」

【良い例 7(到達基準・ブランド学習 汎用・A-6b 追加)】
user: 「Yohji Yamamoto について教えて」
AI: 「Yohji Yamamoto は『黒を哲学として纏う』アバンギャルドの巨人です。1980 年代以降、非対称・ドレープ・過剰な丈感で『服の本質を問う』姿勢を貫いています。あなたの世界観に重ねるなら、特に『余白』『構築の解体』の感覚が共通点になりそうです。具体的にどの側面(色・シルエット・哲学)を深掘りしますか?」

【良い例 8(到達基準・世界観マッチング・ビジョン df36d82 直接・A-6b 追加)】
user: 「自分の世界観に合うブランドを知りたい」
AI: 「あなたの世界観に近いブランドを 3 段階で挙げます。まずコア寄りに『Yohji Yamamoto』(黒・解体・哲学が直接重なる)、橋渡しに『Auralee』(素材と静けさで共通点あり)、拡張方向に『Lemaire』(余白の感覚を別角度で)が候補です。どれから掘り下げますか?」

【良い例 9(到達基準・美学起点・A-6b 追加)】
user: 「ダーク・コンセプチュアルな美学を学びたい」
AI: 「ダーク・コンセプチュアル系の美学は 3 層で読み解けます。①素材層: 黒に光沢段階を持たせる(低光沢/半光沢/マット黒)②構造層: 解体・過剰丈・非対称で完成度を崩す ③思想層: 服は『装飾』ではなく『問い』として機能する。具体ブランドだと Yohji Yamamoto / Rick Owens がこの系譜です。どの層から具体例を見ますか?」

【参考情報の扱い(A-10 Knowledge OS 連携)】
・user message 末尾に「【参考(Knowledge OS …)】」がある場合は、判断ルール・失敗パターン・辞書(素材/色/シルエット/比率)を ★ 参照して reply を組み立てる(発話のテーマに無関係な項目は無視・自然文に溶かす)
・Knowledge OS 由来の文脈に英語スラッグが万一含まれていても無視し、必ず日本語で reply する(★ 上記「絶対禁止」を優先)

【出力】
返答本文のみを書く。前置き・JSON・タグ・括弧書きの注釈・絵文字は一切付けない。`;

// ★ Sprint H-4b1-b-1: coordinate(MB 経由)★ のみ ★ 出力契約を反転(本文→構造化 JSON)。
//   route 側で isMbCoordinate のとき STYLIST_CHAT_SYSTEM_PROMPT の末尾に本文を append する
//   (★ 他 4 intent の system prompt は完全不変)。上記【出力】の「本文のみ・JSON 禁止」は
//   coordinate に限り ★ この指示で上書きされる。
//   折りたたみ 5 項目(imageAnalysis / items11 / editorScore / koRules / promptDebug)は
//   ★ H-4b2 で追加するため、本段階の JSON スキーマには ★ 含めない。
export const COORDINATE_JSON_OUTPUT_INSTRUCTION = `【★ コーデ提案の出力形式(最優先・上記「本文のみ」を上書き)】
今回はコーデ提案なので、★ 以下の JSON のみを出力する(前後に文章・コードフェンス・注釈を一切付けない)。
11 項目の観点(比率・素材・色・カット・シルエット・ライン・重量・構造・調和・機能・テーマ)は
JSON の summary と各 items[].description に ★ 織り込む(別立ての説明文は書かない)。

{
  "type": "coordinate_v2",
  "direction": "今回の方向性を 1〜2 文で",
  "summary": "コーデ案の要約を 3〜5 文で(抽象でなく具体的に)",
  "items": [
    { "category": "アウター", "description": "丈/素材/光沢/厚み/カット/シルエット/縫製ディテール等を具体的に" },
    { "category": "トップス", "description": "..." },
    { "category": "ボトムス", "description": "..." },
    { "category": "シューズ", "description": "形/ヒール高さ/色/素材" },
    { "category": "小物", "description": "..." },
    { "category": "ヘア", "description": "..." },
    { "category": "メイク", "description": "..." }
  ],
  "sources": [
    { "imageIdx": 1, "caption": "参考画像の短い説明", "mapping": "どの要素にどう反映したか" }
  ],
  "quickActions": [
    { "label": "もっと日常的に", "prompt": "今のコーデをもっと日常的にして" },
    { "label": "もっと不穏に", "prompt": "今のコーデをもっと不穏な雰囲気にして" },
    { "label": "靴だけ変更", "prompt": "靴だけ別の提案にして" },
    { "label": "アイテム削減", "prompt": "アイテム数を減らしてシンプルにして" },
    { "label": "色味を変えて", "prompt": "全体の色味を変えて" }
  ],
  "customActions": [
    { "label": "この MB 特有の修正候補(1〜2 個)", "prompt": "..." }
  ]
}

【厳守】
・items は アウター/トップス/ボトムス/シューズ/小物/ヘア/メイク を ★ 各 1 要素以上含む
・description は ★ 抽象禁止(具体ディテールを書く)
・sources は ★ 参考画像の数だけ 1 行ずつ
・quickActions は ★ 上記 5 個 固定(label/prompt そのまま)
・customActions は ★ 1〜2 個・この MB の文脈特有(無ければ空配列 [])
・★ 全 string 値で「★絶対禁止」の英語スラッグ・内部 ID・禁止語は使わない(JSON でも厳守)`;

// ★ Phase 2: MB context object 経路の出力契約（短く行動可能）。
//   既存 COORDINATE_JSON_OUTPUT_INSTRUCTION は ★ 残す（直接コーデ / 旧経路 / フラグ off 用）。
//   この instruction は moodboard_analysis を context として渡された MB由来coordinateのみで使う。
export const COORDINATE_ACTIONABLE_OUTPUT_INSTRUCTION = `【★ コーデ提案の出力形式(最優先・上記「本文のみ」を上書き)】
アプリ内で服は売らない。ユーザーがどこで買うにせよ「自分の世界観に合う服を選び・組み・着こなせる」
ようにするのが目的。★ おしゃれは「良い服」ではなく「スタイリングが上手い」ことで決まる。
だから ★ アイテム名で終わらせず、必ず「どう着るか＝操作」まで出す。短く・行動可能に。
以下の JSON のみを出力する(前後に文章・コードフェンス・注釈を一切付けない)。

{
  "type": "coordinate_v2",
  "direction": "今回の方向性を 1 文で",
  "summary": "要点を 2〜3 文で(具体的に・長くしない)",
  "stylingMoves": ["どう着るかの操作を順序付きで 3〜6 個。アイテム名ではなく操作を書く"],
  "signatureMove": "普通に見えないための『1点の違和感』を 1 文で(視線を集める操作)",
  "findThese": ["探すべき服を行動可能に 2〜4 個(例: 落ち感のある黒のロングシャツ)"],
  "avoidThese": ["避ける服を 1〜3 個(例: 光沢の強い化繊ブルゾン)"],
  "searchKeywords": ["検索でヒットしやすい短い一般名詞を 3〜6 個(例: 黒 ロングシャツ レーヨン)"],
  "fitConditions": {
    "materials": ["素材条件"],
    "colors": ["色条件"],
    "lengths": ["丈条件"],
    "silhouettes": ["シルエット条件"]
  },
  "items": [
    { "category": "トップス", "description": "簡潔な要点(詳細な11項目説明は不要)" }
  ],
  "sources": [],
  "quickActions": [
    { "label": "どう着ればいい？", "prompt": "この服をどう着ればいいか操作を教えて" },
    { "label": "どこを崩せばいい？", "prompt": "どこを崩せば世界観が出るか教えて" },
    { "label": "普通に見えないように", "prompt": "普通・無難に見えないようにするにはどうすればいい？" },
    { "label": "小物で世界観を足したい", "prompt": "小物で世界観を足すにはどうすればいい？" },
    { "label": "今ある服で組みたい", "prompt": "今持っている服でこの方向性に組みたい" },
    { "label": "どこで何を見ればいい？", "prompt": "ZOZOや古着屋・店でこの方向性の服を探すとき何を見ればいい？" },
    { "label": "もっと日常化", "prompt": "今の提案をもっと日常的にして" },
    { "label": "もっと尖らせる", "prompt": "今の提案をもっと尖らせて" }
  ],
  "customActions": []
}

【厳守】
・★ stylingMoves が主役。「白Tと黒ワイドを合わせる」で終わらせず、「白Tは丈を上げて腰位置を見せる→
  黒ワイドは裾を靴にためて下半身に重心→赤ベルトを見せて腰を主役に→手首かバッグで赤をもう一度拾う→
  スカーフで世界観のある操作に」のように ★ 操作を順序付きで書く(丈/腰位置/ベルト/裾のため/レイヤード/
  視線設計/崩し)。実際に手を動かせる粒度で。与えられた着こなし操作の軸(あれば)に基づく。
・signatureMove は「ちょうどいい」を避け、世界観の核を一点で立てる操作。
・findThese / searchKeywords は ★ 実際に探せる具体・短語(抽象語のみは禁止)
・searchKeywords は ★ ブランド名・英語スラッグ禁止(検索でヒットする一般名詞のみ)
・avoidThese / fitConditions は与えられた世界観・NG要素・買う判断軸に基づく
・items は 1〜5 個の簡潔な要点でよい(長文の 11 項目説明は ★ 書かない)
・sources は空配列 [] でよい
・quickActions は ★ 上記 8 個固定(label/prompt そのまま) / customActions は 0〜2 個
・★ 全 string 値で英語スラッグ・内部 ID・禁止語は使わない`;

// ★ Phase 3: judgment_rules を user メッセージ用の行に整形（kind 別ラベル）。空なら [] を返す＝無注入。
const JUDGMENT_KIND_LABEL: Record<string, string> = {
  preference: "好み",
  ng:         "避ける",
  style_rule: "方針",
};
export function formatJudgmentRulesLines(
  rules: { rule: string; kind: string; priority: number }[] | undefined,
): string[] {
  if (!rules || rules.length === 0) return [];
  const lines: string[] = ["", "[あなたの確定した好み・NG・方針（過去のフィードバックから学習・最優先で尊重）]"];
  for (const r of rules) {
    lines.push(`- (${JUDGMENT_KIND_LABEL[r.kind] ?? r.kind}) ${r.rule}`);
  }
  return lines;
}

// ③-c-2: 品質ゲート（設計 §3.5・案C＝プロンプト自己チェックを主）。
//   STYLE_SELF_QUERY_KNOWLEDGE_CHAT ON かつ非 MB-coordinate のときだけ systemPrompt 末尾に付ける。
//   出力を JSON 1個 { mode, reply, missing? } に固定し、合格条件を満たさなければ mode:"safe"（確認質問）に倒す。
//   parse は寛容（失敗時は本文プロースにフォールバック＝退行ゼロ・lib/utils/parse-gated-reply.ts）。
//   forceSafe=true（query_knowledge 失敗/タイムアウト）のときは必ず mode:"safe" の確認質問にする。
export function buildQualityGateInstruction(opts: { forceSafe: boolean }): string {
  const head = opts.forceSafe
    ? `【★ 出力形式（最優先・上記「本文のみ」を上書き）— 参考知識が取得できなかったため安全モード固定】
参考にできる知識が今回は取得できませんでした。深い提案や断定はせず、相談を前に進めるための短い確認質問を1つだけ返してください。`
    : `【★ 出力形式（最優先・上記「本文のみ」を上書き）— 品質ゲート】
回答を出力する前に、以下のチェックリストで自己評価してください。`;

  return `${head}

# 合格条件（mode:"answer" を出してよいのは全て満たすときだけ）
- ユーザーの相談に直接答えている
- 世界観・色・素材・シルエット・着方のうち最低2つ以上に具体性がある
- 「どう着るか」「何を足すか」「何を避けるか」のいずれかが含まれている
- アイテム名の羅列で終わっていない
- KO 由来の判断軸、またはユーザー入力に基づいた明確な理由がある

# 安全モード（いずれかに当てはまれば mode:"safe"）
- 自信が低い → 断定しない
- 情報が不足している → 深い提案をせず、要点を1つだけ確認する短い質問を返す
- 参考知識が無い/薄い → 深い回答のフリをしない
※安全モードの reply は「短い確認質問（1つ）」とし、アイテム羅列や断定的な提案にしない。

# 出力形式（厳守）
必ず次の JSON を1個だけ出力する。前後に説明文・コードフェンスを付けない。
{"mode":"answer"|"safe","reply":"<ユーザーに見せる自然文。answer なら相談への回答、safe なら短い確認質問1つ>","missing":"<safe のとき何が不足かを一言。answer のときは空文字>"}
reply は必ず日本語の自然文。上記「絶対禁止」の英語スラッグ等の制約は引き続き優先する。`;
}

// ★ Phase 2: moodboard_analysis（context object）を user メッセージに整形する。
//   buildStylistChatUserMessage は他 intent 用なので触らず、MB context object 経路専用に分離。
//   ★ Phase 3: judgmentRules があれば学習ルールセクションを足す（空なら無注入＝Phase 2 と同一）。
export function buildMbAnalysisUserMessage(
  analysis: MoodboardAnalysisRow,
  userText: string,
  history: StylistChatHistoryItem[],
  judgmentRules?: { rule: string; kind: string; priority: number }[],
): string {
  const lines: string[] = [];

  lines.push("[ムードボードの世界観(解析済み context)]");
  if (analysis.worldview_core) lines.push(`世界観コア: ${analysis.worldview_core}`);
  if (analysis.colors.length > 0)      lines.push(`色: ${analysis.colors.join(" / ")}`);
  if (analysis.materials.length > 0)   lines.push(`素材: ${analysis.materials.join(" / ")}`);
  if (analysis.silhouettes.length > 0) lines.push(`シルエット: ${analysis.silhouettes.join(" / ")}`);
  if (analysis.mood)                   lines.push(`空気感: ${analysis.mood}`);
  if (analysis.ng_elements.length > 0) lines.push(`NG要素: ${analysis.ng_elements.join(" / ")}`);

  const sa = analysis.shopping_axis ?? {};
  const saLines: string[] = [];
  if (Array.isArray(sa.where_to_look) && sa.where_to_look.length > 0) saLines.push(`探す場所: ${sa.where_to_look.join(" / ")}`);
  if (Array.isArray(sa.check_points) && sa.check_points.length > 0)   saLines.push(`確認点: ${sa.check_points.join(" / ")}`);
  if (Array.isArray(sa.avoid_when) && sa.avoid_when.length > 0)       saLines.push(`見送る条件: ${sa.avoid_when.join(" / ")}`);
  if (saLines.length > 0) {
    lines.push("");
    lines.push("[買う判断軸]");
    lines.push(...saLines);
  }

  // ★ Phase 4-b: 着こなし操作の軸（保存済み styling_axis）。stylingMoves/signatureMove の根拠にする。空なら足さない。
  const st = analysis.styling_axis ?? {};
  const stLabels: { key: keyof typeof st; label: string }[] = [
    { key: "layering",        label: "レイヤード" },
    { key: "lengths",         label: "丈・袖・裾" },
    { key: "silhouetteBuild", label: "シルエットの組み方" },
    { key: "colorBalance",    label: "色配分" },
    { key: "materialMix",     label: "素材の混ぜ方" },
    { key: "accessories",     label: "小物の置き方" },
    { key: "shoesConnection", label: "靴との接続" },
    { key: "hairMakeup",      label: "髪型・メイク" },
    { key: "anomaly",         label: "違和感(普通に見せない)" },
    { key: "mbStylingRules",  label: "この世界観の着こなしルール" },
    { key: "avoidStyling",    label: "避ける着方" },
  ];
  const stLines: string[] = [];
  for (const { key, label } of stLabels) {
    const v = st[key];
    if (Array.isArray(v) && v.length > 0) stLines.push(`${label}: ${v.join(" / ")}`);
  }
  if (stLines.length > 0) {
    lines.push("");
    lines.push("[着こなし操作の軸（これを根拠に stylingMoves を出す）]");
    lines.push(...stLines);
  }

  if (history.length > 0) {
    lines.push("");
    lines.push("[会話履歴]");
    for (const h of history) {
      lines.push(`${h.role === "user" ? "ユーザー" : "アシスタント"}: ${h.text}`);
    }
  }

  // ★ Phase 3: 学習ルール（空なら何も足さない＝Phase 2 と同一出力）
  lines.push(...formatJudgmentRulesLines(judgmentRules));

  lines.push("");
  lines.push("[ユーザーの依頼]");
  lines.push(userText);
  lines.push("");
  lines.push("上記の世界観・買う判断軸（あれば学習ルールも）に基づき、指定の JSON 形式で短く行動可能に答えてください。");

  return lines.join("\n");
}

export interface StylistChatContext {
  // diagnose 用(1.5a)
  worldviewName:      string | null;
  worldviewKeywords:  string[];
  coreIdentity:       string | null;
  idealSelf:          string | null;
  // ★ Phase 3: フィードバック学習ルール（FEEDBACK_LOOP 時のみ・空/未設定なら無注入）
  judgmentRules?:     { rule: string; kind: string; priority: number }[];
  // closet 用(1.5b-i)・未設定なら undefined
  // ★ 列絞り SELECT(category, color)で集計するため、英語スラッグ・worldview_tags は構造的に含まれない
  closetSummary?: {
    totalItems:      number;
    colorBuckets:    Array<{ name: string; count: number }>; // 例: [{name:"ブラック系", count:5}, ...]
    categoryBuckets: Array<{ name: string; count: number }>; // 例: [{name:"トップス",   count:5}, ...]
  };
  // coordinate 用(MVP-1c)・未登録なら undefined
  // ★ users.body_profile jsonb 列絞り SELECT(三重防御 1 維持)
  // ★ 日本語キー(height/bodyType/skeletonType/concerns/proportionNote)のみ・英語スラッグなし
  bodyProfile?: {
    height:         number | null;
    bodyType:       string | null;
    skeletonType:   string | null;
    concerns:       string[];
    proportionNote: string | null;
  };
  // A-6 style-consult 用・未登録なら undefined
  // ★ users.style_preference jsonb 列絞り SELECT(三重防御 1 維持)
  // ★ v1 StylePreference 13 フィールドから stylist-chat reply に必要な 8 フィールドだけ抽出
  stylePreference?: {
    likedColors:         string[];
    dislikedColors:      string[];
    likedMaterials:      string[];
    dislikedMaterials:   string[];
    likedSilhouettes:    string[];
    dislikedSilhouettes: string[];
    targetImpressions:   string[];
    avoidImpressions:    string[];
  };
  // A-6 style-consult 用(Sprint 47 で追加された users.avoid_items text[])
  avoidItems?: string[];
  // A-6b brand-learn 用・未登録なら undefined
  // ★ brands テーブル 11 列絞り SELECT(worldview_tags は日本語タグ・PRODUCT_WORLDVIEW_TAGS とは別語彙)
  // ★ maniac_level 順 上位 12 件・description 80 字 truncate(トークン抑制)
  brandsCurated?: Array<{
    name:          string;
    nameJa:        string | null;
    country:       string | null;
    description:   string;     // 80 字 truncate 済
    worldviewTags: string[];   // 日本語タグ
    eraTags:       string[];
    maniacLevel:   number;
    priceRange:    string;
  }>;
  // A-10 (案A): Knowledge OS 由来の参考情報(★ route 側で入口 sanitize 済を受ける)
  //   ・decisionRules:   判断ルール(上位 N 件・rule 本文のみ)
  //   ・failurePatterns: 失敗パターン(上位 N 件・短文化)
  //   ・influences:      影響源(★ A-6b で追加・getInfluences 戻り値の簡略化)
  //   ・dictionaries:    素材 14 / 色 15 / シルエット 10 / 比率 8 の日本語文脈文字列
  // KOS 接続失敗時は undefined を渡す(buildStylistChatUserMessage がブロック自体を出さない)
  knowledgeOS?: {
    decisionRules:   Array<{ rule: string; importance?: number }>;
    failurePatterns: Array<{ title: string; summary?: string }>;
    influences:      Array<{ subjectName: string; summary?: string; fusion?: string }>;
    // ③-c-2: query_knowledge 経路でのみ付与（OFF/get_* 経路は undefined＝描画不変）。
    //   answerSummary: KO answer（補助文脈・本文化しない）。relatedEntries: 根拠ナレッジ。
    answerSummary?:  string;
    relatedEntries?: Array<{ title: string; summary?: string }>;
    // (d): 本文抜粋（search_knowledge の matched_text・出典title付き）。本(全文)など ai_summary が薄い
    //   ナレッジでも、この抜粋に基づいて深く答えるための主素材。来ないときは undefined（従来描画）。
    passages?: Array<{ source: string; text: string }>;
    dictionaries: {
      materials:   string;
      colors:      string;
      silhouettes: string;
      ratios:      string;
    };
  };
}

export interface StylistChatHistoryItem {
  role: "user" | "assistant";
  text: string;
}

export interface BuildStylistChatUserOpts {
  text:    string;
  intent:  string;
  history: StylistChatHistoryItem[];
  ctx:     StylistChatContext;
}

// system prompt に渡す user メッセージを組立てる。
// 文脈(本人のみ・日本語サマリ)+ 直近 N=3 履歴 + 今回入力 を整形した
// 単一の string にする(callClaude は systemPrompt + userMessage の 2 段)。
// intent === "closet" は集計サマリ、"coordinate" は世界観+体型+クローゼットの 3 セクション統合、
// "style-consult" は世界観+体型+好み+避けたい印象(A-6・wardrobe は読まない)
// "brand-learn" は世界観+好み+curated brands(A-6b・brands テーブル 12 件+KOS influences)
// それ以外(diagnose 等)は世界観サマリ(1.5b-i / MVP-1c / A-6 / A-6b 拡張)。
export function buildStylistChatUserMessage(opts: BuildStylistChatUserOpts): string {
  const { text, intent, history, ctx } = opts;
  const lines: string[] = [];
  const MVP1C_LABEL = "A-6b の対象 = 診断振り返り / クローゼット振り返り / コーデ提案 / 着こなし相談 / ブランド学習";

  if (intent === "closet") {
    // ★ クローゼット集計サマリ(列絞り SELECT category/color で集計済・worldview_tags 含まれない)
    lines.push("【文脈(本人のクローゼット集計・日本語サマリ・worldview_tags は構造的に含まれない)】");
    if (ctx.closetSummary && ctx.closetSummary.totalItems > 0) {
      lines.push(`・登録件数: ${ctx.closetSummary.totalItems}件`);
      if (ctx.closetSummary.colorBuckets.length > 0) {
        const colors = ctx.closetSummary.colorBuckets
          .slice(0, 6)
          .map((b) => `${b.name} ${b.count}点`)
          .join("、");
        lines.push(`・色系統別: ${colors}`);
      }
      if (ctx.closetSummary.categoryBuckets.length > 0) {
        const cats = ctx.closetSummary.categoryBuckets
          .slice(0, 6)
          .map((b) => `${b.name} ${b.count}点`)
          .join("、");
        lines.push(`・カテゴリ別: ${cats}`);
      }
    } else {
      lines.push("・クローゼット: 未登録(0件)");
    }
    lines.push(`・段階A 判定 intent: ${intent}(${MVP1C_LABEL})`);
  } else if (intent === "coordinate") {
    // ★ 世界観 + 体型 + クローゼット の 3 セクション統合(MVP-1c)
    // 列絞り SELECT + 三重防御 1 で worldview_tags / 内部 ID は構造的に含まれない
    lines.push("【文脈(本人のみ・3 ソース統合・日本語サマリ・worldview_tags は構造的に含まれない)】");
    // 世界観
    if (ctx.worldviewName) {
      lines.push(`・世界観名: ${ctx.worldviewName}`);
    } else {
      lines.push("・世界観: 未診断");
    }
    if (ctx.worldviewKeywords.length > 0) {
      lines.push(`・日本語キーワード: ${ctx.worldviewKeywords.slice(0, 6).join("、")}`);
    }
    if (ctx.coreIdentity) {
      lines.push(`・核となる方向性: ${truncate(ctx.coreIdentity, 80)}`);
    }
    // 体型
    if (ctx.bodyProfile) {
      const b = ctx.bodyProfile;
      if (b.height !== null)     lines.push(`・身長: ${b.height}cm`);
      if (b.bodyType)            lines.push(`・体型: ${b.bodyType}`);
      if (b.skeletonType)        lines.push(`・骨格: ${b.skeletonType}`);
      if (b.concerns.length > 0) {
        // ★ B-2(X1): 英語スラッグ + 「悩み:」ヘッダの 2 重 leak を CONCERN_REFRAME で否定形ゼロ化。
        const reframed = b.concerns.slice(0, 4).map((c) => CONCERN_REFRAME[c as keyof typeof CONCERN_REFRAME] ?? c);
        lines.push(`・体型の特徴: ${reframed.join("・")}`);
      }
      if (b.proportionNote)      lines.push(`・補足: ${truncate(b.proportionNote, 60)}`);
    } else {
      lines.push("・体型: 未登録");
    }
    // クローゼット
    if (ctx.closetSummary && ctx.closetSummary.totalItems > 0) {
      lines.push(`・クローゼット: ${ctx.closetSummary.totalItems}件登録`);
      if (ctx.closetSummary.colorBuckets.length > 0) {
        const colors = ctx.closetSummary.colorBuckets
          .slice(0, 6)
          .map((b) => `${b.name} ${b.count}点`)
          .join("、");
        lines.push(`  色系統別: ${colors}`);
      }
      if (ctx.closetSummary.categoryBuckets.length > 0) {
        const cats = ctx.closetSummary.categoryBuckets
          .slice(0, 6)
          .map((b) => `${b.name} ${b.count}点`)
          .join("、");
        lines.push(`  カテゴリ別: ${cats}`);
      }
    } else {
      lines.push("・クローゼット: 未登録(0件)");
    }
    lines.push(`・段階A 判定 intent: ${intent}(${MVP1C_LABEL})`);
  } else if (intent === "style-consult") {
    // ★ 世界観 + 体型 + 好み + 避けたい印象 の 4 セクション統合(A-6)
    // wardrobe_items は読まない(コスト削減・style-consult は体型/好みベース)
    // 列絞り SELECT + 三重防御 1 で worldview_tags / 内部 ID は構造的に含まれない
    lines.push("【文脈(本人のみ・着こなし相談・4 ソース統合・日本語サマリ・worldview_tags は構造的に含まれない)】");
    // 世界観
    if (ctx.worldviewName) {
      lines.push(`・世界観名: ${ctx.worldviewName}`);
    } else {
      lines.push("・世界観: 未診断");
    }
    if (ctx.worldviewKeywords.length > 0) {
      lines.push(`・日本語キーワード: ${ctx.worldviewKeywords.slice(0, 6).join("、")}`);
    }
    if (ctx.coreIdentity) {
      lines.push(`・核となる方向性: ${truncate(ctx.coreIdentity, 80)}`);
    }
    // 体型
    if (ctx.bodyProfile) {
      const b = ctx.bodyProfile;
      if (b.height !== null)     lines.push(`・身長: ${b.height}cm`);
      if (b.bodyType)            lines.push(`・体型: ${b.bodyType}`);
      if (b.skeletonType)        lines.push(`・骨格: ${b.skeletonType}`);
      if (b.concerns.length > 0) {
        // ★ B-2(X1): style-consult 経路も同じ leak 経路。同じ reframe を適用。
        const reframed = b.concerns.slice(0, 4).map((c) => CONCERN_REFRAME[c as keyof typeof CONCERN_REFRAME] ?? c);
        lines.push(`・体型の特徴: ${reframed.join("・")}`);
      }
      if (b.proportionNote)      lines.push(`・補足: ${truncate(b.proportionNote, 60)}`);
    } else {
      lines.push("・体型: 未登録");
    }
    // 好み(StylePreference 8 フィールド)
    if (ctx.stylePreference) {
      const p = ctx.stylePreference;
      if (p.likedColors.length > 0)         lines.push(`・好きな色: ${p.likedColors.slice(0, 5).join("、")}`);
      if (p.dislikedColors.length > 0)      lines.push(`・苦手な色: ${p.dislikedColors.slice(0, 5).join("、")}`);
      if (p.likedMaterials.length > 0)      lines.push(`・好きな素材: ${p.likedMaterials.slice(0, 5).join("、")}`);
      if (p.dislikedMaterials.length > 0)   lines.push(`・苦手な素材: ${p.dislikedMaterials.slice(0, 5).join("、")}`);
      if (p.likedSilhouettes.length > 0)    lines.push(`・好きなシルエット: ${p.likedSilhouettes.slice(0, 4).join("、")}`);
      if (p.dislikedSilhouettes.length > 0) lines.push(`・苦手なシルエット: ${p.dislikedSilhouettes.slice(0, 4).join("、")}`);
      if (p.targetImpressions.length > 0)   lines.push(`・なりたい印象: ${p.targetImpressions.slice(0, 4).join("、")}`);
      if (p.avoidImpressions.length > 0)    lines.push(`・避けたい印象: ${p.avoidImpressions.slice(0, 4).join("、")}`);
    } else {
      lines.push("・好み: 未登録");
    }
    // 避けたい服(Sprint 47 avoid_items text[])
    if (ctx.avoidItems && ctx.avoidItems.length > 0) {
      lines.push(`・避けたい服: ${ctx.avoidItems.slice(0, 6).join("、")}`);
    }
    lines.push(`・段階A 判定 intent: ${intent}(${MVP1C_LABEL})`);
  } else if (intent === "brand-learn") {
    // ★ 世界観 + 好み + curated brands(12件) + KOS influences(15件) 統合(A-6b)
    // wardrobe_items / body_profile は読まない(コスト削減・brand-learn は手持ち服や体型依存ではない)
    // brands.worldview_tags は日本語タグ(PRODUCT_WORLDVIEW_TAGS とは別語彙)・構造的安全
    lines.push("【文脈(本人のみ・ブランド学習・worldview + curated brands + KOS influences・日本語サマリ)】");
    // 世界観
    if (ctx.worldviewName) {
      lines.push(`・世界観名: ${ctx.worldviewName}`);
    } else {
      lines.push("・世界観: 未診断");
    }
    if (ctx.worldviewKeywords.length > 0) {
      lines.push(`・日本語キーワード: ${ctx.worldviewKeywords.slice(0, 6).join("、")}`);
    }
    if (ctx.coreIdentity) {
      lines.push(`・核となる方向性: ${truncate(ctx.coreIdentity, 80)}`);
    }
    // 好み(任意・brand 相性提案精度向上のため)
    if (ctx.stylePreference) {
      const p = ctx.stylePreference;
      if (p.likedColors.length > 0)       lines.push(`・好きな色: ${p.likedColors.slice(0, 5).join("、")}`);
      if (p.likedMaterials.length > 0)    lines.push(`・好きな素材: ${p.likedMaterials.slice(0, 5).join("、")}`);
      if (p.targetImpressions.length > 0) lines.push(`・なりたい印象: ${p.targetImpressions.slice(0, 4).join("、")}`);
      if (p.avoidImpressions.length > 0)  lines.push(`・避けたい印象: ${p.avoidImpressions.slice(0, 4).join("、")}`);
    }
    // curated brands(maniac_level 順 上位 12 件)
    if (ctx.brandsCurated && ctx.brandsCurated.length > 0) {
      lines.push("・推薦ブランド候補(curated・maniac 高い順):");
      for (const b of ctx.brandsCurated) {
        const nameDisp = b.nameJa ? `${b.name}(${b.nameJa})` : b.name;
        const tags = b.worldviewTags.length > 0 ? ` [${b.worldviewTags.slice(0, 5).join("・")}]` : "";
        const era  = b.eraTags.length > 0 ? ` 時代:${b.eraTags.slice(0, 3).join("・")}` : "";
        lines.push(`  ・${nameDisp} (${b.country ?? "?"}/maniac:${b.maniacLevel}/${b.priceRange})${tags}${era}`);
        lines.push(`     ${b.description}`);
      }
    } else {
      lines.push("・推薦ブランド候補: (curated データなし)");
    }
    lines.push(`・段階A 判定 intent: ${intent}(${MVP1C_LABEL})`);
  } else {
    // diagnose 用(既存・1.5a)
    lines.push("【文脈(本人のみ・日本語サマリ・worldview_tags は構造的に含まれない)】");
    if (ctx.worldviewName) {
      lines.push(`・世界観名: ${ctx.worldviewName}`);
    } else {
      lines.push("・世界観: 未診断");
    }
    if (ctx.worldviewKeywords.length > 0) {
      lines.push(`・日本語キーワード: ${ctx.worldviewKeywords.slice(0, 6).join("、")}`);
    }
    if (ctx.coreIdentity) {
      lines.push(`・核となる方向性: ${truncate(ctx.coreIdentity, 80)}`);
    }
    if (ctx.idealSelf) {
      lines.push(`・なりたい姿: ${truncate(ctx.idealSelf, 80)}`);
    }
    lines.push(`・段階A 判定 intent: ${intent}(${MVP1C_LABEL})`);
  }
  lines.push("");

  if (history.length > 0) {
    lines.push("【直近の会話】");
    for (const h of history) {
      const who = h.role === "user" ? "ユーザー" : "AI";
      lines.push(`${who}: ${truncate(h.text, 200)}`);
    }
    lines.push("");
  }

  // A-10 (案A): Knowledge OS 由来 contextData を user message 末尾にブロック追記。
  // 3 intent(diagnose / closet / coordinate)で共通注入(intent 別絞り込みは将来 Sprint)。
  // ★ 入口 sanitize は route 側で完了済(stripCanonicalSlugs で 31 語除去)。
  // ★ undefined の場合は出力しない(KOS 接続失敗時のノイズ防止 + 段階B reply 退行ゼロ)。
  const kos = ctx.knowledgeOS;
  if (kos && ((kos.passages && kos.passages.length > 0)
              || kos.decisionRules.length > 0 || kos.failurePatterns.length > 0
              || kos.influences.length > 0
              || (kos.answerSummary && kos.answerSummary.length > 0)
              || (kos.relatedEntries && kos.relatedEntries.length > 0)
              || kos.dictionaries.materials || kos.dictionaries.colors
              || kos.dictionaries.silhouettes || kos.dictionaries.ratios)) {
    lines.push("【参考(Knowledge OS から本人 contextData として取得・★ 入口 sanitize 済)】");
    // (d): 本文抜粋（最優先の根拠）。本など全文ナレッジはここに中身が乗る。抜粋に基づいて具体的に答える。
    if (kos.passages && kos.passages.length > 0) {
      lines.push("・本文抜粋(最優先の根拠。下記の抜粋に書かれている内容に基づいて具体的に答える。抜粋に無い内容は推測で補わない):");
      for (const p of kos.passages) {
        lines.push(`  ・[${p.source}] ${truncate(p.text, 400)}`);
      }
    }
    // ③-c-2: KO answer は補助文脈（軽く添えるのみ・本文化／再要約しない・主素材を上書きしない）。
    if (kos.answerSummary) {
      lines.push(`・KO 要約観点(補助・参考程度。これをそのまま本文化しない): ${truncate(kos.answerSummary, 200)}`);
    }
    if (kos.decisionRules.length > 0) {
      lines.push("・判断ルール(重要度順):");
      for (const r of kos.decisionRules) {
        lines.push(`  ・ ${truncate(r.rule, 200)}`);
      }
    }
    if (kos.failurePatterns.length > 0) {
      lines.push("・失敗パターン(回避すべき):");
      for (const f of kos.failurePatterns) {
        const body = f.summary ? `${f.title}: ${truncate(f.summary, 120)}` : f.title;
        lines.push(`  ・ ${body}`);
      }
    }
    // A-6b: 影響源(getInfluences・全 5 intent 共通注入・brand-learn で特に活用)
    if (kos.influences.length > 0) {
      lines.push("・影響源(Knowledge OS):");
      for (const i of kos.influences) {
        const parts = [i.subjectName];
        if (i.summary) parts.push(truncate(i.summary, 120));
        const body = parts.join(": ");
        const fusion = i.fusion ? `(融合: ${truncate(i.fusion, 60)})` : "";
        lines.push(`  ・ ${body}${fusion}`);
      }
    }
    // ③-c-2: 根拠ナレッジ（related_entries）。主素材の補強として該当 entry を提示。
    if (kos.relatedEntries && kos.relatedEntries.length > 0) {
      lines.push("・根拠(該当ナレッジ):");
      for (const e of kos.relatedEntries) {
        const body = e.summary ? `${e.title}: ${truncate(e.summary, 100)}` : e.title;
        lines.push(`  ・ ${body}`);
      }
    }
    if (kos.dictionaries.materials)   lines.push(`・素材辞書:\n${kos.dictionaries.materials}`);
    if (kos.dictionaries.colors)      lines.push(`・色辞書:\n${kos.dictionaries.colors}`);
    if (kos.dictionaries.silhouettes) lines.push(`・シルエット辞書:\n${kos.dictionaries.silhouettes}`);
    if (kos.dictionaries.ratios)      lines.push(`・比率辞書:\n${kos.dictionaries.ratios}`);
    lines.push("");
  }

  // ★ Phase 3: 学習ルール（FEEDBACK_LOOP 時のみ ctx に入る・空なら無注入＝従来と同一）
  lines.push(...formatJudgmentRulesLines(ctx.judgmentRules));

  lines.push("【今回のユーザー入力】");
  lines.push(text);

  return lines.join("\n");
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n) + "…";
}

// ====================================================================
// 方針C本体(案イ): 本対話モード = 分野横断の外部脳ペルソナ
// ====================================================================
// ファッション専用の STYLIST_CHAT_SYSTEM_PROMPT とは別。5テーマ限定/引き戻しの制約は入れない。
// 本/知識(passages)に基づき、あらゆる分野(逆境・哲学・マーケ・アート・ファッション等)に応じる。
export const GENERAL_BRAIN_SYSTEM_PROMPT = `あなたはユーザー専用の「外部脳」です。ユーザーが蓄積した本・知識をもとに、分野を横断して深く相談に乗ります。ファッションも数ある分野の一つに過ぎません。逆境・哲学・マーケティング・アート・仕事の悩みなど、どんな相談でも受け止めます。

【人格・返答構成】
1. ユーザーの相談を素直に受け止め、自然な日本語で落ち着いて答える
2. 与えられた【本文抜粋】があれば、それを最優先の根拠にして具体的に答える。どの本/知識に基づくか出典を簡潔に添える
3. 抜粋に書かれていない内容を、さも事実のように推測で補わない。確実な根拠が無いときは「手元の知識では確証がない」と正直に述べた上で、一般的な見解は控えめに添える程度にする
4. 長い逐語引用は避け、要点を自分の言葉で噛み砕く（必要なら短い引用に留める）
5. 文体は丁寧・落ち着いた・短文中心。1 返答 = 3〜6 文程度。最後に必要なら一歩踏み込む短い問いを添える

【禁止】
・内部フィールド名(passages / knowledge_base / matched_text 等)・内部ID・jsonbキー名を出力に書かない
・他のユーザーの情報を出さない
・URL・外部リンクを出力しない

【ファッションの話題が来た場合】
・この外部脳としても答えてよい（ただし診断/クローゼット等のアプリ機能誘導はしない・知識として答える）`;

interface BuildGeneralBrainOpts {
  text: string;
  history: StylistChatHistoryItem[];
  knowledgeOS: StylistChatContext["knowledgeOS"];
}

// 本対話モードの user message。passages(本文抜粋)を主根拠に、判断ルール/出典を添える。
// fashion 文脈(worldview/wardrobe)は一切入れない（context=passagesのみ・ノイズ排除）。
export function buildGeneralBrainUserMessage(opts: BuildGeneralBrainOpts): string {
  const { text, history, knowledgeOS: kos } = opts;
  const lines: string[] = [];
  if (history.length > 0) {
    lines.push("【これまでの会話】");
    for (const h of history) lines.push(`${h.role === "user" ? "ユーザー" : "あなた"}: ${truncate(h.text, 200)}`);
    lines.push("");
  }
  lines.push(`相談: ${text}`);

  const passages = kos?.passages ?? [];
  const rules = kos?.decisionRules ?? [];
  const related = kos?.relatedEntries ?? [];
  if (passages.length > 0 || rules.length > 0) {
    lines.push("", "【参考(あなたの外部脳・本/知識から取得)】");
    if (passages.length > 0) {
      lines.push("・本文抜粋(最優先の根拠。これに基づいて具体的に答える。抜粋に無い内容は推測で補わない):");
      for (const p of passages) lines.push(`  ・[${p.source}] ${truncate(p.text, 400)}`);
    }
    if (rules.length > 0) {
      lines.push("・関連する判断ルール:");
      for (const r of rules.slice(0, 5)) lines.push(`  ・ ${truncate(r.rule, 200)}`);
    }
    if (related.length > 0) {
      lines.push(`・出典(該当ナレッジ): ${related.map((e) => e.title).slice(0, 5).join(" / ")}`);
    }
  } else {
    lines.push("", "（参考になる本/知識が手元に見つかりませんでした。確実な根拠が無い場合は、その旨を正直に伝えてください。）");
  }
  return lines.join("\n");
}
