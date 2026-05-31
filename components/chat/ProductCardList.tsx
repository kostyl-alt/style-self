// Sprint G-2a: 商品候補リスト(★ カテゴリ別グループ + カテゴリ内 score 降順・論点 G2-3)
//
// 設計: docs/STYLE-SELF_Sprint-G-2_商品候補UI_..._設計調査.md(18b2a29)§C
// 空 / loading / error 状態対応。G-2b で /api/products/candidates の結果を流す。

"use client";

import type { ProductCandidate, CandidateCategory } from "@/types/product-candidate";
import ProductCard from "@/components/chat/ProductCard";

interface Props {
  candidates: ProductCandidate[];
  loading?:   boolean;
  error?:     string | null;
  onTryOn?:   (productId: string) => void;
}

// 固定カテゴリ順 + 日本語見出し(論点: 日本語推奨)
const CATEGORY_ORDER: CandidateCategory[] = ["outer", "tops", "bottoms", "shoes", "accessory"];
const CATEGORY_LABEL: Record<CandidateCategory, string> = {
  outer: "アウター", tops: "トップス", bottoms: "ボトムス", shoes: "シューズ", accessory: "小物",
};

export default function ProductCardList({ candidates, loading, error, onTryOn }: Props) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-3 rounded-xl border border-gray-100 p-3">
            <div className="aspect-[3/4] w-24 animate-pulse rounded-lg bg-gray-100 sm:w-28" />
            <div className="flex-1 space-y-2 py-1">
              <div className="h-3 w-1/3 animate-pulse rounded bg-gray-100" />
              <div className="h-3 w-2/3 animate-pulse rounded bg-gray-100" />
              <div className="h-3 w-full animate-pulse rounded bg-gray-100" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="px-1 py-3 text-sm text-red-600">{error}</p>;
  }

  if (candidates.length === 0) {
    return <p className="px-1 py-3 text-sm text-gray-500">条件に合う商品が見つかりませんでした。</p>;
  }

  // カテゴリ別グループ化 + 各カテゴリ内 score 降順
  const grouped = CATEGORY_ORDER
    .map((cat) => ({
      cat,
      items: candidates
        .filter((c) => c.category === cat)
        .sort((a, b) => b.score - a.score),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="space-y-4">
      {grouped.map(({ cat, items }) => (
        <section key={cat} className="space-y-2">
          <h3 className="text-sm font-medium text-gray-500">{CATEGORY_LABEL[cat]}</h3>
          <div className="space-y-2">
            {items.map((c) => (
              <ProductCard key={`${c.source}:${c.source_product_id}`} candidate={c} onTryOn={onTryOn} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
