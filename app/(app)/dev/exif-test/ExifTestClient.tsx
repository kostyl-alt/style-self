"use client";

// M3-2 前半 EXIF 除去検証用 Client Component。
// uploadPostImage を呼んで結果の URL/画像を表示する最小 UI。
//
// 流れ:
//   1) ユーザーがファイル選択
//   2) 元 File 情報を表示(type / サイズ)
//   3) uploadPostImage 経由でアップロード(内部で processImageForUpload
//      → EXIF 除去 + リサイズ + 圧縮)
//   4) 公開 URL と <img> を表示
//   5) オーナーがダウンロードして Mac プレビュー Cmd+I で EXIF を確認
//
// 重要: ここで上げた画像は実際に post-images バケットに保存される。
//       テスト後は Supabase Studio から手動削除推奨。

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { uploadPostImage } from "@/lib/storage";

interface UploadResult {
  originalType:  string;
  originalSize:  number;
  uploadedUrl:   string;
  elapsedMs:     number;
}

export default function ExifTestClient() {
  const [uploading, setUploading] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [result, setResult]       = useState<UploadResult | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setResult(null);
    setUploading(true);
    const started = Date.now();

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("ログインが必要です。/login からログインしてください。");
      }

      const url = await uploadPostImage(user.id, file);

      setResult({
        originalType: file.type,
        originalSize: file.size,
        uploadedUrl:  url,
        elapsedMs:    Date.now() - started,
      });
    } catch (err) {
      // image-pipeline からの code 付きエラーがあれば中身を出す
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setUploading(false);
      // 同じファイルで再テストできるように input をリセット
      e.target.value = "";
    }
  }

  return (
    <div className="min-h-screen bg-white pb-24">
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
        {/* dev only バナー */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800">
          <strong>🛠 開発専用ページ</strong> · 本番では 404 になります。
          M3-2 前半(uploadPostImage / processImageForUpload)で EXIF が
          除去されているかを実機確認するための一時ページ。
          フェーズC で削除予定: <code>app/(app)/dev/exif-test/</code>
        </div>

        <header>
          <p className="text-xs tracking-widest text-gray-400 uppercase mb-1">EXIF Test</p>
          <h1 className="text-2xl font-light text-gray-900">EXIF 除去 動作確認</h1>
          <p className="text-sm text-gray-500 mt-2 leading-relaxed">
            GPS 付きの写真を選んでアップロードすると、image-pipeline
            (Canvas 再エンコード)+ Supabase Storage を経由した画像 URL が返ります。
            戻ってきた画像をダウンロードして Mac プレビュー Cmd+I で確認してください。
          </p>
        </header>

        {/* ⚠️ 本物のバケットに保存される注意 */}
        <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-xs text-rose-700 leading-relaxed">
          ⚠️ このページで上げた画像は実際に <code>post-images</code> バケットに保存されます。
          テスト後は Supabase Studio → Storage → post-images から手動削除を推奨します。
        </div>

        {/* ファイル選択 */}
        <div className="border border-gray-200 rounded-2xl p-5">
          <label className="block">
            <span className="text-sm text-gray-700 mb-2 block">
              画像を選択(jpeg / png / webp / heic / heif)
            </span>
            <input
              type="file"
              // image/heic は一部ブラウザで MIME 推論されないため拡張子も列挙
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
              onChange={handleFile}
              disabled={uploading}
              className="block w-full text-sm text-gray-700 file:mr-3 file:px-4 file:py-2 file:border file:border-gray-200 file:rounded-lg file:bg-white file:text-gray-700 file:hover:bg-gray-50 file:cursor-pointer disabled:opacity-50"
            />
          </label>
        </div>

        {/* ローディング */}
        {uploading && (
          <div className="bg-gray-50 border border-gray-100 rounded-2xl p-6 text-center">
            <p className="text-sm text-gray-700">処理中…(EXIF 除去 → リサイズ → 圧縮 → アップロード)</p>
          </div>
        )}

        {/* エラー */}
        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-xs text-rose-700">
            {error}
          </div>
        )}

        {/* 結果 */}
        {result && (
          <div className="bg-emerald-50/50 border border-emerald-200 rounded-2xl p-5 space-y-3">
            <p className="text-[10px] tracking-[0.3em] text-emerald-700 uppercase">Result</p>

            <dl className="text-xs text-gray-700 grid grid-cols-1 sm:grid-cols-[120px_1fr] gap-y-1.5 gap-x-3">
              <dt className="text-gray-500">元 type</dt>
              <dd className="font-mono">{result.originalType}</dd>
              <dt className="text-gray-500">元サイズ</dt>
              <dd className="font-mono">{(result.originalSize / 1024).toFixed(1)} KB</dd>
              <dt className="text-gray-500">所要時間</dt>
              <dd className="font-mono">{result.elapsedMs} ms</dd>
              <dt className="text-gray-500">公開URL</dt>
              <dd className="font-mono break-all">
                <a
                  href={result.uploadedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-700 underline underline-offset-2 hover:text-emerald-900"
                >
                  {result.uploadedUrl}
                </a>
              </dd>
            </dl>

            <div className="border-t border-emerald-100 pt-3">
              <p className="text-xs text-gray-500 mb-2">アップロード後の画像(プレビュー):</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={result.uploadedUrl}
                alt="uploaded"
                className="max-w-full rounded-xl border border-emerald-100"
              />
            </div>

            <p className="text-xs text-emerald-800 leading-relaxed pt-1">
              ↑ この画像をダウンロード(右クリック → 保存)→ Mac プレビューで開いて Cmd+I →
              「GPS」タブが<strong>消えていること</strong>を確認。
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
