import type { Prisma } from "@prisma/client";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { prisma } from "./_prisma.js";
import { requireAdmin } from "./_auth.js";
import { audit } from "./_audit.js";

type SyncEvent = {
  id: string;
  actionType: string;
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
};

const optionalDate = (value: unknown) =>
  typeof value === "string" && value ? new Date(value) : null;

async function processEvent(event: SyncEvent) {
  const { actionType, entityType, entityId, payload } = event;

  if (entityType === "Player") {
    if (actionType === "DELETE_PLAYER") {
      await prisma.player.deleteMany({ where: { id: entityId } });
      return;
    }

    const data = {
      displayName: String(payload.displayName ?? "Player"),
      fullName: typeof payload.fullName === "string" ? payload.fullName : null,
      nickname: typeof payload.nickname === "string" ? payload.nickname : null,
      skillLevel: String(payload.skillLevel ?? "Beginner"),
      rating: Number(payload.rating ?? 2),
      avatarUrl: typeof payload.avatarUrl === "string" ? payload.avatarUrl : null,
      phone: typeof payload.phoneNumber === "string" ? payload.phoneNumber : null,
      tags: Array.isArray(payload.tags) ? payload.tags.map(String) : [],
      status: payload.isActive === false ? "Inactive" : "Active",
      totalGamesPlayed: Number(payload.totalGamesPlayed ?? 0),
      totalDaysPlayed: Number(payload.totalDaysPlayed ?? 0),
      lastPlayedDate: optionalDate(payload.lastPlayedDate)
    };
    await prisma.player.upsert({
      where: { id: entityId },
      create: { id: entityId, ...data },
      update: data
    });
    return;
  }

  if (entityType === "Court") {
    if (actionType === "DELETE_COURT") {
      await prisma.court.deleteMany({ where: { id: entityId } });
      return;
    }

    const data = {
      name: String(payload.name ?? "Court"),
      number: Number(payload.number ?? 0),
      status: String(payload.status ?? "Available"),
      currentMatchId:
        typeof payload.currentMatchId === "string" ? payload.currentMatchId : null,
      nextMatchId: typeof payload.nextMatchId === "string" ? payload.nextMatchId : null,
      notes: typeof payload.notes === "string" ? payload.notes : null
    };
    await prisma.court.upsert({
      where: { id: entityId },
      create: { id: entityId, ...data },
      update: data
    });
    return;
  }

  if (entityType === "Session") {
    if (actionType === "DELETE_SESSION") {
      await prisma.session.deleteMany({ where: { id: entityId } });
      return;
    }

    const data = {
      name: String(payload.name ?? "Session"),
      date: optionalDate(payload.date) ?? new Date(),
      startTime: typeof payload.startTime === "string" ? payload.startTime : null,
      endTime: typeof payload.endTime === "string" ? payload.endTime : null,
      location: typeof payload.location === "string" ? payload.location : null,
      mode: String(payload.mode ?? "Open Play"),
      status: String(payload.status ?? "Draft"),
      courtIds: Array.isArray(payload.courtIds) ? payload.courtIds.map(String) : [],
      checkedInPlayerIds: Array.isArray(payload.checkedInPlayerIds)
        ? payload.checkedInPlayerIds.map(String)
        : [],
      settings: (payload.settings ?? {}) as Prisma.InputJsonValue
    };
    await prisma.session.upsert({
      where: { id: entityId },
      create: { id: entityId, ...data },
      update: data
    });
    return;
  }

  if (entityType === "Match") {
    const data = {
      sessionId: typeof payload.sessionId === "string" ? payload.sessionId : null,
      courtId: typeof payload.courtId === "string" ? payload.courtId : null,
      mode: String(payload.mode ?? "Open Play"),
      teamAPlayerIds: Array.isArray(payload.teamAPlayerIds)
        ? payload.teamAPlayerIds.map(String)
        : [],
      teamBPlayerIds: Array.isArray(payload.teamBPlayerIds)
        ? payload.teamBPlayerIds.map(String)
        : [],
      scoreA: Number(payload.scoreA ?? 0),
      scoreB: Number(payload.scoreB ?? 0),
      status: String(payload.status ?? "Queued"),
      startedAt: optionalDate(payload.startedAt),
      endedAt: optionalDate(payload.endedAt),
      durationSeconds:
        typeof payload.durationSeconds === "number" ? payload.durationSeconds : null,
      syncStatus: "Synced"
    };
    await prisma.match.upsert({
      where: { id: entityId },
      create: { id: entityId, ...data },
      update: data
    });
    return;
  }

  throw new Error(`Unhandled entity type: ${entityType}`);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  if (!Array.isArray(req.body)) {
    return res.status(400).json({ success: false, error: "Events payload must be an array" });
  }

  const results = [];
  for (const event of req.body as SyncEvent[]) {
    try {
      await processEvent(event);
      results.push({ id: event.id, status: "Synced" });
      await prisma.syncEvent
        .create({
          data: {
            actionType: event.actionType,
            entityType: event.entityType,
            entityId: event.entityId,
            payload: event.payload as Prisma.InputJsonValue,
            status: "Synced",
            syncedAt: new Date()
          }
        })
        .catch(() => undefined);
      await audit(admin.id, "LEGACY_SYNC_APPLIED", event.entityType, event.entityId, {
        actionType: event.actionType,
        eventId: event.id
      });
    } catch (error) {
      console.error(`Sync failed for ${event.id}`, error);
      results.push({
        id: event.id,
        status: "Failed",
        error: error instanceof Error ? error.message : "Unknown sync error"
      });
    }
  }

  return res.status(200).json({
    success: true,
    processedCount: results.filter((result) => result.status === "Synced").length,
    results
  });
}
