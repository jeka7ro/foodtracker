const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({path: './workers/.env'});
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function run() {
  const { data: users } = await supabase.from('user_roles').select('*').eq('user_id', '70f24258-84d2-4dff-b444-cd5506d3fdbe');
  if (!users || users.length === 0) {
      await supabase.from('user_roles').insert({
          user_id: '70f24258-84d2-4dff-b444-cd5506d3fdbe',
          email: 'test@test.ro',
          full_name: 'Test User',
          role: 'viewer',
          is_active: true
      });
      console.log('Inserted test@test.ro');
  } else {
      console.log('test@test.ro already exists');
  }
}
run();
