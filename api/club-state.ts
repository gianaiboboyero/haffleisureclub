import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { prisma } from "./_prisma.js";
import { requireUser } from "./_auth.js";
import { publishRealtime } from "./_realtime.js";

type ClubSettings = {
  stackOrder?: string[];
  adminCheckedInIds?: string[];
  tvBroadcast?: unknown;
  courts?: unknown[];
  matches?: unknown[];
  reservations?: unknown[];
  playerProfiles?: Array<{
    id: string;
    displayName: string;
    avatarUrl?: string | null;
    skillLevel: string;
    statusNote?: string | null;
  }>;
  playerKudos?: unknown[];
  matchReviews?: unknown[];
};

const playerProfilesFrom = (value: unknown) =>
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
          };
        })
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    : [];

const playerKudosFrom = (value: unknown) => {
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
      return {
        id: item.id,
        matchId: item.matchId,
        fromPlayerId: item.fromPlayerId,
        fromPlayerName: item.fromPlayerName,
        toPlayerId: item.toPlayerId,
        pills: Array.isArray(item.pills) ? item.pills.map(String).filter(Boolean) : [],
        note: typeof item.note === "string" && item.note.trim() ? item.note.trim() : undefined,
        createdAt: item.createdAt
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
};

const matchReviewsFrom = (value: unknown) => {
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
        reviewedAt: item.reviewedAt
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
};

const mergeById = <T extends { id: string }>(base: T[], incoming: T[]) => {
  const map = new Map(base.map((entry) => [entry.id, entry]));
  for (const entry of incoming) map.set(entry.id, entry);
  return [...map.values()];
};

const mergeReviews = (
  base: ReturnType<typeof matchReviewsFrom>,
  incoming: ReturnType<typeof matchReviewsFrom>
) => {
  const map = new Map(base.map((entry) => [`${entry.matchId}:${entry.reviewerId}`, entry]));
  for (const entry of incoming) map.set(`${entry.matchId}:${entry.reviewerId}`, entry);
  return [...map.values()];
};

const reservationsFrom = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((entry) => {
        if (!entry || typeof entry !== "object") return false;
        const reservation = entry as Record<string, unknown>;
        return (
          typeof reservation.id === "string"
          && typeof reservation.courtId === "string"
          && typeof reservation.startTime === "string"
          && typeof reservation.endTime === "string"
          && typeof reservation.hostPlayerId === "string"
        );
      })
    : [];
const stringArray = (value: unknown) =>
  Array.isArray(value) ? value.map(String) : [];
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

const trimProfiles = (
  profiles: ReturnType<typeof playerProfilesFrom>,
  checkedInPlayerIds: string[],
  stackOrder: unknown,
  matches: unknown
) => {
  const needed = profileIdsForSession(checkedInPlayerIds, stackOrder, matches);
  return profiles.filter((profile) => needed.has(profile.id));
};

const filterAuthorizedCheckIns = (
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

const normalizeStack = (value: unknown, checkedInIds: string[]) => {
  const eligible = new Set(checkedInIds);
  const seen = new Set<string>();
  return stringArray(value).map((id) => {
    if (id === "vacant" || id === "reserved") return id;
    if (!eligible.has(id) || seen.has(id)) return "vacant";
    seen.add(id);
    return id;
  });
};

const tvBroadcastFrom = (value: unknown) => {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  if (typeof item.id !== "string" || typeof item.kind !== "string" || typeof item.createdAt !== "string") {
    return null;
  }
  if (!["message", "court", "overtime"].includes(item.kind)) return null;
  return {
    id: item.id,
    kind: item.kind as "message" | "court" | "overtime",
    createdAt: item.createdAt,
    message: typeof item.message === "string" ? item.message : undefined,
    courtId: typeof item.courtId === "string" ? item.courtId : undefined,
    courtName: typeof item.courtName === "string" ? item.courtName : undefined,
    participantIds: Array.isArray(item.participantIds) ? item.participantIds.map(String) : undefined,
    variant: item.variant === "reserved" ? ("reserved" as const) : item.variant === "active" ? ("active" as const) : undefined
  };
};

async function findActiveSession(sessionId?: string) {
  if (sessionId) {
    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    // Only use the exact match if it is still the active session; otherwise fall
    // through to the most-recently-updated active session.  This prevents stale
    // session IDs cached in a TV device's localStorage from silently returning
    // yesterday's state instead of today's.
    if (session?.status === "Active") return session;
  }
  return prisma.session.findFirst({
    where: { status: "Active" },
    orderBy: { updatedAt: "desc" }
  });
}

async function findSessionMeta(sessionId?: string) {
  if (sessionId) {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: { id: true, updatedAt: true, status: true }
    });
    if (session?.status === "Active") return session;
  }
  return prisma.session.findFirst({
    where: { status: "Active" },
    orderBy: { updatedAt: "desc" },
    select: { id: true, updatedAt: true, status: true }
  });
}

const minimalPostResponse = (sessionId: string, updatedAt: Date) => ({
  sessionId,
  updatedAt: updatedAt.toISOString()
});

async function notifySessionChanged(sessionId: string, updatedAt: Date) {
  const payload = {
    sessionId,
    updatedAt: updatedAt.toISOString(),
    eventId: randomUUID()
  };
  await Promise.all([
    publishRealtime("haff:operations:club", "session.updated", payload),
    publishRealtime("haff:operations:tv", "session.updated", payload)
  ]);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const actor = await requireUser(req, res);
  if (!actor) return;

  const requestedSessionId = String(
    req.method === "GET" ? req.query.sessionId ?? "" : req.body?.sessionId ?? ""
  );
  const pingOnly = String(req.query.ping ?? "") === "1";
  const tvView = String(req.query.view ?? "") === "tv";
  const playerView = String(req.query.view ?? "") === "player";

  if (req.method === "GET" && pingOnly) {
    res.setHeader("Cache-Control", "private, no-store, max-age=0");
    const meta = await findSessionMeta(requestedSessionId);
    const sinceRaw = String(req.query.since ?? "").trim();
    if (!meta) {
      return res.status(200).json({
        ping: true,
        sessionId: requestedSessionId || "default-active-session",
        updatedAt: null,
        unchanged: false
      });
    }
    const serverIso = meta.updatedAt.toISOString();
    const sinceMs = Date.parse(sinceRaw);
    const serverMs = meta.updatedAt.getTime();
    const unchanged =
      Boolean(sinceRaw)
      && (sinceRaw === serverIso || (!Number.isNaN(sinceMs) && sinceMs === serverMs));
    return res.status(200).json({
      ping: true,
      sessionId: meta.id,
      updatedAt: serverIso,
      unchanged
    });
  }

  let session = await findActiveSession(requestedSessionId);

  if (req.method === "GET") {
    res.setHeader("Cache-Control", "private, no-store, max-age=0");
    const settings = (session?.settings ?? {}) as ClubSettings;
    const sinceRaw = String(req.query.since ?? "").trim();
    if (sinceRaw && session?.updatedAt) {
      const serverIso = session.updatedAt.toISOString();
      const sinceMs = Date.parse(sinceRaw);
      const serverMs = session.updatedAt.getTime();
      if (sinceRaw === serverIso || (!Number.isNaN(sinceMs) && sinceMs === serverMs)) {
        return res.status(200).json({
          unchanged: true,
          sessionId: session.id,
          updatedAt: serverIso,
          tvBroadcast: tvBroadcastFrom(settings.tvBroadcast)
        });
      }
    }
    const adminCheckedInIds = stringArray(settings.adminCheckedInIds);
    const rawCheckedIn = session?.checkedInPlayerIds ?? [];
    const checkedInPlayerIds = filterAuthorizedCheckIns(
      rawCheckedIn,
      adminCheckedInIds,
      settings.matches
    );
    const stackOrder = normalizeStack(settings.stackOrder, checkedInPlayerIds);
    const matches = Array.isArray(settings.matches) ? settings.matches : [];
    const allProfiles = playerProfilesFrom(settings.playerProfiles);
    const slimProfiles = trimProfiles(allProfiles, checkedInPlayerIds, stackOrder, matches);
    const lightView = tvView || playerView;
    return res.status(200).json({
      sessionId: session?.id ?? (requestedSessionId || "default-active-session"),
      checkedInPlayerIds,
      adminCheckedInIds,
      stackOrder,
      courts: Array.isArray(settings.courts) ? settings.courts : [],
      matches,
      reservations: lightView ? [] : reservationsFrom(settings.reservations),
      playerProfiles: [],
      playerKudos: lightView ? [] : playerKudosFrom(settings.playerKudos),
      matchReviews: lightView ? [] : matchReviewsFrom(settings.matchReviews),
      tvBroadcast: tvBroadcastFrom(settings.tvBroadcast),
      updatedAt: session?.updatedAt ?? null
    });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const incomingCheckedIn = stringArray(req.body?.checkedInPlayerIds);
  const incomingAdminCheckedIn = stringArray(req.body?.adminCheckedInIds);
  const incomingStack = stringArray(req.body?.stackOrder);

  if (!session) {
    session = await prisma.session.create({
      data: {
        id: requestedSessionId || "default-active-session",
        name: "Open Play Session",
        date: new Date(),
        mode: "Open Play",
        status: "Active",
        checkedInPlayerIds: [],
        settings: {}
      }
    });
  }

  if (req.body?.broadcastOnly && actor.role === "ADMIN") {
    const tvBroadcast = tvBroadcastFrom(req.body.tvBroadcast);
    if (!tvBroadcast) {
      return res.status(400).json({ error: "Invalid tvBroadcast payload" });
    }
    const broadcastSettings: Prisma.InputJsonValue = {
      ...(session.settings as Record<string, unknown>),
      tvBroadcast
    } as Prisma.InputJsonValue;
    const updated = await prisma.session.update({
      where: { id: session.id },
      data: { settings: broadcastSettings }
    });
    await notifySessionChanged(updated.id, updated.updatedAt);
    return res.status(200).json({
      ...minimalPostResponse(updated.id, updated.updatedAt),
      tvBroadcast
    });
  }

  const currentSettings = (session.settings ?? {}) as ClubSettings;
  let checkedInPlayerIds = session.checkedInPlayerIds;
  let adminCheckedInIds = stringArray(currentSettings.adminCheckedInIds);
  let stackOrder = stringArray(currentSettings.stackOrder);
  let courts = Array.isArray(currentSettings.courts) ? currentSettings.courts : [];
  let matches = Array.isArray(currentSettings.matches) ? currentSettings.matches : [];
  let reservations = reservationsFrom(currentSettings.reservations);
  let playerProfiles = playerProfilesFrom(currentSettings.playerProfiles);
  let playerKudos = playerKudosFrom(currentSettings.playerKudos);
  let matchReviews = matchReviewsFrom(currentSettings.matchReviews);
  let tvBroadcast = tvBroadcastFrom(currentSettings.tvBroadcast);

  if (actor.role === "ADMIN") {
    checkedInPlayerIds = incomingCheckedIn;
    adminCheckedInIds = incomingAdminCheckedIn.length > 0
      ? incomingAdminCheckedIn.filter((id) => incomingCheckedIn.includes(id))
      : incomingCheckedIn;
    stackOrder = normalizeStack(incomingStack, checkedInPlayerIds);
    courts = Array.isArray(req.body?.courts) ? req.body.courts : courts;
    matches = Array.isArray(req.body?.matches) ? req.body.matches : matches;
    if (Array.isArray(req.body?.reservations)) {
      reservations = reservationsFrom(req.body.reservations);
    }
    playerProfiles = Array.isArray(req.body?.playerProfiles)
      ? playerProfilesFrom(req.body.playerProfiles)
      : playerProfiles;
    if (Array.isArray(req.body?.playerKudos)) {
      playerKudos = playerKudosFrom(req.body.playerKudos);
    }
    if (Array.isArray(req.body?.matchReviews)) {
      matchReviews = matchReviewsFrom(req.body.matchReviews);
    }
    if (req.body?.tvBroadcast) {
      const incomingBroadcast = tvBroadcastFrom(req.body.tvBroadcast);
      if (incomingBroadcast) tvBroadcast = incomingBroadcast;
    }
  } else if (actor.playerId) {
    const playerId = actor.playerId;
    const wantsCheckedIn = incomingCheckedIn.includes(playerId);
    const wasCheckedIn = checkedInPlayerIds.includes(playerId);

    if (wantsCheckedIn && !wasCheckedIn) {
      // Players cannot self check-in; only admin can add them.
    } else if (!wantsCheckedIn && wasCheckedIn) {
      checkedInPlayerIds = checkedInPlayerIds.filter((id) => id !== playerId);
      adminCheckedInIds = adminCheckedInIds.filter((id) => id !== playerId);
      stackOrder = stackOrder.filter((id) => id !== playerId);
      stackOrder = normalizeStack(stackOrder, checkedInPlayerIds);
    }
    const ownProfile = playerProfilesFrom(req.body?.playerProfiles).find((profile) => profile.id === actor.playerId);
    if (ownProfile) {
      playerProfiles = [
        ...playerProfiles.filter((profile) => profile.id !== actor.playerId),
        ownProfile
      ];
    }
    if (Array.isArray(req.body?.reservations)) {
      const incoming = reservationsFrom(req.body.reservations);
      const own = incoming.filter((item) => item.hostPlayerId === actor.playerId);
      const others = reservations.filter((item) => item.hostPlayerId !== actor.playerId);
      reservations = [...others, ...own];
    }
    if (Array.isArray(req.body?.playerKudos)) {
      const own = playerKudosFrom(req.body.playerKudos).filter((entry) => entry.fromPlayerId === actor.playerId);
      const others = playerKudos.filter((entry) => entry.fromPlayerId !== actor.playerId);
      playerKudos = mergeById(others, own);
    }
    if (Array.isArray(req.body?.matchReviews)) {
      const own = matchReviewsFrom(req.body.matchReviews).filter((entry) => entry.reviewerId === actor.playerId);
      const others = matchReviews.filter((entry) => entry.reviewerId !== actor.playerId);
      matchReviews = mergeReviews(others, own);
    }
  }

  const {
    playerProfiles: _legacyProfiles,
    reservations: _legacyReservations,
    ...restSettings
  } = currentSettings as Record<string, unknown>;

  const settings: Prisma.InputJsonValue = {
    ...restSettings,
    adminCheckedInIds,
    stackOrder,
    courts,
    matches,
    playerKudos,
    matchReviews,
    tvBroadcast
  } as Prisma.InputJsonValue;

  const updated = await prisma.session.update({
    where: { id: session.id },
    data: { checkedInPlayerIds, settings }
  });

  await notifySessionChanged(updated.id, updated.updatedAt);

  const wantsFullBody = String(req.query.full ?? req.body?.full ?? "") === "1";
  if (wantsFullBody) {
    return res.status(200).json({
      sessionId: updated.id,
      checkedInPlayerIds,
      adminCheckedInIds,
      stackOrder,
      courts,
      matches,
      reservations,
      playerProfiles,
      playerKudos,
      matchReviews,
      tvBroadcast,
      updatedAt: updated.updatedAt
    });
  }

  return res.status(200).json(minimalPostResponse(updated.id, updated.updatedAt));
}
