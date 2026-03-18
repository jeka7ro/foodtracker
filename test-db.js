import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('workers/.env', 'utf8')
const supabaseUrl = env.match(/SUPABASE_URL=(.*)/)[1].trim()
const supabaseKey = env.match(/SUPABASE_SERVICE_KEY=(.*)/)[1].trim()
const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
    const { data } = await supabase.from('own_product_snapshots').select('*').limit(10)
    console.log("OWN PRODUCTS", data.map(d => d.product_name))
}
test()
