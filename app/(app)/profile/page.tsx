"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type {
  BodyInfo, BodyType, BodyTendency, WeightCenter, ShoulderWidth,
  UpperBodyThickness, MuscleType, LegLength, PreferredFit, StyleImpression, BodyPart,
} from "@/types/index";

// ---- 選択肢定義 ----

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

// ---- ページコンポーネント ----

export default function ProfilePage() {
  // 基本情報
  const [height,        setHeight]        = useState("");
  const [weight,        setWeight]        = useState("");
  const [bodyType,      setBodyType]      = useState<BodyType | "">("");
  const [bodyTendency,  setBodyTendency]  = useState<BodyTendency | "">("");
  const [weightCenter,  setWeightCenter]  = useState<WeightCenter | "">("");
  const [shoulderWidth, setShoulderWidth] = useState<ShoulderWidth | "">("");
  // 詳細情報
  const [upperBodyThickness, setUpperBodyThickness] = useState<UpperBodyThickness | "">("");
  const [muscleType,         setMuscleType]         = useState<MuscleType | "">("");
  const [legLength,          setLegLength]           = useState<LegLength | "">("");
  const [preferredFit,       setPreferredFit]        = useState<PreferredFit | "">("");
  const [styleImpression,    setStyleImpression]     = useState<StyleImpression | "">("");
  const [emphasizeParts,     setEmphasizeParts]      = useState<BodyPart[]>([]);
  const [hideParts,          setHideParts]           = useState<BodyPart[]>([]);
  // AI推奨
  const [fitRecommendation, setFitRecommendation] = useState<string | null>(null);
  const [fitReasoning,      setFitReasoning]      = useState<string | null>(null);
  const [generatingFit,     setGeneratingFit]     = useState(false);
  // UI状態
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [error,   setError]   = useState<string | null>(null);

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
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const bodyInfo: Partial<BodyInfo> = {
        height:             height ? parseInt(height, 10) : null,
        weight:             weight ? parseInt(weight, 10) : null,
        bodyType:           bodyType           || null,
        bodyTendency:       bodyTendency       || null,
        weightCenter:       weightCenter       || null,
        shoulderWidth:      shoulderWidth      || null,
        upperBodyThickness: upperBodyThickness || null,
        muscleType:         muscleType         || null,
        legLength:          legLength          || null,
        preferredFit:       preferredFit       || null,
        styleImpression:    styleImpression    || null,
        emphasizeParts,
        hideParts,
      };

      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bodyInfo }),
      });
      if (!res.ok) {
        const data = await res.json() as { error: string };
        throw new Error(data.error);
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);

      // 保存後にAI推奨を自動生成
      setGeneratingFit(true);
      setFitRecommendation(null);
      setFitReasoning(null);
      const fitRes = await fetch("/api/ai/profile-fit", { method: "POST" });
      if (fitRes.ok) {
        const fitData = await fitRes.json() as { fitRecommendation: string; reasoning: string };
        setFitRecommendation(fitData.fitRecommendation);
        setFitReasoning(fitData.reasoning);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setSaving(false);
      setGeneratingFit(false);
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">読み込み中...</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">プロフィール</h1>
            <p className="text-sm text-gray-500 mt-1">身体情報を登録するとコーデ提案の精度が上がります</p>
          </div>
          <Link
            href="/onboarding"
            className="text-xs text-gray-400 hover:text-gray-700 underline underline-offset-2 transition-colors mt-1"
          >
            スタイル診断を更新する
          </Link>
        </div>

        {/* ---- サイズ ---- */}
        <Section title="サイズ">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm text-gray-600 mb-1.5">身長（cm）</label>
              <input type="number" value={height} onChange={(e) => setHeight(e.target.value)}
                placeholder="例: 163"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200" />
            </div>
            <div className="flex-1">
              <label className="block text-sm text-gray-600 mb-1.5">
                体重<span className="text-gray-400 text-xs ml-1">提案精度補助・任意</span>
              </label>
              <input type="number" value={weight} onChange={(e) => setWeight(e.target.value)}
                placeholder="例: 52"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200" />
              <p className="text-xs text-gray-400 mt-1">筋肉量・骨格差があるため体重のみでは判断しません</p>
            </div>
          </div>
        </Section>

        {/* ---- 骨格タイプ ---- */}
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

        {/* ---- 体型傾向 ---- */}
        <Section title="体型傾向">
          <div className="flex flex-wrap gap-2">
            {BODY_TENDENCIES.map((t) => (
              <PillButton key={t.value} selected={bodyTendency === t.value} onClick={() => setBodyTendency(t.value)}>
                {t.label}
              </PillButton>
            ))}
          </div>
        </Section>

        {/* ---- 重心 ---- */}
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

        {/* ---- 肩幅 ---- */}
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

        {/* ---- 上半身の厚み ---- */}
        <Section title="上半身の厚み">
          <div className="flex gap-2">
            {UPPER_BODY_THICKNESSES.map((t) => (
              <PillButton key={t.value} selected={upperBodyThickness === t.value} onClick={() => setUpperBodyThickness(t.value)} className="flex-1 text-center">
                {t.label}
              </PillButton>
            ))}
          </div>
        </Section>

        {/* ---- 筋肉感・肉付き ---- */}
        <Section title="筋肉感・肉付き">
          <div className="flex flex-wrap gap-2">
            {MUSCLE_TYPES.map((t) => (
              <PillButton key={t.value} selected={muscleType === t.value} onClick={() => setMuscleType(t.value)}>
                {t.label}
              </PillButton>
            ))}
          </div>
        </Section>

        {/* ---- 脚の見え方 ---- */}
        <Section title="脚の見え方">
          <div className="flex gap-2">
            {LEG_LENGTHS.map((t) => (
              <PillButton key={t.value} selected={legLength === t.value} onClick={() => setLegLength(t.value)} className="flex-1 text-center">
                {t.label}
              </PillButton>
            ))}
          </div>
        </Section>

        {/* ---- 目指すサイズ感 ---- */}
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

        {/* ---- 見せたい印象 ---- */}
        <Section title="見せたい印象">
          <div className="flex flex-wrap gap-2">
            {STYLE_IMPRESSIONS.map((t) => (
              <PillButton key={t.value} selected={styleImpression === t.value} onClick={() => setStyleImpression(t.value)}>
                {t.label}
              </PillButton>
            ))}
          </div>
        </Section>

        {/* ---- 強調したい部位 ---- */}
        <Section title="強調したい部位" hint="複数選択可">
          <div className="flex flex-wrap gap-2">
            {BODY_PARTS.map((t) => (
              <PillButton key={t.value} selected={emphasizeParts.includes(t.value)}
                onClick={() => togglePart(emphasizeParts, setEmphasizeParts, t.value)}>
                {t.label}
              </PillButton>
            ))}
          </div>
        </Section>

        {/* ---- 隠したい部位 ---- */}
        <Section title="隠したい部位" hint="複数選択可">
          <div className="flex flex-wrap gap-2">
            {BODY_PARTS.map((t) => (
              <PillButton key={t.value} selected={hideParts.includes(t.value)}
                onClick={() => togglePart(hideParts, setHideParts, t.value)}>
                {t.label}
              </PillButton>
            ))}
          </div>
        </Section>

        {error && (
          <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3">{error}</p>
        )}

        <button
          onClick={handleSave}
          disabled={saving || generatingFit}
          className={`w-full py-3.5 rounded-xl text-sm font-medium transition-colors ${
            saved
              ? "bg-gray-100 text-gray-500 cursor-default"
              : "bg-gray-800 text-white hover:bg-gray-700 disabled:opacity-40"
          }`}
        >
          {saved ? "保存しました ✓" : saving ? "保存中..." : generatingFit ? "AI推奨を生成中..." : "保存する"}
        </button>

        {/* ---- AI推奨サイズ感 ---- */}
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
    </div>
  );
}

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
