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
    const { data, error } = await supabase
        .from('competitor_products')
        .select('*')
        .limit(1);
    console.log(data?.[0], error?.message);
    process.exit();
}
run();
