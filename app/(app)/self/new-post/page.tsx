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
import { isHeic, convertHeicToJpeg } from "@/lib/utils/image-pipeline";

// M3-3 改善: HEIC プレビュー対応
// - HEIC 選択時は heic-to で JPEG に変換 → state に保持 → プレビュー
// - 投稿時は変換済み JPEG をそのまま渡す → processImageForUpload の isHeic が
//   自然に false → heic-to 二度起動なし(設計の核心)
// - EXIF/GPS 除去は変わらず最終 Canvas 再エンコードで担保(69ea622 / e89a397)
type Status = "idle" | "converting" | "selected" | "processing" | "done" | "error";

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
  const [caption, setCaption] = useState("");
  const [error, setError]     = useState<string | null>(null);
  const [done, setDone]       = useState<DoneInfo | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // (旧) mountedRef による「アンマウント後 setState 警告防御」を撤去した。
  //   React 18 では unmounted コンポーネントへの setState 警告は撤廃済みで、
  //   そもそも防御の目的が存在しない。さらに dev の Strict Mode で
  //   mount→cleanup→remount サイクルが走ると、素朴な mountedRef パターンは
  //   useEffect body で true に戻さない限り永遠に false に固定され、
  //   正常系の setState を握りつぶす(今回踏んだ罠・238秒ハングの正体)。
  //   不要な防御は撤去するのが正解(M2-4 の楽観的更新なし作法と同じ思想:
  //   本当に必要なものだけ持つ)。

  // 選択中 previewUrl の URL.createObjectURL を解放する
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (!f) return;
    setError(null);
    // 旧プレビューを解放
    if (previewUrl) URL.revokeObjectURL(previewUrl);

    if (isHeic(f)) {
      // HEIC は選択時に heic-to で JPEG 変換 → state に JPEG を保持。
      // 投稿時の processImageForUpload は isHeic(jpeg)=false で heic-to をスキップ
      //  → heic-to 二度起動なし(設計の核心)。
      // EXIF/GPS 除去は最終 Canvas 再エンコードで担保(69ea622 / e89a397)。
      setFile(null);
      setPreviewUrl(null);
      setStatus("converting");
      try {
        const jpeg = await convertHeicToJpeg(f);
        setFile(jpeg);
        setPreviewUrl(URL.createObjectURL(jpeg));
        setStatus("selected");
      } catch (err) {
        // M3-2 で可視化済みの元エラー(ERR_LIBHEIF 等)をそのまま表示
        setError(err instanceof Error ? err.message : "HEIC 変換に失敗しました");
        setFile(null);
        setPreviewUrl(null);
        setStatus("idle");
      }
      return;
    }

    // 非 HEIC(jpg/png/webp): 従来通り即プレビュー
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
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

          {/* M3-4: 投稿個別ページが完成したので、保持していた id で [投稿を見る] を追加(伏線回収)。 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Link
              href={`/p/${done.id}`}
              className="px-4 py-3 border border-gray-200 text-gray-700 rounded-xl text-sm text-center hover:bg-gray-50 transition-colors"
            >
              投稿を見る →
            </Link>
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
  const converting = status === "converting";
  // converting / processing 中は二重操作を構造的に阻止
  const inputDisabled  = processing || converting;
  const canSubmit      = !!file && !processing && !converting;

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
              disabled={inputDisabled}
              className="block w-full text-sm text-gray-700 file:mr-3 file:px-4 file:py-2 file:border file:border-gray-200 file:rounded-lg file:bg-white file:text-gray-700 file:hover:bg-gray-50 file:cursor-pointer disabled:opacity-50"
            />
          </label>

          {/* M3-3 改善: HEIC 変換中のインライン表示(オーバーレイではない)。
              フォームの自然な流れの中で「準備中」を出す。 */}
          {converting && <ConvertingInline />}

          {/* プレビュー(HEIC は変換後 JPEG なので表示できる)。
              onError は壊れた JPEG 等のレア防御として残し、失敗時は静かに非表示にする。 */}
          {previewUrl && !converting && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="preview"
              onError={() => setPreviewUrl(null)}
              className="w-full rounded-xl border border-gray-100"
            />
          )}
        </div>

        {/* caption */}
        <div className="space-y-1">
          <label className="block">
            <span className="text-sm text-gray-700 mb-2 block">Caption(任意)</span>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value.slice(0, CAPTION_MAX))}
              disabled={inputDisabled}
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

// M3-3 改善: HEIC 変換中のインライン表示(フォーム内・コンパクト)。
// ProcessingOverlay はフル画面オーバーレイなので、選択中の文脈に出すと違和感がある。
// 同じ「経過秒で動きを見せる」作法だが、フォーム内に溶け込むサイズ感。
function ConvertingInline() {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - started) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-5 text-center">
      <p className="text-xs text-gray-700 mb-1">プレビューを準備中…</p>
      <p className="text-2xl font-light text-gray-700 tabular-nums">
        {elapsed}<span className="text-sm text-gray-400 ml-1">秒</span>
      </p>
      <p className="text-[10px] text-gray-400 mt-2">
        HEIC は初回 WASM 読み込みで 10〜15 秒かかります
      </p>
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
