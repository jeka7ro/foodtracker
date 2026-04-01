const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({path: './.env.local'});
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function runImport(filename) {
    console.log(`Processing ${filename}...`);
    try {
        const { data: restaurants } = await supabase.from('restaurants').select('id, name, city');

        const workbook = XLSX.readFile(filename);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        const dataRows = jsonData.filter(row => row.length > 20 && row[0] !== 'Metadate comandă' && row[0] !== 'Denumire restaurant');
        
        const rowsToInsert = [];
        for (const row of dataRows) {
            const rawName = String(row[0] || '');
            const brandPart = rawName.split('(')[0].trim().toLowerCase();
            const cityMap = {
                IAS: 'Iasi', BRV: 'Brasov', GLT: 'Galati', SBU: 'Sibiu', BUC: 'Bucharest', 
                CLJ: 'Cluj-Napoca', TGM: 'Targu Mures', SCV: 'Suceava', ORD: 'Oradea', 
                CRB: 'Craiova', CRV: 'Craiova', CTA: 'Constanta', BCU: 'Bacau', 
                BTO: 'Botosani', PIT: 'Pitesti', TIM: 'Timisoara', TUL: 'Tulcea', 
                BRL: 'Braila', PTN: 'Piatra Neamt'
            };

            let matchedRest = null;
            const matchAbbr = rawName.match(/\[([A-Z]+)\]/);
            
            if (matchAbbr && matchAbbr[1]) {
                const targetCity = cityMap[matchAbbr[1]];
                if (targetCity && restaurants) {
                    matchedRest = restaurants.find(r => 
                        r.name.toLowerCase().includes(brandPart) && 
                        r.city?.toLowerCase() === targetCity.toLowerCase()
                    );
                }
            }
            if (!matchedRest && restaurants) {
                matchedRest = restaurants.find(r => r.name.toLowerCase().includes(brandPart));
            }

            const orderId = String(row[1] || `ERR_${Math.floor(Math.random()*100000)}`);
            const status = String(row[8] || '').toLowerCase();
            
            if (status.includes('anulat')) continue;

            const rawDate = String(row[9] || '');
            let dateObj = new Date(rawDate.replace(' ', 'T'));
            if (isNaN(dateObj.getTime())) dateObj = new Date();

            const val = parseFloat(row[22]) || parseFloat(row[43]) || 0;
            
            const itemsStr = String(row[49] || '');
            const itemsList = [];
            if (itemsStr && itemsStr.length > 0) {
                 itemsStr.split(',').forEach(it => {
                     const match = it.trim().match(/^(\d+)\s+(.+)$/);
                     if (match) {
                         itemsList.push({ quantity: parseInt(match[1]), name: match[2].trim(), price: 0 });
                     }
                 });
            }

            if (val > 0) {
                rowsToInsert.push({
                    platform: 'glovo',
                    restaurant_id: matchedRest ? matchedRest.id : null,
                    order_id: String(orderId),
                    total_amount: val,
                    placed_at: dateObj.toISOString(),
                    items: itemsList
                });
            }
        }

        console.log(`Parsed ${rowsToInsert.length} valid rows to insert from ${filename}. Inserting...`);
        
        let dupesFixed = 0;
        const seenIds = new Set();
        const uniqueRows = [];
        for (const r of rowsToInsert) {
             if (seenIds.has(r.order_id)) {
                 r.order_id = r.order_id + "_DUP_" + Math.floor(Math.random()*1000);
                 dupesFixed++;
             }
             seenIds.add(r.order_id);
             uniqueRows.push(r);
        }
        if (dupesFixed > 0) console.log(`Fixed ${dupesFixed} duplicate intra-file order IDs!`);
        
        const CHUNK_SIZE = 1000;
        for (let i = 0; i < uniqueRows.length; i += CHUNK_SIZE) {
             const chunk = uniqueRows.slice(i, i + CHUNK_SIZE);
             const { error } = await supabase.from('platform_sales').upsert(chunk, { onConflict: 'order_id' });
             if (error) {
                 console.error(`Chunk Error in ${filename} at chunk ${i/CHUNK_SIZE + 1}:`, error.message);
             } else {
                 console.log(`Inserted chunk ${i/CHUNK_SIZE + 1} (${chunk.length} items)...`);
             }
        }
        console.log(`✅ Finished ${filename}!`);
    } catch (err) {
        console.error(`FATAL ERROR processing ${filename}:`, err.message);
    }
}

async function main() {
    await runImport('ianuar.xlsx');
    await runImport('feb.xlsx');
}
main();
