const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://chxzvugtdkohuciaqpxl.supabase.co', 'sb_publishable_7bt1RVMmGLRUdfUsBPWpiQ_ML0Fm6Au');

async function test() {
  const { data, error } = await supabase.from("Court").select("id, name, number, status, currentMatchId, nextMatchId, notes, version, updatedAt").order("number", { ascending: true });
  console.log("Courts exactly:", JSON.stringify(data));
  console.log("Error:", error);
}
test();
