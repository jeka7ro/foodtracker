const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({path: './workers/.env'});
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function run() {
  const { data: users, error } = await supabase.from('user_roles').select('*');
  console.log('users length:', users ? users.length : 'undefined');
  if (users) {
    users.forEach(u => console.log(u.email, u.role, u.is_active));
  }
  if (error) console.log('Error:', error);
}
run();
