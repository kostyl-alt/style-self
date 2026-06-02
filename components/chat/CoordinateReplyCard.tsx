"use client";

// Phase 2: MB context object 由来 coordinate の「短く行動可能」な表示。
//
// 主表示（常時）: 方向性 / 探す / 避ける / 検索ワード(タップでコピー) / 条件 → アクションボタン
// 折りたたみ（既定閉じる）: 要約 / アイテム要点 / 参考画像の反映
//
// 直接コーデ / 旧 coordinate_v2（行動可能フィールド無し）はこのカードを使わず
// 既存描画にフォールバックする（呼び出し側 ai/page で presence 判定）。

import { useState } from "react";
import type { CoordinateReply, QuickAction } from "@/types/coordinate-reply";

interface Props {
  coordinate:  CoordinateReply;
  onSendPrompt: (prompt: string) => void;
}

export default function CoordinateReplyCard({ coordinate, onSendPrompt }: Props) {
  const [open, setOpen] = useState(false);
  const co = coordinate;

  const fit = co.fitConditions;
  const fitRows: { label: string; values: string[] }[] = fit
    ? [
        { label: "素材", values: fit.materials ?? [] },
        { label: "色", values: fit.colors ?? [] },
        { label: "丈", values: fit.lengths ?? [] },
        { label: "シルエット", values: fit.silhouettes ?? [] },
      ].filter((r) => r.values.length > 0)
    : [];

  const actions: QuickAction[] = [...(co.quickActions ?? []), ...(co.customActions ?? [])];
  const hasDetail =
    !!co.summary || (co.items?.length ?? 0) > 0 || (co.sources?.length ?? 0) > 0;

  return (
    <div className="bg-gray-50 text-gray-900 text-sm rounded-2xl rounded-bl-md px-4 py-4 space-y-4 leading-relaxed">
      {/* 方向性 */}
      {co.direction && <p className="font-bold">{co.direction}</p>}

      {/* 探す */}
      {(co.findThese?.length ?? 0) > 0 && (
        <Section label="🔍 探す">
          <ul className="space-y-1">
            {co.findThese!.map((s, i) => (
              <li key={i} className="flex gap-2"><span className="text-gray-400 flex-shrink-0">•</span><span>{s}</span></li>
            ))}
          </ul>
        </Section>
      )}

      {/* 避ける */}
      {(co.avoidThese?.length ?? 0) > 0 && (
        <Section label="🚫 避ける">
          <ul className="space-y-1">
            {co.avoidThese!.map((s, i) => (
              <li key={i} className="flex gap-2"><span className="text-gray-400 flex-shrink-0">•</span><span>{s}</span></li>
            ))}
          </ul>
        </Section>
      )}

      {/* 検索ワード（タップでコピー） */}
      {(co.searchKeywords?.length ?? 0) > 0 && (
        <Section label="🏷 検索ワード（タップでコピー）">
          <div className="flex flex-wrap gap-1.5">
            {co.searchKeywords!.map((kw, i) => <CopyChip key={i} text={kw} />)}
          </div>
        </Section>
      )}

      {/* 条件 */}
      {fitRows.length > 0 && (
        <Section label="📐 条件">
          <div className="space-y-1">
            {fitRows.map((r) => (
              <div key={r.label} className="flex gap-2">
                <span className="text-gray-400 w-16 flex-shrink-0">{r.label}</span>
                <span>{r.values.join(" / ")}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* アクションボタン */}
      {actions.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {actions.map((a, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onSendPrompt(a.prompt)}
              className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-full text-xs hover:bg-gray-100 transition-colors"
            >
              {a.label}
            </button>
          ))}
        </div>
      )}

      {/* 折りたたみ詳細 */}
      {hasDetail && (
        <div className="border-t border-gray-200 pt-2">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            {open ? "詳しく ▲" : "詳しく見る ▼"}
          </button>
          {open && (
            <div className="mt-3 space-y-3">
              {co.summary && <p className="text-gray-700 whitespace-pre-wrap">{co.summary}</p>}
              {(co.items?.length ?? 0) > 0 && (
                <div className="space-y-1.5">
                  {co.items.map((it, i) => (
                    <div key={i} className="flex gap-2">
                      <span className="text-gray-400 w-16 flex-shrink-0">{it.category}</span>
                      <span className="text-gray-700">{it.description}</span>
                    </div>
                  ))}
                </div>
              )}
              {(co.sources?.length ?? 0) > 0 && (
                <div className="space-y-1 pt-1 border-t border-gray-100">
                  <p className="text-[10px] tracking-widest text-gray-400 uppercase">参考画像の反映</p>
                  {co.sources.map((s, i) => (
                    <p key={i} className="text-xs text-gray-500">{s.caption}：{s.mapping}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      {children}
    </div>
  );
}

function CopyChip({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // クリップボード不可環境は無視（チップ表示は維持）
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="px-2.5 py-1 bg-white border border-gray-200 text-gray-700 rounded-full text-xs hover:border-gray-400 transition-colors"
      title="タップでコピー"
    >
      {copied ? "コピーしました ✓" : text}
    </button>
  );
}
