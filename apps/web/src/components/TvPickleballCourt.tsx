import React from "react";
import { Lock, Megaphone, RotateCcw } from "lucide-react";
import type { Court, Match, Player } from "../lib/types";
import { getPlayerDisplayLabel } from "../lib/utils";

type CourtPlayer = Pick<Player, "id" | "displayName" | "avatarUrl" | "skillLevel" | "rating">;

type TvPickleballCourtProps = {
  court: Court;
  match?: Match;
  teamA: CourtPlayer[];
  teamB: CourtPlayer[];
  reservedPlayers?: CourtPlayer[];
  getPlayerAvatar: (player: CourtPlayer) => string;
  onAnnounce?: () => void;
  timerSlot?: React.ReactNode;
};

const COURT_LINE = "rgba(115,255,180,0.32)";
const COURT_LINE_DIM = "rgba(255,255,255,0.14)";

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
  getPlayerAvatar,
  onAnnounce,
  timerSlot,
}: TvPickleballCourtProps) {
  const isPlaying = Boolean(match);
  const isReserved = !isPlaying && court.status === "Reserved";
  const isAssigned = !isPlaying && court.status === "Assigned";

  let statusTone: "playing" | "reserved" | "available" | "maintenance" | "paused" = "available";
  let statusLabel = "AVAILABLE";
  if (isPlaying) {
    statusTone = "playing";
    statusLabel = "PLAYING";
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
      className={`tv-pickle-court tv-pickle-court--${statusTone}`}
      aria-label={`${court.name} pickleball court display`}
    >
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
