import { createClient } from '@supabase/supabase-js'

const check = async () => {
    const supabase = createClient(
        'https://arzxvzjyiwmkxgoagjcq.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyenh2emp5aXdta3hnb2FnamNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNTU3NjMsImV4cCI6MjA4ODczMTc2M30.bGsx8wA1EDSXuuQs0keCDOx4L4PPY9Ar3LhVJer7DGM'
    )
    
    // Find any sale in May that has "Shanghai" in items
    const { data: sales, error } = await supabase.from('platform_sales')
        .select('id, order_id, restaurant_id, items, placed_at')
        .gte('placed_at', '2026-05-01T00:00:00.000Z')
        
    if (error) { console.error(error); return; }
    
    const shanghais = sales.filter(s => {
        if (!s.items) return false
        return s.items.some(it => it.product_name && it.product_name.includes('Shanghai'))
    })
    
    console.log(`Found ${shanghais.length} sales with Shanghai.`)
    for (const s of shanghais.slice(0, 5)) {
        console.log(`ID: ${s.id} | rest_id: ${s.restaurant_id} | order: ${s.order_id}`)
    }
}
check().catch(console.error)
