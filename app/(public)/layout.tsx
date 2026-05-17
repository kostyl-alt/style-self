// フェーズB M2-3: 公開ページ専用レイアウト
//
// (app) グループは BottomNav を全ページに描画し、その遷移先(/home /discover 等)は
// すべて middleware の appRoutes に登録されているため、anon が BottomNav を
// 触ると /login にバウンスしてしまう。これを避けるため、公開ページは
// (public) グループに独立させて BottomNav なしの最小レイアウトを使う。
//
// 将来 M3 で公開個別ページ(例: /p/[postId])も同じ (public) に並べる想定。

import Link from "next/link";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* ヘッダー: ロゴだけの最小構成 */}
      <header className="border-b border-gray-100">
        <div className="max-w-lg mx-auto px-4 py-4">
          <Link
            href="/"
            className="text-sm tracking-widest text-gray-900 uppercase hover:text-gray-600 transition-colors"
          >
            STYLE-SELF
          </Link>
        </div>
      </header>

      {/* ページ本体 */}
      <main className="flex-1">{children}</main>

      {/* フッター: anon を診断に誘導する控えめな CTA */}
      <footer className="border-t border-gray-100 mt-12">
        <div className="max-w-lg mx-auto px-4 py-8 text-center space-y-3">
          <p className="text-xs text-gray-500 leading-relaxed">
            あなたの世界観も、診断で言語化できます
          </p>
          <Link
            href="/onboarding"
            className="inline-block px-5 py-2.5 bg-gray-800 text-white rounded-xl text-sm hover:bg-gray-700 transition-colors"
          >
            診断を始める →
          </Link>
        </div>
      </footer>
    </div>
  );
}
