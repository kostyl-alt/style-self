"use client";

import { useState } from "react";
import Link from "next/link";
import CoordinateCard from "@/components/coordinate/CoordinateCard";
import type {
  AbstractToDesignResponse, CoordinateAIResponse, ResolvedCoordinateItem,
} from "@/types/index";

const PRESET_WORDS = [
  "静けさ", "余白", "緊張感", "儀式性", "自己統治",
  "境界", "匿名性", "機能美", "都市とノイズ", "透明性",
  "構造美", "素材の誠実さ", "時間の堆積", "引き算",
];

interface InspireResult {
  abstractWords: string[];
  designTranslation: AbstractToDesignResponse;
  coordinate: CoordinateAIResponse;
  resolvedItems: ResolvedCoordinateItem[];
}

export default function InspirationView({ embedded = false }: { embedded?: boolean }) {
  const [wordInput, setWordInput]     = useState("");
  const [words, setWords]             = useState<string[]>([]);
  const [theme, setTheme]             = useState("");
  const [result, setResult]           = useState<InspireResult | null>(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [isSaving, setIsSaving]       = useState(false);
  const [isSaved, setIsSaved]         = useState(false);

  function addWord(w: string) {
    const trimmed = w.trim();
    if (!trimmed || words.includes(trimmed)) return;
    setWords((prev) => [...prev, trimmed]);
    setWordInput("");
  }

  function removeWord(w: string) {
    setWords((prev) => prev.filter((x) => x !== w));
  }

  async function handleGenerate() {
    if (words.length === 0 && !theme.trim()) {
      setError("抽象語またはテーマを入力してください"); return;
    }
    setLoading(true); setError(null); setResult(null); setIsSaved(false);
    try {
      const res = await fetch("/api/ai/abstract-coordinate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ abstractWords: words, theme: theme.trim() || undefined }),
      });
      const data = await res.json() as InspireResult & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "生成に失敗しました");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!result) return;
    setIsSaving(true);
    try {
      const res = await fetch("/api/coordinate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coordinate: result.coordinate }),
      });
      if (res.ok) setIsSaved(true);
    } finally {
      setIsSaving(false);
    }
  }

  const Wrapper = embedded
    ? ({ children }: { children: React.ReactNode }) => <div className="space-y-6">{children}</div>
    : ({ children }: { children: React.ReactNode }) => (
        <div className="min-h-screen bg-white">
          <div className="max-w-lg mx-auto px-4 py-12 space-y-6">{children}</div>
        </div>
      );

  return (
    <Wrapper>
      {!embedded && (
        <div>
          <p className="text-xs tracking-widest text-gray-400 uppercase mb-1">Inspire</p>
          <h1 className="text-2xl font-light text-gray-900">抽象語からコーデを作る</h1>
          <p className="text-sm text-gray-500 mt-2">言語をシルエットに変換します</p>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex gap-2">
          <input type="text" value={wordInput} onChange={(e) => setWordInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addWord(wordInput); } }}
            placeholder="例: 静けさ、余白、緊張感"
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200" />
          <button onClick={() => addWord(wordInput)}
            className="px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm hover:border-gray-300 transition-colors">追加</button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PRESET_WORDS.map((w) => (
            <button key={w} onClick={() => addWord(w)} disabled={words.includes(w)}
              className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                words.includes(w) ? "border-gray-800 bg-gray-800 text-white" : "border-gray-200 text-gray-500 hover:border-gray-400"
              }`}>{w}</button>
          ))}
        </div>
        {words.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {words.map((w) => (
              <span key={w} className="flex items-center gap-1.5 px-3 py-1 bg-gray-800 text-white text-sm rounded-full">
                {w}
                <button onClick={() => removeWord(w)} className="text-gray-400 hover:text-white text-xs">×</button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className="block text-xs tracking-widest text-gray-400 uppercase mb-2">Theme（任意）</label>
        <input type="text" value={theme} onChange={(e) => setTheme(e.target.value)}
          placeholder="例: 都市とノイズの中の静寂"
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200" />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          <p className="text-sm text-red-600 mb-2">{error}</p>
          {error.includes("所有中のアイテムがありません") && (
            <Link href="/outfit?tab=closet" className="inline-block text-xs text-gray-600 underline underline-offset-2 hover:text-gray-900">
              クローゼットにアイテムを追加する →
            </Link>
          )}
        </div>
      )}

      <button onClick={handleGenerate} disabled={loading || (words.length === 0 && !theme.trim())}
        className="w-full py-3.5 bg-gray-800 text-white rounded-xl text-sm font-medium hover:bg-gray-700 disabled:opacity-40 transition-colors">
        {loading ? "変換・生成中..." : "コーデを生成する"}
      </button>

      {result && (
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-2xl p-5 space-y-3">
            <p className="text-xs tracking-widest text-gray-400 uppercase">Design Translation</p>
            <p className="text-sm text-gray-500 italic leading-relaxed">{result.designTranslation.designRationale}</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 pt-1">
              <TranslationRow label="カラー" value={`${result.designTranslation.translation.colorPalette.primary} / ${result.designTranslation.translation.colorPalette.secondary}`} />
              <TranslationRow label="素材" value={result.designTranslation.translation.materials.join("・")} />
              <TranslationRow label="シルエット" value={result.designTranslation.translation.silhouetteType} />
              <TranslationRow label="ボリューム" value={result.designTranslation.translation.volumeBalance} />
              <TranslationRow label="重心" value={result.designTranslation.translation.weightCenter} />
              <TranslationRow label="レイヤード" value={result.designTranslation.translation.layering} />
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {result.designTranslation.translation.impressionKeywords.map((kw) => (
                <span key={kw} className="px-2 py-0.5 bg-gray-200 text-gray-600 text-xs rounded-full">{kw}</span>
              ))}
            </div>
          </div>
          <CoordinateCard coordinate={result.coordinate} resolvedItems={result.resolvedItems}
            scene={result.abstractWords.join(" / ")} onSave={handleSave} isSaving={isSaving} isSaved={isSaved} />
        </div>
      )}
    </Wrapper>
  );
}

function TranslationRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-xs text-gray-400 w-16 flex-shrink-0">{label}</span>
      <span className="text-xs text-gray-700 leading-relaxed">{value}</span>
    </div>
  );
}
