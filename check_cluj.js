import { createClient } from '@supabase/supabase-js'

const check = async () => {
    const supabase = createClient(
        'https://arzxvzjyiwmkxgoagjcq.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyenh2emp5aXdta3hnb2FnamNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNTU3NjMsImV4cCI6MjA4ODczMTc2M30.bGsx8wA1EDSXuuQs0keCDOx4L4PPY9Ar3LhVJer7DGM'
    )
    
    const { data: rests } = await supabase.from('restaurants').select('id, name, iiko_restaurant_id, iiko_config')
    
    for (const r of rests) {
        if (r.name.includes('Cluj') || r.name.includes('Smash')) {
            console.log(`[${r.name}] orgId: ${r.iiko_restaurant_id} | config: ${JSON.stringify(r.iiko_config)}`)
        }
    }
}
check().catch(console.error)
