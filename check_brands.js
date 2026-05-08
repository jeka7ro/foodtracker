import { createClient } from '@supabase/supabase-js'

const check = async () => {
    const supabase = createClient(
        'https://arzxvzjyiwmkxgoagjcq.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyenh2emp5aXdta3hnb2FnamNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNTU3NjMsImV4cCI6MjA4ODczMTc2M30.bGsx8wA1EDSXuuQs0keCDOx4L4PPY9Ar3LhVJer7DGM'
    )
    
    const { data: brands } = await supabase.from('brands').select('id, name')
    const { data: rests } = await supabase.from('restaurants').select('id, name, brand_id').eq('is_active', true)
    
    for (const b of brands) {
        console.log(`\nBRAND: ${b.name} (${b.id})`)
        const rs = rests.filter(r => r.brand_id === b.id)
        for (const r of rs) {
            console.log(` - ${r.name}`)
        }
    }
}
check().catch(console.error)
