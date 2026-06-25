/** When true, app data reads/writes go direct to Supabase (not Vercel /api). */

export function supabaseUrl(): string | undefined {
  const url = import.meta.env.VITE_SUPABASE_URL ?? import.meta.env.NEXT_PUBLIC_SUPABASE_URL;
  return typeof url === "string" && url.trim() ? url.trim() : undefined;
}

export function supabaseAnonKey(): string | undefined {
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY 
    ?? import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY 
    ?? import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return typeof key === "string" && key.trim() ? key.trim() : undefined;
}

export function useSupabaseData(): boolean {
  if (import.meta.env.VITE_USE_SUPABASE_DATA === "false") return false;
  return Boolean(supabaseUrl() && supabaseAnonKey());
}
