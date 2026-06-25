import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  console.log('Initializing Supabase client with url:', url);
  const supabase = createClient(url, key);
  console.log('Querying User table...');
  const { data, error } = await supabase.from('User').select('id, email').limit(5);
  if (error) {
    console.error('Supabase query error:', error);
  } else {
    console.log('Successfully retrieved users:', data);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
