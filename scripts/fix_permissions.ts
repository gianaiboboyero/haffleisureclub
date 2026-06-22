import { Client } from 'pg';

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) throw new Error("Missing DATABASE_URL in environment");

const client = new Client({ connectionString: dbUrl });

async function main() {
  await client.connect();
  console.log("Fixing Postgres privileges...");
  
  // Grant fullName back to fix frontend error
  await client.query('GRANT SELECT ("fullName") ON "Player" TO anon, authenticated;');
  
  console.log("Checking player count:");
  const { rows } = await client.query('SELECT count(*) FROM "Player"');
  console.log(rows);
  
  await client.end();
}

main().catch(console.error);
