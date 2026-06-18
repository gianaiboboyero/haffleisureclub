import { create } from "zustand";
import { db, getDeviceId, seedCourts } from "../lib/db";
import { playSound, speakAnnouncement } from "../lib/sound";
import { todayKey, generateId, sortCourts, reconcileCourtsWithMatches, reconcileStackOrder, mergeSharedMatches, stripUnauthorizedCheckIns, resolveAuthorizedCheckInIds, splitStackGroups, flattenStackGroups } from "../lib/utils";
import {
  mergeKudosById,
  mergeReviewsByKey,
  migrateLegacyKudos,
  parseMatchReviews,
  parsePlayerKudos,
  type MatchReviewRecord,
  type PlayerKudosEntry
} from "../lib/playerKudos";
import type { Court, Match, Player, Toast, Session, Reservation, Transaction, Testimonial, Achievement, Announcement, TvBroadcast } from "../lib/types";
import { apiFetch, apiJson } from "../lib/api";
import { markRosterSynced, rosterSyncFresh } from "../lib/syncPolicy";
import { useSupabaseData } from "../lib/dataSource";
import {
  broadcastTvState,
  fetchClubState,
  pingClubState,
  publishClubState
} from "../lib/supabase/clubState";
import { fetchCourts as fetchSupabaseCourts, seedCourtsIfEmpty } from "../lib/supabase/courts";
import { fetchPlayersCompact } from "../lib/supabase/players";

let suppressSharedPublishUntil = 0;
let suppressSharedRefreshUntil = 0;
let lastKnownRemoteUpdatedAt: string | null = null;
let syncBackoffUntil = 0;
let syncBackoffStepMs = 0;
const SYNC_BACKOFF_INITIAL_MS = 5_000;
const SYNC_BACKOFF_MAX_MS = 60_000;

function playerIdsNeedingProfileSync(
  players: Player[],
  stackOrder: string[],
  matches: Match[],
  courts: Court[]
) {
  const ids = new Set<string>();
  for (const player of players) {
    if (player.checkedIn) ids.add(player.id);
  }
  for (const id of stackOrder) {
    if (id !== "vacant" && id !== "reserved") ids.add(id);
  }
  for (const match of matches) {
    if (match.status !== "InProgress") continue;
    for (const id of [...match.teamAPlayerIds, ...match.teamBPlayerIds]) {
      if (id !== "vacant" && !id.startsWith("vacant")) ids.add(id);
    }
  }
  for (const court of courts) {
    for (const id of court.reservedPlayerIds ?? []) ids.add(id);
  }
  return ids;
}

function markSyncHealthy(
  set: (partial: { online?: boolean; syncDegraded?: boolean }) => void,
  updatedAt?: string | null
) {
  syncBackoffStepMs = 0;
  syncBackoffUntil = 0;
  if (updatedAt) lastKnownRemoteUpdatedAt = updatedAt;
  set({ online: true, syncDegraded: false });
}

function markSyncDegraded(set: (partial: { syncDegraded?: boolean }) => void) {
  syncBackoffStepMs = Math.min(
    syncBackoffStepMs ? syncBackoffStepMs * 2 : SYNC_BACKOFF_INITIAL_MS,
    SYNC_BACKOFF_MAX_MS
  );
  syncBackoffUntil = Date.now() + syncBackoffStepMs;
  set({ syncDegraded: true });
}
let applyingRemoteClubBroadcast = false;

const clubStateBroadcast =
  typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("haff-club-state-v1") : null;

export function subscribeClubStateBroadcast(
  onRefresh: () => void,
  onStackOrder?: (stackOrder: string[]) => void,
  onPlayerProfiles?: (profiles: PlayerProfileSnapshot[]) => void,
  onTvBroadcast?: (broadcast: TvBroadcast) => void
) {
  if (!clubStateBroadcast) return () => {};
  const handler = (event: MessageEvent) => {
    if (event.data?.type === "state-published") {
      if (Array.isArray(event.data.stackOrder) && onStackOrder) {
        onStackOrder(event.data.stackOrder.map(String));
      }
      // Full refresh merges playerProfiles authoritatively — skip incremental profile apply
      // to avoid a brief UI state with stale checkedIn flags.
      onRefresh();
    }
    if (event.data?.type === "tv-broadcast" && event.data.broadcast && onTvBroadcast) {
      onTvBroadcast(event.data.broadcast as TvBroadcast);
    }
  };
  clubStateBroadcast.addEventListener("message", handler);
  return () => clubStateBroadcast.removeEventListener("message", handler);
}

type PlayerProfileSnapshot = {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
  skillLevel: string;
  statusNote?: string | null;
};

function parseTvBroadcast(value: unknown): TvBroadcast | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  if (typeof item.id !== "string" || typeof item.kind !== "string" || typeof item.createdAt !== "string") {
    return null;
  }
  if (!["message", "court", "overtime"].includes(item.kind)) return null;
  return {
    id: item.id,
    kind: item.kind as TvBroadcast["kind"],
    createdAt: item.createdAt,
    message: typeof item.message === "string" ? item.message : undefined,
    courtId: typeof item.courtId === "string" ? item.courtId : undefined,
    courtName: typeof item.courtName === "string" ? item.courtName : undefined,
    participantIds: Array.isArray(item.participantIds) ? item.participantIds.map(String) : undefined,
    variant: item.variant === "reserved" ? "reserved" : item.variant === "active" ? "active" : undefined
  };
}

function playerProfileSignature(players: Player[]) {
  return players.map(({ id, displayName, avatarUrl, skillLevel, statusNote, checkedIn }) => [
    id,
    displayName,
    avatarUrl ?? "",
    skillLevel,
    statusNote ?? "",
    checkedIn
  ]);
}

function reservationSignature(reservations: Reservation[]) {
  return reservations
    .map((reservation) => [
      reservation.id,
      reservation.status,
      reservation.courtId,
      reservation.startTime,
      reservation.endTime,
      reservation.hostPlayerId,
      reservation.hostDisplayName ?? "",
      reservation.notes ?? "",
      reservation.title ?? ""
    ])
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])));
}

function mergeReservations(local: Reservation[], remote: Reservation[]) {
  const byId = new Map<string, Reservation>();
  for (const reservation of local) byId.set(reservation.id, reservation);
  for (const reservation of remote) byId.set(reservation.id, reservation);
  return Array.from(byId.values()).sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );
}

function mapServerPlayerToClient(server: Record<string, unknown>, local?: Player): Player {
  const lastPlayed =
    server.lastPlayedDate instanceof Date
      ? server.lastPlayedDate.toISOString()
      : typeof server.lastPlayedDate === "string"
        ? server.lastPlayedDate
        : local?.lastPlayedDate;

  return {
    id: String(server.id),
    displayName: String(server.displayName ?? local?.displayName ?? "Player"),
    fullName: typeof server.fullName === "string" ? server.fullName : local?.fullName,
    skillLevel: normalizeSkillLevel(String(server.skillLevel ?? local?.skillLevel ?? "Beginner")),
    rating: typeof server.rating === "number" ? server.rating : local?.rating ?? 2,
    tags: Array.isArray(server.tags) ? server.tags.map(String) : local?.tags ?? [],
    checkedIn: local?.checkedIn ?? false,
    totalGamesPlayed:
      typeof server.totalGamesPlayed === "number" ? server.totalGamesPlayed : local?.totalGamesPlayed ?? 0,
    totalDaysPlayed:
      typeof server.totalDaysPlayed === "number" ? server.totalDaysPlayed : local?.totalDaysPlayed ?? 0,
    lastPlayedDate: lastPlayed,
    isActive: server.status === "Inactive" ? false : local?.isActive ?? true,
    notes: local?.notes,
    phoneNumber:
      typeof server.phone === "string"
        ? server.phone
        : typeof server.phoneNumber === "string"
          ? server.phoneNumber
          : local?.phoneNumber,
    accessCode: local?.accessCode,
    emergencyNote: local?.emergencyNote,
    preferredPlayStyle: local?.preferredPlayStyle,
    avatarUrl:
      typeof server.avatarUrl === "string" && server.avatarUrl.length > 0
        ? server.avatarUrl
        : local?.avatarUrl,
    statusNote: local?.statusNote,
    version: typeof server.version === "number" ? server.version : local?.version
  };
}

function mergePlayersFromServer(localPlayers: Player[], serverPlayers: Record<string, unknown>[]) {
  const localById = new Map(localPlayers.map((player) => [player.id, player]));
  const merged = serverPlayers.map((serverPlayer) =>
    mapServerPlayerToClient(serverPlayer, localById.get(String(serverPlayer.id)))
  );
  for (const localPlayer of localPlayers) {
    if (!merged.some((player) => player.id === localPlayer.id)) {
      merged.push(localPlayer);
    }
  }
  return merged;
}

function mergeCourtsFromServer(localCourts: Court[], serverCourts: Record<string, unknown>[]): Court[] {
  const localById = new Map(localCourts.map((court) => [court.id, court]));
  const merged: Court[] = serverCourts.map((serverCourt, index) => {
    const id = String(serverCourt.id);
    const local = localById.get(id);
    const number = Number(serverCourt.number ?? local?.number ?? index + 1);
    return {
      id,
      name: String(serverCourt.name ?? local?.name ?? `Court ${number}`),
      number,
      priority: number,
      reservable: local?.reservable ?? true,
      status: (local?.status ?? String(serverCourt.status ?? "Available")) as Court["status"],
      currentMatchId: local?.currentMatchId,
      reservedFor: local?.reservedFor,
      reservedPlayerIds: local?.reservedPlayerIds,
      version: local?.version
    };
  });
  for (const localCourt of localCourts) {
    if (!merged.some((court) => court.id === localCourt.id)) {
      merged.push({
        ...localCourt,
        priority: localCourt.number ?? localCourt.priority ?? 0,
        reservable: localCourt.reservable ?? true
      });
    }
  }
  return sortCourts(merged).slice(0, MAX_COURTS);
}

const MAX_COURTS = 3;

async function enforceCourtLimit(courts: Court[]): Promise<Court[]> {
  const sorted = sortCourts(courts);
  if (sorted.length <= MAX_COURTS) return sorted;
  const keep = sorted.slice(0, MAX_COURTS);
  const remove = sorted.slice(MAX_COURTS);
  for (const court of remove) {
    await db.courts.delete(court.id);
    await db.syncQueue.where("entityId").equals(court.id).delete();
  }
  return keep;
}

function playerFromProfile(
  profile: PlayerProfileSnapshot,
  checkedIn: boolean
): Player {
  return {
    id: profile.id,
    displayName: profile.displayName,
    skillLevel: normalizeSkillLevel(profile.skillLevel),
    avatarUrl: profile.avatarUrl && profile.avatarUrl.length > 0 ? profile.avatarUrl : undefined,
    statusNote: profile.statusNote ? profile.statusNote : undefined,
    tags: [],
    checkedIn,
    totalGamesPlayed: 0,
    totalDaysPlayed: 0,
    rating: 2.0
  };
}

function createUnresolvedPlayerStub(id: string, checkedIn: boolean): Player {
  return {
    id,
    displayName: "Queued",
    skillLevel: "Beginner",
    rating: 2,
    tags: [],
    checkedIn,
    totalGamesPlayed: 0,
    totalDaysPlayed: 0
  };
}

function mergeSharedPlayerRoster(
  players: Player[],
  profiles: PlayerProfileSnapshot[],
  checkedInIds: Set<string>,
  stackedIds: Set<string>,
  matches: Match[]
): Player[] {
  const byId = new Map<string, Player>();

  for (const player of players) {
    const checkedIn = checkedInIds.has(player.id);
    byId.set(player.id, {
      ...player,
      checkedIn
    });
  }

  for (const profile of profiles) {
    const checkedIn = checkedInIds.has(profile.id);
    const existing = byId.get(profile.id);
    if (existing) {
      byId.set(profile.id, {
        ...existing,
        displayName: profile.displayName || existing.displayName,
        avatarUrl: profile.avatarUrl && profile.avatarUrl.length > 0 ? profile.avatarUrl : existing.avatarUrl,
        skillLevel: normalizeSkillLevel(profile.skillLevel || existing.skillLevel),
        statusNote: profile.statusNote !== undefined && profile.statusNote !== null
          ? (profile.statusNote || undefined)
          : existing.statusNote,
        checkedIn
      });
    } else {
      byId.set(profile.id, playerFromProfile(profile, checkedIn));
    }
  }

  for (const id of stackedIds) {
    if (id === "vacant" || id.startsWith("vacant") || id === "reserved" || byId.has(id)) continue;
    byId.set(id, createUnresolvedPlayerStub(id, checkedInIds.has(id)));
  }

  for (const match of matches) {
    if (match.status !== "InProgress" || !match.startedAt) continue;
    const matchAge = Date.now() - new Date(match.startedAt).getTime();
    if (matchAge > 90 * 60 * 1000) continue;
    for (const id of [...match.teamAPlayerIds, ...match.teamBPlayerIds]) {
      if (id === "vacant" || id.startsWith("vacant") || byId.has(id)) continue;
      console.warn(`[mergeSharedPlayerRoster] Unresolved player ${id} in active match ${match.id}`);
      byId.set(id, createUnresolvedPlayerStub(id, true));
    }
  }

  return Array.from(byId.values());
}

type ViewMode = "landing" | "admin" | "player" | "tv" | "calendar" | "finance" | "community";

type ClubState = {
  players: Player[];
  courts: Court[];
  matches: Match[];
  sessions: Session[];
  currentSessionId: string | null;
  stackOrder: string[];
  toasts: Toast[];
  view: ViewMode;
  returnFromTvView: ViewMode | null;
  online: boolean;
  syncDegraded: boolean;
  pendingSyncCount: number;
  hydrated: boolean;
  matchDurationMinutes: number;
  clubStatus: string;
  tvBroadcast: TvBroadcast | null;
  reservations: Reservation[];
  transactions: Transaction[];
  playerKudos: PlayerKudosEntry[];
  matchReviews: MatchReviewRecord[];
  testimonials: Testimonial[];
  announcements: Announcement[];
  achievements: Achievement[];
  activeBillboard: { courtName: string; players: Array<{ displayName: string; avatarUrl?: string; skillLevel: string }> } | null;
  showBillboard: (courtName: string, players: Array<{ displayName: string; avatarUrl?: string; skillLevel: string }>) => void;
  clearBillboard: () => void;
  setView: (view: ViewMode) => void;
  goBackFromTv: () => void;
  setMatchDurationMinutes: (minutes: number) => void;
  setClubStatus: (status: string) => void;
  hydrate: () => Promise<void>;
  setOnline: (online: boolean) => void;
  refreshPendingSyncCount: () => Promise<void>;
  processSyncQueue: () => Promise<void>;
  refreshSharedState: (options?: { force?: boolean; allowUnchanged?: boolean; context?: "tv" | "player" | "default" }) => Promise<void>;
  pingSharedState: (options?: { context?: "tv" | "player" | "default" }) => Promise<void>;
  isApplyingRemoteBroadcast: () => boolean;
  runAsRemoteBroadcast: (apply: () => void) => void;
  publishSharedState: (options?: { force?: boolean }) => Promise<void>;
  broadcastTvAnnouncement: (broadcast: Omit<TvBroadcast, "id" | "createdAt">) => Promise<void>;
  applyBroadcastPlayerProfiles: (profiles: PlayerProfileSnapshot[]) => void;

  // Reservation Actions
  addReservation: (reservation: Omit<Reservation, "id">) => Promise<void>;
  updateReservation: (id: string, patch: Partial<Reservation>) => Promise<void>;
  approveReservation: (id: string) => Promise<void>;
  rejectReservation: (id: string, reason?: string) => Promise<void>;
  cancelReservation: (id: string, reason?: string) => Promise<void>;

  // Transaction Actions
  addTransaction: (transaction: Omit<Transaction, "id" | "status" | "timestamp">) => Promise<void>;
  completeTransaction: (id: string) => Promise<void>;
  voidTransaction: (id: string, reason: string) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;

  // Player Actions
  checkIn: (playerId: string, autoLog?: boolean, byAdmin?: boolean) => Promise<void>;
  checkOut: (playerId: string) => Promise<void>;
  checkOutAll: () => Promise<void>;
  movePlayerToIndex: (playerId: string, targetIndex: number, byAdmin?: boolean) => Promise<void>;
  moveStackToIndex: (fromGroupIndex: number, toGroupIndex: number) => Promise<void>;
  addEmptyStack: () => Promise<void>;
  removeStackAtIndex: (groupIndex: number) => Promise<void>;
  setStackSlotKind: (slotIndex: number, kind: "vacant" | "reserved") => Promise<void>;
  addPlayer: (player: Omit<Player, "id" | "totalGamesPlayed" | "totalDaysPlayed">) => Promise<void>;
  updatePlayer: (player: Player) => Promise<void>;
  deletePlayer: (playerId: string) => Promise<void>;

  // Court Actions
  addCourt: (court: Omit<Court, "id" | "status" | "currentMatchId" | "reservedFor" | "reservedPlayerIds">) => Promise<void>;
  updateCourt: (court: Court) => Promise<void>;
  deleteCourt: (courtId: string) => Promise<void>;
  reorderCourts: (courtId: string, targetIndex: number) => Promise<void>;

  // Session Actions
  addSession: (session: Omit<Session, "id">) => Promise<void>;
  updateSession: (session: Session) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  setCurrentSessionId: (sessionId: string | null) => Promise<void>;
  startNewSession: (name: string) => Promise<void>;
  endSession: (force?: boolean) => Promise<{ hasActiveCourts?: boolean; success?: boolean }>;
  returnReservedToQueue: (courtId: string) => Promise<void>;

  // Game/Match Actions
  generateMatches: () => Promise<void>;
  reserveCourt: (courtId: string) => Promise<void>;
  startReservedCourt: (courtId: string) => Promise<void>;
  clearCourt: (courtId: string) => Promise<void>;
  finishCourt: (courtId: string) => Promise<void>;
  updateMatchScores: (matchId: string, scoreA: number, scoreB: number) => Promise<void>;
  submitMatchFeedback: (
    matchId: string,
    reviewerId: string,
    reviewerName: string,
    scoreA: number,
    scoreB: number,
    recommendations: Record<string, { pills: string[]; note?: string }>
  ) => Promise<void>;
  assignPlayerToCourt: (playerId: string, courtId: string) => Promise<void>;
  removePlayerFromCourt: (playerId: string) => Promise<void>;
  joinActiveMatch: (playerId: string, courtId: string) => Promise<void>;
  dismissToast: (id: string) => void;
  suppressRefresh: (ms?: number) => void;
  isRefreshSuppressed: () => boolean;
  addTestimonial: (quote: string, rating: number, displayName: string) => Promise<void>;
  deleteTestimonial: (id: string) => Promise<void>;
  addAnnouncement: (title: string, content: string) => Promise<void>;
  deleteAnnouncement: (id: string) => Promise<void>;
  addAchievement: (title: string, value: string, desc: string) => Promise<void>;
  deleteAchievement: (id: string) => Promise<void>;
  seedDemoPlayers: () => Promise<void>;
};

const getInitialMatchReviews = (): MatchReviewRecord[] => {
  try {
    const saved = localStorage.getItem("haff-match-reviews-v2");
    if (saved) return parseMatchReviews(JSON.parse(saved));
  } catch {
    // ignore
  }
  return [];
};

const getInitialPlayerKudos = (): PlayerKudosEntry[] => {
  try {
    const saved = localStorage.getItem("haff-player-kudos");
    if (saved) return parsePlayerKudos(JSON.parse(saved));
  } catch {
    // ignore
  }
  return migrateLegacyKudos();
};

const persistKudosLocal = (playerKudos: PlayerKudosEntry[], matchReviews: MatchReviewRecord[]) => {
  try {
    localStorage.setItem("haff-player-kudos", JSON.stringify(playerKudos));
    localStorage.setItem("haff-match-reviews-v2", JSON.stringify(matchReviews));
  } catch {
    // ignore quota errors
  }
};

const getInitialTestimonials = () => {
  const existing = localStorage.getItem("haff-testimonials");
  if (existing) return JSON.parse(existing);
  const defaults = [
    { id: "t-1", quote: "HAFF Leisure Club has the best open play rotation! Extremely friendly and organized.", rating: 5, displayName: "Ace" },
    { id: "t-2", quote: "Love the cafe, iced matchas, and smart court countdown timers. Very premium.", rating: 5, displayName: "Dink" },
    { id: "t-3", quote: "Perfect venue to check in, grab a bite at the cafe, and jump right back into the queue.", rating: 5, displayName: "Spike" }
  ];
  localStorage.setItem("haff-testimonials", JSON.stringify(defaults));
  return defaults;
};

const getInitialAchievements = () => {
  const existing = localStorage.getItem("haff-achievements");
  if (existing) return JSON.parse(existing);
  const defaults = [
    { id: "ac-1", title: "Games Logged Today", value: "42 matches", desc: "Active open-play courts running smoothly" },
    { id: "ac-2", title: "Average Wait Time", value: "12 minutes", desc: "Highly optimized stack assignments" },
    { id: "ac-3", title: "Players Checked In", value: "38 regulars", desc: "Connecting diverse skill levels" }
  ];
  localStorage.setItem("haff-achievements", JSON.stringify(defaults));
  return defaults;
};

const getInitialAnnouncements = () => {
  const existing = localStorage.getItem("haff-announcements");
  if (existing) return JSON.parse(existing);
  const defaults = [
    { id: "an-1", title: "Summer Pickleball Open", content: "Registration opens next Monday at the front desk. Limited slots available!", date: "2026-06-15" },
    { id: "an-2", title: "New Court Hours", content: "We are now open from 6:00 AM to 10:00 PM daily starting this week.", date: "2026-06-14" }
  ];
  localStorage.setItem("haff-announcements", JSON.stringify(defaults));
  return defaults;
};

export const useClubStore = create<ClubState>((set, get) => ({
  players: [],
  courts: [],
  matches: [],
  sessions: [],
  reservations: [],
  transactions: [],
  playerKudos: getInitialPlayerKudos(),
  matchReviews: getInitialMatchReviews(),
  testimonials: getInitialTestimonials(),
  announcements: getInitialAnnouncements(),
  achievements: getInitialAchievements(),
  activeBillboard: null,
  showBillboard: (courtName, players) => {
    set({ activeBillboard: { courtName, players } });
    playSound("checkin");
    setTimeout(() => {
      set((state) => (state.activeBillboard?.courtName === courtName ? { activeBillboard: null } : {}));
    }, 5000);
  },
  clearBillboard: () => set({ activeBillboard: null }),
  currentSessionId: localStorage.getItem("haff-current-session-id") ?? "default-active-session",
  stackOrder: JSON.parse(localStorage.getItem("haff-stack-order") ?? "[]") as string[],
  toasts: [],
  view: (() => {
    const path = window.location.pathname.replace(/^\//, "");
    if (path === "home" || path === "landing") return "landing";
    if (path === "parking") return "player";
    if (["landing", "admin", "player", "tv", "calendar", "finance", "community"].includes(path)) return path;
    const hash = window.location.hash.replace(/^#\/?/, "");
    if (hash === "home" || hash === "landing") return "landing";
    if (hash === "parking") return "player";
    if (["landing", "admin", "player", "tv", "calendar", "finance", "community"].includes(hash)) return hash;
    if (hash === "display") return "tv";
    if (hash === "payments" || hash === "revenue") return "finance";
    if (hash === "schedule" || hash === "reservation") return "calendar";
    return "landing";
  })() as ViewMode,
  returnFromTvView: null,
  online: navigator.onLine,
  syncDegraded: false,
  pendingSyncCount: 0,
  hydrated: false,
  matchDurationMinutes: Number(localStorage.getItem("haff-match-duration-minutes") ?? 12),
  clubStatus: localStorage.getItem("haff-club-status") ?? "",
  tvBroadcast: null,
  setView: (view) => {
    const current = get().view;
    if (current === view) return;
    window.history.pushState(null, "", view === "landing" ? "/home" : `/${view}`);
    set({
      view,
      returnFromTvView: view === "tv" ? current : get().returnFromTvView
    });
  },
  goBackFromTv: () => {
    const returnView = get().returnFromTvView;
    get().setView(returnView && returnView !== "tv" ? returnView : "landing");
  },
  setMatchDurationMinutes: (minutes) => {
    const next = Math.max(5, Math.min(45, Math.round(minutes)));
    localStorage.setItem("haff-match-duration-minutes", String(next));
    set({ matchDurationMinutes: next });
  },
  setClubStatus: (status) => {
    const next = status.trim().slice(0, 120);
    if (next) localStorage.setItem("haff-club-status", next);
    else localStorage.removeItem("haff-club-status");
    set({ clubStatus: next });
    window.dispatchEvent(new CustomEvent("haff-club-status", { detail: next }));
  },
  hydrate: async () => {
    if (Date.now() < suppressSharedRefreshUntil) return;
    const online = navigator.onLine;
    const pendingSyncCount = await db.syncQueue.where("status").equals("Pending").count();

    // 1. Load local data immediately — don't wait for server
    if ((await db.courts.count()) === 0) {
      await db.courts.bulkPut(seedCourts);
    }

    const [rawPlayers, rawCourts, matches, sessions, rawReservations, rawTransactions] = await Promise.all([
      db.players.toArray(),
      db.courts.toArray(),
      db.matches.toArray(),
      db.sessions.toArray(),
      db.reservations.toArray(),
      db.transactions.toArray(),
    ]);

    const players = stripUnauthorizedCheckIns(
      rawPlayers.map((player) => ({
        ...player,
        skillLevel: normalizeSkillLevel(player.skillLevel),
      })),
      matches
    );
    const normalizedCourts = await enforceCourtLimit(
      rawCourts.map((court, index) => {
        const number = court.number ?? index + 1;
        return {
          ...court,
          number,
          priority: number,
          reservable: court.reservable ?? true,
          status: court.status === "InUse" && !court.currentMatchId ? "Available" as const : court.status
        };
      })
    );
    if (normalizedCourts.length !== rawCourts.length) {
      await db.courts.bulkPut(normalizedCourts);
    }
    const courts = normalizedCourts;
    const reservations = rawReservations.map((r) => {
      const paymentStatus = r.paymentStatus === "Pending" ? "Paid" as const : r.paymentStatus;
      const hostDisplayName = r.hostDisplayName
        ?? players.find((player) => player.id === r.hostPlayerId)?.displayName
        ?? (r.hostPlayerId === "admin" ? "Admin" : undefined);
      return hostDisplayName ? { ...r, paymentStatus, hostDisplayName } : { ...r, paymentStatus };
    });
    const transactions = rawTransactions.map((t) =>
      t.status === "Pending" ? { ...t, status: "Success" as const } : t
    );

    let currentSessionId = get().currentSessionId || localStorage.getItem("haff-current-session-id") || "default-active-session";
    if (sessions.length === 0) {
      const defaultSession: Session = {
        id: "default-active-session",
        name: "Open Play Session",
        date: new Date().toISOString().split("T")[0],
        startTime: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "Active",
        mode: "Open Play",
        courtIds: courts.map((c) => c.id),
        checkedInPlayerIds: [],
        settings: {}
      };
      sessions.push(defaultSession);
      void db.sessions.put(defaultSession);
    }
    if (!currentSessionId) {
      currentSessionId = sessions[0]?.id || "default-active-session";
    }
    localStorage.setItem("haff-current-session-id", currentSessionId);

    const storedOrder = JSON.parse(localStorage.getItem("haff-stack-order") ?? "[]") as string[];
    const stackOrder = reconcileStackOrder(storedOrder, players, matches, courts);
    localStorage.setItem("haff-stack-order", JSON.stringify(stackOrder));

    // 2. Render immediately with local data
    set({
      players,
      courts,
      matches,
      sessions,
      reservations,
      transactions,
      currentSessionId,
      stackOrder,
      pendingSyncCount,
      clubStatus: localStorage.getItem("haff-club-status") ?? "",
      playerKudos: getInitialPlayerKudos(),
      matchReviews: getInitialMatchReviews(),
      hydrated: true
    });

    // 3. Background: persist normalizations + server sync (non-blocking)
    void (async () => {
      await Promise.all([
        db.players.bulkPut(players),
        db.courts.bulkPut(courts),
        db.reservations.bulkPut(reservations),
        db.transactions.bulkPut(transactions),
      ]);

      if (online && pendingSyncCount === 0 && !rosterSyncFresh()) {
        try {
          if (useSupabaseData()) {
            await seedCourtsIfEmpty();
            const [serverPlayers, serverCourts] = await Promise.all([
              fetchPlayersCompact(),
              fetchSupabaseCourts()
            ]);
            const updates: Promise<unknown>[] = [];
            if (serverPlayers.length > 0) {
              updates.push((async () => {
                const mergedPlayers = mergePlayersFromServer(players, serverPlayers as Record<string, unknown>[]);
                await db.players.bulkPut(mergedPlayers);
              })());
            }
            if (serverCourts.length > 0) {
              updates.push((async () => {
                const mergedCourts = mergeCourtsFromServer(courts, serverCourts as Record<string, unknown>[]);
                await db.courts.bulkPut(mergedCourts);
              })());
            }
            if (serverPlayers.length > 0 || serverCourts.length > 0) {
              markRosterSynced();
            }
            if (updates.length > 0) {
              await Promise.all(updates);
              const [freshPlayers, freshCourts] = await Promise.all([db.players.toArray(), db.courts.toArray()]);
              set({
                players: freshPlayers.map((p) => ({ ...p, skillLevel: normalizeSkillLevel(p.skillLevel) })),
                courts: freshCourts.map((c) => c.status === "InUse" && !c.currentMatchId ? { ...c, status: "Available" as const } : c),
              });
            }
          } else {
          const [resPlayers, resCourts] = await Promise.all([
            apiFetch("/api/players"),
            apiFetch("/api/courts")
          ]);
          const updates: Promise<unknown>[] = [];
          if (resPlayers.ok) {
            const response = await resPlayers.json();
            const serverPlayers = Array.isArray(response) ? response : response.players;
            if (Array.isArray(serverPlayers)) {
              updates.push((async () => {
                const mergedPlayers = mergePlayersFromServer(players, serverPlayers as Record<string, unknown>[]);
                await db.players.bulkPut(mergedPlayers);
              })());
            }
          }
          if (resCourts.ok) {
            const response = await resCourts.json();
            const serverCourts = Array.isArray(response) ? response : response.courts;
            if (Array.isArray(serverCourts) && serverCourts.length > 0) {
              updates.push((async () => {
                const mergedCourts = mergeCourtsFromServer(courts, serverCourts as Record<string, unknown>[]);
                await db.courts.bulkPut(mergedCourts);
              })());
            }
          }
          if (resPlayers.ok || resCourts.ok) {
            markRosterSynced();
          }
          if (updates.length > 0) {
            await Promise.all(updates);
            // Re-read and refresh state silently
            const [freshPlayers, freshCourts] = await Promise.all([db.players.toArray(), db.courts.toArray()]);
            set({
              players: freshPlayers.map((p) => ({ ...p, skillLevel: normalizeSkillLevel(p.skillLevel) })),
              courts: freshCourts.map((c) => c.status === "InUse" && !c.currentMatchId ? { ...c, status: "Available" as const } : c),
            });
          }
          }
        } catch {
          // Silently ignore — we already have local data
        }
      }
    })();
  },
  setOnline: (online) => set({ online }),
  refreshPendingSyncCount: async () => {
    const pendingSyncCount = await db.syncQueue.where("status").equals("Pending").count();
    set({ pendingSyncCount });
    if (pendingSyncCount > 0) {
      await get().processSyncQueue();
    }
  },
  refreshSharedState: async (options) => {
    if (!options?.force && Date.now() < suppressSharedRefreshUntil) return;
    if (!options?.force && Date.now() < syncBackoffUntil) return;
    const currentSessionId = get().currentSessionId;
    if (!currentSessionId || !navigator.onLine) return;
    const allowUnchanged = options?.allowUnchanged !== false && !options?.force;
    const sinceQuery = allowUnchanged && lastKnownRemoteUpdatedAt
      ? `&since=${encodeURIComponent(lastKnownRemoteUpdatedAt)}`
      : "";
    const viewQuery =
      options?.context === "tv"
        ? "&view=tv"
        : options?.context === "player"
          ? "&view=player"
          : "";
    let shared: any;
    try {
      if (useSupabaseData()) {
        shared = await fetchClubState(currentSessionId, {
          since: allowUnchanged ? lastKnownRemoteUpdatedAt ?? undefined : undefined,
          context: options?.context
        });
        if (!shared) {
          markSyncDegraded(set);
          return;
        }
      } else {
      const response = await apiFetch(
        `/api/club-state?sessionId=${encodeURIComponent(currentSessionId)}${sinceQuery}${viewQuery}`,
        { cache: "no-store" }
      );
      if (response.status === 401) {
        if (get().online) set({ online: false });
        return;
      }
      if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) {
        markSyncDegraded(set);
        return;
      }
      shared = await response.json();
      }
      markSyncHealthy(set, typeof shared.updatedAt === "string" ? shared.updatedAt : null);

      if (shared.unchanged === true) {
        const incomingTvBroadcast = parseTvBroadcast(shared.tvBroadcast);
        if (incomingTvBroadcast && incomingTvBroadcast.id !== get().tvBroadcast?.id) {
          set({ tvBroadcast: incomingTvBroadcast });
        }
        return;
      }
    } catch {
      markSyncDegraded(set);
      return;
    }
    const adminCheckedInIds = new Set<string>(
      Array.isArray(shared.adminCheckedInIds) ? shared.adminCheckedInIds.map(String) : []
    );
    const checkedInIds = resolveAuthorizedCheckInIds(
      shared.checkedInPlayerIds ?? [],
      adminCheckedInIds.size > 0 ? [...adminCheckedInIds] : undefined,
      get().players,
      Array.isArray(shared.matches) ? shared.matches : get().matches
    );
    const incomingStack = Array.isArray(shared.stackOrder) ? shared.stackOrder : get().stackOrder;
    const stackedPlayerIds = new Set<string>(
      incomingStack.filter((id: string) => id !== "vacant").map(String)
    );
    let players = mergeSharedPlayerRoster(
      get().players,
      Array.isArray(shared.playerProfiles) ? shared.playerProfiles : [],
      checkedInIds,
      stackedPlayerIds,
      Array.isArray(shared.matches) ? shared.matches : get().matches
    );
    // Converge local AdminCheckedIn tags with server authority to prevent drift flicker.
    if (adminCheckedInIds.size > 0) {
      players = players.map((player) => {
        if (!adminCheckedInIds.has(player.id)) return player;
        const tags = player.tags ?? [];
        if (tags.includes("AdminCheckedIn")) return player;
        return { ...player, tags: [...tags, "AdminCheckedIn"] };
      });
    }
    const rawCourts = Array.isArray(shared.courts) && shared.courts.length > 0 ? shared.courts : get().courts;
    const matches = Array.isArray(shared.matches)
      ? mergeSharedMatches(get().matches, shared.matches as Match[])
      : get().matches;
    players = stripUnauthorizedCheckIns(players, matches);
    const courts = reconcileCourtsWithMatches(rawCourts, matches);
    const stackOrder = reconcileStackOrder(incomingStack, players, matches, courts);
    const remoteReservations = Array.isArray(shared.reservations) ? (shared.reservations as Reservation[]) : [];
    const reservations = remoteReservations.length > 0
      ? mergeReservations(get().reservations, remoteReservations)
      : get().reservations;
    const remoteKudos = parsePlayerKudos(shared.playerKudos);
    const playerKudos = remoteKudos.length > 0
      ? mergeKudosById(get().playerKudos, remoteKudos)
      : get().playerKudos;
    const remoteReviews = parseMatchReviews(shared.matchReviews);
    const matchReviews = remoteReviews.length > 0
      ? mergeReviewsByKey(get().matchReviews, remoteReviews)
      : get().matchReviews;
    const currentSignature = JSON.stringify({
      players: playerProfileSignature(get().players),
      courts: get().courts,
      matches: get().matches,
      stackOrder: get().stackOrder,
      reservations: reservationSignature(get().reservations),
      playerKudos: get().playerKudos.length,
      matchReviews: get().matchReviews.length
    });
    const nextSignature = JSON.stringify({
      players: playerProfileSignature(players),
      courts,
      matches,
      stackOrder,
      reservations: reservationSignature(reservations),
      playerKudos: playerKudos.length,
      matchReviews: matchReviews.length
    });
    const incomingTvBroadcast = parseTvBroadcast(shared.tvBroadcast);
    const broadcastChanged = Boolean(
      incomingTvBroadcast && incomingTvBroadcast.id !== get().tvBroadcast?.id
    );
    if (currentSignature === nextSignature) {
      if (broadcastChanged && incomingTvBroadcast) {
        set({ tvBroadcast: incomingTvBroadcast });
      }
      return;
    }
    if (!options?.force && Date.now() < suppressSharedRefreshUntil) return;
    await db.players.bulkPut(players);
    if (Array.isArray(shared.courts) && shared.courts.length > 0) await db.courts.bulkPut(courts);
    if (Array.isArray(shared.matches)) {
      await db.matches.clear();
      if (matches.length > 0) await db.matches.bulkPut(matches);
    }
    if (remoteReservations.length > 0) await db.reservations.bulkPut(reservations);
    persistKudosLocal(playerKudos, matchReviews);
    localStorage.setItem("haff-stack-order", JSON.stringify(stackOrder));
    // Mark as remote-apply so the store subscriber does not schedule a
    // re-publish of data we just received from the server, which would
    // race-clobber any admin writes that landed between our fetch and set().
    suppressSharedPublishUntil = Date.now() + 3000;
    applyingRemoteClubBroadcast = true;
    try {
      set({
        players,
        courts,
        matches,
        stackOrder,
        reservations,
        playerKudos,
        matchReviews,
        ...(broadcastChanged && incomingTvBroadcast ? { tvBroadcast: incomingTvBroadcast } : {})
      });
    } finally {
      applyingRemoteClubBroadcast = false;
    }
  },
  pingSharedState: async (options) => {
    if (Date.now() < suppressSharedRefreshUntil) return;
    if (Date.now() < syncBackoffUntil) return;
    const currentSessionId = get().currentSessionId;
    if (!currentSessionId || !navigator.onLine) return;
    const sinceQuery = lastKnownRemoteUpdatedAt
      ? `&since=${encodeURIComponent(lastKnownRemoteUpdatedAt)}`
      : "";
    try {
      if (useSupabaseData()) {
        const body = await pingClubState(currentSessionId, lastKnownRemoteUpdatedAt);
        if (!body) {
          markSyncDegraded(set);
          return;
        }
        markSyncHealthy(set, typeof body.updatedAt === "string" ? body.updatedAt : null);
        if (body.unchanged === true) return;
        await get().refreshSharedState({ force: true, context: options?.context });
        return;
      }
      const response = await apiFetch(
        `/api/club-state?ping=1&sessionId=${encodeURIComponent(currentSessionId)}${sinceQuery}`,
        { cache: "no-store" }
      );
      if (response.status === 401) {
        if (get().online) set({ online: false });
        return;
      }
      if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) {
        markSyncDegraded(set);
        return;
      }
      const body = await response.json();
      markSyncHealthy(set, typeof body.updatedAt === "string" ? body.updatedAt : null);
      if (body.unchanged === true) return;
      await get().refreshSharedState({ force: true, context: options?.context });
    } catch {
      markSyncDegraded(set);
    }
  },
  isApplyingRemoteBroadcast: () => applyingRemoteClubBroadcast,
  runAsRemoteBroadcast: (apply) => {
    applyingRemoteClubBroadcast = true;
    try {
      apply();
    } finally {
      applyingRemoteClubBroadcast = false;
    }
  },
  applyBroadcastPlayerProfiles: (profiles) => {
    if (!profiles.length) return;
    applyingRemoteClubBroadcast = true;
    const state = get();
    const checkedInIds = new Set(state.players.filter((player) => player.checkedIn).map((player) => player.id));
    const stackedIds = new Set(state.stackOrder.filter((id) => id !== "vacant"));
    const players = mergeSharedPlayerRoster(
      state.players,
      profiles,
      checkedInIds,
      stackedIds,
      state.matches
    );
    if (playerProfileSignature(players) === playerProfileSignature(state.players)) {
      applyingRemoteClubBroadcast = false;
      return;
    }
    void db.players.bulkPut(players);
    set({ players });
    applyingRemoteClubBroadcast = false;
  },
  publishSharedState: async (options) => {
    if (!options?.force && Date.now() < suppressSharedPublishUntil) return;
    // Extend suppress only if it would shrink the existing window (e.g. finishCourt sets 6s).
    if (suppressSharedRefreshUntil < Date.now() + 2500) suppressSharedRefreshUntil = Date.now() + 2500;

    const state = get();
    const profileIds = playerIdsNeedingProfileSync(state.players, state.stackOrder, state.matches, state.courts);
    const syncedProfiles = state.players
      .filter((player) => profileIds.has(player.id))
      .map((player) => ({
        id: player.id,
        displayName: player.displayName,
        avatarUrl: player.avatarUrl ?? null,
        skillLevel: player.skillLevel,
        statusNote: player.statusNote ?? null
      }));
    try {
      if (useSupabaseData()) {
        const body = await publishClubState({
          sessionId: state.currentSessionId ?? "default-active-session",
          checkedInPlayerIds: state.players.filter((player) => player.checkedIn).map((player) => player.id),
          adminCheckedInIds: state.players
            .filter((player) => player.checkedIn && player.tags?.includes("AdminCheckedIn"))
            .map((player) => player.id),
          stackOrder: state.stackOrder,
          courts: state.courts,
          matches: state.matches,
          reservations: state.reservations,
          playerProfiles: syncedProfiles,
          playerKudos: state.playerKudos,
          matchReviews: state.matchReviews
        });
        if (body) markSyncHealthy(set, body.updatedAt);
      } else {
      const response = await apiFetch("/api/club-state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: state.currentSessionId,
          checkedInPlayerIds: state.players.filter((player) => player.checkedIn).map((player) => player.id),
          adminCheckedInIds: state.players
            .filter((player) => player.checkedIn && player.tags?.includes("AdminCheckedIn"))
            .map((player) => player.id),
          stackOrder: state.stackOrder,
          courts: state.courts,
          matches: state.matches,
          reservations: state.reservations,
          playerProfiles: syncedProfiles,
          playerKudos: state.playerKudos,
          matchReviews: state.matchReviews
        })
      });
      if (response.ok && response.headers.get("content-type")?.includes("application/json")) {
        const body = await response.json();
        markSyncHealthy(set, typeof body.updatedAt === "string" ? body.updatedAt : null);
      }
      }
      clubStateBroadcast?.postMessage({
        type: "state-published",
        at: Date.now(),
        stackOrder: state.stackOrder,
        playerProfiles: syncedProfiles
      });
      // Again, only extend — never shrink an existing longer suppress window.
      if (suppressSharedRefreshUntil < Date.now() + 4000) suppressSharedRefreshUntil = Date.now() + 4000;
    } catch {
      // Local state remains authoritative until the next successful sync.
    }
  },
  broadcastTvAnnouncement: async (broadcast) => {
    const payload: TvBroadcast = {
      id: generateId(),
      createdAt: new Date().toISOString(),
      ...broadcast
    };
    const sessionId = get().currentSessionId;
    if (!sessionId) {
      pushToast(set, "Broadcast failed", "No active session is selected.", "system");
      return;
    }
    try {
      if (useSupabaseData()) {
        const body = await broadcastTvState(sessionId, payload);
        if (!body) throw new Error("broadcast failed");
        markSyncHealthy(set, body.updatedAt);
      } else {
      const response = await apiFetch("/api/club-state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          broadcastOnly: true,
          tvBroadcast: payload
        })
      });
      if (!response.ok) throw new Error("broadcast failed");
      if (response.headers.get("content-type")?.includes("application/json")) {
        const body = await response.json();
        markSyncHealthy(set, typeof body.updatedAt === "string" ? body.updatedAt : null);
      }
      }
    } catch {
      pushToast(set, "Broadcast failed", "Could not reach the TV display sync server.", "system");
      return;
    }
    set({ tvBroadcast: payload });
    clubStateBroadcast?.postMessage({ type: "tv-broadcast", broadcast: payload, at: Date.now() });
  },
  processSyncQueue: async () => {
    if (!get().online) return;
    const pending = await db.syncQueue.where("status").equals("Pending").toArray();
    if (pending.length === 0) return;

    const ids = pending.map((item) => item.id);
    await db.syncQueue.where("id").anyOf(ids).modify({ status: "Syncing" });

    try {
      const operationSyncEnabled = (import.meta.env.VITE_OPERATION_EVENT_SYNC ?? "true") !== "false";
      const response = await apiFetch(operationSyncEnabled ? "/api/operations/events" : "/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          operationSyncEnabled
            ? pending.map((item) => ({ ...item, clientAt: item.createdAt }))
            : pending
        )
      });

      if (!response.ok) throw new Error("Sync response error");
      const result = await response.json();

      const syncedIds = (result.results ?? [])
        .filter((r: any) => r.status === "Synced")
        .map((r: any) => r.id);

      const failed = (result.results ?? [])
        .filter((r: any) => r.status === "Failed");
      const conflicts = (result.results ?? [])
        .filter((r: any) => r.status === "Conflict");

      if (syncedIds.length > 0) {
        await db.syncQueue.where("id").anyOf(syncedIds).delete();
      }

      for (const item of failed) {
        const queued = pending.find((entry) => entry.id === item.id);
        await db.syncQueue.update(item.id, {
          status: "Failed",
          retryCount: (queued?.retryCount ?? 0) + 1
        });
      }
      for (const item of conflicts) {
        await db.syncQueue.update(item.id, { status: "Conflict" });
      }
    } catch (e) {
      console.warn("Background sync connection failed (changes saved locally):", e);
      await db.syncQueue.where("id").anyOf(ids).modify({ status: "Pending" });
    } finally {
      const pendingSyncCount = await db.syncQueue.where("status").equals("Pending").count();
      set({ pendingSyncCount });
    }
  },

  // Player Actions
  checkIn: async (playerId, autoLog = true, byAdmin = false) => {
    get().suppressRefresh(6000);
    const existingPlayer = get().players.find((player) => player.id === playerId);
    if (!existingPlayer || existingPlayer.checkedIn) return;
    const newTags = byAdmin 
      ? [...(existingPlayer.tags ?? []).filter(t => t !== "AdminCheckedIn"), "AdminCheckedIn"]
      : (existingPlayer.tags ?? []).filter(t => t !== "AdminCheckedIn");
    const players = get().players.map((player) =>
      player.id === playerId ? { ...player, checkedIn: true, tags: newTags } : player
    );
    const player = players.find((item) => item.id === playerId);
    if (!player) return;
    await db.players.put(player);
    await queue("CHECK_IN_PLAYER", "Player", player.id, player);
    playSound("checkin");
    const toastMsg = `${player.displayName} is checked in${autoLog ? " and paid" : ""} — added to rotation.`;
    pushToast(set, "Player checked in", toastMsg, "fun");

    // Also update current session's checked-in list if there is an active session
    const currentSessionId = get().currentSessionId;
    if (currentSessionId) {
      const session = get().sessions.find((s) => s.id === currentSessionId);
      if (session && !session.checkedInPlayerIds.includes(playerId)) {
        const updatedSession = {
          ...session,
          checkedInPlayerIds: [...session.checkedInPlayerIds, playerId]
        };
        await db.sessions.put(updatedSession);
        await queue("UPDATE_SESSION", "Session", session.id, updatedSession);
        set((state) => ({
          sessions: state.sessions.map((s) => s.id === currentSessionId ? updatedSession : s)
        }));
      }
    }

    const baseOrder = [...get().stackOrder.filter(id => id !== playerId), playerId];
    const stackOrder = reconcileStackOrder(baseOrder, players, get().matches, get().courts);
    localStorage.setItem("haff-stack-order", JSON.stringify(stackOrder));
    set({ players, stackOrder });
    await get().publishSharedState({ force: true });

    if (autoLog) {
      await get().addTransaction({
        playerId,
        amount: 150,
        type: "CheckInFee",
        paymentMethod: "Cash"
      });
    }
  },
  checkOut: async (playerId) => {
    get().suppressRefresh(6000);
    const players = get().players.map((player) =>
      player.id === playerId 
        ? { 
            ...player, 
            checkedIn: false, 
            tags: (player.tags ?? []).filter(t => t !== "AdminCheckedIn") 
          } 
        : player
    );
    const player = players.find((item) => item.id === playerId);
    if (!player) return;
    await db.players.put(player);
    await queue("CHECK_OUT_PLAYER", "Player", player.id, player);
    pushToast(set, "Player checked out", `${player.displayName} is no longer in open play.`, "system");

    // Also update current session's checked-in list if there is an active session
    const currentSessionId = get().currentSessionId;
    if (currentSessionId) {
      const session = get().sessions.find((s) => s.id === currentSessionId);
      if (session && session.checkedInPlayerIds.includes(playerId)) {
        const updatedSession = {
          ...session,
          checkedInPlayerIds: session.checkedInPlayerIds.filter((id) => id !== playerId)
        };
        await db.sessions.put(updatedSession);
        await queue("UPDATE_SESSION", "Session", session.id, updatedSession);
        set((state) => ({
          sessions: state.sessions.map((s) => s.id === currentSessionId ? updatedSession : s)
        }));
      }
    }

    const baseOrder = get().stackOrder.filter((id) => id !== playerId);
    const stackOrder = reconcileStackOrder(baseOrder, players, get().matches, get().courts);
    localStorage.setItem("haff-stack-order", JSON.stringify(stackOrder));
    set({ players, stackOrder });
    await get().publishSharedState({ force: true });
  },
  checkOutAll: async () => {
    get().suppressRefresh(6000);
    const state = get();
    const checkedInPlayers = state.players.filter(p => p.checkedIn);
    if (checkedInPlayers.length === 0) return;

    const players = state.players.map(player => 
      player.checkedIn 
        ? { 
            ...player, 
            checkedIn: false, 
            tags: (player.tags ?? []).filter(t => t !== "AdminCheckedIn") 
          } 
        : player
    );

    const updatedPlayers = players.filter(p => checkedInPlayers.some(cip => cip.id === p.id));
    await db.players.bulkPut(updatedPlayers);
    for (const player of updatedPlayers) {
      await queue("CHECK_OUT_PLAYER", "Player", player.id, player);
    }
    pushToast(set, "All players checked out", `Checked out ${checkedInPlayers.length} players.`, "system");

    const currentSessionId = state.currentSessionId;
    if (currentSessionId) {
      const session = state.sessions.find((s) => s.id === currentSessionId);
      if (session) {
        const updatedSession = { ...session, checkedInPlayerIds: [] };
        await db.sessions.put(updatedSession);
        await queue("UPDATE_SESSION", "Session", session.id, updatedSession);
        set((s) => ({
          sessions: s.sessions.map((x) => x.id === currentSessionId ? updatedSession : x)
        }));
      }
    }

    const checkedOutIds = new Set(checkedInPlayers.map((p) => p.id));
    const baseOrder = state.stackOrder.filter((id) => !checkedOutIds.has(id));
    const stackOrder = reconcileStackOrder(baseOrder, players, state.matches, state.courts);
    localStorage.setItem("haff-stack-order", JSON.stringify(stackOrder));
    set({ players, stackOrder });
    await get().publishSharedState({ force: true });
  },
  movePlayerToIndex: async (playerId: string, targetIndex: number, byAdmin = false) => {
    if (!byAdmin) {
      pushToast(set, "Staff only", "Only admins can change the queue order.", "system");
      return;
    }
    // If player is on a court or playing, free them first
    const stateBefore = get();
    const isReserved = stateBefore.courts.some(c => c.reservedPlayerIds?.includes(playerId));
    const isPlaying = stateBefore.matches.some(m => m.status === "InProgress" && [...m.teamAPlayerIds, ...m.teamBPlayerIds].includes(playerId));
    
    if (isReserved || isPlaying) {
      await get().removePlayerFromCourt(playerId);
    }

    const state = get();
    const currentOrder = [...state.stackOrder];
    const oldIndex = currentOrder.indexOf(playerId);

    if (oldIndex === -1) {
      const player = state.players.find((p) => p.id === playerId);
      if (!player) return;

      // Check in / resume if needed
      let updatedPlayersList = state.players;
      if (!player.checkedIn) {
        const updatedPlayer = {
          ...player,
          checkedIn: true,
          tags: [...(player.tags ?? []).filter((t) => t !== "AdminCheckedIn"), "AdminCheckedIn"]
        };
        await db.players.put(updatedPlayer);
        await queue("CHECK_IN_PLAYER", "Player", player.id, updatedPlayer);
        
        const currentSessionId = state.currentSessionId;
        if (currentSessionId) {
          const session = state.sessions.find((s) => s.id === currentSessionId);
          if (session && !session.checkedInPlayerIds.includes(playerId)) {
            const updatedSession = {
              ...session,
              checkedInPlayerIds: [...session.checkedInPlayerIds, playerId]
            };
            await db.sessions.put(updatedSession);
            await queue("UPDATE_SESSION", "Session", session.id, updatedSession);
            set((s) => ({
              sessions: s.sessions.map((x) => x.id === currentSessionId ? updatedSession : x)
            }));
          }
        }
        updatedPlayersList = state.players.map((p) => p.id === playerId ? updatedPlayer : p);
        set({ players: updatedPlayersList });
      }
      if (targetIndex < currentOrder.length && (currentOrder[targetIndex] === "vacant" || currentOrder[targetIndex] === "reserved")) {
        currentOrder[targetIndex] = playerId;
      } else {
        currentOrder.splice(targetIndex, 0, playerId);
      }
    } else if (oldIndex === targetIndex) {
      // no-op
    } else {
      currentOrder.splice(oldIndex, 1);
      const insertAt = targetIndex > oldIndex ? targetIndex - 1 : targetIndex;
      if (insertAt < currentOrder.length && (currentOrder[insertAt] === "vacant" || currentOrder[insertAt] === "reserved")) {
        currentOrder[insertAt] = playerId;
      } else {
        currentOrder.splice(insertAt, 0, playerId);
      }
    }

    const latest = get();
    const stackOrder = reconcileStackOrder(currentOrder, latest.players, latest.matches, latest.courts);
    localStorage.setItem("haff-stack-order", JSON.stringify(stackOrder));
    set({ stackOrder });
    await get().publishSharedState({ force: true });
  },
  moveStackToIndex: async (fromGroupIndex, toGroupIndex) => {
    const state = get();
    const groups = splitStackGroups(state.stackOrder);
    if (fromGroupIndex < 0 || fromGroupIndex >= groups.length) return;
    const target = Math.max(0, Math.min(toGroupIndex, groups.length - 1));
    if (fromGroupIndex === target) return;
    const [moved] = groups.splice(fromGroupIndex, 1);
    groups.splice(target, 0, moved);
    const stackOrder = reconcileStackOrder(
      flattenStackGroups(groups),
      state.players,
      state.matches,
      state.courts,
      { autoAppendMissing: false }
    );
    localStorage.setItem("haff-stack-order", JSON.stringify(stackOrder));
    set({ stackOrder });
    await get().publishSharedState();
  },
  removeStackAtIndex: async (groupIndex) => {
    const state = get();
    const groups = splitStackGroups(state.stackOrder);
    if (groupIndex < 0 || groupIndex >= groups.length) return;
    const removed = groups[groupIndex] ?? [];
    const removedPlayers = removed.filter((id) => id !== "vacant" && id !== "reserved");
    groups.splice(groupIndex, 1);
    const stackOrder = reconcileStackOrder(
      flattenStackGroups(groups),
      state.players,
      state.matches,
      state.courts,
      { autoAppendMissing: removedPlayers.length > 0 }
    );
    localStorage.setItem("haff-stack-order", JSON.stringify(stackOrder));
    set({ stackOrder });
    await get().publishSharedState();
    const label = groupIndex === 0 ? "Stack Next" : `Stack ${groupIndex}`;
    if (removedPlayers.length > 0) {
      pushToast(set, "Stack removed", `${label} deleted. ${removedPlayers.length} player(s) moved back into rotation.`, "system");
    } else {
      pushToast(set, "Stack removed", `${label} deleted.`, "system");
    }
  },
  addEmptyStack: async () => {
    const state = get();
    const nextOrder = [...state.stackOrder, "vacant", "vacant", "vacant", "vacant"];
    const stackOrder = reconcileStackOrder(nextOrder, state.players, state.matches, state.courts, {
      autoAppendMissing: false
    });
    localStorage.setItem("haff-stack-order", JSON.stringify(stackOrder));
    set({ stackOrder });
    await get().publishSharedState();
  },
  setStackSlotKind: async (slotIndex, kind) => {
    const state = get();
    const order = [...state.stackOrder];
    while (order.length <= slotIndex) {
      order.push("vacant");
    }
    const current = order[slotIndex];
    if (current !== "vacant" && current !== "reserved") return;
    order[slotIndex] = kind;
    const stackOrder = reconcileStackOrder(order, state.players, state.matches, state.courts, {
      autoAppendMissing: false
    });
    localStorage.setItem("haff-stack-order", JSON.stringify(stackOrder));
    set({ stackOrder });
    await get().publishSharedState();
  },
  addPlayer: async (playerData) => {
    const newPlayer: Player = {
      ...playerData,
      id: `player-${generateId()}`,
      checkedIn: false,
      totalGamesPlayed: 0,
      totalDaysPlayed: 0
    };
    await db.players.put(newPlayer);
    await queue("CREATE_PLAYER", "Player", newPlayer.id, newPlayer);
    const players = [...get().players, newPlayer];
    set({ players });
    pushToast(set, "Player added", `${newPlayer.displayName} has been added.`, "system");
    await get().publishSharedState({ force: true });
  },
  updatePlayer: async (player) => {
    await db.players.put(player);
    await queue("UPDATE_PLAYER", "Player", player.id, player);
    const players = get().players.map((p) => p.id === player.id ? player : p);
    const stackOrder = reconcileStackOrder(get().stackOrder, players, get().matches, get().courts);
    localStorage.setItem("haff-stack-order", JSON.stringify(stackOrder));
    set({ players, stackOrder });
    await get().publishSharedState();
  },
  deletePlayer: async (playerId) => {
    const player = get().players.find((p) => p.id === playerId);
    if (!player) return;
    const updatedPlayer = { ...player, isActive: false, checkedIn: false };
    await db.players.put(updatedPlayer);
    await queue("UPDATE_PLAYER", "Player", playerId, updatedPlayer);
    const players = get().players.map((p) => p.id === playerId ? updatedPlayer : p);
    const stackOrder = reconcileStackOrder(get().stackOrder, players, get().matches, get().courts);
    localStorage.setItem("haff-stack-order", JSON.stringify(stackOrder));
    set({ players, stackOrder });
    pushToast(set, "Player archived", `${player.displayName} has been deactivated.`, "system");
  },

  // Court Actions
  addCourt: async (courtData) => {
    const existing = get().courts;
    if (existing.length >= MAX_COURTS) {
      pushToast(set, "Court limit reached", `HAFF runs ${MAX_COURTS} courts. Remove one before adding another.`, "system");
      return;
    }
    const maxPriority = existing.reduce((max, c) => Math.max(max, c.priority ?? c.number), 0);
    const newCourt: Court = {
      ...courtData,
      id: `court-${generateId()}`,
      status: "Available",
      priority: courtData.priority ?? maxPriority + 1,
      reservable: courtData.reservable ?? true
    };
    await db.courts.put(newCourt);
    await queue("CREATE_COURT", "Court", newCourt.id, newCourt);
    const courts = [...get().courts, newCourt];
    set({ courts });
    pushToast(set, "Court added", `${newCourt.name} has been added.`, "system");
  },
  updateCourt: async (court) => {
    await db.courts.put(court);
    await queue("UPDATE_COURT", "Court", court.id, court);
    const courts = get().courts.map((c) => c.id === court.id ? court : c);
    const stackOrder = reconcileStackOrder(get().stackOrder, get().players, get().matches, courts);
    localStorage.setItem("haff-stack-order", JSON.stringify(stackOrder));
    set({ courts, stackOrder });
    pushToast(set, "Court updated", `${court.name} has been updated.`, "system");
    await get().publishSharedState();
  },
  deleteCourt: async (courtId) => {
    const court = get().courts.find((c) => c.id === courtId);
    if (!court) return;
    
    // Cancel all active reservations for this court
    const reservationsToCancel = get().reservations.filter(
      (r) => r.courtId === courtId && ["Requested", "Confirmed"].includes(r.status)
    );
    for (const reservation of reservationsToCancel) {
      await get().updateReservation(reservation.id, {
        status: "Cancelled",
        cancellationReason: `Court ${court.name} was deleted`
      });
    }
    
    // Complete any active match on this court
    const activeMatch = get().matches.find(
      (m) => m.courtId === courtId && m.status === "InProgress"
    );
    if (activeMatch) {
      const completedMatch = { ...activeMatch, status: "Completed" as const, endTime: new Date().toISOString() };
      await db.matches.put(completedMatch);
      await queue("UPDATE_MATCH", "Match", activeMatch.id, completedMatch);
      set({ matches: get().matches.map((m) => m.id === activeMatch.id ? completedMatch : m) });
    }
    
    await db.courts.delete(courtId);
    await queue("DELETE_COURT", "Court", courtId, { id: courtId });
    const courts = get().courts.filter((c) => c.id !== courtId);
    const stackOrder = reconcileStackOrder(get().stackOrder, get().players, get().matches, courts);
    localStorage.setItem("haff-stack-order", JSON.stringify(stackOrder));
    set({ courts, stackOrder });
    pushToast(set, "Court deleted", `${court.name} has been deleted.`, "system");
    await get().publishSharedState();
  },
  reorderCourts: async (courtId, targetIndex) => {
    const sorted = sortCourts(get().courts);
    const fromIndex = sorted.findIndex((c) => c.id === courtId);
    if (fromIndex === -1 || fromIndex === targetIndex) return;
    const reordered = [...sorted];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(targetIndex, 0, moved);
    const courts = reordered.map((court, index) => ({ ...court, number: index + 1, priority: index + 1 }));
    await db.courts.bulkPut(courts);
    for (const court of courts) {
      await queue("UPDATE_COURT", "Court", court.id, court);
    }
    set({ courts });
    pushToast(set, "Court order updated", "Court priority has been saved.", "system");
    await get().publishSharedState();
  },

  // Session Actions
  addSession: async (sessionData) => {
    const newSession: Session = {
      ...sessionData,
      id: `session-${generateId()}`
    };
    await db.sessions.put(newSession);
    await queue("CREATE_SESSION", "Session", newSession.id, newSession);
    const sessions = [...get().sessions, newSession];
    let currentSessionId = get().currentSessionId;
    if (!currentSessionId) {
      currentSessionId = newSession.id;
      localStorage.setItem("haff-current-session-id", currentSessionId);
    }
    set({ sessions, currentSessionId });
    pushToast(set, "Session created", `${newSession.name} has been created.`, "system");
  },
  updateSession: async (session) => {
    await db.sessions.put(session);
    await queue("UPDATE_SESSION", "Session", session.id, session);
    const sessions = get().sessions.map((s) => s.id === session.id ? session : s);
    set({ sessions });
    pushToast(set, "Session updated", `${session.name} has been updated.`, "system");
  },
  deleteSession: async (sessionId) => {
    const session = get().sessions.find((s) => s.id === sessionId);
    if (!session) return;
    await db.sessions.delete(sessionId);
    await queue("DELETE_SESSION", "Session", sessionId, { id: sessionId });
    const sessions = get().sessions.filter((s) => s.id !== sessionId);
    let currentSessionId = get().currentSessionId;
    if (currentSessionId === sessionId) {
      currentSessionId = sessions[0]?.id ?? null;
      if (currentSessionId) {
        localStorage.setItem("haff-current-session-id", currentSessionId);
      } else {
        localStorage.removeItem("haff-current-session-id");
      }
    }
    set({ sessions, currentSessionId });
    pushToast(set, "Session deleted", `${session.name} has been deleted.`, "system");
  },
  setCurrentSessionId: async (sessionId) => {
    if (sessionId) {
      localStorage.setItem("haff-current-session-id", sessionId);
    } else {
      localStorage.removeItem("haff-current-session-id");
    }
    set({ currentSessionId: sessionId });
  },
  startNewSession: async (name) => {
    const state = get();
    // 1. Clear active courts
    const updatedCourts = state.courts.map((c) => ({
      ...c,
      status: "Available" as const,
      currentMatchId: undefined,
      reservedFor: undefined,
      reservedPlayerIds: undefined
    }));
    await db.courts.bulkPut(updatedCourts);

    // 2. Clear checked-in status of all players
    const updatedPlayers = state.players.map((p) => ({
      ...p,
      checkedIn: false
    }));
    await db.players.bulkPut(updatedPlayers);

    // 3. Create a new active session
    const newSession: Session = {
      id: `session-${generateId()}`,
      name: name || `Open Play - ${new Date().toLocaleDateString()}`,
      date: new Date().toISOString().split("T")[0],
      startTime: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "Active",
      mode: "Open Play",
      courtIds: updatedCourts.map((c) => c.id),
      checkedInPlayerIds: [],
      settings: {}
    };
    await db.sessions.put(newSession);
    await queue("CREATE_SESSION", "Session", newSession.id, newSession);

    const sessions = [...state.sessions, newSession];
    const currentSessionId = newSession.id;
    localStorage.setItem("haff-current-session-id", currentSessionId);
    
    // Clear stacks
    const stackOrder: string[] = [];
    localStorage.setItem("haff-stack-order", "[]");

    set({
      courts: updatedCourts,
      players: updatedPlayers,
      sessions,
      currentSessionId,
      stackOrder
    });

    pushToast(set, "New Session Started", `${newSession.name} is now active.`, "system");
  },
  endSession: async (force = false) => {
    const state = get();
    const currentSessionId = state.currentSessionId;
    if (!currentSessionId) return { success: false };

    const activeSession = state.sessions.find((s) => s.id === currentSessionId);
    if (!activeSession) return { success: false };

    const activeCourts = state.courts.filter((c) => c.status === "InUse" || c.status === "Reserved");
    if (activeCourts.length > 0 && !force) {
      return { hasActiveCourts: true };
    }

    // Finish all active/reserved courts
    const updatedCourts = state.courts.map((court) => ({
      ...court,
      status: "Available" as const,
      currentMatchId: undefined,
      reservedFor: undefined,
      reservedPlayerIds: undefined
    }));
    await db.courts.bulkPut(updatedCourts);

    // Mark session as completed
    const updatedSession: Session = {
      ...activeSession,
      status: "Completed",
      endTime: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };
    await db.sessions.put(updatedSession);
    await queue("UPDATE_SESSION", "Session", updatedSession.id, updatedSession);

    // Clear checked-in status of all players
    const updatedPlayers = state.players.map((p) => ({
      ...p,
      checkedIn: false
    }));
    await db.players.bulkPut(updatedPlayers);

    const sessions = state.sessions.map((s) => (s.id === currentSessionId ? updatedSession : s));

    localStorage.removeItem("haff-current-session-id");
    localStorage.setItem("haff-stack-order", "[]");

    set({
      sessions,
      currentSessionId: null,
      courts: updatedCourts,
      players: updatedPlayers,
      stackOrder: []
    });

    pushToast(set, "Session Ended", `${activeSession.name} has been completed.`, "system");
    return { success: true };
  },
  returnReservedToQueue: async (courtId) => {
    const state = get();
    const court = state.courts.find((c) => c.id === courtId);
    if (!court || !court.reservedPlayerIds || court.reservedPlayerIds.length === 0) return;

    const reservedIds = court.reservedPlayerIds;
    const keepReservedMode = court.reservedFor === "Reserved game";

    // Put them back at the front of the stackOrder
    const currentOrder = get().stackOrder.filter((id) => !reservedIds.includes(id));
    const nextOrder = [...reservedIds, ...currentOrder];

    const courts = state.courts.map((c) =>
      c.id === courtId
        ? keepReservedMode
          ? {
              ...c,
              status: "Reserved" as const,
              reservedFor: "Reserved game",
              reservedPlayerIds: undefined
            }
          : {
              ...c,
              status: "Available" as const,
              reservedFor: undefined,
              reservedPlayerIds: undefined
            }
        : c
    );
    const updatedCourt = courts.find((c) => c.id === courtId)!;
    await db.courts.put(updatedCourt);
    await queue("UPDATE_COURT", "Court", courtId, updatedCourt);

    const stackOrder = reconcileStackOrder(nextOrder, state.players, state.matches, courts);
    localStorage.setItem("haff-stack-order", JSON.stringify(stackOrder));
    set({ courts, stackOrder });
    pushToast(set, "Returned to queue", "Players returned to front of waiting queue.", "system");
    await get().publishSharedState();
  },

  // Game/Match Actions
  generateMatches: async () => {
    const state = get();
    const availableCourts = sortCourts(state.courts).filter((court) => court.status === "Available");
    if (availableCourts.length === 0) return;

    const newMatches: Match[] = [];
    const updatedCourts = [...state.courts];
    let currentOrder = [...state.stackOrder];

    for (const court of availableCourts) {
      if (currentOrder.length < 4) break;
      const nextFourIds = currentOrder.slice(0, 4);

      const stackPlayers = nextFourIds
        .map(id => state.players.find(p => p.id === id))
        .filter((p): p is Player => Boolean(p && p.checkedIn));

      if (stackPlayers.length >= 2) {
        const teams = balanceTeams(stackPlayers);
        const match: Match = {
          id: generateId(),
          courtId: court.id,
          teamAPlayerIds: teams.a.map((player) => player.id),
          teamBPlayerIds: teams.b.map((player) => player.id),
          scoreA: 0,
          scoreB: 0,
          status: "InProgress",
          startedAt: new Date().toISOString(),
          syncStatus: "PendingSync"
        };
        newMatches.push(match);
        const index = updatedCourts.findIndex((item) => item.id === court.id);
        updatedCourts[index] = { ...court, status: "InUse", currentMatchId: match.id };
        currentOrder = currentOrder.slice(4);
      } else {
        currentOrder = currentOrder.slice(4);
      }
    }

    if (newMatches.length > 0) {
      await db.matches.bulkPut(newMatches);
      await db.courts.bulkPut(updatedCourts);
      for (const match of newMatches) {
        await queue("CREATE_MATCH", "Match", match.id, match);
        const c = updatedCourts.find((x) => x.id === match.courtId);
        if (c) {
          await queue("UPDATE_COURT", "Court", c.id, c);
          const names = [...match.teamAPlayerIds, ...match.teamBPlayerIds]
            .map(id => state.players.find(p => p.id === id)?.displayName)
            .filter((name): name is string => Boolean(name));
          const list = names.length > 0 ? names.join(", ") : "players";
          speakAnnouncement(`Next players for ${c.name}: ${list}. Please proceed to your court.`);
        }
      }
      pushToast(set, "Courts assigned", `${newMatches.length} match${newMatches.length === 1 ? "" : "es"} sent to court.`, "system");
    }

    const matches = [...state.matches, ...newMatches];
    const stackOrder = reconcileStackOrder(currentOrder, state.players, matches, updatedCourts);
    localStorage.setItem("haff-stack-order", JSON.stringify(stackOrder));
    set({ matches, courts: updatedCourts, stackOrder });
    await get().publishSharedState();
  },
  reserveCourt: async (courtId) => {
    const state = get();
    const currentOrder = [...state.stackOrder];
    
    let targetStackIndex = -1;
    let nextFourIds: string[] = [];
    const numStacks = Math.ceil(currentOrder.length / 4);
    
    for (let i = 0; i < numStacks; i++) {
      const slice = currentOrder.slice(i * 4, i * 4 + 4);
      if (slice.length === 4 && slice.every((id) => id !== "vacant" && id !== "reserved")) {
        targetStackIndex = i;
        nextFourIds = slice;
        break;
      }
    }

    if (targetStackIndex === -1) {
      pushToast(set, "No complete stack", "No complete stack of 4 players is available to assign.", "system");
      return;
    }

    const nextStack = nextFourIds
      .map((id) => state.players.find((player) => player.id === id))
      .filter((player): player is Player =>
        Boolean(player && player.checkedIn)
      );

    const reservedFor = nextStack.length ? nextStack.map((player) => player.displayName.split(" ")[0]).join(" / ") : "Admin hold";
    const courts = state.courts.map((court) =>
      court.id === courtId
        ? {
            ...court,
            status: "Reserved" as const,
            currentMatchId: undefined,
            reservedFor,
            reservedPlayerIds: nextStack.map((player) => player.id)
          }
        : court
    );
    const court = courts.find((item) => item.id === courtId);
    if (!court) return;
    await db.courts.put(court);
    await queue("UPDATE_COURT", "Court", court.id, court);
    pushToast(set, "Court reserved", `${court.name} is held for ${reservedFor}.`, "system");
    
    const remainingOrder = [...currentOrder];
    remainingOrder.splice(targetStackIndex * 4, 4);
    
    const stackOrder = reconcileStackOrder(remainingOrder, state.players, state.matches, courts);
    localStorage.setItem("haff-stack-order", JSON.stringify(stackOrder));
    set({ courts, stackOrder });
    await get().publishSharedState();
  },
  clearCourt: async (courtId) => {
    const courts = get().courts.map((court) =>
      court.id === courtId
        ? {
            ...court,
            status: "Available" as const,
            currentMatchId: undefined,
            reservedFor: undefined,
            reservedPlayerIds: undefined
          }
        : court
    );
    const court = courts.find((item) => item.id === courtId);
    if (!court) return;
    await db.courts.put(court);
    await queue("UPDATE_COURT", "Court", court.id, court);
    pushToast(set, "Court available", `${court.name} is back in rotation.`, "system");
    const stackOrder = reconcileStackOrder(get().stackOrder, get().players, get().matches, courts);
    localStorage.setItem("haff-stack-order", JSON.stringify(stackOrder));
    set({ courts, stackOrder });
    await get().publishSharedState();
  },
  startReservedCourt: async (courtId) => {
    const state = get();
    const court = state.courts.find((item) => item.id === courtId);
    const stack = (court?.reservedPlayerIds ?? [])
      .map((id) => state.players.find((player) => player.id === id))
      .filter((player): player is Player => Boolean(player));
    if (!court) return;
    if (stack.length === 0) {
      pushToast(set, "No players assigned", "Add players to this court before starting.", "system");
      return;
    }
    const teams = stack.length > 0 ? balanceTeams(stack) : { a: [], b: [] };
    const match: Match = {
      id: generateId(),
      courtId: court.id,
      mode: "Reserved",
      teamAPlayerIds: teams.a.map((player) => player.id),
      teamBPlayerIds: teams.b.map((player) => player.id),
      scoreA: 0,
      scoreB: 0,
      status: "InProgress",
      startedAt: new Date().toISOString(),
      syncStatus: "PendingSync"
    };
    const courts = state.courts.map((item) =>
      item.id === courtId
        ? {
            ...item,
            status: "InUse" as const,
            currentMatchId: match.id,
            reservedFor: undefined,
            reservedPlayerIds: undefined
          }
        : item
    );
    const updatedCourt = courts.find((item) => item.id === courtId);
    await db.matches.put(match);
    await db.courts.bulkPut(courts);
    await queue("START_RESERVED_STACK", "Match", match.id, match);
    if (updatedCourt) {
      await queue("UPDATE_COURT", "Court", updatedCourt.id, updatedCourt);
    }
    
    // Announce reserved stack start
    if (stack.length > 0) {
      const list = stack.map(p => p.displayName).join(", ");
      speakAnnouncement(`Next players for ${court.name}: ${list}. Please proceed to your court.`);
    } else {
      speakAnnouncement(`${court.name} is now open play.`);
    }
    
    pushToast(set, "Reserved stack started", `${court.name} is now playing ${court.reservedFor || "open play"}.`, "system");
    const matches = [...state.matches, match];
    const stackOrder = reconcileStackOrder(state.stackOrder, state.players, matches, courts);
    localStorage.setItem("haff-stack-order", JSON.stringify(stackOrder));
    set({ matches, courts, stackOrder });
    await get().publishSharedState();
  },
  finishCourt: async (courtId) => {
    get().suppressRefresh(15000);
    const state = get();
    const court = state.courts.find((item) => item.id === courtId);
    const match = state.matches.find((item) => item.id === court?.currentMatchId);
    if (!court || !match) return;
    const playedToday = todayKey();
    const participantIds = [...match.teamAPlayerIds, ...match.teamBPlayerIds];
    const players = state.players.map((player) => {
      if (!participantIds.includes(player.id)) return player;
      const firstGameToday = player.lastPlayedDate !== playedToday;
      return {
        ...player,
        totalGamesPlayed: player.totalGamesPlayed + 1,
        totalDaysPlayed: player.totalDaysPlayed + (firstGameToday ? 1 : 0),
        lastPlayedDate: playedToday
      };
    });
    const completed = {
      ...match,
      status: "Completed" as const,
      endedAt: new Date().toISOString(),
      syncStatus: "PendingSync" as const
    };
    let matches = state.matches.map((item) => (item.id === match.id ? completed : item));
    let courts = state.courts.map((item) =>
      item.id === courtId
        ? {
            ...item,
            status: "Available" as const,
            currentMatchId: undefined,
            reservedFor: undefined,
            reservedPlayerIds: undefined
        }
        : item
    );
    const finishedPlayerIds = new Set(
      participantIds.filter((id) => id !== "vacant" && !id.startsWith("vacant"))
    );
    const baseOrder = state.stackOrder.filter(
      (id) => id === "vacant" || !finishedPlayerIds.has(id)
    );
    const updatedCourt = courts.find((item) => item.id === courtId);
    try {
      await db.players.bulkPut(players);
      await db.matches.put(completed);
      await db.courts.bulkPut(courts);
      await queue("FINISH_COURT", "Match", completed.id, completed);
      if (updatedCourt) {
        await queue("UPDATE_COURT", "Court", updatedCourt.id, updatedCourt);
      }
    } catch (err) {
      console.error("Failed to write finished court to DB, falling back to local memory:", err);
    }
    const stackOrder = reconcileStackOrder(baseOrder, players, matches, courts, {
      autoAppendMissing: false
    });
    localStorage.setItem("haff-stack-order", JSON.stringify(stackOrder));
    set({ players, matches, courts, stackOrder });
    pushToast(
      set,
      "Court available",
      `${court.name} is open. Finished players were not re-queued — add them manually when ready.`,
      "system"
    );
    await get().publishSharedState();
  },
  updateMatchScores: async (matchId, scoreA, scoreB) => {
    const state = get();
    const match = state.matches.find((m) => m.id === matchId);
    if (!match) return;
    const updated = {
      ...match,
      scoreA,
      scoreB,
      syncStatus: "PendingSync" as const
    };
    await db.matches.put(updated);
    await queue("UPDATE_MATCH", "Match", matchId, updated);
    
    set({
      matches: state.matches.map((m) => (m.id === matchId ? updated : m))
    });
    await get().publishSharedState();
  },
  submitMatchFeedback: async (matchId, reviewerId, reviewerName, scoreA, scoreB, recommendations) => {
    const state = get();
    const match = state.matches.find((item) => item.id === matchId);
    if (!match) return;

    const entries: PlayerKudosEntry[] = [];
    for (const [toPlayerId, rec] of Object.entries(recommendations)) {
      if (!rec.pills.length && !rec.note?.trim()) continue;
      entries.push({
        id: `${matchId}:${reviewerId}:${toPlayerId}`,
        matchId,
        fromPlayerId: reviewerId,
        fromPlayerName: reviewerName,
        toPlayerId,
        pills: rec.pills,
        note: rec.note?.trim() || undefined,
        createdAt: new Date().toISOString(),
      });
    }

    const review: MatchReviewRecord = {
      matchId,
      reviewerId,
      scoreA,
      scoreB,
      reviewedAt: new Date().toISOString(),
    };

    const updatedMatch = { ...match, scoreA, scoreB, syncStatus: "PendingSync" as const };
    await db.matches.put(updatedMatch);
    await queue("UPDATE_MATCH", "Match", matchId, updatedMatch);

    const playerKudos = mergeKudosById(state.playerKudos, entries);
    const matchReviews = mergeReviewsByKey(
      state.matchReviews.filter((item) => !(item.matchId === matchId && item.reviewerId === reviewerId)),
      [review]
    );

    set({
      matches: state.matches.map((item) => (item.id === matchId ? updatedMatch : item)),
      playerKudos,
      matchReviews,
    });
    persistKudosLocal(playerKudos, matchReviews);
    window.dispatchEvent(new Event("haff-endorsements-updated"));
    await get().publishSharedState();
  },
  assignPlayerToCourt: async (playerId, courtId) => {
    const state = get();
    const player = state.players.find((p) => p.id === playerId);
    const court = state.courts.find((c) => c.id === courtId);
    if (!player || !court) return;

    const activeMatchIds = new Set(
      state.matches.filter((m) => m.status === "InProgress").flatMap((m) => [...m.teamAPlayerIds, ...m.teamBPlayerIds])
    );
    if (activeMatchIds.has(playerId)) {
      pushToast(set, "Player is playing", `${player.displayName} is currently in a match.`, "system");
      return;
    }

    let updatedPlayers = state.players;
    if (!player.checkedIn) {
      const updatedPlayer = {
        ...player,
        checkedIn: true,
        tags: [...(player.tags ?? []).filter((t) => t !== "AdminCheckedIn"), "AdminCheckedIn"]
      };
      await db.players.put(updatedPlayer);
      await queue("CHECK_IN_PLAYER", "Player", player.id, updatedPlayer);
      
      const currentSessionId = state.currentSessionId;
      if (currentSessionId) {
        const session = state.sessions.find((s) => s.id === currentSessionId);
        if (session && !session.checkedInPlayerIds.includes(playerId)) {
          const updatedSession = {
            ...session,
            checkedInPlayerIds: [...session.checkedInPlayerIds, playerId]
          };
          await db.sessions.put(updatedSession);
          await queue("UPDATE_SESSION", "Session", session.id, updatedSession);
          set({
            sessions: state.sessions.map((x) => x.id === currentSessionId ? updatedSession : x)
          });
        }
      }
      updatedPlayers = state.players.map((p) => p.id === playerId ? updatedPlayer : p);
    }

    const updatedCourts = state.courts.map((c) => {
      if (c.reservedPlayerIds?.includes(playerId)) {
        const nextReserved = c.reservedPlayerIds.filter((id) => id !== playerId);
        const nextStatus = nextReserved.length === 0
          ? (c.reservedFor === "Reserved game" ? "Reserved" : "Available")
          : c.status;
        return {
          ...c,
          reservedPlayerIds: nextReserved.length > 0 ? nextReserved : undefined,
          status: nextStatus as Court["status"]
        };
      }
      return c;
    });

    const targetCourtIndex = updatedCourts.findIndex((c) => c.id === courtId);
    if (targetCourtIndex !== -1) {
      const targetCourt = updatedCourts[targetCourtIndex];
      const existingReserved = targetCourt.reservedPlayerIds || [];
      if (!existingReserved.includes(playerId)) {
        const nextReserved = [...existingReserved, playerId];
        const reservedFor = nextReserved
          .map((id) => updatedPlayers.find((player) => player.id === id)?.displayName.split(" ")[0])
          .filter(Boolean)
          .join(" / ") || targetCourt.reservedFor || "Reserved game";
        updatedCourts[targetCourtIndex] = {
          ...targetCourt,
          reservedPlayerIds: nextReserved,
          status: "Reserved",
          reservedFor
        };
      }
    }

    for (const c of updatedCourts) {
      const oldC = state.courts.find((o) => o.id === c.id);
      if (JSON.stringify(oldC) !== JSON.stringify(c)) {
        await db.courts.put(c);
        await queue("UPDATE_COURT_STATUS", "Court", c.id, c);
      }
    }

    const remainingOrder = get().stackOrder.filter((id) => id !== playerId);
    const stackOrder = reconcileStackOrder(remainingOrder, updatedPlayers, state.matches, updatedCourts);
    localStorage.setItem("haff-stack-order", JSON.stringify(stackOrder));

    set({ players: updatedPlayers, courts: updatedCourts, stackOrder });
    pushToast(set, "Player assigned to court", `${player.displayName} assigned to ${court.name}.`, "fun");
    speakAnnouncement(`${player.displayName} assigned to ${court.name}.`);
  },
  removePlayerFromCourt: async (playerId) => {
    const state = get();
    const player = state.players.find((p) => p.id === playerId);
    if (!player) return;

    let updatedCourts = state.courts;
    let courtUpdated = false;
    updatedCourts = state.courts.map((c) => {
      if (c.reservedPlayerIds?.includes(playerId)) {
        courtUpdated = true;
        const nextReserved = c.reservedPlayerIds.filter((id) => id !== playerId);
        const nextStatus = nextReserved.length === 0
          ? (c.reservedFor === "Reserved game" ? "Reserved" : "Available")
          : c.status;
        return {
          ...c,
          reservedPlayerIds: nextReserved.length > 0 ? nextReserved : undefined,
          status: nextStatus as Court["status"]
        };
      }
      return c;
    });

    // Handle removing player from active InProgress match
    const activeMatchIndex = state.matches.findIndex((m) => m.status === "InProgress" && [...m.teamAPlayerIds, ...m.teamBPlayerIds].includes(playerId));
    let updatedMatches = state.matches;
    if (activeMatchIndex !== -1) {
      const match = state.matches[activeMatchIndex];
      const vacantId = `vacant-${generateId()}`;
      const newTeamA = match.teamAPlayerIds.map(id => id === playerId ? vacantId : id);
      const newTeamB = match.teamBPlayerIds.map(id => id === playerId ? vacantId : id);
      
      const allVacant = [...newTeamA, ...newTeamB].every(id => id.startsWith("vacant"));
      if (allVacant) {
        const completedMatch = {
          ...match,
          teamAPlayerIds: newTeamA,
          teamBPlayerIds: newTeamB,
          status: "Completed" as const,
          endedAt: new Date().toISOString()
        };
        updatedMatches = state.matches.map(m => m.id === match.id ? completedMatch : m);
        await db.matches.put(completedMatch);
        await queue("UPDATE_MATCH", "Match", match.id, completedMatch);
        
        updatedCourts = updatedCourts.map(c => {
          if (c.currentMatchId === match.id) {
            courtUpdated = true;
            return { ...c, status: "Available", currentMatchId: undefined } as Court;
          }
          return c;
        });
      } else {
        const updatedMatch = {
          ...match,
          teamAPlayerIds: newTeamA,
          teamBPlayerIds: newTeamB
        };
        updatedMatches = state.matches.map(m => m.id === match.id ? updatedMatch : m);
        await db.matches.put(updatedMatch);
        await queue("UPDATE_MATCH", "Match", match.id, updatedMatch);
      }
    }

    if (courtUpdated) {
      for (const c of updatedCourts) {
        const oldC = state.courts.find((o) => o.id === c.id);
        if (JSON.stringify(oldC) !== JSON.stringify(c)) {
          await db.courts.put(c);
          await queue("UPDATE_COURT_STATUS", "Court", c.id, c);
        }
      }
    }

    // Remove from stackOrder (replace with "vacant")
    let nextStackOrder = [...get().stackOrder];
    let orderUpdated = false;
    const oldIndex = nextStackOrder.indexOf(playerId);
    if (oldIndex !== -1) {
      nextStackOrder[oldIndex] = "vacant";
      orderUpdated = true;
    }

    const stackOrder = reconcileStackOrder(nextStackOrder, state.players, updatedMatches, updatedCourts);
    localStorage.setItem("haff-stack-order", JSON.stringify(stackOrder));
    set({ courts: updatedCourts, stackOrder, matches: updatedMatches });
    
    pushToast(set, "Player returned to lounge", `${player.displayName} returned to check-in lounge queue.`, "system");
    await get().publishSharedState();
  },
  joinActiveMatch: async (playerId, courtId) => {
    const state = get();
    const court = state.courts.find(c => c.id === courtId);
    if (!court || court.status !== "InUse") return;
    
    const match = state.matches.find(m => m.id === court.currentMatchId && m.status === "InProgress");
    if (!match) return;
    
    const vacantIndexA = match.teamAPlayerIds.findIndex(id => id.startsWith("vacant"));
    const vacantIndexB = match.teamBPlayerIds.findIndex(id => id.startsWith("vacant"));
    if (vacantIndexA === -1 && vacantIndexB === -1) return;

    // Free player from previous courts/stacks first
    const isReserved = state.courts.some(c => c.reservedPlayerIds?.includes(playerId));
    const isPlaying = state.matches.some(m => m.status === "InProgress" && [...m.teamAPlayerIds, ...m.teamBPlayerIds].includes(playerId));
    if (isReserved || isPlaying) {
      await get().removePlayerFromCourt(playerId);
    }
    
    const freshState = get();
    const freshMatch = freshState.matches.find(m => m.id === match.id);
    if (!freshMatch) return;

    let updatedMatch = { ...freshMatch };
    if (vacantIndexA !== -1) {
      const newTeamA = [...freshMatch.teamAPlayerIds];
      newTeamA[vacantIndexA] = playerId;
      updatedMatch.teamAPlayerIds = newTeamA;
    } else if (vacantIndexB !== -1) {
      const newTeamB = [...freshMatch.teamBPlayerIds];
      newTeamB[vacantIndexB] = playerId;
      updatedMatch.teamBPlayerIds = newTeamB;
    }

    await db.matches.put(updatedMatch);
    await queue("UPDATE_MATCH", "Match", freshMatch.id, updatedMatch);
    
    const remainingOrder = freshState.stackOrder.filter((id) => id !== playerId);
    const stackOrder = reconcileStackOrder(remainingOrder, freshState.players, [...freshState.matches.filter(m => m.id !== freshMatch.id), updatedMatch], freshState.courts);
    localStorage.setItem("haff-stack-order", JSON.stringify(stackOrder));
    
    set({
      matches: freshState.matches.map(m => m.id === freshMatch.id ? updatedMatch : m),
      stackOrder
    });
    await get().publishSharedState();
    
    speakAnnouncement(`${freshState.players.find(p => p.id === playerId)?.displayName} joined the match on ${court.name}.`);
  },
  addReservation: async (reservationData) => {
    const activeStatuses = ["Confirmed", "Requested"];
    const hasConflict = get().reservations.some((reservation) =>
      activeStatuses.includes(reservation.status)
      && reservation.courtId === reservationData.courtId
      && new Date(reservationData.startTime).getTime() < new Date(reservation.endTime).getTime()
      && new Date(reservationData.endTime).getTime() > new Date(reservation.startTime).getTime()
    );
    if (hasConflict) throw new Error("This court already has a reservation during that time.");
    const id = generateId();
    const status = reservationData.status ?? "Requested";
    const hostDisplayName = reservationData.hostDisplayName
      ?? get().players.find((player) => player.id === reservationData.hostPlayerId)?.displayName
      ?? (reservationData.hostPlayerId === "admin" ? "Admin" : undefined);
    const reservation: Reservation = {
      ...reservationData,
      hostDisplayName,
      id,
      status
    };
    await db.reservations.put(reservation);
    await queue("CREATE_RESERVATION", "Reservation", id, reservation);
    
    if (status === "Confirmed" && reservation.paymentStatus === "Paid") {
      await get().addTransaction({
        playerId: reservationData.hostPlayerId,
        amount: reservationData.feeAmount,
        type: "CourtReservation",
        paymentMethod: "EWallet"
      });
    }

    set((state) => ({
      reservations: [...state.reservations, reservation]
    }));
    playSound("checkin");
    
    const court = get().courts.find(c => c.id === reservationData.courtId);
    if (status === "Requested") {
      speakAnnouncement(`Reservation request submitted for ${court?.name || "Court"}. Awaiting admin approval.`);
      pushToast(set, "Request submitted", "Your reservation is pending admin approval.", "system");
    } else {
      speakAnnouncement(`Court reservation booked for ${court?.name || "Court"}.`);
    }
    await get().publishSharedState();
  },
  updateReservation: async (id, patch) => {
    const current = get().reservations.find((item) => item.id === id);
    if (!current) return;
    const updated = { ...current, ...patch };
    await db.reservations.put(updated);
    await queue("UPDATE_RESERVATION", "Reservation", id, updated);
    set((state) => ({
      reservations: state.reservations.map((item) => item.id === id ? updated : item)
    }));
    await get().publishSharedState();
  },
  approveReservation: async (id) => {
    const reservation = get().reservations.find((r) => r.id === id);
    if (!reservation || reservation.status !== "Requested") return;
    await get().updateReservation(id, { status: "Confirmed", paymentStatus: "Paid" });
    if (reservation.paymentStatus !== "Paid") {
      await get().addTransaction({
        playerId: reservation.hostPlayerId,
        amount: reservation.feeAmount,
        type: "CourtReservation",
        paymentMethod: "EWallet"
      });
    }
    playSound("checkin");
    pushToast(set, "Reservation approved", "The court booking has been confirmed.", "system");
  },
  rejectReservation: async (id, reason) => {
    const reservation = get().reservations.find((r) => r.id === id);
    if (!reservation || reservation.status !== "Requested") return;
    await get().updateReservation(id, {
      status: "Rejected",
      cancellationReason: reason?.trim() || "Rejected by admin"
    });
    playSound("complete");
    pushToast(set, "Reservation rejected", "The booking request was declined.", "system");
  },
  cancelReservation: async (id, reason) => {
    const reservation = get().reservations.find(r => r.id === id);
    if (!reservation) return;
    const updated = { ...reservation, status: "Cancelled" as const, cancellationReason: reason?.trim() || undefined };
    await db.reservations.put(updated);
    await queue("UPDATE_RESERVATION", "Reservation", id, updated);
    set((state) => ({
      reservations: state.reservations.map(r => r.id === id ? updated : r)
    }));
    playSound("complete");
  },
  addTransaction: async (txData) => {
    const id = generateId();
    const transaction: Transaction = {
      ...txData,
      id,
      status: "Success",
      timestamp: new Date().toISOString()
    };
    await db.transactions.put(transaction);
    await queue("CREATE_TRANSACTION", "Transaction", id, transaction);
    set((state) => ({
      transactions: [...state.transactions, transaction]
    }));
  },
  completeTransaction: async (id) => {
    const tx = get().transactions.find(t => t.id === id);
    if (!tx) return;
    const updated = { ...tx, status: "Success" as const };
    await db.transactions.put(updated);
    await queue("UPDATE_TRANSACTION", "Transaction", id, updated);

    // If transaction type is CheckInFee, make sure the player is checked in
    if (tx.type === "CheckInFee") {
      await get().checkIn(tx.playerId);
    }
    // Update matching court reservation payment status to Paid if applicable
    const matchedReservation = get().reservations.find(r => r.hostPlayerId === tx.playerId && r.feeAmount === tx.amount && r.paymentStatus === "Pending");
    if (matchedReservation) {
      const updatedRes = { ...matchedReservation, paymentStatus: "Paid" as const };
      await db.reservations.put(updatedRes);
      await queue("UPDATE_RESERVATION", "Reservation", matchedReservation.id, updatedRes);
      set((state) => ({
        reservations: state.reservations.map(r => r.id === matchedReservation.id ? updatedRes : r)
      }));
    }

    set((state) => ({
      transactions: state.transactions.map(t => t.id === id ? updated : t)
    }));
    playSound("complete");
  },
  deleteTransaction: async (id) => {
    const transaction = get().transactions.find((t) => t.id === id);
    if (!transaction) return;
    await db.transactions.delete(id);
    await queue("DELETE_TRANSACTION", "Transaction", id, { id });
    set((state) => ({
      transactions: state.transactions.filter((t) => t.id !== id)
    }));
  },
  voidTransaction: async (id, reason) => {
    const tx = get().transactions.find((transaction) => transaction.id === id);
    const cleanReason = reason.trim();
    if (!tx || tx.status === "Voided" || !cleanReason) return;
    const updated: Transaction = {
      ...tx,
      status: "Voided",
      voidReason: cleanReason,
      voidedAt: new Date().toISOString()
    };
    await db.transactions.put(updated);
    await queue("VOID_TRANSACTION", "Transaction", id, updated);
    try {
      await apiFetch("/api/reservations?action=payment-issue-by-transaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId: id })
      });
    } catch {
      // The finance ledger remains voided locally; reservation status will retry when online.
    }
    set((state) => ({
      transactions: state.transactions.map((transaction) => transaction.id === id ? updated : transaction)
    }));
    pushToast(set, "Payment voided", "The false payment was removed from revenue totals.", "system");
    playSound("complete");
  },
  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
  suppressRefresh: (ms = 2500) => {
    suppressSharedRefreshUntil = Date.now() + ms;
  },
  isRefreshSuppressed: () => Date.now() < suppressSharedRefreshUntil,
  addTestimonial: async (quote, rating, displayName) => {
    const testimonial = { id: generateId(), quote, rating, displayName };
    set(state => {
      const next = [...state.testimonials, testimonial];
      localStorage.setItem("haff-testimonials", JSON.stringify(next));
      return { testimonials: next };
    });
  },
  deleteTestimonial: async (id) => {
    set(state => {
      const next = state.testimonials.filter(t => t.id !== id);
      localStorage.setItem("haff-testimonials", JSON.stringify(next));
      return { testimonials: next };
    });
  },
  addAnnouncement: async (title, content) => {
    const announcement = { id: generateId(), title, content, date: new Date().toISOString().split("T")[0] };
    set(state => {
      const next = [announcement, ...state.announcements];
      localStorage.setItem("haff-announcements", JSON.stringify(next));
      return { announcements: next };
    });
  },
  deleteAnnouncement: async (id) => {
    set(state => {
      const next = state.announcements.filter(a => a.id !== id);
      localStorage.setItem("haff-announcements", JSON.stringify(next));
      return { announcements: next };
    });
  },
  addAchievement: async (title, value, desc) => {
    const achievement = { id: generateId(), title, value, desc };
    set(state => {
      const next = [...state.achievements, achievement];
      localStorage.setItem("haff-achievements", JSON.stringify(next));
      return { achievements: next };
    });
  },
  deleteAchievement: async (id) => {
    set(state => {
      const next = state.achievements.filter(ac => ac.id !== id);
      localStorage.setItem("haff-achievements", JSON.stringify(next));
      return { achievements: next };
    });
  },
  seedDemoPlayers: async () => {
    const demoPlayers: Player[] = [
      { id: "p-1", displayName: "Dink Master", skillLevel: "Pro", rating: 4.5, tags: ["Regular"], checkedIn: true, totalGamesPlayed: 14, totalDaysPlayed: 4 },
      { id: "p-2", displayName: "Lob Champion", skillLevel: "Intermediate", rating: 3.5, tags: ["Regular"], checkedIn: true, totalGamesPlayed: 8, totalDaysPlayed: 3 },
      { id: "p-3", displayName: "Kitchen Ace", skillLevel: "Pro", rating: 4.8, tags: ["VIP"], checkedIn: true, totalDaysPlayed: 5, totalGamesPlayed: 24 },
      { id: "p-4", displayName: "Smash Queen", skillLevel: "Pro", rating: 4.2, tags: ["Regular"], checkedIn: true, totalDaysPlayed: 2, totalGamesPlayed: 10 },
      { id: "p-5", displayName: "Baseline Ben", skillLevel: "Low Intermediate", rating: 2.8, tags: ["Regular"], checkedIn: true, totalDaysPlayed: 1, totalGamesPlayed: 4 },
      { id: "p-6", displayName: "Net Crusher", skillLevel: "Intermediate", rating: 3.2, tags: ["Regular"], checkedIn: true, totalDaysPlayed: 3, totalGamesPlayed: 12 },
      { id: "p-7", displayName: "Spin Doctor", skillLevel: "Novice", rating: 2.5, tags: ["Guest"], checkedIn: true, totalDaysPlayed: 1, totalGamesPlayed: 2 },
      { id: "p-8", displayName: "Volley King", skillLevel: "Beginner", rating: 2.0, tags: ["Regular"], checkedIn: true, totalDaysPlayed: 1, totalGamesPlayed: 1 },
      { id: "p-9", displayName: "Paddle Ninja", skillLevel: "Pro", rating: 4.6, tags: ["Regular"], checkedIn: true, totalDaysPlayed: 4, totalGamesPlayed: 18 },
      { id: "p-10", displayName: "Drop Shot Donna", skillLevel: "Intermediate", rating: 3.4, tags: ["Regular"], checkedIn: true, totalDaysPlayed: 2, totalGamesPlayed: 6 },
      { id: "p-11", displayName: "Erne Enthusiast", skillLevel: "Pro", rating: 4.0, tags: ["Regular"], checkedIn: true, totalDaysPlayed: 3, totalGamesPlayed: 9 },
      { id: "p-12", displayName: "Pickle Power", skillLevel: "Beginner", rating: 1.8, tags: ["Guest"], checkedIn: true, totalDaysPlayed: 1, totalGamesPlayed: 1 }
    ];
    await db.players.bulkPut(demoPlayers);
    const courts = get().courts;
    const matches = get().matches;
    const stackOrder = reconcileStackOrder(demoPlayers.map(p => p.id), demoPlayers, matches, courts);
    localStorage.setItem("haff-stack-order", JSON.stringify(stackOrder));
    set({ players: demoPlayers, stackOrder });
  }
}));

function balanceTeams(players: Player[]) {
  const sorted = [...players].sort((a, b) => b.rating - a.rating);
  const a: Player[] = [];
  const b: Player[] = [];
  
  sorted.forEach((player, i) => {
    if (i % 2 === 0) {
      a.push(player);
    } else {
      b.push(player);
    }
  });

  return { a, b };
}

function normalizeSkillLevel(skillLevel: string): Player["skillLevel"] {
  if (skillLevel === "Advanced" || skillLevel === "Competitive") return "Pro";
  if (
    skillLevel === "Newbie" ||
    skillLevel === "Beginner" ||
    skillLevel === "Novice" ||
    skillLevel === "Low Intermediate" ||
    skillLevel === "Intermediate" ||
    skillLevel === "Pro"
  ) {
    return skillLevel;
  }
  return "Beginner";
}

async function queue(actionType: string, entityType: string, entityId: string, payload: unknown) {
  const id = generateId();
  const baseVersion =
    typeof payload === "object" && payload && "version" in payload && typeof payload.version === "number"
      ? payload.version
      : undefined;
  await db.syncQueue.put({
    id,
    idempotencyKey: id,
    deviceId: getDeviceId(),
    actionType,
    entityType,
    entityId,
    baseVersion,
    payload,
    status: "Pending",
    retryCount: 0,
    createdAt: new Date().toISOString()
  });

  if (navigator.onLine) {
    try {
      void useClubStore.getState().processSyncQueue();
    } catch (e) {
      console.warn("Immediate sync queue processing failed:", e);
    }
  }
}

export async function getPendingSyncCount() {
  return db.syncQueue.where("status").equals("Pending").count();
}

function pushToast(
  set: (partial: Partial<ClubState> | ((state: ClubState) => Partial<ClubState>)) => void,
  title: string,
  message: string,
  tone: Toast["tone"]
) {
  const id = generateId();
  set((state) => {
    if (state.toasts.some((toast) => toast.title === title && toast.message === message)) return {};
    return { toasts: [{ id, title, message, tone }, ...state.toasts].slice(0, 4) };
  });
  setTimeout(() => {
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }));
  }, 2000);
}
