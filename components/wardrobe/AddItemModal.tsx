"use client";

import { useState, useRef } from "react";
import { uploadWardrobeImage } from "@/lib/storage";
import type {
  WardrobeCategory,
  WardrobeStatus,
  Season,
  WardrobeItem,
  WardrobeCompatibilityAIResponse,
  ItemAnalysisAIResponse,
} from "@/types/index";

const CATEGORIES: { value: WardrobeCategory; label: string }[] = [
  { value: "tops",        label: "トップス" },
  { value: "bottoms",     label: "ボトムス" },
  { value: "outerwear",   label: "アウター" },
  { value: "jacket",      label: "ジャケット" },
  { value: "vest",        label: "ベスト" },
  { value: "inner",       label: "インナー" },
  { value: "dress",       label: "ワンピース" },
  { value: "setup",       label: "セットアップ" },
  { value: "shoes",       label: "シューズ" },
  { value: "bags",        label: "バッグ" },
  { value: "accessories", label: "アクセサリー" },
  { value: "hat",         label: "帽子" },
  { value: "jewelry",     label: "ジュエリー" },
  { value: "roomwear",    label: "ルームウェア" },
  { value: "other",       label: "その他" },
];

const SEASONS: { value: Season; label: string }[] = [
  { value: "spring", label: "春" },
  { value: "summer", label: "夏" },
  { value: "autumn", label: "秋" },
  { value: "winter", label: "冬" },
  { value: "all",    label: "オールシーズン" },
];

const MATERIALS = [
  "綿", "麻", "毛", "絹", "ポリエステル",
  "ナイロン", "レーヨン", "テンセル", "モーダル",
  "アクリル", "カシミヤ", "革", "ポリウレタン",
  "モヘア", "アルパカ", "竹", "コーデュラ",
];

const FABRIC_TEXTURES = [
  "ニット", "デニム", "ベルベット", "コーデュロイ", "サテン",
  "ツイード", "リブ", "シアー", "フリース", "メッシュ", "キルティング",
];

const COLORS = [
  "ホワイト", "オフホワイト", "アイボリー", "ベージュ",
  "ライトグレー", "グレー", "チャコール", "ブラック",
  "ネイビー", "ブルー", "グリーン", "カーキ",
  "ブラウン", "テラコッタ", "マスタード", "イエロー",
  "オレンジ", "レッド", "ボルドー", "ピンク",
  "くすみピンク", "ラベンダー", "パープル", "シルバー", "ゴールド",
];

const SILHOUETTES_BY_CATEGORY: Record<string, string[]> = {
  tops:        ["オーバーサイズ", "リラックス", "フィット", "スリム", "クロップド"],
  inner:       ["フィット", "スリム", "クロップド", "オーバーサイズ"],
  bottoms:     ["ワイド", "バギー", "テーパード", "ストレート", "スリム", "フレア", "ショート"],
  outerwear:   ["オーバーサイズ", "リラックス", "フィット", "ショート丈", "ロング丈"],
  jacket:      ["オーバーサイズ", "リラックス", "フィット", "ショート丈", "ロング丈"],
  vest:        ["オーバーサイズ", "フィット", "ロング丈"],
  dress:       ["Aライン", "フレア", "タイト", "ストレート", "マキシ", "ミニ"],
  setup:       ["ワイド", "テーパード", "ストレート", "リラックス"],
  shoes:       ["フラット", "ローヒール", "ハイヒール", "チャンキー", "スリム"],
  bags:        ["ミニ", "スモール", "ミディアム", "ラージ", "トート", "クラッチ"],
  accessories: ["シンプル", "ボリューム", "レイヤード"],
  hat:         ["キャップ型", "ハット型", "ニット型", "ベレー型"],
  jewelry:     ["シンプル", "ボリューム", "レイヤード"],
  roomwear:    ["リラックス", "フィット", "オーバーサイズ"],
  other:       ["オーバーサイズ", "リラックス", "スリム", "フィット"],
};

const STATUSES: { value: WardrobeStatus; label: string; desc: string }[] = [
  { value: "owned",       label: "所有中",   desc: "手元にある" },
  { value: "considering", label: "検討中",   desc: "買うか迷っている" },
  { value: "wishlist",    label: "欲しい",   desc: "いつか買いたい" },
  { value: "passed",      label: "見送り",   desc: "やめた" },
];

const TASTES = [
  "ミニマル", "カジュアル", "エレガント", "クリーン",
  "ストリート", "スポーティ", "フェミニン", "マスキュリン",
  "ヴィンテージ", "アーティスティック",
];

export const COMPATIBILITY_LABELS = {
  perfect: { label: "完璧な相性", color: "text-emerald-600 bg-emerald-50" },
  good:    { label: "相性良し",   color: "text-blue-600 bg-blue-50" },
  neutral: { label: "ニュートラル", color: "text-gray-600 bg-gray-50" },
  caution: { label: "要注意",     color: "text-amber-600 bg-amber-50" },
};

interface AddItemModalProps {
  userId: string;
  onClose: () => void;
  onAdded: (item: WardrobeItem, compatibility: WardrobeCompatibilityAIResponse | null) => void;
}

export default function AddItemModal({ userId, onClose, onAdded }: AddItemModalProps) {
  const [status, setStatus] = useState<WardrobeStatus>("owned");
  const [name, setName] = useState("");
  const [category, setCategory] = useState<WardrobeCategory>("tops");
  const [color, setColor] = useState("");
  const [subColor, setSubColor] = useState("");
  const [materials, setMaterials] = useState<string[]>([]);
  const [materialFreeInput, setMaterialFreeInput] = useState("");
  const [fabricTexture, setFabricTexture] = useState("");
  const [seasons, setSeasons] = useState<Season[]>(["all"]);
  const [silhouette, setSilhouette] = useState("");
  const [tastes, setTastes] = useState<string[]>([]);
  const [brand, setBrand] = useState("");
  const [notes, setNotes] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setImageFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setImagePreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setImagePreview(null);
    }
  }

  function toggleMaterial(m: string) {
    setMaterials((prev) => prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]);
  }

  function toggleTaste(t: string) {
    setTastes((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]);
  }

  function handleCategoryChange(c: WardrobeCategory) {
    setCategory(c);
    setSilhouette("");
  }

  async function resizeImage(file: File): Promise<{ base64: string; mediaType: string }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const MAX = 1024;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          const ratio = Math.min(MAX / width, MAX / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(url);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        resolve({ base64: dataUrl.split(",")[1], mediaType: "image/jpeg" });
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("画像の読み込みに失敗しました")); };
      img.src = url;
    });
  }

  function applyAnalysis(result: ItemAnalysisAIResponse, overwrite: boolean) {
    setCategory(result.category);

    if (overwrite || color === "")     setColor(result.color);
    if (overwrite || subColor === "")  setSubColor(result.subColor ?? "");

    if (overwrite || (materials.length === 0 && materialFreeInput === "")) {
      const materialStr = result.material ?? "";
      const matched = MATERIALS.filter((m) => materialStr.includes(m));
      setMaterials(matched);
      const remaining = matched.reduce((s, m) => s.replace(m, ""), materialStr).replace(/[、,\s]+/g, "").trim();
      setMaterialFreeInput(remaining);
    }

    if (overwrite || fabricTexture === "") setFabricTexture(result.fabricTexture ?? "");
    if (overwrite || silhouette === "")    setSilhouette(result.silhouette ?? "");
    if (overwrite || tastes.length === 0)  setTastes(result.taste.filter((t) => TASTES.includes(t)));
    if (overwrite || brand === "")         setBrand(result.brand ?? "");
  }

  async function handleAnalyze(overwrite: boolean) {
    if (!imageFile) return;
    setIsAnalyzing(true);
    setAnalysisError(null);
    try {
      const { base64, mediaType } = await resizeImage(imageFile);
      const res = await fetch("/api/ai/analyze-item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64, mediaType }),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        throw new Error(d.error ?? "解析に失敗しました");
      }
      const result = await res.json() as ItemAnalysisAIResponse;
      applyAnalysis(result, overwrite);
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : "解析に失敗しました");
    } finally {
      setIsAnalyzing(false);
    }
  }

  function toggleSeason(s: Season) {
    setSeasons((prev) => {
      if (s === "all") return ["all"];
      const withoutAll = prev.filter((x) => x !== "all");
      if (withoutAll.includes(s)) {
        const next = withoutAll.filter((x) => x !== s);
        return next.length === 0 ? ["all"] : next;
      }
      return [...withoutAll, s];
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!color) { setError("色を選択してください"); return; }
    setIsLoading(true);
    setError(null);

    try {
      let imageUrl: string | null = null;
      if (imageFile) {
        imageUrl = await uploadWardrobeImage(userId, imageFile);
      }

      const res = await fetch("/api/wardrobe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          category,
          color,
          subColor: subColor || null,
          material: [...materials, ...(materialFreeInput.trim() ? [materialFreeInput.trim()] : [])].join("、") || null,
          fabricTexture: fabricTexture || null,
          brand: brand || null,
          seasons,
          status,
          silhouette: silhouette || null,
          taste: tastes,
          imageUrl,
          tags: [],
          notes: notes || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? "登録に失敗しました");
      }

      const data = await res.json() as {
        item: WardrobeItem;
        compatibility: WardrobeCompatibilityAIResponse | null;
      };
      onAdded(data.item, data.compatibility);
    } catch (err) {
      setError(err instanceof Error ? err.message : "登録に失敗しました");
      setIsLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          <h2 className="text-base font-medium text-gray-900">アイテムを追加</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-6 space-y-6">
          {/* 画像 */}
          <div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full aspect-video bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center hover:border-gray-300 transition-colors overflow-hidden"
            >
              {imagePreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imagePreview} alt="preview" className="w-full h-full object-cover" />
              ) : (
                <>
                  <span className="text-2xl text-gray-300">📷</span>
                  <span className="text-xs text-gray-400 mt-1">タップして画像を選択（任意）</span>
                </>
              )}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
          </div>

          {/* AI自動入力 */}
          {imagePreview && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleAnalyze(false)}
                  disabled={isAnalyzing}
                  className="flex-1 py-2.5 bg-gray-800 text-white rounded-xl text-sm disabled:opacity-40 hover:bg-gray-700 transition-colors"
                >
                  {isAnalyzing ? "解析中..." : "AIで自動入力"}
                </button>
                <button
                  type="button"
                  onClick={() => handleAnalyze(true)}
                  disabled={isAnalyzing}
                  className="flex-1 py-2.5 bg-white text-gray-700 border border-gray-200 rounded-xl text-sm disabled:opacity-40 hover:border-gray-400 transition-colors"
                >
                  全て上書き
                </button>
              </div>
              {analysisError && <p className="text-xs text-red-500">{analysisError}</p>}
            </div>
          )}

          {/* ステータス */}
          <div>
            <label className="block text-xs text-gray-500 mb-2">ステータス *</label>
            <div className="grid grid-cols-2 gap-2">
              {STATUSES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setStatus(s.value)}
                  className={`flex flex-col items-start px-4 py-3 rounded-xl border transition-all ${
                    status === s.value
                      ? "bg-gray-800 text-white border-gray-800"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                  }`}
                >
                  <span className="text-sm font-medium">{s.label}</span>
                  <span className={`text-xs mt-0.5 ${status === s.value ? "text-gray-300" : "text-gray-400"}`}>{s.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* アイテム名 */}
          <div>
            <label className="block text-xs text-gray-500 mb-2">アイテム名 *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="例: ホワイトリネンシャツ"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:border-gray-400"
            />
          </div>

          {/* カテゴリ */}
          <div>
            <label className="block text-xs text-gray-500 mb-2">カテゴリ *</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => handleCategoryChange(c.value)}
                  className={`px-3 py-2 rounded-full text-xs border transition-all ${
                    category === c.value
                      ? "bg-gray-800 text-white border-gray-800"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* メインカラー */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">メインカラー *</label>
            <p className="text-xs text-gray-400 mb-2">最も面積の大きい色を選んでください</p>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`px-3 py-2 rounded-full text-xs border transition-all ${
                    color === c
                      ? "bg-gray-800 text-white border-gray-800"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* サブカラー */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">サブカラー（任意）</label>
            <p className="text-xs text-gray-400 mb-2">柄・配色のある場合は2色目を選んでください</p>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setSubColor(subColor === c ? "" : c)}
                  className={`px-3 py-2 rounded-full text-xs border transition-all ${
                    subColor === c
                      ? "bg-gray-500 text-white border-gray-500"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* 素材 */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">素材（複数可）</label>
            <p className="text-xs text-gray-400 mb-2">洗濯タグに近いものを選んでください</p>
            <div className="flex flex-wrap gap-2">
              {MATERIALS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => toggleMaterial(m)}
                  className={`px-3 py-2 rounded-full text-xs border transition-all ${
                    materials.includes(m)
                      ? "bg-gray-800 text-white border-gray-800"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* 素材・自由入力 */}
          <div>
            <label className="block text-xs text-gray-500 mb-2">素材・その他（任意）</label>
            <input
              type="text"
              value={materialFreeInput}
              onChange={(e) => setMaterialFreeInput(e.target.value)}
              placeholder="例: オーガニックコットン、リサイクルポリエステル"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:border-gray-400"
            />
          </div>

          {/* 生地感・質感・編み */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">生地感・質感・編み（任意）</label>
            <p className="text-xs text-gray-400 mb-2">見た目や触感を最もよく表すものを選んでください</p>
            <div className="flex flex-wrap gap-2">
              {FABRIC_TEXTURES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setFabricTexture(fabricTexture === t ? "" : t)}
                  className={`px-3 py-2 rounded-full text-xs border transition-all ${
                    fabricTexture === t
                      ? "bg-gray-800 text-white border-gray-800"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* シーズン */}
          <div>
            <label className="block text-xs text-gray-500 mb-2">シーズン（複数可）</label>
            <div className="flex flex-wrap gap-2">
              {SEASONS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => toggleSeason(s.value)}
                  className={`px-3 py-2 rounded-full text-xs border transition-all ${
                    seasons.includes(s.value)
                      ? "bg-gray-800 text-white border-gray-800"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* シルエット（カテゴリ連動） */}
          {(SILHOUETTES_BY_CATEGORY[category] ?? []).length > 0 && (
            <div>
              <label className="block text-xs text-gray-500 mb-2">シルエット（任意）</label>
              <div className="flex flex-wrap gap-2">
                {(SILHOUETTES_BY_CATEGORY[category] ?? []).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSilhouette(silhouette === s ? "" : s)}
                    className={`px-3 py-2 rounded-full text-xs border transition-all ${
                      silhouette === s
                        ? "bg-gray-800 text-white border-gray-800"
                        : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* テイスト（複数可） */}
          <div>
            <label className="block text-xs text-gray-500 mb-2">テイスト（複数可）</label>
            <div className="flex flex-wrap gap-2">
              {TASTES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleTaste(t)}
                  className={`px-3 py-2 rounded-full text-xs border transition-all ${
                    tastes.includes(t)
                      ? "bg-gray-800 text-white border-gray-800"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* ブランド */}
          <div>
            <label className="block text-xs text-gray-500 mb-2">ブランド（任意）</label>
            <input
              type="text"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="例: Uniqlo、stein、COMOLI"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:border-gray-400"
            />
          </div>

          {/* メモ */}
          <div>
            <label className="block text-xs text-gray-500 mb-2">世界観との一致度メモ（任意）</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="例: ミニマルな日に必ず選ぶ一枚"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:border-gray-400 resize-none"
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={isLoading || !name}
            className="w-full py-3.5 bg-gray-800 text-white rounded-xl text-sm disabled:opacity-40 hover:bg-gray-700 transition-colors"
          >
            {isLoading ? "登録中..." : "追加する"}
          </button>
        </form>
      </div>
    </div>
  );
}
