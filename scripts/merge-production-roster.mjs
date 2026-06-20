#!/usr/bin/env node
/**
 * Merge the canonical production roster (haffleisureclub.vercel.app) into Supabase.
 * - Upserts all production Player rows (keeps avatars, stats, status notes)
 * - Repoints User.playerId when a duplicate local row shares the same display name
 * - Removes duplicate local Player rows that share a name with production
 *
 * Usage:
 *   node scripts/merge-production-roster.mjs
 *   node scripts/merge-production-roster.mjs data/production-players.json
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PRODUCTION_PLAYERS_URL = "https://haffleisureclub.vercel.app/api/players";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const defaultCache = join(root, "data", "production-players.json");

const prisma = new PrismaClient();

function normalizeName(name) {
  return String(name ?? "").trim().toLowerCase();
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

function pickDate(...values) {
  for (const value of values) {
    if (!value) continue;
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return null;
}

async function loadProductionPlayers(filePath) {
  if (filePath) {
    const payload = JSON.parse(readFileSync(filePath, "utf8"));
    return Array.isArray(payload) ? payload : payload.players ?? [];
  }

  if (process.env.DATABASE_URL) {
    const players = await prisma.player.findMany({ orderBy: { displayName: "asc" } });
    return players;
  }

  const response = await fetch(PRODUCTION_PLAYERS_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch production roster (${response.status})`);
  }
  const payload = await response.json();
  const players = Array.isArray(payload) ? payload : payload.players ?? [];
  mkdirSync(dirname(defaultCache), { recursive: true });
  writeFileSync(
    defaultCache,
    JSON.stringify({ exportedAt: new Date().toISOString(), count: players.length, players }, null, 2)
  );
  return players;
}

async function main() {
  const fileArg = process.argv[2];
  const pruneOrphans = process.argv.includes("--prune-orphans");
  const productionPlayers = await loadProductionPlayers(fileArg || defaultCache);
  if (!productionPlayers.length) {
    throw new Error("No production players found to import");
  }

  const localPlayers = await prisma.player.findMany();
  const localByName = new Map();
  for (const player of localPlayers) {
    const key = normalizeName(player.displayName);
    if (!localByName.has(key)) localByName.set(key, []);
    localByName.get(key).push(player);
  }

  const productionIds = new Set(productionPlayers.map((player) => String(player.id)));
  const productionByName = new Map(
    productionPlayers.map((player) => [normalizeName(player.displayName), player])
  );

  let upserted = 0;
  let usersRepointed = 0;
  let duplicatesRemoved = 0;

  for (const row of productionPlayers) {
    const id = String(row.id ?? "");
    if (!id) continue;

    const nameKey = normalizeName(row.displayName);
    const localMatches = localByName.get(nameKey) ?? [];
    const localWithAvatar = localMatches.find((player) => player.avatarUrl);
    const localWithNote = localMatches.find((player) => player.statusNote);

    const data = {
      displayName: String(row.displayName ?? "Player"),
      fullName: pickString(row.fullName, row.displayName),
      nickname: typeof row.nickname === "string" ? row.nickname : null,
      skillLevel: String(row.skillLevel ?? "Beginner"),
      rating: typeof row.rating === "number" ? row.rating : 2,
      avatarUrl: pickString(row.avatarUrl, localWithAvatar?.avatarUrl),
      statusNote: pickString(row.statusNote, localWithNote?.statusNote),
      phone: pickString(row.phone, row.phoneNumber),
      email: typeof row.email === "string" ? row.email : null,
      tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
      status: row.status === "Inactive" ? "Inactive" : "Active",
      totalGamesPlayed: pickNumber(row.totalGamesPlayed, ...localMatches.map((p) => p.totalGamesPlayed)),
      totalPointsScored: pickNumber(row.totalPointsScored, ...localMatches.map((p) => p.totalPointsScored)),
      totalPointsAgainst: pickNumber(row.totalPointsAgainst, ...localMatches.map((p) => p.totalPointsAgainst)),
      totalDaysPlayed: pickNumber(row.totalDaysPlayed, ...localMatches.map((p) => p.totalDaysPlayed)),
      currentPlayDayStreak: pickNumber(row.currentPlayDayStreak, ...localMatches.map((p) => p.currentPlayDayStreak)),
      bestPlayDayStreak: pickNumber(row.bestPlayDayStreak, ...localMatches.map((p) => p.bestPlayDayStreak)),
      lastPlayedDate: pickDate(row.lastPlayedDate, ...localMatches.map((p) => p.lastPlayedDate)),
      avatarVersion: typeof row.avatarVersion === "number" ? row.avatarVersion : 1,
      version: typeof row.version === "number" ? row.version : 1
    };

    await prisma.player.upsert({
      where: { id },
      create: { id, ...data },
      update: data
    });
    upserted += 1;
  }

  const users = await prisma.user.findMany({
    where: { playerId: { not: null } },
    include: { player: { select: { displayName: true } } }
  });

  for (const user of users) {
    const nameKey = normalizeName(user.player?.displayName);
    const canonical = productionByName.get(nameKey);
    if (!canonical) continue;
    const canonicalId = String(canonical.id);
    if (user.playerId !== canonicalId) {
      await prisma.user.update({
        where: { id: user.id },
        data: { playerId: canonicalId }
      });
      usersRepointed += 1;
    }
  }

  for (const local of localPlayers) {
    if (productionIds.has(local.id)) continue;
    const canonical = productionByName.get(normalizeName(local.displayName));
    if (canonical) {
      await prisma.player.delete({ where: { id: local.id } }).catch(() => {});
      duplicatesRemoved += 1;
    }
  }

  let orphansRemoved = 0;
  if (pruneOrphans) {
    const remaining = await prisma.player.findMany({ select: { id: true } });
    for (const local of remaining) {
      if (!productionIds.has(local.id)) {
        await prisma.player.delete({ where: { id: local.id } }).catch(() => {});
        orphansRemoved += 1;
      }
    }
  }

  const finalCount = await prisma.player.count();
  const withAvatar = await prisma.player.count({
    where: { AND: [{ avatarUrl: { not: null } }, { NOT: { avatarUrl: "" } }] }
  });

  console.log("Production roster merge complete:");
  console.log(`  Upserted production players: ${upserted}`);
  console.log(`  User accounts repointed: ${usersRepointed}`);
  console.log(`  Duplicate local players removed: ${duplicatesRemoved}`);
  if (pruneOrphans) console.log(`  Non-production roster rows removed: ${orphansRemoved}`);
  console.log(`  Final roster size: ${finalCount}`);
  console.log(`  Players with avatars: ${withAvatar}`);
}

await main();
await prisma.$disconnect();
