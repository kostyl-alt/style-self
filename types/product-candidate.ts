// Sprint G-1: 実商品候補(multi-source 前提・Layer 1 は楽天のみ)型定義
//
// 設計: docs/STYLE-SELF_Sprint-G_実商品検索本体_multi_source_product_catalog_設計調査.md(716bd3a)
// 戦略: E-0f(206bc19 実商品試着主軸)/ E-0g(93d39ae multi-source・服好きターゲット)
//
// ★ G-1 スコープ: 候補生成(moodboard → 楽天検索 → LLM 評価)。UI は G-2・try-on は G-3。
// ★ source は将来 12 種(E-0g §4)。Layer 1 は "rakuten" のみ。

export type ProductSource =
  | "rakuten" | "zozotown" | "ssense" | "farfetch" | "hbx" | "gr8"
  | "nubian" | "dover_street_market" | "official_ec" | "select_shop"
  | "vintage" | "insta_brand";

// 候補カテゴリ(E-0f UI・商品検索対象。hair/makeup は楽天商品検索対象外のため G-1 では扱わない)
export type CandidateCategory = "outer" | "tops" | "bottoms" | "shoes" | "accessory";

export interface ProductCandidate {
  source:            ProductSource;   // Layer 1: "rakuten"
  source_product_id: string;          // 楽天 itemCode 等
  title:             string;
  brand:             string | null;
  price:             number | null;
  image_url:         string | null;   // ★ try-on 入力(G-3)
  product_url:       string | null;
  affiliate_url:     string | null;   // ★ 購入導線
  category:          CandidateCategory;
  score:             number;          // 0-100(LLM 世界観適合評価)
  reasoning:         string;          // ★ 「なぜ合うか」(80-120字)
}

export interface CandidatesResponse {
  moodboardId:  string;
  candidates:   ProductCandidate[];
  queriesUsed:  string[];     // デバッグ用(各カテゴリの検索キーワード)
  fallbackText?: string;      // LLM JSON parse 失敗時(退行ゼロ)
}
