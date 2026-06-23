import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: './.env.production' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const { data: session } = await supabaseAnon.from("Session").select("*").limit(1).maybeSingle();
  if (!session) {
    console.log("No session found");
    return;
  }

  // Attempt to read AdminConfig as anon
  const { data: config } = await supabaseAnon.from("AdminConfig").select("*");
  console.log("Anon reading AdminConfig:", config); // This will be []

  // Attempt update with hardcoded known token from earlier
  const knownToken = "46b5b699cb23e78583f6c342bbdafb56e2f34a361b76d24423ad42d6374d003a";
  const { data, error } = await supabaseAnon.from("Session").update({
    updatedAt: new Date().toISOString(),
    settings: { ...session.settings, adminWriteToken: knownToken }
  }).eq("id", session.id).select("id");

  console.log("Update error:", error?.message);
}

run().catch(console.error);
