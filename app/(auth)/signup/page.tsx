"use client";

import { useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const supabase = createSupabaseBrowserClient();

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(
        error.message.includes("already registered")
          ? "このメールアドレスはすでに登録されています"
          : "登録に失敗しました"
      );
      setIsLoading(false);
      return;
    }

    setDone(true);
  }

  if (done) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
        <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">✉️</span>
        </div>
        <h2 className="text-lg font-light text-gray-900 mb-2">確認メールを送信しました</h2>
        <p className="text-sm text-gray-400 leading-relaxed">
          {email} に確認メールを送りました。<br />
          メール内のリンクをクリックしてアカウントを有効化してください。
        </p>
        <Link
          href="/login"
          className="inline-block mt-6 text-sm text-gray-600 hover:text-gray-800 underline underline-offset-2"
        >
          ログインページへ
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
      <div className="mb-8">
        <p className="text-xs tracking-widest text-gray-400 uppercase mb-1">Style Self</p>
        <h1 className="text-2xl font-light text-gray-900">新規登録</h1>
      </div>

      <form onSubmit={handleSignup} className="space-y-4">
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
            <span className="text-gray-300 ml-1">（6文字以上）</span>
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
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
          {isLoading ? "登録中..." : "アカウントを作成"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-400">
        すでにアカウントをお持ちの方は{" "}
        <Link href="/login" className="text-gray-700 hover:underline">
          ログイン
        </Link>
      </p>
    </div>
  );
}
