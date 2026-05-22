"use client";

// P1-C-3: 右上メニュー [≡] Drawer(案 A タブなし完全チャット型 補助機能集約点)
//
// 設計: docs/STYLE-SELF_D1_実装設計.md(ac834bb) 4.3 §「右上メニュー [≡] 設計」
//       + docs/STYLE-SELF_D1_P1-C-3_設計調査.md(b0c01f1) スコープ C
//
// 振る舞い:
//   ・isOpen=true で右からスライド展開 / 背景半透明オーバーレイ
//   ・背景クリック / ESC キー / × ボタン で閉じる
//   ・open 中は body スクロールロック
//   ・navigate 7 件: navigate-map 経由で各画面へ + drawer close
//   ・新しいチャット: 親側 onNewChat ハンドラに委譲(setMessages([]) +
//     localStorage.removeItem を親側で実行・race fix v2 案 C 整合)
//   ・避けたい / 設定: placeholder「準備中」(クリックで閉じるのみ)
//   ・ログアウト: 本スコープ C 対象外(次セッションで投入予定)

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { resolveNavigateTarget } from "@/lib/overlay/navigate-map";

interface MenuDrawerProps {
  isOpen:    boolean;
  onClose:   () => void;
  onNewChat: () => void;
}

type MenuItem =
  | { kind: "navigate";    intent: string; label: string }
  | { kind: "action";      id: "new-chat"; label: string }
  | { kind: "placeholder"; id: string;     label: string };

// 10 項目: navigate 7 件 + 新しいチャット 1 件 + placeholder 2 件
const MENU_ITEMS: MenuItem[] = [
  { kind: "navigate",    intent: "worldview-profile", label: "あなたの世界観" },
  { kind: "navigate",    intent: "closet",            label: "クローゼット" },
  { kind: "navigate",    intent: "saved",             label: "保存" },
  { kind: "navigate",    intent: "history",           label: "履歴" },
  { kind: "navigate",    intent: "body-edit",         label: "身体" },
  { kind: "navigate",    intent: "preference-edit",   label: "好み" },
  { kind: "placeholder", id: "avoid",                  label: "避けたい" },
  { kind: "navigate",    intent: "my-posts",          label: "投稿" },
  { kind: "action",      id: "new-chat",              label: "新しいチャット" },
  { kind: "placeholder", id: "settings",              label: "設定" },
];

export default function MenuDrawer({ isOpen, onClose, onNewChat }: MenuDrawerProps) {
  const router = useRouter();

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

  function handleClick(item: MenuItem): void {
    if (item.kind === "navigate") {
      const target = resolveNavigateTarget(item.intent);
      if (target) router.push(target.url);
      onClose();
      return;
    }
    if (item.kind === "action" && item.id === "new-chat") {
      // 親側で confirm() + setMessages([]) + localStorage.removeItem を実行
      onClose();
      onNewChat();
      return;
    }
    // placeholder: 何もしない(閉じるだけ)
    onClose();
  }

  return (
    <>
      {/* 背景オーバーレイ */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* 右スライド drawer */}
      <aside
        className={`fixed top-0 right-0 z-50 h-full w-72 max-w-[85%] bg-white shadow-xl flex flex-col transition-transform duration-200 ease-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
        aria-hidden={!isOpen}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <p className="text-xs tracking-widest text-gray-400 uppercase">MENU</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="メニューを閉じる"
            className="text-gray-400 hover:text-gray-700 text-xl leading-none px-1"
          >
            ×
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto py-2">
          {MENU_ITEMS.map((item, i) => {
            const isPlaceholder = item.kind === "placeholder";
            return (
              <button
                key={i}
                type="button"
                onClick={() => handleClick(item)}
                className={`w-full flex items-center justify-between gap-3 px-5 py-3 text-sm text-left transition-colors ${
                  isPlaceholder ? "text-gray-300 cursor-default" : "text-gray-800 hover:bg-gray-50"
                }`}
              >
                <span className="flex-1">{item.label}</span>
                {isPlaceholder && <span className="text-[10px] text-gray-300">準備中</span>}
              </button>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
