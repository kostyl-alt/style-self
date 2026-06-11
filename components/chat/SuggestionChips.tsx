"use client";

// A-5 P1-D: 履歴 0 件時の発火点・5 intent 各 1 つの提案チップ
//
// 設計: docs/STYLE-SELF_D1_A-5_P1-D_設計調査.md(c126f76)§3.2
//
// 振る舞い:
//   ・チップタップ → 親側 onSelect(text) 経由で textarea に挿入(直接送信しない)
//   ・履歴 0 件時のみ表示(連続発話時はノイズ防止)
//   ・4 タップで 4 intent(closet/coordinate/style-consult/brand-learn)全体験（診断撤廃 第4段Bで diagnose 撤去）

interface SuggestionChipsProps {
  onSelect: (text: string) => void;
}

// ★ 4 intent 各 1 つ・ビジョン df36d82 直対応文言
const CHIPS: ReadonlyArray<{ label: string; intent: string }> = [
  { label: "黒い服のコーデが見たい",                 intent: "coordinate" },
  { label: "自分の世界観に合うブランドを知りたい",   intent: "brand-learn" },
  { label: "低身長だけどロングコートを着たい",       intent: "style-consult" },
  { label: "クローゼットを見せて",                   intent: "closet" },
];

export default function SuggestionChips({ onSelect }: SuggestionChipsProps) {
  return (
    <div className="py-6 space-y-3">
      <p className="text-xs text-gray-500 text-center leading-relaxed">
        自然言語で書いてください。下から例文を選ぶこともできます。
      </p>
      <div className="flex flex-wrap gap-2 justify-center px-2">
        {CHIPS.map((chip) => (
          <button
            key={chip.intent}
            type="button"
            onClick={() => onSelect(chip.label)}
            className="text-xs px-3 py-1.5 rounded-full border border-gray-200 text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-300 transition-colors"
          >
            {chip.label}
          </button>
        ))}
      </div>
    </div>
  );
}
