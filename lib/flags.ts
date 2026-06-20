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

// STYLE_SELF_KO_FEEDBACK: feedback 保存成功後、KO 由来の返信(koRequestId 有り)について
//   submit_feedback で KO に評価を best-effort 書き戻す（③-c-5b）。失敗は会話・feedback 保存に影響させない。
//   既定 OFF（"true" のときだけ ON）。OFF（未設定）時は完全に無送信＝退行ゼロ。
//   送信は client.ts の submitFeedback（KNOWLEDGE_OS_URL/KEY 再利用・server 経路）。NEXT_PUBLIC_ 不要。
export const STYLE_SELF_KO_FEEDBACK = process.env.STYLE_SELF_KO_FEEDBACK === "true";

// GENERAL_BRAIN_MODE: 本対話モード（方針C本体・案イ）。分野横断の外部脳としてチャットさせる。
//   既定 OFF。OFF=トグルを出さない＝従来どおりファッション専用（退行ゼロ）。
//   ON のとき UI に「本対話モード」トグルが出て、ON 時は overlay/intent を skip して
//   stylist-chat を intent='general' で直接呼ぶ（fashion 経路は無改修・隔離）。
//   クライアントで参照するため NEXT_PUBLIC_*。本対話の中身が出るには KO 側 KO_SK_CHUNK_CONTEXT=1 が必要。
export const GENERAL_BRAIN_MODE = process.env.NEXT_PUBLIC_GENERAL_BRAIN_MODE === "true";

// STYLE_SELF_QUERY_KNOWLEDGE_CHAT: stylist-chat の KO 連携を get_* 3並列 → query_knowledge 主素材に
//   寄せる（③-c）。query_knowledge を待ち（通常20s/最大25s）、decision_rules/failure_patterns/
//   related_entries を【参考】の主素材に、answer は補助に、getInfluences は併用で温存。失敗/タイムアウトや
//   品質ゲート不合格時は通常回答を出さず安全モード（純粋な確認質問）。応答に koRequestId を載せる。
//   既定 OFF（"true" のときだけ ON）。OFF 時は完全に現状（get_* 3並列・queryKnowledge 不使用・新コード不走行）。
//   stylist-chat は server なので NEXT_PUBLIC_ 不要。実機比較してから採用判断する。
export const STYLE_SELF_QUERY_KNOWLEDGE_CHAT =
  process.env.STYLE_SELF_QUERY_KNOWLEDGE_CHAT === "true";

// ASPIRATION_PHOTO: 「憧れ写真分析」新モード（この雰囲気に近づく）。憧れ写真1枚をアップ→
//   AIが構造分析→ユーザーに合う形に変換して自然に会話する（商品検索なし・分析体験の検証が目的）。
//   既定 OFF。OFF=モードトグルを出さない＝従来チャットのみ（退行ゼロ・additive）。
//   ON のとき UI に「この雰囲気に近づく」トグルが出て、写真選択で /api/ai/aspiration-photo を叩く。
//   診断は消さず変換先の補助データに使う（未診断でも写真分析単体で成立）。client 参照のため NEXT_PUBLIC_*。
export const ASPIRATION_PHOTO = process.env.NEXT_PUBLIC_ASPIRATION_PHOTO === "true";

// STYLE_SIGNALS: 世界観育成 Phase A。憧れ写真分析のたびに事実属性（色/シルエット/ジャンル候補/年代/ムード）を
//   style_signals テーブルへ保存する（裏で蓄積・Phase B で集計→/self に可視化）。既定 OFF（"true" でON）。
//   保存は server 側完結のため NEXT_PUBLIC_ 不要。OFF時は保存しない＝見た目もDBも変化ゼロ（退行ゼロ）。
export const STYLE_SIGNALS = process.env.STYLE_SIGNALS === "true";

// TEMPORARY_CHAT_MODE: 一時チャット（ChatGPT同等のまっさらモード）。ONのとき UI に「一時チャット」トグルが出て、
//   ON 中は (a)会話をDB保存しない+localStorageにも残さない (b)style_signals に書かない (c)brand-learn で
//   style_signals/stylePreference を読まず発話のみで facts を作る、の3点で痕跡ゼロ・育成非反映にする。
//   既定 OFF。OFF=トグルを出さない＝従来どおり（退行ゼロ）。temporary=false の経路は一切変えない（隔離）。
//   client 参照のため NEXT_PUBLIC_*。matcher/render/辞書/brand-facts は無改修・DBスキーマ変更なし。
export const TEMPORARY_CHAT_MODE = process.env.NEXT_PUBLIC_TEMPORARY_CHAT_MODE === "true";

// MB_SIGNALS_IN_BRIEF: 複数画像MB分析 Layer3。board brief 生成（analyzeMoodboard）の入力を
//   caption集約のみ → signals(Layer2 決定的集約 repeated/accent)の「主軸/差し」も渡す形にする。
//   1枚に引っ張られた断定/盛りを構造的に減らす（事実集約は決定的・意味づけだけLLM）。
//   既定 OFF（"true" のときだけ ON）。OFF/未設定時は user message に signals セクションを足さない＝
//   従来の analyzeMoodboard 入力・出力形と完全に同一（退行ゼロ）。
//   analyzeMoodboard は API route(server) で動くため NEXT_PUBLIC_ 不要。接続は Step3b。
export const MB_SIGNALS_IN_BRIEF = process.env.MB_SIGNALS_IN_BRIEF === "true";

// AUTOSAVE_THREAD: チャット履歴 ChatGPT 型 第1段。普通に喋るだけの会話（currentThreadId=null）が
//   thread 化されず localStorage 揮発 → リロード/復帰で消える問題を直す。ON 時のみ、1通目の
//   ユーザー送信が成功した直後に thread を作成し ?thread=id を URL に載せる（以降は既存 persist 配線が
//   そのまま発火 → 自動DB保存・URL が残るのでリロード復元も同時に直る）。
//   既定 OFF。OFF/未設定時は currentThreadId=null のまま＝従来挙動（localStorage 経路）と完全に同一（退行ゼロ）。
//   temporary 中は thread を作らない（一時チャット無改修）。client 参照のため NEXT_PUBLIC_*。
export const AUTOSAVE_THREAD = process.env.NEXT_PUBLIC_AUTOSAVE_THREAD === "true";

// STYLE_MATCH: Style Match Result(理想写真→「買える言葉」→すぐ探せる)の新体験。第1段=新ボタン
//   「理想写真を分析する」+ 新カード骨格(①写真一覧 ②抽出タグ=signals core/repeated から決定的)。
//   解析は既存 /api/ai/photos-structure を流用(新バックエンドなし)・ephemeral(DB/localStorage非保存)。
//   既定 OFF。OFF/未設定時は新ボタンを出さない=完全現状維持(回帰ゼロ)。既存の📎写真/📷構造は無改修。
//   ③買う条件/④検索ワード(LLM整形)/⑤外部検索ボタンは第2段以降。client 参照のため NEXT_PUBLIC_*。
export const STYLE_MATCH = process.env.NEXT_PUBLIC_STYLE_MATCH === "true";

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
