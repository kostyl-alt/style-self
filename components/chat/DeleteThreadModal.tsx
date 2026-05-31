// Sprint H-3: スレッド削除確認モーダル(既存モーダル枠と同型: fixed inset-0 z-50 bg-black/50)
//
// 設計: docs/STYLE-SELF_Sprint-H-3_左ペイン_スレッド履歴一覧UI_設計調査.md(129bd9f)§E Step8

"use client";

import { useState } from "react";

interface Props {
  threadId:    string | null;   // ★ null = 閉じている
  threadTitle: string;
  onClose:     () => void;
  onConfirm:   (id: string) => Promise<void> | void;
}

export default function DeleteThreadModal({ threadId, threadTitle, onClose, onConfirm }: Props) {
  const [busy, setBusy] = useState(false);

  if (threadId === null) return null;

  async function handleConfirm() {
    if (busy || threadId === null) return;
    setBusy(true);
    try {
      await onConfirm(threadId);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  const label = threadTitle.trim() === "" ? "新しいチャット" : threadTitle;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white rounded-2xl p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-1">
          <p className="text-base font-medium text-gray-900">
            「{label}」を削除しますか?
          </p>
          <p className="text-sm text-gray-500">
            メッセージも含めて削除されます。この操作は取り消せません。
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-4 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-100 disabled:opacity-50"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy}
            className="px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {busy ? "削除中…" : "削除"}
          </button>
        </div>
      </div>
    </div>
  );
}
