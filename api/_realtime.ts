import { Rest } from "ably";

const apiKey = process.env.ABLY_API_KEY?.trim();
const client = apiKey ? new Rest({ key: apiKey }) : null;

export async function publishRealtime(channel: string, name: string, data: Record<string, unknown>) {
  if (!client) return;
  try {
    await client.channels.get(channel).publish(name, data);
  } catch (error) {
    console.warn("Realtime publish failed; clients will use polling.", error);
  }
}
