import type { BrandRecommendation } from "@/types/index";

const PRICE_LABEL: Record<string, string> = {
  budget: "¥",
  mid: "¥¥",
  high: "¥¥¥",
  luxury: "¥¥¥¥",
};

export function BrandCard({ rec }: { rec: BrandRecommendation }) {
  const { brand, reason, matchTags, matchScore } = rec;

  return (
    <div className="border border-gray-100 rounded-2xl p-5 space-y-3">
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

      <p className="text-xs text-gray-500 leading-relaxed">{reason}</p>

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
