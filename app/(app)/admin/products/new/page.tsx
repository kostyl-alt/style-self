"use client";

// Sprint 41: 管理者専用 — 商品登録フォーム
// アクセス制御は middleware（ADMIN_EMAILS）で行う。

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { CreateProductRequest, KnowledgeKeywordsResponse, BodyConcern } from "@/types/index";

const CATEGORIES: { value: string; label: string }[] = [
  { value: "tops",        label: "トップス" },
  { value: "bottoms",     label: "ボトムス" },
  { value: "outerwear",   label: "アウター（ジャケット・コート含む）" },
  { value: "dress",       label: "ワンピース・セットアップ" },
  { value: "shoes",       label: "シューズ" },
  { value: "bags",        label: "バッグ" },
  { value: "accessories", label: "アクセサリー（帽子・ベルト含む）" },
];

const COLORS = [
  "ホワイト","オフホワイト","アイボリー","ベージュ","ライトグレー","グレー","チャコール","ブラック",
  "ネイビー","ブルー","グリーン","カーキ","ブラウン","テラコッタ","マスタード","イエロー",
  "オレンジ","レッド","ボルドー","ピンク","くすみピンク","ラベンダー","パープル","シルバー","ゴールド",
];

const MATERIALS = [
  "綿","麻","毛","絹","ポリエステル","ナイロン","レーヨン","テンセル","モーダル",
  "アクリル","カシミヤ","革","ポリウレタン","モヘア","アルパカ","竹","コーデュラ",
];

const SILHOUETTES = [
  "オーバーサイズ","リラックス","フィット","スリム","クロップド","ワイド","バギー",
  "テーパード","ストレート","フレア","Aライン","タイト","マキシ","ミニ",
];

const BODY_CONCERN_OPTIONS: { value: BodyConcern; label: string }[] = [
  { value: "looks_young",     label: "子どもっぽく見える" },
  { value: "short_legs",      label: "脚が短く見える" },
  { value: "broad_shoulders", label: "肩幅が広い" },
  { value: "wide_hips",       label: "腰回りが気になる" },
  { value: "short_torso",     label: "胴が短い" },
  { value: "top_heavy",       label: "上半身が重い" },
  { value: "bottom_heavy",    label: "下半身が重い" },
];

export default function AdminProductNewPage() {
  const router = useRouter();

  // フォーム状態
  const [brand, setBrand]                       = useState("");
  const [name, setName]                         = useState("");
  const [imageUrl, setImageUrl]                 = useState("");
  const [price, setPrice]                       = useState<string>("");
  const [productUrl, setProductUrl]             = useState("");
  const [normalizedCategory, setCategory]       = useState("tops");
  const [normalizedColor, setColor]             = useState("");
  const [normalizedMaterial, setMaterial]       = useState("");
  const [normalizedSilhouette, setSilhouette]   = useState("");
  const [worldviewTags, setWorldviewTags]       = useState<string[]>([]);
  const [worldviewInput, setWorldviewInput]     = useState("");
  const [bodyCompatTags, setBodyCompatTags]     = useState<BodyConcern[]>([]);
  const [curationNotes, setNotes]               = useState("");
  const [curationPriority, setPriority]         = useState(50);

  // オートコンプリート用
  const [knownKeywords, setKnownKeywords]       = useState<string[]>([]);

  const [isSaving, setSaving]                   = useState(false);
  const [error, setError]                       = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/knowledge-keywords")
      .then((r) => r.json())
      .then((d: KnowledgeKeywordsResponse) => setKnownKeywords(d.keywords ?? []))
      .catch(() => setKnownKeywords([]));
  }, []);

  function addWorldviewTag(t: string) {
    const trimmed = t.trim();
    if (!trimmed) return;
    if (worldviewTags.includes(trimmed)) return;
    setWorldviewTags((prev) => [...prev, trimmed]);
    setWorldviewInput("");
  }

  function removeWorldviewTag(t: string) {
    setWorldviewTags((prev) => prev.filter((x) => x !== t));
  }

  function toggleBodyCompat(t: BodyConcern) {
    setBodyCompatTags((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // 簡易バリデーション
    if (!brand.trim() || !name.trim() || !imageUrl.trim() || !productUrl.trim()) {
      setError("ブランド・商品名・画像URL・購入URLは必須です");
      return;
    }

    setSaving(true);
    try {
      const body: CreateProductRequest = {
        brand:                brand.trim(),
        name:                 name.trim(),
        imageUrl:             imageUrl.trim(),
        price:                price ? Number(price) : null,
        productUrl:           productUrl.trim(),
        normalizedCategory,
        normalizedColor:      normalizedColor || undefined,
        normalizedMaterial:   normalizedMaterial || undefined,
        normalizedSilhouette: normalizedSilhouette || undefined,
        worldviewTags,
        bodyCompatTags,
        curationNotes:        curationNotes.trim() || undefined,
        curationPriority,
      };

      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "登録に失敗しました");
      router.push("/admin/products");
    } catch (err) {
      setError(err instanceof Error ? err.message : "登録に失敗しました");
      setSaving(false);
    }
  }

  // オートコンプリート候補（worldviewInput と前方/部分一致 + 既選択を除外）
  const acSuggestions = worldviewInput.trim()
    ? knownKeywords.filter(
        (k) => k.toLowerCase().includes(worldviewInput.toLowerCase()) && !worldviewTags.includes(k),
      ).slice(0, 8)
    : [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/admin/products" className="text-xs text-gray-500 hover:text-gray-700">← 一覧に戻る</Link>
          <p className="text-xs tracking-widest text-amber-600 uppercase mt-2 mb-1">⚠️ Admin</p>
          <h1 className="text-2xl font-light text-gray-900">商品を登録</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 基本情報 */}
          <Section title="基本情報">
            <Field label="ブランド名" required>
              <input value={brand} onChange={(e) => setBrand(e.target.value)} className={inputClass} placeholder="例：Auralee" />
            </Field>
            <Field label="商品名" required>
              <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="例：オーバーサイズシャツ" />
            </Field>
            <Field label="画像URL" required>
              <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className={inputClass} placeholder="https://..." />
              {imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrl} alt="プレビュー" className="mt-2 max-w-xs max-h-40 rounded-lg object-cover bg-gray-50" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              )}
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="価格（円）">
                <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className={inputClass} placeholder="38500" />
              </Field>
              <Field label="購入URL" required>
                <input value={productUrl} onChange={(e) => setProductUrl(e.target.value)} className={inputClass} placeholder="https://..." />
              </Field>
            </div>
          </Section>

          {/* 属性 */}
          <Section title="属性">
            <Field label="カテゴリ" required>
              <select value={normalizedCategory} onChange={(e) => setCategory(e.target.value)} className={selectClass}>
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="色">
                <select value={normalizedColor} onChange={(e) => setColor(e.target.value)} className={selectClass}>
                  <option value="">— 選択 —</option>
                  {COLORS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="素材">
                <select value={normalizedMaterial} onChange={(e) => setMaterial(e.target.value)} className={selectClass}>
                  <option value="">— 選択 —</option>
                  {MATERIALS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="シルエット">
                <select value={normalizedSilhouette} onChange={(e) => setSilhouette(e.target.value)} className={selectClass}>
                  <option value="">— 選択 —</option>
                  {SILHOUETTES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
            </div>
          </Section>

          {/* キュレーション */}
          <Section title="キュレーション">
            <Field label="世界観タグ">
              <div className="flex flex-wrap gap-1.5 mb-2">
                {worldviewTags.map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-emerald-50 text-emerald-700 rounded-full">
                    {t}
                    <button type="button" onClick={() => removeWorldviewTag(t)} className="hover:text-red-500">×</button>
                  </span>
                ))}
              </div>
              <input
                value={worldviewInput}
                onChange={(e) => setWorldviewInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addWorldviewTag(worldviewInput);
                  }
                }}
                className={inputClass}
                placeholder="ストア派、ミニマル... Enterで追加"
              />
              {acSuggestions.length > 0 && (
                <div className="mt-1 bg-white border border-gray-100 rounded-lg max-h-40 overflow-y-auto shadow-sm">
                  {acSuggestions.map((k) => (
                    <button
                      type="button"
                      key={k}
                      onClick={() => addWorldviewTag(k)}
                      className="block w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                    >
                      {k}
                    </button>
                  ))}
                </div>
              )}
              <p className="text-xs text-gray-400 mt-1">既存ナレッジから候補が出ます。新規入力も可</p>
            </Field>

            <Field label="体型適性タグ">
              <div className="grid grid-cols-2 gap-2">
                {BODY_CONCERN_OPTIONS.map((c) => (
                  <label key={c.value} className="flex items-center gap-2 text-xs text-gray-700">
                    <input
                      type="checkbox"
                      checked={bodyCompatTags.includes(c.value)}
                      onChange={() => toggleBodyCompat(c.value)}
                    />
                    {c.label}
                  </label>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1">この商品が解決する悩みにチェック</p>
            </Field>

            <Field label="キュレーションメモ">
              <textarea
                value={curationNotes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className={`${inputClass} resize-none`}
                placeholder="例：ストア派の墨色シャツとして優秀。リネン100%でハリがある。"
              />
            </Field>

            <Field label={`優先度（${curationPriority}）`}>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={curationPriority}
                onChange={(e) => setPriority(Number(e.target.value))}
                className="w-full"
              />
              <p className="text-xs text-gray-400 mt-1">0〜100。大きいほどマッチング上位に優先表示。</p>
            </Field>
          </Section>

          {error && (
            <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-2">
              <p className="text-xs text-red-600">{error}</p>
            </div>
          )}

          <div className="flex gap-2">
            <Link
              href="/admin/products"
              className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl text-sm text-center hover:bg-gray-50"
            >
              キャンセル
            </Link>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-3 bg-gray-800 text-white rounded-xl text-sm hover:bg-gray-700 disabled:opacity-40"
            >
              {isSaving ? "登録中..." : "登録"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5">
      <p className="text-xs tracking-widest text-gray-400 uppercase mb-4">{title}</p>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs text-gray-500 mb-1 block">
        {label}{required && <span className="text-red-500"> *</span>}
      </span>
      {children}
    </label>
  );
}

const inputClass = "w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200";
const selectClass = "w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-200";
