import Dexie, { type Table } from "dexie";
import type { Court, Match, Player, Session } from "./types";

export type SyncQueueItem = {
  id: string;
  actionType: string;
  entityType: string;
  entityId: string;
  payload: unknown;
  status: "Pending" | "Syncing" | "Synced" | "Failed" | "Conflict";
  createdAt: string;
};

class PicklePulseDb extends Dexie {
  players!: Table<Player, string>;
  courts!: Table<Court, string>;
  matches!: Table<Match, string>;
  sessions!: Table<Session, string>;
  syncQueue!: Table<SyncQueueItem, string>;

  constructor() {
    super("haff-picklepulse");
    this.version(2).stores({
      players: "id, displayName, checkedIn",
      courts: "id, number, status",
      matches: "id, courtId, status, syncStatus",
      sessions: "id, name, status",
      syncQueue: "id, entityType, entityId, status"
    });
  }
}

export const db = new PicklePulseDb();


export const seedPlayers: Player[] = [
  ["Juan Dela Cruz", "Intermediate", 4],
  ["Maria Santos", "Pro", 6],
  ["Alex Tan", "Pro", 6],
  ["Kim Reyes", "Low Intermediate", 3],
  ["Paolo Lim", "Novice", 2],
  ["Bea Garcia", "Beginner", 1],
  ["Carlo Cruz", "Newbie", 0.5],
  ["Nina Yu", "Intermediate", 4],
  ["Luis Ramos", "Low Intermediate", 3],
  ["Mark Flores", "Pro", 6]
].map(([displayName, skillLevel, rating], index) => ({
  id: `player-${index + 1}`,
  displayName: displayName as string,
  skillLevel: skillLevel as Player["skillLevel"],
  rating: rating as number,
  tags: index % 3 === 0 ? ["Regular"] : [],
  checkedIn: index < 8,
  parked: false,
  totalGamesPlayed: 8 + index * 3,
  totalDaysPlayed: 3 + index,
  lastPlayedDate: "2026-06-04",
  isActive: true
}));

export const demoPlayerAccount: Player = {
  id: "player-haff-demo",
  displayName: "Giana Ibo",
  fullName: "Giana Ibo",
  skillLevel: "Beginner",
  rating: 1,
  tags: ["Member"],
  checkedIn: false,
  parked: false,
  totalGamesPlayed: 0,
  totalDaysPlayed: 0,
  isActive: true,
  phoneNumber: "09170000000",
  accessCode: "1234",
  preferredPlayStyle: "Casual open play"
};

export const seedCourts: Court[] = [1, 2, 3, 4].map((number) => ({
  id: `court-${number}`,
  name: `Court ${number}`,
  number,
  status: "Available"
}));
