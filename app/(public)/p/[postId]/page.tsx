// M3-4: 投稿個別公開ページ /p/[postId]
//
// M2-3 の /u/[userId]/page.tsx と同型(async Server Component・anon client・
// force-dynamic・service_role 不使用・fallback HTTP200 で存在/非公開/削除を区別しない)。
//
// 【プライバシー】SELECT 句で公開対象の列だけ取得することで、HTML inline 漏洩を
// 構造的に防ぐ。M2-3 の pickPublicFields のような後処理マスクは不要
// (posts はテーブルの個別カラム = SQL レベルでフィールド絞りができる)。
// 取得しない列:
//   - worldview_tags(英語スラッグ・商品マッチ用・公開不要)
//   - pattern_id(内部識別子)
//   - is_public(クエリ条件のみで使用)
//   - updated_at(投稿後変わらないので不要)

import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface PageProps {
  params: { postId: string };
}

// SELECT で取得する列の型(公開対象のみ)。
// posts テーブル全体型は types/database.ts に未掲載のため、本ページで取得する列だけを定義。
interface PostRow {
  id:                 string;
  author_user_id:     string;
  image_url:          string;
  caption:            string;
  worldview_name:     string | null;
  worldview_keywords: string[];
  created_at:         string;
}

export default async function PublicPostPage({ params }: PageProps) {
  const { postId } = params;

  // 不正 UUID は DB クエリを発火せず即 fallback(M2-3 と同じ)
  if (!UUID_RE.test(postId)) {
    return <PostNotFound />;
  }

  const supabase = createSupabaseServerClient();

  // 公開対象の列のみ SELECT。
  //   - .eq("is_public", true): アプリ層フィルタ(RLS と二重防御)
  //   - RLS "public posts readable by anyone" が anon でも is_public=true 行を返す(M3-1)
  //   - types/database.ts に posts 未掲載のため Supabase v2 型推論が never に落ちる箇所は
  //     as 経由で吸収(既存パターン)
  const { data: post } = await supabase
    .from("posts")
    .select("id, author_user_id, image_url, caption, worldview_name, worldview_keywords, created_at")
    .eq("id", postId)
    .eq("is_public", true)
    .maybeSingle() as unknown as { data: PostRow | null };

  // fallback(M2-3 完全踏襲・3 ケース区別しない):
  //   A) 不正 UUID は上で弾いた
  //   B) postId 行が無い(存在しない or 削除済み)→ post が null
  //   C) is_public=false → RLS で post が null
  //   いずれも同 UI(存在判定漏洩防止)
  if (!post) {
    return <PostNotFound />;
  }

  // alt 属性は caption 冒頭 60 字 or 固定文字列(アクセシビリティ最小対応)
  const alt = post.caption.trim().slice(0, 60) || "投稿画像";
  const dateStr = new Date(post.created_at).toLocaleDateString("ja-JP", {
    year: "numeric", month: "long", day: "numeric",
  });

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">
      {/* 画像(本来の比率を保持・上限 80vh) */}
      <div className="bg-gray-50 border border-gray-100 rounded-2xl overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={post.image_url}
          alt={alt}
          className="w-full max-h-[80vh] object-contain bg-gray-100"
          loading="lazy"
        />
      </div>

      {/* caption(本人記述のテキスト・改行保持) */}
      {post.caption && (
        <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
          {post.caption}
        </p>
      )}

      {/* World View セクション(投稿時のスナップショット) */}
      {(post.worldview_name || (post.worldview_keywords && post.worldview_keywords.length > 0)) && (
        <div className="border-t border-gray-100 pt-4 space-y-2">
          <p className="text-[10px] tracking-[0.3em] text-gray-400 uppercase">World View</p>
          {post.worldview_name && (
            <p className="text-sm text-gray-800">
              「{post.worldview_name}」
            </p>
          )}
          {post.worldview_keywords && post.worldview_keywords.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {post.worldview_keywords.slice(0, 5).map((k) => (
                <span key={k} className="text-[11px] text-gray-600 bg-gray-100 rounded-full px-2 py-0.5">
                  #{k}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 投稿者 / 投稿日。投稿者の世界観プロフィールが非公開だった場合
          リンク先(/u/[id])は M2-3 fallback で「見られません」になる(独立・意図通り)。 */}
      <div className="border-t border-gray-100 pt-4 flex items-center justify-between gap-3">
        <Link
          href={`/u/${post.author_user_id}`}
          className="text-xs text-gray-600 hover:text-gray-900 transition-colors"
        >
          投稿者の世界観プロフィールを見る →
        </Link>
        <p className="text-[10px] text-gray-400 whitespace-nowrap">{dateStr}</p>
      </div>
    </div>
  );
}

// fallback(M2-3 と同じ作法・HTTP 200・notFound() 不使用)。
function PostNotFound() {
  return (
    <div className="max-w-md mx-auto px-4 py-20">
      <div className="text-center space-y-4">
        <p className="text-4xl">🌐</p>
        <h1 className="text-lg font-light text-gray-900">この投稿は見られません</h1>
        <p className="text-xs text-gray-500 leading-relaxed">
          非公開、または存在しないページです。
        </p>
        <Link
          href="/"
          className="inline-block text-xs text-gray-500 hover:text-gray-900 transition-colors py-2"
        >
          トップへ戻る
        </Link>
      </div>
    </div>
  );
}
