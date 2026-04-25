"use client";

import { useState, useEffect } from "react";
import type { Worldview } from "@/types/index";

const IMPRESSION_OPTIONS = [
  "知性", "余白", "意図", "静けさ", "緊張感", "存在感",
  "構造美", "清潔感", "力強さ", "繊細さ", "自由", "哲学",
  "都会的", "自然体", "洗練", "個性的",
];

const AVOID_OPTIONS = [
  "派手", "過剰な主張", "カジュアルすぎる", "甘すぎる",
  "フォーマルすぎる", "トレンド重視", "ロゴ過多", "装飾過多",
];

const EMPTY_WORLDVIEW: Worldview = {
  beliefs: [],
  targetPersona: "",
  stylePhilosophy: "",
  desiredImpression: [],
  avoidImpression: [],
};

export default function WorldviewPage() {
  const [worldview, setWorldview]         = useState<Worldview>(EMPTY_WORLDVIEW);
  const [beliefInput, setBeliefInput]     = useState("");
  const [loading, setLoading]             = useState(true);
  const [saving,  setSaving]              = useState(false);
  const [saved,   setSaved]               = useState(false);
  const [error,   setError]               = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/worldview")
      .then((r) => r.json())
      .then((data: { worldview: Worldview | null }) => {
        if (data.worldview) setWorldview({ ...EMPTY_WORLDVIEW, ...data.worldview });
      })
      .catch(() => setError("世界観の読み込みに失敗しました"))
      .finally(() => setLoading(false));
  }, []);

  function addBelief() {
    const trimmed = beliefInput.trim();
    if (!trimmed || worldview.beliefs.includes(trimmed)) return;
    setWorldview((w) => ({ ...w, beliefs: [...w.beliefs, trimmed] }));
    setBeliefInput("");
  }

  function removeBelief(b: string) {
    setWorldview((w) => ({ ...w, beliefs: w.beliefs.filter((x) => x !== b) }));
  }

  function toggleImpression(key: "desiredImpression" | "avoidImpression", value: string) {
    setWorldview((w) => {
      const current = w[key];
      return {
        ...w,
        [key]: current.includes(value) ? current.filter((x) => x !== value) : [...current, value],
      };
    });
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch("/api/worldview", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ worldview }),
      });
      if (!res.ok) {
        const data = await res.json() as { error: string };
        throw new Error(data.error);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">読み込み中...</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-4">
        <div className="mb-2">
          <p className="text-xs tracking-widest text-gray-400 uppercase mb-1">Worldview</p>
          <h1 className="text-xl font-semibold text-gray-900">世界観・信念</h1>
          <p className="text-sm text-gray-500 mt-1">あなたのファッション哲学を言語化してください。コーデ提案に反映されます。</p>
        </div>

        {/* 信念キーワード */}
        <Section title="信念キーワード" hint="Enterで追加">
          <div className="flex gap-2">
            <input
              type="text"
              value={beliefInput}
              onChange={(e) => setBeliefInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addBelief(); } }}
              placeholder="例: 余白を大切にする"
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
            />
            <button
              onClick={addBelief}
              className="px-4 py-2 bg-gray-800 text-white rounded-xl text-sm hover:bg-gray-700 transition-colors"
            >
              追加
            </button>
          </div>
          {worldview.beliefs.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {worldview.beliefs.map((b) => (
                <span key={b} className="flex items-center gap-1.5 px-3 py-1 bg-gray-800 text-white text-sm rounded-full">
                  {b}
                  <button onClick={() => removeBelief(b)} className="text-gray-400 hover:text-white text-xs leading-none">×</button>
                </span>
              ))}
            </div>
          )}
        </Section>

        {/* 目指したい人物像 */}
        <Section title="目指したい人物像">
          <input
            type="text"
            value={worldview.targetPersona}
            onChange={(e) => setWorldview((w) => ({ ...w, targetPersona: e.target.value }))}
            placeholder="例: 建築家のような静けさを持つ人"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
          />
        </Section>

        {/* ファッション哲学 */}
        <Section title="ファッション哲学" hint="自由記述">
          <textarea
            value={worldview.stylePhilosophy}
            onChange={(e) => setWorldview((w) => ({ ...w, stylePhilosophy: e.target.value }))}
            placeholder="例: 服は自己表現ではなく、環境との対話である"
            rows={3}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200 resize-none"
          />
        </Section>

        {/* 与えたい印象 */}
        <Section title="与えたい印象" hint="複数選択可">
          <div className="flex flex-wrap gap-2">
            {IMPRESSION_OPTIONS.map((opt) => (
              <button
                key={opt}
                onClick={() => toggleImpression("desiredImpression", opt)}
                className={`px-3 py-1.5 rounded-full border text-sm transition-colors ${
                  worldview.desiredImpression.includes(opt)
                    ? "border-gray-800 bg-gray-800 text-white"
                    : "border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </Section>

        {/* 避けたい印象 */}
        <Section title="避けたい印象" hint="複数選択可">
          <div className="flex flex-wrap gap-2">
            {AVOID_OPTIONS.map((opt) => (
              <button
                key={opt}
                onClick={() => toggleImpression("avoidImpression", opt)}
                className={`px-3 py-1.5 rounded-full border text-sm transition-colors ${
                  worldview.avoidImpression.includes(opt)
                    ? "border-red-500 bg-red-50 text-red-600"
                    : "border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </Section>

        {error && (
          <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3">{error}</p>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className={`w-full py-3.5 rounded-xl text-sm font-medium transition-colors ${
            saved
              ? "bg-gray-100 text-gray-500 cursor-default"
              : "bg-gray-800 text-white hover:bg-gray-700 disabled:opacity-40"
          }`}
        >
          {saved ? "保存しました ✓" : saving ? "保存中..." : "世界観を保存する"}
        </button>

        {/* 保存済みプレビュー */}
        {(worldview.beliefs.length > 0 || worldview.stylePhilosophy) && (
          <div className="bg-gray-800 text-white rounded-2xl p-5 space-y-3">
            <p className="text-xs tracking-widest text-gray-400 uppercase">Your Worldview</p>
            {worldview.beliefs.length > 0 && (
              <p className="text-sm leading-relaxed">{worldview.beliefs.join(" / ")}</p>
            )}
            {worldview.stylePhilosophy && (
              <p className="text-xs text-gray-400 leading-relaxed border-t border-gray-700 pt-3">{worldview.stylePhilosophy}</p>
            )}
            {worldview.desiredImpression.length > 0 && (
              <p className="text-xs text-gray-400">目指す印象: {worldview.desiredImpression.join("・")}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-xs tracking-widest text-gray-400 uppercase">{title}</h2>
        {hint && <span className="text-xs text-gray-400">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
