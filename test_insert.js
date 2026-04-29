import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
const toml = fs.readFileSync('netlify.toml', 'utf8');
const url = toml.match(/VITE_SUPABASE_URL = "(.*)"/)[1];
const key = toml.match(/VITE_SUPABASE_ANON_KEY = "(.*)"/)[1];
const supabase = createClient(url, key);
async function run() {
    const { error } = await supabase.from('platform_sales').insert([{
        platform: 'glovo', restaurant_id: '4384c323-67a2-468b-aea3-9fc925787868', order_id: 'test-order-xlsx', total_amount: 10, placed_at: new Date().toISOString(), items: []
    }]);
    console.log("Insert Error:", error ? error.message : "Success!");
}
run();
