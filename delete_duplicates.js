import { createClient } from '@supabase/supabase-js'

const fix = async () => {
    const supabase = createClient(
        'https://arzxvzjyiwmkxgoagjcq.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyenh2emp5aXdta3hnb2FnamNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNTU3NjMsImV4cCI6MjA4ODczMTc2M30.bGsx8wA1EDSXuuQs0keCDOx4L4PPY9Ar3LhVJer7DGM'
    )
    
    console.log("Fetching old unfiltered records from May...")
    // Fetch all records from May 1st onwards that do NOT have '_' in order_id
    const { data: sales, error } = await supabase.from('platform_sales')
        .select('id, order_id, placed_at')
        .gte('placed_at', '2026-04-28T00:00:00.000Z')
        .not('order_id', 'like', '%_%')
        
    if (error) {
        console.error(error)
        return
    }
    
    console.log(`Found ${sales.length} old unfiltered records to delete.`)
    
    if (sales.length > 0) {
        // Delete in batches of 1000
        const ids = sales.map(s => s.id)
        for (let i = 0; i < ids.length; i += 1000) {
            const batch = ids.slice(i, i + 1000)
            await supabase.from('platform_sales').delete().in('id', batch)
            console.log(`Deleted batch ${i} to ${i + 1000}`)
        }
    }
    console.log("DONE.")
}
fix().catch(console.error)
