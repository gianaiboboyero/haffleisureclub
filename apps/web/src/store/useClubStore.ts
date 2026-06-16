import { create } from "zustand";
import { db, getDeviceId, seedCourts } from "../lib/db";
import { playSound, speakAnnouncement } from "../lib/sound";
import { todayKey } from "../lib/utils";
import type { Court, Match, Player, Toast, Session, Reservation, Transaction, Testimonial, Achievement, Announcement } from "../lib/types";

let suppressSharedPublishUntil = 0;
let suppressSharedRefreshUntil = 0;

type ViewMode = "landing" | "admin" | "player" | "parking" | "tv" | "calendar" | "finance" | "community";

type ClubState = {
  players: Player[];
  courts: Court[];
  matches: Match[];
  sessions: Session[];
  currentSessionId: string | null;
  stackOrder: string[];
  toasts: Toast[];
  view: ViewMode;
  online: boolean;
  pendingSyncCount: number;
  hydrated: boolean;
  matchDurationMinutes: number;
  clubStatus: string;
  reservations: Reservation[];
  transactions: Transaction[];
  testimonials: Testimonial[];
  announcements: Announcement[];
  achievements: Achievement[];
  activeBillboard: { courtName: string; players: Array<{ displayName: string; avatarUrl?: string; skillLevel: string }> } | null;
  showBillboard: (courtName: string, players: Array<{ displayName: string; avatarUrl?: string; skillLevel: string }>) => void;
  clearBillboard: () => void;
  setView: (view: ViewMode) => void;
  setMatchDurationMinutes: (minutes: number) => void;
  setClubStatus: (status: string) => void;
  hydrate: () => Promise<void>;
  setOnline: (online: boolean) => void;
  refreshPendingSyncCount: () => Promise<void>;
  processSyncQueue: () => Promise<void>;
  refreshSharedState: () => Promise<void>;
  publishSharedState: () => Promise<void>;

  // Reservation Actions
  addReservation: (reservation: Omit<Reservation, "id">) => Promise<void>;
  cancelReservation: (id: string, reason?: string) => Promise<void>;

  // Transaction Actions
  addTransaction: (transaction: Omit<Transaction, "id" | "status" | "timestamp">) => Promise<void>;
  completeTransaction: (id: string) => Promise<void>;
  voidTransaction: (id: string, reason: string) => Promise<void>;

  // Player Actions
  checkIn: (playerId: string, autoLog?: boolean) => Promise<void>;
  checkOut: (playerId: string) => Promise<void>;
  checkOutAll: () => Promise<void>;
  setPlayerParked: (playerId: string, parked: boolean) => Promise<void>;
  movePlayerToIndex: (playerId: string, targetIndex: number) => Promise<void>;
  addPlayer: (player: Omit<Player, "id" | "totalGamesPlayed" | "totalDaysPlayed">) => Promise<void>;
  updatePlayer: (player: Player) => Promise<void>;
  deletePlayer: (playerId: string) => Promise<void>;

  // Court Actions
  addCourt: (court: Omit<Court, "id" | "status" | "currentMatchId" | "reservedFor" | "reservedPlayerIds">) => Promise<void>;
  updateCourt: (court: Court) => Promise<void>;
  deleteCourt: (courtId: string) => Promise<void>;

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
  assignPlayerToCourt: (playerId: string, courtId: string) => Promise<void>;
  removePlayerFromCourt: (playerId: string) => Promise<void>;
  joinActiveMatch: (playerId: string, courtId: string) => Promise<void>;
  dismissToast: (id: string) => void;
  suppressRefresh: (ms?: number) => void;
  addTestimonial: (quote: string, rating: number, displayName: string) => Promise<void>;
  deleteTestimonial: (id: string) => Promise<void>;
  addAnnouncement: (title: string, content: string) => Promise<void>;
  deleteAnnouncement: (id: string) => Promise<void>;
  addAchievement: (title: string, value: string, desc: string) => Promise<void>;
  deleteAchievement: (id: string) => Promise<void>;
  seedDemoPlayers: () => Promise<void>;
};

const getInitialTestimonials = () => {
  const existing = localStorage.getItem("haff-testimonials");
  if (existing) return JSON.parse(existing);
  const defaults = [
    { id: "t-1", quote: "HAFF Leisure Club has the best open play rotation! Extremely friendly and organized.", rating: 5, displayName: "Ace" },
    { id: "t-2", quote: "Love the cafe, iced matchas, and smart court countdown timers. Very premium.", rating: 5, displayName: "Dink" },
    { id: "t-3", quote: "Perfect venue to check in, park when you need to grab a bite, and step right back into queue.", rating: 5, displayName: "Spike" }
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
    if (["landing", "admin", "player", "parking", "tv", "calendar", "finance", "community"].includes(path)) return path;
    const hash = window.location.hash.replace(/^#\/?/, "");
    if (hash === "home" || hash === "landing") return "landing";
    if (["landing", "admin", "player", "parking", "tv", "calendar", "finance", "community"].includes(hash)) return hash;
    if (hash === "display") return "tv";
    if (hash === "payments" || hash === "revenue") return "finance";
    if (hash === "schedule" || hash === "reservation") return "calendar";
    return "landing";
  })() as ViewMode,
  online: navigator.onLine,
  pendingSyncCount: 0,
  hydrated: false,
  matchDurationMinutes: Number(localStorage.getItem("haff-match-duration-minutes") ?? 12),
  clubStatus: localStorage.getItem("haff-club-status") ?? "",
  setView: (view) => {
    window.history.pushState(null, "", view === "landing" ? "/home" : `/${view}`);
    set({ view });
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

    const players = rawPlayers.map((player) => ({
      ...player,
      skillLevel: normalizeSkillLevel(player.skillLevel),
      parked: player.parked ?? false
    }));
    const courts = rawCourts.map((court) =>
      court.status === "InUse" && !court.currentMatchId ? { ...court, status: "Available" as const } : court
    );
    const reservations = rawReservations.map((r) =>
      r.paymentStatus === "Pending" ? { ...r, paymentStatus: "Paid" as const } : r
    );
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

      if (online && pendingSyncCount === 0) {
        try {
          const baseUrl = (import.meta as any).env?.VITE_API_URL || ((import.meta as any).env?.PROD ? "/api" : "http://localhost:3001");
          const [resPlayers, resCourts] = await Promise.all([
            fetch(`${baseUrl}/players`),
            fetch(`${baseUrl}/courts`)
          ]);
          const updates: Promise<unknown>[] = [];
          if (resPlayers.ok) {
            const response = await resPlayers.json();
            const serverPlayers = Array.isArray(response) ? response : response.players;
            if (Array.isArray(serverPlayers)) {
              updates.push(db.players.clear().then(() => serverPlayers.length > 0 ? db.players.bulkPut(serverPlayers) : Promise.resolve()));
              get().players; // trigger re-read below
            }
          }
          if (resCourts.ok) {
            const response = await resCourts.json();
            const serverCourts = Array.isArray(response) ? response : response.courts;
            if (Array.isArray(serverCourts) && serverCourts.length > 0) {
              updates.push(db.courts.bulkPut(serverCourts));
            }
          }
          if (updates.length > 0) {
            await Promise.all(updates);
            // Re-read and refresh state silently
            const [freshPlayers, freshCourts] = await Promise.all([db.players.toArray(), db.courts.toArray()]);
            set({
              players: freshPlayers.map((p) => ({ ...p, skillLevel: normalizeSkillLevel(p.skillLevel), parked: p.parked ?? false })),
              courts: freshCourts.map((c) => c.status === "InUse" && !c.currentMatchId ? { ...c, status: "Available" as const } : c),
            });
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
  refreshSharedState: async () => {
    if (Date.now() < suppressSharedRefreshUntil) return;
    const currentSessionId = get().currentSessionId;
    if (!currentSessionId || !navigator.onLine) return;
    let shared: any;
    try {
      const response = await fetch(`/api/club-state?sessionId=${encodeURIComponent(currentSessionId)}`, {
        credentials: "include",
        cache: "no-store"
      });
      if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) return;
      shared = await response.json();
    } catch {
      return;
    }
    const checkedInIds = new Set<string>(shared.checkedInPlayerIds ?? []);
    const parkedIds = new Set<string>(shared.parkedPlayerIds ?? []);
    const players = get().players.map((player) => ({
      ...player,
      checkedIn: checkedInIds.has(player.id),
      parked: checkedInIds.has(player.id) && parkedIds.has(player.id)
    }));
    const stackOrder = reconcileStackOrder(
      Array.isArray(shared.stackOrder) ? shared.stackOrder : [],
      players,
      Array.isArray(shared.matches) ? shared.matches : get().matches,
      Array.isArray(shared.courts) ? shared.courts : get().courts
    );
    const courts = Array.isArray(shared.courts) && shared.courts.length > 0 ? shared.courts : get().courts;
    const matches = Array.isArray(shared.matches) ? shared.matches : get().matches;
    const currentSignature = JSON.stringify({
      players: get().players.map(({ id, checkedIn, parked }) => [id, checkedIn, Boolean(parked)]),
      courts: get().courts,
      matches: get().matches,
      stackOrder: get().stackOrder
    });
    const nextSignature = JSON.stringify({
      players: players.map(({ id, checkedIn, parked }) => [id, checkedIn, Boolean(parked)]),
      courts,
      matches,
      stackOrder
    });
    if (currentSignature === nextSignature) return;
    await db.players.bulkPut(players);
    if (Array.isArray(shared.courts) && shared.courts.length > 0) await db.courts.bulkPut(courts);
    if (Array.isArray(shared.matches)) {
      await db.matches.clear();
      if (matches.length > 0) await db.matches.bulkPut(matches);
    }
    localStorage.setItem("haff-stack-order", JSON.stringify(stackOrder));
    suppressSharedPublishUntil = Date.now() + 750;
    set({ players, courts, matches, stackOrder });
  },
  publishSharedState: async () => {
    if (Date.now() < suppressSharedPublishUntil) return;
    suppressSharedRefreshUntil = Date.now() + 2500;

    const state = get();
    fetch("/api/club-state", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: state.currentSessionId,
        checkedInPlayerIds: state.players.filter((player) => player.checkedIn).map((player) => player.id),
        parkedPlayerIds: state.players.filter((player) => player.checkedIn && player.parked).map((player) => player.id),
        stackOrder: state.stackOrder,
        courts: state.courts,
        matches: state.matches
      })
    }).catch(() => {
      // Local state remains authoritative until the next successful sync.
    });
  },
  processSyncQueue: async () => {
    if (!get().online) return;
    const pending = await db.syncQueue.where("status").equals("Pending").toArray();
    if (pending.length === 0) return;

    const ids = pending.map((item) => item.id);
    await db.syncQueue.where("id").anyOf(ids).modify({ status: "Syncing" });

    try {
      const baseUrl = (import.meta as any).env?.VITE_API_URL || ((import.meta as any).env?.PROD ? "/api" : "http://localhost:3001");
      const operationSyncEnabled = ((import.meta as any).env?.VITE_OPERATION_EVENT_SYNC ?? "true") !== "false";
      const response = await fetch(`${baseUrl}${operationSyncEnabled ? "/operations/events" : "/sync"}`, {
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
  checkIn: async (playerId, autoLog = true) => {
    const existingPlayer = get().players.find((player) => player.id === playerId);
    if (!existingPlayer || existingPlayer.checkedIn) return;
    const players = get().players.map((player) =>
      player.id === playerId ? { ...player, checkedIn: true, parked: true } : player
    );
    const player = players.find((item) => item.id === playerId);
    if (!player) return;
    await db.players.put(player);
    await queue("CHECK_IN_PLAYER", "Player", player.id, player);
    playSound("checkin");
    pushToast(set, "Player cleared for parking", `${player.displayName} is checked in${autoLog ? " and paid" : ""}.`, "fun");

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

    const stackOrder = reconcileStackOrder(get().stackOrder, players, get().matches, get().courts);
    localStorage.setItem("haff-stack-order", JSON.stringify(stackOrder));
    set({ players, stackOrder });

    if (autoLog) {
      await get().addTransaction({
        playerId,
        amount: 150,
        type: "CheckInFee",
        paymentMethod: "Cash"
      });
    }
    await get().publishSharedState();
  },
  checkOut: async (playerId) => {
    const players = get().players.map((player) =>
      player.id === playerId ? { ...player, checkedIn: false, parked: false } : player
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

    const stackOrder = reconcileStackOrder(get().stackOrder, players, get().matches, get().courts);
    localStorage.setItem("haff-stack-order", JSON.stringify(stackOrder));
    set({ players, stackOrder });
    await get().publishSharedState();
  },
  checkOutAll: async () => {
    const state = get();
    const checkedInPlayers = state.players.filter(p => p.checkedIn);
    if (checkedInPlayers.length === 0) return;

    const players = state.players.map(player => 
      player.checkedIn ? { ...player, checkedIn: false, parked: false } : player
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

    const stackOrder = reconcileStackOrder(state.stackOrder, players, state.matches, state.courts);
    localStorage.setItem("haff-stack-order", JSON.stringify(stackOrder));
    set({ players, stackOrder });
    await get().publishSharedState();
  },
  setPlayerParked: async (playerId, parked) => {
    const players = get().players.map((player) =>
      player.id === playerId ? { ...player, parked } : player
    );
    const player = players.find((item) => item.id === playerId);
    if (!player) return;
    await db.players.put(player);
    await queue("UPDATE_PLAYER_STATUS", "Player", player.id, player);
    
    let nextStackOrder = [...get().stackOrder];
    if (!parked) {
      nextStackOrder = nextStackOrder.filter((id) => id !== playerId);
      nextStackOrder.push(playerId);
    }
    
    const stackOrder = reconcileStackOrder(nextStackOrder, players, get().matches, get().courts);
    localStorage.setItem("haff-stack-order", JSON.stringify(stackOrder));
    pushToast(
      set,
      parked ? "Player parked" : "Player resumed",
      parked ? `${player.displayName} is paused from rotation.` : `${player.displayName} is back in rotation.`,
      "system"
    );
    set({ players, stackOrder });
    await get().publishSharedState();
  },
  movePlayerToIndex: async (playerId: string, targetIndex: number) => {
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
      if (!player.checkedIn || player.parked) {
        const updatedPlayer = { ...player, checkedIn: true, parked: false };
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
      currentOrder.splice(targetIndex, 0, playerId);
    } else {
      currentOrder.splice(oldIndex, 1);
      currentOrder.splice(targetIndex, 0, playerId);
    }

    const stackOrder = reconcileStackOrder(currentOrder, state.players, state.matches, state.courts);
    localStorage.setItem("haff-stack-order", JSON.stringify(stackOrder));
    set({ stackOrder });
    await get().publishSharedState();
  },
  addPlayer: async (playerData) => {
    const newPlayer: Player = {
      ...playerData,
      id: `player-${crypto.randomUUID()}`,
      checkedIn: false,
      parked: false,
      totalGamesPlayed: 0,
      totalDaysPlayed: 0
    };
    await db.players.put(newPlayer);
    await queue("CREATE_PLAYER", "Player", newPlayer.id, newPlayer);
    const players = [...get().players, newPlayer];
    set({ players });
    pushToast(set, "Player added", `${newPlayer.displayName} has been added.`, "system");
  },
  updatePlayer: async (player) => {
    await db.players.put(player);
    await queue("UPDATE_PLAYER", "Player", player.id, player);
    const players = get().players.map((p) => p.id === player.id ? player : p);
    const stackOrder = reconcileStackOrder(get().stackOrder, players, get().matches, get().courts);
    localStorage.setItem("haff-stack-order", JSON.stringify(stackOrder));
    set({ players, stackOrder });
  },
  deletePlayer: async (playerId) => {
    const player = get().players.find((p) => p.id === playerId);
    if (!player) return;
    const updatedPlayer = { ...player, isActive: false, checkedIn: false, parked: false };
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
    const newCourt: Court = {
      ...courtData,
      id: `court-${crypto.randomUUID()}`,
      status: "Available"
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
  },
  deleteCourt: async (courtId) => {
    const court = get().courts.find((c) => c.id === courtId);
    if (!court) return;
    await db.courts.delete(courtId);
    await queue("DELETE_COURT", "Court", courtId, { id: courtId });
    const courts = get().courts.filter((c) => c.id !== courtId);
    const stackOrder = reconcileStackOrder(get().stackOrder, get().players, get().matches, courts);
    localStorage.setItem("haff-stack-order", JSON.stringify(stackOrder));
    set({ courts, stackOrder });
    pushToast(set, "Court deleted", `${court.name} has been deleted.`, "system");
  },

  // Session Actions
  addSession: async (sessionData) => {
    const newSession: Session = {
      ...sessionData,
      id: `session-${crypto.randomUUID()}`
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

    // 2. Clear checked-in status and parked status of all players
    const updatedPlayers = state.players.map((p) => ({
      ...p,
      checkedIn: false,
      parked: false
    }));
    await db.players.bulkPut(updatedPlayers);

    // 3. Create a new active session
    const newSession: Session = {
      id: `session-${crypto.randomUUID()}`,
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

    // Clear checked-in status and parked status of all players
    const updatedPlayers = state.players.map((p) => ({
      ...p,
      checkedIn: false,
      parked: false
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

    // Put them back at the front of the stackOrder
    const currentOrder = get().stackOrder.filter((id) => !reservedIds.includes(id));
    const nextOrder = [...reservedIds, ...currentOrder];

    const courts = state.courts.map((c) =>
      c.id === courtId
        ? {
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
    const availableCourts = state.courts.filter((court) => court.status === "Available");
    if (availableCourts.length === 0) return;

    const newMatches: Match[] = [];
    const updatedCourts = [...state.courts];
    let currentOrder = [...state.stackOrder];

    for (const court of availableCourts) {
      if (currentOrder.length < 4) break;
      const nextFourIds = currentOrder.slice(0, 4);

      const stackPlayers = nextFourIds
        .map(id => state.players.find(p => p.id === id))
        .filter((p): p is Player => Boolean(p && p.checkedIn && !p.parked));

      if (stackPlayers.length >= 2) {
        const teams = balanceTeams(stackPlayers);
        const match: Match = {
          id: crypto.randomUUID(),
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
      if (slice.length === 4 && slice.every((id) => id !== "vacant")) {
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
        Boolean(player && player.checkedIn && !player.parked)
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
    const teams = stack.length > 0 ? balanceTeams(stack) : { a: [], b: [] };
    const match: Match = {
      id: crypto.randomUUID(),
      courtId: court.id,
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
    const waitingOrder = reconcileStackOrder(state.stackOrder, players, state.matches, courts);
    let nextStackStart = -1;
    if (waitingOrder.length >= 4) {
      nextStackStart = 0;
    }
    let remainingOrder = waitingOrder;
    let nextMatch: Match | null = null;
    if (nextStackStart >= 0) {
      const nextIds = waitingOrder.slice(0, 4);
      const nextPlayers = nextIds
        .map((id) => players.find((player) => player.id === id))
        .filter((player): player is Player => Boolean(player?.checkedIn && !player.parked));
      if (nextPlayers.length === 4) {
        const teams = balanceTeams(nextPlayers);
        nextMatch = {
          id: crypto.randomUUID(),
          courtId,
          teamAPlayerIds: teams.a.map((player) => player.id),
          teamBPlayerIds: teams.b.map((player) => player.id),
          scoreA: 0,
          scoreB: 0,
          status: "InProgress",
          startedAt: new Date().toISOString(),
          syncStatus: "PendingSync"
        };
        matches = [...matches, nextMatch];
        courts = courts.map((item) =>
          item.id === courtId ? { ...item, status: "InUse" as const, currentMatchId: nextMatch!.id } : item
        );
        remainingOrder = waitingOrder.slice(4);
      }
    }
    remainingOrder = [
      ...remainingOrder.filter((id) => !participantIds.includes(id)),
      ...participantIds
    ];
    const updatedCourt = courts.find((item) => item.id === courtId);
    await db.players.bulkPut(players);
    await db.matches.put(completed);
    if (nextMatch) await db.matches.put(nextMatch);
    await db.courts.bulkPut(courts);
    await queue("FINISH_COURT", "Match", completed.id, completed);
    if (nextMatch) await queue("CREATE_MATCH", "Match", nextMatch.id, nextMatch);
    if (updatedCourt) {
      await queue("UPDATE_COURT", "Court", updatedCourt.id, updatedCourt);
    }
    const stackOrder = reconcileStackOrder(remainingOrder, players, matches, courts);
    localStorage.setItem("haff-stack-order", JSON.stringify(stackOrder));
    set({ players, matches, courts, stackOrder });
    if (nextMatch) {
      const names = [...nextMatch.teamAPlayerIds, ...nextMatch.teamBPlayerIds]
        .map((id) => players.find((player) => player.id === id)?.displayName)
        .filter((name): name is string => Boolean(name));
      speakAnnouncement(`Next players for ${court.name}: ${names.join(", ")}. Please proceed to your court.`);
      pushToast(set, "Next stack assigned", `${names.join(", ")} sent to ${court.name}.`, "system");
    } else {
      pushToast(set, "Court available", `${court.name} is waiting for a complete stack of four.`, "system");
    }
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
    if (!player.checkedIn || player.parked) {
      const updatedPlayer = { ...player, checkedIn: true, parked: false };
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
        const nextStatus = nextReserved.length === 0 ? "Available" : c.status;
        return { ...c, reservedPlayerIds: nextReserved, status: nextStatus } as Court;
      }
      return c;
    });

    const targetCourtIndex = updatedCourts.findIndex((c) => c.id === courtId);
    if (targetCourtIndex !== -1) {
      const targetCourt = updatedCourts[targetCourtIndex];
      const existingReserved = targetCourt.reservedPlayerIds || [];
      if (!existingReserved.includes(playerId)) {
        const nextReserved = [...existingReserved, playerId];
        updatedCourts[targetCourtIndex] = {
          ...targetCourt,
          reservedPlayerIds: nextReserved,
          status: "Reserved"
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
        const nextStatus = nextReserved.length === 0 ? "Available" : c.status;
        return { ...c, reservedPlayerIds: nextReserved, status: nextStatus } as Court;
      }
      return c;
    });

    // Handle removing player from active InProgress match
    const activeMatchIndex = state.matches.findIndex((m) => m.status === "InProgress" && [...m.teamAPlayerIds, ...m.teamBPlayerIds].includes(playerId));
    let updatedMatches = state.matches;
    if (activeMatchIndex !== -1) {
      const match = state.matches[activeMatchIndex];
      const vacantId = `vacant-${crypto.randomUUID()}`;
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
    const hasConflict = get().reservations.some((reservation) =>
      reservation.status === "Confirmed"
      && reservation.courtId === reservationData.courtId
      && new Date(reservationData.startTime).getTime() < new Date(reservation.endTime).getTime()
      && new Date(reservationData.endTime).getTime() > new Date(reservation.startTime).getTime()
    );
    if (hasConflict) throw new Error("This court already has a reservation during that time.");
    const id = crypto.randomUUID();
    const reservation: Reservation = {
      ...reservationData,
      id,
      status: "Confirmed"
    };
    await db.reservations.put(reservation);
    await queue("CREATE_RESERVATION", "Reservation", id, reservation);
    
    if (reservation.paymentStatus === "Paid") {
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
    speakAnnouncement(`Court reservation booked for ${court?.name || "Court"}.`);
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
    const id = crypto.randomUUID();
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
      await fetch("/api/reservations?action=payment-issue-by-transaction", {
        method: "POST",
        credentials: "include",
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
  addTestimonial: async (quote, rating, displayName) => {
    const testimonial = { id: crypto.randomUUID(), quote, rating, displayName };
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
    const announcement = { id: crypto.randomUUID(), title, content, date: new Date().toISOString().split("T")[0] };
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
    const achievement = { id: crypto.randomUUID(), title, value, desc };
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

function reconcileStackOrder(stackOrder: string[], players: Player[], matches: Match[], courts: Court[]) {
  const activeIds = new Set(
    matches.filter((match) => match.status === "InProgress").flatMap((match) => [...match.teamAPlayerIds, ...match.teamBPlayerIds])
  );
  const reservedIds = new Set(courts.flatMap((court) => court.reservedPlayerIds ?? []));
  const eligibleIds = new Set(
    players
      .filter((player) => player.checkedIn && !player.parked && player.isActive !== false && !activeIds.has(player.id) && !reservedIds.has(player.id))
      .map((player) => player.id)
  );

  const seenIds = new Set<string>();
  const cleaned: string[] = [];

  for (const id of stackOrder) {
    if (id !== "vacant" && eligibleIds.has(id) && !seenIds.has(id)) {
      seenIds.add(id);
      cleaned.push(id);
    }
  }

  for (const id of eligibleIds) {
    if (!seenIds.has(id)) {
      cleaned.push(id);
    }
  }

  return cleaned;
}

async function queue(actionType: string, entityType: string, entityId: string, payload: unknown) {
  const id = crypto.randomUUID();
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
  const id = crypto.randomUUID();
  set((state) => {
    if (state.toasts.some((toast) => toast.title === title && toast.message === message)) return {};
    return { toasts: [{ id, title, message, tone }, ...state.toasts].slice(0, 4) };
  });
  setTimeout(() => {
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }));
  }, 2000);
}
