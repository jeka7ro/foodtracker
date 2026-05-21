import dotenv from 'dotenv';
dotenv.config({ path: './.env.local' });

async function run() {
    const { supabase } = await import('./workers/src/services/supabase.js');
    const { data, error } = await supabase.from('platform_sales').select('id, placed_at').order('placed_at', { ascending: false }).limit(5);
    console.log(data, error);
    process.exit(0);
}
run();
