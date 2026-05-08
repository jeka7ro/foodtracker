import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
const toml = fs.readFileSync('netlify.toml', 'utf8')
const url = toml.match(/VITE_SUPABASE_URL = "(.*)"/)[1]
const key = toml.match(/VITE_SUPABASE_ANON_KEY = "(.*)"/)[1]
const supabase = createClient(url, key)

async function check() {
    const { data } = await supabase.from('platform_sales').select('items, restaurant_id').not('items', 'is', null).limit(5)
    console.log(JSON.stringify(data, null, 2))
}
check()
