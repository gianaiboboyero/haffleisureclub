import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const email = "test@example.com";
  console.log("Fetching user...");
  const { data: user, error } = await supabase.from("User").select("*, player:Player(*)").eq("email", email).single();
  console.log("User fetch complete.", user, error);
}
run();
