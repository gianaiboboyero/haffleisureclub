import { Client } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: './.env.local' });

async function run() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  await client.connect();
  try {
    const res = await client.query('SELECT * FROM "AdminConfig";');
    console.log("AdminConfig data:", res.rows);
  } catch (error) {
    console.log("Error querying AdminConfig:", error.message);
  }
  await client.end();
}
run().catch(console.error);
