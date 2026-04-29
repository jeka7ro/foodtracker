import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
const toml = fs.readFileSync('netlify.toml', 'utf8');
const url = toml.match(/VITE_SUPABASE_URL = "(.*)"/)[1];
const supaKey = toml.match(/VITE_SUPABASE_ANON_KEY = "(.*)"/)[1];
const supabase = createClient(url, supaKey);

async function run() {
    console.time("TotalFetchCon20");
    let allData = [];
    let hasMore = true;
    let i = 0;
    const step = 1000;
    const concurrency = 20;
    
    while (hasMore) {
        const batchPromises = [];
        for (let c = 0; c < concurrency; c++) {
            const start = i + c * step;
            let query = supabase.from('platform_sales')
                .select('id, placed_at, total_amount, platform, restaurant_id')
                .gte('placed_at', '2026-01-01')
                .order('placed_at', { ascending: true })
                .range(start, start + step - 1);
            batchPromises.push(query.then(res => res.data || []));
        }
        
        const chunks = await Promise.all(batchPromises);
        let currentBatchCount = 0;
        for (const chunk of chunks) {
            allData.push(...chunk);
            currentBatchCount += chunk.length;
            if (chunk.length < step) {
                hasMore = false;
            }
        }
        if (!hasMore) break;
        i += concurrency * step;
    }
    console.timeEnd("TotalFetchCon20");
    console.log("Rows fetched:", allData.length);
}
run();
