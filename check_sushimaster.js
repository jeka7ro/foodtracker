require('dotenv').config({path: '.env.local'});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
    const { data: rests } = await supabase.from('restaurants').select('id, name');
    const smRests = rests.filter(r => r.name.toLowerCase().includes('sushi master') || r.name.toLowerCase().includes('sushimaster')).map(r => r.id);
    console.log("Sushi Master restaurant IDs:", smRests);
    
    if (smRests.length > 0) {
        const { data: sales } = await supabase.from('platform_sales')
            .select('placed_at, total_amount')
            .in('restaurant_id', smRests)
            .gte('placed_at', '2026-06-01')
            .lte('placed_at', '2026-06-30')
            .order('placed_at', { ascending: false });
        
        console.log(`Total sales in June for Sushi Master: ${sales?.length}`);
        if (sales && sales.length > 0) {
            console.log(`Last sale in June: ${sales[0].placed_at}, Amount: ${sales[0].total_amount}`);
            console.log(`First sale in June: ${sales[sales.length-1].placed_at}, Amount: ${sales[sales.length-1].total_amount}`);
            
            // Group by day to see distribution
            const byDay = {};
            sales.forEach(s => {
                const day = s.placed_at.split('T')[0];
                byDay[day] = (byDay[day] || 0) + 1;
            });
            console.log("Sales per day in June:");
            Object.keys(byDay).sort().forEach(d => console.log(`${d}: ${byDay[d]} sales`));
        }
    }
}
run();
