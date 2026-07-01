require('dotenv').config({path: '.env.local'});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
    const { data, error } = await supabase.from('brands').select('id, name, logo_url');
    if (error) console.error(error);
    else console.log(JSON.stringify(data, null, 2));
}
run();
