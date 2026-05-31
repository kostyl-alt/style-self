// Sprint G-2a: 商品候補カード(★ 横長・画像左 / テキスト右・論点 G2-2)
//
// 設計: docs/STYLE-SELF_Sprint-G-2_商品候補UI_..._設計調査.md(18b2a29)§C
// E-0f 実商品試着主軸 / E-0g 服好き感度。reasoning(なぜ合うか)を読ませる横長レイアウト。

"use client";

import type { ProductCandidate } from "@/types/product-candidate";
import SourceBadge from "@/components/chat/SourceBadge";
import TryOnButton from "@/components/chat/TryOnButton";

interface Props {
  candidate: ProductCandidate;
  onTryOn?:  (productId: string) => void;   // ★ G-2b/G-3 で接続
  className?: string;
}

export default function ProductCard({ candidate, onTryOn, className = "" }: Props) {
  const {
    source, source_product_id, title, brand, price,
    image_url, affiliate_url, product_url, reasoning,
  } = candidate;
  const buyUrl = affiliate_url ?? product_url ?? null;

  return (
    <div
      className={`group relative flex gap-3 rounded-xl border border-gray-100 bg-white p-3 transition-shadow hover:shadow-md ${className}`}
    >
      {/* 画像(3:4・object-cover で出品者写真の比率を吸収)*/}
      <div className="relative w-24 shrink-0 overflow-hidden rounded-lg bg-gray-100 sm:w-28">
        <div className="aspect-[3/4]">
          {image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image_url} alt={title} className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">
              画像なし
            </div>
          )}
        </div>
        <SourceBadge source={source} />
      </div>

      {/* テキスト領域 */}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {brand && <p className="truncate text-xs text-gray-400">{brand}</p>}
        <p className="line-clamp-2 text-sm font-medium text-gray-900">{title}</p>
        {reasoning && (
          <p className="line-clamp-3 text-xs leading-relaxed text-gray-600">{reasoning}</p>
        )}
        <p className="mt-0.5 text-sm font-semibold text-gray-900">
          {price !== null ? `¥${price.toLocaleString("ja-JP")}` : "価格未定"}
        </p>

        <div className="mt-auto flex items-center gap-3 pt-1">
          <TryOnButton productId={source_product_id} onTryOn={onTryOn} />
          {buyUrl && (
            <a
              href={buyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-500 underline underline-offset-2 hover:text-gray-800"
            >
              購入ページ
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
