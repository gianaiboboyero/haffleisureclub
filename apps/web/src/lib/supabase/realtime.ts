import { getSupabase } from "./client";
import { markChatPushHealthy, markClubPushHealthy } from "../syncPolicy";
import type { RealtimeEvent } from "../realtime";

type Unsubscribe = () => void;
type Listener = (event: RealtimeEvent) => void;
type HealthListener = (healthy: boolean) => void;

const listenersByTable = new Map<string, Set<Listener>>();
const healthByTable = new Map<string, Set<HealthListener>>();
const channelsStarted = new Set<string>();

function tableKey(table: string) {
  return table.toLowerCase();
}

function emitEvent(table: string, event: RealtimeEvent) {
  for (const listener of listenersByTable.get(tableKey(table)) ?? []) {
    listener(event);
  }
}

function emitHealth(table: string, healthy: boolean) {
  for (const listener of healthByTable.get(tableKey(table)) ?? []) {
    listener(healthy);
  }
}

function ensureChannel(table: string) {
  const key = tableKey(table);
  if (channelsStarted.has(key)) return;

  const supabase = getSupabase();
  if (!supabase) return;

  channelsStarted.add(key);
  supabase
    .channel(`haff-${key}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table },
      (payload) => {
        const row = (payload.new ?? payload.old) as Record<string, unknown> | null;
        emitEvent(table, {
          entityId: typeof row?.id === "string" ? row.id : undefined,
          sessionId: typeof row?.id === "string" && table === "Session" ? row.id : undefined,
          updatedAt:
            typeof row?.updatedAt === "string"
              ? row.updatedAt
              : row?.updatedAt instanceof Date
                ? row.updatedAt.toISOString()
                : undefined,
          eventId: `${table}:${payload.commit_timestamp ?? Date.now()}`
        });
      }
    )
    .subscribe((status) => {
      emitHealth(table, status === "SUBSCRIBED");
    });
}

function subscribeTable(
  table: string,
  onEvent: Listener,
  onHealthChange: HealthListener
): Unsubscribe {
  const key = tableKey(table);
  if (!listenersByTable.has(key)) listenersByTable.set(key, new Set());
  if (!healthByTable.has(key)) healthByTable.set(key, new Set());
  listenersByTable.get(key)!.add(onEvent);
  healthByTable.get(key)!.add(onHealthChange);
  ensureChannel(table);

  return () => {
    listenersByTable.get(key)?.delete(onEvent);
    healthByTable.get(key)?.delete(onHealthChange);
    onHealthChange(false);
  };
}

export function subscribeSupabaseClubState(onSessionChanged: Listener): Unsubscribe {
  return subscribeTable("Session", onSessionChanged, markClubPushHealthy);
}

export function subscribeSupabaseChat(onMessage: Listener): Unsubscribe {
  return subscribeTable("ChatMessage", onMessage, markChatPushHealthy);
}

export function subscribeSupabasePlayers(onPlayerChanged: Listener): Unsubscribe {
  return subscribeTable("Player", onPlayerChanged, () => undefined);
}

export function subscribeSupabaseReservations(onChange: Listener): Unsubscribe {
  return subscribeTable("CourtReservation", onChange, () => undefined);
}
