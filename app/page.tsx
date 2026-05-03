import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export default async function HomePage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const { data } = await supabase
      .from("users")
      .select("onboarding_completed")
      .eq("id", user.id)
      .single() as unknown as { data: { onboarding_completed: boolean } | null };
    redirect(data?.onboarding_completed ? "/home" : "/onboarding");
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center">
        <p className="text-xs tracking-widest text-gray-300 uppercase mb-4">Style Self</p>
        <h1 className="text-4xl font-light text-gray-900 leading-snug mb-4">
          あなただけの<br />ファッション世界観を
        </h1>
        <p className="text-sm text-gray-400 leading-relaxed max-w-xs mb-10">
          素材・色・余白・信念軸から、<br />
          自分らしいコーデを設計する。
        </p>

        {/* できること */}
        <div className="w-full max-w-md mb-10">
          <p className="text-xs tracking-widest text-gray-400 uppercase mb-4">できること</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex items-start gap-3 text-left bg-gray-50 rounded-xl px-4 py-3">
                <span className="text-2xl leading-none mt-0.5">{f.icon}</span>
                <div>
                  <p className="text-sm text-gray-900 font-medium leading-tight">{f.title}</p>
                  <p className="text-xs text-gray-500 leading-snug mt-1">{f.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3 w-full max-w-xs">
          <Link
            href="/signup"
            className="w-full py-3.5 bg-gray-800 text-white rounded-xl text-sm hover:bg-gray-700 transition-colors"
          >
            はじめる
          </Link>
          <Link
            href="/login"
            className="w-full py-3.5 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50 transition-colors"
          >
            ログイン
          </Link>
        </div>
      </main>

      <footer className="py-8 text-center">
        <p className="text-xs text-gray-200">© 2024 Style Self</p>
      </footer>
    </div>
  );
}

const FEATURES = [
  { icon: "📊", title: "スタイル診断",   description: "質問に答えて好み・体型を可視化" },
  { icon: "💡", title: "コーデ提案",     description: "季節とシーンから今日の一着を設計" },
  { icon: "🛍",  title: "商品マッチング", description: "提案コーデに合う実物を一発で検索" },
  { icon: "📚", title: "履歴管理",       description: "診断・相談・コーデを振り返れる" },
];
