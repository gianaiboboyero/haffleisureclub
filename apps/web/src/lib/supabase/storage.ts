import { supabaseUrl } from "../dataSource";

const BUCKET = "avatars";

export function publicAvatarUrl(playerId: string, version: number) {
  const base = supabaseUrl()?.replace(/\/$/, "");
  if (!base) return null;
  return `${base}/storage/v1/object/public/${BUCKET}/${playerId}/v${version}.webp`;
}

export async function uploadPlayerAvatar(
  _playerId: string,
  _source: string | Blob,
  _nextVersion?: number
): Promise<{ avatarUrl: string; avatarVersion: number }> {
  throw new Error("Direct avatar uploads are disabled. Save your profile while signed in.");
}

export async function removeLegacyInlineAvatar(_playerId: string) {
  // Listing avatars requires a broad storage policy; uploads use upsert on a versioned path.
}
