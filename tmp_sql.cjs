const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({path: './.env.local'});
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const q1 = `
    create table if not exists delivery_zone_rules (
      id bigint primary key generated always as identity,
      name text,
      is_active boolean default true,
      schedule_times text[],
      schedule_days integer[],
      target_brands text[],
      target_cities text[],
      target_restaurants text[],
      created_at timestamp with time zone default timezone('utc'::text, now())
    );
    alter table delivery_zone_configs add column if not exists custom_schedule_times text[];
    alter table delivery_zone_configs add column if not exists custom_schedule_days integer[];
  `;
  const { error } = await supabase.rpc('exec_sql', { sql: q1 });
  if (error) console.error('exec_sql error:', error.message);
  else console.log('Tables created/altered');

  const { data } = await supabase.from('delivery_zone_rules').select('*');
  if (!data || data.length === 0) {
     await supabase.from('delivery_zone_rules').insert([{
         name: 'Regula Generala',
         is_active: true,
         schedule_times: ['10:00', '18:00'],
         schedule_days: [1,2,3,4,5,6,0],
         target_brands: [], target_cities: [], target_restaurants: []
     }]);
     console.log('Default rule inserted');
  } else {
     console.log('Rules already exist');
  }
}
run();
