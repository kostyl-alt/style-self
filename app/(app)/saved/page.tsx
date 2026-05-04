"use client";

import { SavedTab } from "@/components/style/StyleTabs";
import SavedProductsList from "@/components/saved/SavedProductsList";
import { Bookmark } from "lucide-react";

export default function SavedPage() {
  return (
    <div className="min-h-screen bg-white pb-24">
      <div className="max-w-lg mx-auto px-4 py-12 space-y-10">
        <div>
          <p className="text-xs tracking-widest text-gray-400 uppercase mb-1">Saved</p>
          <h1 className="text-2xl font-light text-gray-900 flex items-center gap-2">
            <Bookmark size={22} strokeWidth={1.6} className="text-gray-700" />
            保存
          </h1>
          <p className="text-sm text-gray-500 mt-2 leading-relaxed">
            気に入ったコーデ・商品・投稿・カルチャーをここで一覧できます。
          </p>
        </div>

        {/* Section 1: 保存したコーデ */}
        <section>
          <p className="text-xs tracking-widest text-gray-400 uppercase mb-3">Saved Outfits</p>
          <SavedTab />
        </section>

        {/* Section 2: 保存した商品 */}
        <section>
          <p className="text-xs tracking-widest text-gray-400 uppercase mb-3">Saved Products</p>
          <SavedProductsList />
        </section>

        {/* Section 3: 保存した投稿（将来） */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <p className="text-xs tracking-widest text-gray-400 uppercase">Saved Posts</p>
            <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-400 rounded-full">Coming soon</span>
          </div>
          <div className="border border-dashed border-gray-200 rounded-2xl p-6 text-center">
            <p className="text-sm text-gray-400">他のユーザーの投稿を保存できるようになります</p>
          </div>
        </section>

        {/* Section 4: 保存したカルチャー（将来） */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <p className="text-xs tracking-widest text-gray-400 uppercase">Saved Culture</p>
            <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-400 rounded-full">Coming soon</span>
          </div>
          <div className="border border-dashed border-gray-200 rounded-2xl p-6 text-center">
            <p className="text-sm text-gray-400">惹かれた音楽・映画・香り・ブランドをここに集めます</p>
          </div>
        </section>
      </div>
    </div>
  );
}
