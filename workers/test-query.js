import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envText = fs.readFileSync('./.env', 'utf-8');
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
        .select(`id, competitor_snapshots!inner(platform)`)
        .order('id', { ascending: false })
        .limit(2000);
    console.timeEnd('query');
    console.log('Error 1:', e1?.message);

    console.time('query2');
    const { data: d2, error: e2 } = await supabase
        .from('competitor_restaurants')
        .select(`id, competitor_products(product_name, price)`)
        .order('id', { ascending: false })
        .limit(2000);
    console.timeEnd('query2');
    console.log('Error 2:', e2?.message);
    process.exit();
}
run();
