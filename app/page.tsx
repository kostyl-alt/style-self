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
    redirect(data?.onboarding_completed ? "/closet" : "/onboarding");
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <p className="text-xs tracking-widest text-gray-300 uppercase mb-4">Style Self</p>
        <h1 className="text-4xl font-light text-gray-900 leading-snug mb-4">
          あなただけの<br />ファッション世界観を
        </h1>
        <p className="text-sm text-gray-400 leading-relaxed max-w-xs mb-10">
          素材・色・余白・信念軸から、<br />
          自分らしいコーデを設計する。
        </p>

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
