"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CoordinateTab, ConsultTab } from "@/components/style/StyleTabs";
import ClosetView from "@/components/closet/ClosetView";

type OutfitTab = "coordinate" | "consult" | "closet";

const TABS: { value: OutfitTab; label: string; description: string }[] = [
  { value: "coordinate", label: "コーデ提案",   description: "今日の気分・シーンに合わせてAIがコーデを設計します" },
  { value: "consult",    label: "着こなし相談", description: "体型・身長の悩みを具体的なアイテム名で解消" },
  { value: "closet",     label: "クローゼット", description: "手持ち服・検討中・欲しいを一元管理" },
];

function isOutfitTab(v: string | null): v is OutfitTab {
  return v === "coordinate" || v === "consult" || v === "closet";
}

function OutfitInner() {
  const params = useSearchParams();
  const router = useRouter();
  const initialTab = params.get("tab");
  const [activeTab, setActiveTab] = useState<OutfitTab>(isOutfitTab(initialTab) ? initialTab : "coordinate");

  useEffect(() => {
    const t = params.get("tab");
    if (isOutfitTab(t) && t !== activeTab) setActiveTab(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  function handleTabChange(t: OutfitTab) {
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
          <p className="text-xs tracking-widest text-gray-400 uppercase mb-1">Outfit</p>
          <h1 className="text-2xl font-light text-gray-900">コーデ</h1>
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
        {activeTab === "coordinate" && <CoordinateTab />}
        {activeTab === "consult"    && <ConsultTab />}
        {activeTab === "closet"     && <ClosetView embedded />}
      </div>
    </div>
  );
}

export default function OutfitPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <OutfitInner />
    </Suspense>
  );
}
