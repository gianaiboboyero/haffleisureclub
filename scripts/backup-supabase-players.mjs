#!/usr/bin/env node
/**
 * Backup all critical Supabase tables to data/full-backup-<date>.json
 *
 * Tables covered:
 *   - Player      (full)
 *   - User        (id, email, role, playerId, status — NO passwordHash)
 *   - AuditLog    (full)
 *   - CourtReservation (full)
 *   - AdminConfig  (keys only — values omitted for security)
 *
 * Run: node scripts/backup-supabase-players.mjs
 *      npm run db:backup-players
 */
import { PrismaClient } from "@prisma/client";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const prisma = new PrismaClient();
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const outPath = join(root, "data", `full-backup-${timestamp}.json`);

// Also keep a stable "latest" alias for the players-only consumers
const legacyOutPath = join(root, "data", "players-backup.json");

const [players, users, auditLogs, reservations, adminConfigKeys] = await Promise.all([
  prisma.player.findMany({ orderBy: { displayName: "asc" } }),
  prisma.user.findMany({
    select: { id: true, email: true, role: true, playerId: true, status: true, createdAt: true }
  }),
  prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 10_000 }),
  prisma.courtReservation
    ? prisma.courtReservation.findMany({ orderBy: { startTime: "asc" } })
    : Promise.resolve([]),
  prisma.adminConfig
    ? prisma.adminConfig.findMany({ select: { key: true } }) // omit values — security sensitive
    : Promise.resolve([])
]);

const backup = {
  exportedAt: new Date().toISOString(),
  counts: {
    players: players.length,
    users: users.length,
    auditLogs: auditLogs.length,
    reservations: reservations.length,
    adminConfigKeys: adminConfigKeys.length
  },
  players,
  users,       // NOTE: passwordHash excluded by select()
  auditLogs,
  reservations,
  adminConfigKeys // NOTE: values omitted — only key names
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(backup, null, 2));

// Maintain legacy file for import-players-from-json.mjs compatibility
writeFileSync(legacyOutPath, JSON.stringify(
  { exportedAt: backup.exportedAt, count: players.length, players },
  null, 2
));

console.log(`✅ Full backup → ${outPath}`);
console.log(`   Players: ${players.length}`);
console.log(`   Users: ${users.length} (no password hashes)`);
console.log(`   Audit log entries: ${auditLogs.length}`);
console.log(`   Reservations: ${reservations.length}`);
console.log(`   AdminConfig keys: ${adminConfigKeys.length} (values omitted)`);

await prisma.$disconnect();

