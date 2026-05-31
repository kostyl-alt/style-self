// Sprint H-3: スレッド一覧の 1 行(選択 / ホバー時ペン・ゴミ箱 / インライン改名)
//
// 設計: docs/STYLE-SELF_Sprint-H-3_左ペイン_スレッド履歴一覧UI_設計調査.md(129bd9f)§B Step6

"use client";

import { useEffect, useRef, useState } from "react";
import type { Thread } from "@/lib/hooks/use-threads";

interface Props {
  thread:   Thread;
  isActive: boolean;
  onSelect: (id: string) => void;
  onRename: (id: string, title: string) => Promise<void> | void;
  onDelete: (id: string) => void;   // ★ 削除確認モーダルを開く
}

// 相対時間(date ライブラリ非依存・MVP)
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffSec = Math.floor((Date.now() - then) / 1000);
  if (diffSec < 60) return "たった今";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}分前`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}時間前`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}日前`;
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function ThreadItem({ thread, isActive, onSelect, onRename, onDelete }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(thread.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) inputRef.current?.focus();
  }, [isEditing]);

  function startEdit(e: React.MouseEvent) {
    e.stopPropagation();
    setDraft(thread.title);
    setIsEditing(true);
  }

  async function commit() {
    const next = draft.trim();
    setIsEditing(false);
    if (next !== "" && next !== thread.title) {
      await onRename(thread.id, next);
    }
  }

  const displayTitle = thread.title.trim() === "" ? "新しいチャット" : thread.title;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(thread.id)}
      onKeyDown={(e) => { if (e.key === "Enter") onSelect(thread.id); }}
      className={`group flex items-center gap-2 px-3 h-14 rounded-lg cursor-pointer transition-colors ${
        isActive ? "bg-gray-100" : "hover:bg-gray-50"
      }`}
    >
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); void commit(); }
              if (e.key === "Escape") { setIsEditing(false); }
            }}
            className="w-full text-sm border border-gray-300 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-gray-400"
          />
        ) : (
          <>
            <p className="text-sm text-gray-800 truncate">{displayTitle}</p>
            <p className="text-xs text-gray-400">{relativeTime(thread.last_message_at)}</p>
          </>
        )}
      </div>

      {!isEditing && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={startEdit}
            aria-label="名前を変更"
            className="text-gray-400 hover:text-gray-700 text-sm px-1"
          >
            ✎
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(thread.id); }}
            aria-label="削除"
            className="text-gray-400 hover:text-red-600 text-sm px-1"
          >
            🗑
          </button>
        </div>
      )}
    </div>
  );
}
