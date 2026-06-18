import { getSupabase } from "./client";

export type CourtRow = {
  id: string;
  name: string;
  number: number;
  status: string;
  currentMatchId: string | null;
  nextMatchId: string | null;
  notes: string | null;
  version: number;
  updatedAt: string;
};

export async function fetchCourts(): Promise<CourtRow[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("Court")
    .select("id, name, number, status, currentMatchId, nextMatchId, notes, version, updatedAt")
    .order("number", { ascending: true });

  if (error || !data) return [];
  return data as CourtRow[];
}

export async function seedCourtsIfEmpty(): Promise<number> {
  const supabase = getSupabase();
  if (!supabase) return 0;

  const existing = await fetchCourts();
  if (existing.length > 0) return 0;

  const seed = [1, 2, 3].map((number) => ({
    id: `court-${number}`,
    name: `Court ${number}`,
    number,
    status: "Available"
  }));

  const { error } = await supabase.from("Court").insert(seed);
  return error ? 0 : seed.length;
}
