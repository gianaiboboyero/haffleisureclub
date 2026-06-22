import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

const envContent = readFileSync(join(process.cwd(), '.env.local'), 'utf-8');
const env: Record<string, string> = {};
for (const line of envContent.split('\n')) {
  if (line.includes('=')) {
    const [key, ...rest] = line.split('=');
    const value = rest.join('=').trim().replace(/^"/, '').replace(/"$/, '');
    env[key.trim()] = value;
  }
}

const supabaseUrl = env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPlayers() {
  console.log('Fetching players from Supabase...');
  const { data: players, error } = await supabase
    .from('Player')
    .select('id, fullName, displayName, email')
    .order('createdAt', { ascending: false });

  if (error) {
    console.error('Error fetching players:', error);
    return;
  }

  console.log(`Found ${players?.length || 0} players total.`);
  
  if (!players || players.length === 0) return;

  const duplicateNames = new Map();

  for (const p of players) {
    const name = (p.displayName || p.fullName || 'Unknown').trim().toLowerCase();
    if (!duplicateNames.has(name)) {
      duplicateNames.set(name, []);
    }
    duplicateNames.get(name).push(p);
  }

  let dupes = 0;
  console.log(`\n--- DUPES OR SIMILAR NAMES ---`);
  for (const [name, list] of duplicateNames.entries()) {
    if ((list as any).length > 1) {
      dupes++;
      console.log(`\nName: "${name}" (${(list as any).length} entries)`);
      for (const p of (list as any)) {
        console.log(`  - id: ${p.id}, email: ${p.email || 'N/A'}`);
      }
    }
  }
  console.log(`\nTotal unique names: ${duplicateNames.size}`);
}

checkPlayers();
