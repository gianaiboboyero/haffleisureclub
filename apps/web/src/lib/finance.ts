import { reservationDateKey } from "./reservationTime";
import type { Player, Transaction } from "./types";

/** Finance helpers — all ledger data stays in IndexedDB (no Supabase/Vercel sync). */

export type LedgerRange = "today" | "week" | "month" | "all";

export type PaymentMethod = Transaction["paymentMethod"];

export const PAYMENT_METHODS: PaymentMethod[] = ["Cash", "GCash", "Maya", "Card"];

export function normalizePaymentMethod(method: PaymentMethod): PaymentMethod {
  return method === "EWallet" ? "GCash" : method;
}

export function normalizeTransaction(transaction: Transaction): Transaction {
  const paymentMethod = normalizePaymentMethod(transaction.paymentMethod);
  return paymentMethod === transaction.paymentMethod
    ? transaction
    : { ...transaction, paymentMethod };
}

export function transactionDayKey(timestamp: string): string {
  return reservationDateKey(timestamp);
}

export function startOfManilaWeek(reference = new Date()): string {
  const dayKey = reservationDateKey(reference);
  const anchor = new Date(`${dayKey}T12:00:00+08:00`);
  const weekday = anchor.getUTCDay();
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  anchor.setUTCDate(anchor.getUTCDate() + mondayOffset);
  return reservationDateKey(anchor);
}

export function startOfManilaMonth(reference = new Date()): string {
  const dayKey = reservationDateKey(reference);
  return dayKey.slice(0, 7);
}

export function filterTransactionsByRange(
  transactions: Transaction[],
  range: LedgerRange,
  reference = new Date()
): Transaction[] {
  if (range === "all") return transactions;
  const todayKey = reservationDateKey(reference);
  const weekStart = startOfManilaWeek(reference);
  const monthPrefix = startOfManilaMonth(reference);

  return transactions.filter((transaction) => {
    const dayKey = transactionDayKey(transaction.timestamp);
    if (range === "today") return dayKey === todayKey;
    if (range === "week") return dayKey >= weekStart && dayKey <= todayKey;
    return dayKey.startsWith(monthPrefix);
  });
}

export function sumSuccessfulRevenue(transactions: Transaction[]): number {
  return transactions
    .filter((transaction) => transaction.status === "Success")
    .reduce((sum, transaction) => sum + transaction.amount, 0);
}

export function countPendingTransactions(transactions: Transaction[]): number {
  return transactions.filter((transaction) => transaction.status === "Pending").length;
}

export function revenueByPaymentMethod(transactions: Transaction[]): Record<PaymentMethod, number> {
  const totals: Record<PaymentMethod, number> = {
    Cash: 0,
    GCash: 0,
    Maya: 0,
    Card: 0,
    EWallet: 0
  };
  for (const transaction of transactions) {
    if (transaction.status !== "Success") continue;
    const method = normalizePaymentMethod(transaction.paymentMethod);
    totals[method] += transaction.amount;
  }
  return totals;
}

export function playerHasPaidCheckInToday(
  transactions: Transaction[],
  playerId: string,
  reference = new Date()
): boolean {
  const todayKey = reservationDateKey(reference);
  return transactions.some(
    (transaction) =>
      transaction.playerId === playerId
      && transaction.type === "CheckInFee"
      && transaction.status === "Success"
      && transactionDayKey(transaction.timestamp) === todayKey
  );
}

export function findPendingCheckInFee(
  transactions: Transaction[],
  playerId: string,
  reference = new Date()
): Transaction | undefined {
  const todayKey = reservationDateKey(reference);
  return transactions.find(
    (transaction) =>
      transaction.playerId === playerId
      && transaction.type === "CheckInFee"
      && transaction.status === "Pending"
      && transactionDayKey(transaction.timestamp) === todayKey
  );
}

export type OutstandingPlayer = {
  player: Player;
  pendingTransaction?: Transaction;
};

export function getOutstandingCheckIns(
  players: Player[],
  transactions: Transaction[],
  reference = new Date()
): OutstandingPlayer[] {
  return players
    .filter((player) => player.checkedIn)
    .filter((player) => !playerHasPaidCheckInToday(transactions, player.id, reference))
    .map((player) => ({
      player,
      pendingTransaction: findPendingCheckInFee(transactions, player.id, reference)
    }));
}

export function formatTransactionType(type: Transaction["type"]): string {
  if (type === "CheckInFee") return "Check-in";
  if (type === "CourtReservation") return "Court rental";
  return "Session pass";
}
