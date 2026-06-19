import { getSupabase } from "./client";

export type CompactPlayerRow = {
  id: string;
  displayName: string;
  fullName: string | null;
  skillLevel: string;
  rating: number;
  avatarUrl: string | null;
  statusNote: string | null;
  phone: string | null;
  tags: string[];
  status: string;
  totalGamesPlayed: number;
  totalDaysPlayed: number;
  lastPlayedDate: string | null;
  version: number;
  updatedAt: string;
};

const COMPACT_SELECT =
  "id, displayName, fullName, skillLevel, rating, avatarUrl, statusNote, phone, tags, status, totalGamesPlayed, totalDaysPlayed, lastPlayedDate, version, updatedAt";

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
  players: Array<Record<string, unknown>>
): Promise<{ imported: number; skipped: number }> {
  const supabase = getSupabase();
  if (!supabase) return { imported: 0, skipped: 0 };

  let imported = 0;
  let skipped = 0;

  for (const row of players) {
    const id = String(row.id ?? "");
    if (!id) {
      skipped += 1;
      continue;
    }

    const { data: existing } = await supabase.from("Player").select("id, version, updatedAt").eq("id", id).maybeSingle();

    const payload = {
      id,
      displayName: String(row.displayName ?? "Player"),
      fullName: typeof row.fullName === "string" ? row.fullName : null,
      skillLevel: String(row.skillLevel ?? "Beginner"),
      rating: typeof row.rating === "number" ? row.rating : 2,
      avatarUrl: typeof row.avatarUrl === "string" && row.avatarUrl ? row.avatarUrl : null,
      phone: typeof row.phone === "string" ? row.phone : typeof row.phoneNumber === "string" ? row.phoneNumber : null,
      tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
      status: row.isActive === false || row.status === "Inactive" ? "Inactive" : "Active",
      totalGamesPlayed: typeof row.totalGamesPlayed === "number" ? row.totalGamesPlayed : 0,
      totalDaysPlayed: typeof row.totalDaysPlayed === "number" ? row.totalDaysPlayed : 0,
      lastPlayedDate: typeof row.lastPlayedDate === "string" ? row.lastPlayedDate : null
    };

    if (existing) {
      const { error } = await supabase.from("Player").update(payload).eq("id", id);
      if (error) skipped += 1;
      else imported += 1;
    } else {
      const { error } = await supabase.from("Player").insert(payload);
      if (error) skipped += 1;
      else imported += 1;
    }
  }

  return { imported, skipped };
}
