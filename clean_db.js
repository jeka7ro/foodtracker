import { createClient } from '@supabase/supabase-js'

const clean = async () => {
    const supabase = createClient(
        'https://arzxvzjyiwmkxgoagjcq.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyenh2emp5aXdta3hnb2FnamNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNTU3NjMsImV4cCI6MjA4ODczMTc2M30.bGsx8wA1EDSXuuQs0keCDOx4L4PPY9Ar3LhVJer7DGM'
    )
    
    console.log("Fetching all sales for virtual brands...")
    const { data: rests } = await supabase.from('restaurants').select('id, name, brand_id')
    const { data: brands } = await supabase.from('brands').select('id, name')
    
    const virtualBrands = brands.filter(b => b.name !== 'Sushi Master').map(b => b.id)
    const virtualRests = rests.filter(r => virtualBrands.includes(r.brand_id)).map(r => r.id)
    
    let allSales = []
    let hasMore = true
    let page = 0
    const limit = 1000
    
    while (hasMore) {
        const { data: sales, error } = await supabase.from('platform_sales')
            .select('id, order_id, restaurant_id')
            .in('restaurant_id', virtualRests)
            .range(page * limit, (page + 1) * limit - 1)
            
        if (error) { console.error(error); return; }
        allSales.push(...sales)
        if (sales.length < limit) hasMore = false
        page++
    }
    
    const badSales = allSales.filter(s => (!s.order_id || !s.order_id.includes('_')))
    console.log(`Found ${badSales.length} BAD unfiltered records for virtual brands!`)
    
    if (badSales.length > 0) {
        console.log("Deleting bad records in small batches...")
        const ids = badSales.map(s => s.id)
        for (let i = 0; i < ids.length; i += 100) {
            const batch = ids.slice(i, i + 100)
            const { error: delErr } = await supabase.from('platform_sales').delete().in('id', batch)
            if (delErr) { console.error("Error deleting batch:", delErr); }
            else { console.log(`Deleted batch ${i} to ${i + 100}`) }
        }
        console.log("Done deleting!")
    }
}
clean().catch(console.error)
