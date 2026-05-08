import { createClient } from '@supabase/supabase-js'

const clean = async () => {
    const supabase = createClient(
        'https://arzxvzjyiwmkxgoagjcq.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyenh2emp5aXdta3hnb2FnamNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNTU3NjMsImV4cCI6MjA4ODczMTc2M30.bGsx8wA1EDSXuuQs0keCDOx4L4PPY9Ar3LhVJer7DGM'
    )
    
    console.log("Fetching all virtual restaurants...")
    const { data: rests } = await supabase.from('restaurants').select('id, name, brand_id')
    const { data: brands } = await supabase.from('brands').select('id, name')
    
    const virtualBrands = brands.filter(b => b.name !== 'Sushi Master').map(b => b.id)
    const virtualRests = rests.filter(r => virtualBrands.includes(r.brand_id)).map(r => r.id)
    
    console.log(`Found ${virtualRests.length} virtual restaurants.`)
    
    // We will delete ALL their sales, because they are polluted with unfiltered Sushi Master products
    let allSales = []
    let hasMore = true
    let page = 0
    const limit = 1000
    
    while (hasMore) {
        const { data: sales, error } = await supabase.from('platform_sales')
            .select('id')
            .in('restaurant_id', virtualRests)
            .range(page * limit, (page + 1) * limit - 1)
            
        if (error) { console.error(error); return; }
        allSales.push(...sales)
        if (sales.length < limit) hasMore = false
        page++
    }
    
    console.log(`Found ${allSales.length} TOTAL sales for virtual brands to wipe out.`)
    
    if (allSales.length > 0) {
        console.log("Deleting all records in small batches...")
        const ids = allSales.map(s => s.id)
        for (let i = 0; i < ids.length; i += 100) {
            const batch = ids.slice(i, i + 100)
            const { error: delErr } = await supabase.from('platform_sales').delete().in('id', batch)
            if (delErr) { console.error("Error deleting batch:", delErr); }
            else { console.log(`Deleted batch ${i} to ${i + 100}`) }
        }
        console.log("Done deleting all virtual brand sales!")
    }
}
clean().catch(console.error)
