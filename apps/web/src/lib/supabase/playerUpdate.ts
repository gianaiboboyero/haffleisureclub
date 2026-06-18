import { useSupabaseData } from "../dataSource";
import { isInlineAvatarData } from "../profilePhoto";
import type { Player } from "../types";
import { getSupabase } from "./client";
import { fetchPlayersCompact } from "./players";
import { uploadPlayerAvatar } from "./storage";

export async function updatePlayerOnSupabase(
  player: Player,
  options?: { avatarBlob?: Blob }
): Promise<Player> {
  const supabase = getSupabase();
  if (!supabase) return player;

  let avatarUrl = player.avatarUrl;
  let avatarVersion: number | undefined;

  if (options?.avatarBlob) {
    const uploaded = await uploadPlayerAvatar(player.id, options.avatarBlob);
    avatarUrl = uploaded.avatarUrl;
    avatarVersion = uploaded.avatarVersion;
  } else if (isInlineAvatarData(player.avatarUrl)) {
    const uploaded = await uploadPlayerAvatar(player.id, player.avatarUrl!);
    avatarUrl = uploaded.avatarUrl;
    avatarVersion = uploaded.avatarVersion;
  }

  const payload = {
    displayName: player.displayName,
    fullName: player.fullName ?? null,
    skillLevel: player.skillLevel,
    rating: player.rating,
    avatarUrl: avatarUrl ?? null,
    ...(avatarVersion !== undefined ? { avatarVersion } : {}),
    statusNote: player.statusNote ?? null,
    phone: player.phoneNumber ?? null,
    tags: player.tags ?? [],
    status: player.isActive === false ? "Inactive" : "Active",
    totalGamesPlayed: player.totalGamesPlayed,
    totalDaysPlayed: player.totalDaysPlayed,
    lastPlayedDate: player.lastPlayedDate ? new Date(player.lastPlayedDate).toISOString() : null
  };

  const { error } = await supabase.from("Player").update(payload).eq("id", player.id);
  if (error) throw new Error(error.message);

  return {
    ...player,
    avatarUrl: avatarUrl ?? undefined
  };
}

export async function fetchMissingPlayers(ids: string[]): Promise<Player[]> {
  if (!useSupabaseData() || ids.length === 0) return [];
  const compact = await fetchPlayersCompact();
  const byId = new Map(compact.map((row) => [row.id, row]));
  return ids
    .filter((id) => byId.has(id))
    .map((id) => {
      const row = byId.get(id)!;
      return {
        id: row.id,
        displayName: row.displayName,
        skillLevel: row.skillLevel as Player["skillLevel"],
        rating: row.rating,
        tags: row.tags ?? [],
        checkedIn: false,
        totalGamesPlayed: row.totalGamesPlayed,
        totalDaysPlayed: row.totalDaysPlayed,
        lastPlayedDate: row.lastPlayedDate ?? undefined,
        avatarUrl: row.avatarUrl ?? undefined,
        statusNote: row.statusNote ?? undefined,
        phoneNumber: row.phone ?? undefined,
        isActive: row.status !== "Inactive"
      };
    });
}
