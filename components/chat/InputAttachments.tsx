"use client";

// A-5 P1-D: 入力欄近接 4 ボタン(写真 / 商品 URL / クローゼット / MB)
//
// 設計: docs/STYLE-SELF_D1_A-5_P1-D_設計調査.md(c126f76)§3.3
//
// 振る舞い(方針 A 推奨案):
//   ・📎 写真:        file dialog → notice「Sprint E で実装予定」(送信動作なし)
//   ・🔗 商品 URL:    URL 入力モーダル → notice「Sprint C で実装予定」(送信動作なし)
//   ・👕 クローゼット: ClosetPickerModal 開く(★ 完全実装・親側で制御)
//   ・🎨 MB:          ★ Sprint C-2 段階3-E で本実装(MoodboardPickerModal 親側制御)
//                       onMbOpen 未指定なら notice fallback(backward compatible)
//
// notice はインラインメッセージ(自動消去 3 秒)で表示する。

import { useRef, useState } from "react";
import { ENABLE_CLOSET, PRODUCTS_ENABLED } from "@/lib/flags";

interface InputAttachmentsProps {
  onClosetOpen:    () => void;
  onMbOpen?:       () => void;             // ★ Sprint C-2 段階3-E: MB 本実装(MoodboardPickerModal 親側制御)
  onUrlSubmit?:    (url: string) => void;  // 将来用・現状は notice のみ
  onPhotoSelect?:  (file: File) => void;   // 将来用・現状は notice のみ
  onPhotosStructure?: (files: File[]) => void;  // ★ 複数写真→構造+共通点（指定時のみ📷ボタン表示・既存📎とは別）
  onStyleMatch?: (files: File[]) => void;  // ★ Style Match Result（指定時のみ「理想写真を分析する」ボタン表示・既存📎/📷とは別・additive）
}

type Notice = { id: number; text: string };

export default function InputAttachments({
  onClosetOpen,
  onMbOpen,
  onPhotoSelect,
  onPhotosStructure,
  onStyleMatch,
  // onUrlSubmit は今回未使用(将来 Sprint C で実装)
}: InputAttachmentsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photosInputRef = useRef<HTMLInputElement>(null);
  const styleMatchInputRef = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [isUrlOpen, setIsUrlOpen] = useState(false);
  const [urlText, setUrlText] = useState("");

  function showNotice(text: string): void {
    const id = Date.now();
    setNotice({ id, text });
    setTimeout(() => {
      setNotice((cur) => (cur && cur.id === id ? null : cur));
    }, 3000);
  }

  function handlePhotoClick(): void {
    fileInputRef.current?.click();
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0];
    if (!file) return;
    // 憧れ写真分析モード(親が onPhotoSelect を渡す)なら実送信。未配線なら従来どおり notice のみ。
    if (onPhotoSelect) {
      onPhotoSelect(file);
    } else {
      showNotice(`✅ 画像「${file.name}」を選択しました(Sprint E リアル試着で本実装予定)`);
    }
    // input をリセット(同じファイルを再選択できるように)
    e.target.value = "";
  }

  function handlePhotosStructureClick(): void {
    photosInputRef.current?.click();
  }

  function handlePhotosStructureChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const list = e.target.files;
    if (list && list.length > 0 && onPhotosStructure) {
      onPhotosStructure(Array.from(list));
    }
    e.target.value = "";  // 同じ写真を再選択できるように
  }

  function handleStyleMatchClick(): void {
    styleMatchInputRef.current?.click();
  }

  function handleStyleMatchChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const list = e.target.files;
    if (list && list.length > 0 && onStyleMatch) {
      onStyleMatch(Array.from(list));
    }
    e.target.value = "";  // 同じ写真を再選択できるように
  }

  function handleUrlClick(): void {
    setIsUrlOpen(true);
  }

  function handleUrlConfirm(): void {
    const url = urlText.trim();
    if (!url) {
      setIsUrlOpen(false);
      return;
    }
    // ★ 骨格のみ: URL 文字列は notice 表示後に破棄(Sprint C で本実装)
    showNotice(`✅ URL を受け付けました(Sprint C ムードボード + 商品連鎖で本実装予定)`);
    setUrlText("");
    setIsUrlOpen(false);
  }

  function handleMbClick(): void {
    // ★ Sprint C-2 段階3-E: 親側で MoodboardPickerModal を制御していれば onMbOpen 呼出
    //   onMbOpen 未指定なら notice fallback(backward compatible)
    if (onMbOpen) {
      onMbOpen();
      return;
    }
    showNotice("📌 ムードボードは Sprint C で実装予定です(現在テーブル未作成)");
  }

  return (
    <div className="space-y-2">
      {/* ★ Style Match Result の主役CTA（onStyleMatch 指定時=フラグON時のみ・既存ボタンとは別の新体験） */}
      {onStyleMatch && (
        <button
          type="button"
          onClick={handleStyleMatchClick}
          className="w-full flex items-center justify-center gap-1.5 px-4 py-2 bg-gray-800 text-white text-sm rounded-xl hover:bg-gray-700 transition-colors"
        >
          ✨ 理想写真を分析する
        </button>
      )}
      <div className="flex gap-1.5 items-center">
        {/* 📎写真(aspiration)は onPhotoSelect 指定時のみ表示（Style Match 一本化で page 側が undefined を渡し非表示にできる） */}
        {onPhotoSelect && <AttachButton icon="📎" label="写真"     onClick={handlePhotoClick} />}
        {/* ★ 複数写真→構造+共通点（onPhotosStructure 指定時のみ・既存📎とは別の📷） */}
        {onPhotosStructure && <AttachButton icon="📷" label="構造"    onClick={handlePhotosStructureClick} />}
        {/* 🔗URL(商品URL)は PRODUCTS_ENABLED、👕服(クローゼット)は ENABLE_CLOSET で制御。
            SIMPLE_MODE では写真と MB の2つだけ表示。 */}
        {PRODUCTS_ENABLED && <AttachButton icon="🔗" label="URL"      onClick={handleUrlClick} />}
        {ENABLE_CLOSET    && <AttachButton icon="👕" label="服"       onClick={onClosetOpen}    />}
        <AttachButton icon="🎨" label="MB"       onClick={handleMbClick} />
        {notice && (
          <span className="text-[11px] text-gray-500 ml-2 truncate">{notice.text}</span>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={handlePhotoChange}
      />

      {/* ★ 複数写真→構造+共通点 用（複数選択可） */}
      <input
        ref={photosInputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={handlePhotosStructureChange}
      />

      {/* ★ Style Match Result 用（複数選択可） */}
      <input
        ref={styleMatchInputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={handleStyleMatchChange}
      />

      {/* URL 入力簡易モーダル */}
      {isUrlOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40"
            onClick={() => { setIsUrlOpen(false); setUrlText(""); }}
            aria-hidden="true"
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 space-y-3 pointer-events-auto">
              <p className="text-xs tracking-widest text-gray-400 uppercase">URL</p>
              <input
                type="url"
                autoFocus
                value={urlText}
                onChange={(e) => setUrlText(e.target.value)}
                placeholder="https://item.rakuten.co.jp/..."
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:border-gray-400"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setIsUrlOpen(false); setUrlText(""); }}
                  className="text-xs px-3 py-1.5 text-gray-500 hover:text-gray-800"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={handleUrlConfirm}
                  className="text-xs px-3 py-1.5 bg-gray-800 text-white rounded-xl hover:bg-gray-700 transition-colors"
                >
                  確認 →
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function AttachButton({
  icon,
  label,
  onClick,
}: {
  icon:    string;
  label:   string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1 text-[11px] text-gray-600 px-2 py-1 rounded-md border border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 transition-colors"
    >
      <span className="text-sm leading-none">{icon}</span>
      <span>{label}</span>
    </button>
  );
}
