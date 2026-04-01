import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import xlsx from 'xlsx';

dotenv.config({path: './.env.local'});
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const wb = xlsx.readFile('orderDetails (1).xlsx');
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const jsonData = xlsx.utils.sheet_to_json(sheet, { header: 1 });
  const dataRows = jsonData.filter(row => row.length > 20 && row[0] !== 'Metadate comandă' && row[0] !== 'Denumire restaurant');
  
  const { data: restaurants } = await supabase.from('restaurants').select('id, name');
  
  const rowsToInsert = [];
  for (const row of dataRows) {
      const restaurantName = String(row[0] || 'Unknown').split('(')[0].trim()
      const orderId = String(row[1] || `ERR_${Math.floor(Math.random()*100000)}`)
      const status = String(row[8] || '').toLowerCase()
      if (status.includes('anulat')) continue

      const rawDate = String(row[9] || '')
      let dateObj = new Date(rawDate.replace(' ', 'T'))
      if (isNaN(dateObj.getTime())) dateObj = new Date()

      const val = parseFloat(row[22]) || parseFloat(row[43]) || 0
      if (val > 0) {
          const matchedRest = restaurants?.find(r => r.name.toLowerCase().includes(restaurantName.toLowerCase()))
          rowsToInsert.push({
              platform: 'glovo',
              restaurant_id: matchedRest ? matchedRest.id : null,
              order_id: String(orderId),
              total_amount: val,
              placed_at: dateObj.toISOString(),
              items: []
          })
      }
  }

  console.log(`Found ${rowsToInsert.length} valid orders. Inserting...`);
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
