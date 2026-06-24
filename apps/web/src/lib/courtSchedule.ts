/**
 * courtSchedule.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Encodes HAFF Leisure Club's official court schedule as defined by the
 * blue (Fri–Sun) and green (Mon–Thu) flyers.
 *
 * Schedule summary:
 *   All courts open at 06:00 daily.
 *   After 22:00 all courts are Open Play (no reservations).
 *
 *   Court 1 – Rental cutoff always 16:00 (4 PM)
 *   Court 2 – Rental cutoff 16:00 on Fri/Sat/Sun, 22:00 on Mon–Thu
 *   Court 3 – Rental cutoff always 22:00 (10 PM)
 *
 * Slots at or after the rental cutoff (but before 22:00) are "Open Play" —
 * walk-in only, not bookable via reservation.
 */

export const SCHEDULE_OPEN_MINUTES = 6 * 60;   // 06:00
export const SCHEDULE_CLOSE_MINUTES = 22 * 60;  // 22:00 — hard daily close

/** Day-of-week helpers (Manila local day). 0=Sun … 6=Sat */
function manilaWeekday(date: Date): number {
  return new Date(
    date.toLocaleString("en-US", { timeZone: "Asia/Manila" })
  ).getDay();
}

function isWeekend(date: Date): boolean {
  const day = manilaWeekday(date);
  return day === 0 || day === 5 || day === 6; // Sun, Fri, Sat
}

/**
 * Returns the rental cutoff time (in minutes from midnight) for a given
 * court number on a given date. Bookings must END by this time.
 *
 * @param courtNumber  1, 2, or 3
 * @param date         The calendar date being booked
 */
export function getRentalCutoffMinutes(courtNumber: number, date: Date): number {
  switch (courtNumber) {
    case 1:
      return 16 * 60; // 4 PM every day
    case 2:
      return isWeekend(date) ? 16 * 60 : 22 * 60; // 4 PM Fri–Sun, 10 PM Mon–Thu
    case 3:
    default:
      return 22 * 60; // 10 PM every day
  }
}

/**
 * Returns the rental window for a court as human-readable strings.
 * e.g. { openTime: "06:00", closeTime: "16:00" }
 */
export function getRentalWindow(
  courtNumber: number,
  date: Date
): { openTime: string; closeTime: string } {
  const cutoff = getRentalCutoffMinutes(courtNumber, date);
  const hh = String(Math.floor(cutoff / 60)).padStart(2, "0");
  const mm = String(cutoff % 60).padStart(2, "0");
  return { openTime: "06:00", closeTime: `${hh}:${mm}` };
}

/**
 * Returns true if the slot (starting at startMinutes from midnight) is
 * available for court rental / reservation on the given date.
 *
 * A slot is rentable when:
 *   - It starts at or after 06:00
 *   - It starts before the rental cutoff for that court/day
 */
export function isSlotRentable(
  courtNumber: number,
  date: Date,
  startMinutes: number
): boolean {
  const cutoff = getRentalCutoffMinutes(courtNumber, date);
  return startMinutes >= SCHEDULE_OPEN_MINUTES && startMinutes < cutoff;
}

/**
 * Returns true if the slot is in the "Open Play" zone:
 * at or after the rental cutoff but before the hard close at 22:00.
 * These slots are walk-in only — members cannot reserve them.
 */
export function isSlotOpenPlay(
  courtNumber: number,
  date: Date,
  startMinutes: number
): boolean {
  const cutoff = getRentalCutoffMinutes(courtNumber, date);
  return startMinutes >= cutoff && startMinutes < SCHEDULE_CLOSE_MINUTES;
}

/**
 * Returns true if a proposed booking would extend beyond the rental cutoff.
 * Used to validate duration selections in the booking drawer.
 *
 * @param courtNumber   1, 2, or 3
 * @param date          The booking date
 * @param startMinutes  Booking start (minutes from midnight)
 * @param endMinutes    Booking end (minutes from midnight)
 */
export function bookingExceedsRentalWindow(
  courtNumber: number,
  date: Date,
  startMinutes: number,
  endMinutes: number
): boolean {
  const cutoff = getRentalCutoffMinutes(courtNumber, date);
  return endMinutes > cutoff;
}
