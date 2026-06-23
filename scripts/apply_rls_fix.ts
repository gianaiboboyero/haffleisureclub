import { Client } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: './.env.production' });

async function run() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  await client.connect();
  console.log("Connected to DB");
  
  try {
    // 1. Create a SECURITY DEFINER function to securely read the token
    await client.query(`
      CREATE OR REPLACE FUNCTION get_admin_write_token()
      RETURNS text
      LANGUAGE sql
      SECURITY DEFINER
      SET search_path = public
      AS $$
        SELECT "value" FROM "AdminConfig" WHERE "key" = 'write_token';
      $$;
    `);
    console.log("Created SECURITY DEFINER function get_admin_write_token.");

    // 2. Update the Session RLS policy to use the function instead of a direct subquery
    await client.query(`
      DROP POLICY IF EXISTS "haff_anon_update_session" ON "Session";
    `);
    
    await client.query(`
      CREATE POLICY "haff_anon_update_session" ON "Session"
      FOR UPDATE
      TO anon, authenticated
      USING (true)
      WITH CHECK (
        (settings->>'adminWriteToken') = get_admin_write_token()
      );
    `);
    console.log("Updated RLS policy for Session update.");

  } catch (error) {
    console.error('Error applying RLS fix:', error);
  }
  
  await client.end();
}

run().catch(console.error);
