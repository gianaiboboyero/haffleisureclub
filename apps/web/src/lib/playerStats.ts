import type { Match, Court } from "./types";

export type PlayerGameStats = {
  gamesPlayed: number;
  minutesPlayed: number;
  favCourt?: { id: string; name: string; gamesOnCourt: number };
};

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
  defaultMatchMinutes = 12
): PlayerGameStats {
  const completed = matches.filter(
    (m) =>
      m.status === "Completed" &&
      [...m.teamAPlayerIds, ...m.teamBPlayerIds].includes(playerId)
  );

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
