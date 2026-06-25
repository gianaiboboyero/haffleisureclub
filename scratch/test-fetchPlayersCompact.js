import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function main() {
  const { data, error } = await supabase.from('Player').select('id, displayName, status').neq('status', 'ARCHIVED');
  console.log('Error:', error);
  console.log('Players found:', data?.length);
  if (data?.length < 5) console.log('Players:', data);
}

main().catch(console.error);
