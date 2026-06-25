/** Client sync intervals — tuned for Vercel + Supabase free tiers. */

export const POLL_MS_PUSH_HEALTHY = 15 * 60_000;
export const POLL_MS_PUSH_DOWN = 5 * 60_000;
export const POLL_MS_IDLE_VIEW = 15 * 60_000;
/** Realtime handles live ops — HTTP poll is only a fallback when push is down. */
export const POLL_MS_ADMIN_TV_HEALTHY = 15 * 60_000;
export const POLL_MS_ADMIN_TV_DOWN = 3 * 60_000;
/** Safety ping when Realtime is healthy (should rarely run — see main.tsx poll gate). */
export const POLL_MS_REALTIME_HEALTHY = 60 * 60_000;
export const ROSTER_SYNC_TTL_MS = 4 * 60 * 60_000; // was 1 hr, raised to 4 hr
export const REALTIME_REFRESH_DEBOUNCE_MS = 2500;
export const PUBLISH_DEBOUNCE_MS = 2000;

// Views that have no operational session UI — polling is worthless here.
const NO_POLL_VIEWS = new Set(["landing"]);
// Views where slower polling is fine (no real-time queue display).
const IDLE_VIEWS = new Set(["landing", "calendar", "finance"]);

let clubPushHealthy = false;
let chatPushHealthy = false;

export function isIdleView(view: string) {
  return IDLE_VIEWS.has(view);
}

export function clubPollIntervalMs(view: string) {
  if (NO_POLL_VIEWS.has(view)) return 60 * 60_000;
  if (clubPushHealthy) return POLL_MS_REALTIME_HEALTHY;
  if (view === "admin" || view === "tv") return POLL_MS_ADMIN_TV_DOWN;
  if (isIdleView(view)) return POLL_MS_IDLE_VIEW;
  return POLL_MS_PUSH_DOWN;
}

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
