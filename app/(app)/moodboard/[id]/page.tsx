"use client";

// D1 Phase 2 ムードボード: 詳細画面(/moodboard/[id])
//
// Sprint C-2 段階3-B 実装(設計案 476db41 §6 完全投入)
//
// 機能:
//   1. データ取得(GET /api/moodboards/[id])
//   2. メインビジュアル(cover_image_url)
//   3. コンセプト(description)表示 + 編集モーダル(★ プロセス誘導 placeholder + 例文)
//   4. items グリッド + Card
//   5. 画像追加(file → uploadMoodboardImage → POST items)
//   6. caption 編集モーダル(★ プロセス誘導 placeholder)
//   7. MB メタ編集モーダル(name/description/is_public/cover_image_url)
//   8. MB 削除 confirm
//   9. プロセス誘導 UI(空 MB CTA + items 1-2 件時ガイド + 編集モーダル例文)
//  10. アクション(チャットに渡す placeholder + 公開設定切替)
//
// ★ ビジョン拡張 案 A 採用(設計案 476db41 §5・スキーマ変更なし・既存実装無傷)
// ★ プロのファッション制作プロセス対応:コンセプト → MB → 撮影

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Edit3, Trash2, Plus, X, Image as ImageIcon,
  Lock, Globe, MessageCircle, Check, Sparkles, Link2, Wand2,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { uploadMoodboardImage } from "@/lib/storage";
import { buildMoodboardPrompt } from "@/lib/prompts/moodboard-prompt";
import { MB_CONTEXT_OBJECT } from "@/lib/flags";
import type {
  MoodboardWithItems,
  MoodboardItemRow,
  AnalyzeItemResponse,
  FromUrlItemResponse,
  MoodboardAnalysisRow,
  MoodboardBrief,
  BriefField,
} from "@/types/moodboard";
import type { BodyProfile } from "@/types/index";
import {
  ESSENTIAL_CATEGORIES,
  ESSENTIAL_LABELS,
  detectEssentials,
  extractCategory,
  stripCategoryPrefix,
  withCategoryPrefix,
  type EssentialCategory,
} from "@/lib/utils/moodboard-essentials";

const NAME_MAX = 200;
const DESCRIPTION_MAX = 2000;
const CAPTION_MAX = 500;

// ★ プロセス誘導 例文(設計案 476db41 §6.2)
const CONCEPT_EXAMPLES = [
  "孤独な富裕層 / 都会の夜 / ミニマル",
  "冷たいアンドロジナス / 廃墟 / モノクロ",
  "90 年代グランジ / 雨 / グレー",
  "海岸の朝 / リネン / 砂色と白",
];

export default function MoodboardDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const mbId = params.id;

  const [mb, setMb] = useState<MoodboardWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  // ★ Moodboard First Step 2: board 解析(brief 含む)を読むだけ。GET は生成しない(無ければ null=セクション非表示)。
  const [analysis, setAnalysis] = useState<MoodboardAnalysisRow | null>(null);

  // モーダル状態
  const [editingConcept, setEditingConcept] = useState(false);
  const [editingMeta, setEditingMeta] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [editingItem, setEditingItem] = useState<MoodboardItemRow | null>(null);
  const [uploading, setUploading] = useState(false);

  // ★ v2 改訂 + v4 複数選択: 画像追加モーダル(file[] select → カテゴリ select or 自動分析 → upload)用 state
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  // ★ v3 革新: 自動分析(default ON)+ URL から追加 + 分析中表示
  const [autoAnalyze, setAutoAnalyze] = useState(true);
  const [urlAddOpen, setUrlAddOpen] = useState(false);
  const [urlFetching, setUrlFetching] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  // ★ v4 複数選択: 進捗表示「N/M」
  const [progressCurrent, setProgressCurrent] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);

  // ★ v2 改訂: 必須要素 8 のカバー状況(useMemo で description + items から自動推定)
  const coverage = useMemo(() => {
    if (!mb) return new Set<EssentialCategory>();
    return detectEssentials(mb.description, mb.items);
  }, [mb]);

  // ---- データ取得 ----
  async function fetchMoodboard(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/moodboards/${mbId}`);
      if (!res.ok) {
        if (res.status === 404) setError("ムードボードが見つかりません");
        else if (res.status === 401) setError("ログインが必要です");
        else setError("読み込みに失敗しました");
        setMb(null);
        return;
      }
      const data = (await res.json()) as { moodboard: MoodboardWithItems };
      setMb(data.moodboard);
    } catch {
      setError("読み込みに失敗しました");
      setMb(null);
    } finally {
      setLoading(false);
    }
  }

  // ---- userId 取得(uploadMoodboardImage で必要) ----
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    void supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  // ★ 統合 Sprint: 世界観フィッティング軸の体型プロフィール(MB → coordinate に注入)。
  // 未登録なら null → buildMoodboardPrompt は ★ 既存出力と完全互換。
  const [bodyProfile, setBodyProfile] = useState<BodyProfile | null>(null);
  useEffect(() => {
    fetch("/api/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { bodyProfile: BodyProfile | null } | null) => {
        if (data?.bodyProfile) setBodyProfile(data.bodyProfile);
      })
      .catch(() => { /* 未認証/エラー時は体型なし扱い */ });
  }, []);

  useEffect(() => {
    if (mbId) void fetchMoodboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mbId]);

  // ★ Moodboard First Step 2: board 解析(brief)を取得して「設計図」セクションに表示する(読むだけ)。
  //   GET は生成しない(未解析なら analysis=null → セクション非表示)。失敗時も非表示で従来通り。
  useEffect(() => {
    if (!mbId) return;
    let cancelled = false;
    fetch(`/api/moodboards/${mbId}/analyze`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { analysis: MoodboardAnalysisRow | null } | null) => {
        if (!cancelled) setAnalysis(d?.analysis ?? null);
      })
      .catch(() => { /* 未解析/エラーは非表示(従来通り) */ });
    return () => { cancelled = true; };
  }, [mbId]);

  // ---- 画像追加(★ v2 改訂 + v4 複数選択: file[] select → モーダル → confirm → 順次 upload)----
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>): void {
    const fileList = e.target.files;
    // ★ v4 hotfix(5ea9e48 → 本 commit): FileList は input.value="" で無効化されるため、
    //   ★ Array.from で File 独立コピーを ★ value リセット **前** に取得する。
    //   旧版 v3 では file = e.target.files?.[0](File オブジェクト)を先に捕捉していたため
    //   value リセット後も File 参照が生き残った。v4 で FileList のまま reset → length 0 化
    //   → 早期 return → モーダル開かず というバグになっていた。
    if (fileList === null || fileList.length === 0) {
      e.target.value = "";
      return;
    }
    const files = Array.from(fileList);
    e.target.value = "";
    setPendingFiles(files);
  }

  async function handleAddImageConfirm(
    files: File[],
    category: EssentialCategory | "",
    captionBody: string,
  ): Promise<void> {
    if (!mb || !userId || uploading || files.length === 0) return;

    // ★ v4: 手動モード(autoAnalyze OFF)+ 複数選択 = 警告(MVP は手動複数を非対応)
    if (!autoAnalyze && files.length > 1) {
      alert("複数画像の手動分類は対応していません。自動分析(beta)を ON にしてください。");
      return;
    }

    setUploading(true);
    if (autoAnalyze) setAnalyzing(true);
    setProgressTotal(files.length);
    setProgressCurrent(0);

    let succeeded = 0;
    let failed = 0;
    let lastVisionFailed = false;

    try {
      // ★ v4: 順次 upload + analyze(★ サーバー負荷分散 + UI 進捗表示)
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setProgressCurrent(i + 1);
        try {
          // 1) クライアント側 EXIF 除去 + Storage upload(M3 同型・lib/storage.ts ec12f7b)
          const imageUrl = await uploadMoodboardImage(userId, mb.id, file);

          if (autoAnalyze) {
            // ★ v3: 自動分析経路 = POST /items/analyze(1 リクエスト 1 画像・既存 API そのまま)
            const res = await fetch(`/api/moodboards/${mb.id}/items/analyze`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ image_url: imageUrl }),
            });
            if (!res.ok) {
              failed++;
              continue;
            }
            const data = (await res.json()) as AnalyzeItemResponse;
            if (data.analysis === null) lastVisionFailed = true;
          } else {
            // ★ v2 既存: 手動経路 = POST /items(★ 単数のみ・autoAnalyze OFF + 1 file 時のみ到達)
            const caption = withCategoryPrefix(category, captionBody);
            const res = await fetch(`/api/moodboards/${mb.id}/items`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                image_url: imageUrl,
                caption,
                order_index: mb.items.length + succeeded,
              }),
            });
            if (!res.ok) {
              failed++;
              continue;
            }
          }
          succeeded++;
        } catch {
          failed++;
        }
      }

      // ★ v4: 部分失敗・Vision 失敗の通知(複数 = 集約 / 単数 = 既存メッセージ)
      if (files.length > 1) {
        if (failed > 0 && succeeded > 0) {
          alert(`${files.length}枚中 ${succeeded}枚成功・${failed}枚失敗しました`);
        } else if (failed > 0 && succeeded === 0) {
          alert("画像追加に全て失敗しました");
        }
      } else if (lastVisionFailed) {
        alert("自動分析できませんでした。手動で編集できます。");
      } else if (failed > 0) {
        alert("画像追加に失敗しました");
      }

      setPendingFiles([]);
      await fetchMoodboard();
    } catch (err) {
      alert(err instanceof Error ? err.message : "画像追加に失敗しました");
    } finally {
      setUploading(false);
      setAnalyzing(false);
      setProgressCurrent(0);
      setProgressTotal(0);
    }
  }

  // ★ v3 新規: URL から追加(/items/from-url 呼出)
  async function handleAddFromUrl(url: string): Promise<void> {
    if (!mb || urlFetching) return;
    const trimmed = url.trim();
    if (trimmed === "") return;
    setUrlFetching(true);
    try {
      const res = await fetch(`/api/moodboards/${mb.id}/items/from-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        alert(err.error ?? "URL からの追加に失敗しました");
        return;
      }
      const data = (await res.json()) as FromUrlItemResponse;
      if (data.analysis === null) {
        alert("画像は追加されましたが、自動分析できませんでした。手動で編集できます。");
      }
      setUrlAddOpen(false);
      await fetchMoodboard();
    } catch (err) {
      alert(err instanceof Error ? err.message : "URL からの追加に失敗しました");
    } finally {
      setUrlFetching(false);
    }
  }

  // ---- ★ Sprint C-3: 撮影前 CTA / 「チャットに渡す」共通の遷移 helper ----
  //   sessionStorage 経由で ChatPage に MB prompt を渡す(URL param 長さ制限回避)
  function handleShoot(): void {
    if (!mb) return;
    if (typeof window !== "undefined") {
      if (MB_CONTEXT_OBJECT) {
        // ★ Phase 2: 長文 prompt を渡さず MB を添付（ChatPage が analysis を読んで短文応答）。
        sessionStorage.setItem("mb_id", mb.id);
        sessionStorage.setItem("mb_name", mb.name);
        sessionStorage.removeItem("mb_prompt");
      } else {
        // 旧経路（フラグ off）: buildMoodboardPrompt の長文を渡す。
        const prompt = buildMoodboardPrompt(mb, bodyProfile ?? undefined);
        sessionStorage.setItem("mb_prompt", prompt);
        sessionStorage.setItem("mb_id", mb.id);
      }
    }
    router.push("/ai");
  }

  // ---- 削除 ----
  async function handleDeleteMoodboard(): Promise<void> {
    if (!mb) return;
    try {
      const res = await fetch(`/api/moodboards/${mb.id}`, { method: "DELETE" });
      if (!res.ok) {
        alert("削除に失敗しました");
        return;
      }
      router.push("/moodboard");
    } catch {
      alert("削除に失敗しました");
    }
  }

  async function handleDeleteItem(itemId: string): Promise<void> {
    if (!mb) return;
    if (!window.confirm("この画像を削除しますか?")) return;
    try {
      const res = await fetch(`/api/moodboards/${mb.id}/items/${itemId}`, { method: "DELETE" });
      if (!res.ok) {
        alert("削除に失敗しました");
        return;
      }
      await fetchMoodboard();
    } catch {
      alert("削除に失敗しました");
    }
  }

  // ---- レンダリング ----
  if (loading) {
    return <div className="min-h-screen bg-white flex items-center justify-center text-sm text-gray-300">読み込み中...</div>;
  }
  if (error !== null || mb === null) {
    return (
      <div className="min-h-screen bg-white pb-24">
        <div className="max-w-lg mx-auto px-4 py-12 space-y-4">
          <Link href="/moodboard" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800">
            <ArrowLeft size={12} /> 一覧へ戻る
          </Link>
          <p className="text-sm text-gray-500">{error ?? "見つかりません"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-24">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
        {/* ヘッダ */}
        <div className="flex items-center justify-between gap-3">
          <Link href="/moodboard" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800">
            <ArrowLeft size={14} /> 一覧
          </Link>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setEditingMeta(true)}
              className="text-xs px-2.5 py-1.5 text-gray-600 hover:text-gray-900 inline-flex items-center gap-1"
            >
              <Edit3 size={12} /> 編集
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="text-xs px-2.5 py-1.5 text-gray-500 hover:text-red-600 inline-flex items-center gap-1"
            >
              <Trash2 size={12} /> 削除
            </button>
          </div>
        </div>

        {/* MB 名 */}
        <div>
          <p className="text-xs tracking-widest text-gray-400 uppercase mb-1">Moodboard</p>
          <h1 className="text-2xl font-light text-gray-900">{mb.name}</h1>
        </div>

        {/* メインビジュアル */}
        <div className="relative aspect-video bg-gray-50 rounded-2xl overflow-hidden">
          {mb.cover_image_url !== null && mb.cover_image_url !== "" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mb.cover_image_url} alt={mb.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300">
              <ImageIcon size={40} strokeWidth={1.4} />
            </div>
          )}
          <span
            className={`absolute top-3 right-3 inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full ${
              mb.is_public ? "bg-white/90 text-gray-700" : "bg-gray-900/70 text-white"
            }`}
          >
            {mb.is_public ? <><Globe size={11} /> 公開</> : <><Lock size={11} /> 非公開</>}
          </span>
        </div>

        {/* コンセプト */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs tracking-widest text-gray-400 uppercase">Concept</p>
            <button
              type="button"
              onClick={() => setEditingConcept(true)}
              className="text-[11px] text-gray-500 hover:text-gray-800 inline-flex items-center gap-1"
            >
              <Edit3 size={11} /> 編集
            </button>
          </div>
          {mb.description !== "" ? (
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{mb.description}</p>
          ) : (
            <div className="border border-dashed border-gray-200 rounded-2xl p-4">
              <p className="text-xs text-gray-500 leading-relaxed">
                ヒント: モデル・場所・光・色を 1 つの記述で書いてみよう
              </p>
              <p className="text-[11px] text-gray-400 mt-2">
                例:「孤独な富裕層 / 海岸 / 夕方 / 濃紺・白」
              </p>
              <button
                type="button"
                onClick={() => setEditingConcept(true)}
                className="mt-3 text-xs text-gray-700 underline underline-offset-2 hover:text-gray-900"
              >
                コンセプトを書く →
              </button>
            </div>
          )}
        </section>

        {/* ★ Moodboard First Step 2: brief(+既存analysis)を「設計図」として表示(読むだけ・空なら非表示) */}
        <BriefSection analysis={analysis} />

        {/* ★ v2 改訂: 必須要素 8 進捗 + チェックリスト */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs tracking-widest text-gray-400 uppercase">Essentials</p>
            <span className="text-[11px] text-gray-500">{coverage.size}/8 カバー</span>
          </div>
          {/* 進捗バー */}
          <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${coverage.size === 8 ? "bg-gray-800" : "bg-gray-400"}`}
              style={{ width: `${(coverage.size / 8) * 100}%` }}
            />
          </div>
          {/* チェックリスト(2 列グリッド) */}
          <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5">
            {ESSENTIAL_CATEGORIES.map((c) => {
              const isCovered = coverage.has(c);
              return (
                <li
                  key={c}
                  className={`flex items-center gap-1.5 text-[12px] ${isCovered ? "text-gray-800" : "text-gray-400"}`}
                >
                  {isCovered ? (
                    <Check size={11} strokeWidth={2.5} className="text-gray-700" />
                  ) : (
                    <span className="inline-block w-[11px] text-center">・</span>
                  )}
                  {ESSENTIAL_LABELS[c]}
                </li>
              );
            })}
          </ul>
          {coverage.size < 8 && (
            <p className="text-[11px] text-gray-400 leading-relaxed">
              ヒント: あと {8 - coverage.size} 要素埋めると撮影準備完了
            </p>
          )}
        </section>

        {/* ムードボード要素(items) */}
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs tracking-widest text-gray-400 uppercase">Moodboard</p>
            {/* ★ v3: 自動分析(beta)チェックボックス */}
            <label className="inline-flex items-center gap-1 text-[11px] text-gray-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoAnalyze}
                onChange={(e) => setAutoAnalyze(e.target.checked)}
                disabled={uploading || urlFetching}
                className="accent-gray-800"
              />
              <Wand2 size={11} strokeWidth={2} />
              自動分析(beta)
            </label>
          </div>

          {/* ★ v3: 画像追加 + URL から追加 ボタン列 */}
          <div className="flex gap-2">
            <label className={`flex-1 inline-flex items-center justify-center gap-1 text-xs px-3 py-2 bg-gray-800 text-white rounded-xl hover:bg-gray-700 cursor-pointer transition-colors ${uploading ? "opacity-50 cursor-wait" : ""}`}>
              <Plus size={12} />
              {analyzing
                ? progressTotal > 1
                  ? `分析中... (${progressCurrent}/${progressTotal})`
                  : "分析中..."
                : uploading
                  ? progressTotal > 1
                    ? `アップロード中... (${progressCurrent}/${progressTotal})`
                    : "アップロード中..."
                  : "画像追加"}
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                hidden
                disabled={uploading}
                onChange={handleFileSelect}
              />
            </label>
            <button
              type="button"
              onClick={() => setUrlAddOpen(true)}
              disabled={uploading || urlFetching}
              className="flex-1 inline-flex items-center justify-center gap-1 text-xs px-3 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <Link2 size={12} />
              URL から追加
            </button>
          </div>

          {/* 空 MB CTA */}
          {mb.items.length === 0 && (
            <div className="border border-dashed border-gray-200 rounded-2xl p-6 text-center space-y-2">
              <p className="text-sm text-gray-500">参考画像はまだありません</p>
              <p className="text-[11px] text-gray-400 leading-relaxed">
                Vogue / Pinterest から最初の参考画像を保存しよう
              </p>
            </div>
          )}

          {/* items 1-2 件時ガイド */}
          {mb.items.length > 0 && mb.items.length < 3 && (
            <p className="text-[11px] text-gray-400 leading-relaxed px-1">
              ヒント: ヘア・メイク・服・光・ロケーション・色 を集めよう
            </p>
          )}

          {/* グリッド */}
          {mb.items.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {mb.items.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  onClick={() => setEditingItem(item)}
                  onDelete={() => void handleDeleteItem(item.id)}
                />
              ))}
            </div>
          )}
        </section>

        {/* アクション */}
        <section className="pt-2 space-y-2">
          {/* ★ v2 改訂 + Sprint C-3 本配線: 撮影前 CTA(8/8 達成時) */}
          {coverage.size === 8 && (
            <div className="border border-gray-800 bg-gray-50 rounded-2xl p-4 text-center space-y-2">
              <p className="text-sm text-gray-800 inline-flex items-center justify-center gap-1.5">
                <Sparkles size={14} strokeWidth={2} />
                必須要素 8/8 カバー完了!
              </p>
              <button
                type="button"
                onClick={handleShoot}
                className="inline-flex items-center justify-center gap-2 text-sm px-4 py-2 bg-gray-800 text-white rounded-xl hover:bg-gray-700 transition-colors"
              >
                このムードボードで撮影する
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={handleShoot}
            className="w-full inline-flex items-center justify-center gap-2 text-sm px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors"
          >
            <MessageCircle size={14} />
            チャットに渡す
          </button>
        </section>
      </div>

      {/* ---- ★ v2 改訂 + v3 拡張 + v4 複数選択: 画像追加モーダル ---- */}
      {pendingFiles.length > 0 && (
        <ImageAddModal
          files={pendingFiles}
          onClose={() => setPendingFiles([])}
          onConfirm={async (category, captionBody) => {
            await handleAddImageConfirm(pendingFiles, category, captionBody);
          }}
          uploading={uploading}
          analyzing={analyzing}
          autoAnalyze={autoAnalyze}
          progressCurrent={progressCurrent}
          progressTotal={progressTotal}
        />
      )}

      {/* ---- ★ v3 新規: URL から追加 モーダル ---- */}
      {urlAddOpen && (
        <UrlAddModal
          urlFetching={urlFetching}
          onClose={() => setUrlAddOpen(false)}
          onConfirm={handleAddFromUrl}
        />
      )}

      {/* ---- コンセプト編集モーダル ---- */}
      {editingConcept && (
        <ConceptEditModal
          mbId={mb.id}
          initial={mb.description}
          onClose={() => setEditingConcept(false)}
          onSaved={async () => {
            setEditingConcept(false);
            await fetchMoodboard();
          }}
        />
      )}

      {/* ---- caption 編集モーダル ---- */}
      {editingItem !== null && (
        <CaptionEditModal
          mbId={mb.id}
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSaved={async () => {
            setEditingItem(null);
            await fetchMoodboard();
          }}
        />
      )}

      {/* ---- MB メタ編集モーダル ---- */}
      {editingMeta && (
        <MetaEditModal
          mb={mb}
          onClose={() => setEditingMeta(false)}
          onSaved={async () => {
            setEditingMeta(false);
            await fetchMoodboard();
          }}
        />
      )}

      {/* ---- 削除 confirm モーダル ---- */}
      {confirmingDelete && (
        <ConfirmModal
          message={`「${mb.name}」を削除しますか?画像も含めて削除されます。`}
          confirmLabel="削除"
          danger
          onConfirm={async () => {
            setConfirmingDelete(false);
            await handleDeleteMoodboard();
          }}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </div>
  );
}

// ====================================================================
// ItemCard
// ====================================================================
function ItemCard({
  item, onClick, onDelete,
}: {
  item: MoodboardItemRow;
  onClick: () => void;
  onDelete: () => void;
}) {
  // ★ v2 改訂: caption からカテゴリプレフィックスを抽出してバッジ表示
  const category = extractCategory(item.caption);
  const captionBody = stripCategoryPrefix(item.caption);

  return (
    <div className="relative group rounded-2xl overflow-hidden border border-gray-100">
      <button type="button" onClick={onClick} className="block w-full">
        <div className="aspect-square bg-gray-50 relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.image_url} alt={captionBody || "moodboard item"} className="w-full h-full object-cover" />
          {/* ★ v2 改訂: カテゴリバッジ(左上) */}
          {category !== null && (
            <span className="absolute top-1.5 left-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-white/90 text-gray-700">
              {ESSENTIAL_LABELS[category]}
            </span>
          )}
        </div>
        {captionBody !== "" && (
          <p className="text-[11px] text-gray-600 truncate px-2 py-1.5 text-left">{captionBody}</p>
        )}
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label="画像を削除"
        className="absolute top-1.5 right-1.5 bg-white/90 text-gray-700 hover:text-red-600 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <X size={12} />
      </button>
    </div>
  );
}

// ====================================================================
// ★ v2 改訂: ImageAddModal — file 選択後・upload 前にカテゴリ + caption を確定
// ====================================================================
function ImageAddModal({
  files, uploading, analyzing, autoAnalyze, progressCurrent, progressTotal, onClose, onConfirm,
}: {
  files: File[];
  uploading: boolean;
  analyzing: boolean;
  autoAnalyze: boolean;
  progressCurrent: number;
  progressTotal: number;
  onClose: () => void;
  onConfirm: (category: EssentialCategory | "", captionBody: string) => void | Promise<void>;
}) {
  const [category, setCategory] = useState<EssentialCategory | "">("");
  const [body, setBody] = useState("");
  // ★ v4: 複数 file プレビュー URL(component unmount 時に全 revoke)
  const previewUrls = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previewUrls.forEach((u) => URL.revokeObjectURL(u)), [previewUrls]);

  const placeholder = category === ""
    ? "観察メモ(例: 濡れ髪のラフな束ね)"
    : `${ESSENTIAL_LABELS[category]} のメモ(例: 濡れ髪のラフな束ね)`;

  const isMulti = files.length > 1;
  const progressLabel = progressTotal > 1 ? ` (${progressCurrent}/${progressTotal})` : "";

  // ★ v3: 自動分析 ON 時は category select + textarea を隠し・「画像を AI が分析します」notice 表示
  // ★ v3: 自動分析 OFF 時は v2 既存フロー(category select + textarea)
  // ★ v4: 複数 file 対応(プレビューグリッド + 枚数表示 + 進捗 N/M)
  return (
    <ModalShell onClose={onClose} title={autoAnalyze ? "Add Image(自動分析)" : "Add Image"}>
      {isMulti ? (
        <>
          <p className="text-[11px] text-gray-600">{files.length}枚選択中</p>
          <div className="grid grid-cols-4 gap-1.5">
            {previewUrls.map((url, i) => (
              <div key={i} className="aspect-square rounded-lg overflow-hidden border border-gray-100 relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="w-full h-full object-cover" />
                {analyzing && progressCurrent === i + 1 && (
                  <div className="absolute inset-0 bg-white/70 flex items-center justify-center text-[10px] text-gray-700">
                    分析中
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={previewUrls[0]} alt="" className="w-full max-h-40 object-cover rounded-xl" />
      )}

      {autoAnalyze ? (
        // ★ v3: 自動分析モード
        <div className="space-y-2">
          <div className="border border-gray-100 bg-gray-50 rounded-xl p-3 space-y-1">
            <p className="text-[11px] text-gray-700 inline-flex items-center gap-1">
              <Wand2 size={11} strokeWidth={2} />
              {isMulti
                ? `${files.length}枚の画像を AI が順次分析します(カテゴリ + メモ + 主要色)`
                : "画像を AI が分析します(カテゴリ + メモ + 主要色)"}
            </p>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              {analyzing
                ? `分析中...${progressLabel}(2-5 秒/枚)`
                : "「追加」を押すと分析が始まります。"}
            </p>
          </div>
        </div>
      ) : isMulti ? (
        // ★ v4: 手動モード + 複数選択 = 警告(MVP は非対応・自動分析 ON 推奨)
        <div className="border border-amber-200 bg-amber-50 rounded-xl p-3">
          <p className="text-[11px] text-amber-800 leading-relaxed">
            ★ 複数画像の手動分類は対応していません。自動分析(beta)を ON にしてください。
          </p>
        </div>
      ) : (
        // ★ v2 既存: 手動モード(category select + textarea)
        <>
          <div className="space-y-2">
            <label className="text-[10px] tracking-widest text-gray-400 uppercase">Category(任意)</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as EssentialCategory | "")}
              disabled={uploading}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-gray-400 bg-white"
            >
              <option value="">— 選択しない —</option>
              {ESSENTIAL_CATEGORIES.map((c) => (
                <option key={c} value={c}>{ESSENTIAL_LABELS[c]}</option>
              ))}
            </select>
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, 500))}
            placeholder={placeholder}
            rows={3}
            disabled={uploading}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:border-gray-400 resize-none"
          />
        </>
      )}

      <ModalFooter
        onCancel={onClose}
        onConfirm={() => void onConfirm(autoAnalyze ? "" : category, autoAnalyze ? "" : body)}
        confirmLabel={
          analyzing
            ? `分析中...${progressLabel}`
            : uploading
              ? `アップロード中...${progressLabel}`
              : isMulti
                ? `${files.length}枚 追加 →`
                : "追加 →"
        }
        disabled={uploading || (isMulti && !autoAnalyze)}
      />
    </ModalShell>
  );
}

// ====================================================================
// ★ v3 新規: UrlAddModal — Pinterest / Instagram / Vogue 等の URL から追加
// ====================================================================
function UrlAddModal({
  urlFetching, onClose, onConfirm,
}: {
  urlFetching: boolean;
  onClose: () => void;
  onConfirm: (url: string) => void | Promise<void>;
}) {
  const [url, setUrl] = useState("");

  return (
    <ModalShell onClose={onClose} title="URL から追加">
      <input
        type="url"
        autoFocus
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Pinterest / Instagram / Vogue の URL を貼り付け"
        disabled={urlFetching}
        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:border-gray-400"
        onKeyDown={(e) => {
          if (e.key === "Enter" && url.trim() !== "") void onConfirm(url);
        }}
      />
      <div className="border border-gray-100 bg-gray-50 rounded-xl p-3 space-y-1">
        <p className="text-[11px] text-gray-700 inline-flex items-center gap-1">
          <Link2 size={11} strokeWidth={2} />
          対応プラットフォーム
        </p>
        <p className="text-[11px] text-gray-500 leading-relaxed">
          Pinterest / Instagram / Vogue / 直接画像 URL(.jpg / .png / .webp)
        </p>
        <p className="text-[11px] text-gray-400 leading-relaxed">
          {urlFetching
            ? "取得中... (5-10 秒お待ちください)"
            : "URL から画像を取り込み、AI が自動分析します。"}
        </p>
      </div>
      <ModalFooter
        onCancel={onClose}
        onConfirm={() => void onConfirm(url)}
        confirmLabel={urlFetching ? "取得中..." : "取得 →"}
        disabled={urlFetching || url.trim() === ""}
      />
    </ModalShell>
  );
}

// ====================================================================
// ★ Moodboard First Step 2: 「このムードボードの設計図」表示専用セクション。
//   brief(Step1)+ 既存 analysis(materials/silhouettes/ng_elements/colors) を読むだけ。書き換えない。
//   3段構成: 上段=世界観の核(concept/story) / 中段=写真から読み取った場面 / 下段=服に落とす情報。
//   ⚠️「今あるものだけ出す」: brandMatches/searchKeywords/outfitRules は未存在なので出さない(後段で項目が増えたらここに足す)。
//   inferred(推測)の値にだけ控えめな「推測」マーカー。空(null/{} かつ下段も無)なら非表示=既存画面は従来通り。
const BRIEF_MIDDLE: { key: keyof MoodboardBrief; label: string }[] = [
  { key: "person",    label: "人物" },
  { key: "lifestyle", label: "ライフスタイル" },
  { key: "location",  label: "ロケーション" },
  { key: "light",     label: "光" },
  { key: "hair",      label: "ヘア" },
  { key: "makeup",    label: "メイク" },
];

function InferredTag() {
  // ★ 控えめな小pill(薄グレー・角丸・本文と視覚的に分離)。値の一部に見せない。
  return (
    <span className="ml-1.5 inline-flex items-center align-middle text-[10px] leading-none text-gray-400 bg-gray-100 rounded-full px-1.5 py-[3px] whitespace-nowrap">
      推測
    </span>
  );
}

function NamePills({ items, tone }: { items: string[]; tone: "solid" | "soft" }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((t, i) => (
        <span
          key={i}
          className={`text-[11px] px-2 py-0.5 rounded-full ${
            tone === "solid" ? "bg-gray-800 text-white" : "bg-white border border-gray-200 text-gray-600"
          }`}
        >
          {t}
        </span>
      ))}
    </div>
  );
}

function BriefLowerRow({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="flex gap-2 text-[13px]">
      <span className="text-gray-400 w-20 flex-shrink-0">{label}</span>
      <span className="text-gray-700">{items.join(" / ")}</span>
    </div>
  );
}

function BriefSection({ analysis }: { analysis: MoodboardAnalysisRow | null }) {
  if (!analysis) return null;
  const brief: MoodboardBrief = analysis.brief ?? {};
  const cp = brief.colorPalette;

  const middle = BRIEF_MIDDLE
    .map((m) => ({ ...m, field: brief[m.key] as BriefField | undefined }))
    .filter((m): m is typeof m & { field: BriefField } => !!(m.field && m.field.value));

  const materials   = analysis.materials ?? [];
  const silhouettes = analysis.silhouettes ?? [];
  const ng          = analysis.ng_elements ?? [];

  const hasUpper = !!(brief.concept?.value || brief.story?.value);
  const hasMiddle = middle.length > 0;
  const hasColor = !!(cp && (cp.main.length > 0 || cp.accent.length > 0 || cp.saturation));
  const hasLower = hasColor || materials.length > 0 || silhouettes.length > 0 || ng.length > 0;
  if (!hasUpper && !hasMiddle && !hasLower) return null;

  return (
    <section className="space-y-4 border border-gray-100 rounded-2xl p-4 bg-gray-50/60">
      <div>
        <p className="text-xs tracking-widest text-gray-400 uppercase">このムードボードの設計図</p>
        <p className="text-[11px] text-gray-400 mt-0.5">AIが画像から読み取った世界観・服・ブランドの注釈</p>
      </div>

      {/* 上段: 世界観の核 */}
      {hasUpper && (
        <div className="space-y-1.5">
          {brief.concept?.value && (
            <p className="text-base font-bold text-gray-900">
              {brief.concept.value}
              {brief.concept.basis === "inferred" && <InferredTag />}
            </p>
          )}
          {brief.story?.value && (
            <div className="space-y-1">
              <p className="text-sm text-gray-700 leading-relaxed">{brief.story.value}</p>
              {/* story は文章なので推測pillを文末ベタ付けせず独立行(右寄せ)に */}
              {brief.story.basis === "inferred" && (
                <div className="flex justify-end"><InferredTag /></div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 中段: 写真から読み取った場面 */}
      {hasMiddle && (
        <div className="space-y-1.5">
          {middle.map((m) => (
            <div key={m.key} className="flex gap-2 text-[13px]">
              <span className="text-gray-400 w-20 flex-shrink-0">{m.label}</span>
              <span className="text-gray-700">
                {m.field.value}
                {m.field.basis === "inferred" && <InferredTag />}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 下段: 服に落とす情報(今あるものだけ) */}
      {hasLower && (
        <div className="space-y-2 border-t border-gray-100 pt-3">
          {hasColor && cp && (
            <div className="space-y-1.5">
              <p className="text-[11px] text-gray-500">
                カラー
                {cp.basis === "inferred" && <InferredTag />}
              </p>
              {cp.main.length > 0 && <NamePills items={cp.main} tone="solid" />}
              {cp.accent.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-gray-400 flex-shrink-0">差し色</span>
                  <NamePills items={cp.accent} tone="soft" />
                </div>
              )}
              {cp.saturation && <p className="text-[11px] text-gray-500">{cp.saturation}</p>}
            </div>
          )}
          {materials.length > 0 && <BriefLowerRow label="素材" items={materials} />}
          {silhouettes.length > 0 && <BriefLowerRow label="シルエット" items={silhouettes} />}
          {ng.length > 0 && <BriefLowerRow label="避ける" items={ng} />}
        </div>
      )}
    </section>
  );
}

// ConceptEditModal — description 編集(★ プロセス誘導 placeholder + 例文)
// ====================================================================
function ConceptEditModal({
  mbId, initial, onClose, onSaved,
}: {
  mbId: string;
  initial: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);

  async function handleSave(): Promise<void> {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/moodboards/${mbId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: value.slice(0, DESCRIPTION_MAX) }),
      });
      if (!res.ok) {
        alert("保存に失敗しました");
        return;
      }
      await onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell onClose={onClose} title="Concept">
      <textarea
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value.slice(0, DESCRIPTION_MAX))}
        placeholder="コンセプト: 例『孤独な富裕層 / 海岸 / 夕方 / 濃紺・白』"
        rows={4}
        disabled={saving}
        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:border-gray-400 resize-none"
      />
      <div className="space-y-1.5">
        <p className="text-[10px] tracking-widest text-gray-400 uppercase">例(タップで挿入)</p>
        <div className="flex flex-wrap gap-1.5">
          {CONCEPT_EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setValue(ex)}
              disabled={saving}
              className="text-[11px] text-gray-600 px-2 py-1 rounded-md border border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 transition-colors disabled:opacity-50"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>
      <ModalFooter
        onCancel={onClose}
        onConfirm={handleSave}
        confirmLabel={saving ? "保存中..." : "保存 →"}
        disabled={saving}
      />
    </ModalShell>
  );
}

// ====================================================================
// CaptionEditModal — item caption 編集(★ プロセス誘導 placeholder)
// ====================================================================
function CaptionEditModal({
  mbId, item, onClose, onSaved,
}: {
  mbId: string;
  item: MoodboardItemRow;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  // ★ v2 改訂: 既存 caption から [category] と本体を分離して個別編集
  const [category, setCategory] = useState<EssentialCategory | "">(extractCategory(item.caption) ?? "");
  const [body, setBody] = useState(stripCategoryPrefix(item.caption));
  const [saving, setSaving] = useState(false);

  async function handleSave(): Promise<void> {
    if (saving) return;
    setSaving(true);
    try {
      const combined = withCategoryPrefix(category, body).slice(0, CAPTION_MAX);
      const res = await fetch(`/api/moodboards/${mbId}/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caption: combined }),
      });
      if (!res.ok) {
        alert("保存に失敗しました");
        return;
      }
      await onSaved();
    } finally {
      setSaving(false);
    }
  }

  const placeholder = category === ""
    ? "観察メモ: 例『濡れ髪』『夕方の逆光』『砂色のリネン』"
    : `${ESSENTIAL_LABELS[category]} のメモ(例: 濡れ髪のラフな束ね)`;

  return (
    <ModalShell onClose={onClose} title="Caption">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={item.image_url} alt="" className="w-full max-h-40 object-cover rounded-xl" />
      {/* ★ v2 改訂: カテゴリ select(必須要素 8 の分類) */}
      <div className="space-y-2">
        <label className="text-[10px] tracking-widest text-gray-400 uppercase">Category(任意)</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as EssentialCategory | "")}
          disabled={saving}
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-gray-400 bg-white"
        >
          <option value="">— 選択しない —</option>
          {ESSENTIAL_CATEGORIES.map((c) => (
            <option key={c} value={c}>{ESSENTIAL_LABELS[c]}</option>
          ))}
        </select>
      </div>
      <textarea
        autoFocus
        value={body}
        onChange={(e) => setBody(e.target.value.slice(0, CAPTION_MAX))}
        placeholder={placeholder}
        rows={3}
        disabled={saving}
        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:border-gray-400 resize-none"
      />
      <ModalFooter
        onCancel={onClose}
        onConfirm={handleSave}
        confirmLabel={saving ? "保存中..." : "保存 →"}
        disabled={saving}
      />
    </ModalShell>
  );
}

// ====================================================================
// MetaEditModal — name/description/is_public/cover_image_url 編集
// ====================================================================
function MetaEditModal({
  mb, onClose, onSaved,
}: {
  mb: MoodboardWithItems;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState(mb.name);
  const [description, setDescription] = useState(mb.description);
  const [isPublic, setIsPublic] = useState(mb.is_public);
  const [coverUrl, setCoverUrl] = useState(mb.cover_image_url ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave(): Promise<void> {
    if (saving || name.trim() === "") return;
    setSaving(true);
    try {
      const res = await fetch(`/api/moodboards/${mb.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim().slice(0, NAME_MAX),
          description: description.slice(0, DESCRIPTION_MAX),
          is_public: isPublic,
          cover_image_url: coverUrl === "" ? null : coverUrl,
        }),
      });
      if (!res.ok) {
        alert("保存に失敗しました");
        return;
      }
      await onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell onClose={onClose} title="Edit Moodboard">
      <div className="space-y-2">
        <label className="text-[10px] tracking-widest text-gray-400 uppercase">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, NAME_MAX))}
          disabled={saving}
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-gray-400"
        />
      </div>
      <div className="space-y-2">
        <label className="text-[10px] tracking-widest text-gray-400 uppercase">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, DESCRIPTION_MAX))}
          placeholder="コンセプト: 例『孤独な富裕層 / 海岸 / 夕方 / 濃紺・白』"
          rows={3}
          disabled={saving}
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:border-gray-400 resize-none"
        />
      </div>
      {mb.items.length > 0 && (
        <div className="space-y-2">
          <label className="text-[10px] tracking-widest text-gray-400 uppercase">Cover Image</label>
          <div className="grid grid-cols-4 gap-1.5">
            <button
              type="button"
              onClick={() => setCoverUrl("")}
              disabled={saving}
              className={`aspect-square rounded-lg border-2 flex items-center justify-center text-gray-300 ${coverUrl === "" ? "border-gray-800" : "border-gray-200"}`}
            >
              <X size={14} />
            </button>
            {mb.items.map((it) => (
              <button
                key={it.id}
                type="button"
                onClick={() => setCoverUrl(it.image_url)}
                disabled={saving}
                className={`aspect-square rounded-lg overflow-hidden border-2 ${coverUrl === it.image_url ? "border-gray-800" : "border-gray-200"}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={it.image_url} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={isPublic}
          onChange={(e) => setIsPublic(e.target.checked)}
          disabled={saving}
        />
        公開する(URL 知る人なら誰でも閲覧可)
      </label>
      <ModalFooter
        onCancel={onClose}
        onConfirm={handleSave}
        confirmLabel={saving ? "保存中..." : "保存 →"}
        disabled={saving || name.trim() === ""}
      />
    </ModalShell>
  );
}

// ====================================================================
// ConfirmModal — 削除 confirm
// ====================================================================
function ConfirmModal({
  message, confirmLabel, danger, onConfirm, onCancel,
}: {
  message: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}) {
  return (
    <ModalShell onClose={onCancel} title="確認">
      <p className="text-sm text-gray-700 leading-relaxed">{message}</p>
      <ModalFooter
        onCancel={onCancel}
        onConfirm={onConfirm}
        confirmLabel={confirmLabel}
        danger={danger}
      />
    </ModalShell>
  );
}

// ====================================================================
// ModalShell — モーダル外枠(段階3-A + InputAttachments と同型作法)
// ====================================================================
function ModalShell({
  title, onClose, children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 space-y-3 pointer-events-auto max-h-[90vh] overflow-y-auto">
          <p className="text-xs tracking-widest text-gray-400 uppercase">{title}</p>
          {children}
        </div>
      </div>
    </>
  );
}

function ModalFooter({
  onCancel, onConfirm, confirmLabel, disabled, danger,
}: {
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
  confirmLabel: string;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="flex justify-end gap-2 pt-1">
      <button
        type="button"
        onClick={onCancel}
        disabled={disabled}
        className="text-xs px-3 py-1.5 text-gray-500 hover:text-gray-800 disabled:opacity-50"
      >
        キャンセル
      </button>
      <button
        type="button"
        onClick={() => void onConfirm()}
        disabled={disabled}
        className={`text-xs px-3 py-1.5 text-white rounded-xl transition-colors disabled:opacity-50 ${danger ? "bg-red-600 hover:bg-red-700" : "bg-gray-800 hover:bg-gray-700"}`}
      >
        {confirmLabel}
      </button>
    </div>
  );
}
