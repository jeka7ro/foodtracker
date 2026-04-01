const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({path: './.env.local'});
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_KEY);

async function check() {
    const { data: locs, error } = await supabase.from('reputation_locations').select('*');
    console.log("LOCATIONS:", locs?.length, error);
}
check();
