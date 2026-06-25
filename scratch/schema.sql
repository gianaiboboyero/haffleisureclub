-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DISABLED');

-- CreateEnum
CREATE TYPE "TestimonialStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "OperationEventStatus" AS ENUM ('PENDING', 'APPLIED', 'CONFLICT', 'FAILED');

-- CreateEnum
CREATE TYPE "ReservationApprovalStatus" AS ENUM ('REQUESTED', 'AWAITING_PAYMENT', 'CONFIRMED', 'REJECTED', 'CANCELLED', 'NO_SHOW', 'PAYMENT_ISSUE');

-- CreateEnum
CREATE TYPE "ReservationPaymentStatus" AS ENUM ('PENDING', 'PAID', 'REFUNDED', 'VOIDED');

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "fullName" TEXT,
    "nickname" TEXT,
    "skillLevel" TEXT NOT NULL,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 2,
    "avatarUrl" TEXT,
    "avatarVersion" INTEGER NOT NULL DEFAULT 1,
    "statusNote" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'Active',
    "totalGamesPlayed" INTEGER NOT NULL DEFAULT 0,
    "totalCourtSeconds" INTEGER NOT NULL DEFAULT 0,
    "totalPointsScored" INTEGER NOT NULL DEFAULT 0,
    "totalPointsAgainst" INTEGER NOT NULL DEFAULT 0,
    "totalDaysPlayed" INTEGER NOT NULL DEFAULT 0,
    "currentPlayDayStreak" INTEGER NOT NULL DEFAULT 0,
    "bestPlayDayStreak" INTEGER NOT NULL DEFAULT 0,
    "lastPlayedDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Court" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Available',
    "currentMatchId" TEXT,
    "nextMatchId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Court_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "location" TEXT,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "courtIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "checkedInPlayerIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "settings" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT,
    "courtId" TEXT,
    "mode" TEXT NOT NULL,
    "teamAPlayerIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "teamBPlayerIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "scoreA" INTEGER NOT NULL DEFAULT 0,
    "scoreB" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'Queued',
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "durationSeconds" INTEGER,
    "syncStatus" TEXT NOT NULL DEFAULT 'PendingSync',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncEvent" (
    "id" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "syncedAt" TIMESTAMP(3),

    CONSTRAINT "SyncEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "icon" TEXT,
    "soundKey" TEXT,
    "displayTarget" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourtReservationSetting" (
    "id" TEXT NOT NULL,
    "courtId" TEXT NOT NULL,
    "reservationsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "openingTime" TEXT NOT NULL DEFAULT '06:00',
    "closingTime" TEXT NOT NULL DEFAULT '22:00',
    "minDurationMinutes" INTEGER NOT NULL DEFAULT 30,
    "maxDurationMinutes" INTEGER NOT NULL DEFAULT 180,
    "intervalMinutes" INTEGER NOT NULL DEFAULT 30,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourtReservationSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourtAllocation" (
    "id" TEXT NOT NULL,
    "courtId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL DEFAULT '15:00',
    "endTime" TEXT NOT NULL DEFAULT '23:00',
    "mode" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourtAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourtBlackout" (
    "id" TEXT NOT NULL,
    "courtId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourtBlackout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourtReservation" (
    "id" TEXT NOT NULL,
    "courtId" TEXT NOT NULL,
    "requesterUserId" TEXT NOT NULL,
    "hostPlayerId" TEXT,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "publicLabel" TEXT,
    "participantPlayerIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "feeAmount" DOUBLE PRECISION NOT NULL DEFAULT 300,
    "approvalStatus" "ReservationApprovalStatus" NOT NULL DEFAULT 'REQUESTED',
    "paymentStatus" "ReservationPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "transactionId" TEXT,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedByUserId" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "cancelledByUserId" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "seriesId" TEXT,
    "recurrenceRule" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'PRIVATE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourtReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserNotification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'MEMBER',
    "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "playerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "replyToId" TEXT,
    "editedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatReaction" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatReaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatReport" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Testimonial" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "playerId" TEXT,
    "quote" TEXT NOT NULL,
    "rating" INTEGER,
    "status" "TestimonialStatus" NOT NULL DEFAULT 'PENDING',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Testimonial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImprovementReport" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "contact" TEXT,
    "sourceHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImprovementReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperationEvent" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "baseVersion" INTEGER,
    "payload" JSONB NOT NULL,
    "clientAt" TIMESTAMP(3) NOT NULL,
    "status" "OperationEventStatus" NOT NULL DEFAULT 'PENDING',
    "result" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedAt" TIMESTAMP(3),

    CONSTRAINT "OperationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Session_status_date_idx" ON "Session"("status", "date");

-- CreateIndex
CREATE INDEX "Match_sessionId_status_idx" ON "Match"("sessionId", "status");

-- CreateIndex
CREATE INDEX "Match_courtId_status_idx" ON "Match"("courtId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CourtReservationSetting_courtId_key" ON "CourtReservationSetting"("courtId");

-- CreateIndex
CREATE INDEX "CourtAllocation_date_mode_idx" ON "CourtAllocation"("date", "mode");

-- CreateIndex
CREATE UNIQUE INDEX "CourtAllocation_courtId_date_startTime_key" ON "CourtAllocation"("courtId", "date", "startTime");

-- CreateIndex
CREATE INDEX "CourtBlackout_courtId_startTime_endTime_idx" ON "CourtBlackout"("courtId", "startTime", "endTime");

-- CreateIndex
CREATE INDEX "CourtReservation_courtId_startTime_endTime_idx" ON "CourtReservation"("courtId", "startTime", "endTime");

-- CreateIndex
CREATE INDEX "CourtReservation_requesterUserId_createdAt_idx" ON "CourtReservation"("requesterUserId", "createdAt");

-- CreateIndex
CREATE INDEX "CourtReservation_approvalStatus_startTime_idx" ON "CourtReservation"("approvalStatus", "startTime");

-- CreateIndex
CREATE INDEX "CourtReservation_seriesId_idx" ON "CourtReservation"("seriesId");

-- CreateIndex
CREATE INDEX "UserNotification_userId_createdAt_idx" ON "UserNotification"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_playerId_key" ON "User"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "AuthSession_tokenHash_key" ON "AuthSession"("tokenHash");

-- CreateIndex
CREATE INDEX "AuthSession_userId_idx" ON "AuthSession"("userId");

-- CreateIndex
CREATE INDEX "AuthSession_expiresAt_idx" ON "AuthSession"("expiresAt");

-- CreateIndex
CREATE INDEX "ChatMessage_createdAt_idx" ON "ChatMessage"("createdAt");

-- CreateIndex
CREATE INDEX "ChatMessage_authorId_idx" ON "ChatMessage"("authorId");

-- CreateIndex
CREATE INDEX "ChatMessage_createdAt_id_idx" ON "ChatMessage"("createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ChatReaction_messageId_userId_emoji_key" ON "ChatReaction"("messageId", "userId", "emoji");

-- CreateIndex
CREATE INDEX "ChatReport_status_createdAt_idx" ON "ChatReport"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChatReport_messageId_reporterId_key" ON "ChatReport"("messageId", "reporterId");

-- CreateIndex
CREATE INDEX "Testimonial_status_featured_idx" ON "Testimonial"("status", "featured");

-- CreateIndex
CREATE INDEX "ImprovementReport_sourceHash_createdAt_idx" ON "ImprovementReport"("sourceHash", "createdAt");

-- CreateIndex
CREATE INDEX "ImprovementReport_status_createdAt_idx" ON "ImprovementReport"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "OperationEvent_idempotencyKey_key" ON "OperationEvent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "OperationEvent_actorId_createdAt_idx" ON "OperationEvent"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "OperationEvent_status_createdAt_idx" ON "OperationEvent"("status", "createdAt");

-- CreateIndex
CREATE INDEX "OperationEvent_entityType_entityId_idx" ON "OperationEvent"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "CourtReservationSetting" ADD CONSTRAINT "CourtReservationSetting_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "Court"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourtAllocation" ADD CONSTRAINT "CourtAllocation_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "Court"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourtBlackout" ADD CONSTRAINT "CourtBlackout_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "Court"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourtReservation" ADD CONSTRAINT "CourtReservation_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "Court"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourtReservation" ADD CONSTRAINT "CourtReservation_requesterUserId_fkey" FOREIGN KEY ("requesterUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourtReservation" ADD CONSTRAINT "CourtReservation_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourtReservation" ADD CONSTRAINT "CourtReservation_rejectedByUserId_fkey" FOREIGN KEY ("rejectedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourtReservation" ADD CONSTRAINT "CourtReservation_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserNotification" ADD CONSTRAINT "UserNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "ChatMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatReaction" ADD CONSTRAINT "ChatReaction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatReaction" ADD CONSTRAINT "ChatReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatReport" ADD CONSTRAINT "ChatReport_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatReport" ADD CONSTRAINT "ChatReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Testimonial" ADD CONSTRAINT "Testimonial_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Testimonial" ADD CONSTRAINT "Testimonial_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationEvent" ADD CONSTRAINT "OperationEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

