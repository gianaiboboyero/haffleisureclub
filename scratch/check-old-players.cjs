const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://hmhhgmuuusknmucjlkth.supabase.co', 'sb_publishable_d81fmX4by8jUwztjR7phaQ_i_QJdLz8');

async function test() {
  const { count } = await supabase.from('Player').select('*', { count: 'exact', head: true });
  console.log("Total players in hmhhgmuuusknmucjlkth:", count);
}
test();
