DO $$ BEGIN CREATE TYPE "Role" AS ENUM ('ADMIN', 'MEMBER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DISABLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "TestimonialStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'RESOLVED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "OperationEventStatus" AS ENUM ('PENDING', 'APPLIED', 'CONFLICT', 'FAILED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role" USING ("role"::text::"Role");
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'MEMBER';
ALTER TABLE "User" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "status" TYPE "AccountStatus" USING ("status"::text::"AccountStatus");
ALTER TABLE "User" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

ALTER TABLE "Testimonial" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Testimonial" ALTER COLUMN "status" TYPE "TestimonialStatus" USING ("status"::text::"TestimonialStatus");
ALTER TABLE "Testimonial" ALTER COLUMN "status" SET DEFAULT 'PENDING';

ALTER TABLE "ChatReport" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "ChatReport" ALTER COLUMN "status" TYPE "ReportStatus" USING ("status"::text::"ReportStatus");
ALTER TABLE "ChatReport" ALTER COLUMN "status" SET DEFAULT 'OPEN';

ALTER TABLE "Player" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Court" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Match" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "CourtReservation" ADD COLUMN IF NOT EXISTS "publicLabel" TEXT;

CREATE TABLE IF NOT EXISTS "AuditLog" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "OperationEvent" (
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
  CONSTRAINT "OperationEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OperationEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "OperationEvent_idempotencyKey_key" ON "OperationEvent"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "OperationEvent_actorId_createdAt_idx" ON "OperationEvent"("actorId", "createdAt");
CREATE INDEX IF NOT EXISTS "OperationEvent_status_createdAt_idx" ON "OperationEvent"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "OperationEvent_entityType_entityId_idx" ON "OperationEvent"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "ChatMessage_createdAt_id_idx" ON "ChatMessage"("createdAt", "id");
CREATE INDEX IF NOT EXISTS "ChatReport_status_createdAt_idx" ON "ChatReport"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "Match_sessionId_status_idx" ON "Match"("sessionId", "status");
CREATE INDEX IF NOT EXISTS "Match_courtId_status_idx" ON "Match"("courtId", "status");
CREATE INDEX IF NOT EXISTS "Session_status_date_idx" ON "Session"("status", "date");
CREATE INDEX IF NOT EXISTS "Testimonial_status_featured_idx" ON "Testimonial"("status", "featured");
