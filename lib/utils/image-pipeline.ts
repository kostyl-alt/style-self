// M3-2 前半: 投稿画像のクライアント前処理パイプライン
//
// 【目的】最優先は EXIF メタデータの完全除去(地雷1)。
// スマホ写真には GPS 座標・撮影時刻・カメラ機種が EXIF に埋まっており、
// 投稿で漏れると自宅・職場の位置がバレる重大事故になる。
// Canvas 経由で再エンコードすることで、EXIF が構造的に消える
// (Canvas は ピクセルデータしか持たないため、再エンコード時に
// メタデータが復元不可能)。
//
// 副次目標: リサイズ + 圧縮で 5MB 以下に収める(地雷2 = Storage 浪費防止)。
//
// 【仕様】
// - 入力: image/jpeg | image/png | image/webp(他は拒否)
// - 出力: image/jpeg(統一・MVP)。透過 PNG は白背景で再描画
// - 最大寸法: 1920px(SNS 表示サイズの標準)
// - 品質: 0.85 から開始し、5MB を超えるなら 0.1 ずつ下げて再エンコード
// - 0.5 まで下げて 5MB を超える場合はエラー
//
// 【Orientation】
// モダンブラウザ(Safari 13.4+ / Chrome 81+ / Firefox 77+)は <img> ロード時に
// EXIF Orientation を自動適用する。naturalWidth/Height は回転後の寸法を返すため、
// drawImage で正しい向きで描画される。
// EXIF Orientation タグ自体は Canvas 経由で出力する時点で消える(他の EXIF も同様)。
//
// 【HEIC/HEIF 対応】
// iPhone 標準の HEIC はブラウザの Image/Canvas で直接デコードできないため、
// heic-to(現代の libheif-js を内包・active maintained)で JPEG に事前変換する。
// その後 既存の Canvas 経由パイプラインに流すので、heic-to が GPS を保持しても
// 最終的に Canvas で消える = HEIC 経路でも GPS 除去の保証は変わらない。
//
// 旧 heic2any(0.0.4・2018 で更新停止)は新しい iPhone HEIC で
// "ERR_LIBHEIF format not supported" を返したため heic-to に差し替えた。
// heic-to は WASM ~2MB と重いので、HEIC ファイルが選ばれた時だけ動的 import する。

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const MAX_DIM_PX = 1920;
const MAX_BYTES = 5 * 1024 * 1024;
const QUALITY_START = 0.85;
const QUALITY_MIN = 0.5;
const QUALITY_STEP = 0.1;

export interface ImagePipelineError extends Error {
  code: "UNSUPPORTED_TYPE" | "LOAD_FAILED" | "ENCODE_FAILED" | "TOO_LARGE";
}

function pipelineError(code: ImagePipelineError["code"], message: string): ImagePipelineError {
  const err = new Error(message) as ImagePipelineError;
  err.code = code;
  return err;
}

// HEIC/HEIF 判定: file.type は iOS Safari で空文字や application/octet-stream に
// なることがあるため、ファイル名拡張子もフォールバックとして見る。
function isHeic(file: File): boolean {
  const t = (file.type || "").toLowerCase();
  if (t === "image/heic" || t === "image/heif") return true;
  const name = file.name.toLowerCase();
  return name.endsWith(".heic") || name.endsWith(".heif");
}

// catch した unknown から name/message を安全に取り出す。
// 真因の可視化に使う(M2-3 の "Supabase エラー握りつぶし" と同じ反省)。
function describeError(e: unknown): { name: string; message: string } {
  if (e instanceof Error) {
    return { name: e.name || "Error", message: e.message || String(e) };
  }
  if (typeof e === "string") {
    return { name: "String", message: e };
  }
  try {
    return { name: typeof e, message: JSON.stringify(e) };
  } catch {
    return { name: typeof e, message: String(e) };
  }
}

// HEIC → JPEG 変換。WASM ロードがあるので動的 import で初回のみコストを払う。
// catch は必ず元エラーをログ + ユーザー文言に name/message を含める
// (M2-3 で学んだ反省: 真因を握りつぶしてはならない)。
async function convertHeicToJpeg(file: File): Promise<File> {
  // heic-to: 名前付き export の heicTo を使う(default は無い)
  let heicTo: typeof import("heic-to").heicTo;
  try {
    const mod = await import("heic-to");
    heicTo = mod.heicTo;
  } catch (e) {
    const d = describeError(e);
    console.error("[heic-to import]", e);
    throw pipelineError(
      "LOAD_FAILED",
      `HEIC 変換ライブラリの読み込みに失敗しました: ${d.name}: ${d.message}`,
    );
  }

  let jpegBlob: Blob;
  try {
    // type:"image/jpeg" 指定で戻り値は Promise<Blob>(単一・Array にならない)
    jpegBlob = await heicTo({ blob: file, type: "image/jpeg", quality: 0.95 });
  } catch (e) {
    const d = describeError(e);
    console.error("[heic-to convert]", e);
    throw pipelineError(
      "LOAD_FAILED",
      `HEIC 画像の変換に失敗しました: ${d.name}: ${d.message}`,
    );
  }

  const baseName = file.name.replace(/\.[^.]+$/, "") || "heic";
  return new File([jpegBlob], `${baseName}.jpg`, { type: "image/jpeg" });
}

/**
 * 投稿画像を Canvas 経由で再エンコードし、EXIF を構造的に除去 + リサイズ + 圧縮。
 * HEIC/HEIF は事前に JPEG へ変換してから Canvas パイプラインに流す。
 * 戻り値は image/jpeg の File(.jpg)。元 File 名はベース名を維持。
 */
export async function processImageForUpload(file: File): Promise<File> {
  // 0) HEIC/HEIF は先に JPEG に変換(その後の Canvas 再エンコードで EXIF が確実に消える)
  let workFile = file;
  if (isHeic(file)) {
    workFile = await convertHeicToJpeg(file);
  }

  // 1) 形式チェック(HEIC 変換後の workFile.type で判定)
  if (!ALLOWED_TYPES.includes(workFile.type as (typeof ALLOWED_TYPES)[number])) {
    throw pipelineError(
      "UNSUPPORTED_TYPE",
      `画像形式が対応していません(${workFile.type || "不明"})。JPEG / PNG / WebP / HEIC のみ対応します。`,
    );
  }

  // 2) <img> として読み込み(EXIF Orientation はブラウザ側で自動適用される)
  const img = await loadImage(workFile);

  // 3) リサイズ計算(長辺 1920px 上限・縦横比保持)
  const { width, height } = clampDimensions(img.naturalWidth, img.naturalHeight, MAX_DIM_PX);

  // 4) Canvas に描画して再エンコード
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw pipelineError("ENCODE_FAILED", "Canvas コンテキストの取得に失敗しました");
  }

  // 透過 PNG 対策: JPEG 出力すると透過部分が黒になるため、先に白背景で塗る
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  // 5) 段階的に品質を下げて 5MB 以下を狙う
  let quality = QUALITY_START;
  let blob = await canvasToBlob(canvas, "image/jpeg", quality);
  while (blob.size > MAX_BYTES && quality > QUALITY_MIN) {
    quality = Math.max(QUALITY_MIN, quality - QUALITY_STEP);
    blob = await canvasToBlob(canvas, "image/jpeg", quality);
  }
  if (blob.size > MAX_BYTES) {
    const mb = (blob.size / 1024 / 1024).toFixed(1);
    throw pipelineError(
      "TOO_LARGE",
      `圧縮後も ${mb}MB と上限(5MB)を超えました。別の画像を試してください。`,
    );
  }

  // 6) File として返す。拡張子は .jpg に統一(出力形式と合わせる)
  const baseName = file.name.replace(/\.[^.]+$/, "") || "post";
  return new File([blob], `${baseName}.jpg`, { type: "image/jpeg" });
}

// ---- 内部ヘルパー ----

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(pipelineError("LOAD_FAILED", "画像の読み込みに失敗しました(ファイルが壊れている可能性があります)"));
    };
    img.src = url;
  });
}

function clampDimensions(w: number, h: number, max: number): { width: number; height: number } {
  if (w <= max && h <= max) return { width: w, height: h };
  if (w >= h) {
    return { width: max, height: Math.max(1, Math.round((max * h) / w)) };
  } else {
    return { width: Math.max(1, Math.round((max * w) / h)), height: max };
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(pipelineError("ENCODE_FAILED", "Canvas のエンコードに失敗しました"));
      },
      type,
      quality,
    );
  });
}
