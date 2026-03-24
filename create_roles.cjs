const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({path: './.env.local'});
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const sql = `
  CREATE TABLE IF NOT EXISTS public.role_permissions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    role text NOT NULL UNIQUE,
    allowed_paths text[] NOT NULL DEFAULT '{}',
    updated_at timestamptz DEFAULT now()
  );
  ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Allow all for authenticated" ON public.role_permissions;
  CREATE POLICY "Allow all for authenticated" ON public.role_permissions
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
  `;
  const { error } = await supabase.rpc('exec_sql', { sql: sql });
  if (error) {
    console.error('exec_sql error:', error.message);
  } else {
    console.log('Role permissions table created/verified successfully!');
  }
}
run();
