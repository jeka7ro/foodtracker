const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({path: './.env.local'});
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const q1 = `
    create table if not exists reputation_locations (
      id uuid primary key default gen_random_uuid(),
      brand_id text,
      platform text,
      external_id text,
      name text,
      created_at timestamp with time zone default now()
    );
    
    create table if not exists reputation_reviews (
      id uuid primary key default gen_random_uuid(),
      brand_id text,
      location_id uuid references reputation_locations(id) on delete cascade,
      platform text,
      rating integer,
      author_name text,
      author_avatar text,
      text text,
      sentiment text check (sentiment in ('positive', 'neutral', 'negative')),
      published_at timestamp with time zone,
      created_at timestamp with time zone default now()
    );
  `;
  
  const { error } = await supabase.rpc('exec_sql', { sql: q1 });
  if (error) console.error('exec_sql error:', error.message);
  else console.log('Reputation tables created successfully');
}
run();
