"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import WardrobeItemCard from "@/components/wardrobe/WardrobeItemCard";
import type { WardrobeItem } from "@/types/index";

export default function SavedProductsList() {
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/wardrobe")
      .then((r) => r.json())
      .then((data: WardrobeItem[]) => {
        setItems(data.filter((i) => i.status === "wishlist"));
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="py-10 text-center text-gray-300 text-sm">読み込み中...</div>;
  }

  if (items.length === 0) {
    return (
      <div className="border border-dashed border-gray-200 rounded-2xl p-6 text-center">
        <p className="text-sm text-gray-400 mb-3">保存した商品はまだありません</p>
        <Link href="/outfit?tab=closet" className="inline-block text-xs text-gray-600 underline underline-offset-2 hover:text-gray-900">
          クローゼットで「欲しい」として追加 →
        </Link>
      </div>
    );
  }

  async function handleRemove(id: string) {
    const res = await fetch(`/api/wardrobe?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      setItems((prev) => prev.filter((i) => i.id !== id));
    }
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {items.map((item) => (
        <WardrobeItemCard key={item.id} item={item} onDelete={handleRemove} />
      ))}
    </div>
  );
}
