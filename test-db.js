import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function test() {
  const { data, error } = await supabase.from('aggregator_jobs').select('*').limit(1);
  console.log('Result:', data, error ? error.message : 'OK');
  process.exit(0);
}
test();
