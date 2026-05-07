"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Music, Film, Sparkles } from "lucide-react";
import type {
  StyleDiagnosisResult,
  CultureExplainResponse,
  CultureExplanationItem,
} from "@/types/index";

const CACHE_KEY = "culture_explain_cache_v1";
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;  // 30日

interface CacheEntry {
  patternId:   string;
  generatedAt: number;
  response:    CultureExplainResponse;
}

function readCache(patternId: string): CultureExplainResponse | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    if (entry.patternId !== patternId) return null;
    if (Date.now() - entry.generatedAt > CACHE_TTL_MS) return null;
    return entry.response;
  } catch {
    return null;
  }
}

function writeCache(patternId: string, response: CultureExplainResponse) {
  if (typeof window === "undefined") return;
  try {
    const entry: CacheEntry = { patternId, generatedAt: Date.now(), response };
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    // localStorage 容量制限など。失敗してもUIは動かす
  }
}

export default function CultureView({ analysis }: { analysis: StyleDiagnosisResult | null }) {
  const cultural = analysis?.culturalAffinities;
  const patternId = analysis?.patternId;

  const [explained, setExplained] = useState<CultureExplainResponse | null>(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const hasCultural = !!(
    cultural &&
    ((cultural.music?.length ?? 0) > 0
      || (cultural.films?.length ?? 0) > 0
      || (cultural.fragrance?.length ?? 0) > 0)
  );

  useEffect(() => {
    if (!hasCultural || !cultural || !patternId) return;

    const cached = readCache(patternId);
    if (cached) {
      setExplained(cached);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch("/api/ai/culture-explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        worldviewName:       analysis?.worldviewName,
        patternId,
        culturalAffinities:  cultural,
        avoidImpressions:    analysis?.preference?.avoidImpressions ?? [],
        avoidItems:          analysis?.avoidItems ?? [],
        idealSelf:           analysis?.idealSelf,
        unconsciousTendency: analysis?.unconsciousTendency,
      }),
    })
      .then(async (r) => {
        if (!r.ok) {
          const d = await r.json() as { error?: string };
          throw new Error(d.error ?? "カルチャー解説を取得できませんでした");
        }
        return r.json() as Promise<CultureExplainResponse>;
      })
      .then((d) => {
        if (cancelled) return;
        setExplained(d);
        writeCache(patternId, d);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "取得に失敗しました");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patternId, hasCultural]);

  // 未診断 or culturalAffinities なし
  if (!hasCultural) {
    return (
      <div className="space-y-6">
        <div className="bg-gray-50 rounded-2xl p-6 text-center">
          <p className="text-sm text-gray-700 mb-2">診断を受けると、あなたの世界観に合う音楽・映画・香水が表示されます</p>
          <p className="text-xs text-gray-400 mb-4">それぞれに「なぜあなたに合うのか」の解説付き</p>
          <Link href="/onboarding" className="inline-block px-5 py-2.5 bg-gray-800 text-white rounded-xl text-sm hover:bg-gray-700 transition-colors">
            診断を始める →
          </Link>
        </div>
        <DemoSection />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <CategorySection
        icon={<Music size={16} strokeWidth={1.6} />}
        label="Music / 音楽"
        items={cultural!.music}
        explanations={explained?.music}
        loading={loading}
      />
      <CategorySection
        icon={<Film size={16} strokeWidth={1.6} />}
        label="Films / 映画"
        items={cultural!.films}
        explanations={explained?.films}
        loading={loading}
      />
      <CategorySection
        icon={<Sparkles size={16} strokeWidth={1.6} />}
        label="Fragrance / 香水"
        items={cultural!.fragrance}
        explanations={explained?.fragrance}
        loading={loading}
      />

      {error && (
        <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-xs text-red-600">
          {error}
        </div>
      )}
    </div>
  );
}

function CategorySection({
  icon, label, items, explanations, loading,
}: {
  icon: React.ReactNode;
  label: string;
  items: string[];
  explanations: CultureExplanationItem[] | undefined;
  loading: boolean;
}) {
  if (!items || items.length === 0) return null;
  return (
    <section>
      <div className="flex items-center gap-2 mb-3 text-gray-500">
        {icon}
        <p className="text-[11px] tracking-widest uppercase">{label}</p>
      </div>
      <div className="space-y-2.5">
        {items.map((name, idx) => {
          const ex = explanations?.[idx];
          const reason = ex?.reason;
          return (
            <article key={`${name}-${idx}`} className="border border-gray-100 rounded-2xl p-4">
              <h3 className="text-sm font-medium text-gray-900 mb-2">{name}</h3>
              {loading && !reason ? (
                <div className="space-y-1.5">
                  <div className="h-3 bg-gray-100 rounded w-full animate-pulse" />
                  <div className="h-3 bg-gray-100 rounded w-4/5 animate-pulse" />
                </div>
              ) : reason ? (
                <p className="text-xs text-gray-600 leading-relaxed">{reason}</p>
              ) : (
                <p className="text-xs text-gray-300 italic">解説の生成に失敗しました</p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function DemoSection() {
  return (
    <div className="space-y-3 opacity-70 pointer-events-none">
      <p className="text-[11px] text-gray-400 tracking-widest uppercase">Sample（診断後に表示される内容）</p>
      <article className="border border-gray-100 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-2 text-gray-400">
          <Music size={14} strokeWidth={1.6} />
          <span className="text-[10px] tracking-widest uppercase">Music</span>
        </div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">グランジ</h3>
        <p className="text-xs text-gray-500 leading-relaxed">
          整いすぎた音より、粗さと歪みの中に美しさを見つける感覚が、あなたの「量産型を避けたい」という価値観と共鳴しています。
        </p>
      </article>
    </div>
  );
}
