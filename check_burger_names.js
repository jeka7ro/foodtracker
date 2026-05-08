import { createClient } from '@supabase/supabase-js'

const check = async () => {
    const supabase = createClient(
        'https://arzxvzjyiwmkxgoagjcq.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyenh2emp5aXdta3hnb2FnamNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNTU3NjMsImV4cCI6MjA4ODczMTc2M30.bGsx8wA1EDSXuuQs0keCDOx4L4PPY9Ar3LhVJer7DGM'
    )
    
    const { data: orders } = await supabase.from('platform_sales').select('items')
    
    const allNames = new Set()
    for (const o of orders) {
        if (!o.items) continue
        for (const it of o.items) {
            allNames.add(it.product_name)
        }
    }
    
    const isSmash = name => {
        const n = name.toLowerCase()
        return n.includes('burger') || n.includes('smash') || n.includes('cartof')
    }
    
    for (const name of Array.from(allNames).sort()) {
        if (isSmash(name)) {
            console.log(name)
        }
    }
}
check().catch(console.error)
