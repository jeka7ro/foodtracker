import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const toml = fs.readFileSync('netlify.toml', 'utf8');
const url = toml.match(/VITE_SUPABASE_URL = "(.*)"/)[1];
const supaKey = toml.match(/VITE_SUPABASE_ANON_KEY = "(.*)"/)[1];
const supabase = createClient(url, supaKey);

async function run() {
    console.time("Count");
    const { count } = await supabase.from('platform_sales').select('id', { count: 'exact', head: true });
    console.timeEnd("Count");
    console.log("Count:", count);

    console.time("Fetch 1000");
    const { data } = await supabase.from('platform_sales').select('id, placed_at, total_amount, platform, items').range(0, 999);
    console.timeEnd("Fetch 1000");
    console.log("Fetched Length:", data ? data.length : 0);
}
run();
