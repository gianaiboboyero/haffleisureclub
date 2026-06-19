import { useSupabaseData } from "./dataSource";
import { db } from "./db";
import type { Court, Match, Player, Session } from "./types";

/** Live club ops (stack, matches, court runtime, check-ins) come from Supabase Session only. */
export function serverAuthoritativeLiveState(): boolean {
  return useSupabaseData();
}

export const LIVE_STATE_EPOCH = "2026-06-18-server-only-v1";

export function saveStackOrder(stackOrder: string[]) {
  if (serverAuthoritativeLiveState()) return;
  localStorage.setItem("haff-stack-order", JSON.stringify(stackOrder));
}

export function clearStackOrderStorage() {
  if (serverAuthoritativeLiveState()) return;
  localStorage.removeItem("haff-stack-order");
}

export function loadStackOrderFromStorage(): string[] {
  if (serverAuthoritativeLiveState()) return [];
  try {
    return JSON.parse(localStorage.getItem("haff-stack-order") ?? "[]") as string[];
  } catch {
    return [];
  }
}

export function saveCurrentSessionId(sessionId: string) {
  if (serverAuthoritativeLiveState()) return;
  localStorage.setItem("haff-current-session-id", sessionId);
}

export async function migrateServerLiveStateEpoch() {
  if (!serverAuthoritativeLiveState()) return;
  if (localStorage.getItem("haff-live-state-epoch") === LIVE_STATE_EPOCH) return;
  await db.matches.clear();
  clearStackOrderStorage();
  localStorage.setItem("haff-live-state-epoch", LIVE_STATE_EPOCH);
}

/** IndexedDB writes for operational entities — skipped when Supabase Session is authoritative. */
export const liveDb = {
  playersPut: (player: Player) =>
    serverAuthoritativeLiveState() ? Promise.resolve() : db.players.put(player),
  playersBulkPut: (players: Player[]) =>
    serverAuthoritativeLiveState() ? Promise.resolve() : db.players.bulkPut(players),
  playersBulkDelete: (ids: string[]) =>
    serverAuthoritativeLiveState() ? Promise.resolve() : db.players.bulkDelete(ids),
  playersClear: () => (serverAuthoritativeLiveState() ? Promise.resolve() : db.players.clear()),
  courtsPut: (court: Court) =>
    serverAuthoritativeLiveState() ? Promise.resolve() : db.courts.put(court),
  courtsBulkPut: (courts: Court[]) =>
    serverAuthoritativeLiveState() ? Promise.resolve() : db.courts.bulkPut(courts),
  courtsDelete: (courtId: string) =>
    serverAuthoritativeLiveState() ? Promise.resolve() : db.courts.delete(courtId),
  courtsClear: () => (serverAuthoritativeLiveState() ? Promise.resolve() : db.courts.clear()),
  matchesPut: (match: Match) =>
    serverAuthoritativeLiveState() ? Promise.resolve() : db.matches.put(match),
  matchesBulkPut: (matches: Match[]) =>
    serverAuthoritativeLiveState() ? Promise.resolve() : db.matches.bulkPut(matches),
  matchesClear: () => (serverAuthoritativeLiveState() ? Promise.resolve() : db.matches.clear()),
  sessionsPut: (session: Session) =>
    serverAuthoritativeLiveState() ? Promise.resolve() : db.sessions.put(session),
  sessionsDelete: (sessionId: string) =>
    serverAuthoritativeLiveState() ? Promise.resolve() : db.sessions.delete(sessionId)
};
