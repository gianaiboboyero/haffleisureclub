import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseAnonKey, supabaseUrl, useSupabaseData } from "../dataSource";

let client: SupabaseClient | null = null;

export async function fetchSupabaseCourts() {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase.from("Court").select("*").order("number", { ascending: true });
  if (error || !data) return [];
  return data;
}

export function getSupabase(): SupabaseClient | null {
  if (!useSupabaseData()) return null;
  const url = supabaseUrl();
  const key = supabaseAnonKey();
  if (!url || !key) return null;
  if (!client) {
    client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
  }
  return client;
}
