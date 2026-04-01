import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({path: './.env.local'});
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const sql = `
    CREATE TABLE IF NOT EXISTS public.platform_sales (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        platform TEXT NOT NULL,
        restaurant_id UUID,
        order_id TEXT UNIQUE NOT NULL,
        total_amount NUMERIC(10,2) NOT NULL,
        placed_at TIMESTAMPTZ NOT NULL,
        items JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS public.platform_reviews (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        platform TEXT NOT NULL,
        location_id TEXT,
        order_id TEXT UNIQUE NOT NULL,
        customer_name TEXT,
        rating NUMERIC(3,1),
        comment TEXT,
        sentiment TEXT,
        platform_url TEXT,
        reviewed_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now()
    );

    ALTER TABLE public.platform_sales ENABLE ROW LEVEL SECURITY;
    DO $$ BEGIN
        CREATE POLICY "Enable all access for all users" ON public.platform_sales FOR ALL USING (true);
    EXCEPTION
        WHEN duplicate_object THEN null;
    END $$;

    ALTER TABLE public.platform_reviews ENABLE ROW LEVEL SECURITY;
    DO $$ BEGIN
        CREATE POLICY "Enable all access for all users" ON public.platform_reviews FOR ALL USING (true);
    EXCEPTION
        WHEN duplicate_object THEN null;
    END $$;
  `;
  const { error } = await supabase.rpc('exec_sql', { sql });
  if (error) console.error('exec_sql error:', error.message);
  else console.log('Tables platform_sales and platform_reviews created successfully!');
}
run();
