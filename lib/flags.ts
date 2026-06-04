// フィーチャーフラグ
//
// PRODUCTS_ENABLED: 商品候補・商品マッチング・ZOZO/楽天導線などの「商品UI」を
//   メイン導線に出すかどうか。既定 false（コア体験を診断→世界観→コーデ→投稿→
//   マッチングに絞る）。商品まわりのコード・型・API・DB は土台として保持し、
//   表示のみをこのフラグで一括制御する。L2（multi-source product catalog）で
//   NEXT_PUBLIC_PRODUCTS_ENABLED=true に戻すだけで復活できる。
//
// クライアントコンポーネントからも参照するため NEXT_PUBLIC_* を読む。
export const PRODUCTS_ENABLED =
  process.env.NEXT_PUBLIC_PRODUCTS_ENABLED === "true";

// SIMPLE_MODE: UI を「世界観診断 / チャット相談 / ムードボード」の 3 機能だけに絞る。
//   既定 true（明示的に "false" を入れたときだけ全機能モードに戻る）。
//   コード・API・DB は保持し、表示のみ各派生フラグで制御する。後で 1 機能ずつ戻す
//   ときは下の該当 const の右辺を true（または個別 env 参照）に書き換えるだけ。
export const SIMPLE_MODE = process.env.NEXT_PUBLIC_SIMPLE_MODE !== "false";

export const ENABLE_OUTFIT     = !SIMPLE_MODE; // /outfit（コーデ提案/着こなし相談/クローゼット）
export const ENABLE_CLOSET     = !SIMPLE_MODE; // クローゼット導線・チャットの👕添付
export const ENABLE_SAVED      = !SIMPLE_MODE; // /saved
export const ENABLE_HISTORY    = !SIMPLE_MODE; // /self?tab=history
export const ENABLE_BODY       = !SIMPLE_MODE; // /self?tab=body
export const ENABLE_PREFERENCE = !SIMPLE_MODE; // /self?tab=worldview（好み編集）
export const ENABLE_POSTS      = !SIMPLE_MODE; // 投稿・/self?tab=posts
export const ENABLE_VISUALIZE  = !SIMPLE_MODE; // VisualizeButton / tryon（画像生成・品質都合で停止中）

// MB_CONTEXT_OBJECT: ムードボード→チャットを「長文プロンプト」ではなく
//   moodboard_analysis（context object）駆動の短文・行動可能な応答にする（Phase 2）。
//   既定 true（新経路）。false で旧 buildMoodboardPrompt 長文経路に戻せる（ロールバック）。
export const MB_CONTEXT_OBJECT = process.env.NEXT_PUBLIC_MB_CONTEXT_OBJECT !== "false";

// FEEDBACK_LOOP: ユーザーの「好き/違う/保存」フィードバックを保存→ judgment_rules 抽出→
//   次回相談に反映する学習ループ（Phase 3）。既定 false（OFF で UI/抽出/注入すべて従来挙動）。
//   検証後に NEXT_PUBLIC_FEEDBACK_LOOP=true で有効化。UI(client) と feedback route(server) 双方で参照。
export const FEEDBACK_LOOP = process.env.NEXT_PUBLIC_FEEDBACK_LOOP === "true";

// STYLE_SELF_QUERY_KNOWLEDGE_CHAT: stylist-chat の KO 連携を get_* 3並列 → query_knowledge 主素材に
//   寄せる（③-c）。query_knowledge を待ち（通常20s/最大25s）、decision_rules/failure_patterns/
//   related_entries を【参考】の主素材に、answer は補助に、getInfluences は併用で温存。失敗/タイムアウトや
//   品質ゲート不合格時は通常回答を出さず安全モード（純粋な確認質問）。応答に koRequestId を載せる。
//   既定 OFF（"true" のときだけ ON）。OFF 時は完全に現状（get_* 3並列・queryKnowledge 不使用・新コード不走行）。
//   stylist-chat は server なので NEXT_PUBLIC_ 不要。実機比較してから採用判断する。
export const STYLE_SELF_QUERY_KNOWLEDGE_CHAT =
  process.env.STYLE_SELF_QUERY_KNOWLEDGE_CHAT === "true";

// navigate intent が現在の表示モードで到達可能か。チャットの AI 提案
// （AssistantActions / SuggestionChips / NavigateConfirm 等）のフィルタに使う。
// diagnose / worldview-profile / moodboard / coordinate 等は常に可視。
export function isNavIntentVisible(intent: string): boolean {
  switch (intent) {
    case "closet":          return ENABLE_CLOSET;
    case "saved":           return ENABLE_SAVED;
    case "history":         return ENABLE_HISTORY;
    case "body-edit":       return ENABLE_BODY;
    case "preference-edit": return ENABLE_PREFERENCE;
    case "my-posts":
    case "create-post":     return ENABLE_POSTS;
    case "tryon":           return ENABLE_VISUALIZE;
    default:                return true;
  }
}
