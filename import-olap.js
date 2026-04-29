import * as fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const toml = fs.readFileSync('netlify.toml', 'utf8');
const url = toml.match(/VITE_SUPABASE_URL = "(.*)"/)[1];
const key = toml.match(/VITE_SUPABASE_ANON_KEY = "(.*)"/)[1];
const supabase = createClient(url, key);

async function run() {
    console.log("Fetching restaurants from DB...");
    const { data: restaurants } = await supabase.from('restaurants').select('id, name, city');

    console.log("Wiping platform_sales before 2026-04-01...");
    // Since there are 29,000 orders, we might need to delete in chunks, or just use a wide delete
    const { error: delErr } = await supabase.from('platform_sales').delete().lt('placed_at', '2026-04-01T00:00:00Z');
    if (delErr) { console.log("Del error:", delErr); }

    console.log("Reading CSV...");
    const raw = fs.readFileSync('olap_SALES_2026-04-10.csv', 'utf16le'); // or utf8?
    // Wait! Let's check encoding and delimiter carefully
    let content = fs.readFileSync('olap_SALES_2026-04-10.csv', 'utf8'); 
    
    // Some Iiko exports are UTF-16, let's auto detect if it has null bytes
    if (content.includes('\u0000')) {
        content = fs.readFileSync('olap_SALES_2026-04-10.csv', 'utf16le');
    }
    
    const lines = content.split('\n');
    let ordersMap = {};

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
            let matchedRest = null;
            const rName = conception.toLowerCase();
            matchedRest = restaurants.find(r => {
                const parts = r.city.toLowerCase().split(' ');
                const cityMatch = parts.some(p => rName.includes(p));
                const n = r.name.toLowerCase();
                const nmMatch = rName.includes(n.split(' ')[0]) || n.includes('sushi master');
                return cityMatch && nmMatch;
            });
            if (!matchedRest) {
                if (rName.includes('bucuresti') || rName.includes('titan')) matchedRest = restaurants.find(r => r.name.includes('TITAN'));
                if (rName.includes('tulcea')) matchedRest = restaurants.find(r => r.name.includes('Constanta')); // fallback
                if (!matchedRest) matchedRest = restaurants.find(r => r.id === '4384c323-67a2-468b-aea3-9fc925787868'); // fallback
            }

            ordersMap[orderId] = {
                platform: sourceKey,
                restaurant_id: matchedRest.id,
                order_id: orderId,
                total_amount: 0,
                placed_at: closeTime + "Z",
                items: []
            };
        }
        
        ordersMap[orderId].items.push({
            quantity: amount,
            product_name: dishName,
            amount: totalLineAmount
        });
        ordersMap[orderId].total_amount += totalLineAmount;
    }

    const dbRows = Object.values(ordersMap);
    console.log(`Found ${dbRows.length} grouped orders. Upserting in chunks...`);
    
    let totalInserted = 0;
    const chunkSize = 500;
    for (let i = 0; i < dbRows.length; i += chunkSize) {
        const chunk = dbRows.slice(i, i + chunkSize);
        const { error } = await supabase.from('platform_sales').upsert(chunk, { onConflict: 'order_id' });
        if (error) { console.error("Error upserting:", error.message); break; }
        totalInserted += chunk.length;
    }
    console.log(`Successfully inserted ${totalInserted} orders!`);
}
run();
