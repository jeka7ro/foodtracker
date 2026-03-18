import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase.from('delivery_zone_configs').insert({
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
