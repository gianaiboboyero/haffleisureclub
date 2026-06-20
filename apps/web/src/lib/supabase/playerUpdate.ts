import { apiJson } from "../api";
import { isInlineAvatarData } from "../profilePhoto";
import type { Player } from "../types";

type PlayerProfileResponse = {
  player: {
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
  };
};

async function blobToDataUrl(blob: Blob): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read photo."));
    reader.readAsDataURL(blob);
  });
}

function mapProfilePlayer(player: Player, row: PlayerProfileResponse["player"]): Player {
  return {
    ...player,
    displayName: row.displayName,
    fullName: row.fullName ?? undefined,
    skillLevel: row.skillLevel as Player["skillLevel"],
    rating: row.rating,
    avatarUrl: row.avatarUrl ?? undefined,
    statusNote: row.statusNote ?? undefined,
    phoneNumber: row.phone ?? undefined,
    tags: row.tags ?? player.tags,
    isActive: row.status !== "Inactive",
    totalGamesPlayed: row.totalGamesPlayed,
    totalDaysPlayed: row.totalDaysPlayed,
    lastPlayedDate: row.lastPlayedDate ?? undefined,
    version: row.version
  };
}

/** Persist profile changes through authenticated /api (Supabase mode). */
export async function updatePlayerViaApi(
  player: Player,
  options?: { avatarBlob?: Blob }
): Promise<Player> {
  let avatarDataUrl: string | undefined;
  if (options?.avatarBlob) {
    avatarDataUrl = await blobToDataUrl(options.avatarBlob);
  } else if (isInlineAvatarData(player.avatarUrl)) {
    avatarDataUrl = player.avatarUrl;
  }

  const body: Record<string, unknown> = {
    id: player.id,
    displayName: player.displayName,
    fullName: player.fullName,
    skillLevel: player.skillLevel,
    rating: player.rating,
    statusNote: player.statusNote ?? null,
    tags: player.tags,
    phoneNumber: player.phoneNumber,
    isActive: player.isActive !== false,
    totalGamesPlayed: player.totalGamesPlayed,
    totalDaysPlayed: player.totalDaysPlayed,
    lastPlayedDate: player.lastPlayedDate ?? null
  };

  if (avatarDataUrl) {
    body.avatarDataUrl = avatarDataUrl;
  } else if (player.avatarUrl && !isInlineAvatarData(player.avatarUrl)) {
    body.avatarUrl = player.avatarUrl;
  }

  const result = await apiJson<PlayerProfileResponse>("/api/player-profile", {
    method: "PATCH",
    body: JSON.stringify(body)
  });

  return mapProfilePlayer(player, result.player);
}

/** Persist lifetime stat counters after a court finishes (authenticated API queue). */
export async function updatePlayerStatsViaApi(player: Player): Promise<void> {
  await apiJson<PlayerProfileResponse>("/api/player-profile", {
    method: "PATCH",
    body: JSON.stringify({
      id: player.id,
      displayName: player.displayName,
      skillLevel: player.skillLevel,
      totalGamesPlayed: player.totalGamesPlayed,
      totalDaysPlayed: player.totalDaysPlayed,
      lastPlayedDate: player.lastPlayedDate ?? null
    })
  });
}

export async function fetchMissingPlayers(ids: string[]): Promise<Player[]> {
  if (ids.length === 0) return [];
  const { fetchPlayersCompact } = await import("./players");
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
