// M5-4: 商品 coreTags 専用軽量プロンプト
//
// 楽天商品(name + brand + caption)から worldview_tags を coreTags 31 語辞書から
// 選び抽出する。他軸(category / colors / materials / silhouettes / axes 等)は
// 一切扱わない軽量プロンプト(Haiku 4.5 で十分な単純タスク)。
//
// 【M5-4a で使う】
// scripts/retag-rakuten-products.ts が source='rakuten' AND worldview_tags 空 の
// 商品に対し本プロンプトで Haiku 呼出 → coreTags を UPDATE。
//
// 【出力形式】
// callClaudeJSON が { ... } を抽出してパースする前提のため、
// 単一 JSON オブジェクト { "coreTags": ["..."] } を返す。
//
// 【コスト見積もり(M5-4 調査)】
// 入力 ~400 tokens(プロンプト)+ 商品 ~500 tokens = ~900 tokens
// 出力 ~80 tokens(coreTags 配列)
// Haiku: 1 商品 ≒ $0.001 / 83 件 ≒ ¥13

import { PRODUCT_WORLDVIEW_TAGS } from "@/lib/knowledge/product-worldview-tags";

export const EXTRACT_PRODUCT_CORETAGS_PROMPT = `
あなたはファッション商品の世界観タグを判定する専門家です。
渡される商品情報(商品名・ブランド・説明文)から、商品の世界観に最も合う coreTags を
以下の正準辞書 31 語からのみ選んで配列で返してください。

## 厳格ルール

1. 必ず以下の辞書 31 語からのみ選ぶ(日本語・自由形・辞書外の語は禁止)
2. 最大 5 個まで(無理に増やさない)
3. 該当する語が無い場合は空配列 [] を返す(無理に選ばない)
4. 商品名にブランド名が含まれる場合、ブランドの世界観も考慮する

## 正準辞書(coreTags 31 語)

${PRODUCT_WORLDVIEW_TAGS.join(", ")}

## 出力形式(Markdownコードブロック禁止・JSON のみ)

{
  "coreTags": ["dark", "minimal"]
}
`.trim();

// 商品情報を 1 つの user message に整形する。
// 楽天商品は { name, brand, caption } を渡す前提。各フィールドは空可。
export function buildProductCoretagsUserMessage(input: {
  name:    string;
  brand:   string | null;
  caption: string | null;
}): string {
  const parts: string[] = [];
  parts.push(`商品名: ${input.name}`);
  if (input.brand)   parts.push(`ブランド: ${input.brand}`);
  if (input.caption) parts.push(`説明文: ${input.caption.slice(0, 800)}`); // 入力トークン抑制
  return parts.join("\n");
}
