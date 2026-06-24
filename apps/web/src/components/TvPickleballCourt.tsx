import React from "react";
import { Lock, Megaphone, RotateCcw, CalendarClock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Court, Match, Player, Reservation } from "../lib/types";
import { getPlayerDisplayLabel } from "../lib/utils";

type CourtPlayer = Pick<Player, "id" | "displayName" | "avatarUrl" | "skillLevel" | "rating">;

type TvPickleballCourtProps = {
  court: Court;
  match?: Match;
  teamA: CourtPlayer[];
  teamB: CourtPlayer[];
  reservedPlayers?: CourtPlayer[];
  activeReservation?: Reservation & { participantNames?: string[] };
  getPlayerAvatar: (player: CourtPlayer) => string;
  onAnnounce?: () => void;
  timerSlot?: React.ReactNode;
  isOvertime?: boolean;
};

const COURT_LINE = "rgba(115,255,180,0.32)";
const COURT_LINE_DIM = "rgba(255,255,255,0.14)";

function OvertimeCurtain() {
  return (
    <div className="absolute inset-0 z-[100] flex overflow-hidden pointer-events-none rounded-[inherit]">
      {/* Left Curtain */}
      <motion.div
        className="w-1/2 h-full bg-[#1e0505] border-r border-[#3a0a0a] flex flex-col items-end justify-center pr-2 sm:pr-4 shadow-[10px_0_20px_rgba(0,0,0,0.6)] z-10"
        initial={{ x: "-100%" }}
        animate={{ x: 0 }}
        exit={{ x: "-100%" }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        <span className="text-[2rem] sm:text-[3rem] md:text-[4rem] font-black tracking-widest text-brass -mr-3 sm:-mr-5 drop-shadow-[0_0_15px_rgba(255,215,0,0.3)] opacity-0 animate-fade-in [animation-delay:1000ms]">OVER</span>
      </motion.div>

      {/* Right Curtain */}
      <motion.div
        className="w-1/2 h-full bg-[#1e0505] border-l border-[#3a0a0a] flex flex-col items-start justify-center pl-2 sm:pl-4 shadow-[-10px_0_20px_rgba(0,0,0,0.6)] z-10"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
         <span className="text-[2rem] sm:text-[3rem] md:text-[4rem] font-black tracking-widest text-brass -ml-3 sm:-ml-5 drop-shadow-[0_0_15px_rgba(255,215,0,0.3)] opacity-0 animate-fade-in [animation-delay:1000ms]">TIME</span>
      </motion.div>
      
      {/* Overlay Text */}
      <motion.div
         className="absolute inset-0 flex flex-col items-center justify-center z-20 pointer-events-none"
         initial={{ opacity: 0, scale: 0.5 }}
         animate={{ opacity: 1, scale: 1 }}
         exit={{ opacity: 0 }}
         transition={{ delay: 1.2, duration: 0.6, type: "spring" }}
      >
         <div className="bg-black/70 backdrop-blur-md px-6 py-4 sm:px-8 sm:py-6 rounded-3xl border border-brass/30 text-center shadow-2xl flex flex-col items-center justify-center">
             <p className="text-[2rem] sm:text-[3rem] md:text-[4rem] font-display font-black tracking-tighter text-ivory leading-none drop-shadow-md">OVERTIME</p>
             <p className="text-[0.65rem] sm:text-xs md:text-sm font-bold uppercase tracking-[0.2em] text-brass mt-3 sm:mt-4">Please clear the court</p>
         </div>
      </motion.div>
    </div>
  );
}

function ReservationOverlay({
  reservation,
}: {
  reservation: Reservation & { participantNames?: string[] };
}) {
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Manila",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));

  const names = reservation.participantNames ?? [];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-[90] flex flex-col items-center justify-center bg-[#0a2a1e]/92 backdrop-blur-sm rounded-[inherit] p-4 text-center"
    >
      {/* Badge */}
      <div className="flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 mb-4">
        <CalendarClock size={14} className="text-amber-300" />
        <span className="text-[11px] font-black uppercase tracking-widest text-amber-300">Court Rental</span>
      </div>

      {/* Title */}
      <p className="font-display text-2xl sm:text-3xl font-black text-ivory leading-tight">
        {reservation.title || "Reserved"}
      </p>

      {/* Time */}
      <p className="mt-2 text-sm font-bold text-linen/70">
        {fmt(reservation.startTime)} – {fmt(reservation.endTime)}
      </p>

      {/* Player names */}
      {names.length > 0 && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {names.map((name, i) => (
            <span
              key={i}
              className="rounded-full border border-brass/30 bg-brass/10 px-3 py-1 text-xs font-bold text-brass"
            >
              {name}
            </span>
          ))}
        </div>
      )}

      {/* Subtle court lines watermark */}
      <div
        className="absolute inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(90deg, rgba(115,255,180,0.6) 1px, transparent 1px), linear-gradient(rgba(115,255,180,0.6) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
    </motion.div>
  );
}

function TvCourtPlayerCell({
  player,
  getPlayerAvatar,
}: {
  player?: CourtPlayer;
  getPlayerAvatar: (player: CourtPlayer) => string;
}) {
  if (!player) {
    return (
      <div className="tv-court-cell tv-court-cell--empty">
        <span className="tv-court-cell__placeholder">—</span>
      </div>
    );
  }

  return (
    <div className="tv-court-cell">
      <div className="tv-court-cell__avatar-wrap">
        <img
          src={getPlayerAvatar(player)}
          alt=""
          className="tv-court-cell__avatar"
        />
        <span className="tv-court-cell__status-dot" aria-hidden />
      </div>
      <p className="tv-court-cell__name">{getPlayerDisplayLabel(player)}</p>
      <span className="tv-court-cell__skill">{player.skillLevel}</span>
    </div>
  );
}

function CourtHeader({
  courtName,
  courtNumber,
  status,
  statusTone,
  onAnnounce,
  announceIcon,
  announceLabel,
}: {
  courtName: string;
  courtNumber: number;
  status: string;
  statusTone: "playing" | "reserved" | "available" | "maintenance" | "paused";
  onAnnounce?: () => void;
  announceIcon?: "megaphone" | "rotate";
  announceLabel?: string;
}) {
  return (
    <div className="tv-pickle-court__header">
      <div className="tv-pickle-court__header-brand">
        <span className="tv-pickle-court__court-badge" aria-hidden>
          <span className="tv-pickle-court__court-number">{courtNumber}</span>
        </span>
        <h2 className="tv-pickle-court__court-name">
          <span className="sr-only">{courtName}</span>
          <span className="tv-pickle-court__court-label">Court</span>
        </h2>
      </div>
      <div className="tv-pickle-court__header-meta">
        <span className={`tv-pickle-court__status tv-pickle-court__status--${statusTone}`}>
          <span className="tv-pickle-court__status-dot" />
          {status}
        </span>
        {onAnnounce ? (
          <button
            type="button"
            onClick={onAnnounce}
            className="tv-pickle-court__announce-btn"
            title={announceLabel ?? "Announce"}
            aria-label={announceLabel ?? "Announce"}
          >
            {announceIcon === "megaphone" ? <Megaphone size={14} /> : <RotateCcw size={14} />}
            <span className="tv-pickle-court__announce-label">{announceLabel ?? "Announce"}</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}

function PlayingCourtBody({
  teamA,
  teamB,
  getPlayerAvatar,
}: {
  teamA: CourtPlayer[];
  teamB: CourtPlayer[];
  getPlayerAvatar: (player: CourtPlayer) => string;
}) {
  return (
    <div
      className="tv-pickle-court__surface tv-pickle-court__surface--playing"
      style={{ "--court-line": COURT_LINE } as React.CSSProperties}
    >
      {/* Top service boxes — back court */}
      <div className="tv-pickle-court__service tv-pickle-court__service--top tv-pickle-court__service--a">
        <TvCourtPlayerCell player={teamA[0]} getPlayerAvatar={getPlayerAvatar} />
      </div>
      <div className="tv-pickle-court__service tv-pickle-court__service--top tv-pickle-court__service--b">
        <TvCourtPlayerCell player={teamB[0]} getPlayerAvatar={getPlayerAvatar} />
      </div>

      {/* Kitchen — non-volley zone (court lines only) */}
      <div className="tv-pickle-court__kitchen" aria-hidden>
        <div className="tv-pickle-court__kitchen-glow" />
      </div>

      {/* Bottom service boxes — front court */}
      <div className="tv-pickle-court__service tv-pickle-court__service--bottom tv-pickle-court__service--a">
        <TvCourtPlayerCell player={teamA[1]} getPlayerAvatar={getPlayerAvatar} />
      </div>
      <div className="tv-pickle-court__service tv-pickle-court__service--bottom tv-pickle-court__service--b">
        <TvCourtPlayerCell player={teamB[1]} getPlayerAvatar={getPlayerAvatar} />
      </div>
    </div>
  );
}

function IdleCourtBody({
  tone,
  title,
  subtitle,
  children,
}: {
  tone: "reserved" | "available" | "maintenance" | "paused";
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`tv-pickle-court__surface tv-pickle-court__surface--idle tv-pickle-court__surface--${tone}`}
      style={{ "--court-line": tone === "reserved" ? "rgba(251,191,36,0.35)" : COURT_LINE_DIM } as React.CSSProperties}
    >
      <div className="tv-pickle-court__idle-kitchen">
        {tone === "reserved" ? <Lock className="tv-pickle-court__idle-icon" /> : null}
        <p className="tv-pickle-court__idle-title">{title}</p>
        {subtitle ? <p className="tv-pickle-court__idle-sub">{subtitle}</p> : null}
        {children}
      </div>
    </div>
  );
}

// Memoized: props only change when court/match data changes, not on every 1 Hz
// clock tick that drives the parent DisplayView. This prevents all 3 court panels
// from re-rendering every second just because `useNow()` updates.
export const TvPickleballCourt = React.memo(function TvPickleballCourt({
  court,
  match,
  teamA,
  teamB,
  reservedPlayers = [],
  activeReservation,
  getPlayerAvatar,
  onAnnounce,
  timerSlot,
  isOvertime,
}: TvPickleballCourtProps) {
  const isPlaying = Boolean(match);
  const isReserved = !isPlaying && court.status === "Reserved";
  const isAssigned = !isPlaying && court.status === "Assigned";
  // Active schedule-based reservation takes priority over idle states
  const hasActiveRental = Boolean(activeReservation) && !isPlaying;

  let statusTone: "playing" | "reserved" | "available" | "maintenance" | "paused" = "available";
  let statusLabel = "AVAILABLE";
  if (isPlaying) {
    statusTone = "playing";
    statusLabel = "PLAYING";
  } else if (hasActiveRental) {
    statusTone = "reserved";
    statusLabel = "RENTAL";
  } else if (court.status === "Maintenance") {
    statusTone = "maintenance";
    statusLabel = "MAINTENANCE";
  } else if (court.status === "Paused") {
    statusTone = "paused";
    statusLabel = "PAUSED";
  } else if (isReserved || isAssigned) {
    statusTone = "reserved";
    statusLabel = isReserved ? "RESERVED" : "ASSIGNED";
  } else if (court.locked) {
    statusTone = "paused";
    statusLabel = "LOCKED";
  }

  return (
    <article
      className={`tv-pickle-court tv-pickle-court--${statusTone} relative overflow-hidden`}
      aria-label={`${court.name} pickleball court display`}
    >
      <AnimatePresence>
        {isOvertime && <OvertimeCurtain />}
        {hasActiveRental && activeReservation && (
          <ReservationOverlay key="rental" reservation={activeReservation} />
        )}
      </AnimatePresence>
      <CourtHeader
        courtName={court.name}
        courtNumber={court.number}
        status={statusLabel}
        statusTone={statusTone}
        onAnnounce={onAnnounce}
        announceIcon={isPlaying ? "rotate" : "megaphone"}
        announceLabel={isPlaying ? "Announce" : isReserved || isAssigned ? "Announce" : undefined}
      />

      {isPlaying && match ? (
        <PlayingCourtBody teamA={teamA} teamB={teamB} getPlayerAvatar={getPlayerAvatar} />
      ) : isAssigned ? (
        <PlayingCourtBody teamA={teamA} teamB={teamB} getPlayerAvatar={getPlayerAvatar} />
      ) : isReserved || isAssigned ? (
        <IdleCourtBody
          tone="reserved"
          title={isReserved ? "Court Reserved" : "Players Assigned"}
          subtitle={isAssigned ? "Waiting for staff to start" : court.reservedFor}
        >
          {reservedPlayers.length > 0 ? (
            <div className="tv-pickle-court__reserved-players">
              {reservedPlayers.slice(0, 4).map((player) => (
                <TvCourtPlayerCell key={player.id} player={player} getPlayerAvatar={getPlayerAvatar} />
              ))}
            </div>
          ) : (
            <p className="tv-pickle-court__idle-hint">Held for upcoming play</p>
          )}
        </IdleCourtBody>
      ) : court.status === "Maintenance" ? (
        <IdleCourtBody tone="maintenance" title="Under Maintenance" subtitle="Temporarily out of service" />
      ) : court.status === "Paused" ? (
        <IdleCourtBody tone="paused" title="Paused" subtitle="Play will resume shortly" />
      ) : (
        <IdleCourtBody tone="available" title="Ready to Play" subtitle="Court is open" />
      )}

      {isPlaying && timerSlot ? (
        <div className="tv-pickle-court__baseline">{timerSlot}</div>
      ) : null}
    </article>
  );
});
