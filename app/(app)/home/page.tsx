"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { buildZozoSearchUrl } from "@/lib/utils/zozo-link";
import { MessageCircle, RefreshCw, Music, Film, Sparkles, ExternalLink } from "lucide-react";
import type { StyleDiagnosisResult, CoordinateGenerateResponse } from "@/types/index";

const ROLE_LABELS: Record<string, { label: string; style: string }> = {
  base:   { label: "ベース",     style: "bg-gray-100 text-gray-500" },
  main:   { label: "メイン",     style: "bg-gray-800 text-white" },
  accent: { label: "アクセント", style: "bg-amber-100 text-amber-700" },
};
const ROLE_ORDER: Record<string, number> = { base: 0, main: 1, accent: 2 };

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

  const tags = analysis?.styleAxis?.beliefKeywords ?? [];
  const firstPiece = analysis?.firstPiece;
  const cultural = analysis?.culturalAffinities;
  const hasCultural = !!(
    cultural &&
    ((cultural.music?.length ?? 0) > 0 ||
      (cultural.films?.length ?? 0) > 0 ||
      (cultural.fragrance?.length ?? 0) > 0)
  );

  const sortedItems = coord
    ? [...coord.resolvedItems].sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role])
    : [];

  return (
    <div className="min-h-screen bg-white pb-24">
      <div className="max-w-lg mx-auto px-4 py-12 space-y-10">
        <div>
          <p className="text-xs tracking-widest text-gray-400 uppercase mb-1">Home</p>
          <h1 className="text-2xl font-light text-gray-900">今日のあなた</h1>
        </div>

        {/* 1. 今日の世界観カード */}
        {analysisLoading ? (
          <div className="bg-gray-50 rounded-2xl p-6 animate-pulse h-44" />
        ) : analysis?.worldviewName ? (
          <div className="bg-gray-900 text-white rounded-2xl px-6 py-8">
            <p className="text-[10px] tracking-[0.3em] text-gray-400 uppercase mb-3">Your Worldview</p>
            <h2 className="text-2xl font-light leading-snug mb-3">{analysis.worldviewName}</h2>
            {analysis.coreIdentity && (
              <p className="text-xs text-gray-400 leading-relaxed mb-4">{analysis.coreIdentity}</p>
            )}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-5">
                {tags.map((t) => (
                  <span key={t} className="text-[11px] text-gray-300 bg-white/5 border border-white/10 rounded-full px-2.5 py-1">
                    #{t}
                  </span>
                ))}
              </div>
            )}
            <Link href="/self" className="inline-flex items-center gap-1 text-[11px] text-gray-400 hover:text-white transition-colors">
              詳しく見る
              <span>→</span>
            </Link>
          </div>
        ) : (
          <div className="bg-gray-50 rounded-2xl p-6 text-center">
            <p className="text-sm text-gray-700 mb-3">まず世界観診断から始めましょう</p>
            <Link href="/onboarding" className="inline-block px-5 py-2.5 bg-gray-800 text-white rounded-xl text-sm hover:bg-gray-700 transition-colors">
              診断を始める →
            </Link>
          </div>
        )}

        {/* 2. 今日のコーデ */}
        {analysis?.worldviewName && (
          <div>
            <p className="text-xs tracking-widest text-gray-400 uppercase mb-3">Today&apos;s Outfit</p>
            {coordLoading ? (
              <div className="border border-gray-100 rounded-2xl p-5 space-y-3">
                <div className="h-3 w-20 bg-gray-100 rounded animate-pulse" />
                <div className="h-4 w-3/4 bg-gray-100 rounded animate-pulse" />
                <div className="space-y-2 pt-1">
                  <div className="h-9 bg-gray-50 rounded-lg animate-pulse" />
                  <div className="h-9 bg-gray-50 rounded-lg animate-pulse" />
                  <div className="h-9 bg-gray-50 rounded-lg animate-pulse" />
                </div>
              </div>
            ) : coord ? (
              <div className="border border-gray-100 rounded-2xl p-5">
                <p className="text-[10px] text-gray-400 tracking-widest uppercase mb-1.5">カジュアル</p>
                {coord.coordinate.beliefAlignment && (
                  <p className="text-sm text-gray-700 leading-relaxed mb-4">
                    {coord.coordinate.beliefAlignment}
                  </p>
                )}
                <div className="space-y-1.5 mb-4">
                  {sortedItems.map(({ item, role }) => {
                    const roleStyle = ROLE_LABELS[role];
                    return (
                      <div key={item.id} className="flex items-center gap-2.5">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full flex-shrink-0 ${roleStyle?.style ?? ""}`}>
                          {roleStyle?.label ?? role}
                        </span>
                        <span className="text-sm text-gray-800 truncate">{item.name}</span>
                        {item.brand && (
                          <span className="text-xs text-gray-400 flex-shrink-0">{item.brand}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
                <Link href="/outfit" className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900 transition-colors">
                  コーデを詳しく見る
                  <span>→</span>
                </Link>
              </div>
            ) : (
              <div className="border border-dashed border-gray-200 rounded-2xl p-6 text-center">
                <p className="text-sm text-gray-400 mb-2">{coordError ?? "今日のおすすめは準備中です"}</p>
                <Link href="/outfit" className="inline-block text-xs text-gray-600 underline underline-offset-2 hover:text-gray-900">
                  自分でコーデを生成する →
                </Link>
              </div>
            )}
          </div>
        )}

        {/* 3. 今日試すべき1アイテム */}
        {firstPiece && (
          <div>
            <p className="text-xs tracking-widest text-gray-400 uppercase mb-3">First Piece</p>
            <div className="border border-amber-100 bg-amber-50/40 rounded-2xl p-5">
              <p className="text-[10px] text-amber-700 tracking-widest uppercase mb-1.5">今日試すべき1アイテム</p>
              <h3 className="text-lg font-medium text-gray-900 mb-2">{firstPiece.name}</h3>
              {firstPiece.why && (
                <p className="text-sm text-gray-600 leading-relaxed mb-4">{firstPiece.why}</p>
              )}
              {firstPiece.zozoKeyword && (
                <a
                  href={buildZozoSearchUrl({ keyword: firstPiece.zozoKeyword })}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-amber-800 hover:text-amber-900 transition-colors"
                >
                  ZOZOで探す
                  <ExternalLink size={12} strokeWidth={1.6} />
                </a>
              )}
            </div>
          </div>
        )}

        {/* 4. 世界観に合うカルチャー */}
        {hasCultural && cultural && (
          <div>
            <p className="text-xs tracking-widest text-gray-400 uppercase mb-3">Cultural Affinities</p>
            <div className="grid grid-cols-3 gap-2">
              <CultureCard icon={<Music size={14} strokeWidth={1.6} />} label="音楽" items={cultural.music} />
              <CultureCard icon={<Film size={14} strokeWidth={1.6} />} label="映画" items={cultural.films} />
              <CultureCard icon={<Sparkles size={14} strokeWidth={1.6} />} label="香水" items={cultural.fragrance} />
            </div>
          </div>
        )}

        {/* 5. アクション */}
        <div className="space-y-3">
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

function CultureCard({ icon, label, items }: { icon: React.ReactNode; label: string; items: string[] | undefined }) {
  const top = (items ?? []).slice(0, 3);
  return (
    <div className="border border-gray-100 rounded-2xl p-3">
      <div className="flex items-center gap-1.5 text-gray-500 mb-2">
        {icon}
        <span className="text-[10px] tracking-widest uppercase">{label}</span>
      </div>
      {top.length > 0 ? (
        <ul className="space-y-1">
          {top.map((t) => (
            <li key={t} className="text-xs text-gray-800 leading-tight truncate">{t}</li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-gray-300">—</p>
      )}
    </div>
  );
}
