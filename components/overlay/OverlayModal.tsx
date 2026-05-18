"use client";

// D1-1: 自然言語オーバーレイ モーダル
//
// 設計: docs/STYLE-SELF_D1_実装設計.md セクション 4.3 / 5
// スコープ(D1-1): 入力 → /api/overlay/intent → intent 判定結果を画面に表示するまで
//                 機能起動・ナビゲート・対話表示は D1-2(本コンポーネントを拡張する)
//
// 【プライバシー(設計書 4.4 不可侵境界線)】
// - 既存 DB を直接触らない・既存 API を呼ぶのみ
// - 表示は intent / mode / confidence / params の判定結果のみ(内部識別子は OK)
// - D1-2 で機能配線時に worldview_tags 英語スラッグの露出ゼロ点検を再実施

import { useState } from "react";

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

export default function OverlayModal({ onClose }: { onClose: () => void }) {
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

        {result && <ResultView result={result} />}

        <p className="text-[10px] text-gray-400 leading-relaxed pt-2 border-t border-gray-100">
          ※ D1-1 骨格: 入力 → intent 判定結果の表示までです。各機能の起動・ナビゲート・
          結果対話表示は D1-2 で配線します。
        </p>
      </div>
    </div>
  );
}

function ResultView({ result }: { result: IntentResponse }) {
  if (result.reason === "auth_required") {
    return (
      <div className="border border-gray-100 rounded-xl p-3 space-y-1">
        <p className="text-xs text-gray-500">ログインが必要です</p>
      </div>
    );
  }
  if (result.reason === "empty_input") {
    return (
      <div className="border border-gray-100 rounded-xl p-3 space-y-1">
        <p className="text-xs text-gray-500">何か書いてください</p>
      </div>
    );
  }

  const confidencePct = ((result.confidence ?? 0) * 100).toFixed(0);
  const hasParams = result.params && Object.keys(result.params).length > 0;
  const hasSuggestions = result.suggestions && result.suggestions.length > 0;

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

      {hasSuggestions && (
        <div>
          <p className="text-[10px] tracking-widest text-gray-400 uppercase mb-1">候補</p>
          <ul className="space-y-1">
            {result.suggestions!.map((s, i) => (
              <li key={i} className="text-xs text-gray-700">
                → {s.label}<span className="text-gray-400">({s.intent})</span>
              </li>
            ))}
          </ul>
        </div>
      )}
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
