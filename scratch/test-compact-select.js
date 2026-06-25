import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.vercel.prod' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const COMPACT_SELECT = "id, displayName, fullName, skillLevel, rating, avatarUrl, tags, status, totalGamesPlayed, totalCourtSeconds, totalDaysPlayed, lastPlayedDate, version, updatedAt";

async function main() {
  const { data, error } = await supabase.from('Player').select(COMPACT_SELECT).neq('status', 'ARCHIVED');
  console.log('Error:', error);
  console.log('Players found:', data?.length);
}

main().catch(console.error);
