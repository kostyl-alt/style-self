"use client";

// M2-4: 世界観プロフィール公開設定パネル
//
// /self?tab=diagnosis の DiagnosisDisplay 直上に配置される(ステップ3で組み込み)。
// 本ステップ2はコンポーネント単体の実装まで。
//
// 【4 状態】
// D: 診断未実施(hasDiagnosis=false) → /onboarding への CTA
// A: 非公開(hasDiagnosis=true && isPublic=false) → 「公開する」ボタン
// B: 確認モーダル(A のボタンで開く) → 公開される/されない一覧を実データで表示 → 公開する/キャンセル
// C: 公開中(isPublic=true) → URL コピー・公開ビュー・公開停止
//
// 【設計判断(オーナー確定)】
// - スイッチ型トグルは使わない(ボタン+モーダル2段階で誤公開防止)
// - ON は確認モーダル必須、OFF は確認なし(安全側)
// - 公開系は API 成功を待ってから状態遷移(楽観的更新しない)
// - 失敗時は元の状態のまま + エラー表示
// - 共有は navigator.share → clipboard fallback

import { useState, useEffect } from "react";
import Link from "next/link";

interface Props {
  userId:           string;
  hasDiagnosis:     boolean;       // worldview_profiles 行が存在するか
  initialIsPublic:  boolean;       // 現在の is_public 値(行無しなら false)
  worldviewName:    string | null; // 確認モーダルに実データ差込
}

export default function WorldviewPublicityPanel({
  userId,
  hasDiagnosis,
  initialIsPublic,
  worldviewName,
}: Props) {
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // フル URL は client side で組み立てる(SSR 時 window 不在のため useEffect で遅延セット)
  const [fullUrl, setFullUrl] = useState<string>(`/u/${userId}`);
  useEffect(() => {
    if (typeof window !== "undefined") {
      setFullUrl(`${window.location.origin}/u/${userId}`);
    }
  }, [userId]);

  // 公開状態を API で変更。成功を確認してから状態遷移する(楽観的更新なし)。
  async function setPublicity(next: boolean) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/worldview-profile/publicity", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ isPublic: next }),
      });
      const data = await res.json() as { ok?: boolean; isPublic?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      // API 成功で初めて UI 状態を切り替える
      setIsPublic(next);
      setModalOpen(false);
    } catch (e) {
      // 失敗時は isPublic を変更しない(誤って公開中表示にならない)
      setError(e instanceof Error ? e.message : "通信に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  async function shareUrl() {
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        try {
          await navigator.share({
            url:   fullUrl,
            title: worldviewName ?? "私の世界観",
          });
          return;
        } catch {
          /* ユーザーがキャンセル */
        }
      }
      await navigator.clipboard.writeText(fullUrl);
      alert("URL をコピーしました");
    } catch {
      alert("共有に失敗しました");
    }
  }

  // ===== 状態 D: 未診断 =====
  if (!hasDiagnosis) {
    return (
      <div className="border border-gray-100 rounded-2xl p-5 bg-gray-50">
        <p className="text-[10px] tracking-[0.3em] text-gray-500 uppercase mb-2">Publicity</p>
        <p className="text-sm text-gray-700 leading-relaxed mb-3">
          まず診断を受けてください。世界観が決まると公開設定ができます。
        </p>
        <Link
          href="/onboarding"
          className="inline-block px-4 py-2 bg-gray-800 text-white text-sm rounded-xl hover:bg-gray-700 transition-colors"
        >
          診断を始める →
        </Link>
      </div>
    );
  }

  // ===== 状態 C: 公開中 =====
  if (isPublic) {
    return (
      <div className="border border-emerald-200 rounded-2xl p-5 bg-emerald-50/40">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-emerald-600">🟢</span>
          <p className="text-[10px] tracking-[0.3em] text-emerald-700 uppercase">Public</p>
        </div>
        <p className="text-sm text-gray-800 leading-relaxed mb-3">
          公開中。誰でも URL からあなたの世界観を見られます。
        </p>

        {/* 公開 URL 表示 */}
        <div className="bg-white border border-emerald-100 rounded-xl px-3 py-2 mb-3">
          <p className="text-xs text-gray-500 break-all font-mono">{fullUrl}</p>
        </div>

        {/* アクション */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
          <button
            type="button"
            onClick={shareUrl}
            disabled={loading}
            className="px-4 py-2 bg-gray-800 text-white text-sm rounded-xl hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            📋 URL をコピー
          </button>
          <a
            href={fullUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 border border-gray-200 text-gray-700 text-sm rounded-xl hover:bg-gray-50 text-center transition-colors"
          >
            👁 公開ビューを見る
          </a>
        </div>

        {/* 停止リンク(控えめ・確認なし=安全側) */}
        <div className="pt-2 border-t border-emerald-100/60 text-right">
          <button
            type="button"
            onClick={() => setPublicity(false)}
            disabled={loading}
            className="text-xs text-gray-500 hover:text-gray-800 transition-colors disabled:opacity-50"
          >
            {loading ? "更新中…" : "公開を停止する"}
          </button>
        </div>

        {error && (
          <p className="text-xs text-rose-600 mt-2">{error}</p>
        )}
      </div>
    );
  }

  // ===== 状態 A: 非公開(初期) =====
  return (
    <>
      <div className="border border-gray-200 rounded-2xl p-5 bg-white">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-gray-400">🔒</span>
          <p className="text-[10px] tracking-[0.3em] text-gray-500 uppercase">Private</p>
        </div>
        <p className="text-sm text-gray-700 leading-relaxed mb-3">
          現在非公開です。あなた以外は見られません。
        </p>
        <button
          type="button"
          onClick={() => { setError(null); setModalOpen(true); }}
          disabled={loading}
          className="px-4 py-2 bg-gray-800 text-white text-sm rounded-xl hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          世界観を公開する →
        </button>

        {error && (
          <p className="text-xs text-rose-600 mt-2">{error}</p>
        )}
      </div>

      {/* ===== 状態 B: 確認モーダル ===== */}
      {modalOpen && (
        <ConfirmModal
          worldviewName={worldviewName}
          fullUrl={fullUrl}
          loading={loading}
          error={error}
          onCancel={() => { if (!loading) setModalOpen(false); }}
          onConfirm={() => setPublicity(true)}
        />
      )}
    </>
  );
}

// ===== 確認モーダル =====
// 「公開される内容」を実データで列挙し、公開前確認の役割をここに集約。
// 「公開ビューを先に確認するリンク」は判断C で置かない。
function ConfirmModal({
  worldviewName,
  fullUrl,
  loading,
  error,
  onCancel,
  onConfirm,
}: {
  worldviewName: string | null;
  fullUrl:       string;
  loading:       boolean;
  error:         string | null;
  onCancel:      () => void;
  onConfirm:     () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-4 py-6"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <header>
          <h2 className="text-lg font-medium text-gray-900">世界観を公開しますか?</h2>
          <p className="text-xs text-gray-500 mt-1">URL を知る人なら誰でも閲覧できる状態になります</p>
        </header>

        {/* 公開される内容(実データ差込) */}
        <section>
          <p className="text-[10px] tracking-[0.3em] text-emerald-700 uppercase mb-2">公開される内容</p>
          <ul className="space-y-1.5 text-sm text-gray-800">
            <li>
              ✅ 世界観名 <span className="font-medium">「{worldviewName ?? "(未設定)"}」</span>
            </li>
            <li>✅ 目指す姿(Aspirations)</li>
            <li>✅ 合う色・素材・シルエット・小物</li>
            <li>✅ ブランド</li>
            <li>✅ 音楽・映画・香水・アート</li>
            <li>✅ 近い世界観の人(Kindred Spirits)</li>
            <li>✅ まず試すべき 1 着(名前のみ)</li>
          </ul>
        </section>

        {/* 公開されないもの(本人専用) */}
        <section className="border-t border-gray-100 pt-4">
          <p className="text-[10px] tracking-[0.3em] text-gray-500 uppercase mb-2">公開されないもの(本人専用)</p>
          <ul className="space-y-1.5 text-sm text-gray-600">
            <li>🔒 避けている印象 / 無意識の傾向</li>
            <li>🔒 行動プラン / 今日からできること</li>
            <li>🔒 First Piece の選んだ理由(why)</li>
            <li>🔒 避けた方がいい要素</li>
          </ul>
        </section>

        {/* 公開URL 表示 */}
        <section className="border-t border-gray-100 pt-4">
          <p className="text-[10px] tracking-[0.3em] text-gray-500 uppercase mb-2">公開 URL</p>
          <div className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
            <p className="text-xs text-gray-700 break-all font-mono">{fullUrl}</p>
          </div>
        </section>

        {error && (
          <p className="text-xs text-rose-600">{error}</p>
        )}

        {/* アクション: キャンセル左・公開する右(濃色強調) */}
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 px-4 py-3 border border-gray-200 text-gray-700 rounded-xl text-sm hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 px-4 py-3 bg-gray-900 text-white rounded-xl text-sm hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            {loading ? "公開中…" : "公開する"}
          </button>
        </div>
      </div>
    </div>
  );
}
