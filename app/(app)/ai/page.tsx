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

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { resolveNavigateTarget } from "@/lib/overlay/navigate-map";
import MenuDrawer from "@/components/chat/MenuDrawer";
import WorldviewCard from "@/components/chat/WorldviewCard";
import SuggestionChips from "@/components/chat/SuggestionChips";
import InputAttachments from "@/components/chat/InputAttachments";
import ClosetPickerModal from "@/components/chat/ClosetPickerModal";

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
  | { kind: "reply";         text: string; actions?: SuggestionItem[]; sessionIntent?: string }  // /api/ai/stylist-chat の自然文応答(P1-C-1.5a・sessionIntent は会話継続性のため・L3)
  | { kind: "loading" }                                            // 「考えています…」
  | { kind: "error";         message: string };                   // 通信 / API エラー

// P1-C-1.5a / 1.5b-i / MVP-1c / A-6 / A-6b: 段階B 対象 intent(A-6b は 5 intent)
// ★ ここに無い intent は従来通り intent-result(NavigateConfirm 等)で表示する。
// ★ API 側 `app/api/ai/stylist-chat/route.ts` の同名 Set と完全一致させる(両側同期)
// ★ L4-A 切替検出は 1.5b-ii で投入済(SWITCH_THRESHOLD=0.85・別 target 高信頼で新セッション切替・A-6b で 5 intent 五角に自動拡張)
const STYLIST_CHAT_INTENTS = new Set<string>(["diagnose", "closet", "coordinate", "style-consult", "brand-learn"]);

// P1-C-1.5a: 会話 AI 応答の API レスポンス型(/api/ai/stylist-chat と同形)
interface StylistChatResponse {
  ok:       boolean;
  reply?:   string;
  actions?: SuggestionItem[];
  reason?:  "auth_required" | "empty_input" | "intent_out_of_scope";
  error?:   string;
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
export default function ChatPage() {
  const router = useRouter();
  const [text, setText]         = useState("");
  const [loading, setLoading]   = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  // P1-C-3: 右上メニュー [≡] Drawer の開閉
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  // A-5: クローゼットピッカーモーダルの開閉
  const [isClosetOpen, setIsClosetOpen] = useState(false);

  // 末端 ref(自動スクロール用)
  const endRef = useRef<HTMLDivElement>(null);

  // P1-C-1.5b-i+ fix v2: hydrate 完了フラグ(useState 化で再render 経由・persist の stale [] 上書き race を防止)
  const [hydrated, setHydrated] = useState(false);

  // P1-C-1.5b-i+: 履歴永続化 hydrate(初回 mount 時 localStorage から復元)
  // SSR セーフ: useEffect 内のみで localStorage 参照・初期 state は [] で SSR と一致。
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) setMessages(parsed as Message[]);
      }
    } catch { /* corrupt JSON 等は無視(空配列のまま続行) */ }
    setHydrated(true);
  }, []);

  // P1-C-1.5b-i+: 履歴永続化 persist(messages 変更で書き出し)
  // MAX_MESSAGES=30 で trimByMax により既に上限ありなので quota 安全。
  // ★ hydrate 完了前は実行しない(stale closure messages=[] で保存済みデータを
  //   "[]" で上書きする race を防止・真因切り分け済 2026-05-21)
  useEffect(() => {
    if (!hydrated) return;
    // ★ 空配列で上書きしない(多層防御・将来クリア機能の地雷予防)
    if (messages.length === 0) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch { /* quota 超過等は無視(永続化失敗してもセッション内は動く) */ }
  }, [messages, hydrated]);

  // メッセージ追加で末端へ自動スクロール
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    // 1) user メッセージ append
    const userMsg: Message = {
      id:        newMessageId(),
      role:      "user",
      content:   { kind: "text", text: trimmed },
      createdAt: Date.now(),
    };
    // 2) loading メッセージ append(後で置換)
    const loadingId = newMessageId();
    const loadingMsg: Message = {
      id:        loadingId,
      role:      "assistant",
      content:   { kind: "loading" },
      createdAt: Date.now(),
    };

    setMessages((prev) => trimByMax([...prev, userMsg, loadingMsg]));
    setText("");           // 入力欄クリア(連続発話可能に)
    setLoading(true);

    try {
      // ★ D1-1 /api/overlay/intent の呼び方は完全に同じ(body/headers 不変)
      const res = await fetch("/api/overlay/intent", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ text: trimmed }),
      });
      const data = await res.json() as IntentResponse & { error?: string };

      if (!res.ok) {
        replaceMessage(setMessages, loadingId, {
          kind: "error", message: data.error ?? `HTTP ${res.status}`,
        });
        return;
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
          // 段階B が reason を返した場合も従来挙動にフォールバック
          if (replyData.reason || !replyData.reply) {
            replaceMessage(setMessages, loadingId, { kind: "intent-result", result: data });
            return;
          }
          // 成功: 自然文 reply に置換(末尾に補助 actions)+ sessionIntent を保持(L3)
          replaceMessage(setMessages, loadingId, {
            kind:          "reply",
            text:          replyData.reply,
            actions:       replyData.actions,
            sessionIntent: intentToSend,
          });
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
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }

  return (
    // ★ P1-C-1: 常時表示メイン画面構造(min-h-screen + flex-col の 3 段)。
    //          (app)/layout.tsx の pb-20(BottomNav 分の余白)は P1-C-1 では残置・
    //          BottomNav / OverlayFab 廃止は P1-C-2 で実施(C-1 では二重化を許容)。
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
              <Bubble key={m.id} msg={m} onNavigate={executeNavigate} />
            ))}
            <div ref={endRef} />
          </>
        )}
      </div>

      {/* 下部固定入力(D1-2b' と同等・連続発話可能) */}
      <form onSubmit={handleSubmit} className="border-t border-gray-100 px-5 py-3 space-y-2 bg-white">
        {/* A-5 P1-D: 入力欄近接 4 ボタン(写真 / URL / クローゼット / MB) */}
        <InputAttachments onClosetOpen={() => setIsClosetOpen(true)} />
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

      {/* A-5 P1-D: クローゼットピッカーモーダル(GET /api/wardrobe + 選択 → textarea 挿入) */}
      <ClosetPickerModal
        isOpen={isClosetOpen}
        onClose={() => setIsClosetOpen(false)}
        onPick={(insertText) => setText((cur) => cur ? `${cur} ${insertText}` : insertText)}
      />
    </div>
  );
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
    if (m.content.kind === "reply") {
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
}: {
  msg:        Message;
  onNavigate: (intent: string) => void;
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
        <AssistantContent content={msg.content} onNavigate={onNavigate} />
      </div>
    </div>
  );
}

function AssistantContent({
  content,
  onNavigate,
}: {
  content:    MessageContent;
  onNavigate: (intent: string) => void;
}) {
  if (content.kind === "loading") {
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
  if (content.kind === "reply") {
    return (
      <div className="space-y-2">
        <div className="bg-gray-50 text-gray-900 text-sm rounded-2xl rounded-bl-md px-4 py-3 whitespace-pre-wrap break-words leading-relaxed">
          {content.text}
        </div>
        {content.actions && content.actions.length > 0 && (
          <AssistantActions actions={content.actions} onNavigate={onNavigate} />
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
        if (!target) return null;  // 配線なし intent は出さない(navigate-map 整合)
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
        {suggestions.map((s, i) => {
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
        この機能は D1-2c' / D1-2e' で配線します(現状は判定結果のみ表示)
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
