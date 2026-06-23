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
    const policiesRes = await client.query(`
      SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check 
      FROM pg_policies 
      WHERE schemaname = 'public' AND tablename = 'Session';
    `);
    console.log(JSON.stringify(policiesRes.rows, null, 2));
  } catch (error) {
    console.error('Error querying metadata:', error);
  }
  
  await client.end();
}

run().catch(console.error);
