// Sprint H-3: 「+ 新しいチャット」ボタン(左ペイン上部・視認性最優先)
//
// 設計: docs/STYLE-SELF_Sprint-H-3_左ペイン_スレッド履歴一覧UI_設計調査.md(129bd9f)§D Step7

"use client";

import { useState } from "react";

interface Props {
  onCreate: () => Promise<void> | void;
}

export default function NewThreadButton({ onCreate }: Props) {
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    if (busy) return;
    setBusy(true);
    try {
      await onCreate();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className="w-full h-10 flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-800 hover:bg-gray-50 disabled:opacity-50 transition-colors"
    >
      <span className="text-base leading-none">＋</span>
      <span>{busy ? "作成中…" : "新しいチャット"}</span>
    </button>
  );
}
