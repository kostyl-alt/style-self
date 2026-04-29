"use client";

import { useState } from "react";
import type { AiHistory } from "@/types/index";

const TYPE_META: Record<string, { icon: string; label: string }> = {
  diagnosis:          { icon: "🔮", label: "診断" },
  consultation:       { icon: "💬", label: "相談" },
  look_analysis:      { icon: "📐", label: "写真分析" },
  virtual_coordinate: { icon: "✨", label: "理想コーデ" },
};

const SEASON_EMOJI: Record<string, string> = {
  "春": "🌸", "夏": "☀️", "秋": "🍂", "冬": "❄️",
};

interface HistoryCardProps {
  history: AiHistory;
  onDelete: (id: string) => void;
}

export default function HistoryCard({ history, onDelete }: HistoryCardProps) {
  const [expanded, setExpanded] = useState(false);
  const meta = TYPE_META[history.type];
  const date = new Date(history.createdAt).toLocaleString("ja-JP", {
    year: "numeric", month: "numeric", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  return (
    <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
      <div className="p-4">
        <div className="flex items-start gap-3 mb-2">
          <span className="text-xl flex-shrink-0">{meta?.icon ?? "🏷️"}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-sm font-medium text-gray-900">{meta?.label ?? history.type}</p>
              <span className="text-xs text-gray-400">{date}</span>
            </div>
            <Summary history={history} />
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex-1 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs hover:bg-gray-50"
          >
            {expanded ? "詳細を閉じる ▲" : "詳細を表示 ▼"}
          </button>
          <button
            onClick={() => onDelete(history.id)}
            className="px-3 py-1.5 border border-gray-200 text-gray-400 rounded-lg text-xs hover:text-red-500 hover:border-red-200"
          >
            削除
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50 p-4">
          <Detail history={history} />
        </div>
      )}
    </div>
  );
}

// ---- タイプ別サマリ ----
function Summary({ history }: { history: AiHistory }) {
  switch (history.type) {
    case "diagnosis": {
      const o = history.output;
      return (
        <div className="text-xs text-gray-600 space-y-0.5">
          {o.plainType && <p className="text-gray-800">{o.plainType}</p>}
          {o.plainSummary && <p className="line-clamp-2">{o.plainSummary}</p>}
        </div>
      );
    }
    case "consultation": {
      return (
        <div className="text-xs text-gray-600 space-y-0.5">
          <p className="text-gray-800 line-clamp-1">「{history.input.consultation}」</p>
          {history.output.analysis && (
            <p className="line-clamp-2">→ {history.output.analysis}</p>
          )}
        </div>
      );
    }
    case "look_analysis": {
      const la = history.output.lookAnalysis;
      return (
        <div className="text-xs text-gray-600 space-y-0.5">
          {la.silhouette && <p className="line-clamp-1">{la.silhouette}</p>}
          {la.topBottomRatio && <p className="text-gray-500">比率: {la.topBottomRatio}</p>}
        </div>
      );
    }
    case "virtual_coordinate": {
      const m = history.metadata;
      return (
        <div className="text-xs text-gray-600 space-y-0.5">
          <p className="text-gray-800 line-clamp-1">{history.input.concept}</p>
          <div className="flex items-center gap-2 text-gray-500 flex-wrap">
            <span>{SEASON_EMOJI[m.season] ?? "🗓️"} {m.season}</span>
            <span>•</span>
            <span>{history.input.scene}</span>
            {m.conceptSource === "knowledge_base" && m.matchedRuleKeywords.length > 0 && (
              <span className="text-emerald-600">📚 {m.matchedRuleKeywords[0]}</span>
            )}
          </div>
        </div>
      );
    }
  }
}

// ---- タイプ別詳細 ----
function Detail({ history }: { history: AiHistory }) {
  switch (history.type) {
    case "diagnosis":          return <DetailDiagnosis history={history} />;
    case "consultation":       return <DetailConsultation history={history} />;
    case "look_analysis":      return <DetailLookAnalysis history={history} />;
    case "virtual_coordinate": return <DetailVirtualCoordinate history={history} />;
  }
}

function DetailDiagnosis({ history }: { history: Extract<AiHistory, { type: "diagnosis" }> }) {
  const o = history.output;
  return (
    <div className="space-y-2 text-xs text-gray-700">
      {o.coreIdentity && <Row label="コア" value={o.coreIdentity} />}
      {o.whyThisResult && <Row label="理由" value={o.whyThisResult} />}
      {o.recommendedColors && o.recommendedColors.length > 0 && <Row label="推奨色" value={o.recommendedColors.join("・")} />}
      {o.recommendedMaterials && o.recommendedMaterials.length > 0 && <Row label="推奨素材" value={o.recommendedMaterials.join("・")} />}
      {o.actionPlan && o.actionPlan.length > 0 && <Row label="行動計画" value={o.actionPlan.join(" / ")} />}
    </div>
  );
}

function DetailConsultation({ history }: { history: Extract<AiHistory, { type: "consultation" }> }) {
  const o = history.output;
  return (
    <div className="space-y-2 text-xs text-gray-700">
      <Row label="相談内容" value={history.input.consultation} />
      {o.analysis && <Row label="分析" value={o.analysis} />}
      {o.keyPoints && o.keyPoints.length > 0 && <Row label="ポイント" value={o.keyPoints.join(" / ")} />}
      {o.itemsToFind && o.itemsToFind.length > 0 && <Row label="探すアイテム" value={o.itemsToFind.join("・")} />}
      {o.preferenceNote && <Row label="好み配慮" value={o.preferenceNote} />}
    </div>
  );
}

function DetailLookAnalysis({ history }: { history: Extract<AiHistory, { type: "look_analysis" }> }) {
  const la = history.output.lookAnalysis;
  const pa = history.output.personalAdaptation;
  return (
    <div className="space-y-2 text-xs text-gray-700">
      {la.silhouette && <Row label="シルエット" value={la.silhouette} />}
      {la.topBottomRatio && <Row label="上下比率" value={la.topBottomRatio} />}
      {la.weightCenter && <Row label="重心" value={la.weightCenter} />}
      {la.colorScheme && <Row label="色使い" value={la.colorScheme} />}
      {la.whyLooksGood && <Row label="なぜ良く見えるか" value={la.whyLooksGood} />}
      {pa.howToAdapt && <Row label="自分への取り入れ方" value={pa.howToAdapt} />}
      {pa.itemsToFind && pa.itemsToFind.length > 0 && <Row label="探すアイテム" value={pa.itemsToFind.join("・")} />}
    </div>
  );
}

function DetailVirtualCoordinate({ history }: { history: Extract<AiHistory, { type: "virtual_coordinate" }> }) {
  const o = history.output;
  return (
    <div className="space-y-2 text-xs text-gray-700">
      <Row label="シーン" value={history.input.scene} />
      <Row label="コンセプト" value={history.input.concept} />
      {o.concept && o.concept !== history.input.concept && <Row label="解釈" value={o.concept} />}
      {o.seasonNote && <Row label="季節考慮" value={o.seasonNote} />}
      {o.whyThisCoordinate && <Row label="世界観整合" value={o.whyThisCoordinate} />}
      {o.items && o.items.length > 0 && (
        <div className="pt-2 border-t border-gray-200">
          <p className="text-gray-400 mb-1">アイテム</p>
          <ul className="space-y-1">
            {o.items.map((item, i) => (
              <li key={i} className="text-gray-700">
                <span className="text-gray-400">•</span> {item.name}（{item.color}）
              </li>
            ))}
          </ul>
        </div>
      )}
      {o.stylingTips && o.stylingTips.length > 0 && (
        <div className="pt-2 border-t border-gray-200">
          <p className="text-gray-400 mb-1">着こなしポイント</p>
          <ul className="space-y-1">
            {o.stylingTips.map((tip, i) => (
              <li key={i} className="text-gray-700"><span className="text-gray-400">{i + 1}.</span> {tip}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <span className="flex-shrink-0 text-gray-400 w-24">{label}</span>
      <span className="flex-1 leading-relaxed">{value}</span>
    </div>
  );
}
