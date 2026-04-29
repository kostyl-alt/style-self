"use client";

// Sprint 40: アイテム1件分の商品候補リスト
// モバイルは横スクロール（snap）、PC でも同様レイアウト。

import ProductMatchCard from "./ProductMatchCard";
import type { MatchedProduct } from "@/types/index";

interface Props {
  products:  MatchedProduct[];
  isLoading: boolean;
}

export default function ProductMatchList({ products, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="mt-3 pt-3 border-t border-gray-100">
        <p className="text-xs text-gray-400 mb-2">商品候補</p>
        <p className="text-xs text-gray-300">商品候補を読み込み中…</p>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="mt-3 pt-3 border-t border-gray-100">
        <p className="text-xs text-gray-400 mb-1">商品候補</p>
        <p className="text-xs text-gray-300">該当商品が見つかりませんでした</p>
      </div>
    );
  }

  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <p className="text-xs text-gray-400 mb-2">商品候補（{products.length}件）</p>
      <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 -mx-1 px-1 scrollbar-hide">
        {products.map((p) => (
          <div key={p.id} className="snap-start flex-shrink-0 w-44">
            <ProductMatchCard product={p} />
          </div>
        ))}
      </div>
    </div>
  );
}
