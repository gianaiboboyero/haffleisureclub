/** Open-play check-in fee (PHP). */
export const CHECK_IN_FEE = 150;

/** Court rental rate (PHP per hour). Keep in sync with prisma Reservation.feeAmount default. */
export const COURT_HOURLY_FEE = 300;

/** extendHours: 0 = 1hr, 1 = 2hr, etc. */
export function estimateCourtFee(extendHours: number): number {
  return COURT_HOURLY_FEE * (1 + Math.max(0, extendHours));
}

export function formatPeso(amount: number): string {
  return `₱${amount.toLocaleString("en-PH")}`;
}
