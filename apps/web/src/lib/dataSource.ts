/** When true, app data reads/writes go direct to Supabase (not Vercel /api). */

const LEGACY_SUPABASE_URL = "https://hmhhgmuuusknmucjlkth.supabase.co";
const CURRENT_SUPABASE_URL = "https://chxzvugtdkohuciaqpxl.supabase.co";
const CURRENT_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_7bt1RVMmGLRUdfUsBPWpiQ_ML0Fm6Au";

export function supabaseUrl(): string | undefined {
  const url = import.meta.env.VITE_SUPABASE_URL ?? import.meta.env.NEXT_PUBLIC_SUPABASE_URL;
  if (typeof url !== "string" || !url.trim()) return undefined;
  const trimmed = url.trim();
  return trimmed === LEGACY_SUPABASE_URL ? CURRENT_SUPABASE_URL : trimmed;
}

export function supabaseAnonKey(): string | undefined {
  const url = import.meta.env.VITE_SUPABASE_URL ?? import.meta.env.NEXT_PUBLIC_SUPABASE_URL;
  if (typeof url === "string" && url.trim() === LEGACY_SUPABASE_URL) {
    return CURRENT_SUPABASE_PUBLISHABLE_KEY;
  }
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY 
    ?? import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY 
    ?? import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return typeof key === "string" && key.trim() ? key.trim() : undefined;
}

export function useSupabaseData(): boolean {
  if (import.meta.env.VITE_USE_SUPABASE_DATA === "false") return false;
  return Boolean(supabaseUrl() && supabaseAnonKey());
}
