import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.vercel.prod' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function main() {
  const { data, error } = await supabase.from('Player').select('id, status');
  console.log('Error:', error);
  console.log('Total players:', data?.length);
  const statusCounts = {};
  for (const p of data || []) {
    statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
  }
  console.log('Status counts:', statusCounts);
}

main().catch(console.error);
