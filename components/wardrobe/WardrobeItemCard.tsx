import type { WardrobeItem } from "@/types/index";

const CATEGORY_LABELS: Record<string, string> = {
  tops:        "トップス",
  bottoms:     "ボトムス",
  outerwear:   "アウター",
  jacket:      "ジャケット",
  vest:        "ベスト",
  inner:       "インナー",
  dress:       "ワンピース",
  setup:       "セットアップ",
  shoes:       "シューズ",
  bags:        "バッグ",
  accessories: "アクセサリー",
  hat:         "帽子",
  jewelry:     "ジュエリー",
  roomwear:    "ルームウェア",
  other:       "その他",
};

const CATEGORY_EMOJI: Record<string, string> = {
  tops:        "👕",
  bottoms:     "👖",
  outerwear:   "🧥",
  jacket:      "🥼",
  vest:        "🦺",
  inner:       "👚",
  dress:       "👗",
  setup:       "🩱",
  shoes:       "👟",
  bags:        "👜",
  accessories: "💍",
  hat:         "🧢",
  jewelry:     "📿",
  roomwear:    "🏠",
  other:       "🏷️",
};

interface WardrobeItemCardProps {
  item: WardrobeItem;
  onDelete: (id: string, imageUrl: string | null) => void;
}

export default function WardrobeItemCard({ item, onDelete }: WardrobeItemCardProps) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden group">
      <div className="relative aspect-square bg-gray-50">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-4xl text-gray-200">
              {CATEGORY_EMOJI[item.category] ?? "🏷️"}
            </span>
          </div>
        )}
        <button
          onClick={() => onDelete(item.id, item.imageUrl)}
          className="absolute top-2 right-2 w-7 h-7 bg-white/90 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 text-gray-400 hover:text-red-400 text-xs"
          aria-label="削除"
        >
          ✕
        </button>
      </div>

      <div className="p-3">
        <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-gray-400">{CATEGORY_LABELS[item.category] ?? item.category}</span>
          {item.color && (
            <>
              <span className="text-gray-200">·</span>
              <span className="text-xs text-gray-400">
                {item.color}{item.subColor ? ` / ${item.subColor}` : ""}
              </span>
            </>
          )}
        </div>
        {item.material && (
          <p className="text-xs text-gray-300 mt-0.5 truncate">{item.material}</p>
        )}
      </div>
    </div>
  );
}
