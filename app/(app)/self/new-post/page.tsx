"use client";

// M3-3: 投稿作成ページ /self/new-post
//
// M3-2 で作った uploadPostImage(画像処理+EXIF除去+HEIC変換+Storage保存)と
// POST /api/posts(本人固定 author_user_id + 世界観スナップショット)を
// 繋ぐ薄い UI。新しいバックエンドロジックは作らない。
//
// 【作法】
// - 楽観的更新なし: uploadPostImage 成功 + /api/posts の ok:true を
//   両方確認してから done 状態へ(M2-4 公開トグルと同じ思想)。
//   途中で失敗したら selected に戻し、画像と caption は保持して再投稿可能に。
// - 二重投稿防止: processing 中は投稿ボタン + 画像差し替えを無効化。
// - 処理中表示: HEIC は heic-to の WASM ロードで 10〜15 秒かかるので、
//   「処理中…」+ 経過秒カウンタを必ず出す(M1 onboarding と同作法)。
// - 画像必須(判断1)を UI 側でも担保(ボタン disabled)。

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { uploadPostImage } from "@/lib/storage";

type Status = "idle" | "selected" | "processing" | "done" | "error";

interface DoneInfo {
  // M3-4 で /p/[id] 個別ページが完成したら [投稿を見る] リンクを足すため id を保持。
  id:          string;
  created_at:  string;
  imageUrl:    string;  // アップロード後の処理済み URL(done 画面のプレビュー用)
  caption:     string;
}

const CAPTION_MAX = 1000;

export default function NewPostPage() {
  const [status, setStatus]   = useState<Status>("idle");
  const [file, setFile]       = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState(false);
  const [caption, setCaption] = useState("");
  const [error, setError]     = useState<string | null>(null);
  const [done, setDone]       = useState<DoneInfo | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // 選択中 previewUrl の URL.createObjectURL を解放する
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (!f) return;
    // 旧プレビューを解放
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setPreviewError(false);
    setError(null);
    setStatus("selected");
  }

  async function handleSubmit() {
    if (!file) return;
    setError(null);
    setStatus("processing");

    let uploadedUrl: string | null = null;
    try {
      // 認証ユーザー取得
      const supabase = createSupabaseBrowserClient();
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr || !authData.user) {
        setError("ログインが必要です");
        setStatus("selected");
        return;
      }

      // 1) クライアントで画像処理 + EXIF 除去 + Storage 保存
      //    エラー文言は M3-2 で image-pipeline 内に元エラー含む形で構築済み(そのまま表示)
      try {
        uploadedUrl = await uploadPostImage(authData.user.id, file);
      } catch (e) {
        // 画像処理 or Storage 失敗。元エラーをそのまま表示(M3-2 で可視化済み)。
        setError(e instanceof Error ? e.message : "画像のアップロードに失敗しました");
        setStatus("selected");
        return;
      }

      // 2) /api/posts POST(本人固定 author_user_id + 世界観スナップショット)
      //    楽観的更新なし: ok:true 確認後にのみ done へ。
      const res = await fetch("/api/posts", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ image_url: uploadedUrl, caption }),
      });
      const data = await res.json() as {
        ok?: boolean;
        id?: string;
        created_at?: string;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.id || !data.created_at) {
        setError(data.error ?? `HTTP ${res.status}`);
        setStatus("selected");
        return;
        // 補足: ここで失敗すると uploadedUrl の画像が Storage に残る = 孤児画像。
        //       M3-2 で MVP 許容と決めた仕様。将来 deletePostImage(uploadedUrl) で
        //       ベストエフォート削除する余地あり。
      }

      // 3) 成功確定。done 状態へ。
      setDone({
        id:         data.id,
        created_at: data.created_at,
        imageUrl:   uploadedUrl,
        caption,
      });
      setStatus("done");
    } catch (e) {
      // 想定外
      setError(e instanceof Error ? e.message : "不明なエラー");
      setStatus("selected");
    }
  }

  function resetAndPostAgain() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setPreviewError(false);
    setCaption("");
    setError(null);
    setDone(null);
    setStatus("idle");
    // input をリセット(同じファイルでも再選択イベントが起きるよう)
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // ===== done 画面 =====
  if (status === "done" && done) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-lg mx-auto px-4 py-10 space-y-6">
          <div className="text-center space-y-2">
            <p className="text-4xl">✓</p>
            <h1 className="text-xl font-light text-gray-900">投稿が完了しました</h1>
          </div>

          {/* 処理後プレビュー(uploadedUrl) */}
          <div className="border border-gray-100 rounded-2xl overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={done.imageUrl} alt="posted" className="w-full" />
            {done.caption && (
              <p className="text-sm text-gray-700 px-4 py-3 leading-relaxed whitespace-pre-wrap">
                {done.caption}
              </p>
            )}
          </div>

          {/* M3-4 で /p/[id] 公開ページが完成したら [投稿を見る → /p/{done.id}] を追加。
              現状は id を done state に保持するのみ。 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={resetAndPostAgain}
              className="px-4 py-3 border border-gray-200 text-gray-700 rounded-xl text-sm hover:bg-gray-50 transition-colors"
            >
              もう一度投稿する
            </button>
            <Link
              href="/self"
              className="px-4 py-3 bg-gray-800 text-white rounded-xl text-sm text-center hover:bg-gray-700 transition-colors"
            >
              自分のページに戻る
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ===== フォーム / 処理中 =====
  const processing = status === "processing";
  const canSubmit = !!file && !processing;

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-lg mx-auto px-4 py-10 space-y-6">
        <Link href="/self" className="text-xs text-gray-500 hover:text-gray-900">
          ← 自分に戻る
        </Link>

        <header>
          <p className="text-xs tracking-widest text-gray-400 uppercase mb-1">New Post</p>
          <h1 className="text-2xl font-light text-gray-900">投稿を作る</h1>
          <p className="text-sm text-gray-500 mt-2 leading-relaxed">
            画像 1 枚 + キャプション(任意)で投稿します。
            撮影位置などの EXIF は自動で除去されます。
          </p>
        </header>

        {/* 画像選択 + プレビュー */}
        <div className="border border-gray-200 rounded-2xl p-5 space-y-3">
          <label className="block">
            <span className="text-sm text-gray-700 mb-2 block">
              画像を選択(jpeg / png / webp / heic / heif・必須)
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
              onChange={handleFile}
              disabled={processing}
              className="block w-full text-sm text-gray-700 file:mr-3 file:px-4 file:py-2 file:border file:border-gray-200 file:rounded-lg file:bg-white file:text-gray-700 file:hover:bg-gray-50 file:cursor-pointer disabled:opacity-50"
            />
          </label>

          {previewUrl && !previewError && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="preview"
              onError={() => setPreviewError(true)}
              className="w-full rounded-xl border border-gray-100"
            />
          )}
          {previewUrl && previewError && (
            <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-6 text-center text-xs text-gray-500">
              プレビュー非対応(HEIC は処理後にアップロードされます)
            </div>
          )}
        </div>

        {/* caption */}
        <div className="space-y-1">
          <label className="block">
            <span className="text-sm text-gray-700 mb-2 block">Caption(任意)</span>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value.slice(0, CAPTION_MAX))}
              disabled={processing}
              rows={4}
              maxLength={CAPTION_MAX}
              placeholder="この投稿について、何か言葉を添えたければ。"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:border-gray-400 resize-none disabled:opacity-50"
            />
          </label>
          <p className="text-[10px] text-gray-400 text-right">{caption.length} / {CAPTION_MAX}</p>
        </div>

        {/* エラー表示(画像処理 / Storage / API の 3 系統共通の表示先) */}
        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-xs text-rose-700 leading-relaxed">
            {error}
          </div>
        )}

        {/* 投稿ボタン */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full py-3.5 bg-gray-800 text-white rounded-xl text-sm font-medium hover:bg-gray-700 disabled:opacity-40 transition-colors"
        >
          投稿する
        </button>

        {/* 処理中オーバーレイ(経過秒) */}
        {processing && <ProcessingOverlay />}
      </div>
    </div>
  );
}

// 経過秒カウンタ(M1 onboarding AnalyzingScreen / M2-4 PreviewClient と同作法)。
// HEIC は heic-to の WASM ロードで 10〜15 秒かかるので、フリーズに見えないことが必須。
function ProcessingOverlay() {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - started) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="fixed inset-0 z-50 bg-white/85 flex items-center justify-center px-6">
      <div className="max-w-xs mx-auto text-center space-y-4">
        <p className="text-[10px] tracking-[0.3em] text-gray-400 uppercase">Posting</p>
        <h2 className="text-lg font-light text-gray-900 leading-snug">
          投稿を処理中…
        </h2>
        <p className="text-xs text-gray-500 leading-relaxed">
          画像処理(EXIF 除去)→ アップロード → 保存
        </p>
        <p className="text-3xl font-light text-gray-700 tabular-nums pt-2">
          {elapsed}<span className="text-base text-gray-400 ml-1">秒</span>
        </p>
        <p className="text-[10px] text-gray-400">
          HEIC は初回 WASM 読み込みで 10〜15 秒かかります
        </p>
      </div>
    </div>
  );
}
