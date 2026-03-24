const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({path: './workers/.env'});
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function run() {
  const { data: restaurants, error } = await supabase
      .from('restaurants')
      .select('id, name, city, iiko_config')
      .not('iiko_config', 'is', null)
      .eq('is_active', true)
      
  console.log('Result length:', restaurants ? restaurants.length : 'undefined');
  if (error) console.log('Error:', error);
}
run();
