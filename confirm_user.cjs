const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({path: './workers/.env'});
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function confirmUser() {
  const { data, error } = await supabase.auth.admin.updateUserById(
    '70f24258-84d2-4dff-b444-cd5506d3fdbe',
    { email_confirm: true }
  );
  if (error) console.error(error);
  else console.log('Successfully confirmed user email!');
}
confirmUser();
