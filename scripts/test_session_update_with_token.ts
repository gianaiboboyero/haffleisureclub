import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: './.env.production' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);
const supabaseAnon = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);

async function run() {
  // Get token
  const { data: tokenData } = await supabaseAdmin.from("AdminConfig").select("value").eq("key", "write_token").maybeSingle();
  const token = tokenData?.value;
  console.log("Fetched Token:", token);

  // Get current session
  const { data: session } = await supabaseAnon.from("Session").select("*").limit(1).maybeSingle();
  if (!session) {
    console.log("No session found");
    return;
  }

  // Attempt update with token
  const { data, error } = await supabaseAnon.from("Session").update({
    updatedAt: new Date().toISOString(),
    settings: { ...session.settings, adminWriteToken: token }
  }).eq("id", session.id).select("id");

  console.log("Update with token result:", data);
  console.log("Update with token error:", error);
}

run().catch(console.error);
