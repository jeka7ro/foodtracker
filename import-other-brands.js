import * as fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const toml = fs.readFileSync('netlify.toml', 'utf8');
const url = toml.match(/VITE_SUPABASE_URL = "(.*)"/)[1];
const key = toml.match(/VITE_SUPABASE_ANON_KEY = "(.*)"/)[1];
const supabase = createClient(url, key);

async function run() {
    console.log("Fetching restaurants from DB...");
    const { data: restaurants } = await supabase.from('restaurants').select('id, name, city');

    const smashRests = restaurants.filter(r => r.name.toLowerCase().includes('smash'));
    const wlsRests = restaurants.filter(r => r.name.toLowerCase().includes('we love'));
    const ikuraRests = restaurants.filter(r => r.name.toLowerCase().includes('ikura'));
    // defaults
    const smashFallback = smashRests[0] || restaurants.find(r => r.name === 'SMASH ME CONSTANTA');
    const wlsFallback = wlsRests[0] || restaurants.find(r => r.name === 'WE LOVE SUSHI CONSTANTA');
    const ikuraFallback = ikuraRests[0] || restaurants.find(r => r.name === 'IKURA ORADEA');

    console.log("Reading OLAP CSV...");
    let content = fs.readFileSync('olap_SALES_2026-04-10.csv', 'utf8'); 
    if (content.includes('\u0000')) {
        content = fs.readFileSync('olap_SALES_2026-04-10.csv', 'utf16le');
    }
    
    const lines = content.split('\n');
    let ordersMap = {};

    // Group items into orders
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const parts = line.split(';');
        if (parts.length < 8) continue;
        
        const orderId = parts[0];
        const conception = parts[1];
        const closeTime = parts[2];
        let sourceKey = parts[3].toLowerCase();
        if (!sourceKey) sourceKey = 'ecosystem';
        
        const dishName = parts[4];
        const amount = parseFloat(parts[5].replace(',', '.')) || 1;
        const totalLineAmount = parseFloat(parts[7].replace(',', '.')) || 0;
        
        if (!ordersMap[orderId]) {
            ordersMap[orderId] = {
                platform: sourceKey,
                conception: conception,
                order_id: orderId,
                total_amount: 0,
                placed_at: closeTime + "Z",
                items: [],
                brandType: null
            };
        }
        
        ordersMap[orderId].items.push({
            quantity: amount,
            product_name: dishName,
            amount: totalLineAmount
        });
        ordersMap[orderId].total_amount += totalLineAmount;
        
        // determine brand based on dish name
        const n = dishName.toLowerCase();
        if (n.includes('smash') || n.includes('cheesburger') || n.includes('burger') && !n.includes('somon') && !n.includes('creveti') && !n.includes('ton')) {
            ordersMap[orderId].brandType = 'smash';
        } else if (n.includes('ikura')) {
            ordersMap[orderId].brandType = 'ikura';
        } else if (n.includes('we love')) {
            ordersMap[orderId].brandType = 'wls';
        }
    }

    const dbRows = [];
    for (const order of Object.values(ordersMap)) {
        if (!order.brandType) continue; // skip Sushi Master or unidentifiable
        
        let restId = null;
        if (order.brandType === 'smash') {
            const cityMatch = smashRests.find(r => r.city && order.conception.toLowerCase().includes(r.city.toLowerCase()));
            restId = cityMatch ? cityMatch.id : smashFallback.id;
        } else if (order.brandType === 'ikura') {
            const cityMatch = ikuraRests.find(r => r.city && order.conception.toLowerCase().includes(r.city.toLowerCase()));
            restId = cityMatch ? cityMatch.id : ikuraFallback.id;
        } else if (order.brandType === 'wls') {
            const cityMatch = wlsRests.find(r => r.city && order.conception.toLowerCase().includes(r.city.toLowerCase()));
            restId = cityMatch ? cityMatch.id : wlsFallback.id;
        }

        if (restId) {
            dbRows.push({
                platform: order.platform,
                restaurant_id: restId,
                order_id: order.order_id,
                total_amount: order.total_amount,
                placed_at: order.placed_at,
                items: order.items
            });
        }
    }

    console.log(`Found ${dbRows.length} orders belonging to other brands! Upserting in chunks...`);
    
    let totalInserted = 0;
    const chunkSize = 500;
    for (let i = 0; i < dbRows.length; i += chunkSize) {
        const chunk = dbRows.slice(i, i + chunkSize);
        const { error } = await supabase.from('platform_sales').upsert(chunk, { onConflict: 'order_id' });
        if (error) { console.error("Error upserting:", error.message); break; }
        totalInserted += chunk.length;
    }
    console.log(`Successfully mapped ${totalInserted} historical orders to Smash/Ikura/WLS!`);
}
run();
