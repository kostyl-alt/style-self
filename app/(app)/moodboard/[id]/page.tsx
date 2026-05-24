"use client";

// D1 Phase 2 ムードボード: 詳細画面(/moodboard/[id])
//
// Sprint C-2 段階3-B 実装(設計案 476db41 §6 完全投入)
//
// 機能:
//   1. データ取得(GET /api/moodboards/[id])
//   2. メインビジュアル(cover_image_url)
//   3. コンセプト(description)表示 + 編集モーダル(★ プロセス誘導 placeholder + 例文)
//   4. items グリッド + Card
//   5. 画像追加(file → uploadMoodboardImage → POST items)
//   6. caption 編集モーダル(★ プロセス誘導 placeholder)
//   7. MB メタ編集モーダル(name/description/is_public/cover_image_url)
//   8. MB 削除 confirm
//   9. プロセス誘導 UI(空 MB CTA + items 1-2 件時ガイド + 編集モーダル例文)
//  10. アクション(チャットに渡す placeholder + 公開設定切替)
//
// ★ ビジョン拡張 案 A 採用(設計案 476db41 §5・スキーマ変更なし・既存実装無傷)
// ★ プロのファッション制作プロセス対応:コンセプト → MB → 撮影

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Edit3, Trash2, Plus, X, Image as ImageIcon,
  Lock, Globe, MessageCircle,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { uploadMoodboardImage } from "@/lib/storage";
import type { MoodboardWithItems, MoodboardItemRow } from "@/types/moodboard";

const NAME_MAX = 200;
const DESCRIPTION_MAX = 2000;
const CAPTION_MAX = 500;

// ★ プロセス誘導 例文(設計案 476db41 §6.2)
const CONCEPT_EXAMPLES = [
  "孤独な富裕層 / 都会の夜 / ミニマル",
  "冷たいアンドロジナス / 廃墟 / モノクロ",
  "90 年代グランジ / 雨 / グレー",
  "海岸の朝 / リネン / 砂色と白",
];

export default function MoodboardDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const mbId = params.id;

  const [mb, setMb] = useState<MoodboardWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // モーダル状態
  const [editingConcept, setEditingConcept] = useState(false);
  const [editingMeta, setEditingMeta] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [editingItem, setEditingItem] = useState<MoodboardItemRow | null>(null);
  const [uploading, setUploading] = useState(false);

  // ---- データ取得 ----
  async function fetchMoodboard(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/moodboards/${mbId}`);
      if (!res.ok) {
        if (res.status === 404) setError("ムードボードが見つかりません");
        else if (res.status === 401) setError("ログインが必要です");
        else setError("読み込みに失敗しました");
        setMb(null);
        return;
      }
      const data = (await res.json()) as { moodboard: MoodboardWithItems };
      setMb(data.moodboard);
    } catch {
      setError("読み込みに失敗しました");
      setMb(null);
    } finally {
      setLoading(false);
    }
  }

  // ---- userId 取得(uploadMoodboardImage で必要) ----
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    void supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    if (mbId) void fetchMoodboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mbId]);

  // ---- 画像追加 ----
  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !mb || !userId || uploading) return;
    setUploading(true);
    try {
      // 1) クライアント側 EXIF 除去 + Storage upload(M3 同型・lib/storage.ts ec12f7b)
      const imageUrl = await uploadMoodboardImage(userId, mb.id, file);
      // 2) DB に items row 追加
      const res = await fetch(`/api/moodboards/${mb.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_url: imageUrl, order_index: mb.items.length }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        alert(err.error ?? "画像追加に失敗しました");
        return;
      }
      await fetchMoodboard();
    } catch (err) {
      alert(err instanceof Error ? err.message : "画像追加に失敗しました");
    } finally {
      setUploading(false);
    }
  }

  // ---- 削除 ----
  async function handleDeleteMoodboard(): Promise<void> {
    if (!mb) return;
    try {
      const res = await fetch(`/api/moodboards/${mb.id}`, { method: "DELETE" });
      if (!res.ok) {
        alert("削除に失敗しました");
        return;
      }
      router.push("/moodboard");
    } catch {
      alert("削除に失敗しました");
    }
  }

  async function handleDeleteItem(itemId: string): Promise<void> {
    if (!mb) return;
    if (!window.confirm("この画像を削除しますか?")) return;
    try {
      const res = await fetch(`/api/moodboards/${mb.id}/items/${itemId}`, { method: "DELETE" });
      if (!res.ok) {
        alert("削除に失敗しました");
        return;
      }
      await fetchMoodboard();
    } catch {
      alert("削除に失敗しました");
    }
  }

  // ---- レンダリング ----
  if (loading) {
    return <div className="min-h-screen bg-white flex items-center justify-center text-sm text-gray-300">読み込み中...</div>;
  }
  if (error !== null || mb === null) {
    return (
      <div className="min-h-screen bg-white pb-24">
        <div className="max-w-lg mx-auto px-4 py-12 space-y-4">
          <Link href="/moodboard" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800">
            <ArrowLeft size={12} /> 一覧へ戻る
          </Link>
          <p className="text-sm text-gray-500">{error ?? "見つかりません"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-24">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
        {/* ヘッダ */}
        <div className="flex items-center justify-between gap-3">
          <Link href="/moodboard" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800">
            <ArrowLeft size={14} /> 一覧
          </Link>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setEditingMeta(true)}
              className="text-xs px-2.5 py-1.5 text-gray-600 hover:text-gray-900 inline-flex items-center gap-1"
            >
              <Edit3 size={12} /> 編集
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="text-xs px-2.5 py-1.5 text-gray-500 hover:text-red-600 inline-flex items-center gap-1"
            >
              <Trash2 size={12} /> 削除
            </button>
          </div>
        </div>

        {/* MB 名 */}
        <div>
          <p className="text-xs tracking-widest text-gray-400 uppercase mb-1">Moodboard</p>
          <h1 className="text-2xl font-light text-gray-900">{mb.name}</h1>
        </div>

        {/* メインビジュアル */}
        <div className="relative aspect-video bg-gray-50 rounded-2xl overflow-hidden">
          {mb.cover_image_url !== null && mb.cover_image_url !== "" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mb.cover_image_url} alt={mb.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300">
              <ImageIcon size={40} strokeWidth={1.4} />
            </div>
          )}
          <span
            className={`absolute top-3 right-3 inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full ${
              mb.is_public ? "bg-white/90 text-gray-700" : "bg-gray-900/70 text-white"
            }`}
          >
            {mb.is_public ? <><Globe size={11} /> 公開</> : <><Lock size={11} /> 非公開</>}
          </span>
        </div>

        {/* コンセプト */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs tracking-widest text-gray-400 uppercase">Concept</p>
            <button
              type="button"
              onClick={() => setEditingConcept(true)}
              className="text-[11px] text-gray-500 hover:text-gray-800 inline-flex items-center gap-1"
            >
              <Edit3 size={11} /> 編集
            </button>
          </div>
          {mb.description !== "" ? (
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{mb.description}</p>
          ) : (
            <div className="border border-dashed border-gray-200 rounded-2xl p-4">
              <p className="text-xs text-gray-500 leading-relaxed">
                ヒント: モデル・場所・光・色を 1 つの記述で書いてみよう
              </p>
              <p className="text-[11px] text-gray-400 mt-2">
                例:「孤独な富裕層 / 海岸 / 夕方 / 濃紺・白」
              </p>
              <button
                type="button"
                onClick={() => setEditingConcept(true)}
                className="mt-3 text-xs text-gray-700 underline underline-offset-2 hover:text-gray-900"
              >
                コンセプトを書く →
              </button>
            </div>
          )}
        </section>

        {/* ムードボード要素(items) */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs tracking-widest text-gray-400 uppercase">Moodboard</p>
            <label className={`inline-flex items-center gap-1 text-xs px-3 py-1.5 bg-gray-800 text-white rounded-xl hover:bg-gray-700 cursor-pointer transition-colors ${uploading ? "opacity-50 cursor-wait" : ""}`}>
              <Plus size={12} />
              {uploading ? "アップロード中..." : "画像追加"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                disabled={uploading}
                onChange={handleFileSelect}
              />
            </label>
          </div>

          {/* 空 MB CTA */}
          {mb.items.length === 0 && (
            <div className="border border-dashed border-gray-200 rounded-2xl p-6 text-center space-y-2">
              <p className="text-sm text-gray-500">参考画像はまだありません</p>
              <p className="text-[11px] text-gray-400 leading-relaxed">
                Vogue / Pinterest から最初の参考画像を保存しよう
              </p>
            </div>
          )}

          {/* items 1-2 件時ガイド */}
          {mb.items.length > 0 && mb.items.length < 3 && (
            <p className="text-[11px] text-gray-400 leading-relaxed px-1">
              ヒント: ヘア・メイク・服・光・ロケーション・色 を集めよう
            </p>
          )}

          {/* グリッド */}
          {mb.items.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {mb.items.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  onClick={() => setEditingItem(item)}
                  onDelete={() => void handleDeleteItem(item.id)}
                />
              ))}
            </div>
          )}
        </section>

        {/* アクション */}
        <section className="pt-2 space-y-2">
          <button
            type="button"
            onClick={() => alert("チャットに渡す機能は Sprint C-3 で実装予定です")}
            className="w-full inline-flex items-center justify-center gap-2 text-sm px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors"
          >
            <MessageCircle size={14} />
            チャットに渡す(Sprint C-3 で実装予定)
          </button>
        </section>
      </div>

      {/* ---- コンセプト編集モーダル ---- */}
      {editingConcept && (
        <ConceptEditModal
          mbId={mb.id}
          initial={mb.description}
          onClose={() => setEditingConcept(false)}
          onSaved={async () => {
            setEditingConcept(false);
            await fetchMoodboard();
          }}
        />
      )}

      {/* ---- caption 編集モーダル ---- */}
      {editingItem !== null && (
        <CaptionEditModal
          mbId={mb.id}
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSaved={async () => {
            setEditingItem(null);
            await fetchMoodboard();
          }}
        />
      )}

      {/* ---- MB メタ編集モーダル ---- */}
      {editingMeta && (
        <MetaEditModal
          mb={mb}
          onClose={() => setEditingMeta(false)}
          onSaved={async () => {
            setEditingMeta(false);
            await fetchMoodboard();
          }}
        />
      )}

      {/* ---- 削除 confirm モーダル ---- */}
      {confirmingDelete && (
        <ConfirmModal
          message={`「${mb.name}」を削除しますか?画像も含めて削除されます。`}
          confirmLabel="削除"
          danger
          onConfirm={async () => {
            setConfirmingDelete(false);
            await handleDeleteMoodboard();
          }}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </div>
  );
}

// ====================================================================
// ItemCard
// ====================================================================
function ItemCard({
  item, onClick, onDelete,
}: {
  item: MoodboardItemRow;
  onClick: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="relative group rounded-2xl overflow-hidden border border-gray-100">
      <button type="button" onClick={onClick} className="block w-full">
        <div className="aspect-square bg-gray-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.image_url} alt={item.caption || "moodboard item"} className="w-full h-full object-cover" />
        </div>
        {item.caption !== "" && (
          <p className="text-[11px] text-gray-600 truncate px-2 py-1.5 text-left">{item.caption}</p>
        )}
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label="画像を削除"
        className="absolute top-1.5 right-1.5 bg-white/90 text-gray-700 hover:text-red-600 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <X size={12} />
      </button>
    </div>
  );
}

// ====================================================================
// ConceptEditModal — description 編集(★ プロセス誘導 placeholder + 例文)
// ====================================================================
function ConceptEditModal({
  mbId, initial, onClose, onSaved,
}: {
  mbId: string;
  initial: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);

  async function handleSave(): Promise<void> {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/moodboards/${mbId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: value.slice(0, DESCRIPTION_MAX) }),
      });
      if (!res.ok) {
        alert("保存に失敗しました");
        return;
      }
      await onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell onClose={onClose} title="Concept">
      <textarea
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value.slice(0, DESCRIPTION_MAX))}
        placeholder="コンセプト: 例『孤独な富裕層 / 海岸 / 夕方 / 濃紺・白』"
        rows={4}
        disabled={saving}
        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:border-gray-400 resize-none"
      />
      <div className="space-y-1.5">
        <p className="text-[10px] tracking-widest text-gray-400 uppercase">例(タップで挿入)</p>
        <div className="flex flex-wrap gap-1.5">
          {CONCEPT_EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setValue(ex)}
              disabled={saving}
              className="text-[11px] text-gray-600 px-2 py-1 rounded-md border border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 transition-colors disabled:opacity-50"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>
      <ModalFooter
        onCancel={onClose}
        onConfirm={handleSave}
        confirmLabel={saving ? "保存中..." : "保存 →"}
        disabled={saving}
      />
    </ModalShell>
  );
}

// ====================================================================
// CaptionEditModal — item caption 編集(★ プロセス誘導 placeholder)
// ====================================================================
function CaptionEditModal({
  mbId, item, onClose, onSaved,
}: {
  mbId: string;
  item: MoodboardItemRow;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [value, setValue] = useState(item.caption);
  const [saving, setSaving] = useState(false);

  async function handleSave(): Promise<void> {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/moodboards/${mbId}/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caption: value.slice(0, CAPTION_MAX) }),
      });
      if (!res.ok) {
        alert("保存に失敗しました");
        return;
      }
      await onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell onClose={onClose} title="Caption">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={item.image_url} alt="" className="w-full max-h-40 object-cover rounded-xl" />
      <textarea
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value.slice(0, CAPTION_MAX))}
        placeholder="観察メモ: 例『濡れ髪』『夕方の逆光』『砂色のリネン』"
        rows={3}
        disabled={saving}
        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:border-gray-400 resize-none"
      />
      <ModalFooter
        onCancel={onClose}
        onConfirm={handleSave}
        confirmLabel={saving ? "保存中..." : "保存 →"}
        disabled={saving}
      />
    </ModalShell>
  );
}

// ====================================================================
// MetaEditModal — name/description/is_public/cover_image_url 編集
// ====================================================================
function MetaEditModal({
  mb, onClose, onSaved,
}: {
  mb: MoodboardWithItems;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState(mb.name);
  const [description, setDescription] = useState(mb.description);
  const [isPublic, setIsPublic] = useState(mb.is_public);
  const [coverUrl, setCoverUrl] = useState(mb.cover_image_url ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave(): Promise<void> {
    if (saving || name.trim() === "") return;
    setSaving(true);
    try {
      const res = await fetch(`/api/moodboards/${mb.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim().slice(0, NAME_MAX),
          description: description.slice(0, DESCRIPTION_MAX),
          is_public: isPublic,
          cover_image_url: coverUrl === "" ? null : coverUrl,
        }),
      });
      if (!res.ok) {
        alert("保存に失敗しました");
        return;
      }
      await onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell onClose={onClose} title="Edit Moodboard">
      <div className="space-y-2">
        <label className="text-[10px] tracking-widest text-gray-400 uppercase">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, NAME_MAX))}
          disabled={saving}
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-gray-400"
        />
      </div>
      <div className="space-y-2">
        <label className="text-[10px] tracking-widest text-gray-400 uppercase">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, DESCRIPTION_MAX))}
          placeholder="コンセプト: 例『孤独な富裕層 / 海岸 / 夕方 / 濃紺・白』"
          rows={3}
          disabled={saving}
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:border-gray-400 resize-none"
        />
      </div>
      {mb.items.length > 0 && (
        <div className="space-y-2">
          <label className="text-[10px] tracking-widest text-gray-400 uppercase">Cover Image</label>
          <div className="grid grid-cols-4 gap-1.5">
            <button
              type="button"
              onClick={() => setCoverUrl("")}
              disabled={saving}
              className={`aspect-square rounded-lg border-2 flex items-center justify-center text-gray-300 ${coverUrl === "" ? "border-gray-800" : "border-gray-200"}`}
            >
              <X size={14} />
            </button>
            {mb.items.map((it) => (
              <button
                key={it.id}
                type="button"
                onClick={() => setCoverUrl(it.image_url)}
                disabled={saving}
                className={`aspect-square rounded-lg overflow-hidden border-2 ${coverUrl === it.image_url ? "border-gray-800" : "border-gray-200"}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={it.image_url} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={isPublic}
          onChange={(e) => setIsPublic(e.target.checked)}
          disabled={saving}
        />
        公開する(URL 知る人なら誰でも閲覧可)
      </label>
      <ModalFooter
        onCancel={onClose}
        onConfirm={handleSave}
        confirmLabel={saving ? "保存中..." : "保存 →"}
        disabled={saving || name.trim() === ""}
      />
    </ModalShell>
  );
}

// ====================================================================
// ConfirmModal — 削除 confirm
// ====================================================================
function ConfirmModal({
  message, confirmLabel, danger, onConfirm, onCancel,
}: {
  message: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}) {
  return (
    <ModalShell onClose={onCancel} title="確認">
      <p className="text-sm text-gray-700 leading-relaxed">{message}</p>
      <ModalFooter
        onCancel={onCancel}
        onConfirm={onConfirm}
        confirmLabel={confirmLabel}
        danger={danger}
      />
    </ModalShell>
  );
}

// ====================================================================
// ModalShell — モーダル外枠(段階3-A + InputAttachments と同型作法)
// ====================================================================
function ModalShell({
  title, onClose, children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 space-y-3 pointer-events-auto max-h-[90vh] overflow-y-auto">
          <p className="text-xs tracking-widest text-gray-400 uppercase">{title}</p>
          {children}
        </div>
      </div>
    </>
  );
}

function ModalFooter({
  onCancel, onConfirm, confirmLabel, disabled, danger,
}: {
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
  confirmLabel: string;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="flex justify-end gap-2 pt-1">
      <button
        type="button"
        onClick={onCancel}
        disabled={disabled}
        className="text-xs px-3 py-1.5 text-gray-500 hover:text-gray-800 disabled:opacity-50"
      >
        キャンセル
      </button>
      <button
        type="button"
        onClick={() => void onConfirm()}
        disabled={disabled}
        className={`text-xs px-3 py-1.5 text-white rounded-xl transition-colors disabled:opacity-50 ${danger ? "bg-red-600 hover:bg-red-700" : "bg-gray-800 hover:bg-gray-700"}`}
      >
        {confirmLabel}
      </button>
    </div>
  );
}
