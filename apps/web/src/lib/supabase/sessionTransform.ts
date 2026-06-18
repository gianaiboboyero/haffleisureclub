import type { Match } from "../types";

export type PlayerProfileSnapshot = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  skillLevel: string;
  statusNote: string | null;
};

export type ClubSettings = {
  stackOrder?: string[];
  adminCheckedInIds?: string[];
  tvBroadcast?: unknown;
  courts?: unknown[];
  matches?: unknown[];
  reservations?: unknown[];
  playerProfiles?: PlayerProfileSnapshot[];
  playerKudos?: unknown[];
  matchReviews?: unknown[];
};

export type SharedClubStatePayload = {
  sessionId: string;
  checkedInPlayerIds: string[];
  adminCheckedInIds: string[];
  stackOrder: string[];
  courts: unknown[];
  matches: Match[];
  reservations: unknown[];
  playerProfiles: PlayerProfileSnapshot[];
  playerKudos: unknown[];
  matchReviews: unknown[];
  tvBroadcast: unknown;
  updatedAt: string | null;
  unchanged?: boolean;
  ping?: boolean;
};

const stringArray = (value: unknown) => (Array.isArray(value) ? value.map(String) : []);

const activeMatchPlayerIds = (matches: unknown) => {
  const ids = new Set<string>();
  if (!Array.isArray(matches)) return ids;
  for (const entry of matches) {
    if (!entry || typeof entry !== "object") continue;
    const match = entry as Record<string, unknown>;
    if (match.status !== "InProgress") continue;
    for (const key of ["teamAPlayerIds", "teamBPlayerIds"]) {
      for (const id of stringArray(match[key])) {
        if (id && id !== "vacant" && !id.startsWith("vacant")) ids.add(id);
      }
    }
  }
  return ids;
};

const profileIdsForSession = (
  checkedInPlayerIds: string[],
  stackOrder: unknown,
  matches: unknown
) => {
  const ids = new Set(checkedInPlayerIds);
  for (const id of stringArray(stackOrder)) {
    if (id !== "vacant" && id !== "reserved") ids.add(id);
  }
  for (const id of activeMatchPlayerIds(matches)) ids.add(id);
  return ids;
};

export const trimProfiles = (
  profiles: PlayerProfileSnapshot[],
  checkedInPlayerIds: string[],
  stackOrder: unknown,
  matches: unknown
) => {
  const needed = profileIdsForSession(checkedInPlayerIds, stackOrder, matches);
  return profiles.filter((profile) => needed.has(profile.id));
};

export const filterAuthorizedCheckIns = (
  checkedInIds: string[],
  adminCheckedInIds: string[],
  matches: unknown
) => {
  const onCourt = activeMatchPlayerIds(matches);
  if (adminCheckedInIds.length > 0) {
    const allowed = new Set([...adminCheckedInIds, ...onCourt]);
    return checkedInIds.filter((id) => allowed.has(id));
  }
  return checkedInIds.filter((id) => onCourt.has(id));
};

export const normalizeStack = (value: unknown, checkedInIds: string[]) => {
  const eligible = new Set(checkedInIds);
  const seen = new Set<string>();
  return stringArray(value).map((id) => {
    if (id === "vacant" || id === "reserved") return id;
    if (!eligible.has(id) || seen.has(id)) return "vacant";
    seen.add(id);
    return id;
  });
};

export const playerProfilesFrom = (value: unknown): PlayerProfileSnapshot[] =>
  Array.isArray(value)
    ? value
        .map((entry) => {
          if (!entry || typeof entry !== "object") return null;
          const profile = entry as Record<string, unknown>;
          if (typeof profile.id !== "string" || typeof profile.displayName !== "string") return null;
          return {
            id: profile.id,
            displayName: profile.displayName,
            avatarUrl: typeof profile.avatarUrl === "string" ? profile.avatarUrl : null,
            skillLevel: typeof profile.skillLevel === "string" ? profile.skillLevel : "Beginner",
            statusNote: typeof profile.statusNote === "string" ? profile.statusNote : null
          } satisfies PlayerProfileSnapshot;
        })
        .filter((entry): entry is PlayerProfileSnapshot => entry !== null)
    : [];

export function isUnchangedSince(sinceRaw: string, serverUpdatedAt: string | Date): boolean {
  const serverIso =
    serverUpdatedAt instanceof Date ? serverUpdatedAt.toISOString() : String(serverUpdatedAt);
  const sinceMs = Date.parse(sinceRaw);
  const serverMs = Date.parse(serverIso);
  return sinceRaw === serverIso || (!Number.isNaN(sinceMs) && sinceMs === serverMs);
}

export function buildSharedPayload(
  session: {
    id: string;
    checkedInPlayerIds: string[];
    settings: unknown;
    updatedAt: string | Date | null;
  },
  options?: { since?: string; lightView?: boolean }
): SharedClubStatePayload | { unchanged: true; sessionId: string; updatedAt: string; tvBroadcast: unknown } {
  const settings = (session.settings ?? {}) as ClubSettings;
  const updatedAt =
    session.updatedAt instanceof Date
      ? session.updatedAt.toISOString()
      : session.updatedAt
        ? String(session.updatedAt)
        : null;

  if (options?.since && updatedAt && isUnchangedSince(options.since, updatedAt)) {
    return {
      unchanged: true,
      sessionId: session.id,
      updatedAt,
      tvBroadcast: settings.tvBroadcast ?? null
    };
  }

  const adminCheckedInIds = stringArray(settings.adminCheckedInIds);
  const rawCheckedIn = session.checkedInPlayerIds ?? [];
  const matches = Array.isArray(settings.matches) ? (settings.matches as Match[]) : [];
  const checkedInPlayerIds = filterAuthorizedCheckIns(rawCheckedIn, adminCheckedInIds, matches);
  const stackOrder = normalizeStack(settings.stackOrder, checkedInPlayerIds);
  const allProfiles = playerProfilesFrom(settings.playerProfiles);
  const slimProfiles = trimProfiles(allProfiles, checkedInPlayerIds, stackOrder, matches);
  const lightView = options?.lightView ?? false;

  return {
    sessionId: session.id,
    checkedInPlayerIds,
    adminCheckedInIds,
    stackOrder,
    courts: Array.isArray(settings.courts) ? settings.courts : [],
    matches,
    reservations: lightView ? [] : Array.isArray(settings.reservations) ? settings.reservations : [],
    playerProfiles: slimProfiles,
    playerKudos: lightView ? [] : Array.isArray(settings.playerKudos) ? settings.playerKudos : [],
    matchReviews: lightView ? [] : Array.isArray(settings.matchReviews) ? settings.matchReviews : [],
    tvBroadcast: settings.tvBroadcast ?? null,
    updatedAt
  };
}
