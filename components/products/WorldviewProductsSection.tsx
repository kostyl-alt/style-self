"use client";

// フェーズB Step 4: 世界観に合う商品セクション
//
// /self と /home の両方から使う共通コンポーネント。
// - variant="self":  カテゴリ別に ProductMatchList を縦並びで表示(リッチ)
// - variant="home":  flat 横スクロール 1 行(軽量)
//
// fetchWorldviewProducts は client-side fetch を使うため、このコンポーネントは
// "use client" 必須。

import { useEffect, useState } from "react";
import ProductMatchList from "@/components/coordinate/ProductMatchList";
import ProductMatchCard from "@/components/coordinate/ProductMatchCard";
import {
  fetchWorldviewProducts,
  type WorldviewProductsResult,
} from "@/lib/utils/worldview-products";
import type { StyleDiagnosisResult } from "@/types/index";

const CATEGORY_LABELS: Record<string, string> = {
  tops:       "トップス",
  bottoms:    "ボトムス",
  outerwear:  "アウター",
  shoes:      "シューズ",
  accessories: "小物",
  bags:       "バッグ",
};

interface Props {
  analysis: StyleDiagnosisResult | null;
  variant:  "self" | "home";
}

export default function WorldviewProductsSection({ analysis, variant }: Props) {
  const [result, setResult]   = useState<WorldviewProductsResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!analysis) return;
    let cancelled = false;
    setLoading(true);
    fetchWorldviewProducts(analysis, variant === "home" ? { flatMax: 6 } : {})
      .then((r) => { if (!cancelled) setResult(r); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [analysis, variant]);

  if (!analysis) return null;

  const flatHasProducts  = (result?.flat.length ?? 0) > 0;
  const byCatHasProducts = (result?.byCategory ?? []).some((c) => c.products.length > 0);

  // ロード完了後に商品ゼロなら優雅に非表示(空セクションを出さない)
  if (!loading && result && !flatHasProducts && !byCatHasProducts) return null;

  if (variant === "home") {
    return (
      <div>
        <p className="text-xs tracking-widest text-gray-400 uppercase mb-3">
          Products for You
        </p>
        {loading || !result ? (
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex-shrink-0 w-44 bg-gray-50 border border-gray-100 rounded-xl overflow-hidden animate-pulse">
                <div className="w-full aspect-[4/5] bg-gray-100" />
                <div className="p-3 space-y-2">
                  <div className="h-2.5 bg-gray-100 rounded w-1/2" />
                  <div className="h-3 bg-gray-100 rounded w-full" />
                  <div className="h-4 bg-gray-100 rounded w-1/3 mt-2" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 -mx-1 px-1 scrollbar-hide">
            {result.flat.map((p) => (
              <div key={p.id} className="snap-start flex-shrink-0 w-44">
                <ProductMatchCard product={p} />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // variant === "self": per-category 表示
  return (
    <section className="space-y-4">
      <div className="mb-3">
        <p className="text-[10px] tracking-[0.3em] text-gray-400 uppercase">Products for You</p>
        <p className="text-xs text-gray-500 mt-0.5">あなたの世界観に合う商品</p>
      </div>

      {loading || !result ? (
        // 全体ローディングは ProductMatchList の isLoading に任せて 1 ブロック分だけ出す
        <ProductMatchList products={[]} isLoading={true} />
      ) : (
        result.byCategory.map((bc) => (
          bc.products.length > 0 && (
            <div key={bc.category}>
              <p className="text-xs text-gray-500 mb-1.5">
                {CATEGORY_LABELS[bc.category] ?? bc.category}
              </p>
              <ProductMatchList products={bc.products} isLoading={false} />
            </div>
          )
        ))
      )}
    </section>
  );
}
