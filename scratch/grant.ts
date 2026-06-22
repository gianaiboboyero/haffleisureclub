import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function run() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  await client.connect();
  console.log('Connected to DB');
  
  await client.query('GRANT UPDATE ON "Session" TO anon, authenticated;');
  console.log('Granted UPDATE on Session to anon and authenticated');
  
  await client.end();
}

run().catch(console.error);
