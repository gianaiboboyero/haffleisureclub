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

const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function isRetryableSupabaseError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const status = "status" in error ? Number((error as { status?: unknown }).status) : NaN;
  return RETRYABLE_STATUS_CODES.has(status);
}

async function fetchCourtRows(): Promise<CourtRow[] | null> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("Court")
    .select("id, name, number, status, currentMatchId, nextMatchId, notes, version, updatedAt")
    .order("number", { ascending: true });

  if (error) {
    throw error;
  }
  if (!data) return [];
  return data as CourtRow[];
}

export async function fetchCourts(): Promise<CourtRow[]> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return (await fetchCourtRows()) ?? [];
    } catch (error) {
      lastError = error;
      if (!isRetryableSupabaseError(error) || attempt === 2) break;
      await sleep(350 * (attempt + 1));
    }
  }

  console.warn("Unable to fetch courts from Supabase.", lastError);
  return [];
}

export async function seedCourtsIfEmpty(): Promise<number> {
  const supabase = getSupabase();
  if (!supabase) return 0;

  const existing = await fetchCourtRows().catch(() => null);
  if (!existing) return 0;
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
