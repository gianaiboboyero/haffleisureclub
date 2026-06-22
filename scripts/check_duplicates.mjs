import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Load .env.local to resolve Vercel-configured production database
try {
  const envContent = readFileSync(join(process.cwd(), ".env.local"), "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.substring(0, index).trim();
    let val = trimmed.substring(index + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.substring(1, val.length - 1);
    }
    process.env[key] = val;
  }
} catch {
  // Fall back to root .env
}

const prisma = new PrismaClient();

async function main() {
  console.log("Checking database for duplicate records...");

  // Find users
  const users = await prisma.user.findMany({
    orderBy: { email: "asc" }
  });
  console.log(`\nTotal Users found: ${users.length}`);

  const emailGroups = {};
  for (const user of users) {
    const key = user.email.trim().toLowerCase();
    if (!emailGroups[key]) emailGroups[key] = [];
    emailGroups[key].push(user);
  }

  let duplicateUsersCount = 0;
  for (const [email, group] of Object.entries(emailGroups)) {
    if (group.length > 1) {
      duplicateUsersCount++;
      console.log(`Duplicate Email found: "${email}" (${group.length} accounts):`);
      for (const user of group) {
        console.log(`  - ID: ${user.id}, Role: ${user.role}, PlayerID: ${user.playerId}, CreatedAt: ${user.createdAt}`);
      }
    }
  }
  if (duplicateUsersCount === 0) {
    console.log("No duplicate User accounts found by email.");
  }

  // Find players
  const players = await prisma.player.findMany({
    orderBy: { displayName: "asc" }
  });
  console.log(`\nTotal Players found: ${players.length}`);

  const nameGroups = {};
  for (const player of players) {
    const key = player.displayName.trim().toLowerCase();
    if (!nameGroups[key]) nameGroups[key] = [];
    nameGroups[key].push(player);
  }

  let duplicatePlayersCount = 0;
  for (const [name, group] of Object.entries(nameGroups)) {
    if (group.length > 1) {
      duplicatePlayersCount++;
      console.log(`Duplicate Player Name found: "${name}" (${group.length} records):`);
      for (const player of group) {
        console.log(`  - ID: ${player.id}, Skill: ${player.skillLevel}, Active: ${player.active}, CreatedAt: ${player.createdAt}`);
      }
    }
  }
  if (duplicatePlayersCount === 0) {
    console.log("No duplicate Player profiles found by display name.");
  }
}

main()
  .catch((e) => {
    console.error("Error checking duplicates:", e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
