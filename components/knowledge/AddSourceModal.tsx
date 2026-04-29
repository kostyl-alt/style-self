"use client";

import { useState, useRef } from "react";
import { uploadKnowledgeImage } from "@/lib/storage";
import type { KnowledgeSource, KnowledgeSourceType, CreateKnowledgeSourceRequest } from "@/types/index";

type FormType = Extract<KnowledgeSourceType, "memo" | "url" | "image" | "book">;

const TYPE_TABS: { value: FormType; label: string; icon: string }[] = [
  { value: "memo",  label: "メモ", icon: "📝" },
  { value: "url",   label: "URL",  icon: "🔗" },
  { value: "image", label: "画像", icon: "🖼️" },
  { value: "book",  label: "書籍", icon: "📕" },
];

interface Props {
  userId:  string;
  onClose: () => void;
  onAdded: (source: KnowledgeSource) => void;
}

export default function AddSourceModal({ userId, onClose, onAdded }: Props) {
  const [type, setType]               = useState<FormType>("memo");
  const [title, setTitle]             = useState("");
  const [url, setUrl]                 = useState("");
  const [contentText, setContentText] = useState("");
  const [author, setAuthor]           = useState("");
  const [citationNote, setCitation]   = useState("");
  const [imageFile, setImageFile]     = useState<File | null>(null);
  const [imagePreview, setPreview]    = useState<string | null>(null);
  const [isSaving, setSaving]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setError(null);
    if (!file) {
      setImageFile(null);
      setPreview(null);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("画像サイズは5MB以下にしてください");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError("タイトルは必須です");
      return;
    }

    setSaving(true);
    try {
      let imageUrl: string | null = null;
      if ((type === "image" || type === "book") && imageFile) {
        imageUrl = await uploadKnowledgeImage(userId, imageFile);
      }

      const body: CreateKnowledgeSourceRequest = {
        title:        title.trim(),
        sourceType:   type,
        url:          type === "url" ? url.trim() : undefined,
        contentText:  contentText.trim() || undefined,
        imageUrl:     imageUrl ?? undefined,
        author:       author.trim() || undefined,
        citationNote: citationNote.trim() || undefined,
      };

      const res = await fetch("/api/knowledge/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json() as { source?: KnowledgeSource; error?: string };
      if (!res.ok || !data.source) {
        throw new Error(data.error ?? "登録に失敗しました");
      }
      onAdded(data.source);
    } catch (err) {
      setError(err instanceof Error ? err.message : "登録に失敗しました");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between">
          <h2 className="text-base font-medium text-gray-900">ナレッジを追加</h2>
          <button onClick={onClose} disabled={isSaving} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* タイプ選択 */}
          <div>
            <p className="text-xs text-gray-500 mb-2">情報源のタイプ</p>
            <div className="grid grid-cols-4 gap-2">
              {TYPE_TABS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(t.value)}
                  className={`flex flex-col items-center gap-1 py-3 rounded-xl text-xs transition-all ${
                    type === t.value
                      ? "bg-gray-800 text-white"
                      : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <span className="text-xl">{t.icon}</span>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* タイトル（共通） */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">タイトル <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                type === "memo"  ? "例：ストア派の禁欲哲学について" :
                type === "url"   ? "例：マルジェラ最新コレクション解説" :
                type === "image" ? "例：Pinterestで保存したコーデ" :
                                   "例：『自省録』マルクス・アウレリウス"
              }
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
            />
          </div>

          {/* タイプ別フィールド */}
          {type === "memo" && (
            <div>
              <label className="text-xs text-gray-500 mb-1 block">本文 <span className="text-red-500">*</span></label>
              <textarea
                value={contentText}
                onChange={(e) => setContentText(e.target.value)}
                rows={8}
                placeholder="情報源の内容を貼り付けてください…"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200 resize-none"
              />
            </div>
          )}

          {type === "url" && (
            <div>
              <label className="text-xs text-gray-500 mb-1 block">URL <span className="text-red-500">*</span></label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
              />
              <p className="text-xs text-gray-400 mt-1">
                AI分析時にサーバーが本文を取得します。失敗するサイト（Cloudflare保護・JSレンダリング）はメモタイプで本文をコピペしてください。
              </p>
            </div>
          )}

          {(type === "image" || type === "book") && (
            <div>
              <label className="text-xs text-gray-500 mb-1 block">
                画像 {type === "image" && <span className="text-red-500">*</span>}
              </label>
              {!imagePreview ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-6 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-500 hover:border-gray-400"
                >
                  📷 画像を選ぶ（5MBまで）
                </button>
              ) : (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imagePreview} alt="プレビュー" className="w-full max-h-60 object-contain rounded-xl bg-gray-50" />
                  <button
                    type="button"
                    onClick={() => {
                      setImageFile(null);
                      setPreview(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="absolute top-2 right-2 w-7 h-7 bg-white/90 border border-gray-200 rounded-full text-gray-500 hover:text-gray-800 text-sm"
                  >×</button>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />
              {type === "book" && (
                <div className="mt-3">
                  <label className="text-xs text-gray-500 mb-1 block">章節・本文（任意・どちらか必須）</label>
                  <textarea
                    value={contentText}
                    onChange={(e) => setContentText(e.target.value)}
                    rows={5}
                    placeholder="関連する章の引用などを記入"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200 resize-none"
                  />
                </div>
              )}
            </div>
          )}

          {/* 著者・出典（共通・任意） */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">著者（任意）</label>
              <input
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="例：山本耀司"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">出典メモ（任意）</label>
              <input
                type="text"
                value={citationNote}
                onChange={(e) => setCitation(e.target.value)}
                placeholder="例：第4章 / 35:20"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-2">
              <p className="text-xs text-red-600">{error}</p>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50 disabled:opacity-40"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-2.5 bg-gray-800 text-white rounded-xl text-sm hover:bg-gray-700 disabled:opacity-40"
            >
              {isSaving ? "登録中..." : "登録"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
