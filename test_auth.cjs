const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({path: './workers/.env'});
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function run() {
  const { data: authUsers, error: authErr } = await supabase.auth.admin.listUsers();
  if (authErr) { console.error(authErr); return; }
  console.log('auth.users length:', authUsers.users.length);
  for (const u of authUsers.users) {
      console.log(`- ${u.email} (ID: ${u.id})`);
  }
}
run();
