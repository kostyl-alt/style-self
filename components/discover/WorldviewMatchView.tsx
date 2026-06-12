"use client";

// M4-4: 「世界観が近い」発見タブ本体
//
// 設計: docs/STYLE-SELF_M4_実装設計.md セクション 7
// 構成: ヘッダ + 人セクション(上)+ 投稿セクション(下)
//
// 【データ取得】
// - GET /api/match/users(M4-3)→ 人(1ユーザー1エントリ)
// - GET /api/match/posts(M4-2)→ 投稿(1ユーザー複数投稿あり得る)
// - 並列 fetch・楽観的更新なし(成功確認後にだけ表示)
//
// 【プライバシー(M2-3/M4-2/M4-3 教訓)】
// - API レスポンスに worldview_tags 英語スラッグは無い(M4-2/M4-3 で実証済)
// - UI 側でもスラッグを組み立てない・表示しない
// - 「共通点 N 個」と数値だけで抽象表現
//
// 【導線】
// - 投稿カード → /p/[id](M3-4 既存)
// - 人カード  → /u/[user_id](M2-3/M3-4 既存)
// - 新規ページは作らない・既存導線を流用
//
// 【fallback(設計セクション 7 / 8)】
// - reason "auth_required"      → 未ログイン UI(ログイン誘導)
// - reason "diagnosis_required" → 診断未完了 UI(診断誘導)
// - 該当なし(両方 0 件)         → 「まだ近い人が見つかりません」
// - fetch エラー                  → エラー表示

import { useEffect, useState } from "react";
import Link from "next/link";

interface MatchPostItem {
  id:                  string;
  image_url:           string;
  caption:             string;
  worldview_name:      string | null;
  author_user_id:      string;
  author_display_name: string | null;
  common_tag_count:    number;
  created_at:          string;
}

interface MatchUserItem {
  user_id:          string;
  display_name:     string | null;
  worldview_name:   string;
  common_tag_count: number;
}

type MatchReason = "auth_required" | "diagnosis_required";

interface PostsResp { ok: boolean; posts: MatchPostItem[]; reason?: MatchReason }
interface UsersResp { ok: boolean; users: MatchUserItem[]; reason?: MatchReason }

export default function WorldviewMatchView() {
  const [posts,   setPosts]   = useState<MatchPostItem[]>([]);
  const [users,   setUsers]   = useState<MatchUserItem[]>([]);
  const [reason,  setReason]  = useState<MatchReason | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [postsRes, usersRes] = await Promise.all([
          fetch("/api/match/posts"),
          fetch("/api/match/users"),
        ]);
        if (!postsRes.ok || !usersRes.ok) {
          throw new Error(`HTTP ${postsRes.status}/${usersRes.status}`);
        }
        const postsData = await postsRes.json() as PostsResp;
        const usersData = await usersRes.json() as UsersResp;
        if (cancelled) return;

        // 両 API は同じ reason を返すはず(自分の tags 取得元が同じ)。
        // 食い違ったら投稿側を優先(投稿マッチは表示母数が広いため)。
        const r = postsData.reason ?? usersData.reason ?? null;
        setReason(r);
        setPosts(postsData.posts ?? []);
        setUsers(usersData.users ?? []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "取得に失敗しました");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ===== ローディング =====
  if (loading) {
    return <div className="py-20 text-center text-gray-300 text-sm">読み込み中...</div>;
  }

  // ===== エラー =====
  if (error) {
    return (
      <div className="py-10 text-center space-y-2">
        <p className="text-sm text-rose-700">{error}</p>
        <p className="text-xs text-gray-400">時間を置いて再度開いてください</p>
      </div>
    );
  }

  // ===== 未ログイン =====
  if (reason === "auth_required") {
    return (
      <EmptyState
        title="ログインで世界観マッチが見られます"
        body="あなたと近い世界観の人と投稿に出会えます"
        cta={{ href: "/login", label: "ログイン →" }}
      />
    );
  }

  // ===== 診断未完了 =====
  // 診断撤廃 第4段C: /onboarding への「診断する→」CTA を撤去(リンク先削除のため)。メッセージのみ残す。
  if (reason === "diagnosis_required") {
    return (
      <EmptyState
        title="世界観を診断するとマッチが見えます"
        body="あなたの世界観タグを基準に、近い世界観の人・投稿を集めます"
      />
    );
  }

  // ===== 両方 0 件(該当なし) =====
  if (posts.length === 0 && users.length === 0) {
    return (
      <div className="py-16 text-center space-y-3">
        <p className="text-4xl">🌐</p>
        <p className="text-sm font-medium text-gray-700">まだ近い人が見つかりません</p>
        <p className="text-xs text-gray-400">他のユーザーが世界観を公開し始めるまで少々お待ちください</p>
      </div>
    );
  }

  // ===== 通常表示 =====
  return (
    <div className="space-y-10 py-2">
      {/* 人セクション(上) */}
      {users.length > 0 && (
        <section className="space-y-3">
          <div>
            <p className="text-[10px] tracking-[0.3em] text-gray-400 uppercase">People</p>
            <p className="text-xs text-gray-500 mt-0.5">世界観が近い人</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {users.map((u) => (
              <Link
                key={u.user_id}
                href={`/u/${u.user_id}`}
                className="block border border-gray-100 rounded-xl p-3 hover:bg-gray-50 transition-colors"
              >
                <p className="text-sm font-medium text-gray-900 truncate">
                  {u.display_name ?? "(名前未設定)"}
                </p>
                <p className="text-xs text-gray-500 mt-0.5 truncate">{u.worldview_name}</p>
                <p className="text-[10px] text-gray-400 mt-2">
                  共通点 <span className="text-gray-700">{u.common_tag_count}</span> 個
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 投稿セクション(下) */}
      {posts.length > 0 && (
        <section className="space-y-3">
          <div>
            <p className="text-[10px] tracking-[0.3em] text-gray-400 uppercase">Posts</p>
            <p className="text-xs text-gray-500 mt-0.5">世界観が近い投稿</p>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {posts.map((p) => (
              <Link
                key={p.id}
                href={`/p/${p.id}`}
                className="relative block aspect-square overflow-hidden rounded-md bg-gray-100 hover:opacity-90 transition-opacity"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.image_url}
                  alt={p.caption.trim().slice(0, 40) || "投稿"}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                {/* 共通点バッジ(右上・抽象数値表現) */}
                <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-full bg-white/85 text-[10px] text-gray-700 leading-none">
                  共通 {p.common_tag_count}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function EmptyState({
  title,
  body,
  cta,
}: {
  title: string;
  body:  string;
  cta?:  { href: string; label: string };
}) {
  return (
    <div className="py-16 text-center space-y-4">
      <p className="text-4xl">🌐</p>
      <p className="text-sm font-medium text-gray-700">{title}</p>
      <p className="text-xs text-gray-400 max-w-xs mx-auto leading-relaxed">{body}</p>
      {cta && (
        <Link
          href={cta.href}
          className="inline-block mt-2 px-6 py-3 bg-gray-800 text-white rounded-xl text-sm hover:bg-gray-700 transition-colors"
        >
          {cta.label}
        </Link>
      )}
    </div>
  );
}
