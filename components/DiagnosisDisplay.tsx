"use client";

import { buildZozoSearchUrl } from "@/lib/utils/zozo-link";
import { getPatternById } from "@/lib/knowledge/worldview-patterns";
import type { StyleDiagnosisResult } from "@/types/index";

export function DiagnosisDisplay({ analysis, showShare = false }: {
  analysis: StyleDiagnosisResult;
  showShare?: boolean;
}) {
  const hasV3 = !!(
    analysis.worldviewName ||
    analysis.unconsciousTendency ||
    analysis.idealSelf ||
    analysis.attractedCulture ||
    analysis.firstPiece
  );

  // パターンから clothingRole 等を取得（patternId 駆動診断結果のみ）
  const pattern = analysis.patternId ? getPatternById(analysis.patternId) : undefined;
  const clothingRole = pattern?.clothingRole;
  const coreTags = pattern?.coreTags ?? analysis.styleAxis?.beliefKeywords ?? [];

  async function handleShare() {
    const lines = [
      analysis.worldviewName ? `🌐 ${analysis.worldviewName}` : "",
      analysis.coreIdentity ? `「${analysis.coreIdentity}」` : "",
      coreTags.length > 0 ? `#${coreTags.slice(0, 4).join(" #")}` : "",
      "",
      "Style Self で世界観を診断中。",
    ].filter(Boolean).join("\n");

    if (navigator.share) {
      try {
        await navigator.share({ text: lines, title: analysis.worldviewName ?? "私の世界観" });
        return;
      } catch {/* ユーザーがキャンセル */}
    }
    try {
      await navigator.clipboard.writeText(lines);
      alert("世界観テキストをコピーしました");
    } catch {
      alert("共有に失敗しました");
    }
  }

  return (
    <div className="space-y-6">
      {/* ===== Section 1: 世界観カード ===== */}
      {hasV3 && analysis.worldviewName ? (
        <div className="bg-gray-900 text-white rounded-2xl px-6 py-10 text-center">
          <p className="text-[10px] tracking-[0.3em] text-gray-400 uppercase mb-3">Your Worldview</p>
          <h2 className="text-3xl font-light leading-snug mb-4">{analysis.worldviewName}</h2>
          {analysis.coreIdentity && (
            <p className="text-xs text-gray-300 leading-relaxed max-w-xs mx-auto mb-4">{analysis.coreIdentity}</p>
          )}
          {coreTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 justify-center">
              {coreTags.slice(0, 5).map((t) => (
                <span key={t} className="text-[10px] px-2.5 py-0.5 bg-white/10 text-gray-200 rounded-full">#{t}</span>
              ))}
            </div>
          )}
        </div>
      ) : !hasV3 && analysis.plainType ? (
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
      ) : null}

      {/* ===== Section 2: 内面の言語化 ===== */}
      {(analysis.unconsciousTendency || analysis.idealSelf || analysis.avoidedImpression || clothingRole) && (
        <Section title="Inner Voice" subtitle="内面の言語化">
          <div className="space-y-3">
            {analysis.unconsciousTendency && (
              <DiagnosisCard label="無意識の傾向">
                <p className="text-sm text-gray-800 leading-relaxed">{analysis.unconsciousTendency}</p>
              </DiagnosisCard>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {analysis.idealSelf && (
                <DiagnosisCard label="本当はなりたい自分" tone="emerald">
                  <p className="text-sm text-gray-800 leading-relaxed">{analysis.idealSelf}</p>
                </DiagnosisCard>
              )}
              {analysis.avoidedImpression && (
                <DiagnosisCard label="避けている印象" tone="rose">
                  <p className="text-sm text-gray-800 leading-relaxed">{analysis.avoidedImpression}</p>
                </DiagnosisCard>
              )}
            </div>
            {clothingRole && (
              <DiagnosisCard label="服に求める役割" tone="amber">
                <p className="text-sm text-gray-800 leading-relaxed">{clothingRole}</p>
              </DiagnosisCard>
            )}
          </div>
        </Section>
      )}

      {/* ===== Section 3: ファッション変換 ===== */}
      {(analysis.recommendedColors?.length || analysis.recommendedMaterials?.length || analysis.recommendedSilhouettes?.length || analysis.firstPiece) && (
        <Section title="Fashion Translation" subtitle="ファッション変換">
          <div className="space-y-3">
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

            {analysis.firstPiece && (
              <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5">
                <p className="text-[10px] tracking-[0.3em] text-amber-700 uppercase mb-3">First Piece</p>
                <p className="text-xs text-amber-900/70 mb-2">まず試すべき1着</p>
                <h3 className="text-xl font-medium text-gray-900 mb-3">{analysis.firstPiece.name}</h3>
                {analysis.firstPiece.why && (
                  <p className="text-sm text-gray-700 leading-relaxed mb-4">{analysis.firstPiece.why}</p>
                )}

                {/* Sprint 47: 構造分解された理由 */}
                {(analysis.firstPiece.whyLength
                  || analysis.firstPiece.whyMaterial
                  || analysis.firstPiece.whyWeight
                  || analysis.firstPiece.whereToWear
                  || analysis.firstPiece.photoLook) && (
                  <div className="bg-white/60 border border-amber-100 rounded-xl p-4 mb-4 space-y-2.5">
                    {analysis.firstPiece.whyLength && (
                      <FirstPieceReason label="丈" text={analysis.firstPiece.whyLength} />
                    )}
                    {analysis.firstPiece.whyMaterial && (
                      <FirstPieceReason label="素材" text={analysis.firstPiece.whyMaterial} />
                    )}
                    {analysis.firstPiece.whyWeight && (
                      <FirstPieceReason label="重さ" text={analysis.firstPiece.whyWeight} />
                    )}
                    {analysis.firstPiece.whereToWear && (
                      <FirstPieceReason label="着る場所" text={analysis.firstPiece.whereToWear} />
                    )}
                    {analysis.firstPiece.photoLook && (
                      <FirstPieceReason label="写真の写り" text={analysis.firstPiece.photoLook} />
                    )}
                  </div>
                )}

                {analysis.firstPiece.zozoKeyword && (
                  <a
                    href={buildZozoSearchUrl({ keyword: analysis.firstPiece.zozoKeyword })}
                    target="_blank" rel="noopener noreferrer"
                    className="inline-block w-full text-center py-3 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors"
                  >
                    ZOZOで探す →
                  </a>
                )}
              </div>
            )}

            {analysis.avoidElements && analysis.avoidElements.length > 0 && (
              <DiagnosisCard label="避けた方がいい要素" tone="rose">
                <ul className="space-y-1.5">
                  {analysis.avoidElements.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="text-rose-300 flex-shrink-0 mt-0.5">×</span>
                      <span className="leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
              </DiagnosisCard>
            )}
          </div>
        </Section>
      )}

      {/* ===== Section 4: カルチャー変換 ===== */}
      {(hasV3 && analysis.culturalAffinities) || analysis.attractedCulture ? (
        <Section title="Culture Translation" subtitle="カルチャー変換">
          <div className="space-y-3">
            {analysis.attractedCulture && (
              <DiagnosisCard label="惹かれている文化・空気感">
                <p className="text-sm text-gray-800 leading-relaxed">{analysis.attractedCulture}</p>
              </DiagnosisCard>
            )}
            {analysis.culturalAffinities && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <AffinityBlock title="音楽" items={analysis.culturalAffinities.music} />
                <AffinityBlock title="映画" items={analysis.culturalAffinities.films} />
                <AffinityBlock title="香水" items={analysis.culturalAffinities.fragrance} />
              </div>
            )}
          </div>
        </Section>
      ) : null}

      {/* ===== 詳細（折りたたみ） ===== */}
      {(analysis.styleStructure || analysis.whyThisResult || analysis.dailyAdvice?.length || analysis.actionPlan?.length || analysis.buyingPriority?.length) && (
        <details className="bg-white border border-gray-100 rounded-2xl">
          <summary className="cursor-pointer px-5 py-4 text-xs tracking-widest text-gray-400 uppercase hover:text-gray-600">
            もっと詳しく見る
          </summary>
          <div className="px-5 pb-5 space-y-5">
            {analysis.dailyAdvice && analysis.dailyAdvice.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-2">今日からできること</p>
                <ul className="space-y-1">
                  {analysis.dailyAdvice.map((a, i) => (
                    <li key={i} className="text-xs text-gray-700 leading-relaxed">{i + 1}. {a}</li>
                  ))}
                </ul>
              </div>
            )}
            {analysis.buyingPriority && analysis.buyingPriority.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-2">買い足すならこれ</p>
                <ul className="space-y-1">
                  {analysis.buyingPriority.map((a, i) => (
                    <li key={i} className="text-xs text-gray-700 leading-relaxed">{i + 1}. {a}</li>
                  ))}
                </ul>
              </div>
            )}
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
            {analysis.whyThisResult && (
              <div>
                <p className="text-xs text-gray-500 mb-2">この結果になった理由</p>
                <p className="text-xs text-gray-700 leading-relaxed">{analysis.whyThisResult}</p>
              </div>
            )}
            {hasV3 && analysis.plainSummary && (
              <div>
                <p className="text-xs text-gray-500 mb-2">サマリー</p>
                <p className="text-xs text-gray-700 leading-relaxed">{analysis.plainSummary}</p>
              </div>
            )}
            {analysis.actionPlan && analysis.actionPlan.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-2">行動プラン</p>
                <ul className="space-y-1">
                  {analysis.actionPlan.map((a, i) => (
                    <li key={i} className="text-xs text-gray-700 leading-relaxed">{i + 1}. {a}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </details>
      )}

      {/* ===== Section 5: アクション ===== */}
      {showShare && (
        <Section title="Actions" subtitle="アクション">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleShare}
              className="py-3 px-4 border border-gray-200 text-gray-700 rounded-xl text-sm hover:bg-gray-50 transition-colors"
            >
              世界観を共有する
            </button>
            <a
              href="/onboarding"
              className="py-3 px-4 bg-gray-800 text-white text-center rounded-xl text-sm hover:bg-gray-700 transition-colors"
            >
              再診断する
            </a>
          </div>
        </Section>
      )}
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-3">
        <p className="text-[10px] tracking-[0.3em] text-gray-400 uppercase">{title}</p>
        <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function DiagnosisCard({
  label, hint, tone = "default", children,
}: {
  label:    string;
  hint?:    string;
  tone?:    "default" | "emerald" | "rose" | "amber";
  children: React.ReactNode;
}) {
  const toneClass =
    tone === "emerald" ? "bg-emerald-50/60 border-emerald-100" :
    tone === "rose"    ? "bg-rose-50/60 border-rose-100" :
    tone === "amber"   ? "bg-amber-50/60 border-amber-100" :
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

function FirstPieceReason({ label, text }: { label: string; text: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="text-[10px] text-amber-700 tracking-widest uppercase pt-0.5 w-16 flex-shrink-0">{label}</span>
      <p className="text-xs text-gray-700 leading-relaxed">{text}</p>
    </div>
  );
}

function AffinityBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-3">
      <p className="text-xs text-gray-500 mb-2">{title}</p>
      <ul className="space-y-1">
        {items.map((it) => (
          <li key={it} className="text-xs text-gray-700 leading-snug">・{it}</li>
        ))}
        {items.length === 0 && <li className="text-xs text-gray-300">—</li>}
      </ul>
    </div>
  );
}
