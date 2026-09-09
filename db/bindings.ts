import { env } from "cloudflare:workers";

export function getRawDb() {
  if (!env.DB) throw new Error("ZeroTrash database is unavailable");
  return env.DB;
}

export function getBucket() {
  if (!env.BUCKET) throw new Error("ZeroTrash image storage is unavailable");
  return env.BUCKET;
}

export function requireImage(file: FormDataEntryValue | null) {
  if (!(file instanceof File) || file.size === 0) throw new Error("A photo is required");
  if (file.size > 5 * 1024 * 1024) throw new Error("Photo must be smaller than 5 MB");
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Use a JPG, PNG or WebP photo");
  return file;
}

export function imageKey(stage: "before" | "after", file: File) {
  const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  return `cleanups/${crypto.randomUUID()}-${stage}.${extension}`;
}
