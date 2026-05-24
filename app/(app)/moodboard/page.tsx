"use client";

// D1 Phase 2 ムードボード: 一覧画面(/moodboard)
//
// Sprint C-2 段階3-A 実装(設計案 60b8d87 §6.1 + 1c0a270 §4.1)
//
// 機能:
//   - 自分の MB 一覧表示(カード形式・cover_image_url + name + is_public バッジ)
//   - 「+ 新規作成」ボタン → 名前入力モーダル → POST /api/moodboards → refetch
//   - 詳細遷移 → /moodboard/[id]
//   - Empty state(初回 CTA)
//
// 既存パターン踏襲(saved/page.tsx 視覚規約 + SavedProductsList 取得パターン)

import { useEffect, useState } from "react";
import Link from "next/link";
import { Image as ImageIcon, Plus, Lock, Globe } from "lucide-react";
import type { MoodboardRow } from "@/types/moodboard";

const NAME_MAX = 200;

export default function MoodboardPage() {
  const [moodboards, setMoodboards] = useState<MoodboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 新規作成モーダル状態
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  // 一覧 fetch
  async function fetchMoodboards(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/moodboards");
      if (!res.ok) {
        if (res.status === 401) {
          setError("ログインが必要です");
        } else {
          setError("読み込みに失敗しました");
        }
        setMoodboards([]);
        return;
      }
      const data = (await res.json()) as { moodboards: MoodboardRow[] };
      setMoodboards(data.moodboards ?? []);
    } catch {
      setError("読み込みに失敗しました");
      setMoodboards([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchMoodboards();
  }, []);

  // 新規作成
  async function handleCreate(): Promise<void> {
    const name = newName.trim();
    if (name === "" || creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/moodboards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string };
        alert(errBody.error ?? "作成に失敗しました");
        return;
      }
      // 成功: モーダル閉じて refetch
      setNewName("");
      setIsCreateOpen(false);
      await fetchMoodboards();
    } catch {
      alert("作成に失敗しました");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="min-h-screen bg-white pb-24">
      <div className="max-w-lg mx-auto px-4 py-12 space-y-8">
        {/* ヘッダ */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs tracking-widest text-gray-400 uppercase mb-1">Moodboard</p>
            <h1 className="text-2xl font-light text-gray-900 flex items-center gap-2">
              <ImageIcon size={22} strokeWidth={1.6} className="text-gray-700" />
              ムードボード
            </h1>
            <p className="text-sm text-gray-500 mt-2 leading-relaxed">
              気になる画像を集めて、自分の世界観を視覚化します。
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="shrink-0 inline-flex items-center gap-1 text-xs px-3 py-2 bg-gray-800 text-white rounded-xl hover:bg-gray-700 transition-colors"
          >
            <Plus size={14} strokeWidth={2} />
            新規作成
          </button>
        </div>

        {/* 本体 */}
        {loading ? (
          <div className="py-10 text-center text-gray-300 text-sm">読み込み中...</div>
        ) : error !== null ? (
          <div className="border border-dashed border-gray-200 rounded-2xl p-6 text-center">
            <p className="text-sm text-gray-400">{error}</p>
          </div>
        ) : moodboards.length === 0 ? (
          <div className="border border-dashed border-gray-200 rounded-2xl p-8 text-center space-y-3">
            <p className="text-sm text-gray-500">ムードボードはまだありません</p>
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex items-center gap-1 text-xs text-gray-700 underline underline-offset-2 hover:text-gray-900"
            >
              <Plus size={12} strokeWidth={2} />
              最初のムードボードを作成
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {moodboards.map((mb) => (
              <MoodboardCard key={mb.id} mb={mb} />
            ))}
          </div>
        )}
      </div>

      {/* 新規作成モーダル(ClosetPickerModal 同型作法) */}
      {isCreateOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40"
            onClick={() => {
              if (!creating) {
                setIsCreateOpen(false);
                setNewName("");
              }
            }}
            aria-hidden="true"
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 space-y-3 pointer-events-auto">
              <p className="text-xs tracking-widest text-gray-400 uppercase">New Moodboard</p>
              <input
                type="text"
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value.slice(0, NAME_MAX))}
                placeholder="ムードボード名(例: 静かな東京の夜)"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:border-gray-400"
                disabled={creating}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newName.trim() !== "") void handleCreate();
                }}
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateOpen(false);
                    setNewName("");
                  }}
                  disabled={creating}
                  className="text-xs px-3 py-1.5 text-gray-500 hover:text-gray-800 disabled:opacity-50"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={creating || newName.trim() === ""}
                  className="text-xs px-3 py-1.5 bg-gray-800 text-white rounded-xl hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                  {creating ? "作成中..." : "作成 →"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ====================================================================
// MoodboardCard — 一覧 1 枚分の表示
// ====================================================================

function MoodboardCard({ mb }: { mb: MoodboardRow }) {
  return (
    <Link
      href={`/moodboard/${mb.id}`}
      className="block group rounded-2xl overflow-hidden border border-gray-100 hover:border-gray-300 transition-colors"
    >
      {/* カバー画像 or プレースホルダ */}
      <div className="relative aspect-square bg-gray-50">
        {mb.cover_image_url !== null && mb.cover_image_url !== "" ? (
          // next/image を使わず素の img(MB cover は public storage URL・任意ドメイン制約なし)
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mb.cover_image_url}
            alt={mb.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300">
            <ImageIcon size={32} strokeWidth={1.4} />
          </div>
        )}
        {/* 公開バッジ(右上) */}
        <span
          className={`absolute top-2 right-2 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full ${
            mb.is_public
              ? "bg-white/90 text-gray-700"
              : "bg-gray-900/70 text-white"
          }`}
        >
          {mb.is_public ? (
            <>
              <Globe size={10} strokeWidth={2} />
              公開
            </>
          ) : (
            <>
              <Lock size={10} strokeWidth={2} />
              非公開
            </>
          )}
        </span>
      </div>
      {/* タイトル + description */}
      <div className="p-2.5 space-y-0.5">
        <p className="text-sm text-gray-800 truncate group-hover:text-gray-900">{mb.name}</p>
        {mb.description !== "" && (
          <p className="text-[11px] text-gray-400 line-clamp-1">{mb.description}</p>
        )}
      </div>
    </Link>
  );
}
