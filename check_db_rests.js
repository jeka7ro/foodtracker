import { createClient } from '@supabase/supabase-js'

const check = async () => {
    const supabase = createClient(
        'https://arzxvzjyiwmkxgoagjcq.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyenh2emp5aXdta3hnb2FnamNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNTU3NjMsImV4cCI6MjA4ODczMTc2M30.bGsx8wA1EDSXuuQs0keCDOx4L4PPY9Ar3LhVJer7DGM'
    )
    
    const { data: rests } = await supabase.from('restaurants').select('id, name, is_active, iiko_restaurant_id').order('name')
    
    console.log("ALL RESTAURANTS IN DB:")
    for (const r of rests) {
        console.log(`- ${r.name} (Active: ${r.is_active}) [iiko_id: ${r.iiko_restaurant_id}]`)
    }
}
check().catch(console.error)
