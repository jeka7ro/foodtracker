import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({path: './.env.local'});
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_KEY);

async function check() {
    const { data: oldData } = await supabase.from('platform_reviews').select('*');
    console.log(`Platform reviews count: ${oldData?.length || 0}`);
    const { data: newData } = await supabase.from('reputation_reviews').select('*');
    console.log(`Reputation reviews count: ${newData?.length || 0}`);
    
    if (oldData?.length > 0 && (!newData || newData.length === 0)) {
        console.log("Migrating data from platform_reviews to reputation_reviews...");
        const inserts = oldData.map(r => ({
            external_review_id: r.order_id || r.id,
            platform: r.platform || 'glovo',
            brand_id: 'imported', // dummy or r.brand_id if exists
            author_name: r.customer_name || 'Client',
            text: r.comment || '',
            rating: r.rating || 5,
            sentiment: r.sentiment || 'neutral',
            published_at: r.reviewed_at || new Date().toISOString(),
            replied: false
        }));
        const { error } = await supabase.from('reputation_reviews').insert(inserts);
        if (error) console.error("Migration error:", error);
        else console.log("Migration complete!");
    }
}
check();
