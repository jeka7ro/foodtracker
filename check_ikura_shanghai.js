import { createClient } from '@supabase/supabase-js'

const check = async () => {
    const supabase = createClient(
        'https://arzxvzjyiwmkxgoagjcq.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyenh2emp5aXdta3hnb2FnamNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNTU3NjMsImV4cCI6MjA4ODczMTc2M30.bGsx8wA1EDSXuuQs0keCDOx4L4PPY9Ar3LhVJer7DGM'
    )
    
    // Get Ikura brand
    const { data: brands } = await supabase.from('brands').select('id, name')
    const ikuraBrand = brands.find(b => b.name === 'Ikura Sushi')
    
    // Get Ikura restaurants
    const { data: rests } = await supabase.from('restaurants').select('id, name, brand_id')
    const ikuraRests = rests.filter(r => r.brand_id === ikuraBrand.id)
    const ikuraRestIds = ikuraRests.map(r => r.id)
    
    // Check sales for Ikura
    const { data: sales } = await supabase.from('platform_sales')
        .select('id, order_id, restaurant_name, items')
        .in('restaurant_id', ikuraRestIds)
        .gte('placed_at', '2026-05-01T00:00:00.000Z')
        .order('placed_at', { ascending: false })
        
    console.log(`Ikura Sales total rows in May: ${sales.length}`)
    for (const s of sales) {
        if (!s.items) continue
        for (const it of s.items) {
            const name = it.product_name || ''
            if (name.includes('Shanghai')) {
                console.log(`FOUND SHANGHAI! order_id: ${s.order_id}, rest: ${s.restaurant_name}`)
            }
        }
    }
}
check().catch(console.error)
