// Sprint G-2b: 「商品を探す」ボタン(coordinate_v2 メッセージ下に配置・論点 G2-4)
//
// 設計: docs/STYLE-SELF_Sprint-G-2_商品候補UI_..._設計調査.md(18b2a29)§D
// 押下 → handleSearchProducts(moodboardId)→ /api/products/candidates → products メッセージ。
// moodboardId が無ければ無効(MB 経由コーデでないと商品検索できない)。

"use client";

import { useState } from "react";

interface Props {
  moodboardId: string | null | undefined;
  onSearch:    (moodboardId: string) => void | Promise<void>;
  className?:  string;
}

export default function SearchProductsButton({ moodboardId, onSearch, className = "" }: Props) {
  const [busy, setBusy] = useState(false);
  const ready = typeof moodboardId === "string" && moodboardId !== "" && !busy;

  async function handleClick() {
    if (!ready || !moodboardId) return;
    setBusy(true);
    try {
      await onSearch(moodboardId);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!ready}
      className={`inline-flex items-center gap-1.5 rounded-full border border-gray-300 bg-white px-4 py-1.5 text-xs text-gray-800 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    >
      <span>🛍</span>
      <span>{busy ? "探しています…" : "この方向性で商品を探す"}</span>
    </button>
  );
}
