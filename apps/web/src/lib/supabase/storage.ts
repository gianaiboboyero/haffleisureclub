import { dataUrlToWebpBlob } from "../profilePhoto";
import { supabaseUrl } from "../dataSource";
import { getSupabase } from "./client";

const BUCKET = "avatars";

export function publicAvatarUrl(playerId: string, version: number) {
  const base = supabaseUrl()?.replace(/\/$/, "");
  if (!base) return null;
  return `${base}/storage/v1/object/public/${BUCKET}/${playerId}/v${version}.webp`;
}

export async function uploadPlayerAvatar(
  playerId: string,
  source: string | Blob,
  nextVersion?: number
): Promise<{ avatarUrl: string; avatarVersion: number }> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase is not configured.");

  const version = nextVersion ?? Date.now();
  const blob =
    typeof source === "string"
      ? source.startsWith("data:")
        ? await dataUrlToWebpBlob(source)
        : await fetch(source).then((r) => r.blob())
      : source;

  const path = `${playerId}/v${version}.webp`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: "image/webp",
    cacheControl: "31536000",
    upsert: true
  });
  if (error) throw new Error(error.message);

  const avatarUrl = publicAvatarUrl(playerId, version);
  if (!avatarUrl) throw new Error("Could not build avatar URL.");
  return { avatarUrl, avatarVersion: version };
}

export async function removeLegacyInlineAvatar(playerId: string) {
  const supabase = getSupabase();
  if (!supabase) return;
  const { data } = await supabase.storage.from(BUCKET).list(playerId);
  if (!data?.length) return;
  const paths = data.map((item) => `${playerId}/${item.name}`);
  await supabase.storage.from(BUCKET).remove(paths);
}
