import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export default async function HomePage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    // 診断撤廃 第1段: onboarding_completed ゲートを撤去。診断を必須にせず認証済は常にチャットへ。
    //   ★ onboarding_completed カラムは無害な死蔵として残置（読まないだけ・DROP しない）。
    //   ★ 診断機能本体（16問・analyze-v2・/onboarding）は無改修＝直アクセス/残存CTAから到達可能。
    redirect("/ai");
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center">
        <p className="text-xs tracking-widest text-gray-300 uppercase mb-4">Style Self</p>
        <h1 className="text-3xl sm:text-4xl font-light text-gray-900 leading-snug mb-4 max-w-md sm:max-w-xl">
          好きな写真を集めるほど、<br />自分だけのスタイルが育っていく。
        </h1>
        <p className="text-sm text-gray-500 leading-relaxed max-w-sm mb-10">
          なんとなく保存した写真にも、惹かれた理由があります。STYLE-SELFは、その「好き」を色・形・素材・雰囲気の視点から整理して、あなたらしい服選びにつなげていきます。
        </p>

        {/* できること */}
        <div className="w-full max-w-md sm:max-w-3xl mb-10">
          <p className="text-xs tracking-widest text-gray-400 uppercase mb-4">できること</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex flex-col gap-2 text-left bg-gray-50 rounded-2xl px-5 py-5">
                <span className="text-2xl leading-none">{f.icon}</span>
                <p className="text-sm text-gray-900 font-medium leading-snug">{f.title}</p>
                <p className="text-xs text-gray-500 leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3 w-full max-w-xs">
          <Link
            href="/signup"
            className="w-full py-3.5 bg-gray-800 text-white rounded-xl text-sm hover:bg-gray-700 transition-colors"
          >
            STYLE-SELFを始める
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
        <p className="text-xs text-gray-200">© 2026 Style Self</p>
      </footer>
    </div>
  );
}

const FEATURES = [
  { icon: "🪞", title: "好きな写真を相談",       description: "言葉にできない「なんか好き」を、色・形・素材・小物から整理します。" },
  { icon: "🌱", title: "自分らしさが見えてくる", description: "相談するほど、惹かれる雰囲気や似合う方向が見えてきます。" },
  { icon: "💬", title: "服選びが楽しくなる",     description: "好きなものを、自分に取り入れる方法を一緒に考えます。" },
];
