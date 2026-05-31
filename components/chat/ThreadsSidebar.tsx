// Sprint H-3: 左ペイン本体(スレッド履歴一覧 + 新規 + 改名 + 削除 + モバイルドロワー)
//
// 設計: docs/STYLE-SELF_Sprint-H-3_左ペイン_スレッド履歴一覧UI_設計調査.md(129bd9f)§F
// ★ H-3 = 容器。中央チャットとの接続(messages ロード)は H-4。
//   onSelectThread は URL クエリ更新を親(/ai page)に委譲する(currentThreadId は URL 由来)。

"use client";

import { useState } from "react";
import { useThreads } from "@/lib/hooks/use-threads";
import ThreadItem from "@/components/chat/ThreadItem";
import NewThreadButton from "@/components/chat/NewThreadButton";
import DeleteThreadModal from "@/components/chat/DeleteThreadModal";

interface Props {
  currentThreadId: string | null;
  onSelectThread:  (id: string | null) => void;
}

export default function ThreadsSidebar({ currentThreadId, onSelectThread }: Props) {
  const { threads, loading, error, refresh, create, rename, remove } = useThreads();
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  async function handleCreate() {
    const t = await create();
    if (t) {
      onSelectThread(t.id);
      setIsMobileOpen(false);
    }
  }

  function handleSelect(id: string) {
    onSelectThread(id);
    setIsMobileOpen(false);
  }

  async function handleConfirmDelete(id: string) {
    await remove(id);
    // 削除対象が選択中なら選択解除(親が URL をクリア)
    if (id === currentThreadId) onSelectThread(null);
  }

  const deleteTarget = threads.find((t) => t.id === deleteTargetId);

  // 一覧本体(デスクトップ / モバイルドロワー共通)
  const listContent = (
    <div className="flex flex-col h-full">
      <div className="p-3">
        <NewThreadButton onCreate={handleCreate} />
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {loading ? (
          <p className="text-sm text-gray-400 px-3 py-2">読み込み中…</p>
        ) : error ? (
          <div className="px-3 py-2 space-y-2">
            <p className="text-sm text-red-600">{error}</p>
            <button
              type="button"
              onClick={() => void refresh()}
              className="text-xs text-gray-600 underline"
            >
              再読み込み
            </button>
          </div>
        ) : threads.length === 0 ? (
          <div className="px-3 py-6 text-center space-y-1">
            <p className="text-sm text-gray-500">まだチャットがありません</p>
            <p className="text-xs text-gray-400">「＋ 新しいチャット」を押して始めましょう</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {threads.map((t) => (
              <ThreadItem
                key={t.id}
                thread={t}
                isActive={t.id === currentThreadId}
                onSelect={handleSelect}
                onRename={rename}
                onDelete={(id) => setDeleteTargetId(id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* デスクトップ: 280px 固定サイドバー */}
      <aside className="hidden lg:flex lg:flex-col w-72 shrink-0 h-screen border-r border-gray-100 bg-gray-50">
        {listContent}
      </aside>

      {/* モバイル: ハンバーガー(左上固定)*/}
      <button
        type="button"
        onClick={() => setIsMobileOpen(true)}
        aria-label="チャット履歴を開く"
        className="lg:hidden fixed top-3 left-3 z-40 w-9 h-9 flex items-center justify-center rounded-lg bg-white/90 border border-gray-200 text-gray-600 text-lg shadow-sm"
      >
        ≡
      </button>

      {/* モバイル: ドロワー + オーバーレイ */}
      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="w-72 max-w-[80%] h-full bg-gray-50 border-r border-gray-100 shadow-xl">
            <div className="flex justify-end p-2">
              <button
                type="button"
                onClick={() => setIsMobileOpen(false)}
                aria-label="閉じる"
                className="text-gray-500 hover:text-gray-800 text-xl px-2"
              >
                ×
              </button>
            </div>
            {listContent}
          </div>
          <div className="flex-1 bg-black/50" onClick={() => setIsMobileOpen(false)} />
        </div>
      )}

      <DeleteThreadModal
        threadId={deleteTargetId}
        threadTitle={deleteTarget?.title ?? ""}
        onClose={() => setDeleteTargetId(null)}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}
