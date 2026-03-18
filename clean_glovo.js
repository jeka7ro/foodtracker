import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: './workers/.env' })

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
    console.log('Ștergem produse Glovo...');
    const { error: e1 } = await supabase.from('competitor_products').delete().eq('platform', 'glovo');
    console.log('Eroare la ștergerea produselor Glovo:', e1 ? e1.message : 'Niciuna (succes)');
    
    // Deleting Glovo restaurants
    console.log('Ștergem snapshouts și restaurante Glovo...');
    const { error: e3 } = await supabase.from('competitor_snapshots').delete().eq('platform', 'glovo');
    console.log('Eroare la ștergerea snapshots Glovo:', e3 ? e3.message : 'Niciuna (succes)');
}
run();
