import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { processImageForUpload } from "@/lib/utils/image-pipeline";

export const WARDROBE_BUCKET = "wardrobe-images";

export async function uploadWardrobeImage(userId: string, file: File): Promise<string> {
  const supabase = createSupabaseBrowserClient();
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${userId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from(WARDROBE_BUCKET)
    .upload(path, file, { upsert: false });

  if (error) throw new Error("画像のアップロードに失敗しました");

  const { data: { publicUrl } } = supabase.storage
    .from(WARDROBE_BUCKET)
    .getPublicUrl(path);

  return publicUrl;
}

export async function deleteWardrobeImage(publicUrl: string): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const url = new URL(publicUrl);
  // パスは /storage/v1/object/public/{bucket}/{path} の形式
  const pathParts = url.pathname.split(`/public/${WARDROBE_BUCKET}/`);
  if (pathParts.length < 2) return;

  await supabase.storage.from(WARDROBE_BUCKET).remove([pathParts[1]]);
}

// ---- Sprint 38: ナレッジ画像 ----

export const KNOWLEDGE_BUCKET = "knowledge-images";

export async function uploadKnowledgeImage(userId: string, file: File): Promise<string> {
  const supabase = createSupabaseBrowserClient();
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${userId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from(KNOWLEDGE_BUCKET)
    .upload(path, file, { upsert: false });

  if (error) throw new Error("画像のアップロードに失敗しました");

  const { data: { publicUrl } } = supabase.storage
    .from(KNOWLEDGE_BUCKET)
    .getPublicUrl(path);

  return publicUrl;
}

// ---- M3-2 前半: 投稿画像 ----
//
// 投稿画像は必ず processImageForUpload() を経由させる。
// この関数を経由しない raw File の直接アップロードは禁止
// (EXIF 漏洩 = 自宅・職場の位置バレの重大事故防止)。

export const POST_BUCKET = "post-images";

export async function uploadPostImage(userId: string, rawFile: File): Promise<string> {
  // 1) クライアント前処理: EXIF 除去(Canvas 再エンコードで構造的に消える)
  //    + リサイズ(長辺 1920px)+ 圧縮(<5MB)+ JPEG 統一
  const processed = await processImageForUpload(rawFile);

  // 2) Supabase Storage RLS が foldername[1]=auth.uid() を要求するため、
  //    {userId}/{timestamp}.jpg のパス命名(WARDROBE_BUCKET と同じ運用)
  const supabase = createSupabaseBrowserClient();
  const path = `${userId}/${Date.now()}.jpg`;

  const { error } = await supabase.storage
    .from(POST_BUCKET)
    .upload(path, processed, { upsert: false, contentType: "image/jpeg" });

  if (error) throw new Error("画像のアップロードに失敗しました");

  const { data: { publicUrl } } = supabase.storage
    .from(POST_BUCKET)
    .getPublicUrl(path);

  return publicUrl;
}

export async function deletePostImage(publicUrl: string): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const url = new URL(publicUrl);
  // パスは /storage/v1/object/public/{bucket}/{path} の形式
  const pathParts = url.pathname.split(`/public/${POST_BUCKET}/`);
  if (pathParts.length < 2) return;

  await supabase.storage.from(POST_BUCKET).remove([pathParts[1]]);
}

// ---- D1 Phase 2: ムードボード画像(M3 post-images 同型・EXIF 除去あり) ----
//
// Sprint C-2 段階1 実装(設計案 664b661 §5.1 投入)。
// MB 用画像 upload/delete helper。M3 uploadPostImage と同型作法で EXIF を構造遮断
// (Canvas 再エンコード経由)し、Storage バケット moodboard-images に格納する。
// パスは 3 階層 {userId}/{moodboardId}/{ts}.jpg(MB 単位束ね・将来 MB 削除時の cascade
// 整理を容易化)。Storage RLS の foldername[1]=auth.uid() は第 1 階層判定のため互換。

export const MOODBOARD_BUCKET = "moodboard-images";

export async function uploadMoodboardImage(
  userId: string,
  moodboardId: string,
  rawFile: File,
): Promise<string> {
  // 1) ★ EXIF 除去(processImageForUpload・M3 同型・地雷対策)
  //    Canvas 再エンコードで EXIF 構造遮断 + 長辺 1920px + 5MB 以下
  const processed = await processImageForUpload(rawFile);

  // 2) Supabase Storage RLS が foldername[1]=auth.uid() を要求するため、
  //    {userId}/{moodboardId}/{timestamp}.jpg のパス命名(M3 と異なり 3 階層 = MB 単位束ね)
  const supabase = createSupabaseBrowserClient();
  const path = `${userId}/${moodboardId}/${Date.now()}.jpg`;

  const { error } = await supabase.storage
    .from(MOODBOARD_BUCKET)
    .upload(path, processed, { upsert: false, contentType: "image/jpeg" });

  if (error) throw new Error("画像のアップロードに失敗しました");

  const { data: { publicUrl } } = supabase.storage
    .from(MOODBOARD_BUCKET)
    .getPublicUrl(path);

  return publicUrl;
}

export async function deleteMoodboardImage(publicUrl: string): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const url = new URL(publicUrl);
  // パスは /storage/v1/object/public/{bucket}/{path} の形式
  const pathParts = url.pathname.split(`/public/${MOODBOARD_BUCKET}/`);
  if (pathParts.length < 2) return;

  await supabase.storage.from(MOODBOARD_BUCKET).remove([pathParts[1]]);
}
