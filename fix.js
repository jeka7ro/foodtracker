import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
(async () => {
    const { data: rests } = await supabase.from('restaurants').select('*');
    for (const r of rests) {
        if (!r.iiko_restaurant_id && r.iiko_config && r.iiko_config.organizationId) {
            await supabase.from('restaurants').update({ iiko_restaurant_id: r.iiko_config.organizationId }).eq('id', r.id);
            console.log('Updated ' + r.name);
        } else if (!r.iiko_restaurant_id && r.iiko_config && r.iiko_config.organization_id) {
            await supabase.from('restaurants').update({ iiko_restaurant_id: r.iiko_config.organization_id }).eq('id', r.id);
            console.log('Updated ' + r.name);
        }
    }
    console.log('DONE mapping existing org ids!');
})();
