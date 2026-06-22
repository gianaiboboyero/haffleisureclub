import { useSupabaseData } from "./dataSource";
import { markChatPushHealthy, markClubPushHealthy } from "./syncPolicy";
import {
  subscribeSupabaseChat,
  subscribeSupabaseClubState,
  subscribeSupabasePlayers
} from "./supabase/realtime";

export { subscribeSupabasePlayers };

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

export function subscribeToChannel(
  _channelName: string,
  onEvent: (event: RealtimeEvent) => void,
  _scope = "community"
) {
  if (!useSupabaseData()) return () => undefined;
  if (!realtimeFlag("VITE_REALTIME_CHAT", false)) return () => undefined;
  return subscribeSupabaseChat(onEvent);
}

/** Push sync for live session state via Supabase Realtime. */
export function subscribeToClubState(
  onSessionChanged: (event: RealtimeEvent) => void,
  _options?: { tv?: boolean }
) {
  if (!realtimeFlag("VITE_REALTIME_CLUB", true)) return () => undefined;
  const unsubscribe = subscribeSupabaseClubState(onSessionChanged);
  markClubPushHealthy(true);
  return () => {
    markClubPushHealthy(false);
    unsubscribe();
  };
}

export function subscribeToChannelNoop(
  _channelName: string,
  _onEvent: (event: RealtimeEvent) => void
) {
  return () => undefined;
}

// Keep chat health marker accessible
export { markChatPushHealthy };
