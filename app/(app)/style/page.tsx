"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import CoordinateCard from "@/components/coordinate/CoordinateCard";
import type { CoordinateGenerateResponse, WardrobeItem, StyleConsultResponse, LookAnalysisResponse } from "@/types/index";

type StyleTab = "coordinate" | "consult" | "saved";

const SCENES = [
  { value: "カジュアル", emoji: "☕", desc: "普段・休日" },
  { value: "仕事",       emoji: "💼", desc: "オフィス・打ち合わせ" },
  { value: "特別な日",   emoji: "✨", desc: "デート・イベント" },
];

const CONSULT_EXAMPLES = [
  "低身長だけどロングコートを着たい",
  "オーバーサイズが服に着られて見える",
  "肩幅が広く見えるのを目立たせたくない",
];

const ADJUST_LABELS: { key: keyof StyleConsultResponse["adjustments"]; label: string }[] = [
  { key: "silhouette",   label: "シルエット" },
  { key: "length",       label: "丈感" },
  { key: "weightCenter", label: "重心" },
  { key: "color",        label: "色の使い方" },
  { key: "material",     label: "素材" },
  { key: "shoes",        label: "靴" },
  { key: "accessories",  label: "小物・バッグ" },
  { key: "sizing",       label: "サイズ感" },
];

interface SavedCoordinate {
  id: string;
  color_story: string;
  belief_alignment: string;
  occasion: string | null;
  created_at: string;
}

// ---- コーデ提案タブ ----
function CoordinateTab() {
  const [scene, setScene]               = useState("カジュアル");
  const [ownedCount, setOwnedCount]     = useState<number | null>(null);
  const [result, setResult]             = useState<CoordinateGenerateResponse | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving]         = useState(false);
  const [isSaved, setIsSaved]           = useState(false);
  const [error, setError]               = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/wardrobe")
      .then((r) => r.json())
      .then((data: WardrobeItem[]) => {
        setOwnedCount(data.filter((i) => i.status === "owned").length);
      })
      .catch(() => setOwnedCount(0));
  }, []);

  async function handleGenerate() {
    setIsGenerating(true); setError(null); setResult(null); setIsSaved(false);
    try {
      const res = await fetch("/api/ai/coordinate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scene }),
      });
      const data = await res.json() as CoordinateGenerateResponse & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "コーデ生成に失敗しました");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "コーデ生成に失敗しました");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSave() {
    if (!result) return;
    setIsSaving(true);
    try {
      const res = await fetch("/api/coordinate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coordinate: result.coordinate, occasion: scene }),
      });
      if (res.ok) setIsSaved(true);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {ownedCount === 0 && ownedCount !== null && (
        <div className="bg-gray-50 rounded-2xl p-5 text-center">
          <p className="text-2xl mb-2">👗</p>
          <p className="text-sm text-gray-700 font-medium mb-1">クローゼットにアイテムがありません</p>
          <p className="text-xs text-gray-500 mb-4">コーデを生成するには「所有中」のアイテムが必要です</p>
          <Link href="/closet" className="inline-block px-5 py-2 bg-gray-800 text-white rounded-xl text-sm hover:bg-gray-700 transition-colors">
            アイテムを追加する →
          </Link>
        </div>
      )}
      <div>
        <p className="text-xs text-gray-500 mb-3">今日のシーンを選んでください</p>
        <div className="grid grid-cols-3 gap-3">
          {SCENES.map((s) => (
            <button key={s.value}
              onClick={() => { setScene(s.value); setResult(null); setIsSaved(false); }}
              className={`flex flex-col items-center gap-1.5 p-4 rounded-xl border transition-all ${
                scene === s.value ? "border-gray-800 bg-gray-800 text-white" : "border-gray-200 bg-white text-gray-600 hover:border-gray-400"
              }`}
            >
              <span className="text-2xl">{s.emoji}</span>
              <span className="text-xs font-medium">{s.value}</span>
              <span className={`text-xs ${scene === s.value ? "text-gray-300" : "text-gray-400"}`}>{s.desc}</span>
            </button>
          ))}
        </div>
      </div>
      <button onClick={handleGenerate} disabled={isGenerating || ownedCount === 0}
        className="w-full py-4 bg-gray-800 text-white rounded-xl text-sm hover:bg-gray-700 disabled:opacity-40 transition-colors"
      >
        {isGenerating ? "コーデを考えています..." : "コーデを提案してもらう"}
      </button>
      {isGenerating && (
        <div className="text-center py-10 text-gray-300">
          <div className="text-4xl mb-3 animate-pulse">👗</div>
          <p className="text-sm">クローゼットから最適な組み合わせを探しています</p>
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-100 rounded-xl p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
      {result && !isGenerating && (
        <>
          <CoordinateCard coordinate={result.coordinate} resolvedItems={result.resolvedItems} scene={scene} onSave={handleSave} isSaving={isSaving} isSaved={isSaved} />
          {isSaved && (
            <div className="bg-gray-50 rounded-xl p-4 flex items-center justify-between">
              <p className="text-sm text-gray-600">保存しました ✓</p>
            </div>
          )}
          <button onClick={handleGenerate}
            className="w-full py-3 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50 transition-colors"
          >
            別のコーデを提案してもらう
          </button>
        </>
      )}
    </div>
  );
}

// ---- 着こなし相談タブ ----
function ConsultTab() {
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState<StyleConsultResponse | null>(null);
  const [error, setError]       = useState<string | null>(null);

  // ---- 参考写真分析 (Sprint 34) ----
  const [lookFile, setLookFile]         = useState<File | null>(null);
  const [lookPreview, setLookPreview]   = useState<string | null>(null);
  const [lookLoading, setLookLoading]   = useState(false);
  const [lookResult, setLookResult]     = useState<LookAnalysisResponse | null>(null);
  const [lookError, setLookError]       = useState<string | null>(null);
  const lookInputRef = useRef<HTMLInputElement>(null);
  const consultTextareaRef = useRef<HTMLTextAreaElement>(null);

  function handleLookFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setLookError(null);
    setLookResult(null);
    if (!file) {
      setLookFile(null);
      setLookPreview(null);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setLookError("画像サイズは5MB以下にしてください");
      setLookFile(null);
      setLookPreview(null);
      if (lookInputRef.current) lookInputRef.current.value = "";
      return;
    }
    setLookFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setLookPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  function clearLookFile() {
    setLookFile(null);
    setLookPreview(null);
    setLookResult(null);
    setLookError(null);
    if (lookInputRef.current) lookInputRef.current.value = "";
  }

  async function resizeImage(file: File): Promise<{ base64: string; mediaType: string }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const MAX = 1280;
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

  async function handleAnalyzeLook() {
    if (!lookFile) return;
    setLookLoading(true); setLookError(null); setLookResult(null);
    try {
      const { base64, mediaType } = await resizeImage(lookFile);
      const res = await fetch("/api/ai/analyze-look", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64, mediaType }),
      });
      const data = await res.json() as LookAnalysisResponse & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "画像分析に失敗しました");
      setLookResult(data);
    } catch (err) {
      setLookError(err instanceof Error ? err.message : "画像分析に失敗しました");
    } finally {
      setLookLoading(false);
    }
  }

  function useAnalysisInConsultation() {
    if (!lookResult) return;
    const { topBottomRatio, weightCenter, whyLooksGood } = lookResult.lookAnalysis;
    const { howToAdapt } = lookResult.personalAdaptation;
    const text =
      `参考写真を分析しました。\n` +
      `上下比率：${topBottomRatio}\n` +
      `重心：${weightCenter}\n` +
      `なぜよく見えるか：${whyLooksGood}\n` +
      `自分への取り入れ方：${howToAdapt}\n` +
      `この比率・シルエットを自分の体型で再現したい。`;
    setInput(text);
    requestAnimationFrame(() => {
      consultTextareaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      consultTextareaRef.current?.focus();
    });
  }

  async function handleConsult() {
    if (!input.trim()) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await fetch("/api/ai/style-consult", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consultation: input }),
      });
      const data = await res.json() as StyleConsultResponse & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "相談の処理に失敗しました");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "相談の処理に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* 参考写真から分析 (Sprint 34) */}
      <div className="border border-gray-100 rounded-2xl p-5 space-y-4">
        <div>
          <p className="text-xs tracking-widest text-gray-400 uppercase mb-1">Reference Photo</p>
          <p className="text-xs text-gray-500">参考にしたい人の写真から比率・シルエットを分析します（顔は分析対象外）</p>
        </div>

        {!lookPreview ? (
          <button
            type="button"
            onClick={() => lookInputRef.current?.click()}
            className="w-full py-8 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors"
          >
            📷 写真を選ぶ（5MBまで）
          </button>
        ) : (
          <div className="space-y-3">
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={lookPreview} alt="参考写真" className="w-full max-h-80 object-contain rounded-xl bg-gray-50" />
              <button
                type="button"
                onClick={clearLookFile}
                className="absolute top-2 right-2 w-8 h-8 bg-white/90 border border-gray-200 rounded-full text-gray-500 hover:bg-white hover:text-gray-800 transition-colors text-sm"
              >
                ×
              </button>
            </div>
            <button
              type="button"
              onClick={handleAnalyzeLook}
              disabled={lookLoading}
              className="w-full py-3 bg-gray-800 text-white rounded-xl text-sm hover:bg-gray-700 disabled:opacity-40 transition-colors"
            >
              {lookLoading ? "分析しています..." : "この写真を分析する"}
            </button>
          </div>
        )}

        <input
          ref={lookInputRef}
          type="file"
          accept="image/*"
          onChange={handleLookFileChange}
          className="hidden"
        />

        {lookError && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-3">
            <p className="text-xs text-red-600">{lookError}</p>
          </div>
        )}

        {lookLoading && (
          <div className="text-center py-6 text-gray-300">
            <div className="text-3xl mb-2 animate-pulse">📐</div>
            <p className="text-xs">比率・シルエットを読み解いています</p>
          </div>
        )}

        {lookResult && !lookLoading && (
          <div className="space-y-4">
            {/* lookAnalysis */}
            <div className="bg-gray-800 text-white rounded-2xl p-5 space-y-3">
              <p className="text-xs tracking-widest text-gray-400 uppercase">Look Analysis</p>
              <div className="space-y-2 text-sm">
                <div className="flex gap-3"><span className="flex-shrink-0 text-xs text-gray-400 w-24 pt-0.5">シルエット</span><span className="leading-relaxed">{lookResult.lookAnalysis.silhouette}</span></div>
                <div className="flex gap-3"><span className="flex-shrink-0 text-xs text-gray-400 w-24 pt-0.5">上下比率</span><span className="leading-relaxed">{lookResult.lookAnalysis.topBottomRatio}</span></div>
                <div className="flex gap-3"><span className="flex-shrink-0 text-xs text-gray-400 w-24 pt-0.5">重心</span><span className="leading-relaxed">{lookResult.lookAnalysis.weightCenter}</span></div>
                <div className="flex gap-3"><span className="flex-shrink-0 text-xs text-gray-400 w-24 pt-0.5">丈バランス</span><span className="leading-relaxed">{lookResult.lookAnalysis.lengthBalance}</span></div>
                <div className="flex gap-3"><span className="flex-shrink-0 text-xs text-gray-400 w-24 pt-0.5">色の使い方</span><span className="leading-relaxed">{lookResult.lookAnalysis.colorScheme}</span></div>
              </div>
              {lookResult.lookAnalysis.keyElements.length > 0 && (
                <div className="pt-3 border-t border-gray-700">
                  <p className="text-xs text-gray-400 mb-2">核となる要素</p>
                  <ul className="space-y-1">
                    {lookResult.lookAnalysis.keyElements.map((el, i) => (
                      <li key={i} className="text-sm flex gap-2"><span className="text-gray-500">—</span><span>{el}</span></li>
                    ))}
                  </ul>
                </div>
              )}
              {lookResult.lookAnalysis.whyLooksGood && (
                <div className="pt-3 border-t border-gray-700">
                  <p className="text-xs text-gray-400 mb-2">なぜスタイルよく見えるか</p>
                  <p className="text-sm leading-relaxed">{lookResult.lookAnalysis.whyLooksGood}</p>
                </div>
              )}
            </div>

            {/* personalAdaptation */}
            <div className="border border-gray-200 rounded-2xl p-5 space-y-4">
              <p className="text-xs tracking-widest text-gray-400 uppercase">Personal Adaptation</p>
              {lookResult.personalAdaptation.howToAdapt && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">自分への取り入れ方</p>
                  <p className="text-sm text-gray-700 leading-relaxed">{lookResult.personalAdaptation.howToAdapt}</p>
                </div>
              )}
              {lookResult.personalAdaptation.adjustments.length > 0 && (
                <div>
                  <p className="text-xs text-gray-400 mb-2">調整ポイント</p>
                  <ol className="space-y-2">
                    {lookResult.personalAdaptation.adjustments.map((a, i) => (
                      <li key={i} className="flex gap-3 text-sm text-gray-700">
                        <span className="flex-shrink-0 w-5 h-5 bg-gray-800 text-white rounded-full flex items-center justify-center text-xs font-medium">{i + 1}</span>
                        <span className="leading-relaxed">{a}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              {lookResult.personalAdaptation.itemsToFind.length > 0 && (
                <div>
                  <p className="text-xs text-gray-400 mb-2">探すべきアイテム</p>
                  <ul className="space-y-1">
                    {lookResult.personalAdaptation.itemsToFind.map((it, i) => (
                      <li key={i} className="text-sm text-gray-700 flex gap-2"><span className="text-gray-400">•</span><span>{it}</span></li>
                    ))}
                  </ul>
                </div>
              )}
              {lookResult.personalAdaptation.avoidPoints.length > 0 && (
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                  <p className="text-xs text-amber-600 mb-2">避けるべき点</p>
                  <ul className="space-y-1">
                    {lookResult.personalAdaptation.avoidPoints.map((a, i) => (
                      <li key={i} className="text-sm text-amber-800 flex gap-2"><span>—</span><span>{a}</span></li>
                    ))}
                  </ul>
                </div>
              )}
              {lookResult.personalAdaptation.preferenceNote && (
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-1">好みを活かした配慮</p>
                  <p className="text-sm text-gray-700">{lookResult.personalAdaptation.preferenceNote}</p>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={useAnalysisInConsultation}
              className="w-full py-3 border border-gray-800 text-gray-800 rounded-xl text-sm hover:bg-gray-800 hover:text-white transition-colors"
            >
              この分析を相談に使う ↓
            </button>
          </div>
        )}
      </div>

      <div>
        <p className="text-xs text-gray-500 mb-3">相談例（タップで入力）</p>
        <div className="flex flex-col gap-2">
          {CONSULT_EXAMPLES.map((ex) => (
            <button key={ex} onClick={() => setInput(ex)}
              className="text-left text-sm px-4 py-3 bg-gray-50 rounded-xl text-gray-600 hover:bg-gray-100 transition-colors"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>
      <div>
        <textarea
          ref={consultTextareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="例：低身長だけどロングコートをすっきり着たい。コンパクトに見えてしまうのが悩みです。"
          rows={4}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200 resize-none"
        />
      </div>
      <button onClick={handleConsult} disabled={loading || !input.trim()}
        className="w-full py-4 bg-gray-800 text-white rounded-xl text-sm hover:bg-gray-700 disabled:opacity-40 transition-colors"
      >
        {loading ? "回答を考えています..." : "相談する"}
      </button>
      {loading && (
        <div className="text-center py-10 text-gray-300">
          <div className="text-4xl mb-3 animate-pulse">🪞</div>
          <p className="text-sm">体型情報と診断結果をもとに考えています</p>
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-100 rounded-xl p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
      {result && !loading && (
        <div className="space-y-5">
          {/* 原因・方向性 */}
          <div className="bg-gray-800 text-white rounded-2xl p-5">
            <p className="text-xs tracking-widest text-gray-400 uppercase mb-2">Analysis</p>
            <p className="text-sm leading-relaxed">{result.analysis}</p>
          </div>
          {/* 最重要ポイント */}
          {result.keyPoints.length > 0 && (
            <div className="border border-gray-200 rounded-2xl p-5">
              <p className="text-xs tracking-widest text-gray-400 uppercase mb-3">Key Points</p>
              <ol className="space-y-2">
                {result.keyPoints.map((point, i) => (
                  <li key={i} className="flex gap-3 text-sm text-gray-700">
                    <span className="flex-shrink-0 w-5 h-5 bg-gray-800 text-white rounded-full flex items-center justify-center text-xs font-medium">{i + 1}</span>
                    <span className="leading-relaxed">{point}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {/* 調整項目 */}
          <div className="border border-gray-100 rounded-2xl p-5">
            <p className="text-xs tracking-widest text-gray-400 uppercase mb-4">Adjustments</p>
            <div className="space-y-3">
              {ADJUST_LABELS.map(({ key, label }) => result.adjustments[key] ? (
                <div key={key} className="flex gap-3">
                  <span className="flex-shrink-0 text-xs text-gray-400 w-20 pt-0.5">{label}</span>
                  <span className="text-sm text-gray-700 leading-relaxed">{result.adjustments[key]}</span>
                </div>
              ) : null)}
            </div>
          </div>
          {/* 避けること */}
          {result.avoidPoints.length > 0 && (
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5">
              <p className="text-xs tracking-widest text-amber-600 uppercase mb-3">Avoid</p>
              <ul className="space-y-1">
                {result.avoidPoints.map((point, i) => (
                  <li key={i} className="text-sm text-amber-800 flex gap-2">
                    <span className="flex-shrink-0">—</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {/* 好みへの配慮 */}
          {result.preferenceNote && (
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs text-gray-400 mb-1">好みを活かした配慮</p>
              <p className="text-sm text-gray-700">{result.preferenceNote}</p>
            </div>
          )}
          <button onClick={() => { setResult(null); setInput(""); }}
            className="w-full py-3 border border-gray-200 text-gray-500 rounded-xl text-sm hover:bg-gray-50 transition-colors"
          >
            別の相談をする
          </button>
        </div>
      )}
    </div>
  );
}

// ---- 保存履歴タブ ----
function SavedTab() {
  const [history, setHistory]         = useState<SavedCoordinate[]>([]);
  const [isLoading, setIsLoading]     = useState(true);

  useEffect(() => {
    fetch("/api/coordinate")
      .then((r) => r.json())
      .then((data: SavedCoordinate[]) => setHistory(data))
      .catch(() => setHistory([]))
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) return <div className="py-20 text-center text-gray-300 text-sm">読み込み中...</div>;

  if (history.length === 0) {
    return <p className="text-xs text-gray-400 py-10 text-center">保存済みのコーデはありません</p>;
  }

  return (
    <div className="space-y-2">
      {history.map((c) => (
        <div key={c.id} className="border border-gray-100 rounded-xl p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-400">{c.occasion ?? "—"}</span>
            <span className="text-xs text-gray-300">
              {new Date(c.created_at).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })}
            </span>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed">{c.color_story}</p>
        </div>
      ))}
    </div>
  );
}

// ---- メインページ ----
export default function StylePage() {
  const [activeTab, setActiveTab] = useState<StyleTab>("coordinate");

  const TABS: { value: StyleTab; label: string }[] = [
    { value: "coordinate", label: "コーデ提案" },
    { value: "consult",    label: "着こなし相談" },
    { value: "saved",      label: "保存履歴" },
  ];

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-lg mx-auto px-4 py-12">
        {/* ヘッダー */}
        <div className="mb-8">
          <p className="text-xs tracking-widest text-gray-400 uppercase mb-1">Style</p>
          <h1 className="text-2xl font-light text-gray-900">スタイルをつくる</h1>
        </div>
        {/* タブ */}
        <div className="flex border-b border-gray-100 mb-6">
          {TABS.map((tab) => (
            <button key={tab.value} onClick={() => setActiveTab(tab.value)}
              className={`flex-1 pb-3 text-sm transition-colors ${
                activeTab === tab.value
                  ? "text-gray-900 border-b-2 border-gray-800 font-medium"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {/* タブコンテンツ */}
        {activeTab === "coordinate" && <CoordinateTab />}
        {activeTab === "consult"    && <ConsultTab />}
        {activeTab === "saved"      && <SavedTab />}
      </div>
    </div>
  );
}
