"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createSupabaseBrowserClient();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(
        error.message === "Invalid login credentials"
          ? "メールアドレスまたはパスワードが正しくありません"
          : "ログインに失敗しました"
      );
      setIsLoading(false);
      return;
    }

    router.push("/onboarding");
    router.refresh();
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
      <div className="mb-8">
        <p className="text-xs tracking-widest text-gray-400 uppercase mb-1">Style Self</p>
        <h1 className="text-2xl font-light text-gray-900">ログイン</h1>
      </div>

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-xs text-gray-500 mb-1.5">
            メールアドレス
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:border-gray-400"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-xs text-gray-500 mb-1.5">
            パスワード
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:border-gray-400"
            placeholder="••••••••"
          />
        </div>

        {error && (
          <p className="text-sm text-red-500">{error}</p>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3 bg-gray-800 text-white rounded-xl text-sm disabled:opacity-40 hover:bg-gray-700 transition-colors mt-2"
        >
          {isLoading ? "ログイン中..." : "ログイン"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-400">
        アカウントをお持ちでない方は{" "}
        <Link href="/signup" className="text-gray-700 hover:underline">
          新規登録
        </Link>
      </p>
    </div>
  );
}
