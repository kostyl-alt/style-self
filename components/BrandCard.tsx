import type { BrandRecommendation } from "@/types/index";

const PRICE_LABEL: Record<string, string> = {
  budget: "¥",
  mid: "¥¥",
  high: "¥¥¥",
  luxury: "¥¥¥¥",
};

export function BrandCard({ rec }: { rec: BrandRecommendation }) {
  const { brand, reason, matchTags, matchScore, whyThisBrand, tryFirst, caution } = rec;

  return (
    <div className="border border-gray-100 rounded-2xl p-5 space-y-3">
      {/* ヘッダー */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-900">{brand.name}</p>
          {brand.nameJa && (
            <p className="text-xs text-gray-400 mt-0.5">{brand.nameJa}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-gray-400">{PRICE_LABEL[brand.priceRange]}</span>
          <div className="flex gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <span
                key={i}
                className={`w-1.5 h-1.5 rounded-full ${
                  i < matchScore ? "bg-gray-800" : "bg-gray-200"
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* 一致理由 */}
      <p className="text-xs text-gray-500 leading-relaxed">{reason}</p>

      {/* なぜこのブランドか */}
      {whyThisBrand && (
        <div className="bg-gray-50 rounded-xl px-3 py-2.5">
          <p className="text-xs text-gray-400 mb-0.5">診断との一致</p>
          <p className="text-xs text-gray-700 leading-relaxed">{whyThisBrand}</p>
        </div>
      )}

      {/* 試すならこれ */}
      {tryFirst && (
        <div className="flex items-start gap-2">
          <span className="text-xs text-gray-400 flex-shrink-0 mt-0.5">まず試すなら</span>
          <p className="text-xs text-gray-700 leading-relaxed">{tryFirst}</p>
        </div>
      )}

      {/* 注意点 */}
      {caution && (
        <div className="flex items-start gap-2">
          <span className="text-xs text-amber-500 flex-shrink-0 mt-0.5">注意</span>
          <p className="text-xs text-gray-500 leading-relaxed">{caution}</p>
        </div>
      )}

      {/* タグ */}
      <div className="flex flex-wrap gap-1.5">
        {matchTags.map((tag) => (
          <span
            key={tag}
            className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full"
          >
            {tag}
          </span>
        ))}
      </div>

      {/* リンク */}
      {(brand.officialUrl ?? brand.instagramUrl) && (
        <div className="flex gap-2 pt-1">
          {brand.officialUrl && (
            <a
              href={brand.officialUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:border-gray-400 hover:text-gray-800 transition-colors"
            >
              公式サイト
            </a>
          )}
          {brand.instagramUrl && (
            <a
              href={brand.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:border-gray-400 hover:text-gray-800 transition-colors"
            >
              Instagram
            </a>
          )}
        </div>
      )}
    </div>
  );
}
