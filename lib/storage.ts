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
