"use client";

// D1-1/D1-2a: 自然言語オーバーレイ モーダル
//
// 設計: docs/STYLE-SELF_D1_実装設計.md セクション 4.3 / 5
//
// 【D1-1 スコープ(完了)】入力 → /api/overlay/intent → 判定結果表示まで
// 【D1-2a スコープ(本実装)】
//   - mode="navigate" 9 intent: NAVIGATE_MAP で URL 解決 → router.push + モーダル閉
//   - mode="none" 3 intent(moodboard / tryon / unknown): 準備中/再入力案内
//   - confidence<0.7 + suggestions あり: 候補ボタン提示・タップで該当 intent を navigate 実行
//   - api / hybrid 系の配線は D1-2b / D1-2c で扱う(本実装では「判定結果のみ表示」継続)
//
// 【プライバシー(設計書 4.4 不可侵境界線)】
// - 既存 DB を直接触らない・既存 API を呼ぶのみ
// - 既存画面の認証ガード(middleware appRoutes)が navigate 先で守ってくれる
// - intent.params / URL に worldview_tags 英語スラッグ等を載せない

import { useState } from "react";
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

export default function OverlayModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [text, setText]       = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState<IntentResponse | null>(null);
  const [error, setError]     = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/overlay/intent", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ text }),
      });
      const data = await res.json() as IntentResponse & { error?: string };
      if (!res.ok) {
        setError(data.error ?? `HTTP ${res.status}`);
        return;
      }
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "通信エラー");
    } finally {
      setLoading(false);
    }
  }

  // D1-2a: navigate 実行(モーダル閉じる + router.push)
  // 既存画面の認証ガードは middleware appRoutes が裏で守る(未認証なら /login へ)
  function executeNavigate(intent: string) {
    const target = resolveNavigateTarget(intent);
    if (!target) return;
    onClose();
    router.push(target.url);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-4 py-6"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <header>
          <p className="text-xs tracking-widest text-gray-400 uppercase">Overlay</p>
          <h2 className="text-lg font-light text-gray-900 mt-0.5">何をしたいですか?</h2>
          <p className="text-xs text-gray-500 mt-2 leading-relaxed">
            自然言語で書いてください。例: 「世界観の近い人を探したい」「黒い服のコーデが見たい」「診断したい」
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="例: 黒系の服が好きで似た人を探したい"
            rows={3}
            autoFocus
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:border-gray-400 resize-none"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-3 border border-gray-200 text-gray-700 rounded-xl text-sm hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              閉じる
            </button>
            <button
              type="submit"
              disabled={loading || !text.trim()}
              className="flex-1 px-4 py-3 bg-gray-800 text-white rounded-xl text-sm hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              {loading ? "判定中…" : "判定する →"}
            </button>
          </div>
        </form>

        {error && (
          <div className="border border-rose-200 rounded-xl p-3">
            <p className="text-sm text-rose-700">{error}</p>
          </div>
        )}

        {result && (
          <ResultView
            result={result}
            onNavigate={executeNavigate}
          />
        )}

        <p className="text-[10px] text-gray-400 leading-relaxed pt-2 border-t border-gray-100">
          ※ D1-2a 段階:navigate(画面遷移)と未配線案内まで配線済。AI コーデ・人マッチ等の
          api/hybrid 機能は D1-2b/c で配線します。
        </p>
      </div>
    </div>
  );
}

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

  // mode === "api" / "hybrid" : D1-2b / D1-2c で本配線。D1-2a では判定結果のみ表示。
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

// D1-2a 範囲外:api / hybrid 機能は判定結果のみ表示(D1-2b / D1-2c で本配線)
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
        この機能は D1-2b / D1-2c で配線します(現状は判定結果のみ表示)
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
