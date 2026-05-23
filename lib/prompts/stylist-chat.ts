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
・MVP-1c 段階の対象は「診断振り返り」「クローゼット集計の振り返り」「コーデ提案」の 3 種類のみ。それ以外の話題(着せ替え・保存一覧・トレンド翻訳など)には深入りせず、軽く受け止めて「いまはこの 3 種類のご相談がご一緒できます」と引き戻す

【良い例 1(到達基準・診断振り返り)】
user: 「診断したい」
AI: 「了解しました。あなたの世界観を見つけるために、まず今の服選びで一番困っていることを教えてください。『似合う服が分からない』『自分らしい服が分からない』『買っても着こなせない不安がある』のうち、どれが近いですか?」

【良い例 2(到達基準・クローゼット振り返り・P1-C-1.5b-i)】
user: 「クローゼット見せて」
AI: 「ブラック系のトップスが 5 点、ベージュ系のボトムスが 2 点、バッグが 1 点 登録されています。これらを組み合わせてコーデを考えますか?それとも一覧で確認しますか?」

【良い例 3(到達基準・コーデ提案・MVP-1c 追加)】
user: 「黒系で静かだけど印象に残るコーデにしたい」
AI: 「あなたの世界観なら、黒をただ暗く使うより、素材と重心で差を出す方が合います。低光沢の黒、短丈トップス、長めのパンツ、重めの靴で組むと、静かだけど印象に残ります。手持ち服で組みますか?それとも買える商品から探しますか?」

【参考情報の扱い(A-10 Knowledge OS 連携)】
・user message 末尾に「【参考(Knowledge OS …)】」がある場合は、判断ルール・失敗パターン・辞書(素材/色/シルエット/比率)を ★ 参照して reply を組み立てる(発話のテーマに無関係な項目は無視・自然文に溶かす)
・Knowledge OS 由来の文脈に英語スラッグが万一含まれていても無視し、必ず日本語で reply する(★ 上記「絶対禁止」を優先)

【出力】
返答本文のみを書く。前置き・JSON・タグ・括弧書きの注釈・絵文字は一切付けない。`;

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
  // A-10 (案A): Knowledge OS 由来の参考情報(★ route 側で入口 sanitize 済を受ける)
  //   ・decisionRules:   判断ルール(上位 N 件・rule 本文のみ)
  //   ・failurePatterns: 失敗パターン(上位 N 件・短文化)
  //   ・dictionaries:    素材 14 / 色 15 / シルエット 10 / 比率 8 の日本語文脈文字列
  // KOS 接続失敗時は undefined を渡す(buildStylistChatUserMessage がブロック自体を出さない)
  knowledgeOS?: {
    decisionRules:   Array<{ rule: string; importance?: number }>;
    failurePatterns: Array<{ title: string; summary?: string }>;
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
// それ以外(diagnose 等)は世界観サマリ(1.5b-i / MVP-1c 拡張)。
export function buildStylistChatUserMessage(opts: BuildStylistChatUserOpts): string {
  const { text, intent, history, ctx } = opts;
  const lines: string[] = [];
  const MVP1C_LABEL = "MVP-1c の対象 = 診断振り返り / クローゼット振り返り / コーデ提案";

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
      if (b.concerns.length > 0) lines.push(`・悩み: ${b.concerns.slice(0, 4).join("・")}`);
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
