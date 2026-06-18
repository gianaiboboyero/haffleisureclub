/** When true, app data reads/writes go direct to Supabase (not Vercel /api). */

function env(name: string): string | undefined {
  const value = (import.meta as ImportMeta & { env: Record<string, string | undefined> }).env[name];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function supabaseUrl(): string | undefined {
  return env("VITE_SUPABASE_URL") ?? env("NEXT_PUBLIC_SUPABASE_URL");
}

export function supabaseAnonKey(): string | undefined {
  return (
    env("VITE_SUPABASE_ANON_KEY")
    ?? env("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    ?? env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")
  );
}

export function useSupabaseData(): boolean {
  if (env("VITE_USE_SUPABASE_DATA") === "false") return false;
  return Boolean(supabaseUrl() && supabaseAnonKey());
}
