import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'

const toml = fs.readFileSync('netlify.toml', 'utf8')
const url = toml.match(/VITE_SUPABASE_URL = "(.*)"/)[1]
const key = toml.match(/VITE_SUPABASE_ANON_KEY = "(.*)"/)[1]
const supabase = createClient(url, key)

async function remap() {
    console.log("Fetching restaurants...");
    const { data: restaurants } = await supabase.from('restaurants').select('id, name, city');

    const smashRests = restaurants.filter(r => r.name.toLowerCase().includes('smash'));
    const wlsRests = restaurants.filter(r => r.name.toLowerCase().includes('we love'));
    const ikuraRests = restaurants.filter(r => r.name.toLowerCase().includes('ikura'));
    
    const smashFallback = smashRests[0] || restaurants.find(r => r.name === 'SMASH ME CONSTANTA');
    const wlsFallback = wlsRests[0] || restaurants.find(r => r.name === 'WE LOVE SUSHI CONSTANTA');
    const ikuraFallback = ikuraRests[0] || restaurants.find(r => r.name === 'IKURA ORADEA');

    console.log("Fetching orders from Jan 1st to May 1st...");
    
    // Fetch all orders in chunks to avoid memory issues
    let allOrders = [];
    let from = 0;
    const limit = 5000;
    while (true) {
        const { data, error } = await supabase.from('platform_sales')
            .select('id, order_id, restaurant_id, items')
            .gte('placed_at', '2026-01-01T00:00:00Z')
            .lt('placed_at', '2026-05-01T00:00:00Z')
            .range(from, from + limit - 1);
        
        if (error) {
            console.error(error);
            break;
        }
        if (!data || data.length === 0) break;
        allOrders.push(...data);
        from += limit;
        console.log(`Fetched ${allOrders.length} orders...`);
    }

    console.log(`Total orders fetched: ${allOrders.length}`);
    
    const updates = [];
    
    for (const order of allOrders) {
        if (!order.items || order.items.length === 0) continue;
        
        let brandType = null;
        for (const it of order.items) {
            const n = (it.product_name || '').toLowerCase();
            
            // Smash Me checks
            if (
                n.includes('smash') || 
                n.includes('cheesburger') || 
                (n.includes('burger') && !n.includes('somon') && !n.includes('creveti') && !n.includes('ton')) ||
                n.includes('legend') ||
                n.includes('jalapeno') ||
                n.includes('boss') ||
                n.includes('oklahoma') ||
                n.includes('hotti') ||
                n.includes('crunch') ||
                n.includes('smoky') ||
                n.includes('ranch') ||
                n.includes('churros') ||
                n.includes('cheesy')
            ) {
                brandType = 'smash';
                break;
            }
            
            // Ikura checks
            if (n.includes('ikura')) {
                brandType = 'ikura';
                break;
            }
            
            // We Love Sushi checks
            if (n.includes('we love') || n.includes('wls')) {
                brandType = 'wls';
                break;
            }
        }
        
        if (!brandType) continue;
        
        // Find if it's already assigned correctly
        const curRest = restaurants.find(r => r.id === order.restaurant_id);
        const curName = (curRest?.name || '').toLowerCase();
        
        if (brandType === 'smash' && !curName.includes('smash')) {
            // Remap to Smash Me
            updates.push({ id: order.id, restaurant_id: smashFallback.id });
        } else if (brandType === 'ikura' && !curName.includes('ikura')) {
            // Remap to Ikura
            updates.push({ id: order.id, restaurant_id: ikuraFallback.id });
        } else if (brandType === 'wls' && !curName.includes('we love')) {
            // Remap to WLS
            updates.push({ id: order.id, restaurant_id: wlsFallback.id });
        }
    }
    
    console.log(`Found ${updates.length} orders to remap!`);
    
    let totalUpdated = 0;
    const chunkSize = 500;
    for (let i = 0; i < updates.length; i += chunkSize) {
        const chunk = updates.slice(i, i + chunkSize);
        
        // Since we are doing bulk updates, we can use upsert on the primary key `id`
        // Wait, we only have `id` and `restaurant_id` in `updates`. 
        // Supabase upsert requires full row unless we use `.update()` but `.update()` doesn't support bulk out-of-the-box in JS client easily without loop.
        // It's better to update one by one or in small batches using Promise.all
        
        const promises = chunk.map(u => 
            supabase.from('platform_sales').update({ restaurant_id: u.restaurant_id }).eq('id', u.id)
        );
        
        await Promise.all(promises);
        totalUpdated += chunk.length;
        console.log(`Updated ${totalUpdated} / ${updates.length}`);
    }
    
    console.log("DONE! Smash Me and others are now correctly remapped!");
}
remap().catch(console.error);
