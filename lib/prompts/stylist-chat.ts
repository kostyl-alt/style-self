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

export interface StylistChatContext {
  // diagnose 用(1.5a)
  worldviewName:      string | null;
  worldviewKeywords:  string[];
  coreIdentity:       string | null;
  idealSelf:          string | null;
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
  if (kos && (kos.decisionRules.length > 0 || kos.failurePatterns.length > 0
              || kos.influences.length > 0
              || kos.dictionaries.materials || kos.dictionaries.colors
              || kos.dictionaries.silhouettes || kos.dictionaries.ratios)) {
    lines.push("【参考(Knowledge OS から本人 contextData として取得・★ 入口 sanitize 済)】");
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
    if (kos.dictionaries.materials)   lines.push(`・素材辞書:\n${kos.dictionaries.materials}`);
    if (kos.dictionaries.colors)      lines.push(`・色辞書:\n${kos.dictionaries.colors}`);
    if (kos.dictionaries.silhouettes) lines.push(`・シルエット辞書:\n${kos.dictionaries.silhouettes}`);
    if (kos.dictionaries.ratios)      lines.push(`・比率辞書:\n${kos.dictionaries.ratios}`);
    lines.push("");
  }

  lines.push("【今回のユーザー入力】");
  lines.push(text);

  return lines.join("\n");
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n) + "…";
}
