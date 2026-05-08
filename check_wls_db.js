import { createClient } from '@supabase/supabase-js'

const checkDB = async () => {
    const supabase = createClient(
        'https://arzxvzjyiwmkxgoagjcq.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyenh2emp5aXdta3hnb2FnamNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNTU3NjMsImV4cCI6MjA4ODczMTc2M30.bGsx8wA1EDSXuuQs0keCDOx4L4PPY9Ar3LhVJer7DGM'
    )
    
    // We Love Sushi Brasov ID
    const { data: rests } = await supabase.from('restaurants').select('id').eq('name', 'We Love Sushi Brasov')
    const rid = rests[0]?.id
    
    const { data: orders } = await supabase.from('platform_sales').select('items').eq('restaurant_id', rid).gte('placed_at', '2026-05-01')
    
    console.log(`We Love Sushi Brasov has ${orders.length} orders in DB.`)
    
    const itemsCount = {}
    for (const o of orders) {
        if (!o.items) continue
        for (const it of o.items) {
            itemsCount[it.product_name] = (itemsCount[it.product_name] || 0) + 1
        }
    }
    
    const sorted = Object.entries(itemsCount).sort((a,b) => b[1]-a[1])
    for (const [name, c] of sorted.slice(0, 10)) {
        console.log(`- ${c}x ${name}`)
    }
}
checkDB().catch(console.error)
