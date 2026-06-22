import type { Match, Court, Player } from "./types";
import { todayKey } from "./utils";

export type PlayerGameStats = {
  gamesPlayed: number;
  minutesPlayed: number;
  favCourt?: { id: string; name: string; gamesOnCourt: number };
};

export function isRealPlayerId(id: string): boolean {
  return id !== "vacant" && !id.startsWith("vacant");
}

/** Normalize DB ISO timestamps and date-only strings to YYYY-MM-DD. */
export function playedDateKey(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 10);
}

/** Increment lifetime counters when a match is completed for this player. */
export function bumpPlayerAfterCompletedMatch(player: Player, durationSeconds: number): Player {
  const playedToday = todayKey();
  const firstGameToday = playedDateKey(player.lastPlayedDate) !== playedToday;
  return {
    ...player,
    totalGamesPlayed: (player.totalGamesPlayed ?? 0) + 1,
    totalCourtSeconds: (player.totalCourtSeconds ?? 0) + Math.max(60, Math.round(durationSeconds)),
    totalDaysPlayed: (player.totalDaysPlayed ?? 0) + (firstGameToday ? 1 : 0),
    lastPlayedDate: playedToday,
  };
}

export function applyMatchCompletionToPlayers(
  players: Player[],
  participantIds: string[],
  durationSeconds: number
): Player[] {
  const ids = new Set(participantIds.filter(isRealPlayerId));
  if (ids.size === 0) return players;
  return players.map((player) =>
    ids.has(player.id) ? bumpPlayerAfterCompletedMatch(player, durationSeconds) : player
  );
}

export function mergePlayerLifetimeStats(local: Player, server: {
  totalGamesPlayed: number;
  totalCourtSeconds?: number;
  totalDaysPlayed: number;
  lastPlayedDate?: string | null;
}): Player {
  const candidates = [local.lastPlayedDate, server.lastPlayedDate ?? undefined].filter(
    (value): value is string => Boolean(value)
  );
  const lastPlayed = candidates.sort((a, b) =>
  playedDateKey(b)!.localeCompare(playedDateKey(a)!)
  )[0];

  return {
    ...local,
    totalGamesPlayed: Math.max(local.totalGamesPlayed ?? 0, server.totalGamesPlayed ?? 0),
    totalCourtSeconds: Math.max(local.totalCourtSeconds ?? 0, server.totalCourtSeconds ?? 0),
    totalDaysPlayed: Math.max(local.totalDaysPlayed ?? 0, server.totalDaysPlayed ?? 0),
    lastPlayedDate: lastPlayed,
  };
}

export function formatMinutesPlayed(totalMinutes: number): string {
  if (totalMinutes <= 0) return "0m";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

/**
 * Derives live session stats from completed match records.
 */
export function computePlayerStats(
  playerId: string,
  matches: Match[],
  courts: Court[],
  defaultMatchMinutes = 12,
  nowMs = Date.now()
): PlayerGameStats {
  const participated = matches.filter((m) =>
    [...m.teamAPlayerIds, ...m.teamBPlayerIds].includes(playerId)
  );
  const completed = participated.filter((m) => m.status === "Completed");
  const inProgress = participated.filter((m) => m.status === "InProgress");

  let minutesPlayed = 0;
  const courtFreq: Record<string, number> = {};

  for (const m of completed) {
    if (m.startedAt && m.endedAt) {
      const mins = Math.round(
        (new Date(m.endedAt).getTime() - new Date(m.startedAt).getTime()) / 60_000
      );
      minutesPlayed += Math.max(1, mins);
    } else {
      minutesPlayed += defaultMatchMinutes;
    }
    if (m.courtId) {
      courtFreq[m.courtId] = (courtFreq[m.courtId] ?? 0) + 1;
    }
  }

  for (const m of inProgress) {
    if (m.startedAt) {
      const mins = Math.round((nowMs - new Date(m.startedAt).getTime()) / 60_000);
      minutesPlayed += Math.max(1, mins);
    } else {
      minutesPlayed += defaultMatchMinutes;
    }
    if (m.courtId) {
      courtFreq[m.courtId] = (courtFreq[m.courtId] ?? 0) + 1;
    }
  }

  const favCourtEntry = Object.entries(courtFreq).sort((a, b) => b[1] - a[1])[0];
  const favCourtRecord = favCourtEntry ? courts.find((c) => c.id === favCourtEntry[0]) : undefined;

  return {
    gamesPlayed: completed.length,
    minutesPlayed,
    favCourt: favCourtRecord
      ? { id: favCourtRecord.id, name: favCourtRecord.name, gamesOnCourt: favCourtEntry![1] }
      : undefined,
  };
}
