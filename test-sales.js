import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

const supaUrl = process.env.VITE_SUPABASE_URL;
const supaKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supaUrl, supaKey);

async function inspectSales() {
    console.log('Querying limited platform_sales...');
    const now = new Date();
    const fromDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const { data, error } = await supabase.from('platform_sales').select('items, placed_at')
        .gte('placed_at', fromDate.toISOString())
        .limit(200);
        
    if (error) { console.error('Error fetching sales:', error); return; }
    
    console.log(`Fetched ${data.length} sales. Snippets of items containing 'Shanghai':`);
    if (data.length > 0) {
        let count = 0;
        data.forEach(d => {
            if (d.items) {
               d.items.forEach(it => {
                  if (it.name && it.name.includes('Shanghai')) {
                     console.log('Match!', it.name, 'Time:', d.placed_at);
                     count++;
                  }
               });
            }
        });
        console.log(`Total occurrences found: ${count}`);
    }
}

inspectSales();
