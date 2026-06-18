import { getSupabase } from "./client";
import { markChatPushHealthy, markClubPushHealthy } from "../syncPolicy";
import type { RealtimeEvent } from "../realtime";

type Unsubscribe = () => void;

function subscribeTable(
  table: string,
  onEvent: (event: RealtimeEvent) => void,
  onHealthChange: (healthy: boolean) => void
): Unsubscribe {
  const supabase = getSupabase();
  if (!supabase) return () => undefined;

  const channel = supabase
    .channel(`haff-${table.toLowerCase()}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table },
      (payload) => {
        const row = (payload.new ?? payload.old) as Record<string, unknown> | null;
        onEvent({
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
      const healthy = status === "SUBSCRIBED";
      onHealthChange(healthy);
    });

  return () => {
    onHealthChange(false);
    void supabase.removeChannel(channel);
  };
}

export function subscribeSupabaseClubState(onSessionChanged: (event: RealtimeEvent) => void): Unsubscribe {
  return subscribeTable("Session", onSessionChanged, markClubPushHealthy);
}

export function subscribeSupabaseChat(onMessage: (event: RealtimeEvent) => void): Unsubscribe {
  return subscribeTable("ChatMessage", onMessage, markChatPushHealthy);
}

export function subscribeSupabasePlayers(onPlayerChanged: (event: RealtimeEvent) => void): Unsubscribe {
  return subscribeTable("Player", onPlayerChanged, () => undefined);
}
