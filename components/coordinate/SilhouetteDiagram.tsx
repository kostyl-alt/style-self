"use client";

import { topVolumeToScale, bottomVolumeToScale, parseRatio } from "@/lib/utils/silhouette-map";

interface SilhouetteDiagramProps {
  topVolume: string;
  bottomVolume: string;
  ratioText: string;
  weightCenter: "upper" | "lower" | "balanced";
  lineDirection: "vertical" | "horizontal" | "diagonal" | "curved" | "mixed";
  silhouetteType?: string;
}

export default function SilhouetteDiagram({
  topVolume,
  bottomVolume,
  ratioText,
  weightCenter,
  lineDirection,
  silhouetteType,
}: SilhouetteDiagramProps) {
  const topScale = topVolumeToScale(topVolume);
  const botScale = bottomVolumeToScale(bottomVolume);
  const { top, bottom } = parseRatio(ratioText);
  const total = top + bottom;

  const cx = 56;
  const headR = 11;
  const headCy = 13;
  const bodyTopY = 30;
  const bodyH = 150;
  const bodyBottomY = bodyTopY + bodyH;

  const BASE = 18;
  const shoulderW = BASE * topScale;
  const waistW = Math.max(8, shoulderW * 0.70);
  const hemW = BASE * botScale;

  const divY = bodyTopY + bodyH * (top / total);

  const weightY =
    weightCenter === "upper"
      ? bodyTopY + bodyH * 0.28
      : weightCenter === "lower"
      ? bodyTopY + bodyH * 0.72
      : bodyTopY + bodyH * 0.50;

  const topMidY = bodyTopY + (divY - bodyTopY) / 2;
  const botMidY = divY + (bodyBottomY - divY) / 2;

  const topPath = [
    `M ${cx - shoulderW} ${bodyTopY}`,
    `L ${cx + shoulderW} ${bodyTopY}`,
    `L ${cx + waistW} ${divY}`,
    `L ${cx - waistW} ${divY}`,
    `Z`,
  ].join(" ");

  const bottomPath = [
    `M ${cx - waistW} ${divY}`,
    `L ${cx + waistW} ${divY}`,
    `L ${cx + hemW} ${bodyBottomY}`,
    `L ${cx - hemW} ${bodyBottomY}`,
    `Z`,
  ].join(" ");

  return (
    <svg
      width="102"
      height="205"
      viewBox="0 0 112 205"
      className="flex-shrink-0"
      aria-label={`シルエット図: ${ratioText}${silhouetteType ? ` ${silhouetteType}` : ""}`}
    >
      {/* Head */}
      <circle cx={cx} cy={headCy} r={headR} fill="none" stroke="#9ca3af" strokeWidth="1.5" />

      {/* Neck */}
      <line x1={cx} y1={headCy + headR} x2={cx} y2={bodyTopY} stroke="#9ca3af" strokeWidth="1.5" />

      {/* Top garment */}
      <path d={topPath} fill="#f1f5f9" stroke="#94a3b8" strokeWidth="1.5" strokeLinejoin="round" />

      {/* Bottom garment */}
      <path d={bottomPath} fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1.5" strokeLinejoin="round" />

      {/* Line direction overlay */}
      {lineDirection === "vertical" && (
        <line
          x1={cx} y1={bodyTopY} x2={cx} y2={bodyBottomY}
          stroke="#c7d2fe" strokeWidth={1} strokeDasharray="4 3" opacity={0.8}
        />
      )}
      {lineDirection === "horizontal" && (
        <line
          x1={cx - shoulderW - 4} y1={divY} x2={cx + shoulderW + 4} y2={divY}
          stroke="#c7d2fe" strokeWidth={1} strokeDasharray="4 3" opacity={0.8}
        />
      )}
      {lineDirection === "diagonal" && (
        <line
          x1={cx - shoulderW} y1={bodyTopY} x2={cx + hemW} y2={bodyBottomY}
          stroke="#c7d2fe" strokeWidth={1} strokeDasharray="4 3" opacity={0.7}
        />
      )}

      {/* Weight marker */}
      <line
        x1={cx - 9} y1={weightY} x2={cx + 9} y2={weightY}
        stroke="#f59e0b" strokeWidth={1.5} opacity={0.85}
      />
      <circle cx={cx} cy={weightY} r={2.5} fill="#f59e0b" opacity={0.9} />

      {/* Ratio bar (left) */}
      <line x1="9" y1={bodyTopY} x2="9" y2={bodyBottomY} stroke="#d1d5db" strokeWidth="2" />
      <line x1="6" y1={divY} x2="12" y2={divY} stroke="#94a3b8" strokeWidth="1.5" />
      <text x="9" y={topMidY + 3} fontSize="8" fill="#9ca3af" textAnchor="middle">上{top}</text>
      <text x="9" y={botMidY + 3} fontSize="8" fill="#9ca3af" textAnchor="middle">下{bottom}</text>

      {/* Silhouette type label */}
      {silhouetteType && (
        <text x={cx} y="200" fontSize="8" fill="#6b7280" textAnchor="middle">
          {silhouetteType}
        </text>
      )}
    </svg>
  );
}
