"use client";

// Sprint 41 / 41.1: 管理者専用 — 商品登録フォーム
// 5セクション構成: URL自動入力 / 基本情報 / 属性 / 判断軸（8軸） / キュレーション
// アクセス制御は middleware（ADMIN_EMAILS）で行う。

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type {
  CreateProductRequest,
  KnowledgeKeywordsResponse,
  BodyConcern,
  ProductAxes,
  FetchProductInfoResponse,
  MaterialComposition,
  AnalyzeProductImageResponse,
  AnalyzeProductTextResponse,
} from "@/types/index";

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

const SILHOUETTE_TYPES = ["Iライン", "Aライン", "Yライン", "Oライン"];
const SHOULDER_LINES   = ["ジャストショルダー", "ドロップショルダー", "パワーショルダー"];
const TEXTURE_TYPES    = ["ハリ", "ドレープ", "落ち感", "マット", "光沢", "ニット感"];
const SEASONS          = ["春", "夏", "秋", "冬"];

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

  // --- 基本情報 ---
  const [brand, setBrand]                       = useState("");
  const [name, setName]                         = useState("");
  const [imageUrl, setImageUrl]                 = useState("");
  const [price, setPrice]                       = useState<string>("");
  const [productUrl, setProductUrl]             = useState("");
  // --- 属性 ---
  const [normalizedCategory, setCategory]       = useState("tops");
  const [normalizedColors, setColors]           = useState<string[]>([]);
  const [normalizedMaterials, setMaterials]     = useState<string[]>([]);
  const [normalizedSilhouette, setSilhouette]   = useState("");
  // --- 判断軸（8軸） ---
  const [silhouetteType, setSilhouetteType]     = useState("");
  const [topBottomRatio, setTopBottomRatio]     = useState("");
  const [lengthBalance, setLengthBalance]       = useState("");
  const [shoulderLine, setShoulderLine]         = useState("");
  const [weightCenter, setWeightCenter]         = useState<"upper" | "lower" | "balanced" | "">("");
  const [textureType, setTextureType]           = useState("");
  const [seasonality, setSeasonality]           = useState<string[]>([]);
  // --- キュレーション ---
  const [worldviewTags, setWorldviewTags]       = useState<string[]>([]);
  const [worldviewInput, setWorldviewInput]     = useState("");
  const [bodyCompatTags, setBodyCompatTags]     = useState<BodyConcern[]>([]);
  const [curationNotes, setNotes]               = useState("");
  const [curationPriority, setPriority]         = useState(50);
  // --- 素材混率（読み取り専用表示） ---
  const [materialComposition, setMaterialComposition] = useState<MaterialComposition[]>([]);

  // --- URL自動入力 ---
  const [fetchUrl, setFetchUrl]                 = useState("");
  const [isFetching, setFetching]               = useState(false);
  const [fetchMessage, setFetchMessage]         = useState<string | null>(null);

  // --- スクショから自動入力 ---
  const [imageFile, setImageFile]               = useState<File | null>(null);
  const [imagePreview, setImagePreview]         = useState<string | null>(null);
  const [isAnalyzing, setAnalyzing]             = useState(false);
  const [analyzeMessage, setAnalyzeMessage]     = useState<string | null>(null);
  const imageInputRef                           = useRef<HTMLInputElement>(null);

  // --- テキストから自動入力 ---
  const [pasteText, setPasteText]               = useState("");
  const [isAnalyzingText, setAnalyzingText]     = useState(false);
  const [textMessage, setTextMessage]           = useState<string | null>(null);

  // --- オートコンプリート用 ---
  const [knownKeywords, setKnownKeywords]       = useState<string[]>([]);

  const [isSaving, setSaving]                   = useState(false);
  const [error, setError]                       = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/knowledge-keywords")
      .then((r) => r.json())
      .then((d: KnowledgeKeywordsResponse) => setKnownKeywords(d.keywords ?? []))
      .catch(() => setKnownKeywords([]));
  }, []);

  // ---- URL自動入力 ----
  async function handleFetchInfo() {
    if (!fetchUrl.trim()) return;
    setFetching(true);
    setFetchMessage(null);
    try {
      const res = await fetch("/api/admin/fetch-product-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: fetchUrl.trim() }),
      });
      const data = await res.json() as FetchProductInfoResponse & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "取得に失敗しました");

      // 空欄のフィールドのみ自動入力（既入力は尊重）
      if (!brand && data.brand) setBrand(data.brand);
      if (!name && data.name) setName(data.name);
      if (!imageUrl && data.imageUrl) setImageUrl(data.imageUrl);
      if (!price && data.price !== null) setPrice(String(data.price));
      if (!productUrl && data.productUrl) setProductUrl(data.productUrl);
      if (data.normalizedCategory) setCategory(data.normalizedCategory);
      if (normalizedColors.length === 0 && data.normalizedColors.length > 0) setColors(data.normalizedColors);
      if (normalizedMaterials.length === 0 && data.normalizedMaterials.length > 0) setMaterials(data.normalizedMaterials);
      if (!normalizedSilhouette && data.normalizedSilhouette) setSilhouette(data.normalizedSilhouette);
      // 8軸
      const a = data.axes ?? {};
      if (!silhouetteType && a.silhouetteType) setSilhouetteType(a.silhouetteType);
      if (!topBottomRatio && a.topBottomRatio) setTopBottomRatio(a.topBottomRatio);
      if (!lengthBalance && a.lengthBalance) setLengthBalance(a.lengthBalance);
      if (!shoulderLine && a.shoulderLine) setShoulderLine(a.shoulderLine);
      if (!weightCenter && a.weightCenter) setWeightCenter(a.weightCenter);
      if (!textureType && a.textureType) setTextureType(a.textureType);
      if (seasonality.length === 0 && a.seasonality && a.seasonality.length > 0) setSeasonality(a.seasonality);
      // キュレーション
      if (worldviewTags.length === 0 && data.worldviewTags.length > 0) setWorldviewTags(data.worldviewTags);
      if (bodyCompatTags.length === 0 && data.bodyCompatTags.length > 0) {
        setBodyCompatTags(data.bodyCompatTags as BodyConcern[]);
      }
      if (!curationNotes && data.curationNotes) setNotes(data.curationNotes);
      if (data.curationPriority) setPriority(data.curationPriority);
      // 素材混率（読み取り専用、空のときだけ入れる）
      if (materialComposition.length === 0 && data.materialComposition.length > 0) {
        setMaterialComposition(data.materialComposition);
      }

      setFetchMessage("✓ 取得完了。空欄だったフィールドに自動入力しました。");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "取得に失敗しました";
      setFetchMessage(`✗ ${msg}`);
    } finally {
      setFetching(false);
    }
  }

  // ---- 画像（スクショ）からの自動入力 ----
  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setAnalyzeMessage(null);
    if (!file) {
      setImageFile(null);
      setImagePreview(null);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAnalyzeMessage("✗ 画像サイズは5MB以下にしてください");
      setImageFile(null);
      setImagePreview(null);
      if (imageInputRef.current) imageInputRef.current.value = "";
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  function clearImage() {
    setImageFile(null);
    setImagePreview(null);
    setAnalyzeMessage(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
  }

  async function resizeImage(file: File): Promise<{ base64: string; mediaType: string }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const MAX = 1500;
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

  async function handleAnalyzeImage() {
    if (!imageFile) return;
    setAnalyzing(true);
    setAnalyzeMessage(null);
    try {
      const { base64, mediaType } = await resizeImage(imageFile);
      const res = await fetch("/api/admin/analyze-product-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64, mediaType }),
      });
      const data = await res.json() as AnalyzeProductImageResponse & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "画像解析に失敗しました");

      // 空欄のフィールドのみ自動入力（既入力は尊重）
      // imageUrl / productUrl はスクショからは取れない（admin が後で貼り付ける）
      if (!brand && data.brand) setBrand(data.brand);
      if (!name && data.name) setName(data.name);
      if (!price && data.price !== null) setPrice(String(data.price));
      if (data.normalizedCategory) setCategory(data.normalizedCategory);
      if (normalizedColors.length === 0 && data.normalizedColors.length > 0) setColors(data.normalizedColors);
      if (normalizedMaterials.length === 0 && data.normalizedMaterials.length > 0) setMaterials(data.normalizedMaterials);
      if (!normalizedSilhouette && data.normalizedSilhouette) setSilhouette(data.normalizedSilhouette);
      const a = data.axes ?? {};
      if (!silhouetteType && a.silhouetteType) setSilhouetteType(a.silhouetteType);
      if (!topBottomRatio && a.topBottomRatio) setTopBottomRatio(a.topBottomRatio);
      if (!lengthBalance && a.lengthBalance) setLengthBalance(a.lengthBalance);
      if (!shoulderLine && a.shoulderLine) setShoulderLine(a.shoulderLine);
      if (!weightCenter && a.weightCenter) setWeightCenter(a.weightCenter);
      if (!textureType && a.textureType) setTextureType(a.textureType);
      if (seasonality.length === 0 && a.seasonality && a.seasonality.length > 0) setSeasonality(a.seasonality);
      if (worldviewTags.length === 0 && data.worldviewTags.length > 0) setWorldviewTags(data.worldviewTags);
      if (bodyCompatTags.length === 0 && data.bodyCompatTags.length > 0) {
        setBodyCompatTags(data.bodyCompatTags as BodyConcern[]);
      }
      if (!curationNotes && data.curationNotes) setNotes(data.curationNotes);
      if (data.curationPriority) setPriority(data.curationPriority);
      if (materialComposition.length === 0 && data.materialComposition.length > 0) {
        setMaterialComposition(data.materialComposition);
      }

      setAnalyzeMessage("✓ 解析完了。空欄だったフィールドに自動入力しました。画像URL・購入URLは別途貼り付けてください。");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "画像解析に失敗しました";
      setAnalyzeMessage(`✗ ${msg}`);
    } finally {
      setAnalyzing(false);
    }
  }

  // ---- テキスト貼り付けからの自動入力 ----
  async function handleAnalyzeText() {
    if (!pasteText.trim()) return;
    setAnalyzingText(true);
    setTextMessage(null);
    try {
      const res = await fetch("/api/admin/analyze-product-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: pasteText }),
      });
      const data = await res.json() as AnalyzeProductTextResponse & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "テキスト解析に失敗しました");

      // 空欄のフィールドのみ自動入力（既入力は尊重）
      if (!brand && data.brand) setBrand(data.brand);
      if (!name && data.name) setName(data.name);
      if (!imageUrl && data.imageUrl) setImageUrl(data.imageUrl);
      if (!price && data.price !== null) setPrice(String(data.price));
      if (!productUrl && data.productUrl) setProductUrl(data.productUrl);
      if (data.normalizedCategory) setCategory(data.normalizedCategory);
      if (normalizedColors.length === 0 && data.normalizedColors.length > 0) setColors(data.normalizedColors);
      if (normalizedMaterials.length === 0 && data.normalizedMaterials.length > 0) setMaterials(data.normalizedMaterials);
      if (!normalizedSilhouette && data.normalizedSilhouette) setSilhouette(data.normalizedSilhouette);
      const a = data.axes ?? {};
      if (!silhouetteType && a.silhouetteType) setSilhouetteType(a.silhouetteType);
      if (!topBottomRatio && a.topBottomRatio) setTopBottomRatio(a.topBottomRatio);
      if (!lengthBalance && a.lengthBalance) setLengthBalance(a.lengthBalance);
      if (!shoulderLine && a.shoulderLine) setShoulderLine(a.shoulderLine);
      if (!weightCenter && a.weightCenter) setWeightCenter(a.weightCenter);
      if (!textureType && a.textureType) setTextureType(a.textureType);
      if (seasonality.length === 0 && a.seasonality && a.seasonality.length > 0) setSeasonality(a.seasonality);
      if (worldviewTags.length === 0 && data.worldviewTags.length > 0) setWorldviewTags(data.worldviewTags);
      if (bodyCompatTags.length === 0 && data.bodyCompatTags.length > 0) {
        setBodyCompatTags(data.bodyCompatTags as BodyConcern[]);
      }
      if (!curationNotes && data.curationNotes) setNotes(data.curationNotes);
      if (data.curationPriority) setPriority(data.curationPriority);
      if (materialComposition.length === 0 && data.materialComposition.length > 0) {
        setMaterialComposition(data.materialComposition);
      }

      setTextMessage("✓ 解析完了。空欄だったフィールドに自動入力しました。");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "テキスト解析に失敗しました";
      setTextMessage(`✗ ${msg}`);
    } finally {
      setAnalyzingText(false);
    }
  }

  // ---- chip toggle helpers ----
  function toggleInArray<T>(arr: T[], value: T, setter: (v: T[]) => void) {
    setter(arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]);
  }

  function addWorldviewTag(t: string) {
    const trimmed = t.trim();
    if (!trimmed || worldviewTags.includes(trimmed)) return;
    setWorldviewTags((prev) => [...prev, trimmed]);
    setWorldviewInput("");
  }

  function removeWorldviewTag(t: string) {
    setWorldviewTags((prev) => prev.filter((x) => x !== t));
  }

  // ---- submit ----
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!brand.trim() || !name.trim() || !imageUrl.trim() || !productUrl.trim()) {
      setError("ブランド・商品名・画像URL・購入URLは必須です");
      return;
    }
    setSaving(true);
    try {
      const axes: ProductAxes = {
        silhouetteType:  silhouetteType  || null,
        topBottomRatio:  topBottomRatio  || null,
        lengthBalance:   lengthBalance   || null,
        shoulderLine:    shoulderLine    || null,
        weightCenter:    weightCenter    || null,
        textureType:     textureType     || null,
        seasonality:     seasonality,
      };

      const body: CreateProductRequest = {
        brand:                brand.trim(),
        name:                 name.trim(),
        imageUrl:             imageUrl.trim(),
        price:                price ? Number(price) : null,
        productUrl:           productUrl.trim(),
        normalizedCategory,
        normalizedColors,
        normalizedMaterials,
        normalizedSilhouette: normalizedSilhouette || undefined,
        worldviewTags,
        bodyCompatTags,
        curationNotes:        curationNotes.trim() || undefined,
        curationPriority,
        axes,
        materialComposition:  materialComposition.length > 0 ? materialComposition : undefined,
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
          {/* Section 1: URL 自動入力 */}
          <Section title="🔗 URLから自動入力（任意）">
            <div className="flex gap-2">
              <input
                type="url"
                value={fetchUrl}
                onChange={(e) => setFetchUrl(e.target.value)}
                placeholder="https://zozo.jp/... もしくは公式サイトのURL"
                className={inputClass}
              />
              <button
                type="button"
                onClick={handleFetchInfo}
                disabled={isFetching || !fetchUrl.trim()}
                className="px-4 py-2 bg-gray-800 text-white rounded-xl text-sm hover:bg-gray-700 disabled:opacity-40 whitespace-nowrap"
              >
                {isFetching ? "取得中..." : "情報を取得"}
              </button>
            </div>
            {fetchMessage && (
              <p className={`text-xs mt-2 ${fetchMessage.startsWith("✓") ? "text-emerald-600" : "text-red-600"}`}>
                {fetchMessage}
              </p>
            )}
            <p className="text-xs text-gray-400 mt-2">
              OG タグ・JSON-LD から商品情報と8軸判断を自動推測します。空欄のフィールドのみ埋め、既入力は尊重します。ZOZO は弾かれることがあるので、その場合は下のスクショ解析を使ってください。
            </p>

            {/* スクショ解析（フォールバック） */}
            <div className="border-t border-gray-100 mt-4 pt-4">
              <p className="text-xs tracking-widest text-gray-400 uppercase mb-2">📸 スクショから取得（任意・URLが弾かれた時用）</p>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleImageChange}
                className="block w-full text-xs text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-gray-100 file:text-gray-700 file:text-xs hover:file:bg-gray-200"
              />
              {imagePreview && (
                <div className="mt-2 relative inline-block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imagePreview} alt="プレビュー" className="max-h-48 rounded-lg object-contain bg-gray-50 border border-gray-100" />
                  <button
                    type="button"
                    onClick={clearImage}
                    className="absolute top-1 right-1 bg-white/90 border border-gray-200 rounded-full w-6 h-6 text-xs text-gray-600 hover:bg-white"
                    aria-label="画像をクリア"
                  >
                    ×
                  </button>
                </div>
              )}
              {imageFile && (
                <button
                  type="button"
                  onClick={handleAnalyzeImage}
                  disabled={isAnalyzing}
                  className="mt-2 px-4 py-2 bg-gray-800 text-white rounded-xl text-sm hover:bg-gray-700 disabled:opacity-40"
                >
                  {isAnalyzing ? "解析中..." : "画像を解析して自動入力"}
                </button>
              )}
              {analyzeMessage && (
                <p className={`text-xs mt-2 ${analyzeMessage.startsWith("✓") ? "text-emerald-600" : "text-red-600"}`}>
                  {analyzeMessage}
                </p>
              )}
              <p className="text-xs text-gray-400 mt-2">
                Claude Vision が商品ページのスクショから情報を抽出します。画像URL・購入URLは別途貼り付けてください（画像は保存されません）。
              </p>
            </div>

            {/* テキスト貼り付け解析 */}
            <div className="border-t border-gray-100 mt-4 pt-4">
              <p className="text-xs tracking-widest text-gray-400 uppercase mb-2">📝 テキストから取得（任意・URLが弾かれた時用）</p>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                rows={6}
                className={`${inputClass} resize-y font-mono text-xs leading-relaxed`}
                placeholder="商品ページのテキストをコピペしてください（商品名・価格・素材表記を含むブロックを推奨。最大50,000字）"
              />
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-gray-400">
                  {pasteText.length > 0 ? `${pasteText.length.toLocaleString()} 字` : "—"}
                </p>
                <button
                  type="button"
                  onClick={handleAnalyzeText}
                  disabled={isAnalyzingText || pasteText.trim().length < 30}
                  className="px-4 py-2 bg-gray-800 text-white rounded-xl text-sm hover:bg-gray-700 disabled:opacity-40"
                >
                  {isAnalyzingText ? "解析中..." : "テキストを解析"}
                </button>
              </div>
              {textMessage && (
                <p className={`text-xs mt-2 ${textMessage.startsWith("✓") ? "text-emerald-600" : "text-red-600"}`}>
                  {textMessage}
                </p>
              )}
              <p className="text-xs text-gray-400 mt-2">
                ブラウザで本文を選択コピー → ここに貼り付け。素材混率（「ポリエステル80% 綿20%」等）も抽出します。
              </p>
            </div>
          </Section>

          {/* Section 2: 基本情報 */}
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

          {/* Section 3: 属性 */}
          <Section title="属性">
            <Field label="カテゴリ" required>
              <select value={normalizedCategory} onChange={(e) => setCategory(e.target.value)} className={selectClass}>
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </Field>

            <Field label="色（複数選択可・先頭がメイン色）">
              <ChipMulti options={COLORS} selected={normalizedColors} onToggle={(v) => toggleInArray(normalizedColors, v, setColors)} />
            </Field>

            <Field label="素材（複数選択可）">
              <ChipMulti options={MATERIALS} selected={normalizedMaterials} onToggle={(v) => toggleInArray(normalizedMaterials, v, setMaterials)} />
            </Field>

            {materialComposition.length > 0 && (
              <div>
                <span className="text-xs text-gray-500 mb-1 block">素材混率（自動抽出・読み取り専用）</span>
                <div className="flex flex-wrap gap-1.5">
                  {materialComposition.map((m) => (
                    <span
                      key={m.name}
                      className="inline-flex items-center text-xs px-2.5 py-1 bg-amber-50 text-amber-700 rounded-full border border-amber-100"
                    >
                      {m.name}
                      {m.percentage !== null && <span className="ml-1 text-amber-600">{m.percentage}%</span>}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-1.5">URL/スクショから抽出された素材混率。登録時にDBに保存されます。</p>
              </div>
            )}

            <Field label="シルエット（単一）">
              <select value={normalizedSilhouette} onChange={(e) => setSilhouette(e.target.value)} className={selectClass}>
                <option value="">— 選択 —</option>
                {SILHOUETTES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
          </Section>

          {/* Section 4: 判断軸（8軸） */}
          <Section title="判断軸（8軸）">
            <div className="grid grid-cols-2 gap-3">
              <Field label="シルエット型">
                <select value={silhouetteType} onChange={(e) => setSilhouetteType(e.target.value)} className={selectClass}>
                  <option value="">— 選択 —</option>
                  {SILHOUETTE_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="重心">
                <select
                  value={weightCenter}
                  onChange={(e) => setWeightCenter(e.target.value as "" | "upper" | "lower" | "balanced")}
                  className={selectClass}
                >
                  <option value="">— 選択 —</option>
                  <option value="upper">上重心</option>
                  <option value="balanced">中重心</option>
                  <option value="lower">下重心</option>
                </select>
              </Field>
            </div>

            <Field label="上下比率（コーデで決まるため任意）">
              <input value={topBottomRatio} onChange={(e) => setTopBottomRatio(e.target.value)} className={inputClass} placeholder="例：上3:下7" />
            </Field>

            <Field label="丈バランス">
              <input value={lengthBalance} onChange={(e) => setLengthBalance(e.target.value)} className={inputClass} placeholder="例：ロング丈 / クロップド丈" />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="肩線（tops/outerwearのみ）">
                <select value={shoulderLine} onChange={(e) => setShoulderLine(e.target.value)} className={selectClass}>
                  <option value="">— 選択 —</option>
                  {SHOULDER_LINES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="質感タイプ">
                <select value={textureType} onChange={(e) => setTextureType(e.target.value)} className={selectClass}>
                  <option value="">— 選択 —</option>
                  {TEXTURE_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
            </div>

            <Field label="季節（複数可）">
              <div className="flex gap-2">
                {SEASONS.map((s) => {
                  const active = seasonality.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleInArray(seasonality, s, setSeasonality)}
                      className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                        active ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                      }`}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </Field>
          </Section>

          {/* Section 5: キュレーション */}
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
            </Field>

            <Field label="体型適性タグ">
              <div className="grid grid-cols-2 gap-2">
                {BODY_CONCERN_OPTIONS.map((c) => (
                  <label key={c.value} className="flex items-center gap-2 text-xs text-gray-700">
                    <input
                      type="checkbox"
                      checked={bodyCompatTags.includes(c.value)}
                      onChange={() => toggleInArray(bodyCompatTags, c.value, setBodyCompatTags)}
                    />
                    {c.label}
                  </label>
                ))}
              </div>
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
            <Link href="/admin/products" className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl text-sm text-center hover:bg-gray-50">
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

// ---- helpers ----

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

function ChipMulti({ options, selected, onToggle }: { options: string[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const active = selected.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onToggle(opt)}
              className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                active
                  ? "bg-gray-800 text-white border-gray-800"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
      {selected.length > 0 && (
        <p className="text-xs text-gray-400 mt-1.5">選択中: {selected.join("・")}</p>
      )}
    </>
  );
}

const inputClass = "w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200";
const selectClass = "w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-200";
