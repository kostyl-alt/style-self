"use client";

// Sprint 40: アイテム1件分の商品候補リスト
// Sprint 41.4: セクション全体を amber-50 ボックス化、ローディング時はスケルトン、
//              0件時はソフトな案内を表示。

import ProductMatchCard from "./ProductMatchCard";
import type { MatchedProduct } from "@/types/index";

interface Props {
  products:  MatchedProduct[];
  isLoading: boolean;
}

export default function ProductMatchList({ products, isLoading }: Props) {
  return (
    <div className="mt-4 bg-amber-50/60 border border-amber-100 rounded-2xl p-3">
      <p className="text-sm text-amber-900 mb-2 px-1">
        🛍 おすすめ商品
        {!isLoading && products.length > 0 && (
          <span className="ml-1 font-semibold">{products.length}件</span>
        )}
      </p>

      {isLoading ? (
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex-shrink-0 w-44 bg-white rounded-xl overflow-hidden border border-amber-100 animate-pulse">
              <div className="w-full aspect-[4/5] bg-gray-100" />
              <div className="p-3 space-y-2">
                <div className="h-2.5 bg-gray-100 rounded w-1/2" />
                <div className="h-3 bg-gray-100 rounded w-full" />
                <div className="h-3 bg-gray-100 rounded w-4/5" />
                <div className="h-4 bg-gray-100 rounded w-1/3 mt-2" />
              </div>
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <p className="text-xs text-amber-800/70 px-1 py-2">
          ぴったりの商品がまだ見つかりませんでした。「ZOZOで探す」ボタンから検索してみてください。
        </p>
      ) : (
        <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 -mx-1 px-1 scrollbar-hide">
          {products.map((p) => (
            <div key={p.id} className="snap-start flex-shrink-0 w-44">
              <ProductMatchCard product={p} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
