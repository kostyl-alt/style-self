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

/**
 * 投稿画像を Canvas 経由で再エンコードし、EXIF を構造的に除去 + リサイズ + 圧縮。
 * 戻り値は image/jpeg の File(.jpg)。元 File 名はベース名を維持。
 */
export async function processImageForUpload(file: File): Promise<File> {
  // 1) 形式チェック
  if (!ALLOWED_TYPES.includes(file.type as (typeof ALLOWED_TYPES)[number])) {
    throw pipelineError(
      "UNSUPPORTED_TYPE",
      `画像形式が対応していません(${file.type || "不明"})。JPEG / PNG / WebP のみ対応します。`,
    );
  }

  // 2) <img> として読み込み(EXIF Orientation はブラウザ側で自動適用される)
  const img = await loadImage(file);

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
