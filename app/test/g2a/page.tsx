// Sprint G-2a: 商品候補 UI レンダ検証用 一時ページ(★ G-2b 着工時に削除予定)
//
// /test/g2a で ProductCardList をモックデータで目視確認できる。
// ★ 本ページはどこからもリンクされず、本番フローに影響しない(検証専用)。

"use client";

import ProductCardList from "@/components/chat/ProductCardList";
import type { ProductCandidate } from "@/types/product-candidate";

const MOCK: ProductCandidate[] = [
  {
    source: "rakuten", source_product_id: "r1", title: "ウール混 オーバーサイズ チェスターコート ブラック",
    brand: "SHOP NOIR", price: 18900, image_url: null, product_url: "https://example.com/r1",
    affiliate_url: "https://example.com/aff/r1", category: "outer", score: 91,
    reasoning: "ムードボードの『静かな緊張感』を、低光沢の黒ウールと長め丈で体現。縦のラインを作る要素として機能する。",
  },
  {
    source: "rakuten", source_product_id: "r2", title: "ロング ステンカラーコート",
    brand: null, price: 12800, image_url: null, product_url: null,
    affiliate_url: "https://example.com/aff/r2", category: "outer", score: 78,
    reasoning: "中性的なシルエットで世界観の方向性に合致。日常に取り入れやすい一着として機能する。",
  },
  {
    source: "rakuten", source_product_id: "r3", title: "ハイゲージ モックネック ニット 黒",
    brand: "BASIC LAB", price: 5400, image_url: null, product_url: "https://example.com/r3",
    affiliate_url: null, category: "tops", score: 84,
    reasoning: "首元を覆うモックネックが静謐な印象を補強。素材の落ち感で過剰な装飾を避け、世界観の核を保つ。",
  },
  {
    source: "rakuten", source_product_id: "r4", title: "厚底 レザー ブーツ",
    brand: "STEP", price: 15600, image_url: null, product_url: "https://example.com/r4",
    affiliate_url: "https://example.com/aff/r4", category: "shoes", score: 88,
    reasoning: "重心を足元に置く厚底が全体に緊張感を加える。色を黒で締めることでムードボードの不穏さを足元から支える。",
  },
];

export default function G2aTestPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <header>
        <p className="text-xs uppercase tracking-widest text-gray-400">G-2a 検証</p>
        <h1 className="text-lg font-light text-gray-900">商品候補 UI(モックデータ)</h1>
      </header>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-gray-700">通常表示</h2>
        <ProductCardList candidates={MOCK} onTryOn={(id) => alert(`試着(G-3で実装): ${id}`)} />
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-gray-700">ローディング</h2>
        <ProductCardList candidates={[]} loading />
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-gray-700">空状態</h2>
        <ProductCardList candidates={[]} />
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-gray-700">エラー</h2>
        <ProductCardList candidates={[]} error="商品検索に失敗しました" />
      </section>
    </div>
  );
}
