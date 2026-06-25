const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://chxzvugtdkohuciaqpxl.supabase.co', 'sb_publishable_7bt1RVMmGLRUdfUsBPWpiQ_ML0Fm6Au');

async function test() {
  console.log("Fetching courts...");
  const courts = await supabase.from('Court').select('*');
  console.log('Courts:', JSON.stringify(courts));

  console.log("\nFetching players...");
  const players = await supabase.from('Player').select('id, displayName');
  console.log('Players:', JSON.stringify(players).substring(0, 200));
}
test();
