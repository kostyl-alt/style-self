"use client";

import { useState } from "react";
import type {
  WardrobeItem,
  PurchaseCheckResponse,
  ResolvedPairingGroup,
  ResolvedPairingCandidate,
  PairingSource,
} from "@/types/index";

interface PurchaseCheckPanelProps {
  item: WardrobeItem;
  onStatusChange: (id: string, status: "owned" | "passed") => void;
}

const SCORE_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: "世界観と合わない", color: "text-red-500" },
  2: { label: "やや合わない",     color: "text-orange-500" },
  3: { label: "ニュートラル",     color: "text-gray-500" },
  4: { label: "よく合う",         color: "text-blue-600" },
  5: { label: "完璧に一致",       color: "text-emerald-600" },
};

const SOURCE_CONFIG: Record<PairingSource, { icon: string; bgColor: string; badgeColor: string }> = {
  owned:      { icon: "👗", bgColor: "bg-gray-50",    badgeColor: "bg-gray-100 text-gray-600" },
  brand:      { icon: "🏷️", bgColor: "bg-blue-50",   badgeColor: "bg-blue-100 text-blue-700" },
  crossBrand: { icon: "✨", bgColor: "bg-amber-50",   badgeColor: "bg-amber-100 text-amber-700" },
  external:   { icon: "🔗", bgColor: "bg-purple-50",  badgeColor: "bg-purple-100 text-purple-700" },
};

const REASONS_LABELS: { key: keyof ResolvedPairingCandidate["reasons"]; label: string }[] = [
  { key: "color",     label: "色" },
  { key: "material",  label: "素材" },
  { key: "silhouette",label: "シルエット" },
  { key: "taste",     label: "テイスト" },
  { key: "worldview", label: "世界観" },
];

function CandidateCard({ candidate }: { candidate: ResolvedPairingCandidate }) {
  const [showReasons, setShowReasons] = useState(false);
  const config = SOURCE_CONFIG[candidate.source];
  const isVirtual = !candidate.item;

  return (
    <div className={`rounded-xl border border-transparent ${config.bgColor}`}>
      <div className="flex items-center gap-3 px-3 py-2.5">
        {candidate.item?.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={candidate.item.imageUrl}
            alt={candidate.name}
            className="w-9 h-9 rounded-lg object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-9 h-9 rounded-lg bg-white/60 flex items-center justify-center text-base flex-shrink-0">
            {isVirtual ? "💭" : config.icon}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-900 truncate">{candidate.name}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            {candidate.brand && (
              <span className="text-xs text-gray-400 truncate">{candidate.brand}</span>
            )}
            {candidate.color && (
              <span className="text-xs text-gray-400">· {candidate.color}</span>
            )}
            {isVirtual && (
              <span className="text-xs text-gray-400 italic">提案アイテム</span>
            )}
          </div>
        </div>
        <button
          onClick={() => setShowReasons(!showReasons)}
          className="flex-shrink-0 text-xs text-gray-400 hover:text-gray-600 transition-colors px-1"
        >
          {showReasons ? "▲" : "なぜ▼"}
        </button>
      </div>

      {showReasons && (
        <div className="px-3 pb-3 space-y-1.5">
          <div className="bg-white/70 rounded-lg p-2.5 space-y-1">
            {REASONS_LABELS.map(({ key, label }) => (
              <div key={key} className="flex gap-2">
                <span className="text-xs text-gray-400 w-14 flex-shrink-0">{label}</span>
                <span className="text-xs text-gray-700 leading-relaxed">
                  {candidate.reasons?.[key] ?? "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PairingGroupSection({ group }: { group: ResolvedPairingGroup }) {
  const [isOpen, setIsOpen] = useState(true);
  const config = SOURCE_CONFIG[group.source];
  const isEmpty = group.candidates.length === 0;

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-2"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm">{config.icon}</span>
          <span className="text-xs font-medium text-gray-700">{group.label}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded-full ${config.badgeColor}`}>
            {group.candidates.length}件
          </span>
        </div>
        <span className="text-xs text-gray-400">{isOpen ? "▲" : "▼"}</span>
      </button>

      {isOpen && (
        <div className="space-y-2 mt-1">
          {isEmpty ? (
            <p className="text-xs text-gray-400 py-2 px-1">
              {group.source === "brand" ? "同ブランドの手持ちアイテムなし" : "候補なし"}
            </p>
          ) : (
            group.candidates.map((c, i) => (
              <CandidateCard key={`${c.item?.id ?? "virtual"}-${i}`} candidate={c} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function PurchaseCheckPanel({ item, onStatusChange }: PurchaseCheckPanelProps) {
  const [result, setResult] = useState<PurchaseCheckResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [memo, setMemo] = useState("");

  async function handleCheck() {
    setIsLoading(true);
    setApiError(null);
    try {
      const res = await fetch("/api/ai/purchase-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id }),
      });
      const data = await res.json() as PurchaseCheckResponse & { error?: string };
      if (!res.ok) {
        setApiError(data.error ?? "AI判定に失敗しました");
        return;
      }
      setResult(data);
      setIsExpanded(true);
    } catch {
      setApiError("通信エラーが発生しました");
    } finally {
      setIsLoading(false);
    }
  }

  const score = result?.result.worldviewScore ?? 0;
  const scoreInfo = SCORE_LABELS[score];

  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
      {/* ヘッダー */}
      <div className="flex items-center gap-3 p-4">
        <div className="w-12 h-12 rounded-xl bg-gray-50 flex-shrink-0 overflow-hidden">
          {item.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xl text-gray-200">?</div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
          <p className="text-xs text-gray-400">
            {item.color}{item.material ? ` · ${item.material}` : ""}
            {item.brand ? ` · ${item.brand}` : ""}
          </p>
        </div>
        <button
          onClick={handleCheck}
          disabled={isLoading}
          className="flex-shrink-0 px-3 py-1.5 bg-gray-800 text-white rounded-lg text-xs disabled:opacity-40 hover:bg-gray-700 transition-colors"
        >
          {isLoading ? "分析中..." : result ? "再分析" : "AI判定"}
        </button>
      </div>

      {/* エラー */}
      {apiError && (
        <div className="border-t border-gray-50 px-4 py-3">
          <p className="text-xs text-red-500">{apiError}</p>
        </div>
      )}

      {/* AI結果 */}
      {result && isExpanded && (
        <div className="border-t border-gray-50 px-4 pb-4 pt-3 space-y-5">

          {/* 世界観スコア */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500">世界観一致度</span>
              {scoreInfo && (
                <span className={`text-xs font-medium ${scoreInfo.color}`}>{scoreInfo.label}</span>
              )}
            </div>
            <div className="flex gap-1 mb-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <div
                  key={n}
                  className={`flex-1 h-1.5 rounded-full transition-colors ${
                    n <= score ? "bg-gray-800" : "bg-gray-100"
                  }`}
                />
              ))}
            </div>
            <p className="text-xs text-gray-500">{result.result.worldviewComment}</p>
          </div>

          {/* 類似アイテム */}
          {result.similarResolved.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-600 mb-2">手持ちに似ているアイテム</p>
              <div className="space-y-2">
                {result.similarResolved.map(({ item: si, reason }) => (
                  <div key={si.id} className="flex items-start gap-2 bg-amber-50 rounded-xl px-3 py-2">
                    <span className="text-xs font-medium text-amber-800 flex-shrink-0 mt-0.5">{si.name}</span>
                    <span className="text-xs text-amber-700">{reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 合わせ方の提案（3グループ） */}
          <div>
            <p className="text-xs font-medium text-gray-600 mb-3">合わせ方の提案</p>
            <div className="space-y-1 divide-y divide-gray-50">
              {result.pairingGroupsResolved.map((group) => (
                <PairingGroupSection key={group.source} group={group} />
              ))}
            </div>
          </div>

          {/* 買う / 見送り */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-emerald-50 rounded-xl p-3">
              <p className="text-xs font-medium text-emerald-700 mb-1">買う理由</p>
              <p className="text-xs text-emerald-600 leading-relaxed">{result.result.buyReason}</p>
            </div>
            <div className="bg-red-50 rounded-xl p-3">
              <p className="text-xs font-medium text-red-700 mb-1">見送る理由</p>
              <p className="text-xs text-red-600 leading-relaxed">{result.result.passReason}</p>
            </div>
          </div>

          {/* 判断メモ */}
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">判断メモ（任意）</label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={2}
              placeholder="買う・見送る理由を自分の言葉で..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 placeholder-gray-300 focus:outline-none focus:border-gray-400 resize-none"
            />
          </div>

          {/* アクションボタン */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onStatusChange(item.id, "owned")}
              className="py-3 bg-gray-800 text-white rounded-xl text-xs font-medium hover:bg-gray-700 transition-colors"
            >
              買う → 所有中へ
            </button>
            <button
              onClick={() => onStatusChange(item.id, "passed")}
              className="py-3 border border-gray-200 text-gray-600 rounded-xl text-xs font-medium hover:bg-gray-50 transition-colors"
            >
              見送る → 見送りへ
            </button>
          </div>
        </div>
      )}

      {result && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full py-2 text-xs text-gray-400 hover:text-gray-600 border-t border-gray-50 transition-colors"
        >
          {isExpanded ? "閉じる ▲" : "詳細を見る ▼"}
        </button>
      )}
    </div>
  );
}
