import { Client } from 'pg';

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  throw new Error("Missing DATABASE_URL in environment");
}

const client = new Client({
  connectionString: dbUrl,
});

async function main() {
  await client.connect();
  console.log("Checking database for duplicate records via direct Postgres connection...");

  // Find users
  const { rows: users } = await client.query('SELECT * FROM "User" ORDER BY "email" ASC');
  
  console.log(`\nTotal Users found: ${users.length}`);

  const emailGroups: Record<string, typeof users> = {};
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
  const { rows: players } = await client.query('SELECT * FROM "Player" ORDER BY "displayName" ASC');
  
  console.log(`\nTotal Players found: ${players.length}`);

  const nameGroups: Record<string, typeof players> = {};
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
      
      const sortedGroup = group.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      const toDelete = sortedGroup.slice(1);
      console.log(`  Deleting ${toDelete.length} duplicate players...`);
      for (const p of toDelete) {
        await client.query('DELETE FROM "Player" WHERE id = $1', [p.id]);
        console.log(`  Deleted Player ID: ${p.id}`);
      }
    }
  }
  if (duplicatePlayersCount === 0) {
    console.log("No duplicate Player profiles found by display name.");
  }

  await client.end();
}

main().catch(console.error);
