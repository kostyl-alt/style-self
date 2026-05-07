"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import InspirationView from "@/components/discover/InspirationView";
import LearnView from "@/components/learn/LearnView";
import CultureView from "@/components/discover/CultureView";
import type { StyleDiagnosisResult } from "@/types/index";

type DiscoverTab = "inspiration" | "learn" | "culture";

const TABS: { value: DiscoverTab; label: string; description: string }[] = [
  { value: "inspiration", label: "インスピレーション", description: "抽象語・テーマからコーデを生成して、新しい表現を見つける" },
  { value: "learn",       label: "ブランドを学ぶ",     description: "ブランド哲学・トレンドの取り入れ方・参照を読む" },
  { value: "culture",     label: "カルチャー",         description: "あなたの世界観に合う音楽・映画・香水と、その理由" },
];

function isDiscoverTab(v: string | null): v is DiscoverTab {
  return v === "inspiration" || v === "learn" || v === "culture";
}

function DiscoverInner() {
  const params = useSearchParams();
  const router = useRouter();
  const initialTab = params.get("tab");
  const [activeTab, setActiveTab] = useState<DiscoverTab>(isDiscoverTab(initialTab) ? initialTab : "inspiration");

  const [analysis, setAnalysis] = useState<StyleDiagnosisResult | null>(null);

  useEffect(() => {
    const t = params.get("tab");
    if (isDiscoverTab(t) && t !== activeTab) setActiveTab(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  // Sprint 48: 親で1回だけ style_analysis を取得して各タブに props として渡す
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: row } = await supabase
        .from("users")
        .select("style_analysis")
        .eq("id", data.user.id)
        .single() as unknown as { data: { style_analysis: unknown } | null };
      if (row?.style_analysis) {
        setAnalysis(row.style_analysis as StyleDiagnosisResult);
      }
    });
  }, []);

  function handleTabChange(t: DiscoverTab) {
    setActiveTab(t);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", t);
    router.replace(url.pathname + url.search);
  }

  const activeTabMeta = TABS.find((t) => t.value === activeTab);

  return (
    <div className="min-h-screen bg-white pb-24">
      <div className="max-w-lg mx-auto px-4 py-12">
        <div className="mb-8">
          <p className="text-xs tracking-widest text-gray-400 uppercase mb-1">Discover</p>
          <h1 className="text-2xl font-light text-gray-900">発見</h1>
        </div>
        <div className="flex border-b border-gray-100">
          {TABS.map((tab) => (
            <button key={tab.value} onClick={() => handleTabChange(tab.value)}
              className={`flex-1 min-w-0 pb-3 text-xs sm:text-sm transition-colors truncate ${
                activeTab === tab.value
                  ? "text-gray-900 border-b-2 border-gray-800 font-medium"
                  : "text-gray-400 hover:text-gray-600"
              }`}>
              {tab.label}
            </button>
          ))}
        </div>
        {activeTabMeta && (
          <p className="text-xs text-gray-500 mt-3 mb-6 leading-snug">{activeTabMeta.description}</p>
        )}
        {activeTab === "inspiration" && <InspirationView embedded analysis={analysis} />}
        {activeTab === "learn"       && <LearnView embedded />}
        {activeTab === "culture"     && <CultureView analysis={analysis} />}
      </div>
    </div>
  );
}

export default function DiscoverPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <DiscoverInner />
    </Suspense>
  );
}
