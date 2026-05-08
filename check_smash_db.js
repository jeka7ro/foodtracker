import { createClient } from '@supabase/supabase-js'

const check = async () => {
    const supabase = createClient(
        'https://arzxvzjyiwmkxgoagjcq.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyenh2emp5aXdta3hnb2FnamNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNTU3NjMsImV4cCI6MjA4ODczMTc2M30.bGsx8wA1EDSXuuQs0keCDOx4L4PPY9Ar3LhVJer7DGM'
    )
    
    const { data: rests } = await supabase.from('restaurants').select('id, name').filter('name', 'ilike', '%Smash%')
    
    const { data: orders, error } = await supabase.from('platform_sales')
        .select('id, restaurant_id, total_amount, items, placed_at')
        .in('restaurant_id', rests.map(r => r.id))
        .gte('placed_at', '2026-05-01')
        
    if (error) console.error(error)
        
    console.log(`Found ${orders?.length} Smash Me orders in DB for May 2026.`)
    
    let sum = 0;
    if (orders) {
        for (const o of orders) {
            sum += parseFloat(o.total_amount) || 0
        }
    }
    console.log(`Total sum in DB: ${sum} RON`)
}
check().catch(console.error)
