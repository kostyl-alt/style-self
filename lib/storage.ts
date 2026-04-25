import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

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
