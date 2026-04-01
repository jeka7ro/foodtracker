const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({path: './.env.local'});
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
    const { data: sales, error } = await supabase.from('platform_sales').select('placed_at, order_id').limit(10);
    console.log("Sample placed_at dates:", sales);
}
check();
