import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: './.env.production' });

async function run() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  const res = await client.query(`SELECT "value" FROM "AdminConfig" WHERE "key" = 'write_token'`);
  const token = res.rows[0]?.value;
  await client.end();

  console.log("Actual Token from DB:", token);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnon = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);

  const { data: session } = await supabaseAnon.from("Session").select("*").limit(1).maybeSingle();
  if (!session) return;

  const { data, error } = await supabaseAnon.from("Session").update({
    updatedAt: new Date().toISOString(),
    settings: { ...session.settings, adminWriteToken: token }
  }).eq("id", session.id).select("id");

  console.log("Update error:", error?.message);
}

run().catch(console.error);
