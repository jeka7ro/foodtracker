import { createClient } from '@supabase/supabase-js'
const supabase = createClient(
    'https://arzxvzjyiwmkxgoagjcq.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyenh2emp5aXdta3hnb2FnamNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNTU3NjMsImV4cCI6MjA4ODczMTc2M30.bGsx8wA1EDSXuuQs0keCDOx4L4PPY9Ar3LhVJer7DGM'
)

const { data: brands } = await supabase.from('brands').select('id,name')
console.log('BRANDS:', brands)

const { data: rests } = await supabase.from('restaurants')
    .select('id,name,brand_id').eq('is_active', true)

for (const r of rests) {
    const brand = brands.find(b => b.id === r.brand_id)
    console.log(`${brand ? '✅' : '❌'} [${brand?.name || 'NO BRAND'}] ${r.name} | brand_id: ${r.brand_id || 'NULL'}`)
}

// also check how many sales Smash Me Constanta has this month
const now = new Date()
const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
const smashRests = rests.filter(r => r.name.toLowerCase().includes('smash')).map(r => r.id)
console.log('\nSmash Me restaurant IDs:', smashRests)

const { count } = await supabase.from('platform_sales')
    .select('*', { count:'exact', head:true })
    .in('restaurant_id', smashRests.length ? smashRests : ['none'])
    .gte('placed_at', from)
console.log('Smash Me orders this month in DB:', count)
