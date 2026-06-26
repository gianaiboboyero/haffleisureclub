import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let adminClient: SupabaseClient | null = null;
let currentPublicClient: SupabaseClient | null = null;

const CURRENT_SUPABASE_URL = "https://chxzvugtdkohuciaqpxl.supabase.co";
const CURRENT_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_7bt1RVMmGLRUdfUsBPWpiQ_ML0Fm6Au";

export function getSupabaseAdmin(): SupabaseClient | null {
  if (adminClient) return adminClient;
  const url = process.env.SUPABASE_URL?.trim() ?? process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  adminClient = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return adminClient;
}

export function getCurrentSupabasePublic(): SupabaseClient {
  if (!currentPublicClient) {
    currentPublicClient = createClient(CURRENT_SUPABASE_URL, CURRENT_SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
  }
  return currentPublicClient;
}

const AVATAR_BUCKET = "avatars";

export function publicAvatarUrl(supabaseUrl: string, playerId: string, version: number) {
  return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${AVATAR_BUCKET}/${playerId}/v${version}.webp`;
}

export async function uploadPlayerAvatarServer(playerId: string, dataUrl: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Avatar storage is not configured on the server.");

  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("Invalid image data.");

  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length > 524_288) throw new Error("Image must be smaller than 512 KB.");

  const version = Date.now();
  const path = `${playerId}/v${version}.webp`;
  const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(path, buffer, {
    contentType: "image/webp",
    cacheControl: "31536000",
    upsert: true
  });
  if (error) throw new Error(error.message);

  const baseUrl = process.env.SUPABASE_URL?.trim() ?? process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!baseUrl) throw new Error("Supabase URL is not configured.");
  return { avatarUrl: publicAvatarUrl(baseUrl, playerId, version), avatarVersion: version };
}
