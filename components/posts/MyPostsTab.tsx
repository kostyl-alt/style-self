"use client";

// M3-5: 自分の投稿一覧 + 削除UI
//
// /self?tab=posts で表示される本人専用の管理タブ。
//
// 【設計】
// - 認証 client(createSupabaseBrowserClient)で本人 posts を取得
//   RLS "users own posts" FOR ALL が auth.uid() = author_user_id を要求 →
//   構造的に本人の行のみ
// - 自分のは is_public 含めて全部見える(非公開含め振り返り・削除導線)
// - 各サムネは /p/[id] へリンク(自分の投稿が他者にどう見えるか確認)
// - 各サムネ右上にゴミ箱 → 確認モーダル(画像/caption プレビュー付き)
//   = M2-4 WorldviewPublicityPanel と同型の作法(誤操作防止)
// - 楽観的更新なし: DELETE /api/posts/[id] の ok:true 確認後のみ一覧から除去
//   = 「失敗したのに消えた表示」が構造的に起きない
// - 二重押下防止: 削除実行中はキャンセル/削除ボタン disabled

import { useState, useEffect } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

interface MyPost {
  id:          string;
  image_url:   string;
  caption:     string;
  is_public:   boolean;
  created_at:  string;
}

export default function MyPostsTab() {
  const [posts, setPosts]           = useState<MyPost[]>([]);
  const [loading, setLoading]       = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // 削除確認モーダル + 削除実行 state
  const [deleteTarget, setDeleteTarget] = useState<MyPost | null>(null);
  const [deleting, setDeleting]         = useState(false);
  const [deleteError, setDeleteError]   = useState<string | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(async ({ data: authData, error: authErr }) => {
      if (authErr || !authData.user) {
        setFetchError("ログインが必要です");
        setLoading(false);
        return;
      }
      // SELECT 句で公開対象 + 公開フラグだけ取得(他カラムは構造的に取らない)
      const { data, error } = await supabase
        .from("posts")
        .select("id, image_url, caption, is_public, created_at")
        .eq("author_user_id", authData.user.id)
        .order("created_at", { ascending: false })
        .limit(50) as unknown as {
          data: MyPost[] | null;
          error: { message: string } | null;
        };
      if (error) {
        setFetchError(error.message);
      } else {
        setPosts(data ?? []);
      }
      setLoading(false);
    });
  }, []);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/posts/${deleteTarget.id}`, { method: "DELETE" });
      const data = await res.json() as { ok?: boolean; deletedId?: string; error?: string };
      if (!res.ok || !data.ok) {
        // 失敗: モーダル内にエラー表示・一覧は変えない(楽観的更新なし)
        setDeleteError(data.error ?? `HTTP ${res.status}`);
        return;
      }
      // 成功確定後にのみ一覧から除去 + モーダル閉じる
      setPosts((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "通信に失敗しました");
    } finally {
      setDeleting(false);
    }
  }

  // ===== ローディング =====
  if (loading) {
    return <div className="py-20 text-center text-gray-300 text-sm">読み込み中...</div>;
  }

  // ===== 取得エラー =====
  if (fetchError) {
    return (
      <div className="py-10 text-center space-y-3">
        <p className="text-sm text-rose-700">{fetchError}</p>
      </div>
    );
  }

  // ===== 0 件 =====
  if (posts.length === 0) {
    return (
      <div className="py-16 text-center space-y-4">
        <p className="text-4xl">🖼️</p>
        <p className="text-sm font-medium text-gray-700">まだ投稿がありません</p>
        <p className="text-xs text-gray-400">画像 + キャプションで世界観を投稿しましょう</p>
        <Link
          href="/self/new-post"
          className="inline-block mt-2 px-6 py-3 bg-gray-800 text-white rounded-xl text-sm hover:bg-gray-700 transition-colors"
        >
          投稿を作る →
        </Link>
      </div>
    );
  }

  // ===== 通常表示 =====
  return (
    <div className="py-4 space-y-4">
      <div>
        <p className="text-[10px] tracking-[0.3em] text-gray-400 uppercase">My Posts</p>
        <p className="text-xs text-gray-500 mt-0.5">{posts.length} 件</p>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {posts.map((p) => (
          <div key={p.id} className="relative group">
            <Link
              href={`/p/${p.id}`}
              className="block aspect-square overflow-hidden rounded-md bg-gray-100 hover:opacity-90 transition-opacity"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.image_url}
                alt={p.caption.trim().slice(0, 40) || "投稿"}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </Link>
            {/* ゴミ箱ボタン(右上・確認モーダルを開くだけ) */}
            <button
              type="button"
              onClick={() => { setDeleteError(null); setDeleteTarget(p); }}
              className="absolute top-1.5 right-1.5 w-7 h-7 flex items-center justify-center rounded-full bg-white/85 hover:bg-white text-rose-600 border border-white shadow-sm transition-colors"
              aria-label="この投稿を削除"
            >
              <Trash2 size={14} strokeWidth={1.8} />
            </button>
          </div>
        ))}
      </div>

      {/* 削除確認モーダル(M2-4 publicity 確認モーダルと同型) */}
      {deleteTarget && (
        <DeleteConfirmModal
          target={deleteTarget}
          deleting={deleting}
          error={deleteError}
          onCancel={() => { if (!deleting) { setDeleteTarget(null); setDeleteError(null); } }}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}

// 削除確認モーダル
// - 対象の画像 + caption をプレビュー(「これを消す」を視覚的に示す = 誤削除防止)
// - キャンセル(左)/ 削除する(右・rose 警告色)
// - 削除中は両ボタン disabled(二重押下防止)
function DeleteConfirmModal({
  target,
  deleting,
  error,
  onCancel,
  onConfirm,
}: {
  target:    MyPost;
  deleting:  boolean;
  error:     string | null;
  onCancel:  () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-4 py-6"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <header>
          <h2 className="text-lg font-medium text-gray-900">この投稿を削除しますか?</h2>
          <p className="text-xs text-rose-700 mt-1">
            取り消せません。削除した投稿は元に戻せません。
          </p>
        </header>

        {/* 対象プレビュー(画像 + caption) */}
        <div className="border border-gray-100 rounded-2xl overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={target.image_url}
            alt={target.caption.trim().slice(0, 40) || "投稿"}
            className="w-full max-h-60 object-cover bg-gray-50"
          />
          {target.caption && (
            <p className="text-xs text-gray-700 px-3 py-2 leading-relaxed whitespace-pre-wrap line-clamp-4">
              {target.caption}
            </p>
          )}
        </div>

        {error && (
          <p className="text-xs text-rose-700">{error}</p>
        )}

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            className="flex-1 px-4 py-3 border border-gray-200 text-gray-700 rounded-xl text-sm hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="flex-1 px-4 py-3 bg-rose-600 text-white rounded-xl text-sm hover:bg-rose-700 disabled:opacity-50 transition-colors"
          >
            {deleting ? "削除中…" : "削除する"}
          </button>
        </div>
      </div>
    </div>
  );
}
