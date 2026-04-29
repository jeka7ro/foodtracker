import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
const toml = fs.readFileSync('netlify.toml', 'utf8');
const url = toml.match(/VITE_SUPABASE_URL = "(.*)"/)[1];
const supaKey = toml.match(/VITE_SUPABASE_ANON_KEY = "(.*)"/)[1];
const supabase = createClient(url, supaKey);

const parseItemName = (name) => {
    if (!name) return 'Produs Necunoscut';
    let clean = name.trim();
    if (clean.toUpperCase().startsWith('P_')) clean = clean.substring(2);
    clean = clean.replace(/SushiMaster/ig, '').trim();
    clean = clean.replace(/♥LOVE♥/ig, 'la').trim();
    clean = clean.replace(/\[.*?\]/g, '').trim();
    clean = clean.replace(/_BASE_/ig, ' ').trim();
    return clean.trim() || name;
}

async function run() {
    const { data } = await supabase.from('platform_sales').select('items').limit(200);
    
    data.forEach(sale => {
        if (!sale.items) return;
        sale.items.forEach(it => {
            const rawName = it.product_name || it.name || 'Produs Necunoscut';
            const nameLower = rawName.toLowerCase();
            const filtered = (nameLower.includes('delivery') || nameLower.includes('livrare') || nameLower.includes('pung') || nameLower.includes('ambalaj') || nameLower.includes('cutie') || nameLower.includes('sacos'));
            
            if (rawName.includes('WOLT_BASE_DELIVERY') || rawName.includes('We Love Fusion')) {
                console.log("Found:", rawName);
                console.log("Filtered?", filtered);
                console.log("Parsed:", parseItemName(rawName));
            }
        });
    });
}
run();
