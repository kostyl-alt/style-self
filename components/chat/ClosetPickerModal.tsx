"use client";

// A-5 P1-D: 入力欄近接 4 ボタンの「クローゼット」モーダル(★ 完全実装)
//
// 設計: docs/STYLE-SELF_D1_A-5_P1-D_設計調査.md(c126f76)§3.3 / §3.4
//
// 振る舞い:
//   ・open 時に GET /api/wardrobe(既存・認証必須・本人 RLS)で アイテム一覧取得
//   ・カテゴリ別グリッド表示(画像 + 名前 + 色 / 素材)
//   ・1 アイテム選択 → 親側 onPick(text) 経由で textarea に
//     「『○○』(色 素材)に合うコーデを考えて」型挿入
//   ・Empty state: 「クローゼットにアイテムがありません」+ CTA → /outfit?tab=closet
//   ・背景クリック / ESC / × ボタンで閉じる(MenuDrawer と同パターン)
//
// 【三重防御 (2) UI 表示テンプレ】
//   ・worldview_tags / worldviewScore は表示しない(name / color / material / brand のみ)
//   ・既存 GET /api/wardrobe は本人 RLS で他人データは出ない

import { useEffect, useState } from "react";
import Link from "next/link";
import type { WardrobeItem, WardrobeCategory } from "@/types/index";

interface ClosetPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPick: (insertText: string) => void;
}

const CATEGORY_LABELS: Record<WardrobeCategory, string> = {
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

const CATEGORY_ORDER: WardrobeCategory[] = [
  "tops", "outerwear", "jacket", "vest", "inner", "dress", "setup",
  "bottoms", "shoes", "bags", "accessories", "hat", "jewelry", "roomwear", "other",
];

type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; items: WardrobeItem[] }
  | { kind: "error"; message: string };

export default function ClosetPickerModal({ isOpen, onClose, onPick }: ClosetPickerModalProps) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  // ESC キーで閉じる
  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  // body スクロールロック(open 中のみ)
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  // open 時にフェッチ(close のたびに再フェッチしないよう state は維持)
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setState({ kind: "loading" });
    (async () => {
      try {
        const res = await fetch("/api/wardrobe", { method: "GET" });
        if (!res.ok) {
          if (!cancelled) setState({ kind: "error", message: `HTTP ${res.status}` });
          return;
        }
        const items = await res.json() as WardrobeItem[];
        if (!cancelled) setState({ kind: "ready", items });
      } catch (err) {
        if (!cancelled) {
          setState({ kind: "error", message: err instanceof Error ? err.message : "取得失敗" });
        }
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen]);

  function handlePick(item: WardrobeItem): void {
    // ★ 表示テンプレ: name + color + material のみ(worldview_tags / worldviewScore は使わない)
    const material = item.material ? ` ${item.material}` : "";
    const text = `「${item.name}」(${item.color}${material})に合うコーデを考えて`;
    onPick(text);
    onClose();
  }

  if (!isOpen) return null;

  // カテゴリ別 grouping(ready 時のみ)
  const grouped = state.kind === "ready"
    ? groupByCategory(state.items)
    : new Map<WardrobeCategory, WardrobeItem[]>();

  return (
    <>
      {/* 背景オーバーレイ */}
      <div
        className="fixed inset-0 z-40 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* モーダル本体(中央寄せ・max-w-2xl) */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col pointer-events-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
            <p className="text-xs tracking-widest text-gray-400 uppercase">CLOSET</p>
            <button
              type="button"
              onClick={onClose}
              aria-label="閉じる"
              className="text-gray-400 hover:text-gray-700 text-xl leading-none px-1"
            >
              ×
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            {state.kind === "loading" && (
              <div className="py-12 text-center text-sm text-gray-400">読み込んでいます…</div>
            )}

            {state.kind === "error" && (
              <div className="py-8 text-center space-y-2">
                <p className="text-sm text-rose-600">取得に失敗しました</p>
                <p className="text-xs text-gray-400">{state.message}</p>
              </div>
            )}

            {state.kind === "ready" && state.items.length === 0 && (
              <div className="py-12 text-center space-y-3">
                <p className="text-sm text-gray-700">クローゼットにアイテムがありません</p>
                <p className="text-xs text-gray-400">先にアイテムを登録してください</p>
                <Link
                  href="/outfit?tab=closet"
                  onClick={onClose}
                  className="inline-block px-4 py-2 bg-gray-800 text-white rounded-xl text-sm hover:bg-gray-700 transition-colors"
                >
                  クローゼットを開く →
                </Link>
              </div>
            )}

            {state.kind === "ready" && state.items.length > 0 && (
              <div className="space-y-5">
                {CATEGORY_ORDER.filter((c) => grouped.has(c)).map((c) => {
                  const items = grouped.get(c) ?? [];
                  return (
                    <section key={c}>
                      <h3 className="text-xs tracking-wider text-gray-500 mb-2">
                        {CATEGORY_LABELS[c]}({items.length})
                      </h3>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {items.map((it) => (
                          <button
                            key={it.id}
                            type="button"
                            onClick={() => handlePick(it)}
                            className="text-left rounded-lg border border-gray-100 hover:border-gray-300 hover:bg-gray-50 transition-colors overflow-hidden"
                          >
                            <div className="aspect-square bg-gray-50">
                              {it.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={it.imageUrl}
                                  alt={it.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-300 text-2xl">
                                  ?
                                </div>
                              )}
                            </div>
                            <div className="px-2 py-1.5">
                              <p className="text-[11px] text-gray-800 leading-tight line-clamp-1">{it.name}</p>
                              <p className="text-[10px] text-gray-400 leading-tight mt-0.5">
                                {it.color}{it.material ? ` / ${it.material}` : ""}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function groupByCategory(items: WardrobeItem[]): Map<WardrobeCategory, WardrobeItem[]> {
  const out = new Map<WardrobeCategory, WardrobeItem[]>();
  for (const it of items) {
    const list = out.get(it.category) ?? [];
    list.push(it);
    out.set(it.category, list);
  }
  return out;
}
