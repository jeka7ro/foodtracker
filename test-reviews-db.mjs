import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({path: './.env.local'});
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_KEY);

async function test() {
    const { data: revs, error: e1 } = await supabase.from('platform_reviews').select('*').limit(3);
    console.log("REVIEWS:", revs?.length, e1);

    const { data: hist, error: e2 } = await supabase.from('rating_history').select('*').limit(3);
    console.log("HISTORY:", hist?.length, e2);
    
    // Check old table names just in case
    const { data: revs2, error: e3 } = await supabase.from('reputation_reviews').select('*').limit(3);
    console.log("REPR REVS:", revs2?.length, e3);
}

test();
