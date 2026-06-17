import type { Prisma } from "@prisma/client";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { prisma } from "./_prisma.js";
import { requireUser } from "./_auth.js";

type ClubSettings = {
  stackOrder?: string[];
  parkedPlayerIds?: string[];
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

const normalizeStack = (value: unknown, checkedInIds: string[], parkedIds: string[] = []) => {
  const eligible = new Set(checkedInIds.filter((id) => !parkedIds.includes(id)));
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

async function findSession(sessionId?: string) {
  if (sessionId) {
    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (session) return session;
  }
  return prisma.session.findFirst({
    where: { status: "Active" },
    orderBy: { updatedAt: "desc" }
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const actor = await requireUser(req, res);
  if (!actor) return;

  const requestedSessionId = String(
    req.method === "GET" ? req.query.sessionId ?? "" : req.body?.sessionId ?? ""
  );
  let session = await findSession(requestedSessionId);

  if (req.method === "GET") {
    const settings = (session?.settings ?? {}) as ClubSettings;
    const adminCheckedInIds = stringArray(settings.adminCheckedInIds);
    const rawCheckedIn = session?.checkedInPlayerIds ?? [];
    const checkedInPlayerIds = filterAuthorizedCheckIns(
      rawCheckedIn,
      adminCheckedInIds,
      settings.matches
    );
    const parkedPlayerIds = stringArray(settings.parkedPlayerIds).filter((id) =>
      checkedInPlayerIds.includes(id)
    );
    return res.status(200).json({
      sessionId: session?.id ?? (requestedSessionId || "default-active-session"),
      checkedInPlayerIds,
      adminCheckedInIds,
      parkedPlayerIds,
      stackOrder: normalizeStack(settings.stackOrder, checkedInPlayerIds, parkedPlayerIds),
      courts: Array.isArray(settings.courts) ? settings.courts : [],
      matches: Array.isArray(settings.matches) ? settings.matches : [],
      reservations: reservationsFrom(settings.reservations),
      playerProfiles: playerProfilesFrom(settings.playerProfiles),
      playerKudos: playerKudosFrom(settings.playerKudos),
      matchReviews: matchReviewsFrom(settings.matchReviews),
      tvBroadcast: tvBroadcastFrom(settings.tvBroadcast),
      updatedAt: session?.updatedAt ?? null
    });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const incomingCheckedIn = stringArray(req.body?.checkedInPlayerIds);
  const incomingParked = stringArray(req.body?.parkedPlayerIds);
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
    return res.status(200).json({
      sessionId: updated.id,
      tvBroadcast,
      updatedAt: updated.updatedAt
    });
  }

  const currentSettings = (session.settings ?? {}) as ClubSettings;
  let checkedInPlayerIds = session.checkedInPlayerIds;
  let adminCheckedInIds = stringArray(currentSettings.adminCheckedInIds);
  let parkedPlayerIds = stringArray(currentSettings.parkedPlayerIds);
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
    parkedPlayerIds = incomingParked.filter((id) => incomingCheckedIn.includes(id));
    stackOrder = normalizeStack(incomingStack, checkedInPlayerIds, parkedPlayerIds);
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
    const wantsParked = incomingParked.includes(playerId);
    const wasCheckedIn = checkedInPlayerIds.includes(playerId);
    const wasParked = parkedPlayerIds.includes(playerId);
    const adminCleared = adminCheckedInIds.includes(playerId);

    if (wantsCheckedIn && !wasCheckedIn) {
      // Players cannot self check-in; only admin can add them.
    } else if (!wantsCheckedIn && wasCheckedIn) {
      checkedInPlayerIds = checkedInPlayerIds.filter((id) => id !== playerId);
      adminCheckedInIds = adminCheckedInIds.filter((id) => id !== playerId);
      parkedPlayerIds = parkedPlayerIds.filter((id) => id !== playerId);
      stackOrder = stackOrder.filter((id) => id !== playerId);
      stackOrder = normalizeStack(stackOrder, checkedInPlayerIds, parkedPlayerIds);
    } else if (wasCheckedIn && adminCleared) {
      parkedPlayerIds = wantsParked
        ? Array.from(new Set([...parkedPlayerIds.filter((id) => id !== playerId), playerId]))
        : parkedPlayerIds.filter((id) => id !== playerId);
      if (wantsParked !== wasParked) {
        stackOrder = stackOrder.filter((id) => id !== playerId);
        if (!wantsParked) {
          const vacantIndex = stackOrder.indexOf("vacant");
          if (vacantIndex >= 0) stackOrder[vacantIndex] = playerId;
          else stackOrder.push(playerId);
        }
      }
      stackOrder = normalizeStack(stackOrder, checkedInPlayerIds, parkedPlayerIds);
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

  const settings: Prisma.InputJsonValue = {
    ...(session.settings as Record<string, unknown>),
    parkedPlayerIds,
    adminCheckedInIds,
    stackOrder,
    courts,
    matches,
    reservations,
    playerProfiles,
    playerKudos,
    matchReviews,
    tvBroadcast
  } as Prisma.InputJsonValue;

  const updated = await prisma.session.update({
    where: { id: session.id },
    data: { checkedInPlayerIds, settings }
  });

  return res.status(200).json({
    sessionId: updated.id,
    checkedInPlayerIds,
    adminCheckedInIds,
    parkedPlayerIds,
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
