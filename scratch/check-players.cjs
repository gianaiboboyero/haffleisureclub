const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://chxzvugtdkohuciaqpxl.supabase.co', 'sb_publishable_7bt1RVMmGLRUdfUsBPWpiQ_ML0Fm6Au');

async function test() {
  const { data, error } = await supabase.from('Player').select('*').limit(1);
  console.log("Players:", data);
  console.log("Error:", error);
}
test();
