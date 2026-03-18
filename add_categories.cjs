const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({path: './.env.local'});
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const sql = `
    ALTER TABLE brands ADD COLUMN IF NOT EXISTS categories text[];
  `;
  const { error } = await supabase.rpc('exec_sql', { sql });
  if (error) {
    console.error('exec_sql error:', error.message);
  } else {
    console.log('Successfully added categories column to brands table');
  }
}
run();
