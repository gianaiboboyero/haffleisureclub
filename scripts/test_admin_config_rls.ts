import { Client } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: './.env.local' });

async function run() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  await client.connect();
  const res = await client.query(`
    SELECT policyname, roles, cmd, qual 
    FROM pg_policies 
    WHERE tablename = 'AdminConfig';
  `);
  console.log("AdminConfig policies:", res.rows);
  await client.end();
}
run().catch(console.error);
