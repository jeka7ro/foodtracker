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
    console.time('query');
    const { data: d1, error: e1 } = await supabase
        .from('competitor_restaurants')
        .select(`
            id, name, url, logo_url, rank_position, rating,
            competitor_snapshots!inner ( platform, city, snapshot_date, search_id )
        `)
        .order('id', { ascending: false })
        .limit(2000);
    console.timeEnd('query');
    console.log('Error 1:', e1?.message);
    if (!d1) return process.exit();
    console.log('Rests length:', d1.length);
    
    console.time('query2');
    const ids = d1.map(d => d.id).slice(0, 500); // 500 at a time
    const { data: d2, error: e2 } = await supabase
        .from('competitor_products')
        .select('restaurant_id, product_name, price')
        .in('restaurant_id', ids);
    console.timeEnd('query2');
    console.log('Products fetched for 500 rests:', d2?.length, 'error:', e2?.message);
    process.exit();
}
run();
