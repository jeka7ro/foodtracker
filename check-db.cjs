require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
    console.log("Checking iiko catalog items summary:");
    
    // Grouping manually since .group() doesn't exist
    const { data: allItems } = await supabase.from('iiko_catalog').select('brand_name, category, name');
    
    const brands = {};
    for(const item of allItems || []) {
        brands[item.brand_name] = (brands[item.brand_name] || 0) + 1;
    }
    console.log("Brands distribution:", brands);

    const smashItems = allItems.filter(i => (i.category || '').toLowerCase().includes('smash') || (i.name || '').toLowerCase().includes('smash'));
    console.log("Smash items literally found:", smashItems.length > 0 ? smashItems.map(i => i.name) : "NONE!");
}
run();
