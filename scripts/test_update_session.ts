import { Client } from 'pg';
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: './.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);

async function run() {
  const { data: session } = await supabase.from('Session').select('*').limit(1).maybeSingle();
  console.log("Current session ID:", session?.id);
  
  if (session) {
    const { data, error } = await supabase.from('Session').update({
      updatedAt: new Date().toISOString(),
      settings: { ...session.settings, testUpdate: Date.now() }
    }).eq('id', session.id).select('id, updatedAt');
    console.log("Update result:", data);
    console.log("Update error:", error);
  }
}

run().catch(console.error);
