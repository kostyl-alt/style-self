"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/self",     label: "SELF",     icon: "👤" },
  { href: "/discover", label: "DISCOVER", icon: "🔍" },
  { href: "/style",    label: "STYLE",    icon: "✨" },
  { href: "/closet",   label: "CLOSET",   icon: "👗" },
  { href: "/learn",    label: "LEARN",    icon: "📖" },
];

export default function BottomNav() {
  const pathname = usePathname();

  if (pathname === "/onboarding") return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-100 safe-area-pb">
      <div className="max-w-2xl mx-auto flex">
        {NAV_ITEMS.map(({ href, label, icon }) => {
          const isActive = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center gap-0.5 py-3 transition-colors ${
                isActive ? "text-gray-900" : "text-gray-400 hover:text-gray-600"
              }`}
            >
              <span className="text-xl leading-none">{icon}</span>
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
