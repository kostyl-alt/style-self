"use client";

import { useState, useEffect } from "react";
import AddSourceModal from "./AddSourceModal";
import type {
  KnowledgeSource,
  KnowledgeRule,
  KnowledgeSourcesListResponse,
  AnalyzeKnowledgeSourceResponse,
  KnowledgeSourceWithRulesResponse,
} from "@/types/index";

const TYPE_ICON: Record<string, string> = {
  url: "🔗", memo: "📝", image: "🖼️", book: "📕",
  video: "🎥", lookbook: "📔", expert_note: "✍️",
};

const TYPE_LABEL: Record<string, string> = {
  url: "URL", memo: "メモ", image: "画像", book: "書籍",
  video: "動画", lookbook: "ルックブック", expert_note: "専門家メモ",
};

interface KnowledgeTabProps {
  userId: string;
}

export default function KnowledgeTab({ userId }: KnowledgeTabProps) {
  const [sources, setSources]               = useState<KnowledgeSource[]>([]);
  const [isLoading, setLoading]             = useState(true);
  const [error, setError]                   = useState<string | null>(null);
  const [showAdd, setShowAdd]               = useState(false);
  const [analyzingId, setAnalyzingId]       = useState<string | null>(null);
  const [expandedId, setExpandedId]         = useState<string | null>(null);
  const [rulesBySource, setRulesBySource]   = useState<Record<string, KnowledgeRule[]>>({});
  const [loadingRulesId, setLoadingRulesId] = useState<string | null>(null);

  useEffect(() => {
    fetchSources();
  }, []);

  async function fetchSources() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/knowledge/sources?limit=50");
      const data = await res.json() as KnowledgeSourcesListResponse & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "取得に失敗しました");
      setSources(data.sources ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  async function loadRulesForSource(sourceId: string) {
    if (rulesBySource[sourceId]) return;  // キャッシュあり
    setLoadingRulesId(sourceId);
    try {
      const res = await fetch(`/api/knowledge/sources/${sourceId}`);
      const data = await res.json() as KnowledgeSourceWithRulesResponse & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "ルール取得に失敗しました");
      setRulesBySource((prev) => ({ ...prev, [sourceId]: data.rules ?? [] }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "ルール取得に失敗しました");
    } finally {
      setLoadingRulesId(null);
    }
  }

  async function handleToggleExpand(source: KnowledgeSource) {
    if (!source.isAnalyzed) return;
    if (expandedId === source.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(source.id);
    await loadRulesForSource(source.id);
  }

  async function handleAnalyze(id: string) {
    setAnalyzingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/knowledge/sources/${id}/analyze`, { method: "POST" });
      const data = await res.json() as AnalyzeKnowledgeSourceResponse & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "分析に失敗しました");
      setSources((prev) => prev.map((s) => (s.id === id ? data.source : s)));
      setRulesBySource((prev) => ({ ...prev, [id]: data.rules }));
      setExpandedId(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "分析に失敗しました");
    } finally {
      setAnalyzingId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("関連するルールも削除されます。本当に削除しますか？")) return;
    try {
      const res = await fetch(`/api/knowledge/sources/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "削除に失敗しました");
      }
      setSources((prev) => prev.filter((s) => s.id !== id));
      setExpandedId((prev) => (prev === id ? null : prev));
      setRulesBySource((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "削除に失敗しました");
    }
  }

  function handleAdded(source: KnowledgeSource) {
    setSources((prev) => [source, ...prev]);
    setShowAdd(false);
  }

  return (
    <div className="space-y-4 mt-4">
      {/* イントロ */}
      <div className="bg-white border border-gray-100 rounded-xl p-4">
        <p className="text-xs text-gray-600 leading-relaxed">
          AIが参照する判断ルールを増やせます。気になった記事URL・本のメモ・参考画像を登録してAI分析すると、コンセプトと色・素材・シルエットの判断ルールが自動生成され、コーデ提案の精度が上がります。
        </p>
        <button
          onClick={() => setShowAdd(true)}
          className="mt-3 w-full py-2.5 bg-gray-800 text-white rounded-xl text-sm hover:bg-gray-700"
        >
          + ナレッジを追加
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-2">
          <p className="text-xs text-red-600">{error}</p>
        </div>
      )}

      {/* ソース一覧 */}
      {isLoading ? (
        <div className="text-center py-10 text-gray-300 text-sm">読み込み中...</div>
      ) : sources.length === 0 ? (
        <div className="bg-gray-50 rounded-2xl p-8 text-center">
          <div className="text-3xl mb-2">📚</div>
          <p className="text-sm text-gray-700 font-medium mb-1">ナレッジがまだありません</p>
          <p className="text-xs text-gray-500">「+ ナレッジを追加」から、参考にしたい記事・本・画像を登録してください</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sources.map((s) => {
            const isExpanded = expandedId === s.id;
            const isAnalyzing = analyzingId === s.id;
            const rules = rulesBySource[s.id];
            const isLoadingRules = loadingRulesId === s.id;
            return (
              <div key={s.id} className="bg-white border border-gray-100 rounded-xl overflow-hidden">
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-xl flex-shrink-0">{TYPE_ICON[s.sourceType] ?? "🏷️"}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{s.title}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                        <span>{TYPE_LABEL[s.sourceType] ?? s.sourceType}</span>
                        <span>•</span>
                        <span>{new Date(s.createdAt).toLocaleDateString("ja-JP")}</span>
                        {s.isAnalyzed ? (
                          <span className="text-emerald-600">✓ 分析済み</span>
                        ) : (
                          <span className="text-amber-600">⏳ 未分析</span>
                        )}
                      </div>
                      {s.url && (
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-block text-xs text-gray-500 hover:text-gray-800 underline underline-offset-2 truncate max-w-full"
                        >
                          {s.url}
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 mt-3">
                    {!s.isAnalyzed ? (
                      <button
                        onClick={() => handleAnalyze(s.id)}
                        disabled={isAnalyzing}
                        className="flex-1 py-2 bg-gray-800 text-white rounded-lg text-xs hover:bg-gray-700 disabled:opacity-40"
                      >
                        {isAnalyzing ? "AI分析中..." : "AI分析"}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleToggleExpand(s)}
                        className="flex-1 py-2 border border-gray-200 text-gray-600 rounded-lg text-xs hover:bg-gray-50"
                      >
                        {isExpanded ? "ルールを閉じる ▲" : "ルールを表示 ▼"}
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(s.id)}
                      disabled={isAnalyzing}
                      className="px-3 py-2 border border-gray-200 text-gray-400 rounded-lg text-xs hover:text-red-500 hover:border-red-200 disabled:opacity-40"
                    >
                      削除
                    </button>
                  </div>
                </div>

                {/* アコーディオン: ルール表示 */}
                {isExpanded && (
                  <div className="border-t border-gray-100 bg-gray-50 p-4 space-y-3">
                    {isLoadingRules ? (
                      <p className="text-xs text-gray-400 text-center py-2">読み込み中...</p>
                    ) : !rules || rules.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-2">ルールがありません</p>
                    ) : (
                      rules.map((r) => (
                        <RuleCard key={r.id} rule={r} />
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showAdd && (
        <AddSourceModal
          userId={userId}
          onClose={() => setShowAdd(false)}
          onAdded={handleAdded}
        />
      )}
    </div>
  );
}

function RuleCard({ rule }: { rule: KnowledgeRule }) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-3 space-y-2 text-xs">
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium text-gray-900">{rule.conceptKeyword}</p>
        {rule.aliases.length > 0 && (
          <span className="text-xs text-gray-400">（{rule.aliases.slice(0, 3).join("・")}）</span>
        )}
      </div>
      {rule.emotion && (
        <div className="flex gap-2"><span className="text-gray-400 w-16 flex-shrink-0">感情</span><span className="text-gray-700">{rule.emotion}</span></div>
      )}
      {rule.philosophy && (
        <div className="flex gap-2"><span className="text-gray-400 w-16 flex-shrink-0">思想</span><span className="text-gray-700">{rule.philosophy}</span></div>
      )}
      {rule.recommendedColors.length > 0 && (
        <div className="flex gap-2"><span className="text-gray-400 w-16 flex-shrink-0">推奨色</span><span className="text-gray-700">{rule.recommendedColors.join("・")}</span></div>
      )}
      {rule.recommendedMaterials.length > 0 && (
        <div className="flex gap-2"><span className="text-gray-400 w-16 flex-shrink-0">推奨素材</span><span className="text-gray-700">{rule.recommendedMaterials.join("・")}</span></div>
      )}
      {rule.recommendedSilhouettes.length > 0 && (
        <div className="flex gap-2"><span className="text-gray-400 w-16 flex-shrink-0">シルエット</span><span className="text-gray-700">{rule.recommendedSilhouettes.join("・")}</span></div>
      )}
      {rule.requiredAccessories.length > 0 && (
        <div className="flex gap-2"><span className="text-gray-400 w-16 flex-shrink-0">小物</span><span className="text-gray-700">{rule.requiredAccessories.join("・")}</span></div>
      )}
      {rule.ngElements.length > 0 && (
        <div className="flex gap-2"><span className="text-amber-600 w-16 flex-shrink-0">NG</span><span className="text-amber-800">{rule.ngElements.join("・")}</span></div>
      )}
    </div>
  );
}
