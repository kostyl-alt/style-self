"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import CoordinateCard from "@/components/coordinate/CoordinateCard";
import ProductMatchList from "@/components/coordinate/ProductMatchList";
import { buildZozoSearchUrl } from "@/lib/utils/zozo-link";
import type {
  CoordinateGenerateResponse, WardrobeItem, StyleConsultResponse,
  LookAnalysisResponse, VirtualCoordinateResponse, VirtualConceptsResponse,
  VirtualConceptCandidate, ProductMatch, ProductMatchResponse,
} from "@/types/index";

const VIRTUAL_ROLE_LABELS: Record<string, { label: string; style: string }> = {
  base:   { label: "ベース",     style: "bg-gray-100 text-gray-500" },
  main:   { label: "メイン",     style: "bg-gray-800 text-white" },
  accent: { label: "アクセント", style: "bg-amber-100 text-amber-700" },
};

const VIRTUAL_CATEGORY_EMOJI: Record<string, string> = {
  tops: "👕", bottoms: "👖", outerwear: "🧥", jacket: "🥼",
  vest: "🦺", inner: "👚", dress: "👗", setup: "🩱",
  shoes: "👟", bags: "👜", accessories: "💍",
  hat: "🧢", jewelry: "📿", roomwear: "🏠", other: "🏷️",
};

const SEASON_EMOJI: Record<string, string> = {
  "春": "🌸", "夏": "☀️", "秋": "🍂", "冬": "❄️",
};

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
export function CoordinateTab() {
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
          <Link href="/outfit?tab=closet" className="inline-block px-5 py-2 bg-gray-800 text-white rounded-xl text-sm hover:bg-gray-700 transition-colors">
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

// ---- 理想のコーデタブ ----
type VirtualStage = "input" | "concepts" | "result";

export function VirtualTab() {
  const [stage, setStage]               = useState<VirtualStage>("input");
  const [scene, setScene]               = useState("カジュアル");
  const [conceptInput, setConceptInput] = useState("");
  const [concepts, setConcepts]         = useState<VirtualConceptCandidate[]>([]);
  const [season, setSeason]             = useState("");
  const [result, setResult]             = useState<VirtualCoordinateResponse | null>(null);
  const [isLoading, setIsLoading]       = useState(false);
  const [error, setError]               = useState<string | null>(null);

  function resetToInput() {
    setStage("input");
    setConcepts([]);
    setResult(null);
    setError(null);
  }

  async function handleStart() {
    setIsLoading(true); setError(null); setResult(null); setConcepts([]);
    const trimmedConcept = conceptInput.trim();
    try {
      if (trimmedConcept) {
        await generateCoordinate(trimmedConcept);
      } else {
        const res = await fetch("/api/ai/virtual-coordinate/concepts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scene }),
        });
        const data = await res.json() as VirtualConceptsResponse & { error?: string };
        if (!res.ok) throw new Error(data.error ?? "コンセプト候補の生成に失敗しました");
        setConcepts(data.concepts);
        setSeason(data.season);
        setStage("concepts");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成に失敗しました");
    } finally {
      setIsLoading(false);
    }
  }

  async function generateCoordinate(concept: string) {
    setIsLoading(true); setError(null);
    try {
      const res = await fetch("/api/ai/virtual-coordinate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scene, concept }),
      });
      const data = await res.json() as VirtualCoordinateResponse & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "理想コーデの生成に失敗しました");
      setResult(data);
      setSeason(data.season);
      setStage("result");
    } catch (err) {
      setError(err instanceof Error ? err.message : "理想コーデの生成に失敗しました");
    } finally {
      setIsLoading(false);
    }
  }

  const priorityIndex = result
    ? (() => {
        const idx = result.items.findIndex((it) => it.role === "main");
        return idx >= 0 ? idx : 0;
      })()
    : -1;

  if (stage === "input") {
    return (
      <div className="space-y-6">
        <div className="bg-gray-50 rounded-2xl p-4">
          <p className="text-xs text-gray-500 leading-relaxed">
            手持ち服がなくてもOK。診断結果と体型情報から、季節とシーンに合う理想のコーデを5アイテムで提案します。気に入ったアイテムは「ZOZOで探す」から購入できます。
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-3">シーンを選んでください</p>
          <div className="grid grid-cols-3 gap-3">
            {SCENES.map((s) => (
              <button key={s.value}
                onClick={() => setScene(s.value)}
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
        <div>
          <p className="text-xs text-gray-500 mb-2">コンセプト（任意）</p>
          <textarea
            value={conceptInput}
            onChange={(e) => setConceptInput(e.target.value)}
            placeholder="例：黒を中心にした静かな大人っぽさ／シンプルで動きやすい休日の服"
            rows={2}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200 resize-none"
          />
          <p className="text-xs text-gray-400 mt-1">未入力ならAIがコンセプト候補を3つ提案します</p>
        </div>
        <button onClick={handleStart} disabled={isLoading}
          className="w-full py-4 bg-gray-800 text-white rounded-xl text-sm hover:bg-gray-700 disabled:opacity-40 transition-colors"
        >
          {isLoading ? (conceptInput.trim() ? "理想のコーデを設計しています..." : "コンセプト候補を考えています...") : "理想のコーデを提案してもらう"}
        </button>
        {isLoading && (
          <div className="text-center py-10 text-gray-300">
            <div className="text-4xl mb-3 animate-pulse">✨</div>
            <p className="text-sm">あなたの体型・好みに合う理想を組み立てています</p>
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-4">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
      </div>
    );
  }

  if (stage === "concepts") {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full">
            {SEASON_EMOJI[season] ?? "🗓️"} {season} ｜ 日本（東京）
          </span>
          <span className="text-xs text-gray-400">シーン: {scene}</span>
        </div>
        <div>
          <p className="text-xs tracking-widest text-gray-400 uppercase mb-3">Choose a Concept</p>
          <p className="text-xs text-gray-500 mb-4">気になるコンセプトを選んでください。選んだ方向性で5アイテムを設計します。</p>
          <div className="space-y-3">
            {concepts.map((c, i) => (
              <button
                key={i}
                onClick={() => generateCoordinate(c.description ? `${c.title}（${c.description}）` : c.title)}
                disabled={isLoading}
                className="w-full text-left border border-gray-200 hover:border-gray-800 rounded-2xl p-5 transition-colors disabled:opacity-40"
              >
                <p className="text-sm font-medium text-gray-900 mb-1">{c.title}</p>
                {c.description && (
                  <p className="text-xs text-gray-500 leading-relaxed">{c.description}</p>
                )}
              </button>
            ))}
          </div>
        </div>
        {isLoading && (
          <div className="text-center py-6 text-gray-300">
            <div className="text-3xl mb-2 animate-pulse">✨</div>
            <p className="text-xs">選んだコンセプトでコーデを設計中</p>
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-4">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
        <button
          onClick={resetToInput}
          disabled={isLoading}
          className="w-full py-3 border border-gray-200 text-gray-500 rounded-xl text-sm hover:bg-gray-50 transition-colors disabled:opacity-40"
        >
          ← 戻る
        </button>
      </div>
    );
  }

  if (!result) return null;

  return <VirtualResult result={result} season={season} scene={scene} priorityIndex={priorityIndex} onReset={resetToInput} />;
}

function VirtualResult({
  result, season, scene, priorityIndex, onReset,
}: {
  result:        VirtualCoordinateResponse;
  season:        string;
  scene:         string;
  priorityIndex: number;
  onReset:       () => void;
}) {
  const [showInterpretation, setShowInterpretation] = useState(false);
  const ci = result.conceptInterpretation;

  const [matches, setMatches]             = useState<ProductMatch[] | null>(null);
  const [matchLoading, setMatchLoading]   = useState(false);

  useEffect(() => {
    if (!result.items?.length) return;
    setMatchLoading(true);
    const conceptKeywords = Array.from(new Set([
      ...(result.matchedRuleKeywords ?? []),
      ...(result.conceptInterpretation?.keywords ?? []),
    ]));
    const ngElements = result.conceptInterpretation?.ngElements ?? [];
    fetch("/api/products/match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: result.items, conceptKeywords, ngElements }),
    })
      .then((r) => r.json())
      .then((data: ProductMatchResponse) => setMatches(data.matches ?? []))
      .catch(() => setMatches([]))
      .finally(() => setMatchLoading(false));
  }, [result.items, result.matchedRuleKeywords, result.conceptInterpretation]);

  const interpretationHasContent =
    ci.keywords.length > 0 ||
    ci.recommendedColors.length > 0 ||
    ci.recommendedMaterials.length > 0 ||
    ci.recommendedSilhouettes.length > 0 ||
    ci.requiredAccessories.length > 0 ||
    ci.ngElements.length > 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full">
          {SEASON_EMOJI[season] ?? "🗓️"} {season} ｜ 日本（東京）
        </span>
        <span className="text-xs text-gray-400">シーン: {scene}</span>
        {result.conceptSource === "knowledge_base" && (
          <span className="text-xs px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full"
            title={`知識ベースの判断ルール: ${result.matchedRuleKeywords.join("・")}`}>
            📚 出典: {result.matchedRuleKeywords.slice(0, 2).join("・")}
            {result.matchedRuleKeywords.length > 2 ? ` 他${result.matchedRuleKeywords.length - 2}件` : ""}
          </span>
        )}
      </div>

      <div className="bg-gray-800 text-white rounded-2xl p-5">
        <p className="text-xs tracking-widest text-gray-400 uppercase mb-2">Concept</p>
        <p className="text-base leading-relaxed">{result.concept}</p>
        {result.whyThisCoordinate && (
          <p className="text-xs text-gray-300 mt-3 pt-3 border-t border-gray-700 leading-relaxed">{result.whyThisCoordinate}</p>
        )}
      </div>

      {interpretationHasContent && (
        <div className="border border-gray-100 rounded-2xl overflow-hidden">
          <button onClick={() => setShowInterpretation((v) => !v)}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
            <span className="text-xs tracking-widest text-gray-400 uppercase">Concept Interpretation</span>
            <span className="text-xs text-gray-400">{showInterpretation ? "閉じる ▲" : "開く ▼"}</span>
          </button>
          {showInterpretation && (
            <div className="px-5 pb-5 space-y-3 text-sm">
              {ci.keywords.length > 0 && <Row label="キーワード" value={ci.keywords.join("・")} />}
              {ci.emotion && <Row label="感情" value={ci.emotion} />}
              {ci.personaImage && <Row label="人物像" value={ci.personaImage} />}
              {ci.culture && <Row label="文化的文脈" value={ci.culture} />}
              {ci.era && <Row label="時代" value={ci.era} />}
              {ci.philosophy && <Row label="思想" value={ci.philosophy} />}
              {ci.recommendedColors.length > 0 && <Row label="推奨色" value={ci.recommendedColors.join("・")} top />}
              {ci.recommendedMaterials.length > 0 && <Row label="推奨素材" value={ci.recommendedMaterials.join("・")} />}
              {ci.recommendedSilhouettes.length > 0 && <Row label="推奨シルエット" value={ci.recommendedSilhouettes.join("・")} />}
              {ci.requiredAccessories.length > 0 && <Row label="必須の小物" value={ci.requiredAccessories.join("・")} />}
              {ci.ngElements.length > 0 && <Row label="NG要素" value={ci.ngElements.join("・")} amber />}
            </div>
          )}
        </div>
      )}

      {result.seasonNote && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
          <p className="text-xs text-blue-600 mb-1">{SEASON_EMOJI[season] ?? "🗓️"} 季節の考慮</p>
          <p className="text-sm text-blue-900 leading-relaxed">{result.seasonNote}</p>
        </div>
      )}

      <div className="space-y-3">
        <p className="text-xs tracking-widest text-gray-400 uppercase">Items</p>
        {result.items.map((item, i) => {
          const isPriority = i === priorityIndex;
          return (
            <div key={i} className={`rounded-2xl space-y-3 ${isPriority ? "bg-amber-50 border border-amber-200 p-5" : "border border-gray-100 p-4"}`}>
              {isPriority && (
                <p className="text-xs font-medium text-amber-700 flex items-center gap-1">
                  <span>⭐</span><span>まず買うべき1点</span>
                </p>
              )}
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-xl bg-white flex-shrink-0 flex items-center justify-center text-2xl">
                  {VIRTUAL_CATEGORY_EMOJI[item.category] ?? "🏷️"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full leading-none ${VIRTUAL_ROLE_LABELS[item.role]?.style ?? "bg-gray-100 text-gray-500"}`}>
                      {VIRTUAL_ROLE_LABELS[item.role]?.label ?? item.role}
                    </span>
                    {item.color && <span className="text-xs text-gray-400">{item.color}</span>}
                  </div>
                  <p className="text-sm text-gray-800 font-medium leading-tight">{item.name}</p>
                  {item.reason && <p className="text-xs text-gray-500 mt-1 leading-relaxed">→ {item.reason}</p>}
                </div>
              </div>
              {(item.sizeNote || item.materialNote || item.alternative) && (
                <div className="space-y-1 pt-2 border-t border-gray-100">
                  {item.sizeNote && <div className="text-xs text-gray-600 flex gap-2"><span>📏</span><span><span className="text-gray-400">サイズ：</span>{item.sizeNote}</span></div>}
                  {item.materialNote && <div className="text-xs text-gray-600 flex gap-2"><span>🧵</span><span><span className="text-gray-400">素材：</span>{item.materialNote}</span></div>}
                  {item.alternative && <div className="text-xs text-gray-600 flex gap-2"><span>🔄</span><span><span className="text-gray-400">代替：</span>{item.alternative}</span></div>}
                </div>
              )}
              <a href={buildZozoSearchUrl({ keyword: item.zozoKeyword || item.name })} target="_blank" rel="noopener noreferrer"
                className="inline-block text-xs text-gray-500 hover:text-gray-800 underline underline-offset-2">
                ZOZOで探す →
              </a>
              <ProductMatchList products={matches?.find((m) => m.itemIndex === i)?.products ?? []} isLoading={matchLoading} />
            </div>
          );
        })}
      </div>

      {result.stylingTips.length > 0 && (
        <div className="border border-gray-200 rounded-2xl p-5">
          <p className="text-xs tracking-widest text-gray-400 uppercase mb-3">Styling Tips</p>
          <ol className="space-y-2">
            {result.stylingTips.map((tip, i) => (
              <li key={i} className="flex gap-3 text-sm text-gray-700">
                <span className="flex-shrink-0 w-5 h-5 bg-gray-800 text-white rounded-full flex items-center justify-center text-xs font-medium">{i + 1}</span>
                <span className="leading-relaxed">{tip}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {result.ngExample && (
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5">
          <p className="text-xs tracking-widest text-amber-600 uppercase mb-2">NG Example</p>
          <p className="text-sm text-amber-800 leading-relaxed">{result.ngExample}</p>
        </div>
      )}

      <button onClick={onReset}
        className="w-full py-3 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50 transition-colors">
        別の理想コーデを提案してもらう
      </button>
    </div>
  );
}

function Row({ label, value, top, amber }: { label: string; value: string; top?: boolean; amber?: boolean }) {
  return (
    <div className={`flex gap-3 ${top ? "pt-2 border-t border-gray-100" : ""}`}>
      <span className={`flex-shrink-0 text-xs w-24 pt-0.5 ${amber ? "text-amber-600" : "text-gray-400"}`}>{label}</span>
      <span className={`leading-relaxed ${amber ? "text-amber-800" : "text-gray-700"}`}>{value}</span>
    </div>
  );
}

// ---- 着こなし相談タブ ----
export function ConsultTab() {
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState<StyleConsultResponse | null>(null);
  const [error, setError]       = useState<string | null>(null);

  const [lookFile, setLookFile]         = useState<File | null>(null);
  const [lookPreview, setLookPreview]   = useState<string | null>(null);
  const [lookLoading, setLookLoading]   = useState(false);
  const [lookResult, setLookResult]     = useState<LookAnalysisResponse | null>(null);
  const [lookError, setLookError]       = useState<string | null>(null);
  const lookInputRef = useRef<HTMLInputElement>(null);
  const consultTextareaRef = useRef<HTMLTextAreaElement>(null);

  function handleLookFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setLookError(null); setLookResult(null);
    if (!file) { setLookFile(null); setLookPreview(null); return; }
    if (file.size > 5 * 1024 * 1024) {
      setLookError("画像サイズは5MB以下にしてください");
      setLookFile(null); setLookPreview(null);
      if (lookInputRef.current) lookInputRef.current.value = "";
      return;
    }
    setLookFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setLookPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  function clearLookFile() {
    setLookFile(null); setLookPreview(null); setLookResult(null); setLookError(null);
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
        canvas.width = width; canvas.height = height;
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
      <div className="border border-gray-100 rounded-2xl p-5 space-y-4">
        <div>
          <p className="text-xs tracking-widest text-gray-400 uppercase mb-1">Reference Photo</p>
          <p className="text-xs text-gray-500">参考にしたい人の写真から比率・シルエットを分析します（顔は分析対象外）</p>
        </div>
        {!lookPreview ? (
          <button type="button" onClick={() => lookInputRef.current?.click()}
            className="w-full py-8 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors">
            📷 写真を選ぶ（5MBまで）
          </button>
        ) : (
          <div className="space-y-3">
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={lookPreview} alt="参考写真" className="w-full max-h-80 object-contain rounded-xl bg-gray-50" />
              <button type="button" onClick={clearLookFile}
                className="absolute top-2 right-2 w-8 h-8 bg-white/90 border border-gray-200 rounded-full text-gray-500 hover:bg-white hover:text-gray-800 transition-colors text-sm">×</button>
            </div>
            <button type="button" onClick={handleAnalyzeLook} disabled={lookLoading}
              className="w-full py-3 bg-gray-800 text-white rounded-xl text-sm hover:bg-gray-700 disabled:opacity-40 transition-colors">
              {lookLoading ? "分析しています..." : "この写真を分析する"}
            </button>
          </div>
        )}
        <input ref={lookInputRef} type="file" accept="image/*" onChange={handleLookFileChange} className="hidden" />
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
                  <ul className="space-y-2">
                    {lookResult.personalAdaptation.itemsToFind.map((it, i) => (
                      <li key={i} className="flex items-start justify-between gap-3">
                        <div className="text-sm text-gray-700 flex gap-2 flex-1 min-w-0"><span className="text-gray-400 flex-shrink-0">•</span><span className="leading-relaxed">{it}</span></div>
                        <a href={buildZozoSearchUrl({ keyword: it })} target="_blank" rel="noopener noreferrer"
                          className="flex-shrink-0 text-xs text-gray-500 hover:text-gray-800 underline underline-offset-2 whitespace-nowrap pt-0.5">ZOZOで探す →</a>
                      </li>
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
            <button type="button" onClick={useAnalysisInConsultation}
              className="w-full py-3 border border-gray-800 text-gray-800 rounded-xl text-sm hover:bg-gray-800 hover:text-white transition-colors">
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
              className="text-left text-sm px-4 py-3 bg-gray-50 rounded-xl text-gray-600 hover:bg-gray-100 transition-colors">
              {ex}
            </button>
          ))}
        </div>
      </div>
      <div>
        <textarea ref={consultTextareaRef} value={input} onChange={(e) => setInput(e.target.value)}
          placeholder="例：低身長だけどロングコートをすっきり着たい。コンパクトに見えてしまうのが悩みです。"
          rows={4}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200 resize-none" />
      </div>
      <button onClick={handleConsult} disabled={loading || !input.trim()}
        className="w-full py-4 bg-gray-800 text-white rounded-xl text-sm hover:bg-gray-700 disabled:opacity-40 transition-colors">
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
          <div className="bg-gray-800 text-white rounded-2xl p-5">
            <p className="text-xs tracking-widest text-gray-400 uppercase mb-2">Analysis</p>
            <p className="text-sm leading-relaxed">{result.analysis}</p>
          </div>
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
          {result.itemsToFind.length > 0 && (
            <div className="border border-gray-200 rounded-2xl p-5">
              <p className="text-xs tracking-widest text-gray-400 uppercase mb-3">Items to Find</p>
              <ul className="space-y-2">
                {result.itemsToFind.map((it, i) => (
                  <li key={i} className="flex items-start justify-between gap-3">
                    <div className="text-sm text-gray-700 flex gap-2 flex-1 min-w-0">
                      <span className="text-gray-400 flex-shrink-0">•</span>
                      <span className="leading-relaxed">{it}</span>
                    </div>
                    <a href={buildZozoSearchUrl({ keyword: it })} target="_blank" rel="noopener noreferrer"
                      className="flex-shrink-0 text-xs text-gray-500 hover:text-gray-800 underline underline-offset-2 whitespace-nowrap pt-0.5">ZOZOで探す →</a>
                  </li>
                ))}
              </ul>
            </div>
          )}
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
          {result.preferenceNote && (
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs text-gray-400 mb-1">好みを活かした配慮</p>
              <p className="text-sm text-gray-700">{result.preferenceNote}</p>
            </div>
          )}
          <button onClick={() => { setResult(null); setInput(""); }}
            className="w-full py-3 border border-gray-200 text-gray-500 rounded-xl text-sm hover:bg-gray-50 transition-colors">
            別の相談をする
          </button>
        </div>
      )}
    </div>
  );
}

// ---- 保存履歴タブ（list-only） ----
export function SavedTab() {
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
  if (history.length === 0) return <p className="text-xs text-gray-400 py-10 text-center">保存済みのコーデはありません</p>;

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
