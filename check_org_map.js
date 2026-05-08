import { createClient } from '@supabase/supabase-js'
const supabase = createClient(
    'https://arzxvzjyiwmkxgoagjcq.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyenh2emp5aXdta3hnb2FnamNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNTU3NjMsImV4cCI6MjA4ODczMTc2M30.bGsx8wA1EDSXuuQs0keCDOx4L4PPY9Ar3LhVJer7DGM'
)

// List all restaurants with their orgIds to see which ones are missing
const check = async () => {
    const { data: rests } = await supabase.from('restaurants').select('id, name, iiko_restaurant_id').eq('is_active', true)
    
    const byCity = {}
    for (const r of rests) {
        const words = r.name.split(' ')
        const city = words[words.length-1]
        byCity[city] = byCity[city] || []
        byCity[city].push(r)
    }
    
    for (const [city, list] of Object.entries(byCity)) {
        console.log(`\n--- ${city} ---`)
        for (const r of list) {
            console.log(`${r.iiko_restaurant_id ? '✅' : '❌'} ${r.name} (${r.iiko_restaurant_id})`)
        }
    }
}
check().catch(console.error)
