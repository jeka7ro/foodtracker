import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const toml = fs.readFileSync('netlify.toml', 'utf8');
const url = toml.match(/VITE_SUPABASE_URL = "(.*)"/)[1];
const supaKey = toml.match(/VITE_SUPABASE_ANON_KEY = "(.*)"/)[1];
const supabase = createClient(url, supaKey);

async function check() {
    const { count: c1 } = await supabase.from('platform_sales').select('id', {count: 'exact', head: true}).gte('placed_at', '2026-01-01').lt('placed_at', '2026-02-01');
    const { count: c2 } = await supabase.from('platform_sales').select('id', {count: 'exact', head: true}).gte('placed_at', '2026-02-01').lt('placed_at', '2026-03-01');
    const { count: c3 } = await supabase.from('platform_sales').select('id', {count: 'exact', head: true}).gte('placed_at', '2026-03-01').lt('placed_at', '2026-04-01');
    
    console.log("Jan:", c1);
    console.log("Feb:", c2);
    console.log("Mar:", c3);
}
check();
