import { createClient } from '@supabase/supabase-js'
const supabase = createClient(
    'https://arzxvzjyiwmkxgoagjcq.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyenh2emp5aXdta3hnb2FnamNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNTU3NjMsImV4cCI6MjA4ODczMTc2M30.bGsx8wA1EDSXuuQs0keCDOx4L4PPY9Ar3LhVJer7DGM'
)

// Check what sourceKeys (platforms) SM Constanta orders have
const { data } = await supabase.from('platform_sales')
    .select('platform, placed_at')
    .eq('restaurant_id', '1bcc73d8-3f03-4b33-9f8f-4e1413525f70')
    .gte('placed_at', new Date(2026, 4, 1).toISOString())
    .limit(200)

const byPlatform = {}
for (const r of data || []) byPlatform[r.platform] = (byPlatform[r.platform] || 0) + 1
console.log('SM Constanta platforms in May:', byPlatform)

// Also check total orders for that orgId from iiko directly
const token_res = await fetch('https://api-eu.syrve.live/api/1/access_token', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ apiLogin: '56597d13165c49c49c10e351b5eac617' })
})
const { token } = await token_res.json()

const now = new Date()
const from = new Date(2026, 4, 1)
from.setHours(0,0,0,0)
const fmt = d => d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')+' 00:00:00.000'

const res = await fetch('https://api-eu.syrve.live/api/1/deliveries/by_delivery_date_and_status', {
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},
    body: JSON.stringify({ organizationIds: ['8ed15b53-e788-411b-8a06-96d0f9ee005a'], deliveryDateFrom: fmt(from), deliveryDateTo: fmt(now), statuses:['Closed'] })
})
const data2 = await res.json()
const orders = (data2.ordersByOrganizations||[]).flatMap(o => o.orders||[])
console.log(`\nTotal orders for orgId 8ed15b53 in May from iiko: ${orders.length}`)

const bySource = {}
for (const o of orders) {
    const src = (o.order?.sourceKey || 'IN-STORE').trim() || 'IN-STORE'
    bySource[src] = (bySource[src] || 0) + 1
}
console.log('By sourceKey:', bySource)
