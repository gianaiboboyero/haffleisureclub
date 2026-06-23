import { Client } from 'pg';
import * as dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config({ path: './.env.local' });

async function run() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  await client.connect();
  console.log("Connected to DB");
  
  try {
    // 1. Create AdminConfig table
    await client.query(`
      CREATE TABLE IF NOT EXISTS "AdminConfig" (
        "key" text PRIMARY KEY,
        "value" text NOT NULL
      );
    `);
    console.log("Created AdminConfig table.");

    // 2. Generate and Insert write_token
    const token = crypto.randomBytes(32).toString('hex');
    await client.query(`
      INSERT INTO "AdminConfig" ("key", "value") 
      VALUES ('write_token', $1) 
      ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value";
    `, [token]);
    console.log("Inserted write_token: [REDACTED — stored in AdminConfig table]");

    // 3. Update RLS policy for Session update
    await client.query(`
      DROP POLICY IF EXISTS "haff_anon_update_session" ON "Session";
    `);
    
    await client.query(`
      CREATE POLICY "haff_anon_update_session" ON "Session"
      FOR UPDATE
      TO anon, authenticated
      USING (true)
      WITH CHECK (
        (settings->>'adminWriteToken') = (SELECT "value" FROM "AdminConfig" WHERE "key" = 'write_token')
      );
    `);
    console.log("Updated RLS policy for Session update.");

  } catch (error) {
    console.error('Error applying security:', error);
  }
  
  await client.end();
}

run().catch(console.error);
