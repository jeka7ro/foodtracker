import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
const toml = fs.readFileSync('netlify.toml', 'utf8')
const url = toml.match(/VITE_SUPABASE_URL = "(.*)"/)[1]
const key = toml.match(/VITE_SUPABASE_ANON_KEY = "(.*)"/)[1]
const supabase = createClient(url, key)

async function verify() {
    const { data: rests } = await supabase.from('restaurants').select('id, name').filter('name', 'ilike', '%Smash%')
    const restIds = rests.map(r => r.id);
    const { data } = await supabase.from('platform_sales').select('placed_at, total_amount').in('restaurant_id', restIds).lt('placed_at', '2026-04-01');
    console.log("Smash Me orders Jan-March:", data.length);
    if (data.length > 0) {
        console.log("First order placed at:", data[0].placed_at);
    }
}
verify()
