require('dotenv').config({path: '.env.local'});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
    const { data: rests } = await supabase.from('restaurants').select('id, name, brand_id, is_active');
    
    const mayRestId = '0bebd05c-af98-421a-9f47-a3b46f21cdb0';
    const mayRest = rests.find(r => r.id === mayRestId);
    console.log("May restaurant info:");
    console.log(mayRest);
    
    if (mayRest && mayRest.brand_id) {
        const { data: brand } = await supabase.from('brands').select('*').eq('id', mayRest.brand_id).single();
        console.log("May Brand info:");
        console.log(brand);
    }
}
run();
