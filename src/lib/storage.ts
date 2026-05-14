import { supabase, STORAGE_BUCKET } from "./supabase";

export async function uploadImage(file: File, suffix?: string): Promise<{ url: string; path: string }> {
  const ts = Date.now();
  const ext = file.name.split(".").pop() || "jpg";
  const path = `posts/${ts}${suffix ? `_${suffix}` : ""}.${ext}`;
  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, path };
}

export async function deleteStoragePaths(paths: string[]) {
  const valid = paths.filter(Boolean);
  if (!valid.length) return;
  await supabase.storage.from(STORAGE_BUCKET).remove(valid);
}
