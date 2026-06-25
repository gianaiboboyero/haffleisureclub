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
      courts: [
        { id: "court-1", name: "Court 1", number: 1, status: "Available", priority: 1, reservable: true },
        { id: "court-2", name: "Court 2", number: 2, status: "Available", priority: 2, reservable: true },
        { id: "court-3", name: "Court 3", number: 3, status: "Available", priority: 3, reservable: true }
      ],
      matches: [],
      reservations: [],
      playerProfiles: [],
      playerKudos: [],
      matchReviews: [],
      tvBroadcast: null,
      updatedAt: null
    };
  }

  // Defeat read-replica lag: if this client recently wrote to this session,
  // ensure our fresh local writes take precedence over potentially stale replica data.
  if (lastKnownSessionId === sessionId && lastKnownSettings) {
    session.settings = {
      ...(typeof session.settings === "object" && session.settings ? session.settings : {}),
      ...lastKnownSettings
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
  adminWriteToken?: string | null;
};

let updateMutex = Promise.resolve<any>(null);
let lastKnownSettings: any = null;
let lastKnownSessionId: string | null = null;
let clearCacheTimer: number | null = null;

function updateLastKnownSettings(sessionId: string, settings: any) {
  lastKnownSettings = settings;
  lastKnownSessionId = sessionId;
  if (clearCacheTimer) window.clearTimeout(clearCacheTimer);
  clearCacheTimer = window.setTimeout(() => {
    lastKnownSettings = null;
    lastKnownSessionId = null;
  }, 2000);
}


export async function publishClubState(
  input: PublishClubStateInput,
  options?: { slim?: boolean }
): Promise<{ sessionId: string; updatedAt: string } | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  return new Promise((resolve) => {
    updateMutex = updateMutex.then(async () => {
      // Fetch current settings to preserve keys like tvBroadcast
      const { data: session } = await supabase.from("Session").select("settings").eq("id", input.sessionId).maybeSingle();
      const currentSettings = typeof session?.settings === "object" && session.settings !== null ? session.settings : {};

      const baseSettings = {
        ...currentSettings,
        ...(lastKnownSessionId === input.sessionId && lastKnownSettings ? lastKnownSettings : {})
      };

      const settings = {
        ...baseSettings,
        stackOrder: input.stackOrder,
        adminCheckedInIds: input.adminCheckedInIds,
        courts: input.courts,
        matches: input.matches,
        reservations: input.reservations,
        playerProfiles: input.playerProfiles,
        playerKudos: input.playerKudos,
        matchReviews: input.matchReviews,
        ...(input.adminWriteToken ? { adminWriteToken: input.adminWriteToken } : {})
      };

      updateLastKnownSettings(input.sessionId, settings);

      const { data } = await supabase.from("Session").update({
        settings,
        checkedInPlayerIds: input.checkedInPlayerIds,
        updatedAt: new Date().toISOString()
      }).eq("id", input.sessionId).select("id, updatedAt").maybeSingle();

      let result = data ? { sessionId: data.id, updatedAt: data.updatedAt } : null;
      if (!result && input.adminWriteToken) {
        const { data: inserted } = await supabase.from("Session").insert({
          id: input.sessionId,
          name: "Open Play Session",
          date: new Date().toISOString().slice(0, 10),
          mode: "Open Play",
          status: "Active",
          courtIds: input.courts
            .map((court) => (typeof court === "object" && court && "id" in court ? String((court as { id: unknown }).id) : null))
            .filter((id): id is string => Boolean(id)),
          checkedInPlayerIds: input.checkedInPlayerIds,
          settings,
          updatedAt: new Date().toISOString()
        }).select("id, updatedAt").maybeSingle();
        result = inserted ? { sessionId: inserted.id, updatedAt: inserted.updatedAt } : null;
      }
      resolve(result);
      return result;
    }).catch(() => {
      resolve(null);
      return null;
    });
  });
}

export async function broadcastTvState(
  sessionId: string,
  tvBroadcast: TvBroadcast,
  adminWriteToken?: string | null
): Promise<{ sessionId: string; updatedAt: string } | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  return new Promise((resolve) => {
    updateMutex = updateMutex.then(async () => {
      const { data: session } = await supabase.from("Session").select("settings").eq("id", sessionId).maybeSingle();
      if (!session) {
        resolve(null);
        return null;
      }

      const currentSettings = typeof session.settings === "object" && session.settings !== null ? session.settings : {};
      
      const baseSettings = {
        ...currentSettings,
        ...(lastKnownSessionId === sessionId && lastKnownSettings ? lastKnownSettings : {})
      };

      const settings = {
        ...baseSettings,
        tvBroadcast,
        ...(adminWriteToken ? { adminWriteToken } : {})
      };

      updateLastKnownSettings(sessionId, settings);

      const { data } = await supabase.from("Session").update({
        settings,
        updatedAt: new Date().toISOString()
      }).eq("id", sessionId).select("id, updatedAt").maybeSingle();

      const result = data ? { sessionId: data.id, updatedAt: data.updatedAt } : null;
      resolve(result);
      return result;
    }).catch(() => {
      resolve(null);
      return null;
    });
  });
}
