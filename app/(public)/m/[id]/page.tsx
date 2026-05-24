// D1 Phase 2 ムードボード公開ページ /m/[id]
//
// Sprint C-2 段階3-C 実装(設計案 60b8d87 §6.3)
//
// 設計作法: app/(public)/p/[postId]/page.tsx(M3-4)/ app/(public)/u/[userId]/page.tsx(M2-3)同型
//   - async Server Component(no "use client")
//   - createSupabaseServerClient()(anon でも RLS 経由で公開のみ返る)
//   - force-dynamic
//   - service_role 不使用
//   - 404 fallback(存在/非公開/削除を区別しない)
//   - 列絞り SELECT(worldview_tags 等含めない・三重防御 1)
//
// 【プライバシー】
//   - moodboards.worldview_tags / worldview_keywords / user_id を SELECT 句に書かない
//   - moodboard_items.image_url / caption / source_url のみ取得
//   - 編集 / 削除 / 画像追加 UI は ★ 一切表示しない(read-only)

import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  ESSENTIAL_CATEGORIES,
  ESSENTIAL_LABELS,
  detectEssentials,
  extractCategory,
  stripCategoryPrefix,
} from "@/lib/utils/moodboard-essentials";
import { Image as ImageIcon, Globe, Check } from "lucide-react";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface PageProps {
  params: { id: string };
}

// SELECT で取得する列のみ定義(公開対象・列絞り)
interface MoodboardPublicRow {
  id:              string;
  name:            string;
  description:     string;
  cover_image_url: string | null;
  worldview_name:  string | null;
  created_at:      string;
}

interface MoodboardItemPublicRow {
  id:           string;
  image_url:    string;
  caption:      string;
  source_url:   string | null;
  order_index:  number;
}

export default async function PublicMoodboardPage({ params }: PageProps) {
  const { id } = params;

  // 不正 UUID は DB クエリを発火せず即 fallback(M3-4 同型)
  if (!UUID_RE.test(id)) {
    return <MoodboardNotFound />;
  }

  const supabase = createSupabaseServerClient();

  // moodboards 取得(公開対象の列のみ・worldview_tags / user_id / is_public 含めない)
  //   - .eq("is_public", true): アプリ層フィルタ(RLS と二重防御)
  //   - RLS "public moodboards readable by anyone" が anon でも is_public=true 行を返す
  const { data: mb } = await supabase
    .from("moodboards")
    .select("id, name, description, cover_image_url, worldview_name, created_at")
    .eq("id", id)
    .eq("is_public", true)
    .maybeSingle() as unknown as { data: MoodboardPublicRow | null };

  // fallback(M3-4 完全踏襲・3 ケース区別しない):
  //   A) 不正 UUID は上で弾いた
  //   B) id 行が無い(存在しない or 削除済み)→ mb が null
  //   C) is_public=false → RLS で mb が null
  if (!mb) {
    return <MoodboardNotFound />;
  }

  // items 取得(列絞り・親 moodboards.is_public=true 経由 RLS で anon に返る)
  const { data: itemsRaw } = await supabase
    .from("moodboard_items")
    .select("id, image_url, caption, source_url, order_index")
    .eq("moodboard_id", id)
    .order("order_index", { ascending: true }) as unknown as { data: MoodboardItemPublicRow[] | null };

  const items: MoodboardItemPublicRow[] = itemsRaw ?? [];

  // 必須要素 8 カバー状況(段階3-B v2 と同型・読み取り専用)
  const coverage = detectEssentials(mb.description, items);

  const dateStr = new Date(mb.created_at).toLocaleDateString("ja-JP", {
    year: "numeric", month: "long", day: "numeric",
  });

  return (
    <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
      {/* ヘッダ */}
      <div>
        <p className="text-xs tracking-widest text-gray-400 uppercase mb-1">Moodboard</p>
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-light text-gray-900">{mb.name}</h1>
          <span className="shrink-0 inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
            <Globe size={11} strokeWidth={2} />
            公開
          </span>
        </div>
        <p className="text-[11px] text-gray-400 mt-2">{dateStr}</p>
      </div>

      {/* メインビジュアル */}
      <div className="relative aspect-video bg-gray-50 rounded-2xl overflow-hidden">
        {mb.cover_image_url !== null && mb.cover_image_url !== "" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mb.cover_image_url}
            alt={mb.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300">
            <ImageIcon size={40} strokeWidth={1.4} />
          </div>
        )}
      </div>

      {/* コンセプト(description) */}
      {mb.description !== "" && (
        <section className="space-y-2">
          <p className="text-xs tracking-widest text-gray-400 uppercase">Concept</p>
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{mb.description}</p>
        </section>
      )}

      {/* 必須要素 8 進捗 + チェックリスト(read-only・段階3-B v2 同型) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs tracking-widest text-gray-400 uppercase">Essentials</p>
          <span className="text-[11px] text-gray-500">{coverage.size}/8 カバー</span>
        </div>
        <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full ${coverage.size === 8 ? "bg-gray-800" : "bg-gray-400"}`}
            style={{ width: `${(coverage.size / 8) * 100}%` }}
          />
        </div>
        <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5">
          {ESSENTIAL_CATEGORIES.map((c) => {
            const isCovered = coverage.has(c);
            return (
              <li
                key={c}
                className={`flex items-center gap-1.5 text-[12px] ${isCovered ? "text-gray-800" : "text-gray-400"}`}
              >
                {isCovered ? (
                  <Check size={11} strokeWidth={2.5} className="text-gray-700" />
                ) : (
                  <span className="inline-block w-[11px] text-center">・</span>
                )}
                {ESSENTIAL_LABELS[c]}
              </li>
            );
          })}
        </ul>
      </section>

      {/* items グリッド(read-only) */}
      <section className="space-y-3">
        <p className="text-xs tracking-widest text-gray-400 uppercase">Moodboard</p>
        {items.length === 0 ? (
          <div className="border border-dashed border-gray-200 rounded-2xl p-6 text-center">
            <p className="text-sm text-gray-400">画像はまだありません</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {items.map((item) => (
              <PublicItemCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ====================================================================
// PublicItemCard(read-only・段階3-B ItemCard 簡略版・独自実装)
// ====================================================================

function PublicItemCard({ item }: { item: MoodboardItemPublicRow }) {
  const category = extractCategory(item.caption);
  const captionBody = stripCategoryPrefix(item.caption);

  return (
    <div className="rounded-2xl overflow-hidden border border-gray-100">
      <div className="aspect-square bg-gray-50 relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.image_url}
          alt={captionBody || "moodboard item"}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        {category !== null && (
          <span className="absolute top-1.5 left-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-white/90 text-gray-700">
            {ESSENTIAL_LABELS[category]}
          </span>
        )}
      </div>
      {captionBody !== "" && (
        <p className="text-[11px] text-gray-600 truncate px-2 py-1.5">{captionBody}</p>
      )}
    </div>
  );
}

// ====================================================================
// MoodboardNotFound(M3-4 PostNotFound 同型)
// ====================================================================

function MoodboardNotFound() {
  return (
    <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-4">
      <p className="text-sm text-gray-500">このムードボードは見られません</p>
      <p className="text-[11px] text-gray-400 leading-relaxed">
        非公開設定 / 削除済み / URL が間違っている可能性があります
      </p>
      <Link
        href="/"
        className="inline-block text-xs text-gray-700 underline underline-offset-2 hover:text-gray-900"
      >
        トップへ戻る →
      </Link>
    </div>
  );
}
