"use client";

// Sprint 39.5: 管理者専用ナレッジ管理ページ
// アクセス制御は middleware.ts で行う（ADMIN_EMAILS allowlist 経由）。
// このページはアクセスできた時点で admin と確定しているため、UI上の追加チェックは不要。

import { useState, useEffect } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import KnowledgeTab from "@/components/knowledge/KnowledgeTab";

export default function AdminKnowledgePage() {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id);
    });
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="mb-6">
          <p className="text-xs tracking-widest text-amber-600 uppercase mb-1">⚠️ Admin</p>
          <h1 className="text-2xl font-light text-gray-900">ナレッジ管理</h1>
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">
            管理者専用ページ。登録・分析した情報源とルールが知識ベース全体の品質に影響します。
            全ユーザーに公開したいルールは Supabase Studio で <code className="text-amber-700">visibility=&apos;admin&apos;</code> に手動で昇格してください。
          </p>
        </div>
        {userId ? (
          <KnowledgeTab userId={userId} />
        ) : (
          <div className="py-10 text-center text-gray-300 text-sm">読み込み中...</div>
        )}
      </div>
    </div>
  );
}
