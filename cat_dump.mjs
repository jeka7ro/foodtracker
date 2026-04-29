import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
    const { data } = await supabase.from('iiko_catalog').select('category');
    const counts = {};
    for (const d of data) {
         counts[d.category] = (counts[d.category] || 0) + 1;
    }
    console.log(counts);
}
run();
