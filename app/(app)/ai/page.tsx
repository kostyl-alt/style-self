"use client";

// P1-C-1: チャット主役型 メイン画面 /ai(ChatPage 器化)
//
// 設計: docs/STYLE-SELF_D1_実装設計.md(4fdbab1)Phase 1 P1-C
// 調査: docs/STYLE-SELF_D1_P1-C設計調査.md(b739bd9)P1-C-1
//
// 【P1-C-1 スコープ】
// OverlayModal.tsx(D1-2b' 483cef4)の対話ロジックを ChatPage に transfer:
//   ・型(Message / MessageContent)・state(text / loading / messages)・
//     handler(handleSubmit / executeNavigate)・ヘルパ(newMessageId /
//     trimByMax / replaceMessage)・吹き出し(Bubble / AssistantContent / EmptyHistoryHint)・
//     ★ D1-2a 5 サブ(ResultView / NavigateConfirm / NoneNotice / SuggestionList /
//     ApiHybridPlaceholder)+ KeyVal を ★シグネチャ・実装本体ともに無変更★ で transfer。
//   ・モーダル枠(fixed inset-0 z-50 bg-black/50 / max-w-md / max-h-[90vh] / ×ボタン /
//     onClose / 外側クリック閉じる)を廃し、min-h-screen の常時表示メイン画面に置換。
//   ・/api/overlay/intent(D1-1)の呼び方は完全に同じ(body/headers 不変)。
//
// 【P1-C-1 スコープ外】
//   ・layout の BottomNav / OverlayFab 削除 → P1-C-2
//   ・MenuDrawer + [≡] ボタン → P1-C-3
//   ・チャットコマンド動作確認 + 到達マップ点検 → P1-C-4
//   ・世界観カード / 提案チップ 5 / 入力欄近接 4 ボタン → P1-D
//   ・対話完結 8 結果カード化 → P1-E
//   ・virtual→product 連鎖 / 次アクション 3 ボタン → P1-F
//
// 【プライバシー(設計書 4.4 不可侵境界線)】
//   ・既存 DB 直接触らず・/api/overlay/intent 経由のみ
//   ・既存 18 機能 API / D1 資産(navigate-map / intent / 5 サブ実装本体)完全不変
//   ・worldview_tags 英語スラッグを UI に露出しない(M4 同型・5 サブ転用で維持)
//   ・既存画面(/home /discover /outfit /self /saved /onboarding /u /p)0 変更
//   ・③ プライバシー専章 / コスト管理 / Phase 2 後ゲートに干渉しない

import { useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { resolveNavigateTarget } from "@/lib/overlay/navigate-map";
import ThreadsSidebar from "@/components/chat/ThreadsSidebar";
import { useThreadMessages, type PersistableMessage } from "@/lib/hooks/use-thread-messages";
import { migrateLocalstorageIfNeeded } from "@/lib/utils/migrate-localstorage";
import { PRODUCTS_ENABLED, ENABLE_VISUALIZE, ENABLE_CLOSET, isNavIntentVisible, MB_CONTEXT_OBJECT, FEEDBACK_LOOP } from "@/lib/flags";
import CoordinateReplyCard from "@/components/chat/CoordinateReplyCard";
import type { CoordinateReply } from "@/types/coordinate-reply";
import ProductCardList from "@/components/chat/ProductCardList";
import SearchProductsButton from "@/components/chat/SearchProductsButton";
import type { ProductCandidate, CandidatesResponse } from "@/types/product-candidate";
import MenuDrawer from "@/components/chat/MenuDrawer";
import WorldviewCard from "@/components/chat/WorldviewCard";
import SuggestionChips from "@/components/chat/SuggestionChips";
import InputAttachments from "@/components/chat/InputAttachments";
import ClosetPickerModal from "@/components/chat/ClosetPickerModal";
import MoodboardPickerModal from "@/components/chat/MoodboardPickerModal";
import { buildMoodboardPrompt, MB_PROMPT_SIGNATURE } from "@/lib/prompts/moodboard-prompt";
import type { MoodboardWithItems } from "@/types/moodboard";
import type { BodyProfile } from "@/types/index";

interface SuggestionItem {
  intent: string;
  label:  string;
}

interface IntentResponse {
  ok:           boolean;
  intent?:      string;
  mode?:        string;
  params?:      Record<string, unknown>;
  confidence?:  number;
  suggestions?: SuggestionItem[];
  reason?:      "auth_required" | "empty_input";
}

// D1-2a: confidence の閾値(これ未満なら suggestions を提示)
const CONFIDENCE_THRESHOLD = 0.7;

// D1-2b': 履歴肥大防止
const MAX_MESSAGES = 30;

// P1-C-1.5b-i+: 履歴永続化(localStorage)
// 本体判断 4 解釈更新: 「履歴セッション内のみ(揮発)」→「ローカル端末のセッション永続」
// 同端末同ブラウザ内で復元・他デバイス同期は将来 DB 化で対応(Phase2 以降)。
// v1 サフィックスは将来 Message 型変更時のスキーマ migration 用。
const STORAGE_KEY = "style-self:ai:messages:v1";

// D1-2b': メッセージ型(設計案 B2.2)
// P1-C-1.5a 追加: kind:"reply"(会話 AI スタイリスト・自然文 + 補助 actions)
type MessageContent =
  | { kind: "text";          text: string }                       // user 入力 or 簡素な assistant 応答
  | { kind: "intent-result"; result: IntentResponse }             // /api/overlay/intent のレスポンス(MVP-1 範囲外 intent 用)
  | { kind: "reply";         text: string; actions?: SuggestionItem[]; sessionIntent?: string; moodboardId?: string; editorScore?: EditorScorePayload }  // /api/ai/stylist-chat の自然文応答(P1-C-1.5a・sessionIntent は会話継続性のため・L3 / C-2a: moodboardId / C-2c-1: editorScore で E-0c 凡庸脱却の判定スコアを保持)
  | { kind: "coordinate_v2"; coordinate: CoordinateReply; actions?: SuggestionItem[]; sessionIntent?: string; moodboardId?: string; editorScore?: EditorScorePayload }  // ★ H-4b1-b-1: 構造化コーデ応答(暫定 pre 表示・表示順7 component は H-4b1-b-2)
  | { kind: "products"; candidates: ProductCandidate[]; queriesUsed: string[]; moodboardId: string; loading?: boolean; error?: string | null }  // ★ G-2b 案D: 実商品候補(coordinate_v2 と別メッセージで関心分離・/api/products/candidates 結果)
  | { kind: "loading";       mbCoordinate?: boolean }              // 「考えています…」/ C-2c-1: MB は段階表示
  | { kind: "error";         message: string };                   // 通信 / API エラー

// P1-C-1.5a / 1.5b-i / MVP-1c / A-6 / A-6b: 段階B 対象 intent(A-6b は 5 intent)
// ★ ここに無い intent は従来通り intent-result(NavigateConfirm 等)で表示する。
// ★ API 側 `app/api/ai/stylist-chat/route.ts` の同名 Set と完全一致させる(両側同期)
// ★ L4-A 切替検出は 1.5b-ii で投入済(SWITCH_THRESHOLD=0.85・別 target 高信頼で新セッション切替・A-6b で 5 intent 五角に自動拡張)
const STYLIST_CHAT_INTENTS = new Set<string>(["diagnose", "closet", "coordinate", "style-consult", "brand-learn"]);

// P1-C-1.5a: 会話 AI 応答の API レスポンス型(/api/ai/stylist-chat と同形)
// ★ C-2c-1: MB 経由 coordinate のみ editorScore が付く(エディタ AI 評価結果)
interface EditorScorePayload {
  scores: {
    novelty: number; rarity: number; mb_translation: number; daily_use: number;
    photogenic: number; post_worthy: number; searchable: number; personal: number;
    whitespace: number; signature_anomaly: number;
  };
  total: number;
  checks: Record<string, "ok" | "ng">;
  verdict: "pass" | "compromise" | "fail";
  reasonShort: string;
  improvementHints: string;
  attempts: 1 | 2;
}
interface StylistChatResponse {
  ok:           boolean;
  reply?:       string;
  coordinate?:  CoordinateReply;   // ★ H-4b1-b-1: 構造化コーデ応答(parse 成功時のみ・失敗時は reply)
  actions?:     SuggestionItem[];
  reason?:      "auth_required" | "empty_input" | "intent_out_of_scope";
  error?:       string;
  editorScore?: EditorScorePayload;
  koRequestId?: string | null;  // ③-c-3: query_knowledge 使用の突合キー（フラグON・非MB時のみ・null可）
}

// P1-C-1.5a: 段階B に渡す history(直近 N=3・本体 7.4 抑制策)
const STYLIST_CHAT_HISTORY_MAX = 3;
// P1-C-1.5b-ii L4-A: 切替検出の信頼度しきい値(保守設定・1.5a 実測 75% 誤判定例を踏まえ)
const SWITCH_THRESHOLD = 0.85;

interface Message {
  id:        string;
  role:      "user" | "assistant";
  content:   MessageContent;
  createdAt: number;
}

function newMessageId(): string {
  // crypto.randomUUID は dev/prod とも利用可(Next.js)
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// ====================================================================
// ChatPage(P1-C-1: OverlayModal を常時表示メイン画面に発展させたもの)
// モーダル枠 / onClose / 外側クリック閉じる は廃止。
// 中身(state / handler / Bubble / 5 サブ)は D1-2b' から シグネチャ無変更で transfer。
// ====================================================================
function ChatPageInner() {
  const router = useRouter();
  // ★ H-3: 左ペイン スレッド選択状態は URL クエリ ?thread=id 由来(リロード耐性・共有可)。
  //   中央チャットへの messages ロード接続は H-4(本 H-3 は選択状態 + URL 更新まで)。
  const searchParams = useSearchParams();
  const currentThreadId = searchParams.get("thread");
  function handleSelectThread(id: string | null) {
    router.push(id ? `/ai?thread=${id}` : "/ai");
  }
  // ★ H-4a: thread の messages ロード/永続化サービス(messages の単一真実源は下記 messages state)
  const threadMessages = useThreadMessages();

  const [text, setText]         = useState("");
  const [loading, setLoading]   = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  // P1-C-3: 右上メニュー [≡] Drawer の開閉
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  // A-5: クローゼットピッカーモーダルの開閉
  const [isClosetOpen, setIsClosetOpen] = useState(false);
  // ★ Sprint C-2 段階3-D/E: MoodboardPickerModal 開閉
  const [isMbOpen, setIsMbOpen] = useState(false);

  // ★ 統合 Sprint: 世界観フィッティング軸の体型プロフィール(MB → coordinate に注入)。
  // 未登録ユーザーは null のまま → buildMoodboardPrompt は ★ 既存出力と完全互換。
  const [bodyProfile, setBodyProfile] = useState<BodyProfile | null>(null);
  useEffect(() => {
    fetch("/api/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { bodyProfile: BodyProfile | null } | null) => {
        if (data?.bodyProfile) setBodyProfile(data.bodyProfile);
      })
      .catch(() => { /* 未認証/エラー時は体型なし扱い(既存挙動) */ });
  }, []);

  // ★ C-2a: 直近で MB ピッカー/MB 詳細ページから渡された moodboard id を保持。
  //   coordinate reply に moodboardId を付与し、Bubble 内「ビジュアルで見る」ボタンが
  //   /api/tryon/generate に渡せるようにする。
  const [lastMoodboardId, setLastMoodboardId] = useState<string | null>(null);

  // ★ Phase 2: MB context object 経路の添付状態（添付中は coordinate を analysis 駆動で短文応答）。
  const [attachedMb, setAttachedMb] = useState<{ id: string; name: string } | null>(null);
  const [mbAnalyzing, setMbAnalyzing] = useState(false);
  const analysisPromiseRef = useRef<Promise<void> | null>(null);

  // MB 添付時に moodboard_analysis を遅延自動生成（無ければ生成）。送信前に await される。
  function ensureMbAnalysis(id: string) {
    if (!MB_CONTEXT_OBJECT) return;
    setMbAnalyzing(true);
    const p = (async () => {
      try {
        const res = await fetch(`/api/moodboards/${id}/analyze`);
        const data = res.ok ? (await res.json()) as { analysis: unknown } : null;
        if (!data?.analysis) {
          await fetch(`/api/moodboards/${id}/analyze`, { method: "POST" });
        }
      } catch {
        // 失敗時はサーバ側フォールバック（通常 coordinate）に委ねる
      } finally {
        setMbAnalyzing(false);
      }
    })();
    analysisPromiseRef.current = p;
  }

  function attachMoodboard(id: string, name: string) {
    setAttachedMb({ id, name });
    setLastMoodboardId(id);
    ensureMbAnalysis(id);
  }

  // 末端 ref(自動スクロール用)
  const endRef = useRef<HTMLDivElement>(null);

  // P1-C-1.5b-i+ fix v2: hydrate 完了フラグ(useState 化で再render 経由・persist の stale [] 上書き race を防止)
  const [hydrated, setHydrated] = useState(false);

  // P1-C-1.5b-i+: 履歴永続化 hydrate(初回 mount 時 localStorage から復元)
  // SSR セーフ: useEffect 内のみで localStorage 参照・初期 state は [] で SSR と一致。
  // ★ H-4a: thread 選択中(?thread=id)は DB messages が真実源 → localStorage hydrate を skip。
  useEffect(() => {
    if (currentThreadId) { setHydrated(true); return; }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) setMessages(parsed as Message[]);
      }
    } catch { /* corrupt JSON 等は無視(空配列のまま続行) */ }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ★ H-4a: thread 選択(?thread=id)で DB から messages をロード(単一真実源 = messages state)。
  //   currentThreadId が null の間は既存 localStorage 経路を維持(段階的移行)。
  //   ★ H-4a fix: 切替時に即クリア(前 thread/localStorage の残留を消す)→ load 後に注入。
  //     依存は ★ 安定な loadMessages(useCallback[])のみ。threadMessages オブジェクト全体を
  //     deps に入れると毎レンダー新参照 → effect 連続再実行 + cleanup が in-flight load を
  //     キャンセルし続け、空 thread で setMessages([]) が届かず中央が前の表示のまま残るバグになる。
  const loadThreadMessages = threadMessages.loadMessages;
  useEffect(() => {
    if (!currentThreadId) return;
    let cancelled = false;
    setMessages([]);  // ★ 即クリア(load 完了前から中央を空にし、前 thread の残留を断つ)
    void loadThreadMessages(currentThreadId).then((loaded) => {
      // rowToMessage が原 Message を忠実復元(content は kind 判別共用体)→ 境界で cast。
      if (!cancelled) setMessages(loaded as unknown as Message[]);
    });
    return () => { cancelled = true; };
  }, [currentThreadId, loadThreadMessages]);

  // P1-C-1.5b-i+: 履歴永続化 persist(messages 変更で書き出し)
  // MAX_MESSAGES=30 で trimByMax により既に上限ありなので quota 安全。
  // ★ hydrate 完了前は実行しない(stale closure messages=[] で保存済みデータを
  //   "[]" で上書きする race を防止・真因切り分け済 2026-05-21)
  useEffect(() => {
    if (!hydrated) return;
    // ★ H-4a: thread 選択中は DB が永続先 → localStorage には書かない(DB thread を上書きしない)
    if (currentThreadId) return;
    // ★ 空配列で上書きしない(多層防御・将来クリア機能の地雷予防)
    if (messages.length === 0) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch { /* quota 超過等は無視(永続化失敗してもセッション内は動く) */ }
  }, [messages, hydrated, currentThreadId]);

  // メッセージ追加で末端へ自動スクロール
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  // ★ H-4a: 初回マウント時に localStorage 履歴を DB thread へ自動移行(冪等・案A)。
  //   ★ 移行後は遷移しない(ユーザーが意図的に開いたわけではない)→ 左ペインに「過去の会話」が出現するのみ。
  //   既存 localStorage 本体は残すため、移行直後も currentThreadId=null の中央表示は従来どおり。
  useEffect(() => {
    void migrateLocalstorageIfNeeded({
      createThread: async (title) => {
        try {
          const res = await fetch("/api/threads", {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ title }),
          });
          const data = await res.json() as { thread?: { id: string } };
          return data.thread ?? null;
        } catch { return null; }
      },
      saveMessages: async (threadId, msgs) => {
        // 既存 messages POST は単発 → 数件を順次 INSERT(時系列維持)。
        for (const m of msgs) {
          const msg = m as PersistableMessage;
          const c = msg.content as { kind?: string; text?: string } | undefined;
          const displayText = (c?.kind === "text" || c?.kind === "reply") && typeof c.text === "string"
            ? c.text : "(過去のメッセージ)";
          if (msg.role !== "user" && msg.role !== "assistant") continue;
          await threadMessages.persistMessage(threadId, msg, displayText);
        }
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ★ Sprint C-3: 撮影前 CTA(/moodboard/[id])からの遷移 = sessionStorage 経由 で MB prompt 受け取り
  //   URL param 長さ制限(2048 文字)回避・同一タブ内のみ・受け取り後即削除で再挿入防止
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mbId   = sessionStorage.getItem("mb_id");
    const mbName = sessionStorage.getItem("mb_name");

    if (MB_CONTEXT_OBJECT && mbId !== null && mbId !== "") {
      // ★ Phase 2: MB 詳細「チャットに渡す」→ 長文は使わず添付して analysis 準備。
      attachMoodboard(mbId, mbName && mbName !== "" ? mbName : "ムードボード");
      sessionStorage.removeItem("mb_id");
      sessionStorage.removeItem("mb_name");
      sessionStorage.removeItem("mb_prompt");
      return;
    }

    // 旧経路（フラグ off）: 長文 prompt を textarea に流し込む。
    const mbPrompt = sessionStorage.getItem("mb_prompt");
    if (mbPrompt !== null && mbPrompt !== "") {
      setText((cur) => (cur ? `${cur}\n\n${mbPrompt}` : mbPrompt));
      sessionStorage.removeItem("mb_prompt");
    }
    if (mbId !== null && mbId !== "") {
      setLastMoodboardId(mbId);
      sessionStorage.removeItem("mb_id");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ★ G-2b: 「商品を探す」→ /api/products/candidates → products メッセージ(案D: coordinate_v2 と別メッセージ)。
  //   handleSubmit は ★ 不変。loading メッセージ append → API → replaceMessage(結果/エラー)→ DB 永続化(H-4a)。
  async function handleSearchProducts(moodboardId: string) {
    const loadingId = newMessageId();
    const loadingMsg: Message = {
      id:        loadingId,
      role:      "assistant",
      content:   { kind: "products", candidates: [], queriesUsed: [], moodboardId, loading: true },
      createdAt: Date.now(),
    };
    setMessages((prev) => trimByMax([...prev, loadingMsg]));
    try {
      const res = await fetch("/api/products/candidates", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ moodboardId }),
      });
      const data = await res.json() as CandidatesResponse & { error?: string };
      if (!res.ok) {
        replaceMessage(setMessages, loadingId, {
          kind: "products", candidates: [], queriesUsed: [], moodboardId,
          loading: false, error: data.error ?? `HTTP ${res.status}`,
        });
        return;
      }
      const resultContent = {
        kind:        "products" as const,
        candidates:  data.candidates ?? [],
        queriesUsed: data.queriesUsed ?? [],
        moodboardId,
      };
      replaceMessage(setMessages, loadingId, resultContent);
      // ★ H-4a: thread 選択中は products メッセージも DB 永続化(metadata.message で忠実復元)
      if (currentThreadId) {
        void threadMessages.persistMessage(
          currentThreadId,
          { id: loadingId, role: "assistant", content: resultContent, createdAt: Date.now() } as unknown as PersistableMessage,
          `${resultContent.candidates.length}件の商品候補`,
        );
      }
    } catch (err) {
      replaceMessage(setMessages, loadingId, {
        kind: "products", candidates: [], queriesUsed: [], moodboardId,
        loading: false, error: err instanceof Error ? err.message : "通信エラー",
      });
    }
  }

  async function handleSubmit(e?: React.FormEvent, explicitText?: string) {
    e?.preventDefault();
    const trimmed = (explicitText ?? text).trim();
    if (!trimmed || loading) return;

    // ★ Phase 2: MB 添付中（フラグ ON）は coordinate を analysis 駆動の短文応答で返す。
    const isMbContextSend = MB_CONTEXT_OBJECT && attachedMb !== null;

    // 1) user メッセージ append
    const userMsg: Message = {
      id:        newMessageId(),
      role:      "user",
      content:   { kind: "text", text: trimmed },
      createdAt: Date.now(),
    };
    // 2) loading メッセージ append(後で置換)
    // ★ C-2c-1: MB 経由は段階 A skip(案 F)+ エディタ AI(N=1 max)で 60-90 秒かかる可能性 →
    //   ローディング表示に段階を併記(UX-B MVP・SSE は C-2c-2 で対応)。
    const loadingId = newMessageId();
    const isMbCoordinatePreview = trimmed.startsWith(MB_PROMPT_SIGNATURE);
    const loadingMsg: Message = {
      id:        loadingId,
      role:      "assistant",
      content:   { kind: "loading", mbCoordinate: isMbCoordinatePreview || isMbContextSend },
      createdAt: Date.now(),
    };

    setMessages((prev) => trimByMax([...prev, userMsg, loadingMsg]));
    if (explicitText === undefined) setText("");  // 入力欄クリア(連続発話可能に・quickAction は維持)
    setLoading(true);

    // ★ Phase 2: MB 添付直後で解析がまだ走っていれば完了を待つ（遅延自動生成）。
    if (isMbContextSend && analysisPromiseRef.current) {
      try { await analysisPromiseRef.current; } catch { /* 失敗時はサーバ側フォールバック */ }
    }

    // ★ H-4a: thread 選択中は user メッセージを DB 永続化(currentThreadId=null 時は既存挙動のまま)
    if (currentThreadId) {
      void threadMessages.persistMessage(currentThreadId, userMsg as unknown as PersistableMessage, trimmed);
    }

    try {
      // ★ ★ ★ 案 F(統合 Sprint hotfix v2): MB prompt 経由は段階 A(Haiku/overlay-intent)を skip。
      //   buildMoodboardPrompt が出力する固定 signature を冒頭一致で検出し、
      //   intent="coordinate" を client side で直接確定する(★ Haiku を呼ばない =
      //   JSON parse 失敗が ★ 構造的に起きない)。
      //   他経路(MVP-1c 直接コーデ依頼 / 5 intent / 通常会話)は ★ 既存通り段階 A 経由(完全不変)。
      //   ★ Phase 2: MB 添付（context object 経路）も同様に段階 A を skip して coordinate 確定。
      const isMbCoordinate = isMbCoordinatePreview || isMbContextSend;

      let data: IntentResponse & { error?: string };
      if (isMbCoordinate) {
        data = {
          ok:          true,
          intent:      "coordinate",
          mode:        "api",
          params:      {},
          confidence:  1,
          suggestions: [],
        };
      } else {
        // ★ D1-1 /api/overlay/intent の呼び方は完全に同じ(body/headers 不変)
        const res = await fetch("/api/overlay/intent", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ text: trimmed }),
        });
        data = await res.json() as IntentResponse & { error?: string };

        if (!res.ok) {
          replaceMessage(setMessages, loadingId, {
            kind: "error", message: data.error ?? `HTTP ${res.status}`,
          });
          return;
        }
      }

      // ★ P1-C-1.5a 会話連続性(L1 並列案 / L3 sessionIntent / L4 切替検出なし):
      //   - 直前の assistant reply に sessionIntent があれば会話継続中
      //   - 段階A `/api/overlay/intent` は ★常に呼ぶ★(L1 並列案・将来 1.5b の話題切替検出ログ用)
      //   - 継続中は段階A 結果を破棄して段階B 直行(MVP-1a は切替検出しない・L4 案C)
      //   - 新規セッション時は従来通り段階A の intent 判定で分岐
      const sessionIntent = getSessionIntent(messages);
      const isContinuingSession =
        sessionIntent !== null && STYLIST_CHAT_INTENTS.has(sessionIntent);
      // P1-C-1.5b-ii L4-A: 会話継続中に高信頼別 target intent が来たら新セッション切替(L3 対象外 intent は継続維持)
      const isSwitchToOtherTarget =
        isContinuingSession
        && typeof data.intent === "string"
        && STYLIST_CHAT_INTENTS.has(data.intent)
        && data.intent !== sessionIntent
        && (data.confidence ?? 0) >= SWITCH_THRESHOLD;
      const effectiveContinuing = isContinuingSession && !isSwitchToOtherTarget;

      // intent が会話AIスタイリスト対象(MVP-1 は diagnose のみ)なら
      // /api/ai/stylist-chat を呼んで自然文 reply に置換する。
      // それ以外の intent は ★1 文字も変えず★ 従来通り intent-result(NavigateConfirm 等)で表示。
      const isStylistTarget = effectiveContinuing || (
        data.ok
        && data.reason === undefined
        && typeof data.intent === "string"
        && STYLIST_CHAT_INTENTS.has(data.intent)
      );

      if (isStylistTarget) {
        // 継続セッション時は sessionIntent を、新規時は段階A 判定 intent を API に渡す。
        // sessionIntent は MVP-1a では常に "diagnose"・API 側 STYLIST_CHAT_INTENTS にも含まれる。
        const intentToSend = effectiveContinuing ? sessionIntent! : (data.intent as string);
        // 直近 N=3 履歴を組立(client 側で slice・本体 7.4 抑制策の一段目)
        const recentHistory = isSwitchToOtherTarget ? [] : buildStylistHistory(messages);
        try {
          const replyRes = await fetch("/api/ai/stylist-chat", {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({
              text:    trimmed,
              intent:  intentToSend,
              history: recentHistory,
              // ★ Phase 2: MB 添付中は moodboardId を送り、サーバが moodboard_analysis を読んで短文応答。
              moodboardId: isMbContextSend ? attachedMb!.id : undefined,
            }),
          });
          const replyData = await replyRes.json() as StylistChatResponse;

          if (!replyRes.ok) {
            // 段階B 失敗時は ★既存 intent-result(NavigateConfirm) にフォールバック★
            // (P1-C-1 挙動退行ゼロ・ユーザーは少なくとも遷移ボタンで diagnose に到達できる)
            console.warn("[stylist-chat] failed, falling back to intent-result");
            replaceMessage(setMessages, loadingId, { kind: "intent-result", result: data });
            return;
          }
          // 段階B が reason を返した / reply も coordinate も無い場合は従来挙動にフォールバック
          // ★ H-4b1-b-1: coordinate(構造化)応答は reply を持たないため coordinate の有無も条件に含める
          if (replyData.reason || (!replyData.reply && !replyData.coordinate)) {
            replaceMessage(setMessages, loadingId, { kind: "intent-result", result: data });
            return;
          }
          // 成功: reply 置換 + sessionIntent 保持(L3)+ MB 経由は moodboardId / editorScore 付与
          // ★ H-4b1-b-1: coordinate(構造化 JSON)応答は coordinate_v2、それ以外は従来 reply(text)
          const replyContent = replyData.coordinate
            ? {
                kind:          "coordinate_v2" as const,
                coordinate:    replyData.coordinate,
                actions:       replyData.actions,
                sessionIntent: intentToSend,
                moodboardId:   isMbCoordinate ? lastMoodboardId ?? undefined : undefined,
                editorScore:   replyData.editorScore,
              }
            : {
                kind:          "reply" as const,
                text:          replyData.reply!,
                actions:       replyData.actions,
                sessionIntent: intentToSend,
                moodboardId:   isMbCoordinate ? lastMoodboardId ?? undefined : undefined,
                editorScore:   replyData.editorScore,
              };
          replaceMessage(setMessages, loadingId, replyContent);
          // ★ H-4a: thread 選択中は assistant 応答も DB 永続化(metadata に原 Message 保持)
          if (currentThreadId) {
            const displayText = replyData.coordinate
              ? (replyData.coordinate.summary || replyData.coordinate.direction || "(コーデ提案)")
              : replyData.reply!;
            void threadMessages.persistMessage(
              currentThreadId,
              { id: loadingId, role: "assistant", content: replyContent, createdAt: Date.now() } as unknown as PersistableMessage,
              displayText,
              replyData.koRequestId, // ③-c-3: query_knowledge 使用の request_id を永続化（null時は従来どおり）
            );
          }
        } catch (err) {
          // 通信エラーも intent-result フォールバック(退行ゼロ)
          console.warn("[stylist-chat] error, falling back:", err);
          replaceMessage(setMessages, loadingId, { kind: "intent-result", result: data });
        }
        return;
      }

      // MVP-1 範囲外 intent: 従来通り intent-result(P1-C-1 挙動・1 文字も変えず)
      replaceMessage(setMessages, loadingId, { kind: "intent-result", result: data });
    } catch (err) {
      replaceMessage(setMessages, loadingId, {
        kind: "error", message: err instanceof Error ? err.message : "通信エラー",
      });
    } finally {
      setLoading(false);
    }
  }

  // D1-2a: navigate 実行(P1-C-1: モーダル制御なし・router.push のみ)
  // 既存画面の認証ガードは middleware appRoutes が裏で守る(未認証なら /login へ)
  function executeNavigate(intent: string) {
    const target = resolveNavigateTarget(intent);
    if (!target) return;
    router.push(target.url);
  }

  // P1-C-3: 新しいチャット(案 A シンプル・race fix v2 案 C 整合)
  // ★ removeItem は persist 経路外で動作・persist effect は messages.length===0 で早期 return
  function handleNewChat() {
    if (messages.length === 0) return;
    if (!confirm("現在の会話履歴を削除して新規セッションを開始しますか?")) return;
    setMessages([]);
    setAttachedMb(null);  // ★ Phase 2: MB 添付も解除
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }

  // ★ Phase 3: 評価フィードバック（好き/違う/保存）。会話は流さず裏で記録し、judgment_rules 抽出を起動。
  //   案B: ephemeral（thread 未作成）時はその場で thread を作り、現在の会話を永続化してから feedback 保存。
  //   message_id は使わず content に提案の核を同梱（DB id マッピング回避）。best-effort・失敗は握りつぶし。
  async function submitFeedback(kind: "like" | "dislike" | "save", reason?: string) {
    if (!FEEDBACK_LOOP) return;
    try {
      let tid = currentThreadId;
      if (!tid) {
        const firstUser = messages.find((m) => m.role === "user" && m.content.kind === "text");
        const title = firstUser && firstUser.content.kind === "text"
          ? firstUser.content.text.slice(0, 40)
          : "コーデ相談";
        const res = await fetch("/api/threads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title }),
        });
        if (!res.ok) return;
        const data = await res.json() as { thread?: { id: string } };
        tid = data.thread?.id ?? null;
        if (!tid) return;
        // 現在の会話を新 thread へ永続化（best-effort・永続化可能な kind のみ）。
        for (const m of messages) {
          const dt = feedbackDisplayText(m.content);
          if (dt === null) continue;
          await threadMessages.persistMessage(tid, m as unknown as PersistableMessage, dt);
        }
        router.replace(`/ai?thread=${tid}`);
      }
      await fetch(`/api/threads/${tid}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, content: reason ?? "" }),
      });
    } catch {
      // best-effort: 失敗しても会話・既存挙動は不変
    }
  }

  return (
    // ★ H-3: 2 ペイン化(左: スレッド履歴 / 中央: 既存チャットを ★ 中身ゼロ変更で内包)。
    //   左ペインは /ai/page.tsx 内で完結((app)/layout.tsx は最小 pass-through)。
    <div className="flex">
      <ThreadsSidebar
        currentThreadId={currentThreadId}
        onSelectThread={handleSelectThread}
      />
      <div className="flex-1 min-w-0">
    {/* ★ P1-C-1: 常時表示メイン画面構造(min-h-screen + flex-col の 3 段)。
              (app)/layout.tsx の pb-20(BottomNav 分の余白)は P1-C-1 では残置・
              BottomNav / OverlayFab 廃止は P1-C-2 で実施(C-1 では二重化を許容)。
        ★ H-3: 以下の <div> 〜 </div> は既存 1051 行を ★ 中身ゼロ変更でそのまま内包 */}
    <div className="min-h-screen bg-white flex flex-col">
      {/* ヘッダ(P1-C-3: 右上 [≡] メニュー追加済・案 A 補助機能集約点)*/}
      <header className="px-5 pt-5 pb-3 border-b border-gray-100 flex items-start justify-between">
        <div>
          <p className="text-xs tracking-widest text-gray-400 uppercase">STYLE-SELF AI</p>
          <h1 className="text-lg font-light text-gray-900 mt-0.5">何を相談しますか?</h1>
        </div>
        <button
          type="button"
          onClick={() => setIsMenuOpen(true)}
          aria-label="メニューを開く"
          className="text-gray-500 hover:text-gray-800 text-2xl leading-none px-2 py-1 -mr-2"
        >
          ≡
        </button>
      </header>

      {/* A-5 P1-D: 上部世界観カード(診断済表示・未診断 CTA・loading skeleton) */}
      <WorldviewCard />

      {/* 履歴エリア(スクロール) */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {messages.length === 0 ? (
          // A-5 P1-D: 提案チップ 5(5 intent 各 1 つ・textarea 挿入動作)
          <SuggestionChips onSelect={(t) => setText(t)} />
        ) : (
          <>
            {messages.map((m) => (
              <Bubble key={m.id} msg={m} onNavigate={executeNavigate} onSearchProducts={handleSearchProducts} onSendPrompt={(p) => handleSubmit(undefined, p)} onFeedback={submitFeedback} />
            ))}
            <div ref={endRef} />
          </>
        )}
      </div>

      {/* 下部固定入力(D1-2b' と同等・連続発話可能) */}
      <form onSubmit={handleSubmit} className="border-t border-gray-100 px-5 py-3 space-y-2 bg-white">
        {/* ★ Phase 2: MB 添付チップ（添付中はコーデを analysis 駆動の短文応答で返す）*/}
        {MB_CONTEXT_OBJECT && attachedMb && (
          <div className="flex items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full">
              🎨 {attachedMb.name}
              {mbAnalyzing && <span className="text-gray-400">（解析中…）</span>}
              <button
                type="button"
                onClick={() => setAttachedMb(null)}
                aria-label="ムードボードの添付を解除"
                className="text-gray-400 hover:text-gray-700 leading-none"
              >
                ×
              </button>
            </span>
          </div>
        )}
        {/* A-5 P1-D: 入力欄近接 4 ボタン(写真 / URL / クローゼット / MB) */}
        <InputAttachments
          onClosetOpen={() => setIsClosetOpen(true)}
          onMbOpen={() => setIsMbOpen(true)}
        />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="例: 黒系の服が好きで似た人を探したい"
          rows={2}
          autoFocus
          disabled={loading}
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:border-gray-400 resize-none disabled:bg-gray-50"
          onKeyDown={(e) => {
            // Cmd/Ctrl + Enter で送信(任意)
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              handleSubmit(e as unknown as React.FormEvent);
            }
          }}
        />
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading || !text.trim()}
            className="px-5 py-2 bg-gray-800 text-white rounded-xl text-sm hover:bg-gray-700 disabled:opacity-40 transition-colors"
          >
            {loading ? "判定中…" : "送信 →"}
          </button>
        </div>
      </form>

      {/* P1-C-3: 右上メニュー [≡] Drawer(navigate 7 + 新しいチャット + placeholder 2)*/}
      <MenuDrawer
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        onNewChat={handleNewChat}
      />

      {/* A-5 P1-D: クローゼットピッカーモーダル(GET /api/wardrobe + 選択 → textarea 挿入)
            SIMPLE_MODE では👕添付導線ごと非表示(ENABLE_CLOSET=false でマウントしない) */}
      {ENABLE_CLOSET && (
        <ClosetPickerModal
          isOpen={isClosetOpen}
          onClose={() => setIsClosetOpen(false)}
          onPick={(insertText) => setText((cur) => cur ? `${cur} ${insertText}` : insertText)}
        />
      )}

      {/* ★ Sprint C-2 段階3-D + Sprint C-3: ムードボードピッカーモーダル(MB content prompt 注入)
            選択時に GET /api/moodboards/[id] で詳細取得 → buildMoodboardPrompt → textarea 挿入 */}
      <MoodboardPickerModal
        isOpen={isMbOpen}
        onClose={() => setIsMbOpen(false)}
        onPick={(mb: MoodboardWithItems) => {
          if (MB_CONTEXT_OBJECT) {
            // ★ Phase 2: 長文プロンプトを textarea に入れず、MB を添付して analysis を準備。
            attachMoodboard(mb.id, mb.name);
          } else {
            // 旧経路（フラグ off）: buildMoodboardPrompt の長文を textarea に流し込む。
            const prompt = buildMoodboardPrompt(mb, bodyProfile ?? undefined);
            setText((cur) => (cur ? `${cur}\n\n${prompt}` : prompt));
            setLastMoodboardId(mb.id);
          }
        }}
      />
    </div>
      </div>
    </div>
  );
}

// ★ Phase 3: thread 自動作成時の永続化用 displayText（永続化しない kind は null）。
function feedbackDisplayText(content: MessageContent): string | null {
  if (content.kind === "text" || content.kind === "reply") return content.text;
  if (content.kind === "coordinate_v2") {
    return content.coordinate.summary || content.coordinate.direction || "(コーデ提案)";
  }
  return null; // loading / intent-result / error / products は永続化しない
}

// ---- 履歴ヘルパ ----

function trimByMax(msgs: Message[]): Message[] {
  if (msgs.length <= MAX_MESSAGES) return msgs;
  return msgs.slice(msgs.length - MAX_MESSAGES);
}

function replaceMessage(
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>,
  id: string,
  newContent: MessageContent,
): void {
  setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, content: newContent } : m)));
}

// P1-C-1.5a 会話連続性(L3): 直前の assistant reply が保持する sessionIntent を取り出す。
// 末尾から逆順走査し、reply に当たれば sessionIntent を返す。
// reply 以外(user / intent-result / loading / error)に当たった時点でセッション切断 = null。
// 「直前 message が reply かどうか」の判定と取得を 1 つの走査で行う(設計調査 第3章)。
function getSessionIntent(messages: Message[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "assistant") continue;
    // ★ H-4b1-b-1: coordinate_v2 も sessionIntent を持つ(修正ボタンの追従発話で継続維持)
    if (m.content.kind === "reply" || m.content.kind === "coordinate_v2") {
      return m.content.sessionIntent ?? null;
    }
    // intent-result / loading / error が間に挟まったらセッション切断扱い
    return null;
  }
  return null;
}

// P1-C-1.5a: /api/ai/stylist-chat に渡す直近 N=3 履歴を組立てる。
// kind:"text"(user)と kind:"reply"/"intent-result"(assistant)の本文だけ取り出す
// (loading / error / intent-result の構造体は履歴に入れない・自然文だけ)。
// 「★」記号や JSON は混入させず、AI が世界観 / 内部 ID を学習しないようにする。
function buildStylistHistory(messages: Message[]): { role: "user" | "assistant"; text: string }[] {
  const out: { role: "user" | "assistant"; text: string }[] = [];
  for (const m of messages) {
    if (m.role === "user" && m.content.kind === "text") {
      out.push({ role: "user", text: m.content.text });
    } else if (m.role === "assistant" && m.content.kind === "reply") {
      out.push({ role: "assistant", text: m.content.text });
    } else if (m.role === "assistant" && m.content.kind === "coordinate_v2") {
      // ★ H-4b1-b-1: coordinate_v2 は summary を履歴本文に(JSON 全体は渡さない・継続文脈用)
      out.push({ role: "assistant", text: m.content.coordinate.summary });
    }
    // intent-result / loading / error は履歴に入れない(構造化情報・通信状態のため)
  }
  return out.slice(-STYLIST_CHAT_HISTORY_MAX);
}

// ---- 履歴空のヒント ----
// A-5 P1-D で SuggestionChips(5 intent 各 1 つの提案チップ)に置き換え。
// 旧 EmptyHistoryHint(3 例文の静的リスト)は削除。

// ---- 吹き出し(D1-2b' 追加・既存 5 サブをシグネチャ無変更で再利用) ----

function Bubble({
  msg,
  onNavigate,
  onSearchProducts,
  onSendPrompt,
  onFeedback,
}: {
  msg:        Message;
  onNavigate: (intent: string) => void;
  onSearchProducts: (moodboardId: string) => void | Promise<void>;
  onSendPrompt: (prompt: string) => void;
  onFeedback: (kind: "like" | "dislike" | "save", reason?: string) => void;
}) {
  if (msg.role === "user") {
    // user 吹き出し:右寄り
    const text = msg.content.kind === "text" ? msg.content.text : "";
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] bg-gray-800 text-white text-sm rounded-2xl rounded-br-md px-4 py-2 whitespace-pre-wrap break-words">
          {text}
        </div>
      </div>
    );
  }

  // assistant 吹き出し:左寄り
  return (
    <div className="flex justify-start">
      <div className="max-w-[92%] w-full">
        <AssistantContent content={msg.content} onNavigate={onNavigate} onSearchProducts={onSearchProducts} onSendPrompt={onSendPrompt} onFeedback={onFeedback} />
      </div>
    </div>
  );
}

function AssistantContent({
  content,
  onNavigate,
  onSearchProducts,
  onSendPrompt,
  onFeedback,
}: {
  content:    MessageContent;
  onNavigate: (intent: string) => void;
  onSearchProducts: (moodboardId: string) => void | Promise<void>;
  onSendPrompt: (prompt: string) => void;
  onFeedback: (kind: "like" | "dislike" | "save", reason?: string) => void;
}) {
  if (content.kind === "loading") {
    // ★ C-2c-1 UX-B(MVP・固定文言): MB 経由はパイプライン段階を併記
    if (content.mbCoordinate) {
      return (
        <div className="text-xs text-gray-400 px-3 py-2 leading-relaxed">
          考えています…
          <br />
          <span className="text-gray-300">コーデ提案 → 品質評価 → 必要なら再生成(最大 60-90 秒)</span>
        </div>
      );
    }
    return (
      <div className="text-xs text-gray-400 px-3 py-2">考えています…</div>
    );
  }
  if (content.kind === "error") {
    return (
      <div className="border border-rose-200 rounded-2xl rounded-bl-md p-3">
        <p className="text-sm text-rose-700">{content.message}</p>
      </div>
    );
  }
  if (content.kind === "text") {
    return (
      <div className="bg-gray-50 text-gray-900 text-sm rounded-2xl rounded-bl-md px-4 py-2 whitespace-pre-wrap break-words">
        {content.text}
      </div>
    );
  }
  // P1-C-1.5a: 会話 AI スタイリスト 自然文 reply(末尾に補助 actions・最小新規)
  // ★ H-4b1-b-1: 構造化コーデ応答の ★ 暫定レンダ(pre 表示・表示順7 component は H-4b1-b-2 で置換)。
  //   ここで「JSON が出力されている」ことを verify でき、次段で見た目を完成させる。
  if (content.kind === "coordinate_v2") {
    const co = content.coordinate;
    // ★ Phase 2: 行動可能フィールドがあれば（MB context object 経路）短文カードで描画。
    //   無ければ（直接コーデ / 旧経路）従来の暫定 pre 表示にフォールバック（直接コーデ不変）。
    const hasActionable = !!(
      co.findThese?.length || co.avoidThese?.length || co.searchKeywords?.length || co.fitConditions
      || co.stylingMoves?.length || co.signatureMove  // ★ Phase 4-b: 着こなし操作のみでもカード描画
    );
    if (hasActionable) {
      return (
        <div className="space-y-2">
          <CoordinateReplyCard coordinate={co} onSendPrompt={onSendPrompt} onFeedback={onFeedback} />
          {content.actions && content.actions.length > 0 && (
            <AssistantActions actions={content.actions} onNavigate={onNavigate} />
          )}
        </div>
      );
    }
    return (
      <div className="space-y-2">
        <div className="bg-gray-50 text-gray-900 text-sm rounded-2xl rounded-bl-md px-4 py-3 leading-relaxed space-y-2">
          <p className="font-bold">{co.direction}</p>
          <p className="whitespace-pre-wrap">{co.summary}</p>
          <pre className="text-xs bg-white border border-gray-200 rounded-lg p-2 overflow-x-auto">{JSON.stringify(co, null, 2)}</pre>
        </div>
        {content.editorScore && <EditorScoreFold score={content.editorScore} />}
        {content.actions && content.actions.length > 0 && (
          <AssistantActions actions={content.actions} onNavigate={onNavigate} />
        )}
        {ENABLE_VISUALIZE && content.sessionIntent === "coordinate" && (
          <VisualizeButton coordinateText={co.summary} moodboardId={content.moodboardId} />
        )}
        {/* ★ G-2b: MB 経由コーデなら「この方向性で商品を探す」(E-0f 実商品試着主軸への導線)*/}
        {PRODUCTS_ENABLED && content.moodboardId && (
          <SearchProductsButton moodboardId={content.moodboardId} onSearch={onSearchProducts} />
        )}
      </div>
    );
  }
  // ★ G-2b 案D: 実商品候補(coordinate_v2 と別メッセージ)。onTryOn は G-3 で接続(現状 disabled「準備中」)。
  if (content.kind === "products") {
    if (!PRODUCTS_ENABLED) return null;
    return (
      <div className="space-y-2">
        <ProductCardList
          candidates={content.candidates}
          loading={content.loading}
          error={content.error}
        />
      </div>
    );
  }
  if (content.kind === "reply") {
    return (
      <div className="space-y-2">
        <div className="bg-gray-50 text-gray-900 text-sm rounded-2xl rounded-bl-md px-4 py-3 whitespace-pre-wrap break-words leading-relaxed">
          {content.text}
        </div>
        {/* C-2c-1: MB 経由 coordinate のエディタ AI 評価スコア表示(verify 用に折りたたみ) */}
        {content.editorScore && <EditorScoreFold score={content.editorScore} />}
        {content.actions && content.actions.length > 0 && (
          <AssistantActions actions={content.actions} onNavigate={onNavigate} />
        )}
        {/* C-2a: coordinate intent の reply 直下に「ビジュアルで見る」ボタン(MB / 直接両対応) */}
        {ENABLE_VISUALIZE && content.sessionIntent === "coordinate" && (
          <VisualizeButton coordinateText={content.text} moodboardId={content.moodboardId} />
        )}
      </div>
    );
  }
  // 既存 intent-result : D1-2a 既存 ResultView を ★シグネチャ無変更で★ 再利用
  // (MVP-1 範囲外 intent では P1-C-1 挙動を 1 文字も変えない)
  return (
    <div className="rounded-2xl rounded-bl-md overflow-hidden">
      <ResultView result={content.result} onNavigate={onNavigate} />
    </div>
  );
}

// C-2c-1: エディタ AI 評価スコア折りたたみ表示(★ MB 経由 coordinate のみ)。
// verdict は ★ 「pass / compromise / fail」を ★ ★ 透明性表示し、開発中 verify 用に
// 10 軸スコア + 6 チェック + 改善指示も折りたたみで見られるようにする。
function EditorScoreFold({ score }: { score: EditorScorePayload }) {
  const verdictLabel =
    score.verdict === "pass"       ? "★ 合格"
    : score.verdict === "compromise" ? "△ 妥協"
    :                                  "× 不合格(再生成済)";
  const verdictColor =
    score.verdict === "pass"       ? "text-emerald-600"
    : score.verdict === "compromise" ? "text-amber-600"
    :                                  "text-rose-600";
  const scoreEntries: { key: keyof typeof score.scores; label: string }[] = [
    { key: "novelty",           label: "新規性" },
    { key: "rarity",            label: "既視感の少なさ" },
    { key: "mb_translation",    label: "MB 翻訳精度" },
    { key: "daily_use",         label: "日常化のうまさ" },
    { key: "photogenic",        label: "写真映え" },
    { key: "post_worthy",       label: "投稿したくなるか" },
    { key: "searchable",        label: "検索できる具体性" },
    { key: "personal",          label: "その人らしさ" },
    { key: "whitespace",        label: "余白" },
    { key: "signature_anomaly", label: "★ 1 点の強い違和感" },
  ];
  return (
    <details className="text-xs text-gray-500 px-1">
      <summary className="cursor-pointer">
        品質評価: <span className={`font-medium ${verdictColor}`}>{verdictLabel}</span>
        <span className="ml-2 text-gray-400">
          合計 {score.total}/100・試行 {score.attempts} 回
        </span>
      </summary>
      <div className="mt-2 space-y-2 pl-2">
        {score.reasonShort !== "" && (
          <p className="leading-relaxed">{score.reasonShort}</p>
        )}
        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
          {scoreEntries.map((e) => (
            <div key={e.key} className="flex justify-between">
              <span className="text-gray-500">{e.label}</span>
              <span className="text-gray-700">{score.scores[e.key]}/10</span>
            </div>
          ))}
        </div>
        {score.verdict !== "pass" && score.improvementHints !== "" && (
          <div className="border-t border-gray-100 pt-2">
            <p className="text-gray-500 mb-1">改善方向(verify 用)</p>
            <p className="leading-relaxed text-gray-700">{score.improvementHints}</p>
          </div>
        )}
      </div>
    </details>
  );
}

// C-2a: 「ビジュアルで見る」ボタン(coordinate reply 直下)。
// POST /api/tryon/generate(MB + 体型 + コーデ → Claude Haiku で英語 prompt → FASHN product-to-model)。
// 20-120 秒待機 → 画像 + generatedPrompt(verify 用)を inline 表示。
// 並列表示 UI の本格化は C-2b、対話修正は C-3。
interface GenerateApiResponse {
  ok:                boolean;
  predictionId?:     string;
  imageUrl?:         string;
  generatedPrompt?:  string;
  elapsedMs?:        number;
  error?:            string;
}
function VisualizeButton({ coordinateText, moodboardId }: {
  coordinateText: string;
  moodboardId?:   string;
}) {
  const [phase, setPhase]     = useState<"idle" | "loading" | "done" | "error">("idle");
  const [result, setResult]   = useState<{ imageUrl: string; generatedPrompt: string; elapsedMs: number } | null>(null);
  const [errMsg, setErrMsg]   = useState<string>("");

  async function handleClick() {
    setPhase("loading");
    setResult(null);
    setErrMsg("");
    try {
      const res = await fetch("/api/tryon/generate", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ coordinateText, moodboardId }),
      });
      const data = await res.json() as GenerateApiResponse;
      if (!res.ok || !data.ok || !data.imageUrl || !data.generatedPrompt) {
        setErrMsg(data.error ?? `HTTP ${res.status}`);
        setPhase("error");
        return;
      }
      setResult({
        imageUrl:        data.imageUrl,
        generatedPrompt: data.generatedPrompt,
        elapsedMs:       data.elapsedMs ?? 0,
      });
      setPhase("done");
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : "通信エラー");
      setPhase("error");
    }
  }

  return (
    <div className="space-y-2 px-1">
      {phase === "idle" && (
        <button
          type="button"
          onClick={handleClick}
          className="px-3 py-1.5 bg-gray-800 text-white rounded-full text-xs hover:bg-gray-700 transition-colors"
        >
          ビジュアルで見る
        </button>
      )}
      {phase === "loading" && (
        <button
          type="button"
          disabled
          className="px-3 py-1.5 bg-gray-300 text-gray-600 rounded-full text-xs cursor-wait"
        >
          生成中…(20-120 秒)
        </button>
      )}
      {phase === "done" && result && (
        <div className="space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={result.imageUrl}
            alt="着用イメージ"
            className="w-full max-w-md rounded-2xl border border-gray-200"
          />
          <p className="text-xs text-gray-400">
            生成 {Math.round(result.elapsedMs / 1000)} 秒・FASHN CDN(72 時間保存)
          </p>
          <details className="text-xs text-gray-500">
            <summary className="cursor-pointer">生成 prompt(verify 用)</summary>
            <p className="mt-1 leading-relaxed whitespace-pre-wrap">{result.generatedPrompt}</p>
          </details>
          <button
            type="button"
            onClick={handleClick}
            className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-full text-xs hover:bg-gray-50 transition-colors"
          >
            もう一度生成
          </button>
        </div>
      )}
      {phase === "error" && (
        <div className="space-y-2">
          <p className="text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2 leading-relaxed">{errMsg}</p>
          <button
            type="button"
            onClick={handleClick}
            className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-full text-xs hover:bg-gray-50 transition-colors"
          >
            再試行
          </button>
        </div>
      )}
    </div>
  );
}

// P1-C-1.5a: reply 末尾の補助 action ボタン(小さい・最小新規)
// ★全画面 NavigateConfirm カードは使わない(本体 4.7・降格仕様)
// onClick は ResultView/NavigateConfirm/SuggestionList と完全同じ onNavigate(intent) で navigate-map 既存関数を介す。
function AssistantActions({
  actions,
  onNavigate,
}: {
  actions:    SuggestionItem[];
  onNavigate: (intent: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 px-1">
      {actions.map((a, i) => {
        const target = resolveNavigateTarget(a.intent);
        // 配線なし intent / SIMPLE_MODE で隠した機能への提案は出さない
        if (!target || !isNavIntentVisible(a.intent)) return null;
        return (
          <button
            key={i}
            type="button"
            onClick={() => onNavigate(a.intent)}
            className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-full text-xs hover:bg-gray-50 transition-colors"
          >
            {a.label}
          </button>
        );
      })}
    </div>
  );
}

// ====================================================================
// 以下は D1-2a 実装の 5 サブコンポーネント。
// ★ シグネチャ・実装ともに完全不変(P1-C-1 で transfer したのみ)。
// ====================================================================

function ResultView({
  result,
  onNavigate,
}: {
  result:     IntentResponse;
  onNavigate: (intent: string) => void;
}) {
  if (result.reason === "auth_required") {
    return (
      <div className="border border-gray-100 rounded-xl p-3">
        <p className="text-xs text-gray-500">ログインが必要です</p>
      </div>
    );
  }
  if (result.reason === "empty_input") {
    return (
      <div className="border border-gray-100 rounded-xl p-3">
        <p className="text-xs text-gray-500">何か書いてください</p>
      </div>
    );
  }

  const intent     = result.intent     ?? "unknown";
  const mode       = result.mode       ?? "none";
  const confidence = result.confidence ?? 0;

  // D1-2a: confidence 低 + suggestions あり → 候補ボタン提示
  const showSuggestions =
    confidence < CONFIDENCE_THRESHOLD
    && result.suggestions
    && result.suggestions.length > 0;

  // D1-2a: navigate 群 → 即遷移ボタン
  if (mode === "navigate" && !showSuggestions) {
    // SIMPLE_MODE で隠した機能への直接遷移は案内しない（unknown 扱いにフォールバック）
    if (!isNavIntentVisible(intent)) return <NoneNotice intent="unknown" />;
    return (
      <NavigateConfirm intent={intent} confidence={confidence} onNavigate={onNavigate} />
    );
  }

  // D1-2a: none(moodboard / tryon / unknown)
  if (mode === "none") {
    return <NoneNotice intent={intent} />;
  }

  // confidence 低時の候補提示(navigate / none 横断)
  if (showSuggestions) {
    return (
      <SuggestionList
        suggestions={result.suggestions ?? []}
        confidence={confidence}
        onNavigate={onNavigate}
      />
    );
  }

  // mode === "api" / "hybrid" : D1-2c' / D1-2e' で本配線。D1-2b' では判定結果のみ表示。
  return <ApiHybridPlaceholder result={result} />;
}

// D1-2a: navigate 確定時の確認 + 遷移ボタン
function NavigateConfirm({
  intent,
  confidence,
  onNavigate,
}: {
  intent:     string;
  confidence: number;
  onNavigate: (intent: string) => void;
}) {
  // resolveNavigateTarget 相当の description を表示するため動的 import を避けるべく
  // 短いラベルだけ ここで持つ(navigate-map と整合させる)
  const labels: Record<string, string> = {
    "diagnose":          "世界観診断を始めます",
    "worldview-profile": "あなたの世界観プロフィールを開きます",
    "create-post":       "投稿作成画面を開きます",
    "my-posts":          "あなたの投稿一覧を開きます",
    "closet":            "クローゼットを開きます",
    "saved":             "保存済みを開きます",
    "history":           "AI履歴を開きます",
    "body-edit":         "体型情報の編集画面を開きます",
    "preference-edit":   "好みの編集画面を開きます",
  };
  const label = labels[intent] ?? "画面を開きます";

  return (
    <div className="border border-gray-100 rounded-xl p-4 space-y-3">
      <p className="text-sm text-gray-900">{label}</p>
      <p className="text-[10px] text-gray-400">
        確信度 {(confidence * 100).toFixed(0)}%
      </p>
      <button
        type="button"
        onClick={() => onNavigate(intent)}
        className="w-full px-4 py-3 bg-gray-800 text-white rounded-xl text-sm hover:bg-gray-700 transition-colors"
      >
        移動する →
      </button>
    </div>
  );
}

// D1-2a: mode="none" 案内(moodboard / tryon / unknown)
function NoneNotice({ intent }: { intent: string }) {
  if (intent === "moodboard") {
    return (
      <div className="border border-gray-100 rounded-xl p-4 space-y-2">
        <p className="text-sm text-gray-900">ムードボードはまだ準備中です</p>
        <p className="text-xs text-gray-500 leading-relaxed">
          世界観を視覚化するボード機能は D1-3 で実装予定です。少々お待ちください。
        </p>
      </div>
    );
  }
  if (intent === "tryon") {
    return (
      <div className="border border-gray-100 rounded-xl p-4 space-y-2">
        <p className="text-sm text-gray-900">リアル試着はまだ準備中です</p>
        <p className="text-xs text-gray-500 leading-relaxed">
          自分の写真に服を着せて合成する機能は、プライバシー設計を慎重に進めるため
          D1-5 で実装予定です。
        </p>
      </div>
    );
  }
  // unknown
  return (
    <div className="border border-gray-100 rounded-xl p-4 space-y-2">
      <p className="text-sm text-gray-900">うまく理解できませんでした</p>
      <p className="text-xs text-gray-500 leading-relaxed">
        別の言い方で書いてもらえますか?
      </p>
      <ul className="text-xs text-gray-500 space-y-1 pl-4 list-disc">
        <li>「世界観の近い人を見たい」</li>
        <li>「クローゼットを開きたい」</li>
        <li>「再診断したい」</li>
      </ul>
    </div>
  );
}

// D1-2a: confidence 低時の候補ボタンリスト
function SuggestionList({
  suggestions,
  confidence,
  onNavigate,
}: {
  suggestions: { intent: string; label: string }[];
  confidence:  number;
  onNavigate:  (intent: string) => void;
}) {
  return (
    <div className="border border-gray-100 rounded-xl p-4 space-y-3">
      <p className="text-sm text-gray-900">どれに近いですか?</p>
      <p className="text-[10px] text-gray-400">
        確信度 {(confidence * 100).toFixed(0)}% — 候補を出しました
      </p>
      <div className="flex flex-col gap-2">
        {suggestions.filter((s) => isNavIntentVisible(s.intent)).map((s, i) => {
          // navigate 配線済 intent のみクリック可能(D1-2a スコープ)
          const target = resolveNavigateTarget(s.intent);
          if (!target) {
            return (
              <div key={i} className="w-full px-4 py-3 border border-gray-100 text-gray-400 rounded-xl text-sm text-left">
                {s.label}<span className="text-[10px] text-gray-300 ml-2">(まだ未配線)</span>
              </div>
            );
          }
          return (
            <button
              key={i}
              type="button"
              onClick={() => onNavigate(s.intent)}
              className="w-full px-4 py-3 border border-gray-200 text-gray-800 rounded-xl text-sm text-left hover:bg-gray-50 transition-colors"
            >
              {s.label} →
            </button>
          );
        })}
      </div>
    </div>
  );
}

// D1-2a 範囲外:api / hybrid 機能は判定結果のみ表示(D1-2c' / D1-2e' で本配線)
function ApiHybridPlaceholder({ result }: { result: IntentResponse }) {
  const confidencePct = ((result.confidence ?? 0) * 100).toFixed(0);
  const hasParams = result.params && Object.keys(result.params).length > 0;
  return (
    <div className="border border-gray-100 rounded-xl p-4 space-y-3">
      <KeyVal label="intent"     value={result.intent ?? "?"} />
      <KeyVal label="mode"       value={result.mode ?? "?"} />
      <KeyVal label="confidence" value={`${confidencePct}%`} />
      {hasParams && (
        <div>
          <p className="text-[10px] tracking-widest text-gray-400 uppercase mb-1">params</p>
          <pre className="text-xs text-gray-700 bg-gray-50 p-2 rounded-md overflow-x-auto whitespace-pre-wrap break-all">
            {JSON.stringify(result.params, null, 2)}
          </pre>
        </div>
      )}
      <p className="text-[10px] text-gray-400 pt-2 border-t border-gray-100">
        {"この機能は D1-2c' / D1-2e' で配線します(現状は判定結果のみ表示)"}
      </p>
    </div>
  );
}

function KeyVal({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <p className="text-[10px] tracking-widest text-gray-400 uppercase w-20 shrink-0">{label}</p>
      <p className="text-sm font-medium text-gray-900 break-all">{value}</p>
    </div>
  );
}

// useSearchParams を使うため Suspense でラップ(/outfit /self と同パターン)
export default function ChatPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <ChatPageInner />
    </Suspense>
  );
}
