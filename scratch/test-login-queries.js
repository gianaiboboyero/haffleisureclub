import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  console.log('Initializing Supabase client...');
  const supabase = createClient(url, key);
  
  const email = 'haffleisureclub@gmail.com';
  const bucket = 'login:haffleisureclub@gmail.com:127.0.0.1';
  const LOGIN_FAILURE_WINDOW_MS = 15 * 60 * 1000;
  
  console.log('1. Querying AuditLog...');
  const t0 = Date.now();
  const { count: recentFailures, error: err1 } = await supabase.from("AuditLog").select("*", { count: "exact", head: true })
    .eq("action", "AUTH_LOGIN_FAILED")
    .eq("entityId", bucket)
    .gte("createdAt", new Date(Date.now() - LOGIN_FAILURE_WINDOW_MS).toISOString());
  console.log(`AuditLog query done in ${Date.now() - t0}ms. Count:`, recentFailures, 'Error:', err1);

  console.log('2. Querying User...');
  const t1 = Date.now();
  const { data: user, error: err2 } = await supabase.from("User").select("*, player:Player(*)").eq("email", email).single();
  console.log(`User query done in ${Date.now() - t1}ms. Email:`, user?.email, 'Error:', err2);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
