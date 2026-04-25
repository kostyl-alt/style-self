"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import CoordinateCard from "@/components/coordinate/CoordinateCard";
import type { CoordinateGenerateResponse, WardrobeItem } from "@/types/index";

const SCENES = [
  { value: "カジュアル",   emoji: "☕", desc: "普段・休日" },
  { value: "仕事",         emoji: "💼", desc: "オフィス・打ち合わせ" },
  { value: "特別な日",     emoji: "✨", desc: "デート・イベント" },
];

interface SavedCoordinate {
  id: string;
  color_story: string;
  belief_alignment: string;
  occasion: string | null;
  created_at: string;
}

export default function CoordinatePage() {
  const [scene, setScene] = useState("カジュアル");
  const [ownedCount, setOwnedCount] = useState<number | null>(null);
  const [result, setResult] = useState<CoordinateGenerateResponse | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<SavedCoordinate[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  useEffect(() => {
    fetch("/api/wardrobe")
      .then((r) => r.json())
      .then((data: WardrobeItem[]) => {
        setOwnedCount(data.filter((i) => i.status === "owned").length);
      })
      .catch(() => setOwnedCount(0));
  }, []);

  async function handleGenerate() {
    setIsGenerating(true);
    setError(null);
    setResult(null);
    setIsSaved(false);

    try {
      const res = await fetch("/api/ai/coordinate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scene }),
      });

      const data = await res.json() as CoordinateGenerateResponse & { error?: string };

      if (!res.ok) {
        throw new Error(data.error ?? "コーデ生成に失敗しました");
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "コーデ生成に失敗しました");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSave() {
    if (!result) return;
    setIsSaving(true);

    try {
      const res = await fetch("/api/coordinate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coordinate: result.coordinate, occasion: scene }),
      });

      if (res.ok) {
        setIsSaved(true);
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function loadHistory() {
    if (showHistory) {
      setShowHistory(false);
      return;
    }
    setShowHistory(true);
    setIsLoadingHistory(true);
    try {
      const res = await fetch("/api/coordinate");
      if (res.ok) {
        const data = await res.json() as SavedCoordinate[];
        setHistory(data);
      }
    } finally {
      setIsLoadingHistory(false);
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-lg mx-auto px-4 py-12">
        {/* ヘッダー */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-xs tracking-widest text-gray-400 uppercase mb-1">Coordinate</p>
            <h1 className="text-2xl font-light text-gray-900">コーデを提案してもらう</h1>
          </div>
          <button
            onClick={loadHistory}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            {showHistory ? "閉じる" : "保存履歴"}
          </button>
        </div>

        {/* 保存履歴 */}
        {showHistory && (
          <div className="mb-8 space-y-2">
            {isLoadingHistory ? (
              <p className="text-xs text-gray-400 py-4 text-center">読み込み中...</p>
            ) : history.length === 0 ? (
              <p className="text-xs text-gray-400 py-4 text-center">保存済みのコーデはありません</p>
            ) : (
              history.map((c) => (
                <div key={c.id} className="border border-gray-100 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-400">{c.occasion ?? "—"}</span>
                    <span className="text-xs text-gray-300">
                      {new Date(c.created_at).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">{c.color_story}</p>
                </div>
              ))
            )}
          </div>
        )}

        {/* アイテム0件の案内 */}
        {ownedCount === 0 && ownedCount !== null && (
          <div className="mb-6 bg-gray-50 rounded-2xl p-5 text-center">
            <p className="text-2xl mb-2">👗</p>
            <p className="text-sm text-gray-700 font-medium mb-1">クローゼットにアイテムがありません</p>
            <p className="text-xs text-gray-500 mb-4">コーデを生成するには「所有中」のアイテムが必要です</p>
            <Link
              href="/wardrobe"
              className="inline-block px-5 py-2 bg-gray-800 text-white rounded-xl text-sm hover:bg-gray-700 transition-colors"
            >
              アイテムを追加する →
            </Link>
          </div>
        )}

        {/* シーン選択 */}
        <div className="mb-6">
          <p className="text-xs text-gray-500 mb-3">今日のシーンを選んでください</p>
          <div className="grid grid-cols-3 gap-3">
            {SCENES.map((s) => (
              <button
                key={s.value}
                onClick={() => { setScene(s.value); setResult(null); setIsSaved(false); }}
                className={`flex flex-col items-center gap-1.5 p-4 rounded-xl border transition-all ${
                  scene === s.value
                    ? "border-gray-800 bg-gray-800 text-white"
                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-400"
                }`}
              >
                <span className="text-2xl">{s.emoji}</span>
                <span className="text-xs font-medium">{s.value}</span>
                <span className={`text-xs ${scene === s.value ? "text-gray-300" : "text-gray-400"}`}>
                  {s.desc}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* 生成ボタン */}
        <button
          onClick={handleGenerate}
          disabled={isGenerating || ownedCount === 0}
          className="w-full py-4 bg-gray-800 text-white rounded-xl text-sm hover:bg-gray-700 disabled:opacity-40 transition-colors mb-6"
        >
          {isGenerating ? "コーデを考えています..." : "コーデを提案してもらう"}
        </button>

        {/* ローディング */}
        {isGenerating && (
          <div className="text-center py-10 text-gray-300">
            <div className="text-4xl mb-3 animate-pulse">👗</div>
            <p className="text-sm">クローゼットから最適な組み合わせを探しています</p>
          </div>
        )}

        {/* エラー */}
        {error && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-4 mb-4">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* 結果 */}
        {result && !isGenerating && (
          <>
            <CoordinateCard
              coordinate={result.coordinate}
              resolvedItems={result.resolvedItems}
              scene={scene}
              onSave={handleSave}
              isSaving={isSaving}
              isSaved={isSaved}
            />
            {isSaved && (
              <div className="mt-4 bg-gray-50 rounded-xl p-4 flex items-center justify-between">
                <p className="text-sm text-gray-600">保存しました ✓</p>
                <button
                  onClick={loadHistory}
                  className="text-xs text-gray-500 underline underline-offset-2 hover:text-gray-700"
                >
                  保存履歴を見る
                </button>
              </div>
            )}
            <button
              onClick={handleGenerate}
              className="w-full mt-4 py-3 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50 transition-colors"
            >
              別のコーデを提案してもらう
            </button>
          </>
        )}
      </div>
    </div>
  );
}
