import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({path: './.env.local'});

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function createTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS platform_sales (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        restaurant_id BIGINT REFERENCES restaurants(id) ON DELETE CASCADE,
        platform VARCHAR(50) NOT NULL,
        order_id VARCHAR(100),
        total_amount NUMERIC(10, 2),
        placed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        items JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_platform_sales_placed_at ON platform_sales (placed_at DESC);
    CREATE INDEX IF NOT EXISTS idx_platform_sales_restaurant_id ON platform_sales (restaurant_id);
    CREATE INDEX IF NOT EXISTS idx_platform_sales_platform ON platform_sales (platform);

    ALTER TABLE platform_sales ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Allow ALL open access platform_sales_ro" 
        ON platform_sales FOR ALL USING (true);
  `;
  const { error } = await supabase.rpc('exec_sql', { sql });
  if (error) {
      console.error('exec_sql error:', error.message);
  } else {
      console.log('✅ Tabelul REAL [platform_sales] a fost creat in Supabase cu succes!');
      console.log('Backend-ul este pregatit sa primeasca Date Financiare din Webhooks sau API Scrapers.');
  }
}

createTable();
