"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import CoordinateCard from "@/components/coordinate/CoordinateCard";
import { ShoppingBag, MessageCircle, RefreshCw } from "lucide-react";
import type { StyleDiagnosisResult, CoordinateGenerateResponse } from "@/types/index";

export default function HomePage() {
  const [analysis, setAnalysis] = useState<StyleDiagnosisResult | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(true);

  const [coord, setCoord] = useState<CoordinateGenerateResponse | null>(null);
  const [coordLoading, setCoordLoading] = useState(true);
  const [coordError, setCoordError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { setAnalysisLoading(false); setCoordLoading(false); return; }

      const { data: row } = await supabase
        .from("users")
        .select("style_analysis")
        .eq("id", data.user.id)
        .single() as unknown as { data: { style_analysis: unknown } | null };
      if (row?.style_analysis) {
        setAnalysis(row.style_analysis as StyleDiagnosisResult);
      }
      setAnalysisLoading(false);

      try {
        const res = await fetch("/api/ai/coordinate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scene: "カジュアル" }),
        });
        if (res.ok) {
          const d = await res.json() as CoordinateGenerateResponse;
          setCoord(d);
        } else {
          const d = await res.json() as { error?: string };
          setCoordError(d.error ?? "コーデを取得できませんでした");
        }
      } catch (e) {
        setCoordError(e instanceof Error ? e.message : "コーデを取得できませんでした");
      } finally {
        setCoordLoading(false);
      }
    });
  }, []);

  return (
    <div className="min-h-screen bg-white pb-24">
      <div className="max-w-lg mx-auto px-4 py-12 space-y-8">
        <div>
          <p className="text-xs tracking-widest text-gray-400 uppercase mb-1">Home</p>
          <h1 className="text-2xl font-light text-gray-900">今日のあなた</h1>
        </div>

        {/* 世界観カード */}
        {analysisLoading ? (
          <div className="bg-gray-50 rounded-2xl p-6 animate-pulse h-32" />
        ) : analysis?.worldviewName ? (
          <Link href="/self" className="block bg-gray-900 text-white rounded-2xl px-6 py-8 hover:bg-gray-800 transition-colors">
            <p className="text-[10px] tracking-[0.3em] text-gray-400 uppercase mb-3">Your Worldview</p>
            <h2 className="text-2xl font-light leading-snug mb-3">{analysis.worldviewName}</h2>
            {analysis.coreIdentity && (
              <p className="text-xs text-gray-400 leading-relaxed">{analysis.coreIdentity}</p>
            )}
            <p className="text-[10px] text-gray-500 mt-4">タップして詳細を見る →</p>
          </Link>
        ) : (
          <div className="bg-gray-50 rounded-2xl p-6 text-center">
            <p className="text-sm text-gray-700 mb-3">まず世界観診断から始めましょう</p>
            <Link href="/onboarding" className="inline-block px-5 py-2.5 bg-gray-800 text-white rounded-xl text-sm hover:bg-gray-700 transition-colors">
              診断を始める →
            </Link>
          </div>
        )}

        {/* 今日のおすすめコーデ */}
        <div>
          <p className="text-xs tracking-widest text-gray-400 uppercase mb-3">Today&apos;s Outfit</p>
          {coordLoading ? (
            <div className="border border-gray-100 rounded-2xl p-6 animate-pulse h-40" />
          ) : coord ? (
            <CoordinateCard
              coordinate={coord.coordinate}
              resolvedItems={coord.resolvedItems}
              scene="カジュアル"
              onSave={() => {}}
              isSaving={false}
              isSaved={false}
            />
          ) : (
            <div className="border border-dashed border-gray-200 rounded-2xl p-6 text-center">
              <p className="text-sm text-gray-400 mb-2">{coordError ?? "今日のおすすめは準備中です"}</p>
              <Link href="/outfit" className="inline-block text-xs text-gray-600 underline underline-offset-2 hover:text-gray-900">
                自分でコーデを生成する →
              </Link>
            </div>
          )}
        </div>

        {/* CTA: 続きのアクション */}
        <div className="space-y-3">
          <Link href="/shop" className="flex items-center gap-3 px-5 py-4 border border-gray-200 rounded-2xl hover:border-gray-400 transition-colors">
            <ShoppingBag size={20} className="text-gray-500" strokeWidth={1.6} />
            <div className="flex-1">
              <p className="text-sm text-gray-900">商品から探す</p>
              <p className="text-xs text-gray-500">世界観に合う一着を見つける</p>
            </div>
            <span className="text-gray-300">→</span>
          </Link>

          <Link href="/outfit?tab=consult" className="flex items-center gap-3 px-5 py-4 border border-gray-200 rounded-2xl hover:border-gray-400 transition-colors">
            <MessageCircle size={20} className="text-gray-500" strokeWidth={1.6} />
            <div className="flex-1">
              <p className="text-sm text-gray-900">コーデを相談する</p>
              <p className="text-xs text-gray-500">体型・身長の悩みを言葉で解消</p>
            </div>
            <span className="text-gray-300">→</span>
          </Link>

          {analysis?.worldviewName && (
            <Link href="/onboarding" className="flex items-center gap-3 px-5 py-4 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-colors">
              <RefreshCw size={20} className="text-gray-500" strokeWidth={1.6} />
              <div className="flex-1">
                <p className="text-sm text-gray-900">再診断する</p>
                <p className="text-xs text-gray-500">世界観をアップデート</p>
              </div>
              <span className="text-gray-300">→</span>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
