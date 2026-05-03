"use client";

import { buildZozoSearchUrl } from "@/lib/utils/zozo-link";
import type { StyleDiagnosisResult } from "@/types/index";

export function DiagnosisDisplay({ analysis }: { analysis: StyleDiagnosisResult }) {
  const hasV3 = !!(
    analysis.worldviewName ||
    analysis.unconsciousTendency ||
    analysis.idealSelf ||
    analysis.attractedCulture ||
    analysis.firstPiece
  );

  return (
    <div className="space-y-5">
      {/* Section 1: 世界観名 */}
      {hasV3 && analysis.worldviewName && (
        <div className="bg-gray-900 text-white rounded-2xl px-6 py-10 text-center">
          <p className="text-[10px] tracking-[0.3em] text-gray-400 uppercase mb-3">Your Worldview</p>
          <h2 className="text-3xl font-light leading-snug mb-4">{analysis.worldviewName}</h2>
          {analysis.coreIdentity && (
            <p className="text-xs text-gray-400 leading-relaxed max-w-xs mx-auto">{analysis.coreIdentity}</p>
          )}
        </div>
      )}

      {/* Section 2: 無意識の傾向 */}
      {hasV3 && analysis.unconsciousTendency && (
        <DiagnosisCard label="無意識の傾向" hint="自分でも気づいていなかった、選択の中の癖">
          <p className="text-sm text-gray-800 leading-relaxed">{analysis.unconsciousTendency}</p>
        </DiagnosisCard>
      )}

      {/* Section 3 + 4 */}
      {hasV3 && (analysis.idealSelf || analysis.avoidedImpression) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {analysis.idealSelf && (
            <DiagnosisCard label="なりたい自分" tone="emerald">
              <p className="text-sm text-gray-800 leading-relaxed">{analysis.idealSelf}</p>
            </DiagnosisCard>
          )}
          {analysis.avoidedImpression && (
            <DiagnosisCard label="避けている印象" tone="rose">
              <p className="text-sm text-gray-800 leading-relaxed">{analysis.avoidedImpression}</p>
            </DiagnosisCard>
          )}
        </div>
      )}

      {/* Section 5: 惹かれている文化 */}
      {hasV3 && analysis.attractedCulture && (
        <DiagnosisCard label="惹かれている文化・空気感">
          <p className="text-sm text-gray-800 leading-relaxed">{analysis.attractedCulture}</p>
          {analysis.preference?.culturalReferences && analysis.preference.culturalReferences.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {analysis.preference.culturalReferences.map((c) => (
                <span key={c} className="text-xs px-2.5 py-0.5 bg-white text-gray-700 border border-gray-200 rounded-full">
                  {c}
                </span>
              ))}
            </div>
          )}
        </DiagnosisCard>
      )}

      {/* Section 6: 合う色・素材・シルエット */}
      {(analysis.recommendedColors?.length || analysis.recommendedMaterials?.length || analysis.recommendedSilhouettes?.length) && (
        <DiagnosisCard label="合う色・素材・シルエット">
          <div className="space-y-3">
            {analysis.recommendedColors && analysis.recommendedColors.length > 0 && (
              <ChipRow title="色" items={analysis.recommendedColors} />
            )}
            {analysis.recommendedMaterials && analysis.recommendedMaterials.length > 0 && (
              <ChipRow title="素材" items={analysis.recommendedMaterials} />
            )}
            {analysis.recommendedSilhouettes && analysis.recommendedSilhouettes.length > 0 && (
              <ChipRow title="シルエット" items={analysis.recommendedSilhouettes} />
            )}
          </div>
        </DiagnosisCard>
      )}

      {/* Section 7: 合う音楽・映画・香水 */}
      {hasV3 && analysis.culturalAffinities && (
        <DiagnosisCard label="合う音楽・映画・香水">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <AffinityBlock icon="🎵" title="音楽" items={analysis.culturalAffinities.music} />
            <AffinityBlock icon="🎬" title="映画" items={analysis.culturalAffinities.films} />
            <AffinityBlock icon="🌸" title="香り" items={analysis.culturalAffinities.fragrance} />
          </div>
        </DiagnosisCard>
      )}

      {/* Section 8: まず試すべき1着 */}
      {hasV3 && analysis.firstPiece && (
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5">
          <p className="text-[10px] tracking-[0.3em] text-amber-700 uppercase mb-3">First Piece</p>
          <p className="text-xs text-amber-900/70 mb-2">まず試すべき1着</p>
          <h3 className="text-xl font-medium text-gray-900 mb-3">{analysis.firstPiece.name}</h3>
          {analysis.firstPiece.why && (
            <p className="text-sm text-gray-700 leading-relaxed mb-4">{analysis.firstPiece.why}</p>
          )}
          {analysis.firstPiece.zozoKeyword && (
            <a
              href={buildZozoSearchUrl({ keyword: analysis.firstPiece.zozoKeyword })}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block w-full text-center py-3 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              ZOZOで探す →
            </a>
          )}
        </div>
      )}

      {/* v1/v2 互換 */}
      {!hasV3 && analysis.plainType && (
        <div className="bg-gray-50 rounded-2xl p-6">
          <p className="text-xs tracking-widest text-gray-400 uppercase mb-3">Your Type</p>
          <p className="text-xl font-medium text-gray-900 leading-snug mb-3">{analysis.plainType}</p>
          {analysis.typeExplanation && (
            <p className="text-sm text-gray-600 leading-relaxed mb-4">{analysis.typeExplanation}</p>
          )}
          {analysis.coreIdentity && (
            <p className="text-xs italic text-gray-400 leading-relaxed border-t border-gray-200 pt-3">{analysis.coreIdentity}</p>
          )}
        </div>
      )}
      {!hasV3 && analysis.plainSummary && (
        <DiagnosisCard label="Plain Summary">
          <p className="text-sm text-gray-800 leading-relaxed">{analysis.plainSummary}</p>
        </DiagnosisCard>
      )}

      {/* 避けた方がいい要素 */}
      {analysis.avoidElements && analysis.avoidElements.length > 0 && (
        <div>
          <p className="text-xs tracking-widest text-gray-400 uppercase mb-3">避けた方がいい要素</p>
          <ul className="space-y-2">
            {analysis.avoidElements.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                <span className="text-red-300 flex-shrink-0 mt-0.5">×</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 買い足すならこれ */}
      {analysis.buyingPriority && analysis.buyingPriority.length > 0 && (
        <div className="bg-gray-800 text-white rounded-2xl p-6">
          <p className="text-xs tracking-widest text-gray-400 uppercase mb-4">買い足すならこれ</p>
          <ul className="space-y-3">
            {analysis.buyingPriority.map((item, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="text-gray-500 font-light flex-shrink-0">{i + 1}.</span>
                <span className="text-gray-200 leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 今日からできること */}
      {analysis.dailyAdvice && analysis.dailyAdvice.length > 0 && (
        <div>
          <p className="text-xs tracking-widest text-gray-400 uppercase mb-3">今日からできること</p>
          <ul className="space-y-2">
            {analysis.dailyAdvice.map((item, i) => (
              <li key={i} className="flex gap-3 text-sm text-gray-700">
                <span className="text-gray-300 font-light flex-shrink-0">{i + 1}.</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* もっと詳しく */}
      <details className="bg-white border border-gray-100 rounded-2xl">
        <summary className="cursor-pointer px-5 py-4 text-xs tracking-widest text-gray-400 uppercase hover:text-gray-600">
          もっと詳しく見る
        </summary>
        <div className="px-5 pb-5 space-y-5">
          {analysis.styleStructure && (
            <div>
              <p className="text-xs text-gray-500 mb-2">Style Structure</p>
              <div className="grid grid-cols-2 gap-2">
                {([
                  ["色",        analysis.styleStructure.color],
                  ["線",        analysis.styleStructure.line],
                  ["素材",      analysis.styleStructure.material],
                  ["密度",      analysis.styleStructure.density],
                  ["シルエット", analysis.styleStructure.silhouette],
                  ["視線",      analysis.styleStructure.gaze],
                ] as [string, string][]).map(([label, value]) => (
                  <div key={label} className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                    <p className="text-xs text-gray-700 leading-snug">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {analysis.styleAxis?.beliefKeywords && analysis.styleAxis.beliefKeywords.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-2">Style Keywords</p>
              <div className="flex flex-wrap gap-2">
                {analysis.styleAxis.beliefKeywords.map((kw) => (
                  <span key={kw} className="px-3 py-1 bg-gray-800 text-white text-xs rounded-full">{kw}</span>
                ))}
              </div>
            </div>
          )}

          {analysis.whyThisResult && (
            <div>
              <p className="text-xs text-gray-500 mb-2">Why This Result</p>
              <p className="text-xs text-gray-700 leading-relaxed">{analysis.whyThisResult}</p>
            </div>
          )}

          {hasV3 && analysis.plainSummary && (
            <div>
              <p className="text-xs text-gray-500 mb-2">Plain Summary</p>
              <p className="text-xs text-gray-700 leading-relaxed">{analysis.plainSummary}</p>
            </div>
          )}

          {analysis.inputMapping && analysis.inputMapping.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-2">Input Mapping</p>
              <div className="space-y-2">
                {analysis.inputMapping.map((item, i) => (
                  <div key={i} className="text-xs border-b border-gray-50 pb-2 last:border-b-0">
                    <span className="text-gray-400">{item.question}</span>
                    <span className="text-gray-700 mx-1.5">{item.answer}</span>
                    <span className="text-gray-400">→ {item.effect}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {analysis.actionPlan && analysis.actionPlan.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-2">Action Plan</p>
              <ul className="space-y-1">
                {analysis.actionPlan.map((a, i) => (
                  <li key={i} className="text-xs text-gray-700 leading-relaxed">{i + 1}. {a}</li>
                ))}
              </ul>
            </div>
          )}

          {analysis.nextBuyingRule && analysis.nextBuyingRule.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-2">Next Buying Rule</p>
              <ul className="space-y-1">
                {analysis.nextBuyingRule.map((r, i) => (
                  <li key={i} className="text-xs text-gray-700 leading-relaxed">{i + 1}. {r}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </details>
    </div>
  );
}

function DiagnosisCard({
  label, hint, tone = "default", children,
}: {
  label:    string;
  hint?:    string;
  tone?:    "default" | "emerald" | "rose";
  children: React.ReactNode;
}) {
  const toneClass =
    tone === "emerald" ? "bg-emerald-50/60 border-emerald-100" :
    tone === "rose"    ? "bg-rose-50/60 border-rose-100" :
                         "bg-gray-50 border-gray-100";
  return (
    <div className={`${toneClass} border rounded-2xl p-5`}>
      <p className="text-[10px] tracking-[0.3em] text-gray-500 uppercase mb-1">{label}</p>
      {hint && <p className="text-[11px] text-gray-400 mb-3">{hint}</p>}
      <div className={hint ? "" : "mt-3"}>{children}</div>
    </div>
  );
}

function ChipRow({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-1.5">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((it) => (
          <span key={it} className="text-xs px-2.5 py-1 bg-white text-gray-700 border border-gray-200 rounded-full">
            {it}
          </span>
        ))}
      </div>
    </div>
  );
}

function AffinityBlock({ icon, title, items }: { icon: string; title: string; items: string[] }) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-3">
      <p className="text-xs text-gray-500 mb-2">
        <span className="mr-1">{icon}</span>{title}
      </p>
      <ul className="space-y-1">
        {items.map((it) => (
          <li key={it} className="text-xs text-gray-700 leading-snug">・{it}</li>
        ))}
        {items.length === 0 && <li className="text-xs text-gray-300">—</li>}
      </ul>
    </div>
  );
}
