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
  console.log("Starting safe player duplicate merging...");

  // 1. Get all players
  const players = await prisma.player.findMany({
    orderBy: { createdAt: "asc" }
  });

  // Group by normalized name
  const nameGroups = {};
  for (const player of players) {
    const key = player.displayName.trim().toLowerCase();
    if (!nameGroups[key]) nameGroups[key] = [];
    nameGroups[key].push(player);
  }

  // 2. Identify duplicate groups
  for (const [name, group] of Object.entries(nameGroups)) {
    if (group.length <= 1) continue;

    console.log(`\nProcessing duplicate name: "${name}" (${group.length} records)`);

    // We need to pick one kept player ID.
    // Rule:
    // A. Pick the one that is linked to a User account (if any).
    // B. Otherwise, pick the oldest one.
    let keptPlayer = null;
    const playerIds = group.map((p) => p.id);

    const linkedUsers = await prisma.user.findMany({
      where: { playerId: { in: playerIds } }
    });

    if (linkedUsers.length > 0) {
      // Find the player associated with the first linked user
      const primaryUser = linkedUsers[0];
      keptPlayer = group.find((p) => p.id === primaryUser.playerId);
      console.log(`  - Prioritizing player ID "${keptPlayer.id}" because it is linked to User: ${primaryUser.email}`);
    } else {
      keptPlayer = group[0]; // Oldest by createdAt ascending sort
      console.log(`  - No user links found. Keeping the oldest player profile: ID "${keptPlayer.id}" (Created: ${keptPlayer.createdAt})`);
    }

    const toBeDeleted = group.filter((p) => p.id !== keptPlayer.id);
    const toBeDeletedIds = toBeDeleted.map((p) => p.id);

    console.log(`  - Merging duplicate IDs: ${JSON.stringify(toBeDeletedIds)} -> Kept ID: "${keptPlayer.id}"`);

    // 3. Repoint Users
    const repointedUsers = await prisma.user.updateMany({
      where: { playerId: { in: toBeDeletedIds } },
      data: { playerId: keptPlayer.id }
    });
    if (repointedUsers.count > 0) {
      console.log(`  - Repointed ${repointedUsers.count} User account(s) to "${keptPlayer.id}"`);
    }

    // 4. Repoint Testimonials
    const repointedTestimonials = await prisma.testimonial.updateMany({
      where: { playerId: { in: toBeDeletedIds } },
      data: { playerId: keptPlayer.id }
    });
    if (repointedTestimonials.count > 0) {
      console.log(`  - Repointed ${repointedTestimonials.count} Testimonial(s) to "${keptPlayer.id}"`);
    }

    // 5. Repoint active/stored sessions (Prisma JSON columns and checkedInPlayerIds)
    const sessions = await prisma.session.findMany({});
    for (const session of sessions) {
      let changed = false;

      // Update checkedInPlayerIds array
      let checkedInPlayerIds = session.checkedInPlayerIds || [];
      if (checkedInPlayerIds.some((id) => toBeDeletedIds.includes(id))) {
        checkedInPlayerIds = checkedInPlayerIds.map((id) => 
          toBeDeletedIds.includes(id) ? keptPlayer.id : id
        );
        // Deduplicate
        checkedInPlayerIds = [...new Set(checkedInPlayerIds)];
        changed = true;
      }

      // Update settings JSON
      let settings = session.settings || {};
      if (settings && typeof settings === "object") {
        const settingsObj = settings;
        
        // Repoint adminCheckedInIds
        if (Array.isArray(settingsObj.adminCheckedInIds)) {
          let adminCheckedInIds = settingsObj.adminCheckedInIds;
          if (adminCheckedInIds.some((id) => toBeDeletedIds.includes(id))) {
            adminCheckedInIds = adminCheckedInIds.map((id) =>
              toBeDeletedIds.includes(id) ? keptPlayer.id : id
            );
            settingsObj.adminCheckedInIds = [...new Set(adminCheckedInIds)];
            changed = true;
          }
        }

        // Repoint stackOrder
        if (Array.isArray(settingsObj.stackOrder)) {
          let stackOrder = settingsObj.stackOrder;
          if (stackOrder.some((id) => toBeDeletedIds.includes(id))) {
            stackOrder = stackOrder.map((id) =>
              toBeDeletedIds.includes(id) ? keptPlayer.id : id
            );
            settingsObj.stackOrder = stackOrder;
            changed = true;
          }
        }

        // Repoint matches (teamAPlayerIds and teamBPlayerIds)
        if (Array.isArray(settingsObj.matches)) {
          const matches = settingsObj.matches;
          for (const match of matches) {
            if (match && typeof match === "object") {
              if (Array.isArray(match.teamAPlayerIds)) {
                if (match.teamAPlayerIds.some((id) => toBeDeletedIds.includes(id))) {
                  match.teamAPlayerIds = match.teamAPlayerIds.map((id) =>
                    toBeDeletedIds.includes(id) ? keptPlayer.id : id
                  );
                  changed = true;
                }
              }
              if (Array.isArray(match.teamBPlayerIds)) {
                if (match.teamBPlayerIds.some((id) => toBeDeletedIds.includes(id))) {
                  match.teamBPlayerIds = match.teamBPlayerIds.map((id) =>
                    toBeDeletedIds.includes(id) ? keptPlayer.id : id
                  );
                  changed = true;
                }
              }
            }
          }
        }
      }

      if (changed) {
        await prisma.session.update({
          where: { id: session.id },
          data: {
            checkedInPlayerIds,
            settings
          }
        });
        console.log(`  - Repointed duplicate references in active session "${session.id}"`);
      }
    }

    // 6. Delete duplicate Players
    const deletedPlayers = await prisma.player.deleteMany({
      where: { id: { in: toBeDeletedIds } }
    });
    console.log(`  - Deleted ${deletedPlayers.count} duplicate player profile(s) for "${name}".`);
  }

  console.log("\nMerging completed successfully.");
}

main()
  .catch((e) => {
    console.error("Error during merge:", e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
