"use client";

// Sprint 40: 楽天商品の単体カード
// 横スクロール内に並ぶ前提で幅 240px 固定。

import type { MatchedProduct } from "@/types/index";

interface Props {
  product: MatchedProduct;
}

function formatPrice(price: number | null): string {
  if (price === null) return "";
  return `¥${price.toLocaleString("ja-JP")}`;
}

export default function ProductMatchCard({ product }: Props) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl overflow-hidden flex flex-col">
      {/* 商品画像 16:9 */}
      <div className="relative w-full aspect-[4/5] bg-gray-50 overflow-hidden">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl text-gray-300">
            🏷️
          </div>
        )}
      </div>

      {/* 本文 */}
      <div className="p-3 flex flex-col gap-1.5 flex-1">
        <p className="text-xs text-gray-500 truncate">{product.brand}</p>
        <p className="text-sm text-gray-800 leading-snug line-clamp-2 min-h-[2.5em]">
          {product.name}
        </p>
        {product.price !== null && (
          <p className="text-sm font-medium text-gray-900">{formatPrice(product.price)}</p>
        )}
        <span className="inline-block self-start text-[10px] px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded-full leading-none mt-1">
          {product.matchReason}
        </span>

        {/* 詳細ボタン */}
        {product.productUrl && (
          <a
            href={product.productUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 block w-full text-center py-2 border border-gray-800 text-gray-800 rounded-lg text-xs hover:bg-gray-800 hover:text-white transition-colors"
          >
            詳細を見る →
          </a>
        )}
      </div>
    </div>
  );
}
