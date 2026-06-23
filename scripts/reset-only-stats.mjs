#!/usr/bin/env node
/**
 * Reset performance stats for all existing players to 0, clear matches,
 * and reset courts/session without deleting player accounts.
 * Usage: node scripts/reset-only-stats.mjs
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const SESSION_ID = "default-active-session";

async function main() {
  console.log("Starting reset of game stats for all players...");

  // 1. Reset player stats to 0
  const updatedPlayers = await prisma.player.updateMany({
    data: {
      totalGamesPlayed: 0,
      totalPointsScored: 0,
      totalPointsAgainst: 0,
      totalDaysPlayed: 0,
      currentPlayDayStreak: 0,
      bestPlayDayStreak: 0,
      totalCourtSeconds: 0,
      lastPlayedDate: null
    }
  });
  console.log(`Reset stats for ${updatedPlayers.count} players.`);

  // 2. Clear all matches
  const deletedMatches = await prisma.match.deleteMany({});
  console.log(`Deleted ${deletedMatches.count} match records.`);

  // 3. Reset courts to Available and idle
  const courts = await prisma.court.findMany();
  for (const court of courts) {
    await prisma.court.update({
      where: { id: court.id },
      data: {
        status: "Available",
        currentMatchId: null,
        nextMatchId: null,
        notes: null
      }
    });
  }
  console.log(`Reset ${courts.length} courts to Available status.`);

  // 4. Reset default session settings
  const courtSettings = courts.map((court) => ({
    id: court.id,
    name: court.name,
    number: court.number,
    status: "Available",
    priority: court.number,
    reservable: true
  }));

  const existing = await prisma.session.findUnique({ where: { id: SESSION_ID } });
  const priorSettings = (existing?.settings ?? {});
  const {
    playerKudos: _k,
    matchReviews: _r,
    playerProfiles: _p,
    ...restSettings
  } = priorSettings;

  const settings = {
    ...restSettings,
    adminCheckedInIds: [],
    stackOrder: [],
    courts: courtSettings,
    matches: [],
    tvBroadcast: null
  };

  await prisma.session.upsert({
    where: { id: SESSION_ID },
    create: {
      id: SESSION_ID,
      name: "Open Play Session",
      date: new Date(),
      mode: "Open Play",
      status: "Active",
      checkedInPlayerIds: [],
      settings
    },
    update: {
      checkedInPlayerIds: [],
      settings,
      status: "Active"
    }
  });
  console.log("Reset the default open play session.");
  console.log("Game stats reset complete!");
}

main()
  .catch((e) => {
    console.error("Error during stat reset:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
