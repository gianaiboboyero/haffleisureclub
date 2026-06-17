import { Realtime } from "ably";
import { apiUrl } from "./api";

export type RealtimeEvent = {
  entityId?: string;
  version?: number;
  eventId?: string;
};

export function subscribeToChannel(
  channelName: string,
  onEvent: (event: RealtimeEvent) => void,
  scope = "community"
) {
  const enabled = (((import.meta as any).env?.VITE_REALTIME_CHAT) ?? "false") === "true";
  if (!enabled) return () => undefined;

  const client = new Realtime({
    authUrl: apiUrl(`/api/realtime/token?scope=${encodeURIComponent(scope)}`),
    authMethod: "GET"
  });
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
    void channel.unsubscribe(listener);
    client.close();
  };
}
