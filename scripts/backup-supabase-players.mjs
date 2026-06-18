#!/usr/bin/env node
/** Backup Supabase Player rows to data/players-backup.json */
import { PrismaClient } from "@prisma/client";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const prisma = new PrismaClient();
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outPath = join(root, "data", "players-backup.json");

const players = await prisma.player.findMany({ orderBy: { displayName: "asc" } });
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify({ exportedAt: new Date().toISOString(), count: players.length, players }, null, 2));
console.log(`Backed up ${players.length} players → ${outPath}`);
await prisma.$disconnect();
