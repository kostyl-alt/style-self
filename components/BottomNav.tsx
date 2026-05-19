"use client";

// P1-B: BottomNav 5→3 タブ集約(チャット主役型・判断 2 + 判断 1)
//
// 設計: docs/STYLE-SELF_D1_実装設計.md Phase 1 P1-B
//
// 【変更】
//   旧 5 タブ: ホーム / 発見 / 保存 / コーデ / 自分
//   新 3 タブ: AI(/ai)/ 保存(/saved)/ 自分(/self)
//
// 【判断 2: 旧タブ URL 残置(段階削除・P1-B では削除しない)】
//   /home /discover /outfit の画面ファイル・URL は完全に残す。
//   直アクセス(旧 shim 経由 / SNS 共有 / ブックマーク等)では従来通り開く。
//   BottomNav からは外すだけ。実削除は Phase 2+ で再判断。
//
// 【判断 5: 投稿管理は自分タブ内維持】
//   /self は M3 投稿管理(/self?tab=posts)を含めて従来通り。

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles, Bookmark, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const NAV_ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/ai",    label: "AI",   icon: Sparkles },
  { href: "/saved", label: "保存", icon: Bookmark },
  { href: "/self",  label: "自分", icon: User },
];

export default function BottomNav() {
  const pathname = usePathname();

  if (pathname === "/onboarding") return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-100 safe-area-pb">
      <div className="max-w-2xl mx-auto flex">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors ${
                isActive ? "text-gray-900" : "text-gray-400 hover:text-gray-600"
              }`}
            >
              <Icon size={20} strokeWidth={isActive ? 2 : 1.6} />
              <span className={`text-[10px] leading-tight ${isActive ? "font-semibold" : ""}`}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
