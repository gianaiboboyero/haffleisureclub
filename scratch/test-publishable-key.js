import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.vercel.prod' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL, 'sb_publishable_7bt1RVMmGLRUdfUsBPWpiQ_ML0Fm6Au');

async function main() {
  const { data, error } = await supabase.from('Player').select('*').limit(1);
  console.log('Error:', error);
  console.log('Players:', data?.length);
}

main().catch(console.error);
