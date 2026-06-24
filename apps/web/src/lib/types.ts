export type SkillLevel = "Newbie" | "Beginner" | "Novice" | "Low Intermediate" | "Intermediate" | "Pro";
export type MatchStatus = "Queued" | "Assigned" | "InProgress" | "Completed";
export type SyncStatus = "LocalOnly" | "PendingSync" | "Synced" | "Conflict";

export type TvBroadcastKind = "message" | "court" | "overtime" | "config";

export type TvBroadcast = {
  id: string;
  kind: TvBroadcastKind;
  createdAt: string;
  message?: string;
  courtId?: string;
  courtName?: string;
  participantIds?: string[];
  variant?: "active" | "reserved";
  matchDurationMinutes?: number;
  clubStatus?: string;
};

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
  version?: number;
};

export type Player = {
  id: string;
  displayName: string;
  fullName?: string;
  skillLevel: SkillLevel;
  rating: number;
  tags: string[];
  checkedIn: boolean;
  totalGamesPlayed: number;
  totalCourtSeconds?: number;
  totalDaysPlayed: number;
  lastPlayedDate?: string;
  isActive?: boolean;
  notes?: string;
  phoneNumber?: string;
  accessCode?: string;
  emergencyNote?: string;
  preferredPlayStyle?: string;
  avatarUrl?: string;
  statusNote?: string;
  isVacant?: boolean;
  isReservedSlot?: boolean;
  version?: number;
};

export type Court = {
  id: string;
  name: string;
  number: number;
  priority?: number;
  reservable?: boolean;
  status: "Available" | "Assigned" | "InUse" | "Paused" | "Maintenance" | "Reserved";
  locked?: boolean;
  currentMatchId?: string;
  reservedFor?: string;
  reservedPlayerIds?: string[];
  version?: number;
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
  timerPausedAt?: string;
  endedAt?: string;
  syncStatus: SyncStatus;
  mode?: "Assigned" | "Reserved";
  version?: number;
};

export type Toast = {
  id: string;
  title: string;
  message: string;
  tone: "system" | "fun" | "achievement";
};

export type Reservation = {
  id: string;
  title?: string;
  notes?: string;
  courtId: string;
  startTime: string;
  endTime: string;
  hostPlayerId: string;
  hostDisplayName?: string;
  playerIds: string[];
  status: "Requested" | "Confirmed" | "Rejected" | "Cancelled" | "NoShow";
  paymentStatus: "Paid" | "Pending" | "Refunded";
  feeAmount: number;
  cancellationReason?: string;
  seriesId?: string;
};

export type Transaction = {
  id: string;
  playerId: string;
  amount: number;
  type: "CheckInFee" | "CourtReservation" | "SessionPass";
  paymentMethod: "Cash" | "GCash" | "Maya" | "Card" | "EWallet";
  status: "Pending" | "Success" | "Failed" | "Voided";
  timestamp: string;
  referenceNote?: string;
  sessionId?: string;
  reservationId?: string;
  voidReason?: string;
  voidedAt?: string;
};

export type Testimonial = {
  id: string;
  quote: string;
  rating: number;
  displayName: string;
};

export type Achievement = {
  id: string;
  title: string;
  value: string;
  desc: string;
};

export type Announcement = {
  id: string;
  title: string;
  content: string;
  date: string;
  imageUrl?: string;
  linkUrl?: string;
  isPopup?: boolean;
  expiresAt?: string;
};
