import type { VercelRequest, VercelResponse } from "@vercel/node";
import { dbQuery } from "./_db.js";
import { requireAdmin, requireUser } from "./_auth.js";

type ApprovalStatus =
  | "REQUESTED"
  | "AWAITING_PAYMENT"
  | "CONFIRMED"
  | "REJECTED"
  | "CANCELLED"
  | "NO_SHOW"
  | "PAYMENT_ISSUE";

type PaymentStatus = "PENDING" | "PAID" | "REFUNDED" | "VOIDED";

type ReservationRow = {
  id: string;
  courtId: string;
  requesterUserId: string;
  hostPlayerId: string | null;
  hostDisplayName: string | null;
  title: string;
  notes: string | null;
  publicLabel: string | null;
  participantPlayerIds: string[];
  startTime: Date | string;
  endTime: Date | string;
  feeAmount: number;
  approvalStatus: ApprovalStatus;
  paymentStatus: PaymentStatus;
  cancellationReason: string | null;
  seriesId: string | null;
};

const ACTIVE_APPROVALS = ["REQUESTED", "AWAITING_PAYMENT", "CONFIRMED"] as const;

function toClientStatus(approvalStatus: ApprovalStatus) {
  switch (approvalStatus) {
    case "CONFIRMED":
    case "AWAITING_PAYMENT":
      return "Confirmed";
    case "REJECTED":
      return "Rejected";
    case "CANCELLED":
      return "Cancelled";
    case "NO_SHOW":
      return "NoShow";
    default:
      return "Requested";
  }
}

function toClientPayment(paymentStatus: PaymentStatus) {
  if (paymentStatus === "PAID") return "Paid";
  if (paymentStatus === "REFUNDED") return "Refunded";
  return "Pending";
}

function toApprovalStatus(status: unknown, isAdmin: boolean): ApprovalStatus {
  if (!isAdmin) return "REQUESTED";
  switch (String(status ?? "")) {
    case "Confirmed":
      return "CONFIRMED";
    case "Rejected":
      return "REJECTED";
    case "Cancelled":
      return "CANCELLED";
    case "NoShow":
      return "NO_SHOW";
    default:
      return "REQUESTED";
  }
}

function toPaymentStatus(status: unknown, isAdmin: boolean): PaymentStatus {
  if (!isAdmin) return "PENDING";
  switch (String(status ?? "")) {
    case "Paid":
      return "PAID";
    case "Refunded":
      return "REFUNDED";
    default:
      return "PENDING";
  }
}

function mapReservation(row: ReservationRow) {
  return {
    id: row.id,
    title: row.title,
    notes: row.notes ?? undefined,
    courtId: row.courtId,
    startTime: row.startTime instanceof Date ? row.startTime.toISOString() : String(row.startTime),
    endTime: row.endTime instanceof Date ? row.endTime.toISOString() : String(row.endTime),
    hostPlayerId: row.hostPlayerId ?? "admin",
    hostDisplayName: row.hostDisplayName ?? undefined,
    playerIds: row.participantPlayerIds ?? [],
    status: toClientStatus(row.approvalStatus),
    paymentStatus: toClientPayment(row.paymentStatus),
    feeAmount: row.feeAmount,
    cancellationReason: row.cancellationReason ?? undefined,
    seriesId: row.seriesId ?? undefined
  };
}

async function getReservationById(id: string) {
  const { rows } = await dbQuery<ReservationRow>(
    `SELECT r.id, r."courtId", r."requesterUserId", r."hostPlayerId",
            p."displayName" AS "hostDisplayName", r.title, r.notes, r."publicLabel",
            r."participantPlayerIds", r."startTime", r."endTime", r."feeAmount",
            r."approvalStatus", r."paymentStatus", r."cancellationReason", r."seriesId"
     FROM "CourtReservation" r
     LEFT JOIN "Player" p ON p.id = r."hostPlayerId"
     WHERE r.id = $1
     LIMIT 1`,
    [id]
  );
  return rows[0] ?? null;
}

async function detectConflict(courtId: string, startTime: string, endTime: string, excludeId?: string) {
  const params: unknown[] = [courtId, startTime, endTime, [...ACTIVE_APPROVALS]];
  let sql =
    `SELECT id
     FROM "CourtReservation"
     WHERE "courtId" = $1
       AND "startTime" < $3::timestamptz
       AND "endTime" > $2::timestamptz
       AND "approvalStatus" = ANY($4::"ReservationApprovalStatus"[])`;
  if (excludeId) {
    params.push(excludeId);
    sql += ` AND id <> $5`;
  }
  sql += ` LIMIT 1`;
  const { rows } = await dbQuery<{ id: string }>(sql, params);
  return rows[0]?.id ?? null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === "GET") {
      const from = typeof req.query.from === "string" ? req.query.from : "";
      const to = typeof req.query.to === "string" ? req.query.to : "";
      if (!from || !to) return res.status(400).json({ error: "from and to are required." });
      const { rows } = await dbQuery<ReservationRow>(
        `SELECT r.id, r."courtId", r."requesterUserId", r."hostPlayerId",
                p."displayName" AS "hostDisplayName", r.title, r.notes, r."publicLabel",
                r."participantPlayerIds", r."startTime", r."endTime", r."feeAmount",
                r."approvalStatus", r."paymentStatus", r."cancellationReason", r."seriesId"
         FROM "CourtReservation" r
         LEFT JOIN "Player" p ON p.id = r."hostPlayerId"
         WHERE r."startTime" >= $1::timestamptz
           AND r."startTime" < $2::timestamptz
         ORDER BY r."startTime" ASC`,
        [from, to]
      );
      return res.status(200).json(rows.map(mapReservation));
    }

    if (req.method === "POST" && req.query.action === "payment-issue-by-transaction") {
      const admin = await requireAdmin(req, res);
      if (!admin) return;
      const transactionId = String(req.body?.transactionId ?? "").trim();
      if (!transactionId) return res.status(400).json({ error: "transactionId is required." });
      const { rowCount } = await dbQuery(
        `UPDATE "CourtReservation"
         SET "approvalStatus" = 'PAYMENT_ISSUE',
             "paymentStatus" = 'VOIDED',
             "updatedAt" = NOW()
         WHERE "transactionId" = $1`,
        [transactionId]
      );
      return res.status(200).json({ updated: rowCount ?? 0 });
    }

    if (req.method === "POST") {
      const user = await requireUser(req, res);
      if (!user) return;
      const isAdmin = user.role === "ADMIN";
      const body = req.body ?? {};
      const courtId = String(body.courtId ?? "").trim();
      const startTime = String(body.startTime ?? "").trim();
      const endTime = String(body.endTime ?? "").trim();
      const title = String(body.title ?? "Court Play").trim() || "Court Play";
      const notes = typeof body.notes === "string" ? body.notes.trim() : "";
      const participantPlayerIds = Array.isArray(body.playerIds) ? body.playerIds.map(String) : [];
      const feeAmount = Number(body.feeAmount ?? 300);
      if (!courtId || !startTime || !endTime) {
        return res.status(400).json({ error: "courtId, startTime, and endTime are required." });
      }
      const conflictId = await detectConflict(courtId, startTime, endTime);
      if (conflictId) {
        return res.status(409).json({ error: "This court already has a reservation during that time." });
      }
      const approvalStatus = toApprovalStatus(body.status, isAdmin);
      const paymentStatus = toPaymentStatus(body.paymentStatus, isAdmin);
      const requestedHostPlayerId = typeof body.hostPlayerId === "string" ? body.hostPlayerId : null;
      const hostPlayerId =
        requestedHostPlayerId && requestedHostPlayerId !== "admin"
          ? requestedHostPlayerId
          : user.playerId ?? null;

      const { rows } = await dbQuery<ReservationRow>(
        `INSERT INTO "CourtReservation" (
           "courtId", "requesterUserId", "hostPlayerId", title, notes, "publicLabel",
           "participantPlayerIds", "startTime", "endTime", "feeAmount",
           "approvalStatus", "paymentStatus"
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7::text[], $8::timestamptz, $9::timestamptz, $10,
           $11::"ReservationApprovalStatus", $12::"ReservationPaymentStatus"
         )
         RETURNING id, "courtId", "requesterUserId", "hostPlayerId", NULL::text AS "hostDisplayName",
                   title, notes, "publicLabel", "participantPlayerIds", "startTime", "endTime",
                   "feeAmount", "approvalStatus", "paymentStatus", "cancellationReason", "seriesId"`,
        [
          courtId,
          user.id,
          hostPlayerId,
          title,
          notes || null,
          approvalStatus === "REQUESTED" ? "Pending" : title,
          participantPlayerIds,
          startTime,
          endTime,
          Number.isFinite(feeAmount) ? feeAmount : 300,
          approvalStatus,
          paymentStatus
        ]
      );
      const created = await getReservationById(rows[0].id);
      return res.status(201).json(created ? mapReservation(created) : mapReservation(rows[0]));
    }

    if (req.method === "PATCH") {
      const user = await requireUser(req, res);
      if (!user) return;
      const id = typeof req.query.id === "string" ? req.query.id : String(req.body?.id ?? "");
      if (!id) return res.status(400).json({ error: "Reservation id is required." });
      const current = await getReservationById(id);
      if (!current) return res.status(404).json({ error: "Reservation not found." });
      const isAdmin = user.role === "ADMIN";
      const isOwner = current.requesterUserId === user.id;
      if (!isAdmin && !isOwner) return res.status(403).json({ error: "Unauthorized" });

      const body = req.body ?? {};
      const nextStatus = body.status !== undefined ? toApprovalStatus(body.status, isAdmin) : current.approvalStatus;
      const nextPaymentStatus =
        body.paymentStatus !== undefined ? toPaymentStatus(body.paymentStatus, isAdmin) : current.paymentStatus;
      const nextTitle =
        typeof body.title === "string" && isAdmin ? body.title.trim() || current.title : current.title;
      const nextNotes =
        typeof body.notes === "string" && isAdmin ? body.notes.trim() || null : current.notes;
      const nextCancellationReason =
        typeof body.cancellationReason === "string" ? body.cancellationReason.trim() || null : current.cancellationReason;

      if (body.startTime || body.endTime) {
        const startTime = typeof body.startTime === "string" ? body.startTime : current.startTime.toString();
        const endTime = typeof body.endTime === "string" ? body.endTime : current.endTime.toString();
        const conflictId = await detectConflict(current.courtId, startTime, endTime, id);
        if (conflictId) {
          return res.status(409).json({ error: "This court already has a reservation during that time." });
        }
      }

      await dbQuery(
        `UPDATE "CourtReservation"
         SET title = $2,
             notes = $3,
             "approvalStatus" = $4::"ReservationApprovalStatus",
             "paymentStatus" = $5::"ReservationPaymentStatus",
             "cancellationReason" = $6,
             "updatedAt" = NOW()
         WHERE id = $1`,
        [id, nextTitle, nextNotes, nextStatus, nextPaymentStatus, nextCancellationReason]
      );
      const updated = await getReservationById(id);
      return res.status(200).json(updated ? mapReservation(updated) : null);
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("/api/reservations failed", error);
    return res.status(500).json({ error: "Reservation request failed." });
  }
}
