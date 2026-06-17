export const MANILA_TZ = "Asia/Manila";

export const reservationDateKey = (value: string | Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: MANILA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(typeof value === "string" ? new Date(value) : value);

export const reservationTimeMinutes = (value: string | Date) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: MANILA_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(typeof value === "string" ? new Date(value) : value).split(":");
  return Number(parts[0]) * 60 + Number(parts[1]);
};

export const manilaDateTimeIso = (dayKey: string, hour: number, minute: number) =>
  new Date(`${dayKey}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+08:00`).toISOString();

export const reservationOverlapsHour = (
  reservation: { startTime: string; endTime: string },
  hourStart: number,
  hourEnd: number
) => {
  const start = reservationTimeMinutes(reservation.startTime);
  const end = reservationTimeMinutes(reservation.endTime);
  return hourStart < end && hourEnd > start;
};

export const reservationOverlapsRange = (
  reservation: { startTime: string; endTime: string },
  rangeStart: Date,
  rangeEnd: Date
) => {
  const start = new Date(reservation.startTime).getTime();
  const end = new Date(reservation.endTime).getTime();
  return start < rangeEnd.getTime() && end > rangeStart.getTime();
};
