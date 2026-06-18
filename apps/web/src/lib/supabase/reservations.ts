import type { Reservation } from "../types";
import { getSupabase } from "./client";

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
  hostPlayerId: string | null;
  title: string;
  notes: string | null;
  publicLabel: string | null;
  participantPlayerIds: string[];
  startTime: string;
  endTime: string;
  feeAmount: number;
  approvalStatus: ApprovalStatus;
  paymentStatus: PaymentStatus;
  seriesId: string | null;
};

const mapStatus = (approval: ApprovalStatus): Reservation["status"] => {
  switch (approval) {
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
};

const mapPayment = (payment: PaymentStatus): Reservation["paymentStatus"] => {
  if (payment === "PAID") return "Paid";
  if (payment === "REFUNDED") return "Refunded";
  return "Pending";
};

export function mapReservationRow(row: ReservationRow): Reservation {
  return {
    id: row.id,
    title: row.title,
    notes: row.notes ?? undefined,
    courtId: row.courtId,
    startTime: row.startTime,
    endTime: row.endTime,
    hostPlayerId: row.hostPlayerId ?? "admin",
    playerIds: row.participantPlayerIds ?? [],
    status: mapStatus(row.approvalStatus),
    paymentStatus: mapPayment(row.paymentStatus),
    feeAmount: row.feeAmount,
    seriesId: row.seriesId ?? undefined
  };
}

export async function fetchReservationsRange(from: Date, to: Date): Promise<Reservation[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("CourtReservation")
    .select(
      "id, courtId, hostPlayerId, title, notes, publicLabel, participantPlayerIds, startTime, endTime, feeAmount, approvalStatus, paymentStatus, seriesId"
    )
    .gte("startTime", from.toISOString())
    .lt("startTime", to.toISOString())
    .order("startTime", { ascending: true });

  if (error || !data) return [];
  return (data as ReservationRow[]).map(mapReservationRow);
}
