const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({path: './.env.local'});
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
    let months = {};
    for (let i = 0; i < 11; i++) {
        const { data: sales, error } = await supabase.from('platform_sales').select('placed_at').range(i*1000, i*1000 + 999);
        if (sales) {
            sales.forEach(s => {
                const m = new Date(s.placed_at).getMonth();
                months[m] = (months[m] || 0) + 1;
            });
        }
    }
    console.log("Sales distribution:", months);
}
check();
