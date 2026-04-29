import * as fs from 'fs';
import * as xlsx from 'xlsx';
import { createClient } from '@supabase/supabase-js';

const toml = fs.readFileSync('netlify.toml', 'utf8');
const url = toml.match(/VITE_SUPABASE_URL = "(.*)"/)[1];
const key = toml.match(/VITE_SUPABASE_ANON_KEY = "(.*)"/)[1];
const supabase = createClient(url, key);

async function run() {
    console.log("Fetching restaurants from DB...");
    const { data: restaurants } = await supabase.from('restaurants').select('id, name, city');
    
    const files = ['ianuar.xlsx', 'feb.xlsx', 'martie.xlsx'];
    let totalInserted = 0;
    
    for (const file of files) {
        if (!fs.existsSync(file)) continue;
        console.log(`Processing ${file}...`);
        
        const buf = fs.readFileSync(file);
        const workbook = xlsx.read(buf, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const json = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "", range: 1 });
        
        const dbRows = [];
        for (const row of json) {
            if (!row['ID comandă']) continue;
            
            const rName = row['Denumire restaurant'].toLowerCase();
            // Fuzzy match logic
            let matchedRest = restaurants.find(r => {
                const parts = r.city.toLowerCase().split(' ');
                const cityMatch = parts.some(p => rName.includes(p));
                const n = r.name.toLowerCase();
                const nmMatch = rName.includes(n.split(' ')[0]) || n.includes('sushi master');
                return cityMatch && nmMatch;
            });
            // Specific overrides
            if (rName.includes('bucuresti') || rName.includes('buc')) {
                if (rName.includes('titan')) matchedRest = restaurants.find(r => r.name.includes('TITAN'));
                else matchedRest = restaurants.find(r => r.city === 'Bucharest' && r.name.toLowerCase().includes('sushi master'));
            }
            if (rName.includes('oradea')) {
                if (rName.includes('ikura')) matchedRest = restaurants.find(r => r.name.includes('IKURA'));
                else matchedRest = restaurants.find(r => r.name === 'SM ORADEA');
            }
            
            if (!matchedRest) matchedRest = restaurants.find(r => r.id === '4384c323-67a2-468b-aea3-9fc925787868'); // fallback
            
            const placedAtStr = row['Comandă primită la'];
            const placed_at = placedAtStr ? new Date(placedAtStr.replace(' ', 'T')).toISOString() : new Date().toISOString();
            
            const amountStr = String(row['Subtotal']);
            const total_amount = parseFloat(amountStr.replace(/[^0-9.,]/g, '').replace(',', '.')) || 0;
            
            const items = [];
            let art = row['Articole comandă'];
            if (art) {
                const rx = /(\d+)\s+(.+?)(?:,\s*(?=\d+\s)|\s*$)/g;
                let match;
                while ((match = rx.exec(art)) !== null) {
                    items.push({ quantity: parseInt(match[1]) || 1, amount: parseInt(match[1])||1, product_name: match[2].trim() });
                }
            }
            
            dbRows.push({
                platform: 'glovo',
                restaurant_id: matchedRest.id,
                order_id: String(row['ID comandă']),
                total_amount,
                placed_at,
                items
            });
        }
        
        console.log(`Found ${dbRows.length} valid orders. Upserting in chunks...`);
        const chunkSize = 500;
        for (let i=0; i<dbRows.length; i+=chunkSize) {
           const chunk = dbRows.slice(i, i+chunkSize);
           const { error } = await supabase.from('platform_sales').upsert(chunk, { onConflict: 'order_id' });
           if (error) console.error("Error upserting:", error.message);
           else totalInserted += chunk.length;
        }
    }
    console.log(`ALL DONE! Successfully inserted ${totalInserted} orders!`);
}
run();
