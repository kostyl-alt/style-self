"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { BrandCard } from "@/components/BrandCard";
import { DiagnosisDisplay } from "@/components/DiagnosisDisplay";
import { DIAGNOSIS_QUESTIONS } from "@/lib/knowledge/diagnosis-questions";
import type {
  DiagnosisAnswerV2, StyleDiagnosisResult, BrandRecommendation,
} from "@/types/index";

const TOTAL = DIAGNOSIS_QUESTIONS.length;

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

function ResultCard({
  result, brands, brandsLoading,
}: {
  result: StyleDiagnosisResult;
  brands: BrandRecommendation[];
  brandsLoading: boolean;
}) {
  return (
    <div className="space-y-6">
      <DiagnosisDisplay analysis={result} />

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

export default function OnboardingPage() {
  const [stepIdx, setStepIdx] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);

  const [answers, setAnswers] = useState<Record<string, DiagnosisAnswerV2>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<StyleDiagnosisResult | null>(null);
  const [brands, setBrands] = useState<BrandRecommendation[]>([]);
  const [brandsLoading, setBrandsLoading] = useState(false);

  const q = DIAGNOSIS_QUESTIONS[stepIdx];
  const current = answers[q.id] ?? { questionId: q.id, optionIds: [] };

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  function update(next: Partial<DiagnosisAnswerV2>) {
    setAnswers((prev) => {
      const base = prev[q.id] ?? { questionId: q.id, optionIds: [] };
      return {
        ...prev,
        [q.id]: { ...base, ...next, questionId: q.id },
      };
    });
  }

  function toggleSingle(optionId: string) {
    update({
      optionIds: current.optionIds[0] === optionId ? [] : [optionId],
      reasonIds: [],
    });
  }
  function toggleMulti(optionId: string) {
    const has = current.optionIds.includes(optionId);
    update({ optionIds: has ? current.optionIds.filter((x) => x !== optionId) : [...current.optionIds, optionId] });
  }
  function toggleReason(reasonId: string) {
    const cur = current.reasonIds ?? [];
    const has = cur.includes(reasonId);
    update({ reasonIds: has ? cur.filter((x) => x !== reasonId) : [...cur, reasonId] });
  }

  function canProceed(): boolean {
    if (!q.required) return true;
    if (q.kind === "free_text") return true;
    return current.optionIds.length > 0;
  }

  async function handleSubmit() {
    setIsLoading(true);
    setError(null);
    try {
      const payload = DIAGNOSIS_QUESTIONS
        .map((qq) => answers[qq.id])
        .filter((x): x is DiagnosisAnswerV2 =>
          !!x && (x.optionIds.length > 0 || !!x.freeText?.trim())
        );

      const res = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: payload, userId }),
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
        .then((d: { recommendations?: BrandRecommendation[] }) => setBrands(d.recommendations ?? []))
        .catch(() => {})
        .finally(() => setBrandsLoading(false));
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setIsLoading(false);
    }
  }

  function resetAll() {
    setResult(null);
    setStepIdx(0);
    setAnswers({});
    setError(null);
    setBrands([]);
  }

  if (result) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-lg mx-auto px-6 py-16">
          <ResultCard result={result} brands={brands} brandsLoading={brandsLoading} />
          <Link
            href="/home"
            className="mt-8 block w-full py-3.5 bg-gray-800 text-white text-center rounded-xl text-sm font-medium hover:bg-gray-700 transition-colors"
          >
            ホームへ進む →
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

  const selectedSingle = q.kind === "single_with_reasons" ? current.optionIds[0] : null;
  const selectedOption = selectedSingle ? q.options.find((o) => o.id === selectedSingle) : null;

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-lg mx-auto px-6 py-16">
        <div className="mb-10">
          <p className="text-xs tracking-widest text-gray-400 uppercase mb-2">Style Diagnosis</p>
          <h1 className="text-2xl font-light text-gray-900">あなたの世界観を<br />言語化しましょう</h1>
        </div>

        <ProgressBar current={stepIdx + 1} total={TOTAL} />

        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-medium text-gray-900 mb-1">{q.question}</h2>
            {q.hint && <p className="text-sm text-gray-400">{q.hint}</p>}
          </div>

          {q.kind === "single" && (
            <div className="flex flex-wrap gap-2">
              {q.options.map((opt) => {
                const isSel = current.optionIds[0] === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => toggleSingle(opt.id)}
                    className={`px-4 py-2.5 rounded-xl border text-sm transition-all ${
                      isSel ? "bg-gray-800 text-white border-gray-800"
                            : "bg-white text-gray-700 border-gray-200 hover:border-gray-400"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          )}

          {q.kind === "multi" && (
            <div className="flex flex-wrap gap-2">
              {q.options.map((opt) => {
                const isSel = current.optionIds.includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => toggleMulti(opt.id)}
                    className={`px-4 py-2.5 rounded-xl border text-sm transition-all ${
                      isSel ? "bg-gray-800 text-white border-gray-800"
                            : "bg-white text-gray-700 border-gray-200 hover:border-gray-400"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          )}

          {q.kind === "single_with_reasons" && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {q.options.map((opt) => {
                  const isSel = current.optionIds[0] === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => toggleSingle(opt.id)}
                      className={`px-4 py-2.5 rounded-xl border text-sm transition-all ${
                        isSel ? "bg-gray-800 text-white border-gray-800"
                              : "bg-white text-gray-700 border-gray-200 hover:border-gray-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              {selectedOption?.reasons && selectedOption.reasons.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-2">理由（複数選択可）</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedOption.reasons.map((r) => {
                      const isSel = (current.reasonIds ?? []).includes(r.id);
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => toggleReason(r.id)}
                          className={`px-3 py-1.5 rounded-full border text-xs transition-all ${
                            isSel ? "bg-gray-700 text-white border-gray-700"
                                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                          }`}
                        >
                          {r.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {q.kind === "free_text" && (
            <textarea
              value={current.freeText ?? ""}
              onChange={(e) => update({ freeText: e.target.value })}
              placeholder="例：「90年代のNYブルックリンの空気」「制服のように整った人」「ローブ・ディシャンブルみたいな佇まい」"
              rows={5}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:border-gray-400 resize-none"
            />
          )}
        </div>

        {error && <p className="mt-4 text-sm text-red-500">{error}</p>}

        <div className="flex gap-3 mt-10">
          {stepIdx > 0 && (
            <button
              type="button"
              onClick={() => setStepIdx((s) => s - 1)}
              className="flex-1 py-3 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              戻る
            </button>
          )}
          {stepIdx < TOTAL - 1 ? (
            <button
              type="button"
              onClick={() => setStepIdx((s) => s + 1)}
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

        {!q.required && (
          <button
            type="button"
            onClick={() => stepIdx < TOTAL - 1 ? setStepIdx((s) => s + 1) : handleSubmit()}
            className="mt-3 w-full py-2 text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            この質問はスキップする
          </button>
        )}
      </div>
    </div>
  );
}
