import React from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  Ban,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  Eye,
  EyeOff,
  LogIn,
  UserPlus,
  List,
  Lock,
  Settings,
  ShieldCheck,
  X
} from "lucide-react";

type Member = { id: string; role: "ADMIN" | "MEMBER"; playerId?: string; displayName: string } | null;
type Court = {
  id: string;
  name: string;
  number: number;
  status: string;
  reservationSetting?: {
    reservationsEnabled: boolean;
    openingTime: string;
    closingTime: string;
    minDurationMinutes: number;
    maxDurationMinutes: number;
  } | null;
};
type Reservation = {
  id: string;
  courtId: string;
  requesterUserId?: string;
  title?: string;
  notes?: string;
  participantPlayerIds?: string[];
  startTime: string;
  endTime: string;
  approvalStatus: string;
  paymentStatus?: string;
  feeAmount?: number;
  seriesId?: string;
  rejectionReason?: string;
  cancellationReason?: string;
  publicLabel?: string;
  requester?: { email: string; player?: { displayName?: string; phone?: string } };
  court?: Court;
  createdAt?: string;
  queuePosition?: number;
};
type Allocation = { id: string; courtId: string; date: string; startTime: string; endTime: string; mode: string; note?: string };
type Blackout = { id: string; courtId: string; startTime: string; endTime: string; reason: string };
type WeekData = { courts: Court[]; reservations: Reservation[]; allocations: Allocation[]; blackouts: Blackout[] };

const SLOT_HEIGHT = 28;
const START_MINUTES = 6 * 60;
const END_MINUTES = 23 * 60;
const SLOT_COUNT = (END_MINUTES - START_MINUTES) / 30;
const MANILA_TZ = "Asia/Manila";

const api = async (url: string, options?: RequestInit) => {
  const response = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
    ...options
  });
  const text = await response.text();
  const data = text && response.headers.get("content-type")?.includes("application/json") ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(data.error ?? "Unable to complete request. Please verify status with the marshal at the front desk.");
  return data;
};

const dateKey = (date: Date) => new Intl.DateTimeFormat("en-CA", {
  timeZone: MANILA_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
}).format(date);

const startOfWeek = (date: Date) => {
  const copy = new Date(`${dateKey(date)}T12:00:00+08:00`);
  const day = copy.getDay();
  copy.setDate(copy.getDate() - (day === 0 ? 6 : day - 1));
  return copy;
};

const addDays = (date: Date, days: number) => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
};

const timeMinutes = (dateValue: string) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: MANILA_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(dateValue)).split(":");
  return Number(parts[0]) * 60 + Number(parts[1]);
};

const clockLabel = (minutes: number) => {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const date = new Date(Date.UTC(2026, 0, 1, hour - 8, minute));
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
};

const statusStyle = (status: string) => {
  if (status === "CONFIRMED") return "border-brass/50 bg-brass text-forest";
  if (status === "PAYMENT_ISSUE") return "border-red-400/50 bg-red-950/90 text-red-100";
  if (status === "AWAITING_PAYMENT") return "border-amber-300/50 bg-amber-700/90 text-white";
  return "calendar-requested border-amber-300/50 text-amber-50";
};

export function ReservationCalendar() {
  const [member, setMember] = React.useState<Member>(null);
  const [weekStart, setWeekStart] = React.useState(() => startOfWeek(new Date()));
  const [data, setData] = React.useState<WeekData>({ courts: [], reservations: [], allocations: [], blackouts: [] });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [selectedDay, setSelectedDay] = React.useState(() => new Date());
  const [drawer, setDrawer] = React.useState<{ courtId: string; date: Date; startMinutes: number; reservation?: Reservation } | null>(null);
  const [adminReservations, setAdminReservations] = React.useState<Reservation[]>([]);
  const [adminTab, setAdminTab] = React.useState<"requests" | "settings" | "history">("requests");

  const loadWeek = React.useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const [session, week] = await Promise.all([
        api("/api/auth?action=me").catch(() => ({ user: null })),
        api(`/api/reservations?action=week&start=${encodeURIComponent(dateKey(weekStart))}`)
      ]);
      setMember(session.user ?? null);
      setData(week);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Calendar could not be loaded.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [weekStart]);

  const loadAdmin = React.useCallback(async () => {
    const isLocalAdmin = localStorage.getItem("haff_admin_authenticated") === "true";
    if (!isLocalAdmin && (!member || member.role !== "ADMIN")) return;
    try {
      const admin = await api("/api/reservations?action=admin");
      setAdminReservations(admin.reservations ?? []);
    } catch (reason) {
      console.warn("Failed loading admin requests:", reason);
    }
  }, [member]);

  React.useEffect(() => { void loadWeek(false); }, [loadWeek]);
  React.useEffect(() => { void loadAdmin(); }, [loadAdmin]);

  const load = React.useCallback(async (silent = true) => {
    await Promise.all([loadWeek(silent), loadAdmin()]);
  }, [loadWeek, loadAdmin]);

  const days = React.useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)), [weekStart]);
  const reservationsFor = (day: Date, courtId: string) =>
    data.reservations.filter((reservation) => reservation.courtId === courtId && dateKey(new Date(reservation.startTime)) === dateKey(day));
  const allocationFor = (day: Date, courtId: string) =>
    data.allocations.filter((allocation) => allocation.courtId === courtId && dateKey(new Date(allocation.date)) === dateKey(day));
  const blackoutsFor = (day: Date, courtId: string) =>
    data.blackouts.filter((blackout) => blackout.courtId === courtId && dateKey(new Date(blackout.startTime)) === dateKey(day));
  const moveReservation = async (reservationId: string, courtId: string, day: Date, startMinutes: number) => {
    const reservation = data.reservations.find((item) => item.id === reservationId);
    if (!reservation) return;
    const duration = new Date(reservation.endTime).getTime() - new Date(reservation.startTime).getTime();
    const start = new Date(`${dateKey(day)}T${String(Math.floor(startMinutes / 60)).padStart(2, "0")}:${String(startMinutes % 60).padStart(2, "0")}:00+08:00`);
    
    // Optimistic Update: move the item locally first so drag-and-drop is instant
    const originalReservations = [...data.reservations];
    const updatedReservations = data.reservations.map((item) => {
      if (item.id === reservationId) {
        return {
          ...item,
          courtId,
          startTime: start.toISOString(),
          endTime: new Date(start.getTime() + duration).toISOString()
        };
      }
      return item;
    });
    setData((prev) => ({ ...prev, reservations: updatedReservations }));

    try {
      await api("/api/reservations?action=reschedule", {
        method: "POST",
        body: JSON.stringify({ id: reservationId, courtId, startTime: start.toISOString(), endTime: new Date(start.getTime() + duration).toISOString() })
      });
      await load(true); // silent background load
    } catch (reason) {
      setData((prev) => ({ ...prev, reservations: originalReservations }));
      setError(reason instanceof Error ? reason.message : "Reservation could not be moved.");
    }
  };

  React.useEffect(() => {
    if (!days.some((day) => dateKey(day) === dateKey(selectedDay))) {
      setSelectedDay(days[0]);
    }
  }, [days, selectedDay]);

  return (
    <section className="mx-auto max-w-[1800px] px-3 py-5 pb-32 text-ivory sm:px-5">
      <header className="rounded-3xl border border-ivory/10 bg-[#173f32] p-5 shadow-2xl sm:p-7">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-brass">HAFF court schedule</p>
            <h1 className="mt-1 font-display text-4xl font-black sm:text-5xl">Book a Court</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-linen/70">Choose a day and tap any open slot on the timeline below to book.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button className="calendar-control" onClick={() => setWeekStart(addDays(weekStart, -7))}><ChevronLeft size={16} /> Previous Week</button>
            <button className="calendar-control bg-brass text-forest" onClick={() => { setWeekStart(startOfWeek(new Date())); setSelectedDay(new Date()); }}>Today</button>
            <button className="calendar-control" onClick={() => setWeekStart(addDays(weekStart, 7))}>Next Week <ChevronRight size={16} /></button>
          </div>
        </div>

        {/* Day Picker */}
        <div className="mt-6 overflow-x-auto pb-2 border-t border-white/5 pt-4">
          <div className="flex min-w-max gap-2">
            {days.map((day) => {
              const selected = dateKey(day) === dateKey(selectedDay);
              return (
                <button 
                  className={`min-w-24 rounded-2xl border px-4 py-3 text-center transition ${selected ? "border-brass bg-brass text-forest" : "border-ivory/10 bg-ivory/5 text-ivory hover:bg-ivory/10"}`} 
                  key={dateKey(day)} 
                  onClick={() => setSelectedDay(day)}
                >
                  <span className="block text-[10px] font-black uppercase tracking-wider">{day.toLocaleDateString([], { weekday: "short" })}</span>
                  <span className="mt-1 block font-display text-2xl font-black">{day.getDate()}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2 text-[11px] font-black uppercase tracking-[0.12em]">
          <Legend className="bg-brass text-forest" label="Confirmed" />
          <Legend className="calendar-requested text-amber-50" label="Requested" />
          <Legend className="bg-emerald-700 text-white" label="Open play" />
          <Legend className="bg-red-900 text-red-100" label="Maintenance" />
          <Legend className="bg-slate-600 text-white" label="Unavailable" />
        </div>
      </header>

      {error && <div className="mt-4 rounded-2xl bg-red-950/80 p-4 font-bold text-red-100">{error}</div>}
      
      {loading && data.courts.length === 0 ? (
        <div className="mt-6 flex h-96 flex-col items-center justify-center rounded-3xl border border-ivory/10 bg-[#071f18] text-ivory">
          <div className="loader-wrapper relative scale-75 pb-16">
            {"loading".split("").map((letter, index) => (
              <span className="loader-letter text-brass" style={{ animationDelay: `${index * 0.08}s` }} key={`${letter}-${index}`}>
                {letter}
              </span>
            ))}
            <div className="loader" aria-hidden="true" />
          </div>
          <p className="mt-4 text-xs font-black uppercase tracking-[0.2em] text-brass animate-pulse">Retrieving court availability...</p>
        </div>
      ) : (
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {data.courts.map((court) => (
            <div className="rounded-3xl border border-ivory/10 bg-[#071f18] p-5 shadow-2xl" key={court.id}>
              <div className="border-b border-ivory/10 pb-3 mb-4 flex justify-between items-baseline">
                <h3 className="font-display text-2xl font-black text-brass uppercase tracking-wide">{court.name}</h3>
                <span className="text-xs text-ivory/50">1-hour slots</span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {Array.from({ length: 16 }, (_, i) => {
                  const hourStart = (6 + i) * 60; // 6:00 AM to 9:00 PM (starts)
                  const hourEnd = hourStart + 60;
                  
                  // 1. Check court settings
                  const setting = court.reservationSetting;
                  const closed = !setting?.reservationsEnabled
                    || hourStart < parseClock(setting.openingTime || "06:00")
                    || hourStart >= parseClock(setting.closingTime || "22:00");
                  
                  if (closed) {
                    return (
                      <div className="rounded-xl border border-white/5 bg-slate-800/40 px-3 py-3 text-center text-ivory/30" key={hourStart}>
                        <span className="block text-xs font-black">{clockLabel(hourStart)}</span>
                        <span className="mt-0.5 block truncate text-[9px] font-bold text-ivory/40">Closed</span>
                      </div>
                    );
                  }

                  // 2. Check maintenance blackouts
                  const dayBlackouts = blackoutsFor(selectedDay, court.id);
                  const blackout = dayBlackouts.find(b => {
                    const start = timeMinutes(b.startTime);
                    const end = timeMinutes(b.endTime);
                    return hourStart < end && hourEnd > start;
                  });
                  if (blackout) {
                    return (
                      <div className="rounded-xl border border-red-950/40 bg-red-950/20 px-3 py-3 text-center text-red-300/60" key={hourStart}>
                        <span className="block text-xs font-black">{clockLabel(hourStart)}</span>
                        <span className="mt-0.5 block truncate text-[9px] font-bold text-red-400/80" title={blackout.reason}>Maintenance</span>
                      </div>
                    );
                  }

                  // 3. Check open play allocations
                  const dayAllocations = allocationFor(selectedDay, court.id);
                  const allocation = dayAllocations.find(a => {
                    const start = parseClock(a.startTime);
                    const end = parseClock(a.endTime);
                    return hourStart < end && hourEnd > start;
                  });
                  if (allocation) {
                    return (
                      <div className="rounded-xl border border-emerald-950/40 bg-emerald-950/30 px-3 py-3 text-center text-emerald-300/60" key={hourStart}>
                        <span className="block text-xs font-black">{clockLabel(hourStart)}</span>
                        <span className="mt-0.5 block truncate text-[9px] font-bold text-emerald-400/80" title={allocation.note}>Open Play</span>
                      </div>
                    );
                  }

                  // 4. Check reservations
                  const dayReservations = reservationsFor(selectedDay, court.id);
                  const reservation = dayReservations.find(r => {
                    const start = timeMinutes(r.startTime);
                    const end = timeMinutes(r.endTime);
                    return hourStart < end && hourEnd > start;
                  });

                  if (reservation) {
                    const isOwner = member?.role === "ADMIN" || localStorage.getItem("haff_admin_authenticated") === "true" || (member && reservation.requesterUserId === member.id);
                    const isConfirmed = reservation.approvalStatus === "CONFIRMED";
                    const requesterName = reservation.requester?.player?.displayName || reservation.requester?.email?.split("@")[0] || "Player";
                    const label = reservation.publicLabel || (isConfirmed ? `Reserved (${requesterName})` : `Requested (${requesterName})`);
                    
                    return (
                      <button
                        className={`rounded-xl border px-3 py-3 text-center transition ${
                          isConfirmed 
                            ? "border-brass/30 bg-brass/10 text-brass" 
                            : "calendar-requested border-amber-300/30 text-amber-100"
                        } hover:opacity-95 hover:border-brass/50`}
                        key={hourStart}
                        onClick={() => setDrawer({ courtId: court.id, date: selectedDay, startMinutes: hourStart, reservation })}
                      >
                        <span className="block text-xs font-black">{clockLabel(hourStart)}</span>
                        <span className="mt-0.5 block truncate text-[9px] font-bold opacity-80" title={label}>
                          {label}
                        </span>
                      </button>
                    );
                  }

                  // 5. Block past slots — build the exact Manila datetime using +08:00 offset
                  const slotH = String(Math.floor(hourStart / 60)).padStart(2, "0");
                  const slotMin = String(hourStart % 60).padStart(2, "0");
                  const slotISO = `${dateKey(selectedDay)}T${slotH}:${slotMin}:00+08:00`;
                  const isPast = new Date(slotISO).getTime() < Date.now();
                  const isAdmin = member?.role === "ADMIN";

                  if (isPast && !isAdmin) {
                    return (
                      <div className="rounded-xl border border-white/5 bg-[#0b1310] px-3 py-3 text-center text-ivory/30 flex flex-col items-center justify-center opacity-40 cursor-not-allowed select-none" key={hourStart}>
                        <span className="block text-xs font-black">{clockLabel(hourStart)}</span>
                        <span className="mt-1 flex items-center justify-center gap-1 text-[9px] font-bold text-ivory/40">
                          <Lock size={10} className="opacity-70" /> Passed
                        </span>
                      </div>
                    );
                  }

                  return (
                    <button
                      className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-3 py-3 text-center transition hover:border-brass hover:bg-brass/10 group"
                      key={hourStart}
                      onClick={() => setDrawer({ courtId: court.id, date: selectedDay, startMinutes: hourStart })}
                    >
                      <span className="block text-xs font-black text-ivory group-hover:text-brass">{clockLabel(hourStart)}</span>
                      <span className="mt-1 block text-[10px] font-bold text-emerald-400">Book Now</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {(member?.role === "ADMIN" || localStorage.getItem("haff_admin_authenticated") === "true") && (
        <AdminWorkspace
          reservations={adminReservations}
          courts={data.courts}
          tab={adminTab}
          setTab={setAdminTab}
          reload={load}
          weekStart={weekStart}
        />
      )}

      {drawer && (
        <ReservationDrawer
          member={member}
          selection={drawer}
          courts={data.courts}
          close={() => setDrawer(null)}
          reload={load}
          onMemberUpdate={setMember}
        />
      )}
    </section>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return <span className={`rounded-full px-3 py-1.5 ${className}`}>{label}</span>;
}const parseClock = (value: string) => {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
};

function ReservationDrawer({ member, selection, courts, close, reload, onMemberUpdate }: {
  member: Member;
  selection: { courtId: string; date: Date; startMinutes: number; reservation?: Reservation };
  courts: Court[];
  close: () => void;
  reload: () => Promise<void>;
  onMemberUpdate: (m: Member) => void;
}) {
  const reservation = selection.reservation;
  const court = courts.find((item) => item.id === selection.courtId);
  const [title, setTitle] = React.useState("Court Play");
  const [extendHours, setExtendHours] = React.useState(0); // 0 = 1 hour default, 1 = +1 hr, etc.
  const [notes, setNotes] = React.useState("");
  const [error, setError] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const isAdmin = member?.role === "ADMIN" || localStorage.getItem("haff_admin_authenticated") === "true";
  const [publicLabel, setPublicLabel] = React.useState(reservation?.publicLabel || reservation?.title || "");
  const requesterName = reservation?.requester?.player?.displayName || reservation?.requester?.email?.split("@")[0] || "Player";
  const requestTimeStr = reservation?.createdAt ? new Date(reservation.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "N/A";
  const isOwner = isAdmin || (member && reservation?.requesterUserId === member.id);

  // Inline Auth states and handlers
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
      const res = await fetch(`/api/auth?action=${authMode}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(authForm)
      });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) throw new Error(data.error ?? "Unable to continue");
      if (authMode === "register") {
        setAuthSuccessMsg("Account created successfully!");
      }
      window.dispatchEvent(new Event("haff-auth-change"));
      onMemberUpdate(data.user);
      await reload();
    } catch (reason) {
      setAuthError(reason instanceof Error ? reason.message : "Unable to continue");
    } finally {
      setAuthLoading(false);
    }
  };

  const submit = async () => {
    if (!member) return setError("Sign in before requesting a reservation.");
    setSubmitting(true);
    setError("");
    const totalDurationMinutes = (1 + extendHours) * 60;
    try {
      const start = new Date(`${dateKey(selection.date)}T${String(Math.floor(selection.startMinutes / 60)).padStart(2, "0")}:${String(selection.startMinutes % 60).padStart(2, "0")}:00+08:00`);
      
      await api("/api/reservations?action=request", {
        method: "POST",
        body: JSON.stringify({
          courtId: selection.courtId,
          startTime: start.toISOString(),
          endTime: new Date(start.getTime() + totalDurationMinutes * 60_000).toISOString(),
          title: title.trim() || "Court Play",
          notes: notes.trim(),
          publicLabel: publicLabel.trim() || null,
          feeAmount: 350 * (1 + extendHours),
          instant: isAdmin, // If staff/admin, confirm instantly
          recurrenceRule: null
        })
      });
      await reload();
      close();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to complete reservation request. Please try again shortly.");
    } finally {
      setSubmitting(false);
    }
  };

  const savePublicLabel = async () => {
    try {
      await api("/api/reservations?action=update-public-label", {
        method: "POST",
        body: JSON.stringify({ id: reservation?.id, publicLabel })
      });
      await reload();
      setError("Label updated!");
      setTimeout(() => setError(""), 1500);
    } catch (reasonValue) {
      setError(reasonValue instanceof Error ? reasonValue.message : "Update failed.");
    }
  };

  const cancel = async (scope: "occurrence" | "future" | "series") => {
    const reason = window.prompt("Cancellation reason:") ?? "";
    try {
      await api("/api/reservations?action=cancel", { method: "POST", body: JSON.stringify({ id: reservation?.id, scope, reason }) });
      close();
      await reload();
    } catch (reasonValue) {
      setError(reasonValue instanceof Error ? reasonValue.message : "Cancellation failed.");
    }
  };
  
  const formattedTimeRange = `${clockLabel(selection.startMinutes)} – ${clockLabel(selection.startMinutes + (1 + extendHours) * 60)}`;

  const isWideModal = isAdmin;

  return createPortal(
    <div className="fixed inset-0 z-[100000] bg-black/65 backdrop-blur-sm flex items-center justify-center p-4" onMouseDown={close}>
      <aside className={`relative w-full overflow-y-auto rounded-3xl bg-ivory p-6 text-forest shadow-2xl transition-all ${isWideModal ? "max-w-2xl" : "max-w-md max-h-[90vh]"}`} onMouseDown={(event) => event.stopPropagation()}>
        <button className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-forest/5" onClick={close}><X size={18} /></button>
        <p className="text-xs font-black uppercase tracking-[0.2em] text-clay">{court?.name}</p>
        <h2 className="mt-1 font-display text-3xl font-black">{reservation ? reservation.title || reservation.publicLabel || "Reservation" : "Book Court"}</h2>
        <p className="mt-1 text-sm font-semibold text-forest/70">{selection.date.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })} · {formattedTimeRange}</p>
        
        {reservation ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {/* Card 1: Reservation Info */}
            <div className="rounded-2xl bg-forest/5 p-4 space-y-3 flex flex-col justify-between">
              <div>
                {isOwner ? (
                  <>
                    <p className="text-[10px] font-black uppercase tracking-wider text-clay mb-2">Private Renter Info (Staff view)</p>
                    <Detail label="Status" value={reservation.approvalStatus.replaceAll("_", " ")} />
                    {reservation.paymentStatus && <Detail label="Payment" value={reservation.paymentStatus} />}
                    <Detail label="Player / Renter" value={requesterName} />
                    <Detail label="Submitted At" value={requestTimeStr} />
                    {reservation.notes && <Detail label="Private Notes" value={reservation.notes} />}
                    {reservation.rejectionReason && <Detail label="Staff response" value={reservation.rejectionReason} />}
                  </>
                ) : (
                  <>
                    <p className="text-[10px] font-black uppercase tracking-wider text-clay mb-2">Reservation Info</p>
                    <Detail label="Status" value={reservation.approvalStatus === "CONFIRMED" ? "Confirmed (Approved)" : "Requested (Pending Approval)"} />
                    <Detail label="Player / Renter" value={requesterName} />
                    <Detail label="Submitted At" value={requestTimeStr} />
                  </>
                )}
              </div>
              {member && isOwner && !["CANCELLED", "REJECTED"].includes(reservation.approvalStatus) && (
                <button className="mt-3 w-full rounded-xl bg-red-100 px-4 py-3 font-black text-red-800 text-xs" onClick={() => void cancel("occurrence")}>Cancel booking</button>
              )}
            </div>

            {/* Card 2: Public details */}
            <div className="rounded-2xl border border-brass/25 bg-brass/5 p-4 flex flex-col justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-clay mb-2">Calendar Text (Players view)</p>
                {isAdmin ? (
                  <label className="block text-xs font-black uppercase tracking-wider mt-3">
                    Display Label
                    <input className="calendar-input" value={publicLabel} onChange={(event) => setPublicLabel(event.target.value)} placeholder="e.g. Reserved for Coach Alex" />
                  </label>
                ) : (
                  <div className="mt-3">
                    <p className="text-xs font-black uppercase tracking-wider text-forest/55">Display Label</p>
                    <p className="font-bold text-lg">{reservation.publicLabel || (reservation.approvalStatus === "CONFIRMED" ? "Reserved" : "Requested")}</p>
                  </div>
                )}
              </div>
              {isAdmin && (
                <div className="mt-4">
                  <button className="w-full rounded-xl bg-forest px-4 py-3.5 font-black text-ivory text-xs transition active:scale-[0.98]" onClick={savePublicLabel}>Save Public Label</button>
                </div>
              )}
            </div>
          </div>
        ) : !member ? (
          <div className="mt-6 rounded-2xl bg-forest/5 border border-forest/10 p-5">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="text-clay" size={20} />
              <p className="font-black text-sm uppercase tracking-wider text-forest">Sign in to request this court</p>
            </div>
            
            {/* Mode switch */}
            <div className="flex rounded-xl bg-forest/10 p-1 mb-4">
              <button
                type="button"
                onClick={() => setAuthMode("login")}
                className={`flex-1 py-2 text-xs font-black rounded-lg transition ${authMode === "login" ? "bg-forest text-ivory" : "text-forest/70 hover:text-forest"}`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => setAuthMode("register")}
                className={`flex-1 py-2 text-xs font-black rounded-lg transition ${authMode === "register" ? "bg-forest text-ivory" : "text-forest/70 hover:text-forest"}`}
              >
                Register
              </button>
            </div>

            {authSuccessMsg && (
              <div className="mb-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-xs font-bold text-emerald-800">
                {authSuccessMsg}
              </div>
            )}
            {authError && (
              <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs font-bold text-red-800">
                {authError}
              </div>
            )}

            <form onSubmit={handleAuthSubmit} className="space-y-3">
              {authMode === "register" && (
                <>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-forest/70 mb-1">Display Name</label>
                    <input
                      className="w-full rounded-xl border border-forest/15 bg-white px-3 py-2 text-sm text-forest placeholder:text-forest/40 focus:outline-none focus:ring-1 focus:ring-forest"
                      placeholder="e.g. Alex"
                      required
                      value={authForm.displayName}
                      onChange={(e) => setAuthForm({ ...authForm, displayName: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-forest/70 mb-1">Skill Level</label>
                    <select
                      className="w-full rounded-xl border border-forest/15 bg-white px-3 py-2 text-sm text-forest focus:outline-none focus:ring-1 focus:ring-forest appearance-none"
                      value={authForm.skillLevel}
                      onChange={(e) => setAuthForm({ ...authForm, skillLevel: e.target.value })}
                    >
                      {["Newbie", "Beginner", "Novice", "Low Intermediate", "Intermediate", "Pro"].map((lvl) => (
                        <option key={lvl} value={lvl}>{lvl}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-forest/70 mb-1">Email</label>
                <input
                  type="email"
                  className="w-full rounded-xl border border-forest/15 bg-white px-3 py-2 text-sm text-forest placeholder:text-forest/40 focus:outline-none focus:ring-1 focus:ring-forest"
                  placeholder="your@email.com"
                  required
                  value={authForm.email}
                  onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-forest/70 mb-1">Password</label>
                <div className="relative">
                  <input
                    type={authShowPassword ? "text" : "password"}
                    className="w-full rounded-xl border border-forest/15 bg-white px-3 py-2 pr-10 text-sm text-forest placeholder:text-forest/40 focus:outline-none focus:ring-1 focus:ring-forest"
                    placeholder="••••••••"
                    required
                    value={authForm.password}
                    onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 grid w-10 place-items-center text-forest/40 hover:text-forest"
                    onClick={() => setAuthShowPassword((v) => !v)}
                  >
                    {authShowPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={authLoading}
                className="w-full rounded-xl bg-forest py-2.5 font-black text-ivory text-xs transition active:scale-[0.98] disabled:opacity-60"
              >
                {authLoading ? "Please wait…" : authMode === "register" ? "Register" : "Sign In"}
              </button>
            </form>
          </div>
        ) : isAdmin ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {/* Card 1: Private details */}
            <div className="rounded-2xl bg-forest/5 p-4 space-y-3 flex flex-col justify-between">
              <div className="space-y-3">
                <p className="text-[10px] font-black uppercase tracking-wider text-clay">Private Renter Info (Staff view)</p>
                <label className="block text-xs font-black uppercase tracking-wider">
                  Reservation title
                  <input className="calendar-input" value={title} onChange={(event) => setTitle(event.target.value)} />
                </label>
                <label className="block text-xs font-black uppercase tracking-wider">
                  Renter Notes
                  <textarea className="calendar-input min-h-16" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Player names or notes..." />
                </label>
                <label className="block text-xs font-black uppercase tracking-wider">
                  Duration
                  <select className="calendar-input" value={extendHours} onChange={(event) => setExtendHours(Number(event.target.value))}>
                    <option value={0}>1 hour</option>
                    <option value={1}>2 hours</option>
                    <option value={2}>3 hours</option>
                    <option value={3}>4 hours</option>
                  </select>
                </label>
                <div className="rounded-2xl bg-brass/10 p-3">
                  <p className="text-[10px] font-black uppercase tracking-wider text-clay">Estimated fee</p>
                  <p className="mt-1 text-xl font-black">PHP {350 * (1 + extendHours)}</p>
                </div>
              </div>
              <button 
                className="w-full rounded-xl bg-forest px-5 py-4 font-black text-ivory text-base shadow-lg transition active:scale-[0.98] disabled:opacity-60" 
                onClick={() => void submit()}
                disabled={submitting}
              >
                {submitting ? "Booking..." : "⚡ Book Instantly (Approved)"}
              </button>
            </div>

            {/* Card 2: Public details */}
            <div className="rounded-2xl border border-brass/25 bg-brass/5 p-4 flex flex-col justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-clay mb-2">Calendar Text (Players view)</p>
                <label className="block text-xs font-black uppercase tracking-wider mt-3">
                  Display Label
                  <input className="calendar-input" value={publicLabel} onChange={(event) => setPublicLabel(event.target.value)} placeholder="e.g. Reserved for Coach Alex" />
                </label>
                <p className="text-[10px] text-forest/60 mt-3 leading-relaxed">
                  This text will be shown directly on the public court calendar display. If empty, the Reservation Title will be used.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <label className="block text-xs font-black uppercase tracking-wider">
              Duration
              <select className="calendar-input" value={extendHours} onChange={(event) => setExtendHours(Number(event.target.value))}>
                <option value={0}>1 hour</option>
                <option value={1}>2 hours</option>
                <option value={2}>3 hours</option>
                <option value={3}>4 hours</option>
              </select>
            </label>

            <div className="rounded-2xl bg-brass/20 p-4">
              <p className="text-xs font-black uppercase tracking-wider text-clay">Estimated fee</p>
              <p className="mt-1 text-3xl font-black">PHP {350 * (1 + extendHours)}</p>
            </div>

            <button 
              className="w-full rounded-xl bg-forest px-5 py-4 font-black text-ivory text-base shadow-lg transition active:scale-[0.98] disabled:opacity-60" 
              onClick={() => void submit()}
              disabled={submitting}
            >
              {submitting ? "Booking..." : "👍 Book Court"}
            </button>
          </div>
        )}
        {error && <p className="mt-4 rounded-xl bg-red-100 p-3 text-sm font-bold text-red-800">{error}</p>}
      </aside>
    </div>,
    document.body
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-forest/5 p-4"><p className="text-[10px] font-black uppercase tracking-wider text-clay">{label}</p><p className="mt-1 font-bold">{value}</p></div>;
}



function AdminWorkspace({ reservations, courts, tab, setTab, reload, weekStart }: {
  reservations: Reservation[]; courts: Court[]; tab: "requests" | "settings" | "history"; setTab: (tab: "requests" | "settings" | "history") => void; reload: () => Promise<void>; weekStart: Date;
}) {
  const active = reservations
    .filter((item) => ["REQUESTED", "AWAITING_PAYMENT", "PAYMENT_ISSUE"].includes(item.approvalStatus))
    .sort((left, right) => (left.queuePosition ?? Number.MAX_SAFE_INTEGER) - (right.queuePosition ?? Number.MAX_SAFE_INTEGER));
  const history = reservations.filter((item) => ["REJECTED", "CANCELLED", "NO_SHOW"].includes(item.approvalStatus));
  return (
    <section className="mt-6 rounded-3xl border border-ivory/10 bg-[#10392d] p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-brass">Administrator workspace</p><h2 className="font-display text-3xl font-black">Reservation Operations</h2></div><div className="flex gap-2">{(["requests", "settings", "history"] as const).map((item) => <button className={`calendar-control capitalize ${tab === item ? "bg-brass text-forest" : ""}`} key={item} onClick={() => setTab(item)}>{item === "settings" ? <Settings size={15} /> : item === "history" ? <List size={15} /> : <Clock size={15} />}{item}</button>)}</div></div>
      {tab === "requests" && <div className="mt-5 grid gap-3 lg:grid-cols-2">{active.map((item) => <AdminRequest key={item.id} reservation={item} reload={reload} conflicts={reservations.filter((candidate) => candidate.id !== item.id && candidate.courtId === item.courtId && new Date(candidate.startTime) < new Date(item.endTime) && new Date(candidate.endTime) > new Date(item.startTime) && ["REQUESTED", "AWAITING_PAYMENT"].includes(candidate.approvalStatus)).length} />)}{!active.length && <p className="text-ivory/50">No pending requests.</p>}</div>}
      {tab === "settings" && <CourtSettings courts={courts} weekStart={weekStart} reload={reload} />}
      {tab === "history" && <div className="mt-5 space-y-2">{history.map((item) => <div className="rounded-xl bg-ivory/5 p-3 text-sm" key={item.id}><strong>{item.title}</strong> · {item.approvalStatus} · {new Date(item.startTime).toLocaleString()}</div>)}{!history.length && <p className="text-ivory/50">No cancelled or rejected reservations.</p>}</div>}
    </section>
  );
}

function AdminRequest({ reservation, reload, conflicts }: { reservation: Reservation; reload: () => Promise<void>; conflicts: number }) {
  const [error, setError] = React.useState("");
  const act = async (action: string, body: Record<string, unknown> = {}) => {
    try {
      await api(`/api/reservations?action=${action}`, { method: "POST", body: JSON.stringify({ id: reservation.id, ...body }) });
      await reload();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Action failed."); }
  };
  return (
    <article className="rounded-2xl bg-ivory p-4 text-forest">
      <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wider text-clay">Queue #{reservation.queuePosition ?? "—"} · {reservation.court?.name} · {reservation.approvalStatus.replaceAll("_", " ")}</p><h3 className="mt-1 font-display text-2xl font-black">{reservation.title}</h3><p className="text-sm text-forest/65">{new Date(reservation.startTime).toLocaleString()}–{new Date(reservation.endTime).toLocaleTimeString()}</p></div>{conflicts > 0 && <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800">{conflicts} competing</span>}</div>
      <div className="mt-3 rounded-xl bg-forest/5 p-3 text-sm"><p className="font-black">{reservation.requester?.player?.displayName || reservation.requester?.email}</p>{reservation.notes && <p className="mt-1 text-forest/60">{reservation.notes}</p>}</div>
      <div className="mt-3 flex flex-wrap gap-2">
        {reservation.paymentStatus !== "PAID" && <button className="rounded-xl bg-amber-100 px-3 py-2 text-xs font-black text-amber-900" onClick={() => void act("mark-paid", { transactionId: window.prompt("Payment reference (optional):") || "" })}><CreditCard size={14} className="inline" /> Record payment</button>}
        <button className="rounded-xl bg-forest px-3 py-2 text-xs font-black text-ivory disabled:opacity-40" disabled={reservation.paymentStatus !== "PAID"} onClick={() => void act("approve")}><Check size={14} className="inline" /> Approve</button>
        <button className="rounded-xl bg-red-100 px-3 py-2 text-xs font-black text-red-800" onClick={() => { const reason = window.prompt("Rejection reason:"); if (reason?.trim()) void act("reject", { reason }); }}><Ban size={14} className="inline" /> Reject</button>
      </div>
      {error && <p className="mt-3 text-xs font-bold text-red-700">{error}</p>}
    </article>
  );
}

function CourtSettings({ courts, weekStart, reload }: { courts: Court[]; weekStart: Date; reload: () => Promise<void> }) {
  const saveSetting = async (court: Court, enabled: boolean) => {
    await api("/api/reservations?action=settings", { method: "POST", body: JSON.stringify({ courtId: court.id, reservationsEnabled: enabled, openingTime: court.reservationSetting?.openingTime || "06:00", closingTime: court.reservationSetting?.closingTime || "22:00", minDurationMinutes: 30, maxDurationMinutes: 180 }) });
    await reload();
  };
  const setAllocation = async (courtId: string, day: Date, mode: "OPEN_PLAY" | "RESERVATION") => {
    await api("/api/reservations?action=allocation", { method: "POST", body: JSON.stringify({ courtId, date: dateKey(day), startTime: "15:00", endTime: "23:00", mode, note: mode === "OPEN_PLAY" ? "Open play allocation" : "Private reservations continue" }) });
    await reload();
  };
  return (
    <div className="mt-5 space-y-5">
      <div className="grid gap-3 md:grid-cols-2">{courts.map((court) => <div className="rounded-2xl bg-ivory p-4 text-forest" key={court.id}><div className="flex items-center justify-between"><div><p className="font-display text-2xl font-black">{court.name}</p><p className="text-xs text-forest/55">6:00 AM–10:00 PM · 30 minute intervals</p></div><button className={`rounded-full px-4 py-2 text-xs font-black ${court.reservationSetting?.reservationsEnabled ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"}`} onClick={() => void saveSetting(court, !court.reservationSetting?.reservationsEnabled)}>{court.reservationSetting?.reservationsEnabled ? "Reservable" : "Disabled"}</button></div></div>)}</div>
      <div><h3 className="font-display text-2xl font-black">3 PM Court Allocation</h3><p className="text-sm text-ivory/55">Choose whether each court serves open play or private reservations for each day.</p><div className="mt-3 overflow-x-auto"><table className="min-w-full text-sm"><thead><tr><th className="p-2 text-left">Court</th>{Array.from({ length: 7 }, (_, index) => <th className="p-2" key={index}>{addDays(weekStart, index).toLocaleDateString([], { weekday: "short" })}</th>)}</tr></thead><tbody>{courts.map((court) => <tr className="border-t border-ivory/10" key={court.id}><td className="p-2 font-black">{court.name}</td>{Array.from({ length: 7 }, (_, index) => <td className="p-2" key={index}><select className="rounded-lg bg-ivory/10 p-2 text-xs" defaultValue="OPEN_PLAY" onChange={(event) => void setAllocation(court.id, addDays(weekStart, index), event.target.value as "OPEN_PLAY" | "RESERVATION")}><option className="text-forest" value="OPEN_PLAY">Open play</option><option className="text-forest" value="RESERVATION">Reservation</option></select></td>)}</tr>)}</tbody></table></div></div>
      <button className="rounded-xl bg-red-900 px-4 py-3 text-sm font-black text-red-100" onClick={async () => { const courtId = window.prompt(`Court ID:\n${courts.map((court) => `${court.name}: ${court.id}`).join("\n")}`); const startTime = window.prompt("Blackout start (YYYY-MM-DDTHH:mm):"); const endTime = window.prompt("Blackout end (YYYY-MM-DDTHH:mm):"); const reason = window.prompt("Reason:"); if (courtId && startTime && endTime && reason) { await api("/api/reservations?action=blackout", { method: "POST", body: JSON.stringify({ courtId, startTime: new Date(`${startTime}:00+08:00`).toISOString(), endTime: new Date(`${endTime}:00+08:00`).toISOString(), reason }) }); await reload(); } }}><AlertTriangle size={16} className="inline" /> Add maintenance blackout</button>
    </div>
  );
}
