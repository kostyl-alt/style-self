"use client";

import { useState, useEffect } from "react";
import type { LearnInsight, InspirationCategory, Trend, TrendTranslationResult } from "@/types/index";

interface BrandRow {
  id: string;
  name: string;
  name_ja: string | null;
  country: string;
  description: string;
  worldview_tags: string[];
  era_tags: string[];
  maniac_level: number;
  price_range: string;
  official_url: string | null;
  instagram_url: string | null;
}

interface InspirationRow {
  id: string;
  title: string;
  description: string;
  image_url: string | null;
  category: string;
  tags: string[];
  source_url: string | null;
  display_order: number;
}

interface InsightCache {
  date: string;
  insight: LearnInsight;
  beliefKeywords: string[];
}

const PRICE_LABEL: Record<string, string> = {
  budget: "¥", mid: "¥¥", high: "¥¥¥", luxury: "¥¥¥¥",
};

const THEME_LABEL: Record<string, string> = {
  material:   "素材",
  silhouette: "シルエット",
  ratio:      "比率・バランス",
};

const TYPE_LABEL: Record<string, string> = {
  insight:   "Insight",
  breakdown: "Breakdown",
  action:    "Action",
};

const TYPE_STYLE: Record<string, string> = {
  insight:   "bg-blue-50 text-blue-600",
  breakdown: "bg-amber-50 text-amber-600",
  action:    "bg-emerald-50 text-emerald-600",
};

const CATEGORY_LABEL: Record<string, string> = {
  silhouette: "シルエット",
  color: "カラー",
  material: "素材",
  detail: "ディテール",
};

const COMPATIBILITY_STYLE: Record<string, string> = {
  high:   "bg-emerald-50 text-emerald-700 border-emerald-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low:    "bg-red-50 text-red-600 border-red-200",
};

const COMPATIBILITY_LABEL: Record<string, string> = {
  high: "合いやすい", medium: "部分的に合う", low: "工夫が必要",
};

const ADAPTATION_LABEL: Record<string, string> = {
  main: "メインで取り入れる", accent: "差し色・一点使い", minimal: "ニュアンスだけ参照",
};

const INSP_TABS: { value: "all" | InspirationCategory; label: string }[] = [
  { value: "all",      label: "すべて" },
  { value: "designer", label: "デザイナー" },
  { value: "look",     label: "ルック" },
  { value: "artwork",  label: "アートワーク" },
  { value: "film",     label: "映画・本" },
];

function getMatchingTags(brandTags: string[], userKeywords: string[]): string[] {
  return brandTags.filter((tag) =>
    userKeywords.some((kw) => tag.includes(kw) || kw.includes(tag))
  );
}

const INSIGHT_CACHE_KEY = "learn_insight_cache";

export default function LearnPage() {
  const [insight, setInsight] = useState<LearnInsight | null>(null);
  const [beliefKeywords, setBeliefKeywords] = useState<string[]>([]);
  const [insightLoading, setInsightLoading] = useState(true);
  const [insightUnavailable, setInsightUnavailable] = useState(false);

  const [trends, setTrends] = useState<Trend[]>([]);
  const [trendsLoading, setTrendsLoading] = useState(true);
  const [translating, setTranslating] = useState<string | null>(null);
  const [translations, setTranslations] = useState<Map<string, TrendTranslationResult>>(new Map());
  const [expandedTrend, setExpandedTrend] = useState<string | null>(null);

  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [brandsLoading, setBrandsLoading] = useState(true);
  const [selectedBrand, setSelectedBrand] = useState<BrandRow | null>(null);

  const [inspirations, setInspirations] = useState<InspirationRow[]>([]);
  const [inspLoading, setInspLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<"all" | InspirationCategory>("all");

  useEffect(() => {
    loadInsight();
    fetch("/api/trends")
      .then((r) => r.json())
      .then((d: { trends?: Trend[] }) => setTrends(d.trends ?? []))
      .catch(() => {})
      .finally(() => setTrendsLoading(false));
    fetch("/api/brands/list")
      .then((r) => r.json())
      .then((d: { brands?: BrandRow[] }) => setBrands(d.brands ?? []))
      .catch(() => {})
      .finally(() => setBrandsLoading(false));
    fetch("/api/inspirations")
      .then((r) => r.json())
      .then((d: { inspirations?: InspirationRow[] }) => setInspirations(d.inspirations ?? []))
      .catch(() => {})
      .finally(() => setInspLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleTranslate(trendId: string) {
    if (translations.has(trendId)) {
      setExpandedTrend((prev) => (prev === trendId ? null : trendId));
      return;
    }
    setTranslating(trendId);
    setExpandedTrend(trendId);
    try {
      const res = await fetch("/api/ai/trend-translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trendId }),
      });
      if (res.ok) {
        const result = await res.json() as TrendTranslationResult;
        setTranslations((prev) => new Map(prev).set(trendId, result));
      }
    } catch {}
    setTranslating(null);
  }

  function isValidInsightCache(parsed: InsightCache): boolean {
    const i = parsed.insight;
    return !!(i && i.conclusion && i.example && i.action && i.type);
  }

  function loadInsight() {
    try {
      const cached = localStorage.getItem(INSIGHT_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as InsightCache;
        const today = new Date().toISOString().split("T")[0];
        if (parsed.date === today && isValidInsightCache(parsed)) {
          setInsight(parsed.insight);
          setBeliefKeywords(parsed.beliefKeywords);
          setInsightLoading(false);
          return;
        }
        localStorage.removeItem(INSIGHT_CACHE_KEY);
      }
    } catch {}

    fetch("/api/ai/learn-insight", { method: "POST" })
      .then((r) => r.json())
      .then((d: { insight?: LearnInsight; beliefKeywords?: string[]; error?: string }) => {
        if (d.insight) {
          setInsight(d.insight);
          setBeliefKeywords(d.beliefKeywords ?? []);
          try {
            const cache: InsightCache = {
              date: new Date().toISOString().split("T")[0],
              insight: d.insight,
              beliefKeywords: d.beliefKeywords ?? [],
            };
            localStorage.setItem(INSIGHT_CACHE_KEY, JSON.stringify(cache));
          } catch {}
        } else {
          setInsightUnavailable(true);
        }
      })
      .catch(() => setInsightUnavailable(true))
      .finally(() => setInsightLoading(false));
  }

  const filteredInspirations = activeCategory === "all"
    ? inspirations
    : activeCategory === "film"
      ? inspirations.filter((i) => i.category === "film" || i.category === "book")
      : inspirations.filter((i) => i.category === activeCategory);

  return (
    <div className="min-h-screen bg-white pb-24">
      <div className="max-w-lg mx-auto px-4 py-12 space-y-12">

        {/* ヘッダー */}
        <div>
          <p className="text-xs tracking-widest text-gray-400 uppercase mb-1">Learn</p>
          <h1 className="text-2xl font-light text-gray-900">センスを磨く</h1>
          <p className="text-sm text-gray-400 mt-2 leading-relaxed">
            ブランドの思想・デザイナーの哲学・服の構造を知ることで、選ぶ目が育ちます。
          </p>
        </div>

        {/* ── Section 1: 今日の気づき ── */}
        <div>
          <p className="text-xs tracking-widest text-gray-400 uppercase mb-4">Today&apos;s Insight</p>
          {insightLoading ? (
            <div className="border border-gray-100 rounded-2xl p-5 space-y-3 animate-pulse">
              <div className="h-3 bg-gray-100 rounded w-1/3" />
              <div className="h-4 bg-gray-100 rounded w-2/3" />
              <div className="h-16 bg-gray-100 rounded" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
            </div>
          ) : insightUnavailable ? (
            <div className="border border-dashed border-gray-200 rounded-2xl p-6 text-center">
              <p className="text-sm text-gray-400">世界観診断を完了すると気づきが届きます。</p>
              <a href="/onboarding" className="inline-block mt-3 text-xs text-gray-600 underline underline-offset-2">
                診断を始める →
              </a>
            </div>
          ) : insight ? (
            <div className="border border-gray-100 rounded-2xl p-5 space-y-4">
              {/* バッジ行 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_STYLE[insight.type] ?? "bg-gray-100 text-gray-500"}`}>
                    {TYPE_LABEL[insight.type] ?? insight.type}
                  </span>
                  <span className="text-xs text-gray-400">{THEME_LABEL[insight.theme] ?? insight.theme}</span>
                </div>
                <span className="text-xs text-gray-400">{insight.keyword}</span>
              </div>

              {/* 1. タイトル */}
              <h3 className="text-base font-medium text-gray-900 leading-snug">{insight.title}</h3>

              {/* 2. ひとこと結論 */}
              <p className="text-sm text-gray-700 leading-relaxed">{insight.conclusion}</p>

              {/* 3. 服で言うと */}
              <div className="bg-gray-50 rounded-xl p-3 space-y-1">
                <p className="text-xs text-gray-400">服で言うと</p>
                <p className="text-sm text-gray-700 leading-relaxed">{insight.example}</p>
              </div>

              {/* 4. 今日やること */}
              <div className="border border-gray-200 rounded-xl p-3 space-y-1">
                <p className="text-xs text-gray-400">今日やること</p>
                <p className="text-sm font-medium text-gray-900">→ {insight.action}</p>
              </div>
            </div>
          ) : null}
        </div>

        {/* ── Section 2: 今季トレンドと世界観 ── */}
        <div>
          <p className="text-xs tracking-widest text-gray-400 uppercase mb-1">Trend Translation</p>
          <h2 className="text-base font-light text-gray-800 mb-1">今季トレンドと世界観</h2>
          <p className="text-xs text-gray-400 mb-4">世界観を壊さずにどこにどう取り入れるかを翻訳します</p>

          {trendsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="border border-gray-100 rounded-2xl p-5 animate-pulse space-y-2">
                  <div className="h-3 bg-gray-100 rounded w-1/4" />
                  <div className="h-4 bg-gray-100 rounded w-1/2" />
                  <div className="h-3 bg-gray-100 rounded w-3/4" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {trends.map((trend) => {
                const result = translations.get(trend.id);
                const isExpanded = expandedTrend === trend.id;
                const isLoading = translating === trend.id;

                return (
                  <div key={trend.id} className="border border-gray-100 rounded-2xl overflow-hidden">
                    {/* カードヘッダー */}
                    <div className="p-5 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">
                          {CATEGORY_LABEL[trend.category] ?? trend.category}
                        </span>
                        <span className="text-xs text-gray-400">{trend.season}</span>
                      </div>
                      <p className="text-sm font-medium text-gray-900">{trend.keyword}</p>
                      <p className="text-xs text-gray-500 leading-relaxed">{trend.description}</p>
                      <button
                        onClick={() => handleTranslate(trend.id)}
                        disabled={isLoading}
                        className="mt-1 w-full py-2 border border-gray-200 text-gray-600 rounded-xl text-xs hover:border-gray-400 hover:text-gray-800 transition-colors disabled:opacity-40"
                      >
                        {isLoading ? "翻訳中..." : result ? (isExpanded ? "閉じる" : "結果を見る") : "自分の世界観との相性を見る"}
                      </button>
                    </div>

                    {/* 翻訳結果 */}
                    {isExpanded && (
                      <div className="border-t border-gray-100 px-5 pb-5 pt-4 space-y-4">
                        {isLoading ? (
                          <div className="space-y-2 animate-pulse">
                            <div className="h-3 bg-gray-100 rounded w-1/3" />
                            <div className="h-12 bg-gray-100 rounded" />
                            <div className="h-3 bg-gray-100 rounded w-1/2" />
                          </div>
                        ) : result ? (
                          <>
                            {/* 相性バッジ */}
                            <div className="flex items-center gap-2">
                              <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${COMPATIBILITY_STYLE[result.compatibility]}`}>
                                {COMPATIBILITY_LABEL[result.compatibility]}
                              </span>
                              <span className="text-xs text-gray-400">{ADAPTATION_LABEL[result.adaptationLevel]}</span>
                            </div>

                            {/* 相性の理由 */}
                            <p className="text-xs text-gray-600 leading-relaxed">{result.compatibilityReason}</p>

                            {/* 取り入れ方 */}
                            <div className="bg-gray-50 rounded-xl p-4 space-y-1">
                              <p className="text-xs text-gray-400">取り入れ方</p>
                              <p className="text-sm text-gray-800 leading-relaxed">{result.howToAdapt}</p>
                            </div>

                            {/* 具体的なアドバイス */}
                            <div className="space-y-2">
                              <p className="text-xs text-gray-400">具体的なアドバイス</p>
                              {result.specificAdvice.map((advice, i) => (
                                <div key={i} className="flex gap-2">
                                  <span className="text-xs text-gray-300 flex-shrink-0 mt-0.5">{i + 1}.</span>
                                  <p className="text-xs text-gray-700 leading-relaxed">{advice}</p>
                                </div>
                              ))}
                            </div>

                            {/* 注意点 */}
                            {result.avoidPoints.length > 0 && (
                              <div className="space-y-1.5">
                                <p className="text-xs text-gray-400">やりすぎ注意</p>
                                {result.avoidPoints.map((point, i) => (
                                  <p key={i} className="text-xs text-gray-500 leading-relaxed pl-2 border-l-2 border-gray-200">
                                    {point}
                                  </p>
                                ))}
                              </div>
                            )}
                          </>
                        ) : null}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Section 3: ブランドフィロソフィー ── */}
        <div>
          <p className="text-xs tracking-widest text-gray-400 uppercase mb-4">Brand Philosophy</p>
          {brandsLoading ? (
            <p className="text-sm text-gray-300 text-center py-8 animate-pulse">読み込み中...</p>
          ) : (
            <div className="space-y-3">
              {brands.map((brand) => (
                <button
                  key={brand.id}
                  onClick={() => setSelectedBrand(brand)}
                  className="w-full text-left border border-gray-100 rounded-2xl p-5 space-y-2.5 hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{brand.name}</p>
                      {brand.name_ja && <p className="text-xs text-gray-400 mt-0.5">{brand.name_ja}</p>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 text-xs text-gray-400">
                      <span>{PRICE_LABEL[brand.price_range]}</span>
                      <span>{brand.country}</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{brand.description}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {brand.worldview_tags.slice(0, 4).map((tag) => (
                      <span key={tag} className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full">
                        {tag}
                      </span>
                    ))}
                    {brand.worldview_tags.length > 4 && (
                      <span className="text-xs text-gray-300">+{brand.worldview_tags.length - 4}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Section 4: 偉大な参照 ── */}
        <div>
          <p className="text-xs tracking-widest text-gray-400 uppercase mb-4">Great References</p>

          {/* カテゴリタブ */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
            {INSP_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveCategory(tab.value)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs border transition-all ${
                  activeCategory === tab.value
                    ? "bg-gray-800 text-white border-gray-800"
                    : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {inspLoading ? (
            <p className="text-sm text-gray-300 text-center py-8 animate-pulse">読み込み中...</p>
          ) : filteredInspirations.length === 0 ? (
            <div className="border border-dashed border-gray-200 rounded-2xl p-8 text-center">
              <p className="text-xs text-gray-400">このカテゴリにはまだコンテンツがありません</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredInspirations.map((insp) => (
                <div key={insp.id} className="border border-gray-100 rounded-2xl overflow-hidden">
                  {insp.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={insp.image_url} alt={insp.title} className="w-full aspect-video object-cover" />
                  )}
                  <div className="p-5 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-sm font-medium text-gray-900">{insp.title}</h3>
                      <span className="text-xs text-gray-400 flex-shrink-0 capitalize">{insp.category}</span>
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed">{insp.description}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {insp.tags.map((tag) => (
                        <span key={tag} className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full">
                          {tag}
                        </span>
                      ))}
                    </div>
                    {insp.source_url && (
                      <a
                        href={insp.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block text-xs text-gray-400 underline underline-offset-2 hover:text-gray-600"
                      >
                        参照元 →
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* ── ブランド詳細モーダル ── */}
      {selectedBrand && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setSelectedBrand(null)} />
          <div className="relative bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-medium text-gray-900">{selectedBrand.name}</h2>
                {selectedBrand.name_ja && (
                  <p className="text-xs text-gray-400 mt-0.5">{selectedBrand.name_ja}</p>
                )}
              </div>
              <button onClick={() => setSelectedBrand(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>

            <div className="px-6 py-6 space-y-6">
              {/* メタ */}
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span>{selectedBrand.country}</span>
                <span>·</span>
                <span>{PRICE_LABEL[selectedBrand.price_range]}</span>
                <span>·</span>
                <span className="text-amber-400">
                  {"★".repeat(Math.min(5, selectedBrand.maniac_level))}
                  {"☆".repeat(Math.max(0, 5 - selectedBrand.maniac_level))}
                </span>
              </div>

              {/* 哲学 */}
              <div>
                <p className="text-xs tracking-widest text-gray-400 uppercase mb-2">Philosophy</p>
                <p className="text-sm text-gray-700 leading-relaxed">{selectedBrand.description}</p>
              </div>

              {/* 世界観タグ */}
              <div>
                <p className="text-xs tracking-widest text-gray-400 uppercase mb-2">World View</p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedBrand.worldview_tags.map((tag) => (
                    <span key={tag} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">{tag}</span>
                  ))}
                </div>
              </div>

              {/* 時代タグ */}
              {selectedBrand.era_tags?.length > 0 && (
                <div>
                  <p className="text-xs tracking-widest text-gray-400 uppercase mb-2">Era</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedBrand.era_tags.map((tag) => (
                      <span key={tag} className="px-2 py-0.5 bg-gray-50 text-gray-500 text-xs rounded-full">{tag}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* なぜ合うのか（タグマッチング） */}
              {beliefKeywords.length > 0 && (() => {
                const matching = getMatchingTags(selectedBrand.worldview_tags, beliefKeywords);
                return matching.length > 0 ? (
                  <div className="bg-emerald-50 rounded-xl p-4">
                    <p className="text-xs tracking-widest text-emerald-600 uppercase mb-2">あなたの世界観との共鳴</p>
                    <div className="flex flex-wrap gap-1.5">
                      {matching.map((tag) => (
                        <span key={tag} className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded-full">{tag}</span>
                      ))}
                    </div>
                  </div>
                ) : null;
              })()}

              {/* リンク */}
              {(selectedBrand.official_url || selectedBrand.instagram_url) && (
                <div className="flex gap-3">
                  {selectedBrand.official_url && (
                    <a
                      href={selectedBrand.official_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-2.5 bg-gray-800 text-white rounded-xl text-xs text-center hover:bg-gray-700 transition-colors"
                    >
                      公式サイト
                    </a>
                  )}
                  {selectedBrand.instagram_url && (
                    <a
                      href={selectedBrand.instagram_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-xs text-center hover:border-gray-400 transition-colors"
                    >
                      Instagram
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
