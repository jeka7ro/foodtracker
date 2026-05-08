import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
const toml = fs.readFileSync('netlify.toml', 'utf8')
const url = toml.match(/VITE_SUPABASE_URL = "(.*)"/)[1]
const key = toml.match(/VITE_SUPABASE_ANON_KEY = "(.*)"/)[1]
const supabase = createClient(url, key)

async function check() {
    const { data } = await supabase.from('platform_sales').select('items').not('items', 'is', null)
    const items = new Set();
    for (const d of data) {
        if (!d.items) continue;
        for (const it of d.items) {
            items.add(it.product_name);
        }
    }
    fs.writeFileSync('scratch/all-items.json', JSON.stringify(Array.from(items), null, 2));
}
check()
