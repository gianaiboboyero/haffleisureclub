#!/usr/bin/env node
/**
 * Upsert players from JSON into Supabase without deleting existing rows.
 * Usage: node scripts/import-players-from-json.mjs data/players-backup.json
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/import-players-from-json.mjs <players.json>");
  process.exit(1);
}

const payload = JSON.parse(readFileSync(file, "utf8"));
const rows = Array.isArray(payload) ? payload : payload.players;
if (!Array.isArray(rows)) {
  console.error("JSON must be an array or { players: [] }");
  process.exit(1);
}

const prisma = new PrismaClient();
let imported = 0;
let skipped = 0;

for (const row of rows) {
  const id = String(row.id ?? "");
  if (!id) {
    skipped += 1;
    continue;
  }
  const data = {
    displayName: String(row.displayName ?? "Player"),
    fullName: typeof row.fullName === "string" ? row.fullName : null,
    nickname: typeof row.nickname === "string" ? row.nickname : null,
    skillLevel: String(row.skillLevel ?? "Beginner"),
    rating: typeof row.rating === "number" ? row.rating : 2,
    avatarUrl: typeof row.avatarUrl === "string" && row.avatarUrl ? row.avatarUrl : null,
    phone: typeof row.phone === "string" ? row.phone : typeof row.phoneNumber === "string" ? row.phoneNumber : null,
    email: typeof row.email === "string" ? row.email : null,
    tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
    status: row.isActive === false || row.status === "Inactive" ? "Inactive" : String(row.status ?? "Active"),
    statusNote: typeof row.statusNote === "string" && row.statusNote.trim() ? row.statusNote.trim() : null,
    totalGamesPlayed: typeof row.totalGamesPlayed === "number" ? row.totalGamesPlayed : 0,
    totalPointsScored: typeof row.totalPointsScored === "number" ? row.totalPointsScored : 0,
    totalPointsAgainst: typeof row.totalPointsAgainst === "number" ? row.totalPointsAgainst : 0,
    totalDaysPlayed: typeof row.totalDaysPlayed === "number" ? row.totalDaysPlayed : 0,
    lastPlayedDate: row.lastPlayedDate ? new Date(row.lastPlayedDate) : null
  };

  await prisma.player.upsert({
    where: { id },
    create: { id, ...data },
    update: data
  });
  imported += 1;
}

console.log(`Imported/updated ${imported} players (${skipped} skipped)`);
await prisma.$disconnect();
