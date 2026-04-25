"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import type {
  BodyInfo, BodyType, BodyTendency, WeightCenter, ShoulderWidth,
  UpperBodyThickness, MuscleType, LegLength, PreferredFit, StyleImpression, BodyPart,
  Worldview, StyleDiagnosisResult,
} from "@/types/index";

// ---- 型 ----

type SelfTab = "diagnosis" | "body" | "worldview";

// ---- 身体情報の選択肢 ----

const BODY_TYPES: { value: BodyType; label: string; desc: string }[] = [
  { value: "straight", label: "ストレート", desc: "筋肉質・ハリ感・上重心が特徴" },
  { value: "wave",     label: "ウェーブ",   desc: "華奢・曲線的・下重心が特徴" },
  { value: "natural",  label: "ナチュラル", desc: "骨感・関節が目立つ・フレーム大きめ" },
  { value: "unknown",  label: "わからない", desc: "" },
];
const BODY_TENDENCIES: { value: BodyTendency; label: string }[] = [
  { value: "upper",    label: "上半身強め" },
  { value: "lower",    label: "下半身強め" },
  { value: "balanced", label: "バランス型" },
  { value: "slim",     label: "細身" },
  { value: "solid",    label: "がっしり" },
];
const WEIGHT_CENTERS: { value: WeightCenter; label: string; desc: string }[] = [
  { value: "upper",    label: "上重心", desc: "肩・胸まわりにボリュームがある" },
  { value: "lower",    label: "下重心", desc: "腰・太ももにボリュームがある" },
  { value: "balanced", label: "バランス", desc: "上下のボリュームが均等" },
];
const SHOULDER_WIDTHS: { value: ShoulderWidth; label: string; desc: string }[] = [
  { value: "wide",   label: "広め", desc: "肩幅が顔幅より広い" },
  { value: "normal", label: "普通", desc: "顔幅と肩幅がほぼ同じ" },
  { value: "narrow", label: "狭め", desc: "肩幅が顔幅より狭い" },
];
const UPPER_BODY_THICKNESSES: { value: UpperBodyThickness; label: string }[] = [
  { value: "thin",   label: "薄め" },
  { value: "normal", label: "普通" },
  { value: "thick",  label: "厚め" },
];
const MUSCLE_TYPES: { value: MuscleType; label: string }[] = [
  { value: "slim",     label: "細身" },
  { value: "standard", label: "標準" },
  { value: "muscular", label: "筋肉質" },
  { value: "solid",    label: "しっかり体型" },
];
const LEG_LENGTHS: { value: LegLength; label: string }[] = [
  { value: "long",   label: "長め" },
  { value: "normal", label: "普通" },
  { value: "short",  label: "短め" },
];
const PREFERRED_FITS: { value: PreferredFit; label: string; desc: string }[] = [
  { value: "tight",     label: "タイト",        desc: "体のラインに沿う" },
  { value: "just",      label: "ジャスト",       desc: "ほどよくフィット" },
  { value: "relaxed",   label: "ややリラックス", desc: "少しゆとりあり" },
  { value: "oversized", label: "オーバーサイズ", desc: "大きめ・余裕あり" },
];
const STYLE_IMPRESSIONS: { value: StyleImpression; label: string }[] = [
  { value: "sharp",    label: "シャープ" },
  { value: "neutral",  label: "中性的" },
  { value: "soft",     label: "柔らかい" },
  { value: "presence", label: "存在感" },
];
const BODY_PARTS: { value: BodyPart; label: string }[] = [
  { value: "shoulder", label: "肩" },
  { value: "chest",    label: "胸" },
  { value: "waist",    label: "ウエスト" },
  { value: "legs",     label: "脚" },
  { value: "hip",      label: "ヒップ" },
];

// ---- 世界観の選択肢 ----

const IMPRESSION_OPTIONS = [
  "知性", "余白", "意図", "静けさ", "緊張感", "存在感",
  "構造美", "清潔感", "力強さ", "繊細さ", "自由", "哲学",
  "都会的", "自然体", "洗練", "個性的",
];
const AVOID_OPTIONS = [
  "派手", "過剰な主張", "カジュアルすぎる", "甘すぎる",
  "フォーマルすぎる", "トレンド重視", "ロゴ過多", "装飾過多",
];
const EMPTY_WORLDVIEW: Worldview = {
  beliefs: [], targetPersona: "", stylePhilosophy: "",
  desiredImpression: [], avoidImpression: [],
};

// ---- 共通UIコンポーネント ----

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-xs tracking-widest text-gray-400 uppercase">{title}</h2>
        {hint && <span className="text-xs text-gray-400">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
function ChoiceButton({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`text-left px-3 py-2.5 rounded-xl border text-sm transition-colors ${
        selected ? "border-gray-800 bg-gray-800 text-white" : "border-gray-200 text-gray-700 hover:border-gray-300"
      }`}>
      {children}
    </button>
  );
}
function PillButton({ selected, onClick, children, className = "" }: { selected: boolean; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button onClick={onClick}
      className={`px-3 py-1.5 rounded-full border text-sm transition-colors ${
        selected ? "border-gray-800 bg-gray-800 text-white" : "border-gray-200 text-gray-600 hover:border-gray-300"
      } ${className}`}>
      {children}
    </button>
  );
}

// ---- 世界観診断タブ ----

function DiagnosisTab() {
  const [analysis, setAnalysis] = useState<StyleDiagnosisResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { setLoading(false); return; }
      const { data: row } = await supabase
        .from("users")
        .select("style_analysis")
        .eq("id", data.user.id)
        .single() as unknown as { data: { style_analysis: unknown } | null };
      if (row?.style_analysis) {
        setAnalysis(row.style_analysis as StyleDiagnosisResult);
      }
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="py-20 text-center text-gray-300 text-sm">読み込み中...</div>;

  if (!analysis) {
    return (
      <div className="py-16 text-center space-y-4">
        <p className="text-4xl">🌐</p>
        <p className="text-sm font-medium text-gray-700">まだ世界観診断を行っていません</p>
        <p className="text-xs text-gray-400">9つの質問に答えて、あなただけのスタイル軸を言語化しましょう</p>
        <Link
          href="/onboarding"
          className="inline-block mt-2 px-6 py-3 bg-gray-800 text-white rounded-xl text-sm hover:bg-gray-700 transition-colors"
        >
          診断をはじめる →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 py-4">
      {/* Plain Summary */}
      <div className="bg-gray-50 rounded-2xl p-5">
        <p className="text-xs tracking-widest text-gray-400 uppercase mb-3">Plain Summary</p>
        <p className="text-sm text-gray-800 leading-relaxed">{analysis.plainSummary}</p>
      </div>

      {/* Core Identity */}
      <div className="text-center py-6 border-b border-gray-100">
        <p className="text-xs tracking-widest text-gray-300 uppercase mb-3">Core Identity</p>
        <h2 className="text-xl font-light text-gray-900 leading-relaxed">{analysis.coreIdentity}</h2>
      </div>

      {/* Style Structure */}
      <div>
        <p className="text-xs tracking-widest text-gray-400 uppercase mb-3">Style Structure</p>
        <div className="grid grid-cols-2 gap-2">
          {([
            ["色", analysis.styleStructure.color],
            ["線", analysis.styleStructure.line],
            ["素材", analysis.styleStructure.material],
            ["密度", analysis.styleStructure.density],
            ["シルエット", analysis.styleStructure.silhouette],
            ["視線", analysis.styleStructure.gaze],
          ] as [string, string][]).map(([label, value]) => (
            <div key={label} className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-0.5">{label}</p>
              <p className="text-xs text-gray-700 leading-snug">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Belief Keywords */}
      {analysis.styleAxis?.beliefKeywords && analysis.styleAxis.beliefKeywords.length > 0 && (
        <div>
          <p className="text-xs tracking-widest text-gray-400 uppercase mb-3">Style Keywords</p>
          <div className="flex flex-wrap gap-2">
            {analysis.styleAxis.beliefKeywords.map((kw) => (
              <span key={kw} className="px-3 py-1 bg-gray-800 text-white text-xs rounded-full">{kw}</span>
            ))}
          </div>
        </div>
      )}

      <Link
        href="/onboarding"
        className="block w-full py-3 border border-gray-200 text-gray-500 text-center rounded-xl text-sm hover:border-gray-400 hover:text-gray-700 transition-colors"
      >
        再診断する
      </Link>
    </div>
  );
}

// ---- 身体情報タブ ----

function BodyTab() {
  const [height,              setHeight]              = useState("");
  const [weight,              setWeight]              = useState("");
  const [bodyType,            setBodyType]            = useState<BodyType | "">("");
  const [bodyTendency,        setBodyTendency]        = useState<BodyTendency | "">("");
  const [weightCenter,        setWeightCenter]        = useState<WeightCenter | "">("");
  const [shoulderWidth,       setShoulderWidth]       = useState<ShoulderWidth | "">("");
  const [upperBodyThickness,  setUpperBodyThickness]  = useState<UpperBodyThickness | "">("");
  const [muscleType,          setMuscleType]          = useState<MuscleType | "">("");
  const [legLength,           setLegLength]           = useState<LegLength | "">("");
  const [preferredFit,        setPreferredFit]        = useState<PreferredFit | "">("");
  const [styleImpression,     setStyleImpression]     = useState<StyleImpression | "">("");
  const [emphasizeParts,      setEmphasizeParts]      = useState<BodyPart[]>([]);
  const [hideParts,           setHideParts]           = useState<BodyPart[]>([]);
  const [fitRecommendation,   setFitRecommendation]   = useState<string | null>(null);
  const [fitReasoning,        setFitReasoning]        = useState<string | null>(null);
  const [generatingFit,       setGeneratingFit]       = useState(false);
  const [loading,             setLoading]             = useState(true);
  const [saving,              setSaving]              = useState(false);
  const [saved,               setSaved]               = useState(false);
  const [error,               setError]               = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((data: { bodyInfo: BodyInfo }) => {
        const b = data.bodyInfo;
        setHeight(b.height != null ? String(b.height) : "");
        setWeight(b.weight != null ? String(b.weight) : "");
        setBodyType(b.bodyType ?? "");
        setBodyTendency(b.bodyTendency ?? "");
        setWeightCenter(b.weightCenter ?? "");
        setShoulderWidth(b.shoulderWidth ?? "");
        setUpperBodyThickness(b.upperBodyThickness ?? "");
        setMuscleType(b.muscleType ?? "");
        setLegLength(b.legLength ?? "");
        setPreferredFit(b.preferredFit ?? "");
        setStyleImpression(b.styleImpression ?? "");
        setEmphasizeParts(b.emphasizeParts ?? []);
        setHideParts(b.hideParts ?? []);
        setFitRecommendation(b.fitRecommendation ?? null);
      })
      .catch(() => setError("プロフィールの読み込みに失敗しました"))
      .finally(() => setLoading(false));
  }, []);

  function togglePart(parts: BodyPart[], setter: (v: BodyPart[]) => void, part: BodyPart) {
    setter(parts.includes(part) ? parts.filter((p) => p !== part) : [...parts, part]);
  }

  async function handleSave() {
    setSaving(true); setSaved(false); setError(null);
    try {
      const bodyInfo: Partial<BodyInfo> = {
        height: height ? parseInt(height, 10) : null,
        weight: weight ? parseInt(weight, 10) : null,
        bodyType: bodyType || null, bodyTendency: bodyTendency || null,
        weightCenter: weightCenter || null, shoulderWidth: shoulderWidth || null,
        upperBodyThickness: upperBodyThickness || null, muscleType: muscleType || null,
        legLength: legLength || null, preferredFit: preferredFit || null,
        styleImpression: styleImpression || null, emphasizeParts, hideParts,
      };
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bodyInfo }),
      });
      if (!res.ok) { const d = await res.json() as { error: string }; throw new Error(d.error); }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      setGeneratingFit(true);
      setFitRecommendation(null); setFitReasoning(null);
      const fitRes = await fetch("/api/ai/profile-fit", { method: "POST" });
      if (fitRes.ok) {
        const fitData = await fitRes.json() as { fitRecommendation: string; reasoning: string };
        setFitRecommendation(fitData.fitRecommendation);
        setFitReasoning(fitData.reasoning);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally { setSaving(false); setGeneratingFit(false); }
  }

  if (loading) return <div className="py-20 text-center text-gray-300 text-sm">読み込み中...</div>;

  return (
    <div className="space-y-4 py-4">
      <Section title="サイズ">
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm text-gray-600 mb-1.5">身長（cm）</label>
            <input type="number" value={height} onChange={(e) => setHeight(e.target.value)}
              placeholder="例: 163"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200" />
          </div>
          <div className="flex-1">
            <label className="block text-sm text-gray-600 mb-1.5">体重<span className="text-gray-400 text-xs ml-1">任意</span></label>
            <input type="number" value={weight} onChange={(e) => setWeight(e.target.value)}
              placeholder="例: 52"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200" />
          </div>
        </div>
      </Section>
      <Section title="骨格タイプ">
        <div className="grid grid-cols-2 gap-2">
          {BODY_TYPES.map((t) => (
            <ChoiceButton key={t.value} selected={bodyType === t.value} onClick={() => setBodyType(t.value)}>
              <span className="font-medium">{t.label}</span>
              {t.desc && <span className="block text-xs mt-0.5 opacity-70">{t.desc}</span>}
            </ChoiceButton>
          ))}
        </div>
      </Section>
      <Section title="体型傾向">
        <div className="flex flex-wrap gap-2">
          {BODY_TENDENCIES.map((t) => (
            <PillButton key={t.value} selected={bodyTendency === t.value} onClick={() => setBodyTendency(t.value)}>{t.label}</PillButton>
          ))}
        </div>
      </Section>
      <Section title="重心">
        <div className="grid grid-cols-3 gap-2">
          {WEIGHT_CENTERS.map((t) => (
            <ChoiceButton key={t.value} selected={weightCenter === t.value} onClick={() => setWeightCenter(t.value)}>
              <span className="font-medium">{t.label}</span>
              <span className="block text-xs mt-0.5 opacity-70">{t.desc}</span>
            </ChoiceButton>
          ))}
        </div>
      </Section>
      <Section title="肩幅">
        <div className="grid grid-cols-3 gap-2">
          {SHOULDER_WIDTHS.map((t) => (
            <ChoiceButton key={t.value} selected={shoulderWidth === t.value} onClick={() => setShoulderWidth(t.value)}>
              <span className="font-medium">{t.label}</span>
              <span className="block text-xs mt-0.5 opacity-70">{t.desc}</span>
            </ChoiceButton>
          ))}
        </div>
      </Section>
      <Section title="上半身の厚み">
        <div className="flex gap-2">
          {UPPER_BODY_THICKNESSES.map((t) => (
            <PillButton key={t.value} selected={upperBodyThickness === t.value} onClick={() => setUpperBodyThickness(t.value)} className="flex-1 text-center">{t.label}</PillButton>
          ))}
        </div>
      </Section>
      <Section title="筋肉感・肉付き">
        <div className="flex flex-wrap gap-2">
          {MUSCLE_TYPES.map((t) => (
            <PillButton key={t.value} selected={muscleType === t.value} onClick={() => setMuscleType(t.value)}>{t.label}</PillButton>
          ))}
        </div>
      </Section>
      <Section title="脚の見え方">
        <div className="flex gap-2">
          {LEG_LENGTHS.map((t) => (
            <PillButton key={t.value} selected={legLength === t.value} onClick={() => setLegLength(t.value)} className="flex-1 text-center">{t.label}</PillButton>
          ))}
        </div>
      </Section>
      <Section title="目指すサイズ感">
        <div className="grid grid-cols-2 gap-2">
          {PREFERRED_FITS.map((t) => (
            <ChoiceButton key={t.value} selected={preferredFit === t.value} onClick={() => setPreferredFit(t.value)}>
              <span className="font-medium">{t.label}</span>
              <span className="block text-xs mt-0.5 opacity-70">{t.desc}</span>
            </ChoiceButton>
          ))}
        </div>
      </Section>
      <Section title="見せたい印象">
        <div className="flex flex-wrap gap-2">
          {STYLE_IMPRESSIONS.map((t) => (
            <PillButton key={t.value} selected={styleImpression === t.value} onClick={() => setStyleImpression(t.value)}>{t.label}</PillButton>
          ))}
        </div>
      </Section>
      <Section title="強調したい部位" hint="複数選択可">
        <div className="flex flex-wrap gap-2">
          {BODY_PARTS.map((t) => (
            <PillButton key={t.value} selected={emphasizeParts.includes(t.value)}
              onClick={() => togglePart(emphasizeParts, setEmphasizeParts, t.value)}>{t.label}</PillButton>
          ))}
        </div>
      </Section>
      <Section title="隠したい部位" hint="複数選択可">
        <div className="flex flex-wrap gap-2">
          {BODY_PARTS.map((t) => (
            <PillButton key={t.value} selected={hideParts.includes(t.value)}
              onClick={() => togglePart(hideParts, setHideParts, t.value)}>{t.label}</PillButton>
          ))}
        </div>
      </Section>
      {error && <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3">{error}</p>}
      <button
        onClick={handleSave} disabled={saving || generatingFit}
        className={`w-full py-3.5 rounded-xl text-sm font-medium transition-colors ${
          saved ? "bg-gray-100 text-gray-500 cursor-default" : "bg-gray-800 text-white hover:bg-gray-700 disabled:opacity-40"
        }`}
      >
        {saved ? "保存しました ✓" : saving ? "保存中..." : generatingFit ? "AI推奨を生成中..." : "保存する"}
      </button>
      {(fitRecommendation || generatingFit) && (
        <div className="bg-gray-800 text-white rounded-2xl p-5 space-y-2">
          <p className="text-xs tracking-widest text-gray-400 uppercase">AI Fit Recommendation</p>
          {generatingFit ? (
            <p className="text-sm text-gray-400 animate-pulse">世界観と身体情報から推奨サイズ感を生成中...</p>
          ) : (
            <>
              <p className="text-sm leading-relaxed">{fitRecommendation}</p>
              {fitReasoning && <p className="text-xs text-gray-400 leading-relaxed border-t border-gray-700 pt-2 mt-2">{fitReasoning}</p>}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ---- 世界観編集タブ ----

function WorldviewTab() {
  const [worldview,   setWorldview]   = useState<Worldview>(EMPTY_WORLDVIEW);
  const [beliefInput, setBeliefInput] = useState("");
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [saved,       setSaved]       = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/worldview")
      .then((r) => r.json())
      .then((data: { worldview: Worldview | null }) => {
        if (data.worldview) setWorldview({ ...EMPTY_WORLDVIEW, ...data.worldview });
      })
      .catch(() => setError("世界観の読み込みに失敗しました"))
      .finally(() => setLoading(false));
  }, []);

  function addBelief() {
    const trimmed = beliefInput.trim();
    if (!trimmed || worldview.beliefs.includes(trimmed)) return;
    setWorldview((w) => ({ ...w, beliefs: [...w.beliefs, trimmed] }));
    setBeliefInput("");
  }
  function removeBelief(b: string) {
    setWorldview((w) => ({ ...w, beliefs: w.beliefs.filter((x) => x !== b) }));
  }
  function toggleImpression(key: "desiredImpression" | "avoidImpression", value: string) {
    setWorldview((w) => {
      const current = w[key];
      return { ...w, [key]: current.includes(value) ? current.filter((x) => x !== value) : [...current, value] };
    });
  }

  async function handleSave() {
    setSaving(true); setSaved(false); setError(null);
    try {
      const res = await fetch("/api/worldview", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ worldview }),
      });
      if (!res.ok) { const d = await res.json() as { error: string }; throw new Error(d.error); }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally { setSaving(false); }
  }

  if (loading) return <div className="py-20 text-center text-gray-300 text-sm">読み込み中...</div>;

  return (
    <div className="space-y-4 py-4">
      <Section title="信念キーワード" hint="Enterで追加">
        <div className="flex gap-2">
          <input type="text" value={beliefInput} onChange={(e) => setBeliefInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addBelief(); } }}
            placeholder="例: 余白を大切にする"
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200" />
          <button onClick={addBelief}
            className="px-4 py-2 bg-gray-800 text-white rounded-xl text-sm hover:bg-gray-700 transition-colors">追加</button>
        </div>
        {worldview.beliefs.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {worldview.beliefs.map((b) => (
              <span key={b} className="flex items-center gap-1.5 px-3 py-1 bg-gray-800 text-white text-sm rounded-full">
                {b}
                <button onClick={() => removeBelief(b)} className="text-gray-400 hover:text-white text-xs leading-none">×</button>
              </span>
            ))}
          </div>
        )}
      </Section>
      <Section title="目指したい人物像">
        <input type="text" value={worldview.targetPersona}
          onChange={(e) => setWorldview((w) => ({ ...w, targetPersona: e.target.value }))}
          placeholder="例: 建築家のような静けさを持つ人"
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200" />
      </Section>
      <Section title="ファッション哲学" hint="自由記述">
        <textarea value={worldview.stylePhilosophy}
          onChange={(e) => setWorldview((w) => ({ ...w, stylePhilosophy: e.target.value }))}
          placeholder="例: 服は自己表現ではなく、環境との対話である"
          rows={3}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200 resize-none" />
      </Section>
      <Section title="与えたい印象" hint="複数選択可">
        <div className="flex flex-wrap gap-2">
          {IMPRESSION_OPTIONS.map((opt) => (
            <button key={opt} onClick={() => toggleImpression("desiredImpression", opt)}
              className={`px-3 py-1.5 rounded-full border text-sm transition-colors ${
                worldview.desiredImpression.includes(opt)
                  ? "border-gray-800 bg-gray-800 text-white" : "border-gray-200 text-gray-600 hover:border-gray-300"
              }`}>{opt}</button>
          ))}
        </div>
      </Section>
      <Section title="避けたい印象" hint="複数選択可">
        <div className="flex flex-wrap gap-2">
          {AVOID_OPTIONS.map((opt) => (
            <button key={opt} onClick={() => toggleImpression("avoidImpression", opt)}
              className={`px-3 py-1.5 rounded-full border text-sm transition-colors ${
                worldview.avoidImpression.includes(opt)
                  ? "border-red-500 bg-red-50 text-red-600" : "border-gray-200 text-gray-600 hover:border-gray-300"
              }`}>{opt}</button>
          ))}
        </div>
      </Section>
      {error && <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3">{error}</p>}
      <button onClick={handleSave} disabled={saving}
        className={`w-full py-3.5 rounded-xl text-sm font-medium transition-colors ${
          saved ? "bg-gray-100 text-gray-500 cursor-default" : "bg-gray-800 text-white hover:bg-gray-700 disabled:opacity-40"
        }`}>
        {saved ? "保存しました ✓" : saving ? "保存中..." : "世界観を保存する"}
      </button>
      {(worldview.beliefs.length > 0 || worldview.stylePhilosophy) && (
        <div className="bg-gray-800 text-white rounded-2xl p-5 space-y-3">
          <p className="text-xs tracking-widest text-gray-400 uppercase">Your Worldview</p>
          {worldview.beliefs.length > 0 && (
            <p className="text-sm leading-relaxed">{worldview.beliefs.join(" / ")}</p>
          )}
          {worldview.stylePhilosophy && (
            <p className="text-xs text-gray-400 leading-relaxed border-t border-gray-700 pt-3">{worldview.stylePhilosophy}</p>
          )}
          {worldview.desiredImpression.length > 0 && (
            <p className="text-xs text-gray-400">目指す印象: {worldview.desiredImpression.join("・")}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ---- メインページ ----

const TABS: { value: SelfTab; label: string }[] = [
  { value: "diagnosis", label: "世界観診断" },
  { value: "body",      label: "身体情報" },
  { value: "worldview", label: "世界観編集" },
];

export default function SelfPage() {
  const [activeTab, setActiveTab] = useState<SelfTab>("diagnosis");

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="mb-6">
          <p className="text-xs tracking-widest text-gray-400 uppercase mb-1">Self</p>
          <h1 className="text-2xl font-light text-gray-900">あなたの世界観</h1>
        </div>

        {/* タブ */}
        <div className="flex gap-1 bg-white border border-gray-100 rounded-xl p-1 mb-2">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                activeTab === tab.value
                  ? "bg-gray-800 text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "diagnosis" && <DiagnosisTab />}
        {activeTab === "body"      && <BodyTab />}
        {activeTab === "worldview" && <WorldviewTab />}
      </div>
    </div>
  );
}
