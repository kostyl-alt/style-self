// Sprint G-2a: 「この商品を試す」ボタン(★ 仮 UI・実接続は G-3 /api/products/tryon)
//
// 設計: docs/STYLE-SELF_Sprint-G-2_商品候補UI_..._設計調査.md(18b2a29)§E
// G-2a では Props を受け取り onClick を呼ぶだけ。onClick 未指定なら「準備中」表示(G-3 で接続)。

"use client";

interface Props {
  productId: string;
  onTryOn?:  (productId: string) => void;   // ★ G-2b/G-3 で handleTryOn に接続
  className?: string;
}

export default function TryOnButton({ productId, onTryOn, className = "" }: Props) {
  const ready = typeof onTryOn === "function";
  return (
    <button
      type="button"
      onClick={() => onTryOn?.(productId)}
      disabled={!ready}
      title={ready ? undefined : "準備中(G-3 で有効化)"}
      className={`rounded-lg bg-gray-800 px-3 py-1.5 text-xs text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    >
      この商品を試す
    </button>
  );
}
