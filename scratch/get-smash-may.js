import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
const toml = fs.readFileSync('netlify.toml', 'utf8')
const url = toml.match(/VITE_SUPABASE_URL = "(.*)"/)[1]
const key = toml.match(/VITE_SUPABASE_ANON_KEY = "(.*)"/)[1]
const supabase = createClient(url, key)

async function check() {
    const { data: rests } = await supabase.from('restaurants').select('id, name').filter('name', 'ilike', '%Smash%')
    const restIds = rests.map(r => r.id);
    const { data: orders } = await supabase.from('platform_sales').select('items').in('restaurant_id', restIds).gte('placed_at', '2026-04-01');
    const items = new Set();
    for (const d of orders||[]) {
        if (!d.items) continue;
        for (const it of d.items) {
            items.add(it.product_name);
        }
    }
    console.log("Smash Me Products:", Array.from(items));
}
check()
