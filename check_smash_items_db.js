import { createClient } from '@supabase/supabase-js'

const check = async () => {
    const supabase = createClient(
        'https://arzxvzjyiwmkxgoagjcq.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyenh2emp5aXdta3hnb2FnamNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNTU3NjMsImV4cCI6MjA4ODczMTc2M30.bGsx8wA1EDSXuuQs0keCDOx4L4PPY9Ar3LhVJer7DGM'
    )
    
    // Get Smash Me Constanta and Cluj IDs
    const { data: rests } = await supabase.from('restaurants').select('id, name').filter('name', 'ilike', '%Smash%')
    
    const { data: orders } = await supabase.from('platform_sales')
        .select('id, restaurant_id, total_amount, items, placed_at')
        .in('restaurant_id', rests.map(r => r.id))
        .gte('placed_at', '2026-05-01')
        
    const itemMap = {}
    for (const o of orders) {
        if (!o.items) continue
        for (const it of o.items) {
            itemMap[it.product_name] = (itemMap[it.product_name] || 0) + it.quantity
        }
    }
    
    const sorted = Object.entries(itemMap).sort((a,b) => b[1]-a[1])
    console.log("Smash Me items currently in DB:")
    for (const [name, qty] of sorted.slice(0, 15)) {
        console.log(`- ${qty}x ${name}`)
    }
}
check().catch(console.error)
