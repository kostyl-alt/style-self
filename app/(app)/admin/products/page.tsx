"use client";

// Sprint 41: 管理者専用 — 商品キュレーション一覧
// アクセス制御は middleware（ADMIN_EMAILS）で行う。

import { useState, useEffect } from "react";
import Link from "next/link";
import type { AdminProduct, AdminProductListResponse } from "@/types/index";

type SourceFilter = "all" | "manual" | "rakuten";

const FILTERS: { value: SourceFilter; label: string }[] = [
  { value: "all",     label: "すべて" },
  { value: "manual",  label: "手動キュレーション" },
  { value: "rakuten", label: "楽天" },
];

export default function AdminProductsPage() {
  const [filter, setFilter]       = useState<SourceFilter>("all");
  const [products, setProducts]   = useState<AdminProduct[]>([]);
  const [isLoading, setLoading]   = useState(true);
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => {
    fetchProducts(filter);
  }, [filter]);

  async function fetchProducts(f: SourceFilter) {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      if (f !== "all") params.set("source", f);
      params.set("limit", "100");
      const res = await fetch(`/api/admin/products?${params.toString()}`);
      const data = await res.json() as AdminProductListResponse & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "取得に失敗しました");
      setProducts(data.products ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("この商品を削除しますか？\n（is_available=false にする論理削除です）")) return;
    try {
      const res = await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "削除に失敗しました");
      }
      setProducts((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "削除に失敗しました");
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs tracking-widest text-amber-600 uppercase mb-1">⚠️ Admin</p>
            <h1 className="text-2xl font-light text-gray-900">商品キュレーション</h1>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              手動登録した商品が理想のコーデのマッチング候補に優先表示されます。
            </p>
          </div>
          <Link
            href="/admin/products/new"
            className="flex-shrink-0 px-4 py-2 bg-gray-800 text-white rounded-xl text-sm hover:bg-gray-700"
          >
            + 新規登録
          </Link>
        </div>

        {/* フィルタ */}
        <div className="flex gap-1 bg-white border border-gray-100 rounded-xl p-1 mb-4">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                filter === f.value
                  ? "bg-gray-800 text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-2 mb-3">
            <p className="text-xs text-red-600">{error}</p>
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-10 text-gray-300 text-sm">読み込み中...</div>
        ) : products.length === 0 ? (
          <div className="bg-gray-50 rounded-2xl p-8 text-center">
            <div className="text-3xl mb-2">📦</div>
            <p className="text-sm text-gray-700 font-medium mb-1">商品がまだありません</p>
            <p className="text-xs text-gray-500">「+ 新規登録」から商品を追加してください</p>
          </div>
        ) : (
          <div className="space-y-2">
            {products.map((p) => (
              <ProductRow key={p.id} product={p} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ProductRow({ product, onDelete }: { product: AdminProduct; onDelete: (id: string) => void }) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-3 flex items-start gap-3">
      <div className="w-20 h-20 rounded-lg bg-gray-50 flex-shrink-0 overflow-hidden">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-2xl text-gray-300">🏷️</div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <span className="text-xs text-gray-500">{product.brand}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full leading-none ${
            product.source === "manual"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-gray-100 text-gray-500"
          }`}>
            {product.source}
          </span>
          {product.curationPriority > 0 && (
            <span className="text-[10px] text-amber-600">⭐{product.curationPriority}</span>
          )}
        </div>
        <p className="text-sm text-gray-800 leading-tight line-clamp-2">{product.name}</p>
        {product.price !== null && (
          <p className="text-xs text-gray-700 mt-1">¥{product.price.toLocaleString("ja-JP")}</p>
        )}
        {product.worldviewTags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {product.worldviewTags.slice(0, 3).map((t) => (
              <span key={t} className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
      <button
        onClick={() => onDelete(product.id)}
        className="flex-shrink-0 self-start px-2 py-1 border border-gray-200 text-gray-400 rounded-lg text-xs hover:text-red-500 hover:border-red-200"
      >
        削除
      </button>
    </div>
  );
}
