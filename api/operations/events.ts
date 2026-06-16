import type { Prisma } from "@prisma/client";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { prisma } from "../_prisma.js";
import { requireUser } from "../_auth.js";
import { audit } from "../_audit.js";

type OperationInput = {
  id: string;
  idempotencyKey?: string;
  deviceId: string;
  actionType: string;
  entityType: "Player" | "Court" | "Session" | "Match";
  entityId: string;
  baseVersion?: number;
  payload: Record<string, unknown>;
  clientAt: string;
};

const blockedTypes = new Set(["Transaction", "Reservation", "User", "Testimonial", "ChatMessage"]);
const optionalDate = (value: unknown) => typeof value === "string" && value ? new Date(value) : null;

async function applyEvent(
  event: OperationInput,
  actor: { id: string; role: string; playerId: string | null },
  db: Prisma.TransactionClient,
) {
  if (blockedTypes.has(event.entityType)) throw new Error("This action requires an online request.");
  const isAdmin = actor.role === "ADMIN";
  if (event.entityType !== "Player" && !isAdmin) throw new Error("Administrator access required.");
  if (event.entityType === "Player" && !isAdmin && actor.playerId !== event.entityId) {
    throw new Error("You can only update your own player status.");
  }

  if (event.entityType === "Player") {
    const current = await db.player.findUnique({ where: { id: event.entityId } });
    if (!current) throw new Error("Player not found.");
    if (event.baseVersion != null && current.version !== event.baseVersion) {
      return { conflict: true, canonical: current };
    }
    const updated = await db.player.update({
      where: { id: event.entityId },
      data: {
        status: typeof event.payload.status === "string" ? event.payload.status : current.status,
        version: { increment: 1 }
      }
    });
    return { conflict: false, canonical: updated };
  }

  if (event.entityType === "Court") {
    const current = await db.court.findUnique({ where: { id: event.entityId } });
    if (!current) throw new Error("Court not found.");
    if (event.baseVersion != null && current.version !== event.baseVersion) {
      return { conflict: true, canonical: current };
    }
    const updated = await db.court.update({
      where: { id: event.entityId },
      data: {
        status: typeof event.payload.status === "string" ? event.payload.status : current.status,
        currentMatchId: typeof event.payload.currentMatchId === "string" ? event.payload.currentMatchId : null,
        nextMatchId: typeof event.payload.nextMatchId === "string" ? event.payload.nextMatchId : current.nextMatchId,
        version: { increment: 1 }
      }
    });
    return { conflict: false, canonical: updated };
  }

  if (event.entityType === "Session") {
    const current = await db.session.findUnique({ where: { id: event.entityId } });
    if (!current) throw new Error("Session not found.");
    if (event.baseVersion != null && current.version !== event.baseVersion) {
      return { conflict: true, canonical: current };
    }
    const updated = await db.session.update({
      where: { id: event.entityId },
      data: {
        checkedInPlayerIds: Array.isArray(event.payload.checkedInPlayerIds)
          ? event.payload.checkedInPlayerIds.map(String)
          : current.checkedInPlayerIds,
        status: typeof event.payload.status === "string" ? event.payload.status : current.status,
        version: { increment: 1 }
      }
    });
    return { conflict: false, canonical: updated };
  }

  const current = await db.match.findUnique({ where: { id: event.entityId } });
  if (!current) throw new Error("Match not found.");
  if (event.baseVersion != null && current.version !== event.baseVersion) {
    return { conflict: true, canonical: current };
  }
  if (event.actionType === "FINISH_MATCH" && current.status === "Completed") {
    return { conflict: false, canonical: current };
  }
  const serverStartedAt = event.actionType === "START_MATCH" ? new Date() : current.startedAt;
  const updated = await db.match.update({
    where: { id: event.entityId },
    data: {
      status: typeof event.payload.status === "string" ? event.payload.status : current.status,
      startedAt: serverStartedAt,
      endedAt: event.actionType === "FINISH_MATCH" ? new Date() : optionalDate(event.payload.endedAt) ?? current.endedAt,
      scoreA: typeof event.payload.scoreA === "number" ? event.payload.scoreA : current.scoreA,
      scoreB: typeof event.payload.scoreB === "number" ? event.payload.scoreB : current.scoreB,
      version: { increment: 1 }
    }
  });
  return { conflict: false, canonical: updated };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const actor = await requireUser(req, res);
  if (!actor) return;
  if (!Array.isArray(req.body) || req.body.length > 100) {
    return res.status(400).json({ error: "Send an array of up to 100 operation events." });
  }

  const results = [];
  for (const raw of req.body as OperationInput[]) {
    const event = {
      ...raw,
      idempotencyKey: raw.idempotencyKey || raw.id
    };
    if (!event.id || !event.deviceId || !event.entityId || !event.actionType || !event.clientAt) {
      results.push({ id: event.id, status: "Failed", error: "Invalid event." });
      continue;
    }
    const existing = await prisma.operationEvent.findUnique({ where: { idempotencyKey: event.idempotencyKey } });
    if (existing) {
      results.push({ id: event.id, status: existing.status, canonical: existing.result });
      continue;
    }

    const record = await prisma.operationEvent.create({
      data: {
        idempotencyKey: event.idempotencyKey,
        deviceId: event.deviceId,
        actorId: actor.id,
        actionType: event.actionType,
        entityType: event.entityType,
        entityId: event.entityId,
        baseVersion: event.baseVersion,
        payload: event.payload as Prisma.InputJsonValue,
        clientAt: new Date(event.clientAt)
      }
    });
    try {
      const applied = await prisma.$transaction((tx) => applyEvent(event, actor, tx));
      const status = applied.conflict ? "CONFLICT" : "APPLIED";
      await prisma.operationEvent.update({
        where: { id: record.id },
        data: {
          status,
          result: JSON.parse(JSON.stringify(applied.canonical)) as Prisma.InputJsonValue,
          appliedAt: applied.conflict ? null : new Date()
        }
      });
      if (!applied.conflict) {
        await audit(actor.id, "OPERATION_APPLIED", event.entityType, event.entityId, {
          actionType: event.actionType,
          idempotencyKey: event.idempotencyKey
        });
      }
      results.push({ id: event.id, status: applied.conflict ? "Conflict" : "Synced", canonical: applied.canonical });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Operation failed.";
      await prisma.operationEvent.update({ where: { id: record.id }, data: { status: "FAILED", error: message } });
      results.push({ id: event.id, status: "Failed", error: message });
    }
  }
  return res.status(200).json({ results });
}
