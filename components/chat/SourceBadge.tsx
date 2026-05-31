// Sprint G-2a: 商品ソースバッジ(★ ホバー時のみ表示・色分けなし)
//
// 設計: docs/STYLE-SELF_Sprint-G-2_商品候補UI_..._設計調査.md(18b2a29)§F・論点 G2-7
// E-0g「どこで買えるかより世界観」→ ソースは控えめ・全 source 同じ色。

"use client";

import type { ProductSource } from "@/types/product-candidate";

const SOURCE_LABEL: Record<ProductSource, string> = {
  rakuten:             "楽天",
  zozotown:            "ZOZO",
  ssense:              "SSENSE",
  farfetch:            "Farfetch",
  hbx:                 "HBX",
  gr8:                 "GR8",
  nubian:              "Nubian",
  dover_street_market: "DSM",
  official_ec:         "公式",
  select_shop:         "セレクト",
  vintage:             "古着",
  insta_brand:         "ブランド",
};

interface Props {
  source:    ProductSource;
  className?: string;
}

export default function SourceBadge({ source, className = "" }: Props) {
  return (
    <span
      className={`pointer-events-none absolute top-2 right-2 rounded-md bg-black/70 px-2 py-0.5 text-xs text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100 ${className}`}
    >
      {SOURCE_LABEL[source]}
    </span>
  );
}
