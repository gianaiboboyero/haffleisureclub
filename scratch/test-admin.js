import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.vercel.prod' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY);

async function main() {
  const { data, error } = await supabase.from('User').select('email, role');
  console.log('Error:', error);
  console.log('Users:', data);
}

main().catch(console.error);
