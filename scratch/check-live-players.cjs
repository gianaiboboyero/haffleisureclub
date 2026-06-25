const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://chxzvugtdkohuciaqpxl.supabase.co', 'sb_publishable_7bt1RVMmGLRUdfUsBPWpiQ_ML0Fm6Au');

async function test() {
  const { count } = await supabase.from('Player').select('*', { count: 'exact', head: true });
  console.log("Total players in DB:", count);
}
test();
