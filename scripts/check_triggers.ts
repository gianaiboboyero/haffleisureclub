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
    const res = await client.query(`
      SELECT tgname, proname 
      FROM pg_trigger 
      JOIN pg_proc ON pg_proc.oid = pg_trigger.tgfoid 
      WHERE tgrelid = '"Session"'::regclass;
    `);
    console.log("Triggers:", JSON.stringify(res.rows, null, 2));

    const policyRes = await client.query(`
      SELECT * FROM pg_policies WHERE tablename = 'Session';
    `);
    console.log("All Policies:", JSON.stringify(policyRes.rows, null, 2));
  } catch (error) {
    console.error('Error querying metadata:', error);
  }
  
  await client.end();
}

run().catch(console.error);
