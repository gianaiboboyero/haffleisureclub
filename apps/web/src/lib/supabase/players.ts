import { getSupabase } from "./client";

export type CompactPlayerRow = {
  id: string;
  displayName: string;
  fullName: string | null;
  skillLevel: string;
  rating: number;
  avatarUrl: string | null;
  tags: string[];
  status: string;
  totalGamesPlayed: number;
  totalDaysPlayed: number;
  lastPlayedDate: string | null;
  version: number;
  updatedAt: string;
};

/** Public roster columns only — phone/email/statusNote require authenticated API. */
const COMPACT_SELECT =
  "id, displayName, fullName, skillLevel, rating, avatarUrl, tags, status, totalGamesPlayed, totalDaysPlayed, lastPlayedDate, version, updatedAt";

const STATS_SELECT = "id, totalGamesPlayed, totalDaysPlayed, lastPlayedDate";

export type PlayerStatsRow = Pick<
  CompactPlayerRow,
  "id" | "totalGamesPlayed" | "totalDaysPlayed" | "lastPlayedDate"
>;

export async function fetchPlayerStatsByIds(ids: string[]): Promise<PlayerStatsRow[]> {
  const supabase = getSupabase();
  if (!supabase || ids.length === 0) return [];

  const { data, error } = await supabase.from("Player").select(STATS_SELECT).in("id", ids);
  if (error || !data) return [];
  return data as PlayerStatsRow[];
}

export async function fetchPlayersByIds(ids: string[]): Promise<CompactPlayerRow[]> {
  const supabase = getSupabase();
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (!supabase || uniqueIds.length === 0) return [];

  const { data, error } = await supabase.from("Player").select(COMPACT_SELECT).in("id", uniqueIds);
  if (error || !data) return [];
  return data as CompactPlayerRow[];
}

export async function fetchPlayersCompact(): Promise<CompactPlayerRow[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("Player")
    .select(COMPACT_SELECT)
    .order("displayName", { ascending: true });

  if (error || !data) return [];
  return data as CompactPlayerRow[];
}

export async function upsertPlayers(
  _players: Array<Record<string, unknown>>
): Promise<{ imported: number; skipped: number }> {
  throw new Error("Direct Player writes are disabled. Use authenticated /api routes.");
}
