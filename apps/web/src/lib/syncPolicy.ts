/** Client sync intervals — tuned for Vercel + Supabase free tiers. */

export const POLL_MS_PUSH_HEALTHY = 5 * 60_000;
export const POLL_MS_PUSH_DOWN = 90_000;
export const POLL_MS_IDLE_VIEW = 5 * 60_000;   // was 3 min, raised to 5 min
export const POLL_MS_ADMIN_TV_HEALTHY = 60_000; // was 30 s — Realtime covers urgent updates
export const POLL_MS_ADMIN_TV_DOWN = 30_000;    // 30 s only when Realtime is degraded
export const ROSTER_SYNC_TTL_MS = 4 * 60 * 60_000; // was 1 hr, raised to 4 hr
export const REALTIME_REFRESH_DEBOUNCE_MS = 400;
export const PUBLISH_DEBOUNCE_MS = 500;

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
  // Landing page has no session UI — skip polling entirely (return a very long interval).
  if (NO_POLL_VIEWS.has(view)) return 60 * 60_000;
  // Admin / TV: tighter when Realtime is degraded, relaxed when healthy (RT handles updates).
  if (view === "admin" || view === "tv") {
    return clubPushHealthy ? POLL_MS_ADMIN_TV_HEALTHY : POLL_MS_ADMIN_TV_DOWN;
  }
  // Finance/calendar — slower poll, Realtime not critical.
  if (isIdleView(view)) return POLL_MS_IDLE_VIEW;
  if (clubPushHealthy) return POLL_MS_PUSH_HEALTHY;
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
