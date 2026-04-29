import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
    const { data } = await supabase.from('iiko_catalog').select('brand_name, count(id) as count').group('brand_name');
    console.log("Groups:", data);
    const { data: d2 } = await supabase.from('iiko_catalog').select('category, brand_name, name').ilike('name', '%smash%').limit(5);
    console.log("Smash names:", d2);
}
run();
