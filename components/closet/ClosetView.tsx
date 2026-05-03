"use client";

import { useState, useEffect, useCallback } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import WardrobeItemCard from "@/components/wardrobe/WardrobeItemCard";
import PurchaseCheckPanel from "@/components/wardrobe/PurchaseCheckPanel";
import AddItemModal, { COMPATIBILITY_LABELS } from "@/components/wardrobe/AddItemModal";
import { deleteWardrobeImage } from "@/lib/storage";
import type { WardrobeItem, WardrobeCategory, WardrobeStatus, WardrobeCompatibilityAIResponse } from "@/types/index";

const CATEGORY_OPTIONS: { value: WardrobeCategory | "all"; label: string }[] = [
  { value: "all",         label: "すべて" },
  { value: "tops",        label: "トップス" },
  { value: "bottoms",     label: "ボトムス" },
  { value: "outerwear",   label: "アウター" },
  { value: "jacket",      label: "ジャケット" },
  { value: "vest",        label: "ベスト" },
  { value: "inner",       label: "インナー" },
  { value: "dress",       label: "ワンピース" },
  { value: "setup",       label: "セットアップ" },
  { value: "shoes",       label: "シューズ" },
  { value: "bags",        label: "バッグ" },
  { value: "accessories", label: "アクセサリー" },
  { value: "hat",         label: "帽子" },
  { value: "jewelry",     label: "ジュエリー" },
  { value: "roomwear",    label: "ルームウェア" },
  { value: "other",       label: "その他" },
];

const STATUS_TABS: { value: WardrobeStatus | "all"; label: string }[] = [
  { value: "all",         label: "すべて" },
  { value: "owned",       label: "所有中" },
  { value: "considering", label: "検討中" },
  { value: "wishlist",    label: "欲しい" },
  { value: "passed",      label: "見送り" },
];

interface CompatibilityToast {
  result: WardrobeCompatibilityAIResponse;
  itemName: string;
}

export default function ClosetView({ embedded = false }: { embedded?: boolean }) {
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [statusTab, setStatusTab] = useState<WardrobeStatus | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<WardrobeCategory | "all">("all");
  const [colorFilter, setColorFilter] = useState("");
  const [toast, setToast] = useState<CompatibilityToast | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string; imageUrl: string | null } | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/wardrobe");
      if (res.ok) {
        const data = await res.json() as WardrobeItem[];
        setItems(data);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  function handleAdded(item: WardrobeItem, compatibility: WardrobeCompatibilityAIResponse | null) {
    setItems((prev) => [item, ...prev]);
    setShowModal(false);
    if (compatibility) {
      setToast({ result: compatibility, itemName: item.name });
      setTimeout(() => setToast(null), 5000);
    }
  }

  async function handleStatusChange(id: string, status: WardrobeStatus) {
    const res = await fetch("/api/wardrobe", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (res.ok) {
      setItems((prev) => prev.map((i) => i.id === id ? { ...i, status } : i));
    }
  }

  function handleDelete(id: string, imageUrl: string | null) {
    const item = items.find((i) => i.id === id);
    setDeleteConfirm({ id, name: item?.name ?? "このアイテム", imageUrl });
  }

  async function confirmDelete() {
    if (!deleteConfirm) return;
    const { id, imageUrl } = deleteConfirm;
    setDeleteConfirm(null);
    const res = await fetch(`/api/wardrobe?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      setItems((prev) => prev.filter((i) => i.id !== id));
      if (imageUrl) {
        await deleteWardrobeImage(imageUrl).catch(() => null);
      }
    }
  }

  const filteredItems = items.filter((item) => {
    const matchStatus   = statusTab === "all" || item.status === statusTab;
    const matchCategory = categoryFilter === "all" || item.category === categoryFilter;
    const matchColor    = !colorFilter || item.color.includes(colorFilter);
    return matchStatus && matchCategory && matchColor;
  });

  const colors = Array.from(new Set(items.map((i) => i.color).filter(Boolean)));

  const Wrapper = embedded
    ? ({ children }: { children: React.ReactNode }) => <div>{children}</div>
    : ({ children }: { children: React.ReactNode }) => (
        <div className="min-h-screen bg-white">
          <div className="max-w-2xl mx-auto px-4 py-12">{children}</div>
        </div>
      );

  return (
    <Wrapper>
      <div className="flex items-end justify-between mb-6">
        {!embedded && (
          <div>
            <p className="text-xs tracking-widest text-gray-400 uppercase mb-1">Wardrobe</p>
            <h1 className="text-2xl font-light text-gray-900">クローゼット</h1>
          </div>
        )}
        <button
          onClick={() => setShowModal(true)}
          className={`px-4 py-2 bg-gray-800 text-white rounded-xl text-sm hover:bg-gray-700 transition-colors ${embedded ? "ml-auto" : ""}`}
        >
          + 追加
        </button>
      </div>

      <div className="flex gap-1 bg-gray-50 rounded-xl p-1 mb-4">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => { setStatusTab(tab.value); setCategoryFilter("all"); setColorFilter(""); }}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
              statusTab === tab.value ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="space-y-3 mb-6">
        <div className="flex gap-2">
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value as WardrobeCategory | "all")}
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-700 bg-white focus:outline-none focus:border-gray-400">
            {CATEGORY_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        </div>

        {colors.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button onClick={() => setColorFilter("")}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs border transition-all ${
                !colorFilter ? "bg-gray-100 text-gray-700 border-gray-200" : "bg-white text-gray-500 border-gray-100 hover:border-gray-300"
              }`}>全色</button>
            {colors.map((c) => (
              <button key={c} onClick={() => setColorFilter(colorFilter === c ? "" : c)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs border transition-all ${
                  colorFilter === c ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                }`}>{c}</button>
            ))}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-20 text-gray-300 text-sm">読み込み中...</div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-300 text-4xl mb-4">👗</p>
          <p className="text-sm text-gray-400">{items.length === 0 ? "まだアイテムがありません" : "該当するアイテムがありません"}</p>
          {items.length === 0 && (
            <button onClick={() => setShowModal(true)} className="mt-4 text-sm text-gray-600 underline underline-offset-2">
              最初のアイテムを追加する
            </button>
          )}
        </div>
      ) : (
        <>
          <p className="text-xs text-gray-400 mb-4">{filteredItems.length} アイテム</p>
          {statusTab === "considering" ? (
            <div className="space-y-3">
              {filteredItems.map((item) => <PurchaseCheckPanel key={item.id} item={item} onStatusChange={handleStatusChange} />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filteredItems.map((item) => <WardrobeItemCard key={item.id} item={item} onDelete={handleDelete} />)}
            </div>
          )}
        </>
      )}

      {showModal && userId && (
        <AddItemModal userId={userId} onClose={() => setShowModal(false)} onAdded={handleAdded} />
      )}

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm">
          <div className="bg-white border border-gray-100 rounded-2xl shadow-lg px-5 py-4">
            <div className="flex items-start gap-3">
              <div className={`text-xs px-2 py-1 rounded-full font-medium flex-shrink-0 ${COMPATIBILITY_LABELS[toast.result.compatibility].color}`}>
                {COMPATIBILITY_LABELS[toast.result.compatibility].label}
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">{toast.itemName}</p>
                <p className="text-sm text-gray-800">{toast.result.comment}</p>
              </div>
              <button onClick={() => setToast(null)} className="text-gray-300 hover:text-gray-500 text-xs flex-shrink-0">✕</button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center pb-24 px-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setDeleteConfirm(null)} />
          <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-xl p-6">
            <p className="text-sm font-medium text-gray-900 mb-1">アイテムを削除しますか？</p>
            <p className="text-xs text-gray-500 mb-5">「{deleteConfirm.name}」を削除します。この操作は取り消せません。</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50 transition-colors">キャンセル</button>
              <button onClick={confirmDelete} className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-sm hover:bg-red-600 transition-colors">削除する</button>
            </div>
          </div>
        </div>
      )}
    </Wrapper>
  );
}
