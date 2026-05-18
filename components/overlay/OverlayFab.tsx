"use client";

// D1-1: 自然言語オーバーレイ FAB(右下浮動ボタン)
//
// 設計: docs/STYLE-SELF_D1_実装設計.md セクション 4.3
// 方針: BottomNav と共存(設計書地雷5)・既存 18 機能を一切変更しない
// 配置: app/(app)/layout.tsx に 1 行追加(M4-4 DevAuthBadge と同型)

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import OverlayModal from "./OverlayModal";

export default function OverlayFab() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        // bottom-24 = BottomNav の上に重ねず浮かせる位置(BottomNav 高さ +余白)
        className="fixed bottom-24 right-4 z-40 w-14 h-14 bg-gray-900 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-700 transition-colors"
        aria-label="自然言語で操作"
      >
        <MessageCircle size={22} strokeWidth={1.6} />
      </button>
      {open && <OverlayModal onClose={() => setOpen(false)} />}
    </>
  );
}
