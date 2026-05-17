"use client";

// dev 専用: 「今ログイン中のユーザーが誰か」を画面右下に常時表示。
//
// 背景: admin id の取り違え(6bd309dd と思っていたら実体は 7ed5d391 だった)で
// 長時間の混乱が起きたため、その根本対策。email/id が常に視界にあれば
// 同種の取り違えは構造的に起きない。
//
// 本番ガード(必須): NODE_ENV === "production" のときは return null。
// /dev/diagnosis-preview の notFound() と同型の哲学で、本番 bundle に
// user.id/email を出さない(描画自体行わない)。
//
// localStorage 不使用・React state のみ。

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

interface AuthInfo {
  email: string;
  id:    string;
}

export default function DevAuthBadge() {
  // 本番では描画自体しない(user.id/email が本番 bundle に乗らない)
  if (process.env.NODE_ENV === "production") return null;

  const [info, setInfo] = useState<AuthInfo | null>(null);

  useEffect(() => {
    createSupabaseBrowserClient()
      .auth.getUser()
      .then(({ data }) => {
        if (data.user) {
          setInfo({ email: data.user.email ?? "(no email)", id: data.user.id });
        } else {
          setInfo({ email: "未ログイン", id: "-" });
        }
      });
  }, []);

  if (!info) return null;

  // id の先頭 8 文字 + …(フル UUID は長すぎて視覚ノイズ)
  const shortId = info.id === "-" ? "-" : `${info.id.slice(0, 8)}…`;

  return (
    <div
      className="fixed bottom-2 right-2 z-[9999] bg-black/75 text-white text-[10px] px-2 py-1 rounded font-mono pointer-events-none leading-tight"
      aria-hidden="true"
    >
      {info.email}
      <br />
      {shortId}
    </div>
  );
}
