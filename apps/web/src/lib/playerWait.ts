import type { Court, Match, Player } from "./types";
import { getPlayerStackPlacement, SLOTS_PER_STACK } from "./utils";

export type PlayerWaitStatus = {
  label: string;
  summary: string;
  estimatedMs: number;
  estimatedAt: number | null;
  showCountdown: boolean;
};

const ASSIGN_BUFFER_MS = 30_000;

export function getRemainingMilliseconds(
  startedAt: string,
  durationMinutes: number,
  now: number,
  timerPausedAt?: string
) {
  const effectiveNow = timerPausedAt ? new Date(timerPausedAt).getTime() : now;
  const elapsedMs = effectiveNow - new Date(startedAt).getTime();
  return durationMinutes * 60_000 - elapsedMs;
}

export function formatDurationParts(totalMs: number) {
  const safeMs = Math.max(0, Math.floor(totalMs));
  const hours = Math.floor(safeMs / 3_600_000);
  const minutes = Math.floor((safeMs % 3_600_000) / 60_000);
  const seconds = Math.floor((safeMs % 60_000) / 1000);
  const centiseconds = Math.floor((safeMs % 1000) / 10);
  return [
    { label: "hours", value: String(hours).padStart(2, "0") },
    { label: "minutes", value: String(minutes).padStart(2, "0") },
    { label: "seconds", value: `${String(seconds).padStart(2, "0")}.${String(centiseconds).padStart(2, "0")}` },
  ];
}

export function formatEstimatedPlayTime(timestamp: number, now: number): string {
  const delta = timestamp - now;
  if (delta <= ASSIGN_BUFFER_MS) return "Any moment now";
  return new Date(timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function getActiveCourtRemaining(
  matches: Match[],
  matchDurationMinutes: number,
  now: number
): number[] {
  return matches
    .filter((match) => match.status === "InProgress" && match.startedAt)
    .map((match) =>
      Math.max(0, getRemainingMilliseconds(match.startedAt!, matchDurationMinutes, now, match.timerPausedAt))
    )
    .sort((a, b) => a - b);
}

function estimateQueueWaitMs(
  groupIndex: number,
  courts: Court[],
  activeRemaining: number[],
  matchDurationMinutes: number
): number {
  const rotationCourts = courts.filter(
    (court) => court.status !== "Maintenance" && court.status !== "Paused"
  );
  const availableNow = rotationCourts.filter((court) => court.status === "Available").length;
  const matchMs = matchDurationMinutes * 60_000;

  if (groupIndex < availableNow) {
    return ASSIGN_BUFFER_MS;
  }

  const openingsNeeded = groupIndex - availableNow + 1;
  if (activeRemaining.length >= openingsNeeded) {
    return activeRemaining[openingsNeeded - 1] + ASSIGN_BUFFER_MS;
  }

  const lastKnown = activeRemaining[activeRemaining.length - 1] ?? 0;
  const extraWaves = openingsNeeded - activeRemaining.length;
  return lastKnown + extraWaves * matchMs + ASSIGN_BUFFER_MS;
}

export function getPlayerWaitStatus(
  playerId: string,
  players: Player[],
  courts: Court[],
  matches: Match[],
  stackOrder: string[],
  matchDurationMinutes: number,
  now: number
): PlayerWaitStatus {
  const player = players.find((item) => item.id === playerId);
  if (!player?.checkedIn) {
    return {
      label: "Check in first",
      summary: "Check in at the front desk to join tonight's rotation.",
      estimatedMs: 0,
      estimatedAt: null,
      showCountdown: false,
    };
  }

  const activeMatch = matches.find(
    (match) =>
      match.status === "InProgress" &&
      [...match.teamAPlayerIds, ...match.teamBPlayerIds].includes(playerId)
  );
  if (activeMatch) {
    const court = courts.find((item) => item.id === activeMatch.courtId);
    return {
      label: "Playing now",
      summary: court?.name ?? "On court",
      estimatedMs: 0,
      estimatedAt: null,
      showCountdown: false,
    };
  }

  const reservedCourt = courts.find((court) => court.reservedPlayerIds?.includes(playerId));
  if (reservedCourt) {
    return {
      label: "Court reserved",
      summary: reservedCourt.name,
      estimatedMs: 0,
      estimatedAt: null,
      showCountdown: false,
    };
  }

  const placement = getPlayerStackPlacement(playerId, stackOrder);
  if (!placement) {
    return {
      label: "Awaiting queue",
      summary: "Checked in — staff will add you to a stack shortly.",
      estimatedMs: 0,
      estimatedAt: null,
      showCountdown: false,
    };
  }

  const { groupIndex, slotInGroup, label: stackLabel } = placement;
  const activeRemaining = getActiveCourtRemaining(matches, matchDurationMinutes, now);
  const estimatedMs = estimateQueueWaitMs(groupIndex, courts, activeRemaining, matchDurationMinutes);
  const estimatedAt = now + estimatedMs;

  return {
    label: groupIndex === 0 ? "Stack Next" : stackLabel,
    summary: `Slot ${slotInGroup} of ${SLOTS_PER_STACK}`,
    estimatedMs,
    estimatedAt,
    showCountdown: true,
  };
}
