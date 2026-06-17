import Dexie, { type Table } from "dexie";
import type { Court, Match, Player, Session, Reservation, Transaction } from "./types";
import { generateId } from "./utils";

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

class PicklePulseDb extends Dexie {
  players!: Table<Player, string>;
  courts!: Table<Court, string>;
  matches!: Table<Match, string>;
  sessions!: Table<Session, string>;
  syncQueue!: Table<SyncQueueItem, string>;
  reservations!: Table<Reservation, string>;
  transactions!: Table<Transaction, string>;

  constructor() {
    super("haff-picklepulse");
    this.version(3).stores({
      players: "id, displayName, checkedIn",
      courts: "id, number, status",
      matches: "id, courtId, status, syncStatus",
      sessions: "id, name, status",
      syncQueue: "id, entityType, entityId, status",
      reservations: "id, courtId, startTime, status",
      transactions: "id, playerId, type, status, timestamp"
    });
    this.version(4)
      .stores({
        players: "id, displayName, checkedIn",
        courts: "id, number, status",
        matches: "id, courtId, status, syncStatus",
        sessions: "id, name, status",
        syncQueue: "id, entityType, entityId, status",
        reservations: "id, courtId, startTime, status",
        transactions: "id, playerId, type, status, timestamp"
      })
      .upgrade(async (transaction) => {
        await Promise.all([
          transaction.table("players").clear(),
          transaction.table("matches").clear(),
          transaction.table("reservations").clear(),
          transaction.table("transactions").clear()
        ]);
        await transaction
          .table("syncQueue")
          .where("entityType")
          .anyOf(["Player", "Match", "Reservation", "Transaction"])
          .delete();
        await transaction.table("sessions").toCollection().modify((session) => {
          session.checkedInPlayerIds = [];
        });
      });
    this.version(5)
      .stores({
        players: "id, displayName, checkedIn",
        courts: "id, number, status",
        matches: "id, courtId, status, syncStatus",
        sessions: "id, name, status",
        syncQueue: "id, idempotencyKey, entityType, entityId, status, createdAt",
        reservations: "id, courtId, startTime, status",
        transactions: "id, playerId, type, status, timestamp"
      })
      .upgrade(async (transaction) => {
        const deviceId = getDeviceId();
        await transaction.table("syncQueue").toCollection().modify((item) => {
          item.idempotencyKey ??= item.id;
          item.deviceId ??= deviceId;
          item.retryCount ??= 0;
        });
      });
  }
}

export const db = new PicklePulseDb();

export function getDeviceId() {
  const key = "haff-device-id";
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const id = generateId();
  localStorage.setItem(key, id);
  return id;
}


export const seedCourts: Court[] = [1, 2, 3].map((number) => ({
  id: `court-${number}`,
  name: `Court ${number}`,
  number,
  priority: number,
  reservable: true,
  status: "Available"
}));
