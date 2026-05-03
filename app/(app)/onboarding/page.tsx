"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { BrandCard } from "@/components/BrandCard";
import type { OnboardingAnswer, StyleDiagnosisResult, BrandRecommendation } from "@/types/index";

// ---- 選択肢定数（9問） ----

const Q1_PERCEPTION = ["おしゃれ", "かっこいい", "かわいい", "個性的", "清潔感がある", "大人っぽい", "親しみやすい"];
const Q2_AVOID_IMPRESSION = ["ダサい", "子どもっぽい", "地味", "派手すぎる", "量産型", "清潔感がない", "個性がない"];
const Q3_ADMIRED_AURA = ["映画俳優", "ミュージシャン", "モデル", "アーティスト", "スポーツ選手", "インフルエンサー", "アニメキャラ"];
const Q4_CULTURE = ["90年代", "2000年代", "現代", "韓国", "ヨーロッパ", "アメリカ", "日本"];
const Q5_CLOTHING_MEANING = ["自己表現", "印象を作る道具", "気分を変えるもの", "自信を持つための鎧", "単なる実用品", "楽しみ"];
const Q6_FIRST_ATTENTION = ["形・シルエット", "色", "素材・質感", "ブランド", "値段", "着やすさ", "トレンド"];
const Q7_IDEAL_SELF = ["静かに目立つ人", "圧倒的な存在感がある人", "自分らしさがある人", "トレンドを抑えている人", "清潔感があってスマートな人", "親しみやすくておしゃれな人"];
const Q8_AUTHENTIC_PLACE = ["カフェ", "音楽ライブ", "美術館", "自然の中", "都市の街中", "家の中", "ショッピング"];
const Q9_AVOID_REASON = ["似合わない", "自分っぽくない", "目立ちすぎる", "地味すぎる", "着づらい", "流行が終わりそう"];

interface StepDef {
  step: number;
  question: string;
  hint: string;
  multi: boolean;
}

const STEPS: StepDef[] = [
  { step: 1, question: "他人からどう見られたいですか？",       hint: "複数選択可",     multi: true  },
  { step: 2, question: "絶対に思われたくない印象は？",         hint: "複数選択可",     multi: true  },
  { step: 3, question: "憧れる雰囲気に近いのは？",             hint: "1つ選んでください", multi: false },
  { step: 4, question: "どの文化・時代の服が好きですか？",     hint: "複数選択可",     multi: true  },
  { step: 5, question: "あなたにとって服は何ですか？",         hint: "1つ選んでください", multi: false },
  { step: 6, question: "服を選ぶとき最初に何を見ますか？",     hint: "1つ選んでください", multi: false },
  { step: 7, question: "本当はどんな自分になりたいですか？",   hint: "1つ選んでください", multi: false },
  { step: 8, question: "自分らしくいられる場所は？",           hint: "複数選択可",     multi: true  },
  { step: 9, question: "着たくない服・スタイルの理由は？",     hint: "複数選択可",     multi: true  },
];

// ---- サブコンポーネント ----

function ProgressBar({ current, total }: { current: number; total: number }) {
  return (
    <div className="w-full mb-8">
      <div className="flex justify-start text-xs text-gray-400 mb-2">
        <span>Step {current} / {total}</span>
      </div>
      <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-gray-800 rounded-full transition-all duration-500"
          style={{ width: `${(current / total) * 100}%` }}
        />
      </div>
    </div>
  );
}

function ChoiceChips({
  options,
  selected,
  multi,
  onChange,
}: {
  options: string[];
  selected: string[];
  multi: boolean;
  onChange: (next: string[]) => void;
}) {
  const toggle = (val: string) => {
    if (multi) {
      onChange(selected.includes(val) ? selected.filter((x) => x !== val) : [...selected, val]);
    } else {
      onChange(selected[0] === val ? [] : [val]);
    }
  };
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const isSelected = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className={`px-4 py-2.5 rounded-xl border text-sm transition-all ${
              isSelected
                ? "bg-gray-800 text-white border-gray-800"
                : "bg-white text-gray-700 border-gray-200 hover:border-gray-400"
            }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function ResultCard({
  result,
  brands,
  brandsLoading,
}: {
  result: StyleDiagnosisResult;
  brands: BrandRecommendation[];
  brandsLoading: boolean;
}) {
  const hasRecommended = result.recommendedColors || result.recommendedMaterials || result.recommendedSilhouettes;

  return (
    <div className="space-y-8">

      {/* ① あなたのタイプ + ② 意味 + 世界観コピー */}
      {result.plainType ? (
        <div className="bg-gray-50 rounded-2xl p-6">
          <p className="text-xs tracking-widest text-gray-400 uppercase mb-3">Your Type</p>
          <p className="text-xl font-medium text-gray-900 leading-snug mb-3">{result.plainType}</p>
          {result.typeExplanation && (
            <p className="text-sm text-gray-600 leading-relaxed mb-4">{result.typeExplanation}</p>
          )}
          <p className="text-xs italic text-gray-400 leading-relaxed border-t border-gray-200 pt-3">{result.coreIdentity}</p>
        </div>
      ) : (
        <>
          <div className="bg-gray-50 rounded-2xl p-6">
            <p className="text-xs tracking-widest text-gray-400 uppercase mb-3">Plain Summary</p>
            <p className="text-base text-gray-800 leading-relaxed">{result.plainSummary}</p>
          </div>
          <div className="text-center py-8 border-b border-gray-100">
            <p className="text-xs tracking-widest text-gray-300 uppercase mb-4">Core Identity</p>
            <h2 className="text-2xl font-light text-gray-900 leading-relaxed">{result.coreIdentity}</h2>
          </div>
        </>
      )}

      {/* ③ 似合う服の方向性 */}
      {hasRecommended && (
        <div>
          <p className="text-xs tracking-widest text-gray-400 uppercase mb-4">あなたに合う色・素材・形</p>
          <div className="space-y-4">
            {result.recommendedColors && result.recommendedColors.length > 0 && (
              <div>
                <p className="text-xs text-gray-400 mb-2">色</p>
                <div className="flex flex-wrap gap-2">
                  {result.recommendedColors.map((c, i) => (
                    <span key={i} className="px-3 py-1.5 bg-gray-50 text-sm text-gray-700 rounded-full border border-gray-100">{c}</span>
                  ))}
                </div>
              </div>
            )}
            {result.recommendedMaterials && result.recommendedMaterials.length > 0 && (
              <div>
                <p className="text-xs text-gray-400 mb-2">素材</p>
                <div className="flex flex-wrap gap-2">
                  {result.recommendedMaterials.map((m, i) => (
                    <span key={i} className="px-3 py-1.5 bg-gray-50 text-sm text-gray-700 rounded-full border border-gray-100">{m}</span>
                  ))}
                </div>
              </div>
            )}
            {result.recommendedSilhouettes && result.recommendedSilhouettes.length > 0 && (
              <div>
                <p className="text-xs text-gray-400 mb-2">シルエット・形</p>
                <div className="flex flex-wrap gap-2">
                  {result.recommendedSilhouettes.map((s, i) => (
                    <span key={i} className="px-3 py-1.5 bg-gray-50 text-sm text-gray-700 rounded-full border border-gray-100">{s}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ④ 避けた方がいい要素 */}
      {result.avoidElements && result.avoidElements.length > 0 && (
        <div>
          <p className="text-xs tracking-widest text-gray-400 uppercase mb-3">避けた方がいい要素</p>
          <ul className="space-y-2">
            {result.avoidElements.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                <span className="text-red-300 flex-shrink-0 mt-0.5">×</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ⑤ 買い足すならこれ */}
      {result.buyingPriority && result.buyingPriority.length > 0 && (
        <div className="bg-gray-800 text-white rounded-2xl p-6">
          <p className="text-xs tracking-widest text-gray-400 uppercase mb-4">買い足すならこれ</p>
          <ul className="space-y-3">
            {result.buyingPriority.map((item, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="text-gray-500 font-light flex-shrink-0">{i + 1}.</span>
                <span className="text-gray-200 leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ⑥ 今日からできること */}
      {result.dailyAdvice && result.dailyAdvice.length > 0 && (
        <div>
          <p className="text-xs tracking-widest text-gray-400 uppercase mb-3">今日からできること</p>
          <ul className="space-y-2">
            {result.dailyAdvice.map((item, i) => (
              <li key={i} className="flex gap-3 text-sm text-gray-700">
                <span className="text-gray-300 font-light flex-shrink-0">{i + 1}.</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Style Structure */}
      <div>
        <p className="text-xs tracking-widest text-gray-400 uppercase mb-3">Style Structure</p>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["色", result.styleStructure.color],
              ["線", result.styleStructure.line],
              ["素材", result.styleStructure.material],
              ["密度", result.styleStructure.density],
              ["シルエット", result.styleStructure.silhouette],
              ["視線", result.styleStructure.gaze],
            ] as [string, string][]
          ).map(([label, value]) => (
            <div key={label} className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs text-gray-400 mb-1">{label}</p>
              <p className="text-sm text-gray-700 leading-snug">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Why This Result */}
      <div>
        <p className="text-xs tracking-widest text-gray-400 uppercase mb-3">Why This Result</p>
        <p className="text-sm text-gray-600 leading-relaxed">{result.whyThisResult}</p>
      </div>

      {/* Input Mapping */}
      <div>
        <p className="text-xs tracking-widest text-gray-400 uppercase mb-3">Input Mapping</p>
        <div className="space-y-2.5">
          {result.inputMapping.map((item, i) => (
            <div key={i} className="flex gap-3 text-sm border-b border-gray-50 pb-2.5">
              <span className="text-gray-400 flex-shrink-0 text-xs w-16 pt-0.5">{item.question}</span>
              <div className="flex-1">
                <span className="text-gray-700">{item.answer}</span>
                <span className="text-gray-400 text-xs ml-1.5">→ {item.effect}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action Plan */}
      <div>
        <p className="text-xs tracking-widest text-gray-400 uppercase mb-3">Action Plan</p>
        <ul className="space-y-2">
          {result.actionPlan.map((item, i) => (
            <li key={i} className="flex gap-3 text-sm text-gray-700">
              <span className="text-gray-300 font-light flex-shrink-0">{i + 1}.</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Next Buying Rule */}
      <div className="bg-gray-800 text-white rounded-2xl p-6">
        <p className="text-xs tracking-widest text-gray-400 uppercase mb-4">Next Buying Rule</p>
        <ul className="space-y-3">
          {result.nextBuyingRule.map((rule, i) => (
            <li key={i} className="flex gap-3 text-sm">
              <span className="text-gray-500 font-light flex-shrink-0">{i + 1}.</span>
              <span className="text-gray-200 leading-relaxed">{rule}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Brand Recommendations */}
      {(brandsLoading || brands.length > 0) && (
        <div>
          <p className="text-xs tracking-widest text-gray-400 uppercase mb-4">Brands for You</p>
          {brandsLoading ? (
            <p className="text-xs text-center text-gray-400 py-6 animate-pulse">
              あなたに合うブランドを探しています…
            </p>
          ) : (
            <div className="space-y-3">
              {brands.map((rec) => (
                <BrandCard key={rec.brand.id} rec={rec} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---- メインコンポーネント ----

export default function OnboardingPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);

  const [q1, setQ1] = useState<string[]>([]);
  const [q2, setQ2] = useState<string[]>([]);
  const [q3, setQ3] = useState<string[]>([]);
  const [q4, setQ4] = useState<string[]>([]);
  const [q5, setQ5] = useState<string[]>([]);
  const [q6, setQ6] = useState<string[]>([]);
  const [q7, setQ7] = useState<string[]>([]);
  const [q8, setQ8] = useState<string[]>([]);
  const [q9, setQ9] = useState<string[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<StyleDiagnosisResult | null>(null);
  const [brands, setBrands] = useState<BrandRecommendation[]>([]);
  const [brandsLoading, setBrandsLoading] = useState(false);

  const totalSteps = STEPS.length;
  const step = STEPS[currentStep];
  const answers = [q1, q2, q3, q4, q5, q6, q7, q8, q9];

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
  }, []);

  function canProceed(): boolean {
    return answers[currentStep].length > 0;
  }

  function buildAnswers(): OnboardingAnswer[] {
    return STEPS.map((s, i) => ({
      step: s.step,
      question: s.question,
      answer: answers[i].join("、"),
    }));
  }

  function resetAll() {
    setResult(null);
    setCurrentStep(0);
    setQ1([]); setQ2([]); setQ3([]); setQ4([]); setQ5([]);
    setQ6([]); setQ7([]); setQ8([]); setQ9([]);
    setError(null);
    setBrands([]);
  }

  async function handleSubmit() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: buildAnswers(), userId }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? "エラーが発生しました");
      }
      const data = await res.json() as StyleDiagnosisResult;
      setResult(data);

      setBrandsLoading(true);
      fetch("/api/brands/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ styleAnalysis: data }),
      })
        .then((r) => r.json())
        .then((d: { recommendations?: BrandRecommendation[] }) => {
          setBrands(d.recommendations ?? []);
        })
        .catch(() => {})
        .finally(() => setBrandsLoading(false));
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setIsLoading(false);
    }
  }

  if (result) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-lg mx-auto px-6 py-16">
          <ResultCard result={result} brands={brands} brandsLoading={brandsLoading} />
          <Link
            href="/closet"
            className="mt-8 block w-full py-3.5 bg-gray-800 text-white text-center rounded-xl text-sm font-medium hover:bg-gray-700 transition-colors"
          >
            クローゼットへ進む →
          </Link>
          <button
            onClick={resetAll}
            className="mt-3 w-full py-3 text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            もう一度診断する
          </button>
        </div>
      </div>
    );
  }

  const stepOptions = [
    Q1_PERCEPTION, Q2_AVOID_IMPRESSION, Q3_ADMIRED_AURA, Q4_CULTURE,
    Q5_CLOTHING_MEANING, Q6_FIRST_ATTENTION, Q7_IDEAL_SELF, Q8_AUTHENTIC_PLACE, Q9_AVOID_REASON,
  ];
  const stepSetters = [setQ1, setQ2, setQ3, setQ4, setQ5, setQ6, setQ7, setQ8, setQ9];

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-lg mx-auto px-6 py-16">
        <div className="mb-10">
          <p className="text-xs tracking-widest text-gray-400 uppercase mb-2">Style Diagnosis</p>
          <h1 className="text-2xl font-light text-gray-900">あなたの服の方向性を<br />言語化しましょう</h1>
        </div>

        <ProgressBar current={currentStep + 1} total={totalSteps} />

        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-medium text-gray-900 mb-1">{step.question}</h2>
            <p className="text-sm text-gray-400">{step.hint}</p>
          </div>

          <ChoiceChips
            options={stepOptions[currentStep]}
            selected={answers[currentStep]}
            multi={step.multi}
            onChange={stepSetters[currentStep]}
          />
        </div>

        {error && (
          <p className="mt-4 text-sm text-red-500">{error}</p>
        )}

        <div className="flex gap-3 mt-10">
          {currentStep > 0 && (
            <button
              type="button"
              onClick={() => setCurrentStep((s) => s - 1)}
              className="flex-1 py-3 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              戻る
            </button>
          )}
          {currentStep < totalSteps - 1 ? (
            <button
              type="button"
              onClick={() => setCurrentStep((s) => s + 1)}
              disabled={!canProceed()}
              className="flex-1 py-3 bg-gray-800 text-white rounded-xl text-sm disabled:opacity-30 hover:bg-gray-700 transition-colors"
            >
              次へ
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canProceed() || isLoading}
              className="flex-1 py-3 bg-gray-800 text-white rounded-xl text-sm disabled:opacity-30 hover:bg-gray-700 transition-colors"
            >
              {isLoading ? "分析中..." : "診断する"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
