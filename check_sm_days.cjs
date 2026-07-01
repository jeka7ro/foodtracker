require('dotenv').config({path: '.env.local'});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
    const { data: rests } = await supabase.from('restaurants').select('id, name');
    const smRests = rests.filter(r => r.name.toLowerCase().includes('sushi master') || r.name.toLowerCase().includes('sushimaster')).map(r => r.id);
    
    if (smRests.length > 0) {
        const { data: sales, error } = await supabase.from('platform_sales')
            .select('placed_at')
            .in('restaurant_id', smRests)
            .gte('placed_at', '2026-06-01')
            .lte('placed_at', '2026-06-30')
            .order('placed_at', { ascending: true }); // Need all of them to group, so we need pagination
            
        // actually let's just fetch all by chunks
        let allSales = [];
        let offset = 0;
        let limit = 1000;
        while(true) {
            const { data } = await supabase.from('platform_sales').select('placed_at').in('restaurant_id', smRests).gte('placed_at', '2026-06-01').lte('placed_at', '2026-06-30').range(offset, offset+limit-1);
            if(!data || data.length === 0) break;
            allSales.push(...data);
            offset += limit;
        }
        
        const byDay = {};
        allSales.forEach(s => {
            const day = s.placed_at.split('T')[0];
            byDay[day] = (byDay[day] || 0) + 1;
        });
        console.log("Sushi Master Sales per day in June:");
        Object.keys(byDay).sort().forEach(d => console.log(`${d}: ${byDay[d]} sales`));
    }
}
run();
