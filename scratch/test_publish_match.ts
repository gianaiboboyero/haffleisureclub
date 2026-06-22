import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const envFile = fs.readFileSync(join(__dirname, '../.env.local'), 'utf-8');
const env: Record<string, string> = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1]] = match[2].replace(/["']/g, '').trim();
});

const supabaseUrl = env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testPublish() {
  console.log("Fetching active session...");
  const { data: session, error: fetchError } = await supabase
    .from("Session")
    .select("*")
    .eq("status", "Active")
    .order("updatedAt", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchError || !session) {
    console.error("Failed to fetch session", fetchError);
    return;
  }

  console.log(`Found session ${session.id}. Updating settings...`);
  
  // Clone current settings
  const settings = session.settings || {};
  const currentMatches = Array.isArray(settings.matches) ? settings.matches : [];
  
  // Add a dummy match
  const dummyMatch = {
    id: `test-match-${Date.now()}`,
    courtId: "court-1",
    status: "InProgress",
    startedAt: new Date().toISOString()
  };
  
  settings.matches = [...currentMatches, dummyMatch];
  
  console.log(`Attempting to save ${settings.matches.length} matches...`);
  
  const { data, error } = await supabase.from("Session").update({
    settings,
    updatedAt: new Date().toISOString()
  }).eq("id", session.id).select("id, updatedAt");

  if (error) {
    console.error("FAIL: Supabase update rejected!");
    console.error(error);
  } else {
    console.log("SUCCESS: Supabase update accepted!", data);
  }
}

testPublish();
