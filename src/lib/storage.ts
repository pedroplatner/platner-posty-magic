import { supabase, STORAGE_BUCKET } from "./supabase";
import imageCompression from "browser-image-compression";

const COMPRESS_OPTS = {
  maxSizeMB: 1.2,
  maxWidthOrHeight: 1920,
  useWebWorker: true,
  initialQuality: 0.85,
  fileType: "image/jpeg" as const,
};

async function compress(file: File): Promise<File> {
  // Skip if already small enough
  if (file.size <= 300 * 1024) return file;
  try {
    const out = await imageCompression(file, COMPRESS_OPTS);
    // browser-image-compression returns a File
    return out instanceof File
      ? out
      : new File([out], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" });
  } catch (e) {
    console.warn("Falha ao comprimir imagem, enviando original", e);
    return file;
  }
}

export async function uploadImage(file: File, suffix?: string): Promise<{ url: string; path: string }> {
  const compressed = await compress(file);
  const ts = Date.now();
  const ext = compressed.type === "image/jpeg" ? "jpg" : (compressed.name.split(".").pop() || "jpg");
  const path = `posts/${ts}${suffix ? `_${suffix}` : ""}.${ext}`;
  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, compressed, {
    cacheControl: "3600",
    upsert: false,
    contentType: compressed.type || "image/jpeg",
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
