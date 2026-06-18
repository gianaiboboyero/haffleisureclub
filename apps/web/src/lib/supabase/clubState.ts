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

async function findActiveSession(sessionId?: string): Promise<SessionRow | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  if (sessionId) {
    const { data } = await supabase
      .from("Session")
      .select("*")
      .eq("id", sessionId)
      .maybeSingle();
    if (data?.status === "Active") return data as SessionRow;
  }

  const { data } = await supabase
    .from("Session")
    .select("*")
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
  playerKudos: unknown[];
  matchReviews: unknown[];
};

export async function publishClubState(
  input: PublishClubStateInput,
  options?: { slim?: boolean }
): Promise<{ sessionId: string; updatedAt: string } | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  let session = await findActiveSession(input.sessionId);
  if (!session) {
    const { data, error } = await supabase
      .from("Session")
      .insert({
        id: input.sessionId || "default-active-session",
        name: "Open Play Session",
        date: new Date().toISOString(),
        mode: "Open Play",
        status: "Active",
        checkedInPlayerIds: [],
        settings: {}
      })
      .select("*")
      .single();
    if (error || !data) return null;
    session = data as SessionRow;
  }

  const currentSettings = (session.settings ?? {}) as ClubSettings;
  const { playerProfiles: _legacyProfiles, reservations: _legacyReservations, ...restSettings } = currentSettings;
  const settings: ClubSettings = {
    ...restSettings,
    adminCheckedInIds: input.adminCheckedInIds,
    stackOrder: input.stackOrder,
    courts: input.courts,
    matches: input.matches,
    playerKudos: input.playerKudos,
    matchReviews: input.matchReviews,
    tvBroadcast: currentSettings.tvBroadcast
  };
  if (!options?.slim) {
    settings.reservations = input.reservations;
    settings.playerProfiles = input.playerProfiles;
  }

  const { data, error } = await supabase
    .from("Session")
    .update({
      checkedInPlayerIds: input.checkedInPlayerIds,
      settings
    })
    .eq("id", session.id)
    .select("id, updatedAt")
    .single();

  if (error || !data) return null;
  return { sessionId: data.id, updatedAt: String(data.updatedAt) };
}

export async function broadcastTvState(
  sessionId: string,
  tvBroadcast: TvBroadcast
): Promise<{ sessionId: string; updatedAt: string } | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const session = await findActiveSession(sessionId);
  if (!session) return null;

  const currentSettings = (session.settings ?? {}) as ClubSettings;
  const { data, error } = await supabase
    .from("Session")
    .update({
      settings: { ...currentSettings, tvBroadcast }
    })
    .eq("id", session.id)
    .select("id, updatedAt")
    .single();

  if (error || !data) return null;
  return { sessionId: data.id, updatedAt: String(data.updatedAt) };
}
