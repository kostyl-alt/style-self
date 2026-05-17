// フェーズB M2-3: 公開世界観プロフィール /u/[userId]
//
// 設計判断(オーナー確定):
// A: (public) ルートグループ独立(BottomNav 無し・middleware 認証リダイレクト対象外)
// B: pickPublicFields でマスクして DiagnosisDisplay に渡す(HTML inline 漏洩対策)
// C: 自己プレビューバッジ無し(MVP)
// D: 不正UUID / 非公開 / 未診断 を区別せず同 UI で fallback(存在判定漏洩防止)
// E: fallback の HTTP ステータスは 200(notFound() 不使用)
//
// セキュリティ要点:
// - service_role クライアントは使わない。createSupabaseServerClient() (anon) のみ。
// - from("users") は絶対使わない。public_users view(厳格版・INNER JOIN + is_public=true)
//   のみ使う。これにより email/身体情報/診断データは構造的にアクセス不可能。
// - worldview_profiles も .eq("is_public", true) を明示し、RLS と二重防御。
// - 取得した result jsonb は必ず pickPublicFields() でマスクしてから渡す(本人専用
//   フィールドが HTML inline されないように)。

import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { DiagnosisDisplay } from "@/components/DiagnosisDisplay";
import { pickPublicFields } from "@/lib/utils/worldview-public-fields";
import type { StyleDiagnosisResult } from "@/types/index";

// SSR を強制(supabase クッキー読みに加えて、build 時静的化されないようにする)
export const dynamic = "force-dynamic";

// Postgres UUID 形式の正規表現。malformed param(/u/foo 等)は早期 fallback。
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface PageProps {
  params: { userId: string };
}

export default async function PublicWorldviewPage({ params }: PageProps) {
  const { userId } = params;

  // 不正 UUID は DB クエリを発火せず即 fallback
  if (!UUID_RE.test(userId)) {
    return <PrivateOrNotFound />;
  }

  const supabase = createSupabaseServerClient();

  // クエリ1: worldview_profiles.result を取得
  //   - .eq("is_public", true) はアプリ層フィルタ(RLS と二重防御)
  //   - RLS ポリシー "public worldview profiles readable by anyone" が anon に対しても
  //     is_public=true 行だけ返してくれる(M2-1)
  //   - types/database.ts に is_public 列がまだ無いため、Supabase v2 型推論が never に
  //     落ちる。既存の他ルートと同じ `as unknown as { data: ... }` キャストで吸収。
  const { data: profileRow } = await supabase
    .from("worldview_profiles")
    .select("result")
    .eq("user_id", userId)
    .eq("is_public", true)
    .maybeSingle() as unknown as { data: { result: unknown } | null };

  // 3 ケース(不正UUID は上で弾いた)
  //   A) userId 行が無い(未診断)            → profileRow が null
  //   B) is_public=false(非公開・RLS で弾く) → profileRow が null
  //   C) RPC エラー等                         → profileRow が null
  //   いずれも同 UI fallback(存在判定漏洩を防ぐ)
  if (!profileRow?.result) {
    return <PrivateOrNotFound />;
  }

  // 判断 B: public 対象フィールドだけマスクして DiagnosisDisplay に渡す。
  // HTML inline には本人専用フィールド(avoidedImpression / unconsciousTendency 等)が
  // 一切載らない。
  const masked = pickPublicFields(profileRow.result as StyleDiagnosisResult);

  // クエリ2: display_name は厳格版 view 経由のみ(public_users)。
  // view は内部で INNER JOIN worldview_profiles ON is_public=true なので、
  // 非公開ユーザーの display_name はそもそも返ってこない(M2-1)。
  // users テーブルへの直接アクセスは禁止(email や身体情報の漏洩防止)。
  // public_users は view・types/database.ts に未掲載なので同じくキャスト
  const { data: pu } = await supabase
    .from("public_users")
    .select("display_name")
    .eq("id", userId)
    .maybeSingle() as unknown as { data: { display_name: string | null } | null };

  return (
    <div className="max-w-lg mx-auto px-4 py-10 space-y-6">
      {pu?.display_name && (
        <p className="text-[10px] tracking-[0.3em] text-gray-500 uppercase text-center">
          {pu.display_name}
        </p>
      )}
      <DiagnosisDisplay analysis={masked} viewer="public" />
    </div>
  );
}

// 判断 D: 不正UUID / 非公開 / 未診断 を区別せず同じ UI で表示(存在判定漏洩防止)。
// 判断 E: HTTP 200 で返す(notFound() は使わない・SEO ノイズも防ぐ)。
function PrivateOrNotFound() {
  return (
    <div className="max-w-md mx-auto px-4 py-20">
      <div className="text-center space-y-4">
        <p className="text-4xl">🌐</p>
        <h1 className="text-lg font-light text-gray-900">このプロフィールは見られません</h1>
        <p className="text-xs text-gray-500 leading-relaxed">
          非公開、または存在しないページです。
        </p>
        <div className="flex flex-col gap-2 pt-4">
          <Link
            href="/onboarding"
            className="inline-block px-5 py-2.5 bg-gray-800 text-white rounded-xl text-sm hover:bg-gray-700 transition-colors"
          >
            診断を始める →
          </Link>
          <Link
            href="/"
            className="inline-block text-xs text-gray-500 hover:text-gray-900 transition-colors py-2"
          >
            トップへ戻る
          </Link>
        </div>
      </div>
    </div>
  );
}
