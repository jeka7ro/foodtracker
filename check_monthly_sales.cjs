require('dotenv').config({path: '.env.local'});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
    // get a few rows from May
    const { data: salesMay } = await supabase.from('platform_sales')
        .select('placed_at, restaurant_id, total_amount')
        .gte('placed_at', '2026-05-01')
        .lte('placed_at', '2026-05-31')
        .limit(5);
        
    console.log("May Sales Sample:");
    console.log(salesMay);
    
    // get a few rows from June
    const { data: salesJun } = await supabase.from('platform_sales')
        .select('placed_at, restaurant_id, total_amount')
        .gte('placed_at', '2026-06-01')
        .lte('placed_at', '2026-06-30')
        .limit(5);
        
    console.log("June Sales Sample:");
    console.log(salesJun);
}
run();
