require('dotenv').config({path: '.env.local'});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
    const { data: rests } = await supabase.from('restaurants').select('id, name');
    const smRests = rests.filter(r => r.name.toLowerCase().includes('sushi master') || r.name.toLowerCase().includes('sushimaster')).map(r => r.id);
    
    if (smRests.length > 0) {
        const { count } = await supabase.from('platform_sales')
            .select('*', { count: 'exact', head: true })
            .in('restaurant_id', smRests)
            .gte('placed_at', '2026-06-01')
            .lte('placed_at', '2026-06-30');
            
        console.log(`Total count of Sushi Master sales in June: ${count}`);
    }
}
run();
