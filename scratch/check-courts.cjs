const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://chxzvugtdkohuciaqpxl.supabase.co', 'sb_publishable_7bt1RVMmGLRUdfUsBPWpiQ_ML0Fm6Au');

async function test() {
  const { data, error } = await supabase.from('Court').select('*');
  console.log("Courts:", JSON.stringify(data));
  console.log("Error:", error);
}
test();
