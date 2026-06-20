import type { Prisma } from "@prisma/client";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { prisma } from "./_prisma.js";
import { getUser, requireAdmin, requireUser } from "./_auth.js";
import { audit } from "./_audit.js";
import { publicReservationDto } from "./_security.js";

const DAY_MS = 86_400_000;
const dateOnly = (value: Date) => new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
const strings = (value: unknown) => Array.isArray(value) ? value.map(String) : [];
const parseDate = (value: unknown) => {
  const date = new Date(String(value ?? ""));
  return Number.isNaN(date.getTime()) ? null : date;
};
const overlaps = (start: Date, end: Date) => ({
  startTime: { lt: end },
  endTime: { gt: start }
});
const queuePriority = (reservation: { approvalStatus: string; paymentStatus: string }) => {
  if (reservation.approvalStatus === "PAYMENT_ISSUE") return 0;
  if (reservation.paymentStatus === "PAID") return 1;
  return 2;
};

async function notify(
  userId: string,
  type: string,
  title: string,
  message: string,
  tx: Pick<Prisma.TransactionClient, "userNotification"> = prisma
) {
  const recent = await tx.userNotification.findFirst({
    where: {
      userId,
      type,
      title,
      message,
      createdAt: { gte: new Date(Date.now() - 2 * 60_000) }
    }
  });
  if (recent) return;
  await tx.userNotification.create({ data: { userId, type, title, message } });
}

async function ensureCourtReservationSettings() {
  const courtsWithoutSettings = await prisma.court.findMany({
    where: { reservationSetting: null },
    select: { id: true }
  });
  if (!courtsWithoutSettings.length) return;
  await prisma.$transaction(courtsWithoutSettings.map((court) =>
    prisma.courtReservationSetting.create({
      data: {
        courtId: court.id,
        reservationsEnabled: true,
        openingTime: "06:00",
        closingTime: "22:00",
        minDurationMinutes: 30,
        maxDurationMinutes: 180,
        intervalMinutes: 30
      }
    })
  ));
}

function publicReservation(reservation: any, user: any) {
  return publicReservationDto(reservation, user);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = String(req.query.action ?? "week");
  const user = await getUser(req);

  if (req.method === "GET" && action === "week") {
    const requested = parseDate(req.query.start) ?? new Date();
    const start = dateOnly(requested);
    const end = new Date(start.getTime() + 7 * DAY_MS);
    const [courts, reservations, allocations, blackouts] = await Promise.all([
      prisma.court.findMany({ orderBy: { number: "asc" }, include: { reservationSetting: true } }),
      prisma.courtReservation.findMany({
        where: {
          startTime: { lt: end },
          endTime: { gt: start },
          approvalStatus: { in: ["REQUESTED", "AWAITING_PAYMENT", "CONFIRMED", "PAYMENT_ISSUE"] }
        },
        include: { requester: { include: { player: true } }, court: true },
        orderBy: [{ startTime: "asc" }, { courtId: "asc" }, { createdAt: "asc" }, { id: "asc" }]
      }),
      prisma.courtAllocation.findMany({ where: { date: { gte: start, lt: end } } }),
      prisma.courtBlackout.findMany({ where: { startTime: { lt: end }, endTime: { gt: start } } })
    ]);
    return res.status(200).json({
      start,
      end,
      courts,
      reservations: reservations.map((item) => publicReservation(item, user)),
      allocations,
      blackouts
    });
  }

  if (req.method === "GET" && action === "mine") {
    const member = await requireUser(req, res);
    if (!member) return;
    const reservations = await prisma.courtReservation.findMany({
      where: { requesterUserId: member.id },
      include: { court: true },
      orderBy: { startTime: "desc" }
    });
    return res.status(200).json({ reservations });
  }

  if (req.method === "GET" && action === "admin") {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    await ensureCourtReservationSettings();
    const reservations = await prisma.courtReservation.findMany({
      include: { requester: { include: { player: true } }, court: true },
      orderBy: [{ startTime: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      take: 300
    });
    const queued = reservations
      .filter((item) => ["REQUESTED", "AWAITING_PAYMENT", "PAYMENT_ISSUE"].includes(item.approvalStatus))
      .sort((left, right) =>
        queuePriority(left) - queuePriority(right)
        || left.startTime.getTime() - right.startTime.getTime()
        || left.createdAt.getTime() - right.createdAt.getTime()
        || left.id.localeCompare(right.id)
      );
    const queuePositions = new Map(queued.map((item, index) => [item.id, index + 1]));
    return res.status(200).json({
      reservations: reservations.map((item) => ({
        ...item,
        queuePosition: queuePositions.get(item.id) ?? null
      }))
    });
  }

  if (req.method === "GET" && action === "notifications") {
    const member = await requireUser(req, res);
    if (!member) return;
    const notifications = await prisma.userNotification.findMany({
      where: { userId: member.id },
      orderBy: { createdAt: "desc" },
      take: 50
    });
    return res.status(200).json({ notifications });
  }

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  if (action === "request") {
    const member = await requireUser(req, res);
    if (!member) return;
    await ensureCourtReservationSettings();
    const courtId = String(req.body?.courtId ?? "");
    const startTime = parseDate(req.body?.startTime);
    const endTime = parseDate(req.body?.endTime);
    const title = String(req.body?.title ?? "").trim();
    if (!courtId || !startTime || !endTime || endTime <= startTime || title.length < 2) {
      return res.status(400).json({ error: "Choose a valid court, time, and title." });
    }
    const setting = await prisma.courtReservationSetting.findUnique({ where: { courtId } });
    if (!setting?.reservationsEnabled) return res.status(400).json({ error: "This court is not accepting reservations." });
    const isInstant = req.body?.instant === true && member.role === "ADMIN";
    if (startTime < new Date() && !isInstant) {
      return res.status(400).json({ error: "You cannot reserve a court in the past." });
    }
    const duration = (endTime.getTime() - startTime.getTime()) / 60_000;
    if (duration < setting.minDurationMinutes || duration > setting.maxDurationMinutes) {
      return res.status(400).json({ error: `Reservations must be ${setting.minDurationMinutes}-${setting.maxDurationMinutes} minutes.` });
    }
    const blackout = await prisma.courtBlackout.findFirst({ where: { courtId, ...overlaps(startTime, endTime) } });
    if (blackout) return res.status(409).json({ error: `Court unavailable: ${blackout.reason}` });
    const confirmed = await prisma.courtReservation.findFirst({
      where: { courtId, approvalStatus: "CONFIRMED", ...overlaps(startTime, endTime) }
    });
    if (confirmed) return res.status(409).json({ error: "This time is already reserved." });
    const reservation = await prisma.courtReservation.create({
      data: {
        courtId,
        requesterUserId: member.id,
        hostPlayerId: member.playerId,
        title,
        notes: String(req.body?.notes ?? "").trim() || null,
        publicLabel: typeof req.body?.publicLabel === "string" ? req.body.publicLabel.trim() || null : null,
        participantPlayerIds: strings(req.body?.participantPlayerIds),
        startTime,
        endTime,
        feeAmount: Number(req.body?.feeAmount ?? 300), // COURT_HOURLY_FEE in apps/web/src/lib/pricing.ts
        seriesId: typeof req.body?.seriesId === "string" ? req.body.seriesId : null,
        recurrenceRule: typeof req.body?.recurrenceRule === "string" ? req.body.recurrenceRule : null,
        approvalStatus: isInstant ? "CONFIRMED" : "REQUESTED",
        paymentStatus: isInstant ? "PAID" : "PENDING",
        approvedByUserId: isInstant ? member.id : null,
        approvedAt: isInstant ? new Date() : null
      },
      include: { court: true }
    });
    await audit(member.id, isInstant ? "RESERVATION_APPROVED" : "RESERVATION_REQUESTED", "CourtReservation", reservation.id);
    return res.status(201).json({ reservation });
  }

  if (action === "cancel") {
    const member = await requireUser(req, res);
    if (!member) return;
    const id = String(req.body?.id ?? "");
    const reason = String(req.body?.reason ?? "").trim();
    const scope = String(req.body?.scope ?? "occurrence");
    const existing = await prisma.courtReservation.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "Reservation not found." });
    if (member.role !== "ADMIN" && existing.requesterUserId !== member.id) return res.status(403).json({ error: "Not allowed." });
    if (member.role === "ADMIN" && !reason) return res.status(400).json({ error: "A cancellation reason is required." });
    const where: Prisma.CourtReservationWhereInput = scope === "series" && existing.seriesId
      ? { seriesId: existing.seriesId }
      : scope === "future" && existing.seriesId
        ? { seriesId: existing.seriesId, startTime: { gte: existing.startTime } }
        : { id };
    await prisma.courtReservation.updateMany({
      where,
      data: { approvalStatus: "CANCELLED", cancelledByUserId: member.id, cancelledAt: new Date(), cancellationReason: reason || "Cancelled by player" }
    });
    if (member.role === "ADMIN" && member.id !== existing.requesterUserId) {
      await notify(existing.requesterUserId, "RESERVATION_CANCELLED", "Reservation cancelled by staff", reason);
    }
    await audit(member.id, "RESERVATION_CANCELLED", "CourtReservation", id, { scope, reason });
    return res.status(200).json({ success: true });
  }

  const admin = await requireAdmin(req, res);
  if (!admin) return;

  if (action === "mark-paid") {
    const id = String(req.body?.id ?? "");
    const transactionId = String(req.body?.transactionId ?? "").trim();
    const reservation = await prisma.courtReservation.update({
      where: { id },
      data: { paymentStatus: "PAID", approvalStatus: "REQUESTED", transactionId: transactionId || null, version: { increment: 1 } }
    });
    return res.status(200).json({ reservation });
  }

  if (action === "approve") {
    const id = String(req.body?.id ?? "");
    const target = await prisma.courtReservation.findUnique({ where: { id } });
    if (!target) return res.status(404).json({ error: "Reservation not found." });
    if (target.paymentStatus !== "PAID") return res.status(400).json({ error: "Payment must be recorded before approval." });
    const result = await prisma.$transaction(async (tx) => {
      const conflict = await tx.courtReservation.findFirst({
        where: { id: { not: id }, courtId: target.courtId, approvalStatus: "CONFIRMED", ...overlaps(target.startTime, target.endTime) }
      });
      if (conflict) throw new Error("Another reservation is already confirmed for this time.");
      const approved = await tx.courtReservation.update({
        where: { id },
        data: { approvalStatus: "CONFIRMED", approvedByUserId: admin.id, approvedAt: new Date(), version: { increment: 1 } }
      });
      const competitors = await tx.courtReservation.findMany({
        where: {
          id: { not: id },
          courtId: target.courtId,
          approvalStatus: { in: ["REQUESTED", "AWAITING_PAYMENT"] },
          ...overlaps(target.startTime, target.endTime)
        }
      });
      if (competitors.length) {
        await tx.courtReservation.updateMany({
          where: { id: { in: competitors.map((item) => item.id) } },
          data: { approvalStatus: "REJECTED", rejectedByUserId: admin.id, rejectedAt: new Date(), rejectionReason: "Another request was confirmed for this court and time." }
        });
        for (const item of competitors) {
          await notify(item.requesterUserId, "RESERVATION_REJECTED", "Reservation request not approved", "Another request was confirmed for this court and time.", tx);
        }
      }
      await notify(approved.requesterUserId, "RESERVATION_CONFIRMED", "Reservation confirmed", "Your paid court reservation is confirmed.", tx);
      return approved;
    });
    await audit(admin.id, "RESERVATION_APPROVED", "CourtReservation", id);
    return res.status(200).json({ reservation: result });
  }

  if (action === "reject") {
    const id = String(req.body?.id ?? "");
    const reason = String(req.body?.reason ?? "").trim();
    if (!reason) return res.status(400).json({ error: "A rejection reason is required." });
    const reservation = await prisma.courtReservation.update({
      where: { id },
      data: { approvalStatus: "REJECTED", rejectedByUserId: admin.id, rejectedAt: new Date(), rejectionReason: reason, version: { increment: 1 } }
    });
    await notify(reservation.requesterUserId, "RESERVATION_REJECTED", "Reservation request rejected", reason);
    return res.status(200).json({ reservation });
  }

  if (action === "update-public-label") {
    const id = String(req.body?.id ?? "");
    const publicLabel = String(req.body?.publicLabel ?? "").trim();
    const reservation = await prisma.courtReservation.update({
      where: { id },
      data: { publicLabel: publicLabel || null, version: { increment: 1 } }
    });
    await audit(admin.id, "RESERVATION_UPDATED", "CourtReservation", id, { publicLabel });
    return res.status(200).json({ reservation });
  }

  if (action === "settings") {
    const courtId = String(req.body?.courtId ?? "");
    const setting = await prisma.courtReservationSetting.upsert({
      where: { courtId },
      create: {
        courtId,
        reservationsEnabled: Boolean(req.body?.reservationsEnabled),
        openingTime: String(req.body?.openingTime ?? "06:00"),
        closingTime: String(req.body?.closingTime ?? "22:00"),
        minDurationMinutes: Number(req.body?.minDurationMinutes ?? 30),
        maxDurationMinutes: Number(req.body?.maxDurationMinutes ?? 180),
        intervalMinutes: 30
      },
      update: {
        reservationsEnabled: Boolean(req.body?.reservationsEnabled),
        openingTime: String(req.body?.openingTime ?? "06:00"),
        closingTime: String(req.body?.closingTime ?? "22:00"),
        minDurationMinutes: Number(req.body?.minDurationMinutes ?? 30),
        maxDurationMinutes: Number(req.body?.maxDurationMinutes ?? 180)
      }
    });
    return res.status(200).json({ setting });
  }

  if (action === "allocation") {
    const date = parseDate(req.body?.date);
    if (!date) return res.status(400).json({ error: "Choose a valid date." });
    const allocation = await prisma.courtAllocation.upsert({
      where: {
        courtId_date_startTime: {
          courtId: String(req.body?.courtId),
          date: dateOnly(date),
          startTime: String(req.body?.startTime ?? "15:00")
        }
      },
      create: {
        courtId: String(req.body?.courtId),
        date: dateOnly(date),
        startTime: String(req.body?.startTime ?? "15:00"),
        endTime: String(req.body?.endTime ?? "23:00"),
        mode: String(req.body?.mode ?? "OPEN_PLAY"),
        note: String(req.body?.note ?? "").trim() || null
      },
      update: {
        endTime: String(req.body?.endTime ?? "23:00"),
        mode: String(req.body?.mode ?? "OPEN_PLAY"),
        note: String(req.body?.note ?? "").trim() || null
      }
    });
    return res.status(200).json({ allocation });
  }

  if (action === "blackout") {
    const startTime = parseDate(req.body?.startTime);
    const endTime = parseDate(req.body?.endTime);
    const reason = String(req.body?.reason ?? "").trim();
    if (!startTime || !endTime || endTime <= startTime || !reason) return res.status(400).json({ error: "Enter a valid blackout period and reason." });
    const blackout = await prisma.courtBlackout.create({
      data: { courtId: String(req.body?.courtId), startTime, endTime, reason, createdById: admin.id }
    });
    return res.status(201).json({ blackout });
  }

  if (action === "payment-issue") {
    const id = String(req.body?.id ?? "");
    const reservation = await prisma.courtReservation.update({
      where: { id },
      data: { paymentStatus: "VOIDED", approvalStatus: "PAYMENT_ISSUE", version: { increment: 1 } }
    });
    await notify(reservation.requesterUserId, "RESERVATION_PAYMENT_ISSUE", "Reservation payment issue", "The linked payment was voided. Please contact HAFF staff.");
    return res.status(200).json({ reservation });
  }

  if (action === "payment-issue-by-transaction") {
    const transactionId = String(req.body?.transactionId ?? "");
    if (!transactionId) return res.status(400).json({ error: "Transaction ID required." });
    const affected = await prisma.courtReservation.findMany({ where: { transactionId } });
    await prisma.courtReservation.updateMany({
      where: { transactionId },
      data: { paymentStatus: "VOIDED", approvalStatus: "PAYMENT_ISSUE", version: { increment: 1 } }
    });
    for (const reservation of affected) {
      await notify(reservation.requesterUserId, "RESERVATION_PAYMENT_ISSUE", "Reservation payment issue", "The linked payment was voided. Please contact HAFF staff.");
    }
    return res.status(200).json({ affected: affected.length });
  }

  if (action === "reschedule") {
    const id = String(req.body?.id ?? "");
    const courtId = String(req.body?.courtId ?? "");
    const startTime = parseDate(req.body?.startTime);
    const endTime = parseDate(req.body?.endTime);
    if (!id || !courtId || !startTime || !endTime || endTime <= startTime) return res.status(400).json({ error: "Invalid destination." });
    const conflict = await prisma.courtReservation.findFirst({
      where: { id: { not: id }, courtId, approvalStatus: "CONFIRMED", ...overlaps(startTime, endTime) }
    });
    if (conflict) return res.status(409).json({ error: "The destination overlaps a confirmed reservation." });
    const blackout = await prisma.courtBlackout.findFirst({ where: { courtId, ...overlaps(startTime, endTime) } });
    if (blackout) return res.status(409).json({ error: `Court unavailable: ${blackout.reason}` });
    const reservation = await prisma.courtReservation.update({
      where: { id },
      data: { courtId, startTime, endTime, version: { increment: 1 } }
    });
    await notify(reservation.requesterUserId, "RESERVATION_CHANGED", "Reservation changed", "HAFF staff moved your reservation to a new court or time.");
    await audit(admin.id, "RESERVATION_RESCHEDULED", "CourtReservation", id, { courtId, startTime: startTime.toISOString(), endTime: endTime.toISOString() });
    return res.status(200).json({ reservation });
  }

  return res.status(404).json({ error: "Unknown reservation action." });
}
