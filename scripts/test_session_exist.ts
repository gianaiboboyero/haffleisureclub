import { Client } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: './.env.local' });

async function run() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  const res = await client.query('SELECT id, status, "updatedAt" FROM "Session"');
  console.log("Sessions:", res.rows);
  await client.end();
}
run().catch(console.error);
