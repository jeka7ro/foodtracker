import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({path: './.env.local'});
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const sql = `
    CREATE TABLE IF NOT EXISTS saved_market_analytics (
        id bigint primary key generated always as identity,
        snapshot_date date,
        product_name text,
        category text,
        our_brand text,
        comp_brand text,
        our_price numeric,
        comp_price numeric,
        weight text,
        pieces text,
        platform text,
        city text,
        created_at timestamp with time zone default timezone('utc'::text, now())
    );
  `;
  const { error } = await supabase.rpc('exec_sql', { sql });
  if (error) console.error('exec_sql error:', error.message);
  else console.log('Table saved_market_analytics created');
}
run();
