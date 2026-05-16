"use client";

// フェーズB Step 2 確認用クライアント。
// 4 つのプリセットボタンで以下を切り替えられる:
//   - 新形式 A (明るい)  → analyze-v2 を叩く
//   - 新形式 B (可愛い)  → analyze-v2 を叩く
//   - 新形式 C (静か)    → analyze-v2 を叩く
//   - 8パターン形式サンプル → ハードコードされたサンプル(後方互換確認)
//
// 表示はそのまま <DiagnosisDisplay /> に投げる。

import { useState, useRef, useEffect } from "react";
import { DiagnosisDisplay } from "@/components/DiagnosisDisplay";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { DiagnosisAnswerV2, StyleDiagnosisResult } from "@/types/index";
import type { Json } from "@/types/database";

// --- 3 つの新形式サンプル回答 (test-analyze-v2-multi.ts と同一) ---

interface PresetPattern {
  key:     "A" | "B" | "C";
  label:   string;
  answers: DiagnosisAnswerV2[];
}

const PRESETS: PresetPattern[] = [
  {
    key:   "A",
    label: "新形式 A: 明るい・カラフル",
    answers: [
      { questionId: "q1",  optionIds: ["q1a"] },
      { questionId: "q2",  optionIds: ["q2c", "q2g"] },
      { questionId: "q3",  optionIds: ["q3c"] },
      { questionId: "q4",  optionIds: ["q4a"] },
      { questionId: "q5",  optionIds: ["q5b"] },
      { questionId: "q6",  optionIds: ["q6b"] },
      { questionId: "q7",  optionIds: ["q7b", "q7g"] },
      { questionId: "q8",  optionIds: ["q8b", "q8f"] },
      { questionId: "q9",  optionIds: ["q9c"] },
      { questionId: "q10", optionIds: ["q10d"] },
      { questionId: "q11", optionIds: ["q11d"] },
      { questionId: "q12", optionIds: ["q12d"] },
      { questionId: "q13", optionIds: ["q13b"] },
      { questionId: "q14", optionIds: ["q14a"] },
      { questionId: "q15", optionIds: [], freeText: "カラフルなのに洗練されてる人。NYブルックリンの公園で見るような自由さ" },
      { questionId: "q16", optionIds: ["q16a", "q16g"] },
    ],
  },
  {
    key:   "B",
    label: "新形式 B: 可愛い・フェミニン",
    answers: [
      { questionId: "q1",  optionIds: ["q1a"] },
      { questionId: "q2",  optionIds: ["q2d", "q2g"] },
      { questionId: "q3",  optionIds: ["q3c"] },
      { questionId: "q4",  optionIds: ["q4c"] },
      { questionId: "q5",  optionIds: ["q5a"], reasonIds: ["q5a3"] },
      { questionId: "q6",  optionIds: ["q6b"] },
      { questionId: "q7",  optionIds: ["q7e", "q7f"] },
      { questionId: "q8",  optionIds: ["q8d", "q8e"] },
      { questionId: "q9",  optionIds: ["q9d"] },
      { questionId: "q10", optionIds: ["q10c"] },
      { questionId: "q11", optionIds: ["q11d"] },
      { questionId: "q12", optionIds: ["q12e"] },
      { questionId: "q13", optionIds: ["q13b"] },
      { questionId: "q14", optionIds: ["q14c"] },
      { questionId: "q15", optionIds: [], freeText: "春の朝のような柔らかさを持つ人。優しい色合いを纏える人になりたい" },
      { questionId: "q16", optionIds: ["q16c", "q16f"] },
    ],
  },
  {
    key:   "C",
    label: "新形式 C: ミニマル・知的",
    answers: [
      { questionId: "q1",  optionIds: ["q1d"] },
      { questionId: "q2",  optionIds: ["q2a", "q2d"] },
      { questionId: "q3",  optionIds: ["q3g"] },
      { questionId: "q4",  optionIds: ["q4f"] },
      { questionId: "q5",  optionIds: ["q5b"] },
      { questionId: "q6",  optionIds: ["q6a"] },
      { questionId: "q7",  optionIds: ["q7a", "q7f"] },
      { questionId: "q8",  optionIds: ["q8c", "q8e"] },
      { questionId: "q9",  optionIds: ["q9b"] },
      { questionId: "q10", optionIds: ["q10a"] },
      { questionId: "q11", optionIds: ["q11b"] },
      { questionId: "q12", optionIds: ["q12b"] },
      { questionId: "q13", optionIds: ["q13a"] },
      { questionId: "q14", optionIds: ["q14b"] },
      { questionId: "q15", optionIds: [], freeText: "美術館の白壁に佇むキュレーターのような静けさを持つ人" },
      { questionId: "q16", optionIds: ["q16c", "q16d", "q16e"] },
    ],
  },
];

// --- 8パターン形式サンプル(後方互換確認用) ---
//
// applyPatternToResult が quiet-observer に対して書き込んでくれる
// 確定フィールドを再現。recommendedAccessories / recommendedBrands /
// culturalAffinities.art / relatedInfluencers は意図的に未定義
// (= 過去診断には存在しない)。
const LEGACY_8PATTERN_SAMPLE: StyleDiagnosisResult = {
  patternId:     "quiet-observer",
  worldviewName: "静謐な観察者",
  plainSummary:  "派手さよりも整いを優先する傾向があり、選ぶ服も「主張しない知性」を表す方向に向かっています。",
  coreIdentity:  "言葉ではなく佇まいで伝える人。",
  whyThisResult: "「静かだけど印象に残る」を選んだ点と、知的・ミニマル方向の素材選好から、quiet-observer に近いことが見て取れます。",
  unconsciousTendency: "「派手すぎ」を避ける気持ちが強く、色数を抑えながら、素材と形だけで自分を表現したい傾向が読み取れます。",
  idealSelf:           "場にいるだけで、その人の知性が伝わる人のようです。",
  avoidedImpression:   "量産型と思われたくない気持ちが強そうです。",
  attractedCulture:    "京都の侘び寂び・北欧ミニマル・坂本龍一系のアンビエント。",
  recommendedColors:      ["オフホワイト", "墨色", "グレージュ", "薄墨", "生成り"],
  recommendedMaterials:   ["コットン", "リネン", "ウール", "上質な綿"],
  recommendedSilhouettes: ["Iライン", "ストレート", "ゆるやかなドレープ", "ロング丈"],
  avoidElements:          ["大きなロゴ", "原色", "装飾的なプリント", "強い光沢"],
  buyingPriority: ["白の細番手シャツ", "上質なグレージュのカーディガン"],
  dailyAdvice:    ["1日1着、素材の手触りで選ぶ", "色を3色以内に絞る"],
  actionPlan:     ["クローゼットの色を確認", "ロゴ入りを1枚減らす", "上質な白シャツを1枚追加"],
  nextBuyingRule: ["原色なら買わない", "上質素材なら買う", "ロゴ目立つなら買わない"],
  avoid:          ["大きなロゴ", "原色", "強い光沢"],
  inputMapping:   [],
  styleStructure: { color: "墨〜白の階調", line: "縦長", material: "コットン・リネン", density: "余白多め", silhouette: "Iライン", gaze: "中心を外す" },
  styleAxis: {
    beliefKeywords:     ["静けさ", "余白", "知性"],
    colorTone:          "neutral",
    spaceFeeling:       "minimal",
    materialPreference: "natural",
    summary:            "色数を抑え、上質な天然素材で構造を作る方向。",
  },
  culturalAffinities: {
    music:     ["アンビエント", "坂本龍一系", "Nils Frahm"],
    films:     ["是枝裕和", "ジム・ジャームッシュ", "ヴィム・ヴェンダース"],
    fragrance: ["ヒノキ", "墨", "白檀"],
    // art は意図的に未定義(過去診断では存在しない)
  },
  firstPiece: {
    name:        "白の細番手シャツ",
    why:         "色味を持たない一枚があれば、そこから表情の起点が作れる",
    zozoKeyword: "白シャツ",
  },
  avoidItems: [],
  // recommendedAccessories / recommendedBrands / relatedInfluencers /
  // worldview_tags / worldview_keywords も意図的に未定義
};

// ---- レイテンシ ~100s を待たせる間の経過秒タイマー ----
function useElapsedSeconds(active: boolean): number {
  const [elapsed, setElapsed] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const start = useRef<number>(0);
  useEffect(() => {
    if (active) {
      start.current = Date.now();
      setElapsed(0);
      timer.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - start.current) / 1000));
      }, 1000);
    } else {
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
    }
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [active]);
  return elapsed;
}

type ActivePreset = "A" | "B" | "C" | "legacy" | null;

export default function PreviewClient() {
  const [active,  setActive]  = useState<ActivePreset>(null);
  const [result,  setResult]  = useState<StyleDiagnosisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const elapsed = useElapsedSeconds(loading);

  async function runV2(preset: PresetPattern) {
    setLoading(true);
    setError(null);
    setResult(null);
    setActive(preset.key);
    try {
      const res = await fetch("/api/ai/analyze-v2", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ answers: preset.answers }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as StyleDiagnosisResult;
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "失敗しました");
    } finally {
      setLoading(false);
    }
  }

  function showLegacy() {
    setActive("legacy");
    setResult(LEGACY_8PATTERN_SAMPLE);
    setError(null);
    setLoading(false);
  }

  function reset() {
    setActive(null);
    setResult(null);
    setError(null);
  }

  // フェーズB Step 3 確認用: 現在のユーザーの style_analysis に書き込んで
  // /discover に飛ぶ。InspirationView / CultureView の動作確認のため。
  // ⚠️ 過去診断データを上書きするため、確認ダイアログ必須。
  const [savingToProfile, setSavingToProfile] = useState(false);
  async function saveAndOpenDiscover() {
    if (!result) return;
    const ok = window.confirm(
      "⚠️ 現在ログインしているユーザーの style_analysis を、この試験結果で上書きします。\n\n"
      + "過去の診断データは消えます(Supabase Studio で users.style_analysis から復元可能ですが、自動バックアップは取りません)。\n\n"
      + "/discover で InspirationView / CultureView を確認するためだけの用途です。続行しますか?",
    );
    if (!ok) return;
    setSavingToProfile(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr || !authData.user) {
        alert("ログインしてから実行してください: " + (authErr?.message ?? "未ログイン"));
        return;
      }
      const { error: updErr } = await supabase
        .from("users")
        .update({
          style_analysis:       result as unknown as Json,
          style_axis:           result.styleAxis as unknown as Json,
          onboarding_completed: true,
        } as never)
        .eq("id", authData.user.id);
      if (updErr) {
        alert("保存失敗: " + updErr.message);
        return;
      }
      window.location.href = "/discover";
    } finally {
      setSavingToProfile(false);
    }
  }

  return (
    <div className="min-h-screen bg-white pb-24">
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
        {/* dev only バナー */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800">
          <strong>🛠 開発専用プレビュー</strong> · 本番では 404 になります。
          フェーズB Step 2 の DiagnosisDisplay 新セクションを目視確認するためのページ。
          フェーズC で削除予定: <code>app/(app)/dev/diagnosis-preview/</code>
        </div>

        <header>
          <p className="text-xs tracking-widest text-gray-400 uppercase mb-1">Diagnosis Preview</p>
          <h1 className="text-2xl font-light text-gray-900">診断結果プレビュー</h1>
          <p className="text-sm text-gray-500 mt-2 leading-relaxed">
            新形式 (analyze-v2) と過去 8パターン形式のサンプルを切り替えて、
            DiagnosisDisplay の表示を比較できます。
          </p>
        </header>

        {/* プリセットボタン */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              disabled={loading}
              onClick={() => runV2(p)}
              className={`text-left px-4 py-3 rounded-xl border text-sm transition-colors disabled:opacity-50 ${
                active === p.key
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
              }`}
            >
              <span className="block text-[10px] tracking-widest uppercase opacity-70 mb-0.5">analyze-v2</span>
              {p.label}
            </button>
          ))}
          <button
            disabled={loading}
            onClick={showLegacy}
            className={`sm:col-span-2 text-left px-4 py-3 rounded-xl border text-sm transition-colors disabled:opacity-50 ${
              active === "legacy"
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
            }`}
          >
            <span className="block text-[10px] tracking-widest uppercase opacity-70 mb-0.5">後方互換サンプル</span>
            8パターン形式サンプル (quiet-observer · 即時表示)
          </button>
        </div>

        {active && (
          <button
            onClick={reset}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            ← 別のサンプルを選ぶ / リセット
          </button>
        )}

        {/* ローディング表示 */}
        {loading && (
          <div className="bg-gray-50 border border-gray-100 rounded-2xl p-8 text-center space-y-3">
            <p className="text-sm text-gray-700">
              analyze-v2 を実行中…
            </p>
            <p className="text-xs text-gray-500 leading-relaxed">
              KO fetch → Haiku で worldview 抽出 → Sonnet で 13 項目生成。<br />
              合計 90〜110 秒かかります(step4 が 90 秒前後)。
            </p>
            <p className="text-3xl font-light text-gray-800 tabular-nums">
              {elapsed}<span className="text-base text-gray-400 ml-1">秒経過</span>
            </p>
          </div>
        )}

        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-xs text-rose-700">
            エラー: {error}
          </div>
        )}

        {/* 13項目チェックリスト (analyze-v2 結果が出ているときだけ表示) */}
        {result && active !== "legacy" && (
          <ChecklistCard analysis={result} />
        )}

        {/* /discover 確認導線 (フェーズB Step 3 用) */}
        {result && !loading && (
          <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 text-xs text-sky-900 space-y-2">
            <p className="font-medium">/discover の InspirationView / CultureView を確認するには:</p>
            <p className="leading-relaxed text-sky-800">
              この結果をログイン中ユーザーの <code>style_analysis</code> に保存して <code>/discover</code> を開けます。<strong>過去診断は上書きされます</strong>(復元は Supabase Studio から手動)。
            </p>
            <button
              type="button"
              disabled={savingToProfile}
              onClick={saveAndOpenDiscover}
              className="mt-1 inline-block px-4 py-2 bg-sky-700 text-white rounded-lg text-xs font-medium hover:bg-sky-800 disabled:opacity-50"
            >
              {savingToProfile ? "保存中…" : "💾 この結果を保存して /discover を開く"}
            </button>
          </div>
        )}

        {/* 結果表示 */}
        {result && (
          <div className="border-t border-gray-100 pt-6">
            <DiagnosisDisplay analysis={result} />
          </div>
        )}
      </div>
    </div>
  );
}

// 13項目のうち何が表示できているかを ✅/⬜ で可視化。
// analyze-v2 の品質確認を素早くするため。
function ChecklistCard({ analysis }: { analysis: StyleDiagnosisResult }) {
  const checks: { idx: number; label: string; ok: boolean; note?: string }[] = [
    { idx: 1,  label: "世界観名",                            ok: !!analysis.worldviewName,                                 note: analysis.worldviewName },
    { idx: 2,  label: "無意識の傾向",                        ok: !!analysis.unconsciousTendency },
    { idx: 3,  label: "本当はなりたい自分",                  ok: !!analysis.idealSelf },
    { idx: 4,  label: "避けている印象",                      ok: !!analysis.avoidedImpression },
    { idx: 5,  label: "惹かれている文化・空気感",            ok: !!analysis.attractedCulture },
    { idx: 6,  label: "合う色",                              ok: (analysis.recommendedColors?.length ?? 0) > 0 },
    { idx: 7,  label: "合う素材",                            ok: (analysis.recommendedMaterials?.length ?? 0) > 0 },
    { idx: 8,  label: "合うシルエット",                      ok: (analysis.recommendedSilhouettes?.length ?? 0) > 0 },
    { idx: 9,  label: "合う小物 (NEW)",                      ok: (analysis.recommendedAccessories?.length ?? 0) > 0 },
    { idx: 10, label: "合うブランド (NEW)",                  ok: (analysis.recommendedBrands?.length ?? 0) > 0 },
    { idx: 11, label: "音楽・映画・香水・アート (art NEW)",  ok: (analysis.culturalAffinities?.art?.length ?? 0) > 0 },
    { idx: 12, label: "まず試すべき服",                      ok: !!analysis.firstPiece?.name },
    { idx: 13, label: "近い世界観の人 (NEW)",                ok: (analysis.relatedInfluencers?.length ?? 0) > 0 },
  ];
  const okCount = checks.filter((c) => c.ok).length;
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5">
      <p className="text-[10px] tracking-widest text-gray-400 uppercase mb-3">
        13項目チェックリスト · {okCount}/13
      </p>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-y-1 gap-x-4 text-xs">
        {checks.map((c) => (
          <li key={c.idx} className="flex items-center gap-2">
            <span className={c.ok ? "text-emerald-600" : "text-gray-300"}>{c.ok ? "✅" : "⬜"}</span>
            <span className={c.ok ? "text-gray-800" : "text-gray-400"}>
              {c.idx}. {c.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
