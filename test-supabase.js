const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function test() {
  const { error } = await supabase.from('delivery_zone_configs').insert({
    name: "Test",
    restaurant_name: "Test",
    brand: "Test",
    city: "Bucharest",
    platform: "wolt",
    addresses: [],
    is_active: true
  });
  console.log("Error:", error);
}
test();
