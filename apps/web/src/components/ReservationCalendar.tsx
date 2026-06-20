import React from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  Ban,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Lock,
  ShieldCheck,
  X
} from "lucide-react";
import { useClubStore } from "../store/useClubStore";
import { sortCourts } from "../lib/utils";
import type { Court, Reservation } from "../lib/types";

// ── local calendar reservation shape ─────────────────────────────────────────
type CalReservation = Reservation & { publicLabel?: string };

// ── auth user type ────────────────────────────────────────────────────────────
type Member = { id: string; role: "ADMIN" | "MEMBER"; playerId?: string; displayName: string } | null;

import { getCourtSetting } from "../lib/courtSettings";
import { apiFetch, parseResponseJson } from "../lib/api";
import { useSupabaseData } from "../lib/dataSource";
import { subscribeSupabaseReservations } from "../lib/supabase/realtime";
import { COURT_HOURLY_FEE, estimateCourtFee, formatPeso } from "../lib/pricing";
import {
  MANILA_TZ,
  manilaDateTimeIso,
  reservationDateKey,
  reservationOverlapsHour,
  reservationTimeMinutes
} from "../lib/reservationTime";

const isCourtBookable = (court: Court) => {
  const setting = getCourtSetting(court.id);
  return court.reservable !== false && setting.enabled && court.status !== "Maintenance";
};

// ── date helpers ──────────────────────────────────────────────────────────────
const dateKey = (date: Date) => reservationDateKey(date);

const startOfWeek = (date: Date) => {
  const copy = new Date(`${dateKey(date)}T12:00:00+08:00`);
  const day = copy.getDay();
  copy.setDate(copy.getDate() - (day === 0 ? 6 : day - 1));
  return copy;
};
const addDays = (date: Date, days: number) => { const c = new Date(date); c.setDate(c.getDate() + days); return c; };
const timeMinutes = (v: string) => reservationTimeMinutes(v);
const clockLabel = (minutes: number) => {
  const d = new Date(Date.UTC(2026, 0, 1, Math.floor(minutes / 60) - 8, minutes % 60));
  return new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" }).format(d);
};
const parseClock = (v: string) => { const [h, m] = v.split(":").map(Number); return h * 60 + m; };

// ── Legend chip ───────────────────────────────────────────────────────────────
function Legend({ className, label }: { className: string; label: string }) {
  return <span className={`rounded-full px-3 py-1.5 ${className}`}>{label}</span>;
}

// ── Week calendar grid (shared) ───────────────────────────────────────────────
function ReservationWeekHeader({
  weekStart,
  selectedDay,
  onWeekStartChange,
  onSelectedDayChange,
  legend,
  hideWeekNav = false,
  reservationCountForDay
}: {
  weekStart: Date;
  selectedDay: Date;
  onWeekStartChange: (d: Date) => void;
  onSelectedDayChange: (d: Date) => void;
  legend?: React.ReactNode;
  hideWeekNav?: boolean;
  reservationCountForDay?: (day: Date) => number;
}) {
  const days = React.useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  React.useEffect(() => {
    if (!days.some((d) => dateKey(d) === dateKey(selectedDay))) onSelectedDayChange(days[0]);
  }, [days, selectedDay, onSelectedDayChange]);

  return (
    <>
      {!hideWeekNav && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="calendar-control" onClick={() => onWeekStartChange(addDays(weekStart, -7))}><ChevronLeft size={16} /> Previous Week</button>
          <button type="button" className="calendar-control bg-brass text-forest" onClick={() => { onWeekStartChange(startOfWeek(new Date())); onSelectedDayChange(new Date()); }}>Today</button>
          <button type="button" className="calendar-control" onClick={() => onWeekStartChange(addDays(weekStart, 7))}>Next Week <ChevronRight size={16} /></button>
        </div>
      )}
      <div className="mt-6 overflow-x-auto pb-2 border-t border-white/5 pt-4">
        <div className="flex min-w-max gap-2">
          {days.map((day) => {
            const selected = dateKey(day) === dateKey(selectedDay);
            const count = reservationCountForDay?.(day) ?? 0;
            return (
              <button
                type="button"
                className={`relative min-w-24 rounded-2xl border px-4 py-3 text-center transition ${selected ? "border-brass bg-brass text-forest" : "border-ivory/10 bg-ivory/5 text-ivory hover:bg-ivory/10"}`}
                key={dateKey(day)}
                onClick={() => onSelectedDayChange(day)}
              >
                <span className="block text-[10px] font-black uppercase tracking-wider">{day.toLocaleDateString([], { weekday: "short" })}</span>
                <span className="mt-1 block font-display text-2xl font-black">{day.getDate()}</span>
                {count > 0 && (
                  <span className={`mt-1 inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-black ${selected ? "bg-forest/15 text-forest" : "bg-brass/20 text-brass"}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      {legend}
    </>
  );
}

function CourtSlotGrid({
  courts,
  selectedDay,
  reservationsFor,
  playerName,
  mode,
  onOpenSlot
}: {
  courts: Court[];
  selectedDay: Date;
  reservationsFor: (day: Date, courtId: string) => CalReservation[];
  playerName?: (reservation: CalReservation) => string;
  mode: "book" | "admin";
  onOpenSlot: (payload: { courtId: string; date: Date; startMinutes: number; reservation?: CalReservation }) => void;
}) {
  if (courts.length === 0) {
    return (
      <div className="flex h-48 flex-col items-center justify-center rounded-3xl border border-ivory/10 bg-[#071f18] text-ivory">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-brass">No courts configured</p>
      </div>
    );
  }

  return (
    <div className={`grid gap-6 ${mode === "admin" ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
      {courts.map((court) => {
        const bookable = isCourtBookable(court);
        const setting = getCourtSetting(court.id);
        return (
          <div className="rounded-3xl border border-ivory/10 bg-[#071f18] p-5 shadow-2xl" key={court.id}>
            <div className="border-b border-ivory/10 pb-3 mb-4 flex justify-between items-baseline">
              <h3 className="font-display text-2xl font-black text-brass uppercase tracking-wide">{court.name}</h3>
              {mode === "book" && !bookable && (
                <span className="text-xs font-black uppercase text-red-400 bg-red-950/40 rounded-full px-3 py-1">
                  {court.reservable === false ? "Not Reservable" : "Bookings Closed"}
                </span>
              )}
            </div>
            {mode === "book" && !bookable ? (
              <p className="text-ivory/40 text-sm">This court is not accepting reservations right now.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {Array.from({ length: 16 }, (_, i) => {
                  const hourStart = (6 + i) * 60;
                  const hourEnd = hourStart + 60;
                  const openMins = parseClock(setting.openingTime || "06:00");
                  const closeMins = parseClock(setting.closingTime || "22:00");
                  if (hourStart < openMins || hourStart >= closeMins) {
                    return (
                      <div className="rounded-xl border border-white/5 bg-slate-800/40 px-3 py-3 text-center text-ivory/30" key={hourStart}>
                        <span className="block text-xs font-black">{clockLabel(hourStart)}</span>
                        <span className="mt-0.5 block text-[9px] font-bold text-ivory/40">Closed</span>
                      </div>
                    );
                  }
                  const overlapping = reservationsFor(selectedDay, court.id).filter((r) =>
                    reservationOverlapsHour(r, hourStart, hourEnd)
                  );
                  const reservation = overlapping[0];
                  if (reservation) {
                    const isPending = reservation.status === "Requested";
                    const host = playerName?.(reservation) ?? reservation.hostDisplayName ?? reservation.publicLabel ?? "Reserved";
                    const label = mode === "admin"
                      ? (host !== "Member" ? host : (reservation.title?.trim() || "Reserved"))
                      : (reservation.publicLabel || reservation.title || "Reserved");
                    const extraCount = overlapping.length - 1;
                    return (
                      <button
                        type="button"
                        className={`rounded-xl border px-3 py-3 text-center transition hover:opacity-95 ${
                          isPending
                            ? "border-amber-400/40 bg-amber-400/15 hover:border-amber-400/60"
                            : "border-brass/30 bg-brass/10 hover:border-brass/50"
                        }`}
                        key={hourStart}
                        onClick={() => onOpenSlot({ courtId: court.id, date: selectedDay, startMinutes: hourStart, reservation })}
                      >
                        <span className={`block text-xs font-black ${isPending ? "text-amber-300" : "text-brass"}`}>{clockLabel(hourStart)}</span>
                        <span className={`mt-0.5 block truncate text-[9px] font-bold ${isPending ? "text-amber-200/80" : "text-brass/80"}`} title={label}>{label}</span>
                        {mode === "admin" && (
                          <span className="mt-0.5 block truncate text-[8px] uppercase tracking-wider text-ivory/50">
                            {isPending ? "Pending" : reservation.status}
                            {extraCount > 0 ? ` · +${extraCount}` : ""}
                          </span>
                        )}
                      </button>
                    );
                  }
                  if (mode === "admin") {
                    return (
                      <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-3 py-3 text-center text-ivory/35" key={hourStart}>
                        <span className="block text-xs font-black">{clockLabel(hourStart)}</span>
                        <span className="mt-0.5 block text-[9px] font-bold">Open</span>
                      </div>
                    );
                  }
                  const slotH = String(Math.floor(hourStart / 60)).padStart(2, "0");
                  const slotMin = String(hourStart % 60).padStart(2, "0");
                  const slotDate = new Date(`${dateKey(selectedDay)}T${slotH}:${slotMin}:00+08:00`);
                  const isPast = slotDate.getTime() < Date.now();
                  if (isPast) {
                    return (
                      <div className="rounded-xl border border-white/5 bg-[#0b1310] px-3 py-3 text-center flex flex-col items-center justify-center opacity-40 cursor-not-allowed select-none" key={hourStart}>
                        <span className="block text-xs font-black">{clockLabel(hourStart)}</span>
                        <span className="mt-1 flex items-center gap-1 text-[9px] font-bold text-ivory/40"><Lock size={10} /> Passed</span>
                      </div>
                    );
                  }
                  return (
                    <button type="button" className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-3 py-3 text-center transition hover:border-brass hover:bg-brass/10 group" key={hourStart} onClick={() => onOpenSlot({ courtId: court.id, date: selectedDay, startMinutes: hourStart })}>
                      <span className="block text-xs font-black text-ivory group-hover:text-brass">{clockLabel(hourStart)}</span>
                      <span className="mt-1 block text-[10px] font-bold text-emerald-400">Book Now</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Admin dashboard calendar ───────────────────────────────────────────────────
export function AdminReservationCalendar() {
  const {
    courts,
    reservations,
    players,
    cancelReservation,
    approveReservation,
    rejectReservation,
    updateReservation
  } = useClubStore();
  const [weekStart, setWeekStart] = React.useState(() => startOfWeek(new Date()));
  const [selectedDay, setSelectedDay] = React.useState(() => new Date());
  const [showAllDates, setShowAllDates] = React.useState(false);
  const [drawer, setDrawer] = React.useState<{ courtId: string; date: Date; startMinutes: number; reservation?: CalReservation } | null>(null);

  const sortedCourts = React.useMemo(() => sortCourts(courts).filter((c) => c.status !== "Maintenance"), [courts]);
  const allReservations: CalReservation[] = reservations
    .filter((r) => !["Cancelled", "NoShow", "Rejected"].includes(r.status))
    .map((r) => ({
      ...r,
      publicLabel: r.status === "Requested" ? "Pending" : (r.title || "Reserved")
    }));

  const playerName = (reservation: CalReservation) =>
    reservation.hostDisplayName
    ?? players.find((p) => p.id === reservation.hostPlayerId)?.displayName
    ?? (reservation.hostPlayerId === "admin" ? "Admin" : "Member");

  const reservationsFor = (day: Date, courtId: string) =>
    allReservations.filter((r) => r.courtId === courtId && reservationDateKey(r.startTime) === dateKey(day));

  const reservationCountForDay = React.useCallback(
    (day: Date) => allReservations.filter((r) => reservationDateKey(r.startTime) === dateKey(day)).length,
    [allReservations]
  );

  const visibleReservations = React.useMemo(() => {
    const scoped = showAllDates
      ? allReservations
      : allReservations.filter((r) => reservationDateKey(r.startTime) === dateKey(selectedDay));
    return [...scoped].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }, [allReservations, selectedDay, showAllDates]);

  React.useEffect(() => {
    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    const selectedInWeek = days.some((day) => dateKey(day) === dateKey(selectedDay));
    const selectedCount = allReservations.filter((r) => reservationDateKey(r.startTime) === dateKey(selectedDay)).length;
    if (selectedInWeek && selectedCount > 0) return;
    const firstWithBookings = days.find((day) => allReservations.some((r) => reservationDateKey(r.startTime) === dateKey(day)));
    if (firstWithBookings) setSelectedDay(firstWithBookings);
    else if (!selectedInWeek) setSelectedDay(days[0]);
  }, [weekStart, allReservations]);

  return (
    <div className="space-y-5">
      <div className="work-surface rounded-3xl border border-white/10 bg-white/5 p-5">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-brass">Court schedule</p>
        <h2 className="font-display text-3xl">Who reserved what</h2>
        <p className="mt-1 text-sm text-linen/65">
          Tap a day with a booking count, then tap any slot to view details. Showing{" "}
          <span className="font-bold text-ivory">{selectedDay.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}</span>.
        </p>

        <div className="mt-5">
          <ReservationWeekHeader
            weekStart={weekStart}
            selectedDay={selectedDay}
            onWeekStartChange={setWeekStart}
            onSelectedDayChange={setSelectedDay}
            reservationCountForDay={reservationCountForDay}
            legend={
              <div className="mt-5 flex flex-wrap gap-2 text-[11px] font-black uppercase tracking-[0.12em]">
                <Legend className="bg-brass text-forest" label="Confirmed" />
                <Legend className="bg-amber-500/80 text-forest" label="Pending" />
                <Legend className="border border-dashed border-white/20 text-ivory/50" label="Open" />
              </div>
            }
          />
        </div>

        <div className="mt-6">
          <CourtSlotGrid
            courts={sortedCourts}
            selectedDay={selectedDay}
            reservationsFor={reservationsFor}
            playerName={playerName}
            mode="admin"
            onOpenSlot={setDrawer}
          />
        </div>
      </div>

      <div className="work-surface rounded-3xl border border-white/10 bg-white/5 p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-3xl">All Reservations</h2>
            <p className="mt-1 text-sm text-linen/60">
              {showAllDates
                ? `${visibleReservations.length} active booking${visibleReservations.length === 1 ? "" : "s"} across all dates`
                : `${visibleReservations.length} on ${selectedDay.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAllDates((value) => !value)}
            className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-wider transition ${showAllDates ? "bg-brass text-forest" : "border border-white/15 bg-white/5 text-ivory hover:bg-white/10"}`}
          >
            {showAllDates ? "This day only" : "Show all dates"}
          </button>
        </div>
        {visibleReservations.length === 0 ? (
          <p className="mt-6 text-sm text-linen/60">
            {showAllDates ? "No active reservations." : "No bookings on this day — pick another date with a count badge above."}
          </p>
        ) : (
          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {visibleReservations.map((item) => {
              const court = courts.find((c) => c.id === item.courtId);
              const isPending = item.status === "Requested";
              return (
                <article className="rounded-2xl bg-white/10 p-4 border border-white/5" key={item.id}>
                  <p className="text-xs font-black uppercase tracking-wider text-brass">{court?.name ?? "Court"} · {item.status}</p>
                  <h3 className="mt-1 font-display text-2xl text-ivory">{playerName(item)}</h3>
                  <p className="text-sm text-linen/75">
                    {item.title?.trim() ? `${item.title} · ` : ""}
                    {new Date(item.startTime).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })} ·{" "}
                    {new Date(item.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}–
                    {new Date(item.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                  {item.notes && <p className="mt-2 text-sm text-linen/65 rounded-xl bg-black/15 p-2">{item.notes}</p>}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {isPending && (
                      <>
                        <button type="button" onClick={() => void approveReservation(item.id)} className="min-h-8 rounded-lg bg-brass px-3 text-xs font-black text-forest">
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const reason = window.prompt("Reason for rejection (optional):") ?? "";
                            void rejectReservation(item.id, reason || undefined);
                          }}
                          className="min-h-8 rounded-lg bg-amber-100 px-3 text-xs font-black text-amber-900"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {item.paymentStatus === "Pending" && !isPending && (
                      <button type="button" onClick={() => void updateReservation(item.id, { paymentStatus: "Paid" })} className="min-h-8 rounded-lg bg-emerald-500/20 px-3 text-xs font-bold text-emerald-200">
                        Mark paid
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        const reason = window.prompt("Cancellation reason (optional):") ?? "";
                        void cancelReservation(item.id, reason || undefined);
                      }}
                      className="min-h-8 rounded-lg bg-red-500/15 px-3 text-xs font-bold text-red-300"
                    >
                      <Ban size={14} className="inline mr-1" /> Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDay(new Date(item.startTime));
                        setDrawer({
                          courtId: item.courtId,
                          date: new Date(item.startTime),
                          startMinutes: reservationTimeMinutes(item.startTime),
                          reservation: item
                        });
                      }}
                      className="min-h-8 rounded-lg border border-white/15 px-3 text-xs font-bold text-ivory/80"
                    >
                      View on grid
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {drawer && (
        <AdminReservationDrawer
          selection={drawer}
          courts={courts}
          players={players}
          close={() => setDrawer(null)}
          onApprove={(id) => { void approveReservation(id); setDrawer(null); }}
          onReject={(id, reason) => { void rejectReservation(id, reason); setDrawer(null); }}
          onCancel={(id, reason) => { void cancelReservation(id, reason); setDrawer(null); }}
        />
      )}
    </div>
  );
}

function AdminReservationDrawer({
  selection,
  courts,
  players,
  close,
  onApprove,
  onReject,
  onCancel
}: {
  selection: { courtId: string; date: Date; startMinutes: number; reservation?: CalReservation };
  courts: Court[];
  players: ReturnType<typeof useClubStore.getState>["players"];
  close: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string, reason?: string) => void;
  onCancel: (id: string, reason?: string) => void;
}) {
  const reservation = selection.reservation;
  const court = courts.find((c) => c.id === selection.courtId);

  if (!reservation) {
    return createPortal(
      <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm" onClick={close}>
        <aside className="w-full max-w-sm rounded-3xl bg-ivory p-6 text-forest shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <p className="text-xs font-black uppercase tracking-wider text-clay">{court?.name}</p>
          <h2 className="mt-1 font-display text-2xl font-black">Open slot</h2>
          <p className="mt-2 text-sm text-forest/70">No booking for this time.</p>
          <button type="button" className="mt-4 w-full rounded-xl bg-forest py-3 text-sm font-black text-ivory" onClick={close}>Close</button>
        </aside>
      </div>,
      document.body
    );
  }

  const isPending = reservation.status === "Requested";
  const host = players.find((p) => p.id === reservation.hostPlayerId);
  const hostName = reservation.hostDisplayName ?? host?.displayName ?? (reservation.hostPlayerId === "admin" ? "Admin" : "Member");

  return createPortal(
    <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm" onClick={close}>
      <aside className="w-full max-w-lg rounded-3xl bg-ivory p-6 text-forest shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-forest/5" onClick={close}><X size={18} /></button>
        <p className="text-xs font-black uppercase tracking-wider text-clay">{court?.name}</p>
        <h2 className="mt-1 font-display text-3xl font-black">{reservation.title || "Court Booking"}</h2>
        <p className="mt-1 text-sm font-semibold text-forest/70">
          {selection.date.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })} ·{" "}
          {clockLabel(selection.startMinutes)} – {clockLabel(timeMinutes(reservation.endTime))}
        </p>

        <div className="mt-5 space-y-3 rounded-2xl bg-forest/5 p-4">
          <p className="text-[10px] font-black uppercase tracking-wider text-clay">Booked by</p>
          <p className="text-lg font-black">{hostName}</p>
          <p className={`text-sm font-bold ${isPending ? "text-amber-700" : "text-emerald-700"}`}>
            {isPending ? "⏳ Pending approval" : `✓ ${reservation.status}`}
          </p>
          {reservation.notes && (
            <p className="rounded-xl bg-white/60 p-3 text-sm text-forest/75">
              <span className="block text-[10px] font-black uppercase tracking-wider text-clay mb-1">Notes</span>
              {reservation.notes}
            </p>
          )}
          <p className="text-xs font-bold text-forest/50">Fee: {formatPeso(reservation.feeAmount)} · {reservation.paymentStatus}</p>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {isPending && (
            <>
              <button type="button" className="flex-1 min-h-11 rounded-xl bg-brass px-4 text-sm font-black text-forest" onClick={() => onApprove(reservation.id)}>
                Approve
              </button>
              <button
                type="button"
                className="flex-1 min-h-11 rounded-xl bg-amber-100 px-4 text-sm font-black text-amber-900"
                onClick={() => {
                  const reason = window.prompt("Reason for rejection (optional):") ?? "";
                  onReject(reservation.id, reason || undefined);
                }}
              >
                Reject
              </button>
            </>
          )}
          <button
            type="button"
            className="w-full min-h-11 rounded-xl bg-red-100 px-4 text-sm font-black text-red-800"
            onClick={() => {
              if (!confirm(`Remove this booking for ${host?.displayName ?? "this player"}?`)) return;
              const reason = window.prompt("Cancellation reason (optional):") ?? "";
              onCancel(reservation.id, reason || undefined);
            }}
          >
            <Ban size={14} className="inline mr-1" /> Remove booking
          </button>
        </div>
      </aside>
    </div>,
    document.body
  );
}

// ── Main exported component ───────────────────────────────────────────────────
export function ReservationCalendar() {
  const {
    courts,
    reservations,
    addReservation,
    cancelReservation,
    loadReservationsRange,
  } = useClubStore();
  const [member, setMember] = React.useState<Member>(null);
  const [weekStart, setWeekStart] = React.useState(() => startOfWeek(new Date()));
  const [selectedDay, setSelectedDay] = React.useState(() => new Date());
  const [drawer, setDrawer] = React.useState<{ courtId: string; date: Date; startMinutes: number; reservation?: CalReservation } | null>(null);
  const [error, setError] = React.useState("");

  const isAdmin = member?.role === "ADMIN";
  const bookableCourts = React.useMemo(
    () => sortCourts(courts).filter((c) => c.status !== "Maintenance"),
    [courts]
  );

  React.useEffect(() => {
    apiFetch("/api/auth?action=me")
      .then((r) => parseResponseJson<{ user?: Member | null }>(r))
      .then((d) => setMember(d.user ?? null))
      .catch(() => setMember(null));
  }, []);

  const days = React.useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  React.useEffect(() => {
    if (!days.some((d) => dateKey(d) === dateKey(selectedDay))) setSelectedDay(days[0]);
  }, [days, selectedDay]);

  React.useEffect(() => {
    if (!useSupabaseData()) return;
    const rangeEnd = addDays(weekStart, 7);
    void loadReservationsRange(weekStart, rangeEnd);
  }, [weekStart, loadReservationsRange]);

  React.useEffect(() => {
    if (!useSupabaseData()) return;
    const rangeEnd = addDays(weekStart, 7);
    return subscribeSupabaseReservations(() => {
      void loadReservationsRange(weekStart, rangeEnd);
    });
  }, [weekStart, loadReservationsRange]);

  const weekReservations: CalReservation[] = reservations
    .filter((r) => !["Cancelled", "NoShow", "Rejected"].includes(r.status))
    .map((r) => ({
      ...r,
      publicLabel: r.status === "Requested" ? "Pending" : (r.title || "Reserved")
    }));

  const reservationsFor = (day: Date, courtId: string) =>
    weekReservations.filter((r) => r.courtId === courtId && reservationDateKey(r.startTime) === dateKey(day));

  return (
    <section className="mx-auto max-w-[1800px] px-3 py-5 pb-36 text-ivory sm:px-5">
      <header className="rounded-3xl border border-ivory/10 bg-white/5 backdrop-blur-xl p-5 shadow-2xl sm:p-7">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-brass">HAFF court schedule</p>
            <h1 className="mt-1 font-display text-4xl font-black sm:text-5xl">Book a Court</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-linen/70">Choose a day and tap any open slot. Player bookings require admin approval. Court rate: {formatPeso(COURT_HOURLY_FEE)}/hr.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="calendar-control" onClick={() => setWeekStart(addDays(weekStart, -7))}><ChevronLeft size={16} /> Previous Week</button>
            <button type="button" className="calendar-control bg-brass text-forest" onClick={() => { setWeekStart(startOfWeek(new Date())); setSelectedDay(new Date()); }}>Today</button>
            <button type="button" className="calendar-control" onClick={() => setWeekStart(addDays(weekStart, 7))}>Next Week <ChevronRight size={16} /></button>
          </div>
        </div>
        <ReservationWeekHeader
          weekStart={weekStart}
          selectedDay={selectedDay}
          onWeekStartChange={setWeekStart}
          onSelectedDayChange={setSelectedDay}
          hideWeekNav
        />
        <div className="mt-5 flex flex-wrap gap-2 text-[11px] font-black uppercase tracking-[0.12em]">
          <Legend className="bg-brass text-forest" label="Confirmed" />
          <Legend className="bg-amber-500/80 text-forest" label="Pending" />
          <Legend className="bg-slate-600 text-white" label="Unavailable" />
        </div>
      </header>

      {error && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="w-full max-w-2xl rounded-3xl border-2 border-red-500 bg-[#150505] p-8 text-center shadow-2xl shadow-red-900/50">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-950 text-red-500 mb-6 animate-bounce"><AlertTriangle size={48} /></div>
            <h2 className="font-display text-3xl font-black uppercase tracking-wider text-red-500">Action Failed</h2>
            <p className="mt-4 text-xl font-medium leading-relaxed text-red-100">{error}</p>
            <button onClick={() => setError("")} className="mt-8 rounded-2xl bg-red-600 px-8 py-4 text-lg font-black uppercase tracking-widest text-white transition hover:bg-red-500 active:scale-95 shadow-lg shadow-red-600/30">Dismiss</button>
          </div>
        </div>
      )}

      {bookableCourts.length === 0 ? (
        <div className="mt-6 flex h-96 flex-col items-center justify-center rounded-3xl border border-ivory/10 bg-[#071f18] text-ivory">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-brass animate-pulse">Loading courts...</p>
        </div>
      ) : (
        <div className="mt-6">
          <CourtSlotGrid
            courts={bookableCourts}
            selectedDay={selectedDay}
            reservationsFor={reservationsFor}
            mode="book"
            onOpenSlot={setDrawer}
          />
        </div>
      )}

      {drawer && (
        <ReservationDrawer
          member={member}
          selection={drawer}
          courts={courts}
          close={() => setDrawer(null)}
          onMemberUpdate={setMember}
          onReserve={async (data) => { await addReservation(data); setDrawer(null); }}
          onCancel={async (id, reason) => { await cancelReservation(id, reason); setDrawer(null); }}
          isAdmin={isAdmin}
        />
      )}
    </section>
  );
}

// ── Reservation Drawer ─────────────────────────────────────────────────────────
function ReservationDrawer({
  member, selection, courts, close, onMemberUpdate, onReserve, onCancel, isAdmin
}: {
  member: Member;
  selection: { courtId: string; date: Date; startMinutes: number; reservation?: CalReservation };
  courts: Court[];
  close: () => void;
  onMemberUpdate: (m: Member) => void;
  onReserve: (data: Omit<Reservation, "id">) => Promise<void>;
  onCancel: (id: string, reason?: string) => Promise<void>;
  isAdmin: boolean;
}) {
  const reservation = selection.reservation;
  const court = courts.find((c) => c.id === selection.courtId);
  const [title, setTitle] = React.useState(reservation?.title || "Court Play");
  const [extendHours, setExtendHours] = React.useState(0);
  const [notes, setNotes] = React.useState(reservation?.notes || "");
  const [error, setError] = React.useState("");
  const [successMsg, setSuccessMsg] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);

  const [authMode, setAuthMode] = React.useState<"login" | "register">("login");
  const [authForm, setAuthForm] = React.useState({ displayName: "", email: "", password: "", skillLevel: "Beginner" });
  const [authError, setAuthError] = React.useState("");
  const [authLoading, setAuthLoading] = React.useState(false);
  const [authShowPassword, setAuthShowPassword] = React.useState(false);
  const [authSuccessMsg, setAuthSuccessMsg] = React.useState("");

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);
    try {
      const res = await fetch(`/api/auth?action=${authMode}`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(authForm) });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) throw new Error(data.error ?? "Unable to continue");
      if (authMode === "register") setAuthSuccessMsg("Account created! You can now book courts.");
      window.dispatchEvent(new Event("haff-auth-change"));
      onMemberUpdate(data.user);
    } catch (reason) {
      setAuthError(reason instanceof Error ? reason.message : "Unable to continue");
    } finally {
      setAuthLoading(false);
    }
  };

  const submit = async (): Promise<boolean> => {
    if (!member && !isAdmin) {
      setError("Sign in to book a court.");
      return false;
    }
    if (!isAdmin && court && court.reservable === false) {
      setError("This court is not available for member reservations.");
      return false;
    }
    if (!isAdmin && court && !isCourtBookable(court)) {
      setError("This court is not accepting reservations right now.");
      return false;
    }
    
    // Validate that booking doesn't extend beyond closing hours
    if (court) {
      const setting = getCourtSetting(court.id);
      const closingMinutes = parseClock(setting.closingTime || "22:00");
      const totalDurationMinutes = (1 + extendHours) * 60;
      const endMinutes = selection.startMinutes + totalDurationMinutes;
      
      if (endMinutes > closingMinutes) {
        setError(`This booking would extend beyond closing time (${clockLabel(closingMinutes)}). Please choose a shorter duration or earlier start time.`);
        return false;
      }
    }
    
    setSubmitting(true);
    setError("");
    const totalDurationMinutes = (1 + extendHours) * 60;
    try {
      const start = new Date(`${dateKey(selection.date)}T${String(Math.floor(selection.startMinutes / 60)).padStart(2, "0")}:${String(selection.startMinutes % 60).padStart(2, "0")}:00+08:00`);
      await onReserve({
        courtId: selection.courtId,
        startTime: start.toISOString(),
        endTime: new Date(start.getTime() + totalDurationMinutes * 60_000).toISOString(),
        title: title.trim() || "Court Play",
        notes: notes.trim() || undefined,
        hostPlayerId: member?.playerId || "admin",
        hostDisplayName: member?.displayName,
        playerIds: [],
        status: isAdmin ? "Confirmed" : "Requested",
        paymentStatus: isAdmin ? "Paid" : "Pending",
        feeAmount: estimateCourtFee(extendHours)
      });
      setSuccessMsg(isAdmin ? "Court booked successfully!" : "Request submitted! An admin will review your booking.");
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Booking failed.");
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const estimatedFee = estimateCourtFee(extendHours);

  const formattedTimeRange = `${clockLabel(selection.startMinutes)} – ${clockLabel(selection.startMinutes + (1 + extendHours) * 60)}`;
  const statusLabel = reservation?.status === "Requested" ? "Pending approval" : reservation?.status === "Confirmed" ? "Confirmed" : reservation?.status;

  return createPortal(
    <div className="fixed inset-0 z-[100000] bg-black/65 backdrop-blur-sm flex items-center justify-center p-4" onMouseDown={close}>
      <aside className={`relative w-full overflow-y-auto rounded-3xl bg-ivory p-6 text-forest shadow-2xl transition-all ${isAdmin ? "max-w-2xl" : "max-w-md max-h-[90vh]"}`} onMouseDown={(e) => e.stopPropagation()}>
        <button className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-forest/5" onClick={close}><X size={18} /></button>
        <p className="text-xs font-black uppercase tracking-[0.2em] text-clay">{court?.name}</p>
        <h2 className="mt-1 font-display text-3xl font-black">{reservation ? reservation.title || "Reservation" : "Book Court"}</h2>
        <p className="mt-1 text-sm font-semibold text-forest/70">{selection.date.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })} · {formattedTimeRange}</p>

        {reservation ? (
          <div className="mt-6 space-y-3">
            <div className="rounded-2xl bg-forest/5 p-4 space-y-2">
              <p className="text-[10px] font-black uppercase tracking-wider text-clay">Reservation Details</p>
              <p className="font-bold">{reservation.title || "Court Play"}</p>
              {reservation.notes && <p className="text-sm text-forest/60">{reservation.notes}</p>}
              <p className={`text-sm font-bold ${reservation.status === "Requested" ? "text-amber-700" : "text-emerald-700"}`}>
                {reservation.status === "Requested" ? "⏳ Pending admin approval" : `✓ ${statusLabel}`}
              </p>
            </div>
            {isAdmin && (
              <button className="w-full rounded-xl bg-red-100 px-4 py-3 font-black text-red-800 text-xs" onClick={async () => { const r = window.prompt("Cancellation reason (optional):") ?? ""; await onCancel(reservation.id, r || undefined); }}>
                Cancel booking
              </button>
            )}
          </div>
        ) : !member && !isAdmin ? (
          <div className="mt-6 rounded-2xl bg-forest/5 border border-forest/10 p-5">
            <div className="flex items-center gap-2 mb-3"><ShieldCheck className="text-clay" size={20} /><p className="font-black text-sm uppercase tracking-wider text-forest">Sign in to book this court</p></div>
            <div className="flex rounded-xl bg-forest/10 p-1 mb-4">
              <button type="button" onClick={() => setAuthMode("login")} className={`flex-1 py-2 text-xs font-black rounded-lg transition ${authMode === "login" ? "bg-forest text-ivory" : "text-forest/70 hover:text-forest"}`}>Sign In</button>
              <button type="button" onClick={() => setAuthMode("register")} className={`flex-1 py-2 text-xs font-black rounded-lg transition ${authMode === "register" ? "bg-forest text-ivory" : "text-forest/70 hover:text-forest"}`}>Register</button>
            </div>
            {authSuccessMsg && <div className="mb-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-xs font-bold text-emerald-800">{authSuccessMsg}</div>}
            {authError && <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs font-bold text-red-800">{authError}</div>}
            <form onSubmit={handleAuthSubmit} className="space-y-3">
              {authMode === "register" && (
                <>
                  <div><label className="block text-[10px] font-black uppercase tracking-wider text-forest/70 mb-1">Display Name</label><input className="w-full rounded-xl border border-forest/15 bg-white px-3 py-2 text-sm text-forest placeholder:text-forest/40 focus:outline-none focus:ring-1 focus:ring-forest" placeholder="e.g. Alex" required value={authForm.displayName} onChange={(e) => setAuthForm({ ...authForm, displayName: e.target.value })} /></div>
                  <div><label className="block text-[10px] font-black uppercase tracking-wider text-forest/70 mb-1">Skill Level</label><select className="w-full rounded-xl border border-forest/15 bg-white px-3 py-2 text-sm text-forest focus:outline-none focus:ring-1 focus:ring-forest appearance-none" value={authForm.skillLevel} onChange={(e) => setAuthForm({ ...authForm, skillLevel: e.target.value })}>{["Newbie","Beginner","Novice","Low Intermediate","Intermediate","Pro"].map((lvl) => <option key={lvl} value={lvl}>{lvl}</option>)}</select></div>
                </>
              )}
              <div><label className="block text-[10px] font-black uppercase tracking-wider text-forest/70 mb-1">Email</label><input type="email" className="w-full rounded-xl border border-forest/15 bg-white px-3 py-2 text-sm text-forest placeholder:text-forest/40 focus:outline-none focus:ring-1 focus:ring-forest" placeholder="your@email.com" required value={authForm.email} onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })} /></div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-forest/70 mb-1">Password</label>
                <div className="relative">
                  <input type={authShowPassword ? "text" : "password"} className="w-full rounded-xl border border-forest/15 bg-white px-3 py-2 pr-10 text-sm text-forest placeholder:text-forest/40 focus:outline-none focus:ring-1 focus:ring-forest" placeholder="••••••••" required value={authForm.password} onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })} />
                  <button type="button" className="absolute inset-y-0 right-0 grid w-10 place-items-center text-forest/40 hover:text-forest" onClick={() => setAuthShowPassword((v) => !v)}>{authShowPassword ? <EyeOff size={15} /> : <Eye size={15} />}</button>
                </div>
              </div>
              <button type="submit" disabled={authLoading} className="w-full rounded-xl bg-forest py-2.5 font-black text-ivory text-xs transition active:scale-[0.98] disabled:opacity-60">{authLoading ? "Please wait…" : authMode === "register" ? "Register" : "Sign In"}</button>
            </form>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {isAdmin && (
              <label className="block text-xs font-black uppercase tracking-wider">Reservation title<input className="calendar-input" value={title} onChange={(e) => setTitle(e.target.value)} /></label>
            )}
            <label className="block text-xs font-black uppercase tracking-wider">
              Notes for admin
              <textarea
                className="calendar-input min-h-16"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. beginner group, need extra balls, celebrating a birthday..."
              />
            </label>
            <label className="block text-xs font-black uppercase tracking-wider">
              Duration
              <select className="calendar-input" value={extendHours} onChange={(e) => setExtendHours(Number(e.target.value))}>
                <option value={0}>1 hour</option><option value={1}>2 hours</option><option value={2}>3 hours</option><option value={3}>4 hours</option>
              </select>
            </label>
            <div className="rounded-2xl bg-brass/20 p-4">
              <p className="text-xs font-black uppercase tracking-wider text-clay">Estimated fee</p>
              <p className="mt-1 text-3xl font-black">{formatPeso(estimatedFee)}</p>
              <p className="mt-1 text-xs text-forest/60">{formatPeso(COURT_HOURLY_FEE)}/hr × {1 + extendHours} hour{extendHours > 0 ? "s" : ""}</p>
              {!isAdmin && <p className="mt-1 text-xs text-forest/60">Payment collected after admin approves your request.</p>}
            </div>
            {error && <p className="rounded-xl bg-red-100 border border-red-300 px-4 py-3 text-sm font-bold text-red-800">{error}</p>}
            {successMsg && <p className="rounded-xl bg-emerald-100 border border-emerald-300 px-4 py-3 text-sm font-bold text-emerald-800">{successMsg}</p>}
            <button
              type="button"
              className="w-full rounded-xl bg-forest px-5 py-4 font-black text-ivory text-base shadow-lg transition active:scale-[0.98] disabled:opacity-60"
              onClick={() => {
                if (isAdmin) void submit();
                else setShowConfirm(true);
              }}
              disabled={submitting || !!successMsg}
            >
              {submitting ? "Submitting..." : isAdmin ? "⚡ Book Instantly" : "Submit Request"}
            </button>
          </div>
        )}

        {showConfirm && !isAdmin && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-3xl bg-black/50 p-4 backdrop-blur-sm" onMouseDown={(e) => e.stopPropagation()}>
            <div className="w-full max-w-sm rounded-2xl border border-forest/10 bg-ivory p-5 text-forest shadow-2xl">
              <p className="text-xs font-black uppercase tracking-wider text-clay">Confirm request</p>
              <h3 className="mt-1 font-display text-2xl font-black">Submit reservation?</h3>
              <p className="mt-2 text-sm text-forest/70">
                Your booking for <strong>{court?.name}</strong> on {selection.date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })} at {formattedTimeRange} will be sent to admin for approval.
                Estimated fee: <strong>{formatPeso(estimatedFee)}</strong>.
              </p>
              {notes.trim() && (
                <p className="mt-3 rounded-xl bg-forest/5 p-3 text-sm text-forest/75">
                  <span className="block text-[10px] font-black uppercase tracking-wider text-clay mb-1">Your notes</span>
                  {notes.trim()}
                </p>
              )}
              <div className="mt-4 flex gap-2">
                <button type="button" className="flex-1 rounded-xl bg-forest/10 py-3 text-sm font-black text-forest" onClick={() => setShowConfirm(false)} disabled={submitting}>
                  Go back
                </button>
                <button
                  type="button"
                  className="flex-1 rounded-xl bg-forest py-3 text-sm font-black text-ivory"
                  onClick={() => void submit().then((ok) => { if (ok) setShowConfirm(false); })}
                  disabled={submitting}
                >
                  {submitting ? "Sending…" : "Yes, submit"}
                </button>
              </div>
            </div>
          </div>
        )}
      </aside>
    </div>,
    document.body
  );
}
