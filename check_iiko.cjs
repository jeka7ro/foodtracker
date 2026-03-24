const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({path: './.env.local'});
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data, error } = await supabase.from('restaurants').select('id, name, city, is_active, iiko_config');
  if (error) {
    console.error('Error fetching restaurants:', error);
  } else {
    console.log(`Found ${data.length} restaurants total.`);
    const active = data.filter(r => r.is_active);
    console.log(`Active: ${active.length}`);
    const withIiko = active.filter(r => r.iiko_config && Object.keys(r.iiko_config).length > 0);
    console.log(`Active & With iiko_config: ${withIiko.length}`);
    for (let r of withIiko) {
      console.log(`- ${r.name} (City: ${r.city}): ${JSON.stringify(r.iiko_config)}`);
    }
  }
}
run();
