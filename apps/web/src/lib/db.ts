import type { Court, Match, Player, Session, Reservation, Transaction } from "./types";

export type SyncQueueItem = {
  id: string;
  idempotencyKey: string;
  deviceId: string;
  actorId?: string;
  actionType: string;
  entityType: string;
  entityId: string;
  baseVersion?: number;
  payload: unknown;
  status: "Pending" | "Syncing" | "Synced" | "Failed" | "Conflict";
  retryCount: number;
  createdAt: string;
};

// Mock table that just does nothing
class MockTable<T> {
  async toArray(): Promise<T[]> { return []; }
  async clear() {}
  async bulkPut(items: T[]) {}
  async put(item: T) {}
  async delete(id: any) {}
  async bulkDelete(ids: any[]) {}
  async add(item: T) {}
  async count(): Promise<number> { return 0; }
  where(key: any) { return this; }
  anyOf(keys: any[]) { return this; }
  equals(val: any) { return this; }
  modify(changes: any) {}
  async deleteMany() {}
  async first(): Promise<T | undefined> { return undefined; }
  toCollection() { return this; }
  async update(key: any, changes: any) { return 0; }
}

export const db = {
  players: new MockTable<Player>(),
  courts: new MockTable<Court>(),
  matches: new MockTable<Match>(),
  sessions: new MockTable<Session>(),
  syncQueue: new MockTable<SyncQueueItem>(),
  reservations: new MockTable<Reservation>(),
  transactions: new MockTable<Transaction>(),
  transaction: async (mode: any, tables: any, cb: () => any) => { return cb(); }
};

export function getDeviceId() {
  return "online-only-device";
}

export const seedCourts: Court[] = [1, 2, 3].map((number) => ({
  id: `court-${number}`,
  name: `Court ${number}`,
  number,
  priority: number,
  reservable: true,
  status: "Available"
}));
