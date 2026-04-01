const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({path: './.env.local'});
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
    const { data: sales, error } = await supabase.from('platform_sales').select('placed_at');
    let months = {};
    if (sales) {
        sales.forEach(s => {
            const m = new Date(s.placed_at).getMonth();
            months[m] = (months[m] || 0) + 1;
        });
        console.log("Sales grouped by month index:", months);
    } else {
        console.log("Error or no sales:", error);
    }
}
check();
