"use client";

// Sprint 40: 楽天・手動キュレーション商品の単体カード
// Sprint 41.4: 価格・マッチ理由・CTA を強調して視認性を上げる。
// 横スクロール内に並ぶ前提で幅 240px（外側で w-44 指定）。

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
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col shadow-sm hover:shadow-md transition-shadow">
      {/* 商品画像 4:5 */}
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
        {/* マッチ理由バッジ（画像左上にオーバーレイ） */}
        <span className="absolute top-2 left-2 text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full leading-none font-medium shadow-sm">
          {product.matchReason}
        </span>
      </div>

      {/* 本文 */}
      <div className="p-3 flex flex-col gap-1.5 flex-1">
        <p className="text-xs text-gray-500 truncate">{product.brand}</p>
        <p className="text-sm text-gray-800 leading-snug line-clamp-2 min-h-[2.5em]">
          {product.name}
        </p>
        {product.price !== null && (
          <p className="text-base font-semibold text-gray-900 mt-0.5">{formatPrice(product.price)}</p>
        )}

        {/* CTA */}
        {product.productUrl && (
          <a
            href={product.productUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 block w-full text-center py-2 bg-gray-800 text-white rounded-lg text-xs font-medium hover:bg-gray-700 transition-colors"
          >
            商品ページへ →
          </a>
        )}
      </div>
    </div>
  );
}
