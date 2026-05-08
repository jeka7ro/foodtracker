import { createClient } from '@supabase/supabase-js'

const check = async () => {
    const supabase = createClient(
        'https://arzxvzjyiwmkxgoagjcq.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyenh2emp5aXdta3hnb2FnamNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNTU3NjMsImV4cCI6MjA4ODczMTc2M30.bGsx8wA1EDSXuuQs0keCDOx4L4PPY9Ar3LhVJer7DGM'
    )
    
    // Get Ikura brand
    const { data: brands } = await supabase.from('brands').select('id, name')
    
    const virtualBrands = brands.filter(b => b.name !== 'Sushi Master')
    
    // Get Ikura restaurants
    const { data: rests } = await supabase.from('restaurants').select('id, name, brand_id')
    
    for (const b of virtualBrands) {
        const myRests = rests.filter(r => r.brand_id === b.id).map(r => r.id)
        const { data: sales } = await supabase.from('platform_sales')
            .select('items')
            .in('restaurant_id', myRests)
            .gte('placed_at', '2026-05-01T00:00:00.000Z')
            
        const prodMap = {}
        for (const s of sales || []) {
            if (!s.items) continue
            for (const it of s.items) {
                const name = it.product_name || ''
                prodMap[name] = (prodMap[name] || 0) + (it.quantity || 1)
            }
        }
        
        const top = Object.entries(prodMap).sort((a,b) => b[1] - a[1]).slice(0, 5)
        console.log(`\n=== ${b.name} Top 5 ===`)
        for (const [name, qty] of top) {
            console.log(`${qty}x | ${name}`)
        }
    }
}
check().catch(console.error)
