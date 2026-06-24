import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

async function run() {
  const { data, error } = await supabase.from("Player").insert({
    displayName: "Test User",
    fullName: "Test User",
    email: "test_xyz_123@example.com",
    skillLevel: "Beginner",
    rating: 2,
    tags: ["Member"]
  }).select().single();

  console.log("Data:", data);
  console.log("Error:", error);
}
run();
