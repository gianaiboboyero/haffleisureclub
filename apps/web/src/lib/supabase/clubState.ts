import { getSupabase } from "./client";
import {
  buildSharedPayload,
  isUnchangedSince,
  type ClubSettings,
  type PlayerProfileSnapshot,
  type SharedClubStatePayload
} from "./sessionTransform";
import type { Match } from "../types";
import type { TvBroadcast } from "../types";

type SessionRow = {
  id: string;
  name: string;
  date: string;
  mode: string;
  status: string;
  courtIds: string[];
  checkedInPlayerIds: string[];
  settings: unknown;
  updatedAt: string;
  version: number;
};

// Only fetch columns the app actually reads — omitting large unused columns
// (e.g. courtIds, name, date, mode) saves egress bytes on every poll.
const SESSION_COLUMNS = "id, status, checkedInPlayerIds, settings, updatedAt, version";

async function findActiveSession(sessionId?: string): Promise<SessionRow | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  if (sessionId) {
    const { data } = await supabase
      .from("Session")
      .select(SESSION_COLUMNS)
      .eq("id", sessionId)
      .maybeSingle();
    if (data?.status === "Active") return data as SessionRow;
  }

  const { data } = await supabase
    .from("Session")
    .select(SESSION_COLUMNS)
    .eq("status", "Active")
    .order("updatedAt", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data as SessionRow | null) ?? null;
}

async function findSessionMeta(sessionId?: string) {
  const supabase = getSupabase();
  if (!supabase) return null;

  if (sessionId) {
    const { data } = await supabase
      .from("Session")
      .select("id, updatedAt, status")
      .eq("id", sessionId)
      .maybeSingle();
    if (data?.status === "Active") return data;
  }

  const { data } = await supabase
    .from("Session")
    .select("id, updatedAt, status")
    .eq("status", "Active")
    .order("updatedAt", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data;
}

export async function pingClubState(
  sessionId: string,
  since?: string | null
): Promise<{ ping: true; sessionId: string; updatedAt: string | null; unchanged: boolean } | null> {
  const meta = await findSessionMeta(sessionId);
  if (!meta) {
    return {
      ping: true,
      sessionId: sessionId || "default-active-session",
      updatedAt: null,
      unchanged: false
    };
  }
  const serverIso = String(meta.updatedAt);
  const unchanged = Boolean(since && isUnchangedSince(since, serverIso));
  return {
    ping: true,
    sessionId: meta.id,
    updatedAt: serverIso,
    unchanged
  };
}

export async function fetchClubState(
  sessionId: string,
  options?: { since?: string | null; context?: "tv" | "player" | "default" }
): Promise<SharedClubStatePayload | { unchanged: true; sessionId: string; updatedAt: string; tvBroadcast: unknown } | null> {
  const session = await findActiveSession(sessionId);
  if (!session) {
    return {
      sessionId: sessionId || "default-active-session",
      checkedInPlayerIds: [],
      adminCheckedInIds: [],
      stackOrder: [],
      courts: [],
      matches: [],
      reservations: [],
      playerProfiles: [],
      playerKudos: [],
      matchReviews: [],
      tvBroadcast: null,
      updatedAt: null
    };
  }

  const lightView = options?.context === "tv" || options?.context === "player";
  return buildSharedPayload(session, {
    since: options?.since ?? undefined,
    lightView,
    omitProfiles: true,
    omitReservations: true
  });
}

export type PublishClubStateInput = {
  sessionId: string;
  checkedInPlayerIds: string[];
  adminCheckedInIds: string[];
  stackOrder: string[];
  courts: unknown[];
  matches: Match[];
  reservations: unknown[];
  playerProfiles: PlayerProfileSnapshot[];
  playerKudos?: unknown[];
  matchReviews?: unknown[];
};

export async function publishClubState(
  _input: PublishClubStateInput,
  _options?: { slim?: boolean }
): Promise<{ sessionId: string; updatedAt: string } | null> {
  throw new Error("Direct Session writes are disabled. Use POST /api/club-state while signed in.");
}

export async function broadcastTvState(
  _sessionId: string,
  _tvBroadcast: TvBroadcast
): Promise<{ sessionId: string; updatedAt: string } | null> {
  throw new Error("Direct Session writes are disabled. Use POST /api/club-state while signed in.");
}
