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
  
  try {
    await client.query(`DROP POLICY IF EXISTS "haff_anon_update_session" ON "Session";`);
    await client.query(`
      CREATE POLICY "haff_anon_update_session" ON "Session"
        FOR UPDATE TO anon, authenticated
        USING (true)
        WITH CHECK (true);
    `);
    console.log('Successfully recreated permissive UPDATE policy on Session!');
  } catch (error) {
    console.error('Error creating policy:', error);
  }
  
  await client.end();
}

run().catch(console.error);
