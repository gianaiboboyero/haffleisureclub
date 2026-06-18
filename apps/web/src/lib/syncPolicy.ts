/** Client sync intervals — tuned for Vercel + Supabase free tiers. */

export const POLL_MS_PUSH_HEALTHY = 5 * 60_000;
export const POLL_MS_PUSH_DOWN = 90_000;
export const POLL_MS_IDLE_VIEW = 3 * 60_000;
export const COMMUNITY_POLL_MS = 2 * 60_000;
export const ROSTER_SYNC_TTL_MS = 60 * 60_000;
export const REALTIME_REFRESH_DEBOUNCE_MS = 400;
export const PUBLISH_DEBOUNCE_MS = 500;

const IDLE_VIEWS = new Set(["landing", "calendar", "finance", "community"]);

let clubPushHealthy = false;
let chatPushHealthy = false;

export function markClubPushHealthy(healthy: boolean) {
  clubPushHealthy = healthy;
}

export function markChatPushHealthy(healthy: boolean) {
  chatPushHealthy = healthy;
}

export function isClubPushHealthy() {
  return clubPushHealthy;
}

export function isChatPushHealthy() {
  return chatPushHealthy;
}

export function clubPollIntervalMs(view: string) {
  if (clubPushHealthy) return POLL_MS_PUSH_HEALTHY;
  if (IDLE_VIEWS.has(view)) return POLL_MS_IDLE_VIEW;
  return POLL_MS_PUSH_DOWN;
}

export function shouldPollCommunity() {
  return !chatPushHealthy;
}

export function rosterSyncFresh(): boolean {
  try {
    const raw = sessionStorage.getItem("haff-roster-pulled-at");
    if (!raw) return false;
    return Date.now() - Number(raw) < ROSTER_SYNC_TTL_MS;
  } catch {
    return false;
  }
}

export function markRosterSynced() {
  try {
    sessionStorage.setItem("haff-roster-pulled-at", String(Date.now()));
  } catch {
    // ignore
  }
}
