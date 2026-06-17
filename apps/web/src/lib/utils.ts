import { clsx, type ClassValue } from "clsx";
import type { Court, Match, MatchStatus, Player } from "./types";
import { extendTailwindMerge } from "tailwind-merge";

const customTwMerge = extendTailwindMerge({
  extend: {
    theme: {
      colors: ["forest", "ivy", "ivory", "linen", "brass", "clay", "ink"]
    }
  }
});

export function cn(...inputs: ClassValue[]) {
  return customTwMerge(clsx(inputs));
}

export function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function getActiveCourtMatch(court: Court, matches: Match[]): Match | undefined {
  return (
    matches.find((match) => match.id === court.currentMatchId && match.status === "InProgress") ??
    matches.find((match) => match.courtId === court.id && match.status === "InProgress")
  );
}

const MATCH_STATUS_RANK: Record<MatchStatus, number> = {
  Queued: 1,
  Assigned: 2,
  InProgress: 3,
  Completed: 4
};

function matchProgressTimestamp(match: Match): number {
  if (match.endedAt) return new Date(match.endedAt).getTime();
  if (match.startedAt) return new Date(match.startedAt).getTime();
  return 0;
}

function pickPreferredMatch(local: Match, remote: Match): Match {
  const localRank = MATCH_STATUS_RANK[local.status];
  const remoteRank = MATCH_STATUS_RANK[remote.status];
  if (localRank !== remoteRank) return localRank > remoteRank ? local : remote;
  const localTime = matchProgressTimestamp(local);
  const remoteTime = matchProgressTimestamp(remote);
  if (localTime !== remoteTime) return localTime > remoteTime ? local : remote;
  return local;
}

/** Prefer newer local finishes over stale shared InProgress rows during refresh. */
export function mergeSharedMatches(local: Match[], remote: Match[]): Match[] {
  const merged = new Map<string, Match>();
  for (const match of remote) merged.set(match.id, match);
  for (const match of local) {
    const existing = merged.get(match.id);
    merged.set(match.id, existing ? pickPreferredMatch(match, existing) : match);
  }
  return [...merged.values()];
}

export function reconcileCourtsWithMatches(courts: Court[], matches: Match[]): Court[] {
  return courts.map((court) => {
    const activeMatch = getActiveCourtMatch(court, matches);
    if (activeMatch) {
      return { ...court, status: "InUse" as const, currentMatchId: activeMatch.id };
    }
    if (court.status === "InUse") {
      return {
        ...court,
        status: "Available" as const,
        currentMatchId: undefined
      };
    }
    return court;
  });
}

export function sortCourts(courts: Court[]) {
  return [...courts].sort((a, b) => {
    const na = a.number ?? 0;
    const nb = b.number ?? 0;
    return na - nb || a.name.localeCompare(b.name);
  });
}

export function resolvePlayerById(id: string, players: Player[]): Player {
  if (id === "vacant" || id.startsWith("vacant")) {
    return { ...createTvVacantSlot(id), displayName: "Open Slot" };
  }
  const found = players.find((player) => player.id === id);
  if (found) return found;
  return {
    id,
    displayName: "Player",
    skillLevel: "Beginner",
    rating: 2,
    tags: [],
    checkedIn: true,
    parked: false,
    totalGamesPlayed: 0,
    totalDaysPlayed: 0
  };
}

export function resolveMatchTeamPlayers(ids: string[], players: Player[]): Player[] {
  return ids.map((id) => resolvePlayerById(id, players));
}

export function getPlayerStatusNote(player: Pick<Player, "statusNote" | "preferredPlayStyle">): string {
  return player.statusNote?.trim() || player.preferredPlayStyle?.trim() || "";
}

export function getPlayerDisplayLabel(player: Pick<Player, "displayName" | "isVacant">): string {
  if (player.isVacant) return "—";
  return player.displayName?.trim() || "Player";
}

export function createTvVacantSlot(id: string): Player {
  return {
    id,
    displayName: "Waiting",
    skillLevel: "Newbie",
    rating: 0,
    tags: [],
    checkedIn: false,
    parked: false,
    totalGamesPlayed: 0,
    totalDaysPlayed: 0,
    isVacant: true
  };
}

export function createTvReservedSlot(id: string): Player {
  return {
    ...createTvVacantSlot(id),
    displayName: "Reserved",
    isReservedSlot: true
  };
}

export function isStackPlaceholder(id: string) {
  return id === "vacant" || id === "reserved";
}

/** TV + admin queue: fixed groups of 4 from stackOrder, with vacant placeholders. */
export function getTvStackGroups(
  stackOrder: string[],
  players: Player[],
  matches: Match[],
  courts: Court[],
  maxGroups = 4
): Player[][] {
  const activeIds = new Set(
    matches
      .filter((match) => match.status === "InProgress")
      .flatMap((match) => [...match.teamAPlayerIds, ...match.teamBPlayerIds])
  );
  const reservedIds = new Set(courts.flatMap((court) => court.reservedPlayerIds ?? []));
  const playersById = new Map(players.map((player) => [player.id, player]));

  const slots = stackOrder.map((id, index) => {
    if (id === "reserved") {
      return createTvReservedSlot(`reserved-tv-${index}`);
    }
    if (id === "vacant" || activeIds.has(id) || reservedIds.has(id)) {
      return createTvVacantSlot(`vacant-tv-${index}`);
    }
    const player = playersById.get(id) ?? resolvePlayerById(id, players);
    if (!player.checkedIn || player.parked || player.isActive === false) {
      return createTvVacantSlot(`vacant-tv-${index}`);
    }
    return player;
  });

  const groups: Player[][] = [];
  for (let index = 0; index < slots.length && groups.length < maxGroups; index += 4) {
    const group = slots.slice(index, index + 4);
    while (group.length < 4) {
      group.push(createTvVacantSlot(`vacant-tv-pad-${index}-${group.length}`));
    }
    groups.push(group);
  }
  return groups;
}

export const getStackDisplayGroups = getTvStackGroups;

/** Keep stack slot structure; preserve vacant placeholders like server normalizeStack. */
export function splitStackGroups(stackOrder: string[]): string[][] {
  if (stackOrder.length === 0) return [];
  const groups: string[][] = [];
  for (let index = 0; index < stackOrder.length; index += 4) {
    groups.push(stackOrder.slice(index, index + 4));
  }
  return groups;
}

export function flattenStackGroups(groups: string[][]): string[] {
  return groups.flat();
}

export function reconcileStackOrder(
  stackOrder: string[],
  players: Player[],
  matches: Match[],
  courts: Court[],
  options: { autoAppendMissing?: boolean } = {}
): string[] {
  const { autoAppendMissing = true } = options;
  const activeIds = new Set(
    matches
      .filter((match) => match.status === "InProgress")
      .flatMap((match) => [...match.teamAPlayerIds, ...match.teamBPlayerIds])
  );
  const reservedIds = new Set(courts.flatMap((court) => court.reservedPlayerIds ?? []));
  const eligibleIds = new Set(
    players
      .filter(
        (player) =>
          player.checkedIn &&
          !player.parked &&
          player.isActive !== false &&
          !activeIds.has(player.id) &&
          !reservedIds.has(player.id)
      )
      .map((player) => player.id)
  );

  const seenIds = new Set<string>();
  const cleaned: string[] = [];

  for (const id of stackOrder) {
    if (id === "vacant" || id === "reserved") {
      cleaned.push(id);
      continue;
    }
    if (eligibleIds.has(id)) {
      if (!seenIds.has(id)) {
        seenIds.add(id);
        cleaned.push(id);
      } else {
        cleaned.push("vacant");
      }
      continue;
    }
    cleaned.push("vacant");
  }

  for (const id of eligibleIds) {
    if (!autoAppendMissing) continue;
    if (!seenIds.has(id)) {
      seenIds.add(id);
      cleaned.push(id);
    }
  }

  if (cleaned.length === 0) return [];
  return cleaned;
}

export function getOnCourtPlayerIds(matches: Match[]): Set<string> {
  return new Set(
    matches
      .filter((match) => match.status === "InProgress")
      .flatMap((match) => [...match.teamAPlayerIds, ...match.teamBPlayerIds])
      .filter((id) => id && id !== "vacant" && !id.startsWith("vacant"))
  );
}

/** Only admin-cleared check-ins (or players mid-game) count as checked in. */
export function resolveAuthorizedCheckInIds(
  checkedInIds: Iterable<string>,
  adminCheckedInIds: string[] | undefined,
  players: Player[],
  matches: Match[]
): Set<string> {
  const onCourt = getOnCourtPlayerIds(matches);
  const adminSet = new Set(adminCheckedInIds ?? []);
  const localAdminTagged = new Set(
    players.filter((player) => player.tags?.includes("AdminCheckedIn")).map((player) => player.id)
  );
  const authorized = new Set<string>();
  for (const id of checkedInIds) {
    if (adminSet.has(id) || localAdminTagged.has(id) || onCourt.has(id)) {
      authorized.add(id);
    }
  }
  for (const id of localAdminTagged) authorized.add(id);
  for (const id of onCourt) authorized.add(id);
  if ((adminCheckedInIds ?? []).length === 0 && localAdminTagged.size === 0) {
    return new Set(onCourt);
  }
  return authorized;
}

export function stripUnauthorizedCheckIns(players: Player[], matches: Match[]): Player[] {
  const onCourt = getOnCourtPlayerIds(matches);
  return players.map((player) => {
    if (!player.checkedIn) return player;
    const adminCleared = player.tags?.includes("AdminCheckedIn");
    if (adminCleared || onCourt.has(player.id)) return player;
    return {
      ...player,
      checkedIn: false,
      parked: false,
      tags: (player.tags ?? []).filter((tag) => tag !== "AdminCheckedIn")
    };
  });
}

export function generateId() {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch (e) {
    // fallback
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

const BROKEN_AVATAR_PATTERN = /giphy\.com|multiavatar\.com/i;

export function isUsableAvatarUrl(url?: string | null): url is string {
  if (!url || !url.trim()) return false;
  if (BROKEN_AVATAR_PATTERN.test(url)) return false;
  if (url.startsWith("data:") || url.startsWith("/") || url.startsWith("blob:")) return true;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function dicebearAvatar(seed: string, style: "fun-emoji" | "avataaars" | "notionists" = "fun-emoji") {
  const safeSeed = encodeURIComponent(seed.trim() || "player");
  return `https://api.dicebear.com/7.x/${style}/svg?seed=${safeSeed}`;
}

export function getPlayerAvatar(player?: { id?: string; displayName?: string; avatarUrl?: string | null }) {
  if (isUsableAvatarUrl(player?.avatarUrl)) return player.avatarUrl;
  const seed = player?.id || player?.displayName || "player";
  return dicebearAvatar(seed, "fun-emoji");
}

export const AVATAR_PRESETS = [
  { name: "😎 Cool", seed: "cool-player" },
  { name: "🎮 Gamer", seed: "gamer-player" },
  { name: "🏆 Champ", seed: "champion-player" },
  { name: "⚡ Fast", seed: "lightning-player" },
  { name: "🔥 Fire", seed: "fire-player" },
  { name: "🌟 Star", seed: "star-player" },
  { name: "🎯 Ace", seed: "ace-player" },
  { name: "💎 Pro", seed: "diamond-player" },
  { name: "🚀 Rocket", seed: "rocket-player" },
  { name: "🎪 Fun", seed: "fun-player" }
].map((preset) => ({
  ...preset,
  url: dicebearAvatar(preset.seed, "fun-emoji")
}));
