import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
    const { data } = await supabase.from('restaurants').select('*').in('name', ['IKURA ORADEA', 'SM ORADEA', 'SM BUC TITAN']);
    for (const d of data) {
         console.log('deleting id: ', d.id)
         await supabase.from('restaurants').delete().eq('id', d.id);
    }
    console.log("Done. Left:", (await supabase.from('restaurants').select('name').eq('name', 'IKURA ORADEA')).data);
}
run();
