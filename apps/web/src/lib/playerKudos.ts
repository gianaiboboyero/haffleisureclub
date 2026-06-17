/** Templated post-game compliments — common pickleball play-style praise */
export const PLAY_KUDOS_PILLS = [
  "Great serve",
  "Killer third-shot drop",
  "Solid dinking",
  "Fast hands at the net",
  "Powerful drive",
  "Great court coverage",
  "Excellent communication",
  "Smart shot selection",
  "Consistent backhand",
  "Strong forehand",
  "Clutch finisher",
  "Tough to put away",
  "Great placement",
  "Patient rally builder",
  "Good partner energy",
  "Lob master",
  "Reset wizard",
  "Net domination",
] as const;

export type PlayKudosPill = (typeof PLAY_KUDOS_PILLS)[number];

export type PlayerKudosEntry = {
  id: string;
  matchId: string;
  fromPlayerId: string;
  fromPlayerName: string;
  toPlayerId: string;
  pills: string[];
  note?: string;
  createdAt: string;
};

export type MatchReviewRecord = {
  matchId: string;
  reviewerId: string;
  scoreA: number;
  scoreB: number;
  reviewedAt: string;
};

export function mergeKudosById(existing: PlayerKudosEntry[], incoming: PlayerKudosEntry[]) {
  const map = new Map(existing.map((entry) => [entry.id, entry]));
  for (const entry of incoming) map.set(entry.id, entry);
  return [...map.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function mergeReviewsByKey(existing: MatchReviewRecord[], incoming: MatchReviewRecord[]) {
  const map = new Map(existing.map((entry) => [`${entry.matchId}:${entry.reviewerId}`, entry]));
  for (const entry of incoming) map.set(`${entry.matchId}:${entry.reviewerId}`, entry);
  return [...map.values()].sort((a, b) => b.reviewedAt.localeCompare(a.reviewedAt));
}

export function kudosForPlayer(kudos: PlayerKudosEntry[], playerId: string) {
  return kudos.filter((entry) => entry.toPlayerId === playerId);
}

export function kudosForMatch(kudos: PlayerKudosEntry[], matchId: string) {
  return kudos.filter((entry) => entry.matchId === matchId);
}

export function tallyKudosPills(entries: PlayerKudosEntry[]) {
  const tallies: Record<string, number> = {};
  for (const entry of entries) {
    for (const pill of entry.pills) {
      tallies[pill] = (tallies[pill] ?? 0) + 1;
    }
  }
  return Object.entries(tallies).sort((a, b) => b[1] - a[1]);
}

export function migrateLegacyKudos(): PlayerKudosEntry[] {
  try {
    const raw = localStorage.getItem("haff-player-endorsements");
    if (!raw) return [];
    const list = JSON.parse(raw) as Array<{
      id?: string;
      matchId?: string;
      targetPlayerId: string;
      reviewerName?: string;
      chat?: string;
      endorsements?: string[];
      timestamp?: string;
    }>;
    return list
      .filter((item) => item.targetPlayerId)
      .map((item) => ({
        id: item.id ?? crypto.randomUUID(),
        matchId: item.matchId ?? "legacy",
        fromPlayerId: "legacy",
        fromPlayerName: item.reviewerName ?? "Player",
        toPlayerId: item.targetPlayerId,
        pills: item.endorsements ?? [],
        note: item.chat?.trim() || undefined,
        createdAt: item.timestamp ?? new Date().toISOString(),
      }));
  } catch {
    return [];
  }
}

export function parsePlayerKudos(value: unknown): PlayerKudosEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const item = entry as Record<string, unknown>;
      if (
        typeof item.id !== "string"
        || typeof item.matchId !== "string"
        || typeof item.fromPlayerId !== "string"
        || typeof item.fromPlayerName !== "string"
        || typeof item.toPlayerId !== "string"
        || typeof item.createdAt !== "string"
      ) {
        return null;
      }
      const pills = Array.isArray(item.pills) ? item.pills.map(String).filter(Boolean) : [];
      const note = typeof item.note === "string" && item.note.trim() ? item.note.trim() : undefined;
      return {
        id: item.id,
        matchId: item.matchId,
        fromPlayerId: item.fromPlayerId,
        fromPlayerName: item.fromPlayerName,
        toPlayerId: item.toPlayerId,
        pills,
        ...(note ? { note } : {}),
        createdAt: item.createdAt,
      } satisfies PlayerKudosEntry;
    })
    .filter((entry): entry is PlayerKudosEntry => Boolean(entry));
}

export function parseMatchReviews(value: unknown): MatchReviewRecord[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const item = entry as Record<string, unknown>;
      if (
        typeof item.matchId !== "string"
        || typeof item.reviewerId !== "string"
        || typeof item.reviewedAt !== "string"
        || typeof item.scoreA !== "number"
        || typeof item.scoreB !== "number"
      ) {
        return null;
      }
      return {
        matchId: item.matchId,
        reviewerId: item.reviewerId,
        scoreA: item.scoreA,
        scoreB: item.scoreB,
        reviewedAt: item.reviewedAt,
      };
    })
    .filter((entry): entry is MatchReviewRecord => Boolean(entry));
}

export function getMatchOpponentIds(match: { teamAPlayerIds: string[]; teamBPlayerIds: string[] }, playerId: string) {
  return [...match.teamAPlayerIds, ...match.teamBPlayerIds].filter((id) => id !== playerId && !id.startsWith("vacant"));
}
