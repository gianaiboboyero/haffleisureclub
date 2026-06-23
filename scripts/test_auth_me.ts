import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: './.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function fetchAdminWriteToken(): Promise<string | null> {
  const { data, error } = await supabaseAdmin.from("AdminConfig").select("value").eq("key", "write_token").maybeSingle();
  if (error) console.error("fetchAdminWriteToken error:", error);
  return data?.value ?? null;
}

fetchAdminWriteToken().then(console.log).catch(console.error);
