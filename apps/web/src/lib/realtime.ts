import { Realtime } from "ably";
import { apiUrl } from "./api";
import { useSupabaseData } from "./dataSource";
import { markChatPushHealthy, markClubPushHealthy } from "./syncPolicy";
import {
  subscribeSupabaseChat,
  subscribeSupabaseClubState
} from "./supabase/realtime";

export type RealtimeEvent = {
  entityId?: string;
  version?: number;
  eventId?: string;
  sessionId?: string;
  updatedAt?: string;
};

function realtimeFlag(name: "VITE_REALTIME_CHAT" | "VITE_REALTIME_CLUB", defaultValue: boolean) {
  const value = (import.meta as any).env?.[name] as string | undefined;
  if (value === undefined) return defaultValue;
  return value === "true";
}

function subscribeAblyChannel(
  channelName: string,
  scope: string,
  onEvent: (event: RealtimeEvent) => void,
  onHealthChange: (healthy: boolean) => void
) {
  const client = new Realtime({
    authUrl: apiUrl(`/api/realtime/token?scope=${encodeURIComponent(scope)}`),
    authMethod: "GET"
  });

  const setHealthy = (healthy: boolean) => onHealthChange(healthy);

  client.connection.on("connected", () => setHealthy(true));
  client.connection.on("disconnected", () => setHealthy(false));
  client.connection.on("failed", () => setHealthy(false));
  client.connection.on("suspended", () => setHealthy(false));

  const channel = client.channels.get(channelName);
  const seen = new Set<string>();
  const listener = (message: { id?: string; data?: RealtimeEvent }) => {
    const key = message.data?.eventId ?? message.id;
    if (key && seen.has(key)) return;
    if (key) {
      seen.add(key);
      if (seen.size > 300) seen.delete(seen.values().next().value as string);
    }
    onEvent(message.data ?? {});
  };
  void channel.subscribe(listener);

  return () => {
    setHealthy(false);
    void channel.unsubscribe(listener);
    client.close();
  };
}

export function subscribeToChannel(
  channelName: string,
  onEvent: (event: RealtimeEvent) => void,
  scope = "community"
) {
  if (useSupabaseData()) {
    if (!realtimeFlag("VITE_REALTIME_CHAT", false)) return () => undefined;
    return subscribeSupabaseChat(onEvent);
  }
  if (!realtimeFlag("VITE_REALTIME_CHAT", false)) return () => undefined;
  return subscribeAblyChannel(channelName, scope, onEvent, markChatPushHealthy);
}

/** Push sync for live session state — Supabase Realtime or Ably fallback. */
export function subscribeToClubState(
  onSessionChanged: (event: RealtimeEvent) => void,
  options?: { tv?: boolean }
) {
  if (useSupabaseData()) {
    if (!realtimeFlag("VITE_REALTIME_CLUB", true)) return () => undefined;
    return subscribeSupabaseClubState(onSessionChanged);
  }
  if (!realtimeFlag("VITE_REALTIME_CLUB", true)) return () => undefined;

  const scope = options?.tv ? "tv" : "club";
  const channel = options?.tv ? "haff:operations:tv" : "haff:operations:club";
  return subscribeAblyChannel(channel, scope, onSessionChanged, markClubPushHealthy);
}
