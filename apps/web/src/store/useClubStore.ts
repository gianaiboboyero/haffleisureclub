import { create } from "zustand";
import { db, demoPlayerAccount, seedCourts, seedPlayers } from "../lib/db";
import { playSound } from "../lib/sound";
import { todayKey } from "../lib/utils";
import type { Court, Match, Player, Toast, Session } from "../lib/types";

type ViewMode = "admin" | "player" | "tv";

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
  setView: (view: ViewMode) => void;
  setMatchDurationMinutes: (minutes: number) => void;
  hydrate: () => Promise<void>;
  setOnline: (online: boolean) => void;
  refreshPendingSyncCount: () => Promise<void>;
  processSyncQueue: () => Promise<void>;
  // Player Actions
  checkIn: (playerId: string) => Promise<void>;
  checkOut: (playerId: string) => Promise<void>;
  setPlayerParked: (playerId: string, parked: boolean) => Promise<void>;
  movePlayerToStack: (playerId: string, stackIndex: number) => void;
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
  assignPlayerToCourt: (playerId: string, courtId: string) => Promise<void>;
  removePlayerFromCourt: (playerId: string) => Promise<void>;
  dismissToast: (id: string) => void;
};

export const useClubStore = create<ClubState>((set, get) => ({
  players: [],
  courts: [],
  matches: [],
  sessions: [],
  currentSessionId: localStorage.getItem("haff-current-session-id") ?? "default-active-session",
  stackOrder: JSON.parse(localStorage.getItem("haff-stack-order") ?? "[]") as string[],
  toasts: [],
  view: (() => {
    const path = window.location.pathname.replace(/^\//, "");
    if (path === "admin" || path === "player" || path === "tv") return path;
    const hash = window.location.hash.replace(/^#\/?/, "");
    if (hash === "admin" || hash === "player" || hash === "tv") return hash;
    if (hash === "display") return "tv";
    return "admin";
  })() as ViewMode,
  online: navigator.onLine,
  pendingSyncCount: 0,
  hydrated: false,
  matchDurationMinutes: Number(localStorage.getItem("haff-match-duration-minutes") ?? 12),
  setView: (view) => {
    window.history.pushState(null, "", `/${view}`);
    set({ view });
  },
  setMatchDurationMinutes: (minutes) => {
    const next = Math.max(5, Math.min(45, Math.round(minutes)));
    localStorage.setItem("haff-match-duration-minutes", String(next));
    set({ matchDurationMinutes: next });
  },
  hydrate: async () => {
    // 1. Determine online status and check for pending unsynced changes
    const online = navigator.onLine;
    const pendingSyncCount = await db.syncQueue.where("status").equals("Pending").count();

    if (online && pendingSyncCount === 0) {
      try {
        const baseUrl = (import.meta as any).env?.VITE_API_URL || "http://localhost:3001";
        
        // Pull latest players from NestJS
        const resPlayers = await fetch(`${baseUrl}/players`);
        if (resPlayers.ok) {
          const serverPlayers = await resPlayers.json();
          if (Array.isArray(serverPlayers) && serverPlayers.length > 0) {
            await db.players.bulkPut(serverPlayers);
          }
        }

        // Pull latest courts from NestJS
        const resCourts = await fetch(`${baseUrl}/courts`);
        if (resCourts.ok) {
          const serverCourts = await resCourts.json();
          if (Array.isArray(serverCourts) && serverCourts.length > 0) {
            await db.courts.bulkPut(serverCourts);
          }
        }
      } catch (e) {
        console.warn("Server pull sync failed, falling back to local storage:", e);
      }
    }

    // 2. Load and seed if local database is completely empty
    if ((await db.players.count()) === 0) {
      await db.players.bulkPut(seedPlayers);
      await db.courts.bulkPut(seedCourts);
    }
    const demoAccount = await db.players.get(demoPlayerAccount.id);
    if (!demoAccount) {
      await db.players.put(demoPlayerAccount);
    }

    // 3. Normalize skillLevel for security
    let players = (await db.players.toArray()).map((player) => ({
      ...player,
      skillLevel: normalizeSkillLevel(player.skillLevel),
      parked: player.parked ?? false
    }));
    await db.players.bulkPut(players);

    const courts = (await db.courts.toArray()).map((court) =>
      court.status === "InUse" && !court.currentMatchId ? { ...court, status: "Available" as const } : court
    );
    await db.courts.bulkPut(courts);

    const matches = await db.matches.toArray();
    const sessions = await db.sessions.toArray();

    let currentSessionId = get().currentSessionId || "default-active-session";
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
      await db.sessions.put(defaultSession);
    }
    if (!currentSessionId) {
      currentSessionId = sessions[0]?.id || "default-active-session";
    }
    localStorage.setItem("haff-current-session-id", currentSessionId);

    const storedOrder = JSON.parse(localStorage.getItem("haff-stack-order") ?? "[]") as string[];
    const stackOrder = reconcileStackOrder(storedOrder, players, matches, courts);
    localStorage.setItem("haff-stack-order", JSON.stringify(stackOrder));

    set({ players, courts, matches, sessions, currentSessionId, stackOrder, pendingSyncCount, hydrated: true });
  },
  setOnline: (online) => set({ online }),
  refreshPendingSyncCount: async () => {
    const pendingSyncCount = await db.syncQueue.where("status").equals("Pending").count();
    set({ pendingSyncCount });
    if (pendingSyncCount > 0) {
      await get().processSyncQueue();
    }
  },
  processSyncQueue: async () => {
    if (!get().online) return;
    const pending = await db.syncQueue.where("status").equals("Pending").toArray();
    if (pending.length === 0) return;

    const ids = pending.map((item) => item.id);
    await db.syncQueue.where("id").anyOf(ids).modify({ status: "Syncing" });

    try {
      const baseUrl = (import.meta as any).env?.VITE_API_URL || "http://localhost:3001";
      const response = await fetch(`${baseUrl}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pending)
      });

      if (!response.ok) throw new Error("Sync response error");
      const result = await response.json();

      const syncedIds = (result.results ?? [])
        .filter((r: any) => r.status === "Synced")
        .map((r: any) => r.id);

      const failed = (result.results ?? [])
        .filter((r: any) => r.status === "Failed");

      if (syncedIds.length > 0) {
        await db.syncQueue.where("id").anyOf(syncedIds).delete();
      }

      for (const item of failed) {
        await db.syncQueue.update(item.id, { status: "Failed" });
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
  checkIn: async (playerId) => {
    const players = get().players.map((player) =>
      player.id === playerId ? { ...player, checkedIn: true, parked: false } : player
    );
    const player = players.find((item) => item.id === playerId);
    if (!player) return;
    await db.players.put(player);
    await queue("CHECK_IN_PLAYER", "Player", player.id, player);
    playSound("checkin");
    pushToast(set, "Player checked in", `${player.displayName} is ready for open play.`, "fun");

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

    const stackOrder = reconcileStackOrder([...get().stackOrder, playerId], players, get().matches, get().courts);
    localStorage.setItem("haff-stack-order", JSON.stringify(stackOrder));
    set({ players, stackOrder });
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
  },
  movePlayerToStack: (playerId, stackIndex) => {
    const state = get();
    const currentOrder = [...state.stackOrder];
    const oldIndex = currentOrder.indexOf(playerId);

    if (oldIndex === -1) {
      const player = state.players.find((p) => p.id === playerId);
      if (!player) return;

      // If player is reserved on any court, remove them first
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
      if (courtUpdated) {
        for (const c of updatedCourts) {
          const oldC = state.courts.find((o) => o.id === c.id);
          if (JSON.stringify(oldC) !== JSON.stringify(c)) {
            db.courts.put(c).catch(console.warn);
            queue("UPDATE_COURT_STATUS", "Court", c.id, c).catch(console.warn);
          }
        }
        set({ courts: updatedCourts });
      }

      // Check in / resume if needed
      let updatedPlayersList = state.players;
      if (!player.checkedIn || player.parked) {
        const updatedPlayer = { ...player, checkedIn: true, parked: false };
        db.players.put(updatedPlayer).catch(console.warn);
        queue("CHECK_IN_PLAYER", "Player", player.id, updatedPlayer).catch(console.warn);
        
        const currentSessionId = state.currentSessionId;
        if (currentSessionId) {
          const session = state.sessions.find((s) => s.id === currentSessionId);
          if (session && !session.checkedInPlayerIds.includes(playerId)) {
            const updatedSession = {
              ...session,
              checkedInPlayerIds: [...session.checkedInPlayerIds, playerId]
            };
            db.sessions.put(updatedSession).catch(console.warn);
            queue("UPDATE_SESSION", "Session", session.id, updatedSession).catch(console.warn);
            set((s) => ({
              sessions: s.sessions.map((x) => x.id === currentSessionId ? updatedSession : x)
            }));
          }
        }
        updatedPlayersList = state.players.map((p) => p.id === playerId ? updatedPlayer : p);
        set({ players: updatedPlayersList });
      }
    } else {
      // Remove player from old position and replace with "vacant"
      currentOrder[oldIndex] = "vacant";
    }

    // Find the first vacant slot in the target stack
    const targetStart = stackIndex * 4;
    const targetEnd = targetStart + 3;
    let targetIndex = -1;

    for (let i = targetStart; i <= targetEnd; i++) {
      if (currentOrder[i] === "vacant") {
        targetIndex = i;
        break;
      }
    }

    if (targetIndex !== -1) {
      currentOrder[targetIndex] = playerId;
    } else {
      // If target stack is full, we insert the player at targetStart and shift the others
      let nextVacant = -1;
      for (let i = targetStart; i < currentOrder.length; i++) {
        if (currentOrder[i] === "vacant") {
          nextVacant = i;
          break;
        }
      }

      if (nextVacant !== -1) {
        for (let i = nextVacant; i > targetStart; i--) {
          currentOrder[i] = currentOrder[i - 1];
        }
        currentOrder[targetStart] = playerId;
      } else {
        currentOrder.push("vacant", "vacant", "vacant", "vacant");
        const len = currentOrder.length;
        for (let i = len - 1; i > targetStart; i--) {
          currentOrder[i] = currentOrder[i - 1];
        }
        currentOrder[targetStart] = playerId;
      }
    }

    const stackOrder = reconcileStackOrder(currentOrder, state.players, state.matches, state.courts);
    localStorage.setItem("haff-stack-order", JSON.stringify(stackOrder));
    set({ stackOrder });
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
    pushToast(set, "Player updated", `${player.displayName} has been updated.`, "system");
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
      for (const match of newMatches) await queue("CREATE_MATCH", "Match", match.id, match);
      pushToast(set, "Courts assigned", `${newMatches.length} match${newMatches.length === 1 ? "" : "es"} sent to court.`, "system");
    }

    const matches = [...state.matches, ...newMatches];
    const stackOrder = reconcileStackOrder(currentOrder, state.players, matches, updatedCourts);
    localStorage.setItem("haff-stack-order", JSON.stringify(stackOrder));
    set({ matches, courts: updatedCourts, stackOrder });
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
  },
  startReservedCourt: async (courtId) => {
    const state = get();
    const court = state.courts.find((item) => item.id === courtId);
    const stack = (court?.reservedPlayerIds ?? [])
      .map((id) => state.players.find((player) => player.id === id))
      .filter((player): player is Player => Boolean(player));
    if (!court || stack.length === 0) return;
    const teams = balanceTeams(stack);
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
    await db.matches.put(match);
    await db.courts.bulkPut(courts);
    await queue("START_RESERVED_STACK", "Match", match.id, match);
    pushToast(set, "Reserved stack started", `${court.name} is now playing ${court.reservedFor}.`, "system");
    const matches = [...state.matches, match];
    const stackOrder = reconcileStackOrder(state.stackOrder, state.players, matches, courts);
    localStorage.setItem("haff-stack-order", JSON.stringify(stackOrder));
    set({ matches, courts, stackOrder });
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
    const matches = state.matches.map((item) => (item.id === match.id ? completed : item));
    const courts = state.courts.map((item) =>
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
    await db.players.bulkPut(players);
    await db.matches.put(completed);
    await db.courts.bulkPut(courts);
    await queue("FINISH_COURT", "Match", completed.id, completed);
    pushToast(set, "Court cleared", `${court.name} is ready for the next stack.`, "system");
    const stackOrder = reconcileStackOrder(state.stackOrder, players, matches, courts);
    localStorage.setItem("haff-stack-order", JSON.stringify(stackOrder));
    set({ players, matches, courts, stackOrder });
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

    if (courtUpdated || orderUpdated) {
      const stackOrder = reconcileStackOrder(nextStackOrder, state.players, state.matches, updatedCourts);
      localStorage.setItem("haff-stack-order", JSON.stringify(stackOrder));
      set({ courts: updatedCourts, stackOrder });
    }
    pushToast(set, "Player returned to lounge", `${player.displayName} returned to check-in lounge queue.`, "system");
  },
  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }))
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

  let cleaned = stackOrder.map((id) => {
    if (id === "vacant") return "vacant";
    if (eligibleIds.has(id)) return id;
    return "vacant";
  });

  const placedIds = new Set(cleaned.filter((id) => id !== "vacant"));
  const unplaced = Array.from(eligibleIds).filter((id) => !placedIds.has(id));

  for (const id of unplaced) {
    const vacantIndex = cleaned.indexOf("vacant");
    if (vacantIndex !== -1) {
      cleaned[vacantIndex] = id;
    } else {
      cleaned.push(id);
    }
  }

  while (cleaned.length < 12) {
    cleaned.push("vacant");
  }

  while (cleaned.length % 4 !== 0) {
    cleaned.push("vacant");
  }

  while (cleaned.length > 12 && cleaned.slice(-4).every((id) => id === "vacant")) {
    cleaned = cleaned.slice(0, -4);
  }

  return cleaned;
}

async function queue(actionType: string, entityType: string, entityId: string, payload: unknown) {
  await db.syncQueue.put({
    id: crypto.randomUUID(),
    actionType,
    entityType,
    entityId,
    payload,
    status: "Pending",
    createdAt: new Date().toISOString()
  });
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
  set((state) => ({
    toasts: [{ id: crypto.randomUUID(), title, message, tone }, ...state.toasts].slice(0, 4)
  }));
}
