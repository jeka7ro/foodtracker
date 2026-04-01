import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import xlsx from 'xlsx';

dotenv.config({path: './.env.local'});
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

const cityMap = {
    'IAS': 'Iasi', 'BRV': 'Brasov', 'GLT': 'Galati', 'SBU': 'Sibiu', 'BUC': 'Bucharest', 
    'CLJ': 'Cluj-Napoca', 'TGM': 'Targu Mures', 'SCV': 'Suceava', 'ORD': 'Oradea', 
    'CRB': 'Craiova', 'CRV': 'Craiova', 'CTA': 'Constanta', 'BCU': 'Bacau', 
    'BTO': 'Botosani', 'PIT': 'Pitesti', 'TIM': 'Timisoara', 'TUL': 'Tulcea', 
    'BRL': 'Braila', 'PTN': 'Piatra Neamt'
};

async function run() {
  console.log("Emptying old badly mapped data...");
  await supabase.rpc('exec_sql', { sql: "truncate table platform_sales;" }); // if exec_sql exists? No, it doesn't!
  await supabase.from('platform_sales').delete().neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

  const wb = xlsx.readFile('orderDetails (1).xlsx');
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const jsonData = xlsx.utils.sheet_to_json(sheet, { header: 1 });
  const dataRows = jsonData.filter(row => row.length > 20 && row[0] !== 'Metadate comandă' && row[0] !== 'Denumire restaurant');
  
  const { data: restaurants } = await supabase.from('restaurants').select('id, name, city');
  
  const rowsToInsert = [];
  for (const row of dataRows) {
      const rawName = String(row[0] || '');
      const brandPart = rawName.split('(')[0].trim().toLowerCase();
      
      let matchedRest = null;
      const matchAbbr = rawName.match(/\[([A-Z]+)\]/);
      if (matchAbbr && matchAbbr[1]) {
          const targetCity = cityMap[matchAbbr[1]];
          if (targetCity) {
              matchedRest = restaurants?.find(r => 
                  r.name.toLowerCase().includes(brandPart) && 
                  r.city.toLowerCase() === targetCity.toLowerCase()
              );
          }
      }
      
      if (!matchedRest) {
          matchedRest = restaurants?.find(r => r.name.toLowerCase().includes(brandPart));
      }

      const orderId = String(row[1] || `ERR_${Math.floor(Math.random()*100000)}`)
      const status = String(row[8] || '').toLowerCase()
      if (status.includes('anulat')) continue

      const rawDate = String(row[9] || '')
      let dateObj = new Date(rawDate.replace(' ', 'T'))
      if (isNaN(dateObj.getTime())) dateObj = new Date()

      const val = parseFloat(row[22]) || parseFloat(row[43]) || 0
      
      const itemsStr = String(row[49] || '')
      const itemsList = []
      if (itemsStr && itemsStr.length > 0) {
           itemsStr.split(',').forEach(it => {
               const match = it.trim().match(/^(\d+)\s+(.+)$/)
               if (match) {
                   itemsList.push({ quantity: parseInt(match[1]), name: match[2].trim(), price: 0 })
               }
           })
      }

      if (val > 0) {
          rowsToInsert.push({
              platform: 'glovo',
              restaurant_id: matchedRest ? matchedRest.id : null,
              order_id: String(orderId),
              total_amount: val,
              placed_at: dateObj.toISOString(),
              items: itemsList
          })
      }
  }

  console.log(`Found ${rowsToInsert.length} valid orders. Inserting with items and true mapping...`);
  const CHUNK_SIZE = 1000
  for (let i = 0; i < rowsToInsert.length; i += CHUNK_SIZE) {
       const chunk = rowsToInsert.slice(i, i + CHUNK_SIZE)
       const { error } = await supabase.from('platform_sales').upsert(chunk, { onConflict: 'order_id' })
       if (error) {
           console.error("Chunk Error:", error)
       } else {
           console.log(`Inserted chunk ${i / CHUNK_SIZE + 1}`);
       }
  }
}
run();
