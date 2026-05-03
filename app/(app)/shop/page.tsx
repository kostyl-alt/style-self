"use client";

import { VirtualTab } from "@/components/style/StyleTabs";

export default function ShopPage() {
  return (
    <div className="min-h-screen bg-white pb-24">
      <div className="max-w-lg mx-auto px-4 py-12">
        <div className="mb-8">
          <p className="text-xs tracking-widest text-gray-400 uppercase mb-1">Shop</p>
          <h1 className="text-2xl font-light text-gray-900">買う</h1>
          <p className="text-sm text-gray-500 mt-2">コンセプトを入れると理想のコーデと商品候補を提案</p>
        </div>
        <VirtualTab />
      </div>
    </div>
  );
}
