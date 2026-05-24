"use client";

// D1 Phase 2 ムードボード: chat 入力欄から MB を選択するピッカー
//
// Sprint C-2 段階3-D 実装(設計案 60b8d87 §6.4)
//
// 振る舞い:
//   ・open 時に GET /api/moodboards で自分の MB 一覧取得(概要)
//   ・2 列グリッドで MB カード表示(cover_image_url + name + 公開バッジ)
//   ・1 MB 選択 → ★ GET /api/moodboards/[id] で詳細(items 含む)取得 → onPick(mb) 呼出
//   ・Empty state: 「ムードボードがありません」+ CTA → /moodboard
//   ・背景クリック / ESC / × ボタンで閉じる
//
// 既存パターン踏襲: components/chat/ClosetPickerModal.tsx(c126f76)同型作法
//
// ★ Sprint C-3(7e9921d): onPick シグネチャ強化(text → MoodboardWithItems)
//   親側で buildMoodboardPrompt(mb) を呼び出して prompt 構築する。
//   詳細取得失敗時は items=[] で onPick(必須要素 0 件で prompt 生成・コンセプト中心)

import { useEffect, useState } from "react";
import Link from "next/link";
import { Image as ImageIcon, Globe, Lock } from "lucide-react";
import type { MoodboardRow, MoodboardWithItems } from "@/types/moodboard";

interface MoodboardPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPick: (mb: MoodboardWithItems) => void;
}

type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; moodboards: MoodboardRow[] }
  | { kind: "error"; message: string };

export default function MoodboardPickerModal({ isOpen, onClose, onPick }: MoodboardPickerModalProps) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  // ESC キーで閉じる(ClosetPickerModal と同型)
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

  // open 時にフェッチ
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setState({ kind: "loading" });
    (async () => {
      try {
        const res = await fetch("/api/moodboards", { method: "GET" });
        if (!res.ok) {
          if (!cancelled) setState({ kind: "error", message: `HTTP ${res.status}` });
          return;
        }
        const data = (await res.json()) as { moodboards: MoodboardRow[] };
        if (!cancelled) setState({ kind: "ready", moodboards: data.moodboards ?? [] });
      } catch (err) {
        if (!cancelled) {
          setState({ kind: "error", message: err instanceof Error ? err.message : "取得失敗" });
        }
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen]);

  async function handlePick(mb: MoodboardRow): Promise<void> {
    // ★ Sprint C-3: 選択時に詳細取得 → onPick(MoodboardWithItems)
    //   詳細取得失敗時は items=[] で onPick(必須要素 0 件で prompt 生成)
    try {
      const res = await fetch(`/api/moodboards/${mb.id}`);
      if (!res.ok) {
        onPick({ ...mb, items: [] });
        onClose();
        return;
      }
      const data = (await res.json()) as { moodboard: MoodboardWithItems };
      onPick(data.moodboard);
      onClose();
    } catch {
      // fallback: items=[] で onPick(コンセプトのみで prompt 構築)
      onPick({ ...mb, items: [] });
      onClose();
    }
  }

  if (!isOpen) return null;

  return (
    <>
      {/* 背景オーバーレイ */}
      <div
        className="fixed inset-0 z-40 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* モーダル本体(中央寄せ・max-w-2xl・ClosetPickerModal 同型) */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col pointer-events-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
            <p className="text-xs tracking-widest text-gray-400 uppercase">MOODBOARD</p>
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

            {state.kind === "ready" && state.moodboards.length === 0 && (
              <div className="py-12 text-center space-y-3">
                <p className="text-sm text-gray-700">ムードボードがありません</p>
                <p className="text-xs text-gray-400">先にムードボードを作成してください</p>
                <Link
                  href="/moodboard"
                  onClick={onClose}
                  className="inline-block px-4 py-2 bg-gray-800 text-white rounded-xl text-sm hover:bg-gray-700 transition-colors"
                >
                  ムードボードを開く →
                </Link>
              </div>
            )}

            {state.kind === "ready" && state.moodboards.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                {state.moodboards.map((mb) => (
                  <button
                    key={mb.id}
                    type="button"
                    onClick={() => void handlePick(mb)}
                    className="text-left rounded-2xl border border-gray-100 hover:border-gray-300 hover:bg-gray-50 transition-colors overflow-hidden"
                  >
                    <div className="relative aspect-square bg-gray-50">
                      {mb.cover_image_url !== null && mb.cover_image_url !== "" ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={mb.cover_image_url}
                          alt={mb.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                          <ImageIcon size={28} strokeWidth={1.4} />
                        </div>
                      )}
                      {/* 公開バッジ(右上) */}
                      <span
                        className={`absolute top-2 right-2 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full ${
                          mb.is_public
                            ? "bg-white/90 text-gray-700"
                            : "bg-gray-900/70 text-white"
                        }`}
                      >
                        {mb.is_public ? (
                          <>
                            <Globe size={10} strokeWidth={2} />
                            公開
                          </>
                        ) : (
                          <>
                            <Lock size={10} strokeWidth={2} />
                            非公開
                          </>
                        )}
                      </span>
                    </div>
                    <div className="px-2.5 py-1.5 space-y-0.5">
                      <p className="text-sm text-gray-800 truncate">{mb.name}</p>
                      {mb.description !== "" && (
                        <p className="text-[11px] text-gray-400 line-clamp-1">{mb.description}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
