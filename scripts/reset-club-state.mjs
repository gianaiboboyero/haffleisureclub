#!/usr/bin/env node
/**
 * Reset open-play session, courts, stats, and roster to the 6 official accounts only.
 * Usage: node scripts/reset-club-state.mjs
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const OFFICIAL_EMAILS = [
  "kayenegoza@gmail.com",
  "justkatieangel@gmail.com",
  "haffleisureclub@gmail.com",
  "fkbnegosa@gmail.com",
  "aiboboyero@gmail.com",
  "gib.designer.work@gmail.com"
];

const OFFICIAL_DISPLAY_NAMES = {
  "kayenegoza@gmail.com": "yiekay",
  "justkatieangel@gmail.com": "kat",
  "haffleisureclub@gmail.com": "haffleisureclub",
  "fkbnegosa@gmail.com": "Fkbnegosa",
  "aiboboyero@gmail.com": "Gian Aibo",
  "gib.designer.work@gmail.com": "Gib Designer"
};

const SESSION_ID = "default-active-session";

async function main() {
  const users = await prisma.user.findMany({
    where: { email: { in: OFFICIAL_EMAILS } },
    include: { player: true }
  });
  const keepPlayerIds = users.map((user) => user.playerId).filter(Boolean);

  const deletedPlayers = await prisma.player.deleteMany({
    where: { id: { notIn: keepPlayerIds } }
  });

  await prisma.player.updateMany({
    where: { id: { in: keepPlayerIds } },
    data: {
      totalGamesPlayed: 0,
      totalPointsScored: 0,
      totalPointsAgainst: 0,
      totalDaysPlayed: 0,
      currentPlayDayStreak: 0,
      bestPlayDayStreak: 0,
      lastPlayedDate: null,
      statusNote: null,
      rating: 2,
      skillLevel: "Beginner"
    }
  });

  for (const user of users) {
    const displayName = OFFICIAL_DISPLAY_NAMES[user.email] ?? user.player?.displayName;
    if (user.playerId && displayName) {
      await prisma.player.update({
        where: { id: user.playerId },
        data: { displayName, fullName: displayName }
      });
    }
  }

  await prisma.match.deleteMany({});

  const courts = await prisma.court.findMany({ orderBy: { number: "asc" } });
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

  console.log("Club state reset complete:");
  console.log(`  Kept players: ${keepPlayerIds.length}`);
  console.log(`  Removed players: ${deletedPlayers.count}`);
  console.log(`  Cleared matches, check-ins, stack, and court assignments`);
  console.log(`  Reset stats for official accounts`);
  for (const user of users) {
    console.log(`  - ${user.email} → ${user.player?.displayName ?? "(no player)"}`);
  }
}

await main();
await prisma.$disconnect();
