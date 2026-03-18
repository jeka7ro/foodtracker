import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envText = fs.readFileSync('./workers/.env', 'utf-8');
const env = envText.split('\n').reduce((acc, line) => {
    const [k, ...v] = line.split('=');
    if(k && v.length) acc[k.trim()] = v.join('=').trim().replace(/['"]/g, '');
    return acc;
}, {});

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

async function run() {
    console.time('query_full');
    const { data: rows, error } = await supabase
        .from('competitor_restaurants')
        .select(`
            id, name, url, logo_url, rank_position, rating,
            competitor_snapshots!inner ( platform, city, snapshot_date, search_id ),
            competitor_products ( product_name, price )
        `)
        .order('id', { ascending: false })
        .limit(2000);
    console.timeEnd('query_full');
    console.log('Error:', error?.message);
    if (!rows) return process.exit();
    console.log('Rows length:', rows.length);
    process.exit();
}
run();
