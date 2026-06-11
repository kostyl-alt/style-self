"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { CoordinateTab, ConsultTab, VirtualTab } from "@/components/style/StyleTabs";
import ClosetView from "@/components/closet/ClosetView";
import { PRODUCTS_ENABLED, ENABLE_OUTFIT } from "@/lib/flags";

type OutfitTab = "coordinate" | "consult" | "closet" | "virtual";

// PRODUCTS_ENABLED=false のとき「理想を探す」(virtual) タブは導線から外す。
function isTabVisible(v: OutfitTab): boolean {
  return PRODUCTS_ENABLED || v !== "virtual";
}

const TABS: { value: OutfitTab; label: string; description: string }[] = [
  { value: "coordinate", label: "コーデ提案",   description: "今日の気分・シーンに合わせてAIがコーデを設計します" },
  { value: "consult",    label: "着こなし相談", description: "体型・身長の悩みを具体的なアイテム名で解消" },
  { value: "closet",     label: "クローゼット", description: "手持ち服・検討中・欲しいを一元管理" },
  { value: "virtual",    label: "理想を探す",   description: "コンセプトから理想コーデを設計し、合う商品を提案" },
];

function isOutfitTab(v: string | null): v is OutfitTab {
  return v === "coordinate" || v === "consult" || v === "closet" || v === "virtual";
}

function OutfitInner() {
  const params = useSearchParams();
  const router = useRouter();
  const initialTab = params.get("tab");
  const [activeTab, setActiveTab] = useState<OutfitTab>(
    isOutfitTab(initialTab) && isTabVisible(initialTab) ? initialTab : "coordinate"
  );

  // SIMPLE_MODE: /outfit ページごと非表示。チャット主役画面 /ai へ送る。
  useEffect(() => {
    if (!ENABLE_OUTFIT) router.replace("/ai");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = params.get("tab");
    if (isOutfitTab(t) && isTabVisible(t) && t !== activeTab) setActiveTab(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  if (!ENABLE_OUTFIT) return null;

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
          {/* Phase C: チャットに戻る導線（/ai へ・/self と同スタイル） */}
          <Link href="/ai" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 mb-3">
            ← チャットに戻る
          </Link>
          <p className="text-xs tracking-widest text-gray-400 uppercase mb-1">Outfit</p>
          <h1 className="text-2xl font-light text-gray-900">コーデ</h1>
        </div>
        <div className="flex border-b border-gray-100">
          {TABS.filter((tab) => isTabVisible(tab.value)).map((tab) => (
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
        {activeTab === "virtual"    && <VirtualTab />}
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
