import { createClient } from '@supabase/supabase-js'
const supabase = createClient(
    'https://arzxvzjyiwmkxgoagjcq.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyenh2emp5aXdta3hnb2FnamNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNTU3NjMsImV4cCI6MjA4ODczMTc2M30.bGsx8wA1EDSXuuQs0keCDOx4L4PPY9Ar3LhVJer7DGM'
)

// What restaurant_ids exist in platform_sales this month?
const from = new Date(2026, 4, 1).toISOString() // May 1
const { data: rows } = await supabase.from('platform_sales')
    .select('restaurant_id, placed_at')
    .gte('placed_at', from)
    .limit(500)
    .order('placed_at', { ascending: false })

// Count by restaurant_id
const counts = {}
for (const r of rows || []) counts[r.restaurant_id] = (counts[r.restaurant_id] || 0) + 1

const { data: rests } = await supabase.from('restaurants').select('id,name,brand_id')
const brandMap = {
    '4fa847aa-c889-4254-b30c-84c0f51a70e1': 'Sushi Master',
    'c687a629-010e-432d-a06b-0dabe916f73f': 'Smash Me',
    '14a75ee3-63a1-46e9-aa4a-9748a0c635d2': 'We Love Sushi',
    'adbd1adf-38b0-4740-8727-a61d6a48a4b6': 'Ikura Sushi'
}

console.log('\n=== Comenzi Mai 2026 per restaurant ===')
for (const [rid, cnt] of Object.entries(counts).sort((a,b) => b[1]-a[1])) {
    const rest = rests.find(r => r.id === rid)
    const brand = brandMap[rest?.brand_id] || 'UNKNOWN'
    console.log(`[${brand}] ${rest?.name || rid}: ${cnt} comenzi`)
}

// Also check the Smash Me Constanta restaurant ID specifically
const smashConst = rests.find(r => r.name === 'Smash Me Constanta')
console.log('\nSmash Me Constanta ID in restaurants table:', smashConst?.id)

// Check if any orders exist for the Smash Me Constanta iiko orgId
// The orgId was 8ed15b53 which is shared with Sushi Master Constanta
const smasterConst = rests.find(r => r.name === 'Sushi Master Constanta')
console.log('Sushi Master Constanta ID:', smasterConst?.id)
console.log('Orders for SM Constanta this month:', counts[smasterConst?.id] || 0)
console.log('Orders for Smash Me Constanta this month:', counts[smashConst?.id] || 0)
