#!/usr/bin/env node
/**
 * Restore roster + user account links from a canonical players JSON export.
 * Usage:
 *   node scripts/restore-club-state.mjs data/production-players.json
 *   node scripts/restore-club-state.mjs data/production-players.json --prune-orphans
 *   node scripts/restore-club-state.mjs data/production-players.json --clear-sessions
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";

const file = process.argv[2];
const pruneOrphans = process.argv.includes("--prune-orphans");
const clearSessions = process.argv.includes("--clear-sessions");

if (!file) {
  console.error("Usage: node scripts/restore-club-state.mjs <players.json> [--prune-orphans] [--clear-sessions]");
  process.exit(1);
}

const prisma = new PrismaClient();
const payload = JSON.parse(readFileSync(file, "utf8"));
const rows = Array.isArray(payload) ? payload : payload.players;
if (!Array.isArray(rows) || rows.length === 0) {
  console.error("JSON must be an array or { players: [] }");
  process.exit(1);
}

function pickString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function pickNumber(...values) {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return 0;
}

async function main() {
  const canonicalIds = new Set(rows.map((row) => String(row.id)).filter(Boolean));
  let upserted = 0;

  for (const row of rows) {
    const id = String(row.id ?? "");
    if (!id) continue;

    const avatarUrl = pickString(row.avatarUrl);
    const data = {
      displayName: String(row.displayName ?? "Player"),
      fullName: pickString(row.fullName, row.displayName),
      nickname: typeof row.nickname === "string" ? row.nickname : null,
      skillLevel: String(row.skillLevel ?? "Beginner"),
      rating: typeof row.rating === "number" ? row.rating : 2,
      avatarUrl: avatarUrl && !avatarUrl.startsWith("data:") ? avatarUrl : null,
      avatarVersion: typeof row.avatarVersion === "number" ? row.avatarVersion : 1,
      statusNote: pickString(row.statusNote),
      phone: pickString(row.phone, row.phoneNumber),
      email: typeof row.email === "string" ? row.email.trim().toLowerCase() : null,
      tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
      status: row.status === "Inactive" ? "Inactive" : "Active",
      totalGamesPlayed: pickNumber(row.totalGamesPlayed),
      totalPointsScored: pickNumber(row.totalPointsScored),
      totalPointsAgainst: pickNumber(row.totalPointsAgainst),
      totalDaysPlayed: pickNumber(row.totalDaysPlayed),
      currentPlayDayStreak: pickNumber(row.currentPlayDayStreak),
      bestPlayDayStreak: pickNumber(row.bestPlayDayStreak),
      lastPlayedDate: row.lastPlayedDate ? new Date(row.lastPlayedDate) : null,
      version: typeof row.version === "number" ? row.version : 1
    };

    await prisma.player.upsert({ where: { id }, create: { id, ...data }, update: data });
    upserted += 1;
  }

  let orphansRemoved = 0;
  if (pruneOrphans) {
    const remaining = await prisma.player.findMany({ select: { id: true } });
    for (const player of remaining) {
      if (!canonicalIds.has(player.id)) {
        await prisma.user.updateMany({ where: { playerId: player.id }, data: { playerId: null } });
        await prisma.player.delete({ where: { id: player.id } }).catch(() => {});
        orphansRemoved += 1;
      }
    }
  }

  const users = await prisma.user.findMany({
    where: { playerId: { not: null } },
    include: { player: { select: { email: true, displayName: true } } }
  });
  let usersRepointed = 0;
  for (const user of users) {
    const match = await prisma.player.findFirst({
      where: { email: { equals: user.email, mode: "insensitive" } },
      select: { id: true }
    });
    if (match && user.playerId !== match.id) {
      await prisma.user.update({ where: { id: user.id }, data: { playerId: match.id } });
      usersRepointed += 1;
    }
  }

  for (const user of users) {
    if (!user.playerId) continue;
    await prisma.user.update({
      where: { id: user.id },
      data: { playerId: user.playerId }
    });
  }

  const allUsers = await prisma.user.findMany({ select: { id: true, email: true, playerId: true } });
  for (const user of allUsers) {
    const match = await prisma.player.findFirst({
      where: { email: { equals: user.email, mode: "insensitive" } },
      select: { id: true }
    });
    if (match && user.playerId !== match.id) {
      await prisma.user.update({ where: { id: user.id }, data: { playerId: match.id } });
      usersRepointed += 1;
    }
  }

  let sessionsCleared = 0;
  if (clearSessions) {
    const result = await prisma.authSession.deleteMany();
    sessionsCleared = result.count;
  }

  const finalCount = await prisma.player.count();
  const withAvatar = await prisma.player.count({
    where: { AND: [{ avatarUrl: { not: null } }, { NOT: { avatarUrl: "" } }] }
  });

  console.log("Club state restore complete:");
  console.log(`  Source: ${file}`);
  console.log(`  Players upserted: ${upserted}`);
  console.log(`  Orphan players removed: ${orphansRemoved}`);
  console.log(`  User → player links fixed: ${usersRepointed}`);
  if (clearSessions) console.log(`  Auth sessions cleared: ${sessionsCleared}`);
  console.log(`  Final roster size: ${finalCount}`);
  console.log(`  Players with avatar URLs: ${withAvatar}`);
}

await main();
await prisma.$disconnect();
