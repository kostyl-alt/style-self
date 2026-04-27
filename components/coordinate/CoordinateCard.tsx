"use client";

import { useState } from "react";
import SilhouetteDiagram from "./SilhouetteDiagram";
import { buildZozoSearchUrl } from "@/lib/utils/zozo-link";
import type {
  ResolvedCoordinateItem,
  CoordinateAIResponse,
  CoordinateSizeGuide,
} from "@/types/index";

const ROLE_LABELS: Record<string, { label: string; style: string }> = {
  base:   { label: "ベース",     style: "bg-gray-100 text-gray-500" },
  main:   { label: "メイン",     style: "bg-gray-800 text-white" },
  accent: { label: "アクセント", style: "bg-amber-100 text-amber-700" },
};

const ROLE_ORDER: Record<string, number> = { base: 0, main: 1, accent: 2 };

const CATEGORY_EMOJI: Record<string, string> = {
  tops: "👕", bottoms: "👖", outerwear: "🧥", jacket: "🥼",
  vest: "🦺", inner: "👚", dress: "👗", setup: "🩱",
  shoes: "👟", bags: "👜", accessories: "💍",
  hat: "🧢", jewelry: "📿", roomwear: "🏠", other: "🏷️",
};

const WEIGHT_CENTER_LABEL: Record<string, string> = {
  upper: "上重心",
  balanced: "中重心",
  lower: "下重心",
};

function cleanText(text: string): string {
  return text.replace(/[\uAC00-\uD7AF\u1100-\u11FF]/g, "").trim();
}

function parseRatioDisplay(topBottom: string): { main: string; correction?: string } {
  const idx = topBottom.indexOf("（");
  if (idx === -1) return { main: topBottom };
  const main = topBottom.slice(0, idx).trim();
  const correction = topBottom.slice(idx + 1, topBottom.lastIndexOf("）")).trim();
  return { main, correction: correction || undefined };
}

interface CoordinateCardProps {
  coordinate: CoordinateAIResponse;
  resolvedItems: ResolvedCoordinateItem[];
  scene: string;
  onSave: () => void;
  isSaving: boolean;
  isSaved: boolean;
}

export default function CoordinateCard({
  coordinate,
  resolvedItems,
  scene,
  onSave,
  isSaving,
  isSaved,
}: CoordinateCardProps) {
  const [layer3Open, setLayer3Open] = useState(false);

  const sorted = [...resolvedItems].sort(
    (a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role]
  );

  const analysis = coordinate.analysis;
  const silhouette = coordinate.silhouette;
  const score = Math.min(5, Math.max(0, analysis?.worldviewAlignment?.score ?? 0));
  const stars = "★".repeat(score) + "☆".repeat(5 - score);

  const hasSvg = !!(
    silhouette?.topVolume &&
    silhouette?.bottomVolume &&
    analysis?.ratio?.topBottom &&
    analysis?.weight?.center &&
    analysis?.line?.direction
  );

  const hasMeaning = !!(
    coordinate.trendNote ||
    (coordinate.buyingHint && coordinate.buyingHint.length > 0)
  );

  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">

      {/* Scene badge */}
      <div className="px-5 pt-5 pb-3 border-b border-gray-50">
        <span className="text-xs text-gray-400 tracking-widest uppercase">{scene}</span>
      </div>

      {/* ── LAYER 1: サマリーバー ── */}
      <div className="px-5 py-5 border-b border-gray-50 space-y-3">

        {/* ① コアの2層表示 */}
        {analysis?.what && (
          <div>
            <p className="text-[10px] text-gray-400 tracking-widest uppercase mb-1.5">
              このコーデの核
            </p>
            {/* 上段：普通の日本語1文（大きく） */}
            <p className="text-base font-semibold text-gray-900 leading-snug mb-1">
              {cleanText(analysis.what)}
            </p>
            {/* 下段：世界観の詩的表現（小さく・グレー） */}
            {coordinate.beliefAlignment && (
              <p className="text-sm text-gray-400 leading-relaxed">
                {cleanText(coordinate.beliefAlignment)}
              </p>
            )}
          </div>
        )}

        {/* ② シルエットバッジ + 世界観一致度（ラベル付き★） */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {silhouette?.type && (
            <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full font-medium">
              {cleanText(silhouette.type)}
            </span>
          )}
          {score > 0 && (
            <span className="text-xs text-gray-500 flex items-center gap-1">
              世界観一致
              <span className="text-amber-400 tracking-wider">{stars}</span>
            </span>
          )}
        </div>
      </div>

      {/* ── SVG構造図 + アイテム画像（2カラム） ── */}
      <div className="px-5 py-4 flex gap-3 border-b border-gray-50">

        {/* 左カラム: SVG + ラベル */}
        {hasSvg && (
          <div className="flex-shrink-0 flex flex-col gap-2.5">
            <SilhouetteDiagram
              topVolume={silhouette!.topVolume}
              bottomVolume={silhouette!.bottomVolume}
              ratioText={analysis!.ratio.topBottom}
              weightCenter={analysis!.weight.center}
              lineDirection={analysis!.line.direction}
              silhouetteType={silhouette!.type}
            />
            {/* SVG下ラベル */}
            <div className="space-y-1.5 pl-1">
              <SvgLabel label="比率" value={analysis!.ratio.topBottom} />
              <SvgLabel
                label="重心"
                value={WEIGHT_CENTER_LABEL[analysis!.weight.center] ?? analysis!.weight.center}
              />
              {silhouette!.type && (
                <SvgLabel label="形" value={silhouette!.type} />
              )}
              {analysis?.gaze?.flow && (
                <SvgLabel label="視線" value={analysis.gaze.flow} />
              )}
            </div>
          </div>
        )}

        {/* 右カラム: アイテム画像一覧 */}
        <div className="flex-1 flex flex-col gap-3 justify-start pt-1 min-w-0">
          {sorted.map(({ item, role, reason }) => (
            <div key={item.id} className="flex items-start gap-2.5">
              <div className="w-11 h-11 rounded-xl bg-gray-50 flex-shrink-0 overflow-hidden border border-gray-100">
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-lg">
                    {CATEGORY_EMOJI[item.category] ?? "🏷️"}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="text-xs text-gray-800 font-medium leading-tight truncate">
                  {item.name}
                </p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded-full leading-none ${ROLE_LABELS[role]?.style ?? ""}`}
                  >
                    {ROLE_LABELS[role]?.label ?? role}
                  </span>
                  {item.color && (
                    <span className="text-xs text-gray-400 truncate">{item.color}</span>
                  )}
                </div>
                {reason && (
                  <p className="text-xs text-gray-400 mt-1 leading-snug line-clamp-2">
                    → {reason}
                  </p>
                )}
                <a
                  href={buildZozoSearchUrl({
                    keyword: item.name,
                    category: item.category,
                    color: item.color ?? undefined,
                  })}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-1 text-xs text-gray-500 hover:text-gray-800 underline underline-offset-2"
                >
                  ZOZOで探す →
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── LAYER 2: 構造の核 ── */}
      <div className="px-5 py-6 space-y-6">

        {/* A. 形 */}
        <Layer2Block label="A. 形">
          {silhouette?.type && (
            <LabelRow label="シルエット" value={silhouette.type} />
          )}
          {analysis?.ratio && (() => {
            const { main, correction } = parseRatioDisplay(analysis.ratio.topBottom);
            return (
              <div className="flex gap-3">
                <span className="text-xs text-gray-400 flex-shrink-0 pt-0.5 w-20 leading-relaxed">上下比率</span>
                <div className="flex-1 space-y-0.5">
                  <p className="text-sm text-gray-700 leading-relaxed">実際の比率：{cleanText(main)}</p>
                  {correction && (
                    <p className="text-sm text-gray-500 leading-relaxed">見え方：{cleanText(correction)}</p>
                  )}
                  {analysis.ratio.assessment && (
                    <p className="text-xs text-gray-400 leading-relaxed mt-1">{cleanText(analysis.ratio.assessment)}</p>
                  )}
                </div>
              </div>
            );
          })()}
          {analysis?.line && (
            <LabelRow
              label="ライン"
              value={`${analysis.line.dominantLine}　—　${analysis.line.effect}`}
            />
          )}
          {silhouette?.lengthBalance && (
            <LabelRow label="丈バランス" value={silhouette.lengthBalance} />
          )}
        </Layer2Block>

        {/* B. 質感 */}
        <Layer2Block label="B. 質感">
          {coordinate.colorStory && (
            <LabelRow label="配色" value={coordinate.colorStory} />
          )}
          {analysis?.material && (
            <>
              <LabelRow
                label="素材"
                value={`${analysis.material.combination}　—　${analysis.material.tactileStory}`}
              />
              {analysis.material.hierarchy && (
                <LabelRow label="素材階層" value={analysis.material.hierarchy} />
              )}
            </>
          )}
          {analysis?.weight && (
            <LabelRow
              label="重量感"
              value={`${analysis.weight.feeling}　—　${analysis.weight.structuralRole}`}
            />
          )}
        </Layer2Block>

        {/* C. 成立条件 */}
        <Layer2Block label="C. 成立条件">
          {coordinate.bodyFitNote && (
            <LabelRow label="体型フィット" value={coordinate.bodyFitNote} />
          )}
          {analysis?.structure && (
            <>
              <LabelRow label="構造の論理" value={analysis.structure.logic} />
              <LabelRow label="緊張・弛緩" value={analysis.structure.tension} />
            </>
          )}
          {coordinate.sizeGuide &&
            Object.values(coordinate.sizeGuide).some(Boolean) && (
              <SizeGuideRows sizeGuide={coordinate.sizeGuide} />
            )}
          {coordinate.adjustment && coordinate.adjustment.length > 0 && (
            <div className="pt-1">
              <p className="text-xs text-gray-400 mb-2">調整アドバイス</p>
              <div className="space-y-1.5">
                {coordinate.adjustment.map((adj, i) => (
                  <p
                    key={i}
                    className="text-sm text-blue-700 bg-blue-50 rounded-lg px-3 py-2 leading-relaxed"
                  >
                    · {cleanText(adj)}
                  </p>
                ))}
              </div>
            </div>
          )}
        </Layer2Block>

        {/* D. 意味（trendNote / buyingHint があるときのみ表示） */}
        {hasMeaning && (
          <Layer2Block label="D. 意味">
            {coordinate.trendNote && (
              <LabelRow label="トレンド" value={coordinate.trendNote} />
            )}
            {coordinate.buyingHint && coordinate.buyingHint.length > 0 && (
              <div className="pt-1">
                <p className="text-xs text-gray-400 mb-2">買い足しヒント</p>
                <div className="space-y-1.5">
                  {coordinate.buyingHint.map((hint, i) => (
                    <p
                      key={i}
                      className="text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2 leading-relaxed"
                    >
                      → {cleanText(hint)}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </Layer2Block>
        )}
      </div>

      {/* ── LAYER 3: 解釈（デフォルト折りたたみ） ── */}
      <div className="px-5 border-t border-dashed border-gray-100">
        <button
          onClick={() => setLayer3Open(!layer3Open)}
          className="w-full flex items-center justify-between py-4 text-left"
        >
          <span className="text-xs tracking-widest text-gray-500 uppercase font-medium">
            解釈を読む
          </span>
          <span className="text-gray-400 text-xs">{layer3Open ? "▲" : "▼"}</span>
        </button>

        {layer3Open && (
          <div className="pb-5 space-y-5">
            {analysis?.why && (
              <InterpretBlock label="Why">
                <p className="text-sm text-gray-700 leading-relaxed">{cleanText(analysis.why)}</p>
              </InterpretBlock>
            )}

            {analysis?.emotion && (
              <InterpretBlock label="Emotion">
                <p className="text-sm text-gray-700 leading-relaxed">{cleanText(analysis.emotion)}</p>
              </InterpretBlock>
            )}

            {analysis?.worldviewAlignment && (
              <InterpretBlock label="Worldview">
                {analysis.worldviewAlignment.alignedTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {analysis.worldviewAlignment.alignedTags.map((tag) => (
                      <span
                        key={tag}
                        className="text-xs bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full"
                      >
                        + {tag}
                      </span>
                    ))}
                  </div>
                )}
                {analysis.worldviewAlignment.divergedTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {analysis.worldviewAlignment.divergedTags.map((tag) => (
                      <span
                        key={tag}
                        className="text-xs bg-red-50 text-red-500 px-2.5 py-1 rounded-full"
                      >
                        − {tag}
                      </span>
                    ))}
                  </div>
                )}
              </InterpretBlock>
            )}

            {analysis?.gaze && (
              <InterpretBlock label="Gaze Flow">
                <div className="flex items-center gap-2 text-xs text-gray-600 flex-wrap">
                  <span className="bg-gray-100 px-2.5 py-1 rounded-lg">{cleanText(analysis.gaze.entry)}</span>
                  <span className="text-gray-300">→</span>
                  <span className="bg-gray-100 px-2.5 py-1 rounded-lg">{cleanText(analysis.gaze.flow)}</span>
                  <span className="text-gray-300">→</span>
                  <span className="bg-gray-100 px-2.5 py-1 rounded-lg">{cleanText(analysis.gaze.exit)}</span>
                </div>
              </InterpretBlock>
            )}

            {coordinate.avoid && coordinate.avoid.length > 0 && (
              <InterpretBlock label="崩してはいけない要素">
                <div className="space-y-1.5">
                  {coordinate.avoid.map((item, i) => (
                    <p
                      key={i}
                      className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 leading-relaxed"
                    >
                      × {cleanText(item)}
                    </p>
                  ))}
                </div>
              </InterpretBlock>
            )}
          </div>
        )}
      </div>

      {/* 保存ボタン */}
      <div className="p-5 border-t border-gray-50">
        <button
          onClick={onSave}
          disabled={isSaving || isSaved}
          className={`w-full py-3 rounded-xl text-sm transition-colors ${
            isSaved
              ? "bg-gray-100 text-gray-400 cursor-default"
              : "bg-gray-800 text-white hover:bg-gray-700 disabled:opacity-40"
          }`}
        >
          {isSaved ? "保存済み ✓" : isSaving ? "保存中..." : "このコーデを保存する"}
        </button>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────

function Layer2Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs tracking-widest text-gray-500 uppercase font-semibold mb-3">{label}</p>
      <div className="bg-gray-50 rounded-xl px-4 py-4 space-y-3">{children}</div>
    </div>
  );
}

function LabelRow({ label, value }: { label: string; value: string }) {
  const clean = cleanText(value);
  if (!clean) return null;
  return (
    <div className="flex gap-3">
      <span className="text-xs text-gray-400 flex-shrink-0 pt-0.5 w-20 leading-relaxed">{label}</span>
      <span className="text-sm text-gray-700 leading-relaxed flex-1">{clean}</span>
    </div>
  );
}

function SvgLabel({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-1.5">
      <span className="text-[10px] text-gray-400 flex-shrink-0 w-7 leading-tight pt-px">{label}</span>
      <span className="text-[10px] text-gray-600 leading-tight">{value}</span>
    </div>
  );
}

function SizeGuideRows({ sizeGuide }: { sizeGuide: CoordinateSizeGuide }) {
  const rows: { label: string; value: string | undefined }[] = [
    { label: "トップス",   value: sizeGuide.topsFit },
    { label: "トップス丈", value: sizeGuide.topsLength },
    { label: "肩",        value: sizeGuide.shoulder },
    { label: "ボトムス",   value: sizeGuide.pantsFit },
    { label: "股上",      value: sizeGuide.rise },
    { label: "裾丈",      value: sizeGuide.hemBreak },
  ];
  const active = rows.filter((r) => r.value);
  if (active.length === 0) return null;
  return (
    <div className="pt-1">
      <p className="text-xs text-gray-400 mb-2">サイズガイド</p>
      <div className="space-y-2">
        {active.map(({ label, value }) => (
          <div key={label} className="flex gap-3">
            <span className="text-xs text-gray-400 w-20 flex-shrink-0 leading-relaxed">{label}</span>
            <span className="text-sm text-gray-700 leading-relaxed">{cleanText(value ?? "")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function InterpretBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs tracking-widest text-gray-400 uppercase mb-2">{label}</p>
      {children}
    </div>
  );
}
