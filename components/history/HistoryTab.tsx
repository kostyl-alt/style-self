"use client";

import { useState, useEffect } from "react";
import HistoryCard from "./HistoryCard";
import { SavedTab } from "@/components/style/StyleTabs";
import type { AiHistory, AiHistoryListResponse, AiHistoryType } from "@/types/index";

type FilterValue = "all" | AiHistoryType;

const FILTERS: { value: FilterValue; label: string }[] = [
  { value: "all",                label: "すべて" },
  { value: "diagnosis",          label: "診断" },
  { value: "consultation",       label: "相談" },
  { value: "look_analysis",      label: "写真分析" },
  { value: "virtual_coordinate", label: "理想コーデ" },
];

const PAGE_SIZE = 20;

export default function HistoryTab() {
  const [filter, setFilter]               = useState<FilterValue>("all");
  const [histories, setHistories]         = useState<AiHistory[]>([]);
  const [isLoading, setLoading]           = useState(true);
  const [isLoadingMore, setLoadingMore]   = useState(false);
  const [hasMore, setHasMore]             = useState(false);
  const [error, setError]                 = useState<string | null>(null);

  useEffect(() => {
    fetchHistories(filter, 0);
  }, [filter]);

  async function fetchHistories(f: FilterValue, offset: number) {
    if (offset === 0) setLoading(true);
    else setLoadingMore(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (f !== "all") params.set("type", f);
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(offset));
      const res = await fetch(`/api/history?${params.toString()}`);
      const data = await res.json() as AiHistoryListResponse & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "取得に失敗しました");

      if (offset === 0) {
        setHistories(data.histories ?? []);
      } else {
        setHistories((prev) => [...prev, ...(data.histories ?? [])]);
      }
      setHasMore((data.histories ?? []).length === PAGE_SIZE);
    } catch (err) {
      setError(err instanceof Error ? err.message : "取得に失敗しました");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("削除しますか？復元できません。")) return;
    try {
      const res = await fetch(`/api/history/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "削除に失敗しました");
      }
      setHistories((prev) => prev.filter((h) => h.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "削除に失敗しました");
    }
  }

  function handleLoadMore() {
    fetchHistories(filter, histories.length);
  }

  return (
    <div className="space-y-6 mt-4">
      {/* 保存したコーデ */}
      <div>
        <p className="text-xs tracking-widest text-gray-400 uppercase mb-3">Saved Outfits</p>
        <SavedTab />
      </div>

      {/* AI履歴 */}
      <div className="space-y-4">
      <div className="bg-white border border-gray-100 rounded-xl p-4">
        <p className="text-xs tracking-widest text-gray-400 uppercase mb-2">AI History</p>
        <p className="text-xs text-gray-600 leading-relaxed">
          診断・相談・写真分析・理想コーデの過去履歴を見返せます。不要な履歴は削除できます（復元不可）。
        </p>
      </div>

      {/* フィルター */}
      <div className="flex gap-1 bg-gray-50 rounded-xl p-1 overflow-x-auto">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`flex-1 min-w-fit py-1.5 px-3 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
              filter === f.value
                ? "bg-gray-800 text-white"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-2">
          <p className="text-xs text-red-600">{error}</p>
        </div>
      )}

      {/* 履歴リスト */}
      {isLoading ? (
        <div className="text-center py-10 text-gray-300 text-sm">読み込み中...</div>
      ) : histories.length === 0 ? (
        <div className="bg-gray-50 rounded-2xl p-8 text-center">
          <div className="text-3xl mb-2">📚</div>
          <p className="text-sm text-gray-700 font-medium mb-1">履歴がまだありません</p>
          <p className="text-xs text-gray-500">
            {filter === "all"
              ? "AI機能を使うと履歴がここに自動保存されます"
              : "このタイプの履歴はまだありません"}
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {histories.map((h) => (
              <HistoryCard key={h.id} history={h} onDelete={handleDelete} />
            ))}
          </div>
          {hasMore && (
            <button
              onClick={handleLoadMore}
              disabled={isLoadingMore}
              className="w-full py-3 border border-gray-200 text-gray-500 rounded-xl text-sm hover:bg-gray-50 disabled:opacity-40"
            >
              {isLoadingMore ? "読み込み中..." : "もっと見る"}
            </button>
          )}
        </>
      )}
      </div>
    </div>
  );
}
