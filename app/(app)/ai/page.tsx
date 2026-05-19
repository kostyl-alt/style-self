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

// D1-2b': メッセージ型(設計案 B2.2)
type MessageContent =
  | { kind: "text";          text: string }                       // user 入力 or 簡素な assistant 応答
  | { kind: "intent-result"; result: IntentResponse }             // /api/overlay/intent のレスポンス
  | { kind: "loading" }                                            // 「考えています…」
  | { kind: "error";         message: string };                   // 通信 / API エラー

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

  // 末端 ref(自動スクロール用)
  const endRef = useRef<HTMLDivElement>(null);

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
      // 成功: loading を intent-result に置換
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

  return (
    // ★ P1-C-1: 常時表示メイン画面構造(min-h-screen + flex-col の 3 段)。
    //          (app)/layout.tsx の pb-20(BottomNav 分の余白)は P1-C-1 では残置・
    //          BottomNav / OverlayFab 廃止は P1-C-2 で実施(C-1 では二重化を許容)。
    <div className="min-h-screen bg-white flex flex-col">
      {/* ヘッダ(P1-C-3 で [≡] 右上メニュー追加予定・C-1 ではテキストのみ)*/}
      <header className="px-5 pt-5 pb-3 border-b border-gray-100">
        <p className="text-xs tracking-widest text-gray-400 uppercase">STYLE-SELF AI</p>
        <h1 className="text-lg font-light text-gray-900 mt-0.5">何を相談しますか?</h1>
      </header>

      {/* 履歴エリア(スクロール) */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {messages.length === 0 ? (
          <EmptyHistoryHint />
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

// ---- 履歴空のヒント ----

function EmptyHistoryHint() {
  return (
    <div className="py-6 text-center space-y-2">
      <p className="text-xs text-gray-500 leading-relaxed">
        自然言語で書いてください。
      </p>
      <ul className="text-xs text-gray-400 leading-relaxed">
        <li>「世界観の近い人を探したい」</li>
        <li>「黒い服のコーデが見たい」</li>
        <li>「診断したい」</li>
      </ul>
    </div>
  );
}

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
  // intent-result : D1-2a 既存 ResultView を シグネチャ無変更で 再利用
  return (
    <div className="rounded-2xl rounded-bl-md overflow-hidden">
      <ResultView result={content.result} onNavigate={onNavigate} />
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
