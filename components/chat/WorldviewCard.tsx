"use client";

// A-5 P1-D: ChatPage 上部世界観カード
//
// 設計: docs/STYLE-SELF_D1_A-5_P1-D_設計調査.md(c126f76)§3.1
//
// 振る舞い:
//   ・診断済(worldview != null): worldviewName(h2級) + keywords pill 5件 + 「詳しく見る →」
//   ・未診断(worldview == null): 「世界観を診断する →」CTA → /onboarding
//   ・loading 中: skeleton placeholder(高さを保って画面ガタつき防止)
//   ・error 時: カード非表示(段階B reply に影響しないよう退行ゼロ)
//
// 【取得】GET /api/worldview-card(列絞り SELECT・worldview_tags 列含まない)

import { useEffect, useState } from "react";
import Link from "next/link";

interface WorldviewCardData {
  worldviewName:     string | null;
  worldviewKeywords: string[];
  coreIdentity:      string | null;
}

interface ApiResponse {
  ok:         boolean;
  worldview?: WorldviewCardData | null;
  reason?:    "auth_required";
}

type CardState =
  | { kind: "loading" }
  | { kind: "diagnosed";  data: WorldviewCardData }
  | { kind: "undiagnosed" }
  | { kind: "hidden" };

export default function WorldviewCard() {
  const [state, setState] = useState<CardState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/worldview-card", { method: "GET" });
        if (!res.ok) {
          if (!cancelled) setState({ kind: "hidden" });
          return;
        }
        const data = await res.json() as ApiResponse;
        if (cancelled) return;
        if (!data.ok || data.reason === "auth_required") {
          setState({ kind: "hidden" });
          return;
        }
        if (!data.worldview || !data.worldview.worldviewName) {
          setState({ kind: "undiagnosed" });
          return;
        }
        setState({ kind: "diagnosed", data: data.worldview });
      } catch {
        if (!cancelled) setState({ kind: "hidden" });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (state.kind === "hidden") return null;

  if (state.kind === "loading") {
    return (
      <div className="px-5 pt-3 pb-2">
        <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 animate-pulse">
          <div className="h-4 w-32 bg-gray-200 rounded mb-2" />
          <div className="h-3 w-48 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  if (state.kind === "undiagnosed") {
    return (
      <div className="px-5 pt-3 pb-2">
        <Link
          href="/onboarding"
          className="block rounded-xl border border-gray-200 bg-white px-4 py-3 hover:bg-gray-50 transition-colors"
        >
          <p className="text-xs tracking-widest text-gray-400 uppercase mb-1">あなたの世界観</p>
          <p className="text-sm text-gray-800">世界観を診断する →</p>
        </Link>
      </div>
    );
  }

  // diagnosed
  const { worldviewName, worldviewKeywords } = state.data;
  const keywords = worldviewKeywords.slice(0, 5);

  return (
    <div className="px-5 pt-3 pb-2">
      <div className="rounded-xl border border-gray-100 bg-gradient-to-br from-gray-50 to-white px-4 py-3">
        <p className="text-[10px] tracking-widest text-gray-400 uppercase mb-1">あなたの世界観</p>
        <h2 className="text-base font-medium text-gray-900 mb-2">{worldviewName}</h2>
        {keywords.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {keywords.map((k) => (
              <span
                key={k}
                className="text-[11px] px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-600"
              >
                {k}
              </span>
            ))}
          </div>
        )}
        <Link
          href="/self?tab=diagnosis"
          className="text-[11px] text-gray-500 hover:text-gray-800 transition-colors"
        >
          詳しく見る →
        </Link>
      </div>
    </div>
  );
}
