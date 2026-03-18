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
    const sqls = [
        "CREATE INDEX IF NOT EXISTS idx_competitor_products_restaurant_id ON competitor_products(restaurant_id);",
        "CREATE INDEX IF NOT EXISTS idx_competitor_products_competitor_restaurant_id ON competitor_products(competitor_restaurant_id);",
        "CREATE INDEX IF NOT EXISTS idx_competitor_restaurants_snapshot_id ON competitor_restaurants(snapshot_id);"
    ];

    for (const sql of sqls) {
        console.log('Running:', sql);
        const { error } = await supabase.rpc('exec_sql', { sql });
        if (error) {
            console.error('Error:', error.message);
        } else {
            console.log('Success');
        }
    }
}
run();
