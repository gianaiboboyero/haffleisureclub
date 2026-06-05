export type SkillLevel = "Newbie" | "Beginner" | "Novice" | "Low Intermediate" | "Intermediate" | "Pro";
export type MatchStatus = "Queued" | "Assigned" | "InProgress" | "Completed";
export type SyncStatus = "LocalOnly" | "PendingSync" | "Synced" | "Conflict";

export type Session = {
  id: string;
  name: string;
  date: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  mode: string;
  status: "Draft" | "Active" | "Completed";
  courtIds: string[];
  checkedInPlayerIds: string[];
  settings: Record<string, any>;
};

export type Player = {
  id: string;
  displayName: string;
  fullName?: string;
  skillLevel: SkillLevel;
  rating: number;
  tags: string[];
  checkedIn: boolean;
  parked?: boolean;
  totalGamesPlayed: number;
  totalDaysPlayed: number;
  lastPlayedDate?: string;
  isActive?: boolean;
  notes?: string;
  phoneNumber?: string;
  accessCode?: string;
  emergencyNote?: string;
  preferredPlayStyle?: string;
  avatarUrl?: string;
};

export type Court = {
  id: string;
  name: string;
  number: number;
  status: "Available" | "InUse" | "Paused" | "Maintenance" | "Reserved";
  currentMatchId?: string;
  reservedFor?: string;
  reservedPlayerIds?: string[];
};

export type Match = {
  id: string;
  courtId: string;
  teamAPlayerIds: string[];
  teamBPlayerIds: string[];
  scoreA: number;
  scoreB: number;
  status: MatchStatus;
  startedAt?: string;
  endedAt?: string;
  syncStatus: SyncStatus;
};

export type Toast = {
  id: string;
  title: string;
  message: string;
  tone: "system" | "fun" | "achievement";
};
