"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import HistoryTab from "@/components/history/HistoryTab";
import {
  ENABLE_BODY, ENABLE_PREFERENCE, ENABLE_HISTORY, ENABLE_POSTS,
} from "@/lib/flags";
import MyPostsTab from "@/components/posts/MyPostsTab";
import type {
  BodyInfo, BodyType, BodyTendency, WeightCenter, ShoulderWidth,
  UpperBodyThickness, MuscleType, LegLength, PreferredFit, StyleImpression, BodyPart,
  StylePreference, BodyProfile, BodyConcern,
} from "@/types/index";
import { describeBodyShape, recommendSilhouette } from "@/lib/utils/body-rules";

// ---- 型 ----

type SelfTab = "diagnosis" | "body" | "worldview" | "history" | "posts";

// D1-2x: URL クエリ ?tab=xxx の有効値ガード(/outfit /discover と同型)
function isSelfTab(v: string | null): v is SelfTab {
  return v === "diagnosis" || v === "body" || v === "worldview" || v === "history" || v === "posts";
}

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

// ---- 世界観編集の選択肢 ----

const VIBE_OPTIONS = [
  "落ち着いて見える", "清潔感がある", "大人っぽい", "かっこいい",
  "かわいい", "上品", "ラフ", "シンプル",
  "個性的", "自然体", "色を使いたい", "黒を中心にしたい",
  "形をきれいに見せたい", "動きやすさを重視", "古着を取り入れたい", "目立ちすぎたくない",
];
const AVOID_VIBE_OPTIONS = [
  "派手すぎる", "子供っぽい", "野暮ったい", "近寄りがたい",
  "だらしない", "チャラい", "重すぎる", "暗すぎる",
  "生活感がある", "ロゴが多い", "装飾が多い", "フォーマルすぎる",
];
const CLOTHING_ROLE_OPTIONS = [
  "自分らしさを出す", "気分を上げる", "人に良い印象を与える",
  "体型をきれいに見せる", "清潔感を出す", "自信を持つ", "趣味として楽しむ",
];
const EMPTY_PREFERENCE: StylePreference = {
  likedColors: [], dislikedColors: [],
  likedMaterials: [], dislikedMaterials: [],
  likedSilhouettes: [], dislikedSilhouettes: [],
  likedVibes: [], dislikedVibes: [],
  culturalReferences: [],
  targetImpressions: [], avoidImpressions: [],
  clothingRole: [], ngElements: [],
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

// ---- Phase B: 今の好みの傾向（style_signals を集計して可視化・育成）----
// client 読取 + JS 集計（(a)案）。日本語の事実タグのみ表示（英語スラッグは保存時に排除済み）。
//   ポエム断定でなく頻度上位タグを事実で出す。ポエム名(診断)は Phase C まで残す（本セクションは追加のみ）。
const STYLE_TREND_MIN_PHOTOS = 3; // これ未満は「育ち始め」表示・閾値は調整可

type SignalAttributes = {
  colors?: string[]; silhouettes?: string[]; genres?: string[]; eras?: string[]; moods?: string[];
};
const STYLE_TREND_AXES: { key: keyof SignalAttributes; label: string; top: number }[] = [
  { key: "colors",      label: "色",           top: 3 },
  { key: "silhouettes", label: "シルエット",   top: 3 },
  { key: "genres",      label: "ジャンル候補", top: 3 },
  { key: "eras",        label: "年代",         top: 2 },
  { key: "moods",       label: "ムード",       top: 3 },
];

function aggregateAxis(rows: SignalAttributes[], key: keyof SignalAttributes, top: number): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const arr = r[key];
    if (!Array.isArray(arr)) continue;
    for (const raw of arr) {
      const t = typeof raw === "string" ? raw.trim() : "";
      if (t) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, top);
}

function StyleTrendSection() {
  const [rows, setRows] = useState<SignalAttributes[] | null>(null);
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { setRows([]); return; }
      const res = await supabase
        .from("style_signals")
        .select("attributes")
        .eq("user_id", data.user.id)
        .order("created_at", { ascending: false }) as unknown as { data: { attributes: SignalAttributes }[] | null };
      setRows((res.data ?? []).map((r) => r.attributes ?? {}));
    });
  }, []);

  if (rows === null) return null;     // 読み込み中は何も出さない
  const photoCount = rows.length;
  if (photoCount === 0) {
    // Phase C: データ無しは「まだ育っていない」＋育成CTA（診断でなく写真相談へ誘導）。
    return (
      <div className="border border-gray-200 rounded-2xl px-5 py-10 bg-white text-center space-y-3">
        <p className="text-4xl">🪞</p>
        <p className="text-sm font-medium text-gray-700">まだ世界観が育っていません</p>
        <p className="text-xs text-gray-500 leading-relaxed">好きな写真を相談するほど、ここに「今のあなたの傾向」が育ちます。</p>
        <Link
          href="/ai"
          className="inline-block mt-1 px-6 py-3 bg-gray-800 text-white rounded-xl text-sm hover:bg-gray-700 transition-colors"
        >
          好きな写真を相談する →
        </Link>
      </div>
    );
  }

  if (photoCount < STYLE_TREND_MIN_PHOTOS) {
    return (
      <div className="border border-gray-200 rounded-2xl px-5 py-4 bg-white">
        <p className="text-[10px] tracking-[0.3em] text-gray-400 uppercase mb-1">Your Taste</p>
        <p className="text-sm text-gray-700">好きな写真 {photoCount} 枚から育ち始めています。</p>
        <p className="text-xs text-gray-500 mt-1">あと数枚 相談すると、好みの傾向がここに見えてきます。</p>
      </div>
    );
  }

  const axes = STYLE_TREND_AXES
    .map((a) => ({ ...a, items: aggregateAxis(rows, a.key, a.top) }))
    .filter((a) => a.items.length > 0);

  return (
    <div className="border border-gray-200 rounded-2xl px-5 py-4 bg-white space-y-3">
      <div>
        <p className="text-[10px] tracking-[0.3em] text-gray-400 uppercase mb-0.5">Your Taste</p>
        <p className="text-sm text-gray-800">好きな写真 {photoCount} 枚から育った、今のあなたの傾向です。相談するほど更新されます。</p>
      </div>
      <div className="space-y-2">
        {axes.map((a) => (
          <div key={a.key} className="flex items-baseline gap-2">
            <span className="text-xs text-gray-400 w-20 shrink-0">{a.label}</span>
            <div className="flex flex-wrap gap-1.5">
              {a.items.map((it) => (
                <span key={it.tag} className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                  {it.tag}<span className="text-gray-400">×{it.count}</span>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- 世界観診断タブ ----

function DiagnosisTab() {
  // Phase C: 育成一本に整理。診断ベースの固定表示（DiagnosisDisplay のポエム名/#タグ/Inner Voice/
  //   Fashion・Culture Translation/Kindred Spirits/First Piece/Aspirations）と WorldviewPublicityPanel・
  //   WorldviewProductsSection を /self から撤去。主役は Your Taste（写真相談で育つ傾向）。
  //   ⚠️ 共有コンポーネント本体は無改修＝onboarding / 公開プロフィール(/u/[userId]) / dev は無傷。
  //   診断機能本体（analyze-v2/diagnosis_sessions/worldview_profiles）も無改修（/self での表示を外すだけ）。
  // Phase C: New Post(投稿導線)も撤去し育成一本に。posts 機能本体・投稿API・posts タブのコンポーネントは
  //   無改修（/self での入口表示を外すだけ・将来「③つながる」で使う余地は残す）。
  return (
    <div className="space-y-5 py-4">
      {/* Phase B: 写真相談で育つ「今の好みの傾向」（主役・0枚なら育成CTA・1-2枚育ち始め・3+傾向） */}
      <StyleTrendSection />
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
  // BodyProfile fields
  const [bpBodyType,          setBpBodyType]          = useState<BodyProfile["bodyType"] | "">("");
  const [bpSkeletonType,      setBpSkeletonType]      = useState<BodyProfile["skeletonType"] | "">("");
  const [bpConcerns,          setBpConcerns]          = useState<BodyConcern[]>([]);
  const [bpProportionNote,    setBpProportionNote]    = useState("");
  // R-1: 採寸値拡張(任意・cm 値)。設計: docs/STYLE-SELF_D1_リアル試着_MVP_スコープ_R-1〜R-3_設計調査.md §2.3.2
  const [bpShoulderWidthCm,   setBpShoulderWidthCm]   = useState("");
  const [bpWaistCm,           setBpWaistCm]           = useState("");
  const [bpInseamCm,          setBpInseamCm]          = useState("");
  const [bpNeckLength,        setBpNeckLength]        = useState<"short" | "normal" | "long" | "">("");

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((data: { bodyInfo: BodyInfo; bodyProfile: BodyProfile | null }) => {
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
        if (data.bodyProfile) {
          setBpBodyType(data.bodyProfile.bodyType ?? "");
          setBpSkeletonType(data.bodyProfile.skeletonType ?? "");
          setBpConcerns(data.bodyProfile.concerns ?? []);
          setBpProportionNote(data.bodyProfile.proportionNote ?? "");
          // R-1: 採寸値拡張(jsonb 既存値があれば反映・未登録なら空)
          setBpShoulderWidthCm(data.bodyProfile.shoulderWidthCm != null ? String(data.bodyProfile.shoulderWidthCm) : "");
          setBpWaistCm(data.bodyProfile.waistCm != null ? String(data.bodyProfile.waistCm) : "");
          setBpInseamCm(data.bodyProfile.inseamCm != null ? String(data.bodyProfile.inseamCm) : "");
          setBpNeckLength(data.bodyProfile.neckLength ?? "");
        }
      })
      .catch(() => setError("プロフィールの読み込みに失敗しました"))
      .finally(() => setLoading(false));
  }, []);

  function togglePart(parts: BodyPart[], setter: (v: BodyPart[]) => void, part: BodyPart) {
    setter(parts.includes(part) ? parts.filter((p) => p !== part) : [...parts, part]);
  }

  // R-2 + R-3: 体型特徴の言語化 + シルエット推奨(ライブ計算)。
  // 設計: docs/STYLE-SELF_D1_リアル試着_MVP_スコープ_R-1〜R-3_設計調査.md §3-4
  // 骨格 + 体型(BodyProfile 成立条件)が揃った時点で表示。
  const { bodyShape, silhouette } = useMemo(() => {
    if (!bpBodyType || !bpSkeletonType) return { bodyShape: null, silhouette: null };
    const profile: BodyProfile = {
      height:          height ? parseInt(height, 10) : 0,
      weight:          weight ? parseInt(weight, 10) : undefined,
      bodyType:        bpBodyType,
      skeletonType:    bpSkeletonType,
      concerns:        bpConcerns,
      proportionNote:  bpProportionNote || undefined,
      shoulderWidthCm: bpShoulderWidthCm ? parseInt(bpShoulderWidthCm, 10) : undefined,
      waistCm:         bpWaistCm         ? parseInt(bpWaistCm,         10) : undefined,
      inseamCm:        bpInseamCm        ? parseInt(bpInseamCm,        10) : undefined,
      neckLength:      bpNeckLength || undefined,
    };
    const shape = describeBodyShape(profile);
    return { bodyShape: shape, silhouette: recommendSilhouette(profile, shape) };
  }, [
    bpBodyType, bpSkeletonType, bpConcerns, bpProportionNote,
    bpShoulderWidthCm, bpWaistCm, bpInseamCm, bpNeckLength,
    height, weight,
  ]);

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
      const bodyProfile: BodyProfile | null = (bpBodyType && bpSkeletonType) ? {
        height:          height ? parseInt(height, 10) : 0,
        weight:          weight ? parseInt(weight, 10) : undefined,
        bodyType:        bpBodyType,
        skeletonType:    bpSkeletonType,
        concerns:        bpConcerns,
        proportionNote:  bpProportionNote || undefined,
        // R-1: 採寸値拡張(任意・空文字なら undefined・jsonb に optional で保存)
        shoulderWidthCm: bpShoulderWidthCm ? parseInt(bpShoulderWidthCm, 10) : undefined,
        waistCm:         bpWaistCm         ? parseInt(bpWaistCm,         10) : undefined,
        inseamCm:        bpInseamCm        ? parseInt(bpInseamCm,        10) : undefined,
        neckLength:      bpNeckLength || undefined,
      } : null;
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bodyInfo, bodyProfile }),
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

      <div className="border-t border-gray-100 pt-4 mt-2">
        <p className="text-xs text-gray-400 mb-3">以下はコーデ生成に使う体型・悩み情報です</p>
        <div className="space-y-4">
          <Section title="体型タイプ">
            <div className="grid grid-cols-2 gap-2">
              {([
                { value: "slim",     label: "スリム",   desc: "細身・華奢" },
                { value: "standard", label: "標準",     desc: "バランス型" },
                { value: "curvy",    label: "曲線的",   desc: "メリハリある体型" },
                { value: "muscular", label: "筋肉質",   desc: "ハリ感・ボリューム" },
              ] as { value: BodyProfile["bodyType"]; label: string; desc: string }[]).map((t) => (
                <ChoiceButton key={t.value} selected={bpBodyType === t.value} onClick={() => setBpBodyType(t.value)}>
                  <span className="font-medium">{t.label}</span>
                  <span className="block text-xs mt-0.5 opacity-70">{t.desc}</span>
                </ChoiceButton>
              ))}
            </div>
          </Section>
          <Section title="骨格タイプ（体型診断ベース）">
            <div className="grid grid-cols-3 gap-2">
              {([
                { value: "straight", label: "ストレート", desc: "上重心・ハリ感" },
                { value: "wave",     label: "ウェーブ",   desc: "下重心・曲線" },
                { value: "natural",  label: "ナチュラル", desc: "骨感・フレーム" },
              ] as { value: BodyProfile["skeletonType"]; label: string; desc: string }[]).map((t) => (
                <ChoiceButton key={t.value} selected={bpSkeletonType === t.value} onClick={() => setBpSkeletonType(t.value)}>
                  <span className="font-medium">{t.label}</span>
                  <span className="block text-xs mt-0.5 opacity-70">{t.desc}</span>
                </ChoiceButton>
              ))}
            </div>
          </Section>
          <Section title="スタイルの悩み" hint="最大3つまで">
            <div className="flex flex-wrap gap-2">
              {([
                { value: "looks_young",     label: "子どもっぽく見える" },
                { value: "short_legs",      label: "脚が短く見える" },
                { value: "broad_shoulders", label: "肩幅が広い" },
                { value: "wide_hips",       label: "腰回りが気になる" },
                { value: "short_torso",     label: "胴が短い" },
                { value: "top_heavy",       label: "上半身が重い" },
                { value: "bottom_heavy",    label: "下半身が重い" },
              ] as { value: BodyConcern; label: string }[]).map((t) => {
                const selected = bpConcerns.includes(t.value);
                const disabled = !selected && bpConcerns.length >= 3;
                return (
                  <PillButton
                    key={t.value}
                    selected={selected}
                    onClick={() => {
                      if (disabled) return;
                      setBpConcerns(selected ? bpConcerns.filter((c) => c !== t.value) : [...bpConcerns, t.value]);
                    }}
                    className={disabled ? "opacity-30 cursor-not-allowed" : ""}
                  >
                    {t.label}
                  </PillButton>
                );
              })}
            </div>
            {bpConcerns.length >= 3 && (
              <p className="text-xs text-gray-400 mt-1">3つ選択済み（これ以上選択できません）</p>
            )}
          </Section>
          <Section title="補足メモ" hint="任意">
            <input
              type="text"
              value={bpProportionNote}
              onChange={(e) => setBpProportionNote(e.target.value)}
              placeholder="例：脚が特に短め、腕が長いなど"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
            />
          </Section>
          {/* R-1: 詳細採寸(任意・世界観フィッティング軸の精度向上に利用) */}
          <Section title="詳細採寸" hint="任意・世界観フィッティング軸">
            <p className="text-xs text-gray-400 mb-3 leading-relaxed">
              採寸値を入れるほど、体型に合わせた提案精度が上がります。空欄でも構いません。
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">肩幅（cm）</label>
                <input type="number" inputMode="numeric" value={bpShoulderWidthCm}
                  onChange={(e) => setBpShoulderWidthCm(e.target.value)}
                  placeholder="例: 38"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200" />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">ウエスト（cm）</label>
                <input type="number" inputMode="numeric" value={bpWaistCm}
                  onChange={(e) => setBpWaistCm(e.target.value)}
                  placeholder="例: 68"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200" />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">股下（cm）</label>
                <input type="number" inputMode="numeric" value={bpInseamCm}
                  onChange={(e) => setBpInseamCm(e.target.value)}
                  placeholder="例: 72"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200" />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">首の長さ</label>
                <div className="flex gap-1.5">
                  {([
                    { value: "short",  label: "短め" },
                    { value: "normal", label: "標準" },
                    { value: "long",   label: "長め" },
                  ] as { value: "short" | "normal" | "long"; label: string }[]).map((t) => (
                    <PillButton key={t.value} selected={bpNeckLength === t.value}
                      onClick={() => setBpNeckLength(bpNeckLength === t.value ? "" : t.value)}>
                      {t.label}
                    </PillButton>
                  ))}
                </div>
              </div>
            </div>
          </Section>
          {/* R-2: 体型特徴の中立的・前向き言語化(ライブ計算)。骨格+体型が揃った時点で表示。 */}
          {bodyShape && (
            <Section title="あなたの体型特徴" hint="採寸値を入れるほど詳細になります">
              <p className="text-sm leading-relaxed text-gray-700 mb-3">{bodyShape.natural}</p>
              {bodyShape.features.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {bodyShape.features.map((f) => (
                    <span key={f} className="text-xs bg-gray-100 text-gray-600 rounded-full px-2.5 py-1">
                      {f}
                    </span>
                  ))}
                </div>
              )}
            </Section>
          )}
          {/* R-3: 体型別シルエット推奨(ライブ計算)。R-2 と同条件で表示。 */}
          {silhouette && (
            <Section title="似合うシルエット" hint="あなたの体型で世界観が成立する構造">
              {silhouette.reasoning && (
                <p className="text-sm leading-relaxed text-gray-700 mb-4">{silhouette.reasoning}</p>
              )}
              {silhouette.recommendedLengths.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs text-gray-500 mb-1.5">推奨 丈・シルエット</p>
                  <ul className="space-y-1">
                    {silhouette.recommendedLengths.map((v) => (
                      <li key={v} className="text-sm text-gray-700 pl-3 relative before:content-['・'] before:absolute before:left-0">
                        {v}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {silhouette.recommendedShoes.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs text-gray-500 mb-1.5">推奨 靴</p>
                  <ul className="space-y-1">
                    {silhouette.recommendedShoes.map((v) => (
                      <li key={v} className="text-sm text-gray-700 pl-3 relative before:content-['・'] before:absolute before:left-0">
                        {v}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {silhouette.recommendedAccessories.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs text-gray-500 mb-1.5">推奨 小物</p>
                  <ul className="space-y-1">
                    {silhouette.recommendedAccessories.map((v) => (
                      <li key={v} className="text-sm text-gray-700 pl-3 relative before:content-['・'] before:absolute before:left-0">
                        {v}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {silhouette.alternativeChoices.length > 0 && (
                <div className="mt-4 pt-3 border-t border-gray-100">
                  <p className="text-xs text-gray-500 mb-1.5">別の選択肢として</p>
                  <ul className="space-y-1">
                    {silhouette.alternativeChoices.map((v) => (
                      <li key={v} className="text-sm text-gray-600 pl-3 relative before:content-['→'] before:absolute before:left-0 before:text-gray-400">
                        {v}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Section>
          )}
        </div>
      </div>

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

function TagInput({
  tags, onAdd, onRemove, placeholder,
}: { tags: string[]; onAdd: (v: string) => void; onRemove: (v: string) => void; placeholder: string }) {
  const [input, setInput] = useState("");
  function commit() {
    const v = input.trim();
    if (v && !tags.includes(v)) onAdd(v);
    setInput("");
  }
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          type="text" value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } }}
          placeholder={placeholder}
          className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
        />
        <button onClick={commit} className="px-3 py-2 bg-gray-800 text-white rounded-xl text-sm hover:bg-gray-700 transition-colors">追加</button>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <span key={t} className="flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
              {t}
              <button onClick={() => onRemove(t)} className="text-gray-400 hover:text-gray-700 leading-none">×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function WorldviewTab() {
  const [pref,    setPref]    = useState<StylePreference>(EMPTY_PREFERENCE);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/worldview")
      .then((r) => r.json())
      .then((data: { stylePreference: StylePreference | null }) => {
        if (data.stylePreference) setPref({ ...EMPTY_PREFERENCE, ...data.stylePreference });
      })
      .catch(() => setError("設定の読み込みに失敗しました"))
      .finally(() => setLoading(false));
  }, []);

  function toggleChip(key: keyof StylePreference, value: string) {
    setPref((p) => {
      const current = p[key] as string[];
      return { ...p, [key]: current.includes(value) ? current.filter((x) => x !== value) : [...current, value] };
    });
  }
  function addTag(key: keyof StylePreference, value: string) {
    setPref((p) => ({ ...p, [key]: [...(p[key] as string[]), value] }));
  }
  function removeTag(key: keyof StylePreference, value: string) {
    setPref((p) => ({ ...p, [key]: (p[key] as string[]).filter((x) => x !== value) }));
  }

  async function handleSave() {
    setSaving(true); setSaved(false); setError(null);
    try {
      const res = await fetch("/api/worldview", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stylePreference: pref }),
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
      {/* 雰囲気 */}
      <Section title="服で出したい雰囲気" hint="複数選択可">
        <div className="flex flex-wrap gap-2">
          {VIBE_OPTIONS.map((opt) => (
            <button key={opt} onClick={() => toggleChip("likedVibes", opt)}
              className={`px-3 py-1.5 rounded-full border text-sm transition-colors ${
                pref.likedVibes.includes(opt)
                  ? "border-gray-800 bg-gray-800 text-white" : "border-gray-200 text-gray-600 hover:border-gray-300"
              }`}>{opt}</button>
          ))}
        </div>
        <TagInput
          tags={pref.targetImpressions}
          onAdd={(v) => addTag("targetImpressions", v)}
          onRemove={(v) => removeTag("targetImpressions", v)}
          placeholder="その他（例：知的に見られたい）"
        />
      </Section>

      {/* 避けたい見え方 */}
      <Section title="避けたい見え方" hint="複数選択可">
        <div className="flex flex-wrap gap-2">
          {AVOID_VIBE_OPTIONS.map((opt) => (
            <button key={opt} onClick={() => toggleChip("dislikedVibes", opt)}
              className={`px-3 py-1.5 rounded-full border text-sm transition-colors ${
                pref.dislikedVibes.includes(opt)
                  ? "border-red-400 bg-red-50 text-red-600" : "border-gray-200 text-gray-600 hover:border-gray-300"
              }`}>{opt}</button>
          ))}
        </div>
        <TagInput
          tags={pref.avoidImpressions}
          onAdd={(v) => addTag("avoidImpressions", v)}
          onRemove={(v) => removeTag("avoidImpressions", v)}
          placeholder="その他（例：ギャル系に見られたくない）"
        />
      </Section>

      {/* 色 */}
      <Section title="好きな色 / 苦手な色">
        <p className="text-xs text-gray-400 mb-1">好きな色</p>
        <TagInput
          tags={pref.likedColors}
          onAdd={(v) => addTag("likedColors", v)}
          onRemove={(v) => removeTag("likedColors", v)}
          placeholder="例: 黒・ネイビー・オフホワイト"
        />
        <p className="text-xs text-gray-400 mt-3 mb-1">苦手な色</p>
        <TagInput
          tags={pref.dislikedColors}
          onAdd={(v) => addTag("dislikedColors", v)}
          onRemove={(v) => removeTag("dislikedColors", v)}
          placeholder="例: 蛍光色・ピンク"
        />
      </Section>

      {/* 素材 */}
      <Section title="好きな素材 / 苦手な素材">
        <p className="text-xs text-gray-400 mb-1">好きな素材</p>
        <TagInput
          tags={pref.likedMaterials}
          onAdd={(v) => addTag("likedMaterials", v)}
          onRemove={(v) => removeTag("likedMaterials", v)}
          placeholder="例: コットン・リネン・ウール"
        />
        <p className="text-xs text-gray-400 mt-3 mb-1">苦手な素材</p>
        <TagInput
          tags={pref.dislikedMaterials}
          onAdd={(v) => addTag("dislikedMaterials", v)}
          onRemove={(v) => removeTag("dislikedMaterials", v)}
          placeholder="例: ポリエステル・化繊"
        />
      </Section>

      {/* シルエット */}
      <Section title="好きな形 / 苦手な形">
        <p className="text-xs text-gray-400 mb-1">好きな形</p>
        <TagInput
          tags={pref.likedSilhouettes}
          onAdd={(v) => addTag("likedSilhouettes", v)}
          onRemove={(v) => removeTag("likedSilhouettes", v)}
          placeholder="例: オーバーサイズ・Iライン・ワイドパンツ"
        />
        <p className="text-xs text-gray-400 mt-3 mb-1">苦手な形</p>
        <TagInput
          tags={pref.dislikedSilhouettes}
          onAdd={(v) => addTag("dislikedSilhouettes", v)}
          onRemove={(v) => removeTag("dislikedSilhouettes", v)}
          placeholder="例: タイトスカート・ピタTシャツ"
        />
      </Section>

      {/* 参考 */}
      <Section title="参考にしたいもの" hint="ブランド・映画・音楽・街・時代など">
        <TagInput
          tags={pref.culturalReferences}
          onAdd={(v) => addTag("culturalReferences", v)}
          onRemove={(v) => removeTag("culturalReferences", v)}
          placeholder="例: 90年代グランジ・Lemaire・パリ"
        />
      </Section>

      {/* 大事にしたいこと */}
      <Section title="服を選ぶとき大事にしたいこと" hint="複数選択可">
        <div className="flex flex-wrap gap-2">
          {CLOTHING_ROLE_OPTIONS.map((opt) => (
            <button key={opt} onClick={() => toggleChip("clothingRole", opt)}
              className={`px-3 py-1.5 rounded-full border text-sm transition-colors ${
                pref.clothingRole.includes(opt)
                  ? "border-gray-800 bg-gray-800 text-white" : "border-gray-200 text-gray-600 hover:border-gray-300"
              }`}>{opt}</button>
          ))}
        </div>
      </Section>

      {/* NGな要素 */}
      <Section title="NGな要素">
        <TagInput
          tags={pref.ngElements}
          onAdd={(v) => addTag("ngElements", v)}
          onRemove={(v) => removeTag("ngElements", v)}
          placeholder="例: 大きなロゴ・派手な柄・スキニー"
        />
      </Section>

      {error && <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3">{error}</p>}
      <button onClick={handleSave} disabled={saving}
        className={`w-full py-3.5 rounded-xl text-sm font-medium transition-colors ${
          saved ? "bg-gray-100 text-gray-500 cursor-default" : "bg-gray-800 text-white hover:bg-gray-700 disabled:opacity-40"
        }`}>
        {saved ? "保存しました ✓" : saving ? "保存中..." : "好みを保存する"}
      </button>
      <p className="text-xs text-gray-400 text-center">保存するとコーデ提案・ブランド提案に自動で反映されます</p>
    </div>
  );
}

// ---- メインページ ----

const TABS: { value: SelfTab; label: string }[] = [
  { value: "diagnosis", label: "世界観" },
  { value: "posts",     label: "投稿" },
  { value: "body",      label: "身体" },
  { value: "worldview", label: "好み" },
  { value: "history",   label: "履歴" },
];

// SIMPLE_MODE: 世界観診断(diagnosis)タブのみ残し、投稿/身体/好み/履歴は非表示。
function isSelfTabVisible(v: SelfTab): boolean {
  switch (v) {
    case "posts":     return ENABLE_POSTS;
    case "body":      return ENABLE_BODY;
    case "worldview": return ENABLE_PREFERENCE; // label「好み」(命名トリック)
    case "history":   return ENABLE_HISTORY;
    default:          return true; // diagnosis
  }
}

function SelfInner() {
  // D1-2x: URL クエリ ?tab=xxx で初期タブを決める(/outfit /discover と同型)。
  // 不正値 / ?tab= なし は既存デフォルト "diagnosis"(=「世界観」タブ・SelfTab 命名トリック)。
  const params = useSearchParams();
  const initialTab = params.get("tab");
  const [activeTab, setActiveTab] = useState<SelfTab>(
    isSelfTab(initialTab) && isSelfTabVisible(initialTab) ? initialTab : "diagnosis"
  );

  // URL が後から変わった場合に同期(/outfit /discover と同型)
  useEffect(() => {
    const t = params.get("tab");
    if (isSelfTab(t) && isSelfTabVisible(t) && t !== activeTab) setActiveTab(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const visibleTabs = TABS.filter((tab) => isSelfTabVisible(tab.value));

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="mb-6">
          {/* Phase C: チャットに戻る導線（/ai へ）*/}
          <Link href="/ai" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 mb-3">
            ← チャットに戻る
          </Link>
          <p className="text-xs tracking-widest text-gray-400 uppercase mb-1">Self</p>
          <h1 className="text-2xl font-light text-gray-900">あなたの世界観</h1>
        </div>

        {/* タブ（SIMPLE_MODE で diagnosis のみのときはタブバー自体を隠す） */}
        {visibleTabs.length > 1 && (
          <div className="flex gap-1 bg-white border border-gray-100 rounded-xl p-1 mb-2">
            {visibleTabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`flex-1 min-w-0 py-2 rounded-lg text-xs font-medium transition-all truncate ${
                  activeTab === tab.value
                    ? "bg-gray-800 text-white shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {activeTab === "diagnosis" && <DiagnosisTab />}
        {activeTab === "posts"     && <MyPostsTab />}
        {activeTab === "body"      && <BodyTab />}
        {activeTab === "worldview" && <WorldviewTab />}
        {activeTab === "history"   && <HistoryTab />}
      </div>
    </div>
  );
}

// D1-2x: useSearchParams を使うため Suspense でラップ(/outfit /discover と同型)
export default function SelfPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <SelfInner />
    </Suspense>
  );
}
