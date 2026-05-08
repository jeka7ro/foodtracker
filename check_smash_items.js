import { createClient } from '@supabase/supabase-js'

const fetchOrders = async () => {
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

    console.log(`Fetched ${orders.length} orders. Analyzing item names...`)
    
    // Group item names
    const itemCounts = {}
    for (const o of orders) {
        if (!o.order || !o.order.items) continue;
        for (const it of o.order.items) {
            const name = it.product?.name || 'Unknown'
            itemCounts[name] = (itemCounts[name] || 0) + 1
        }
    }
    
    const sortedItems = Object.entries(itemCounts).sort((a,b) => b[1]-a[1])
    console.log("Top 20 items:")
    for (const [name, count] of sortedItems.slice(0, 20)) {
         console.log(`- ${count}x ${name}`)
    }
    
    // Check if we can identify Smash Me items
    const smashMeOrders = []
    const sushiMasterOrders = []
    
    for (const o of orders) {
        if (!o.order || !o.order.items) continue;
        const isSmashMe = o.order.items.some(it => {
            const n = (it.product?.name || '').toLowerCase()
            return n.includes('burger') || n.includes('smash') || n.includes('cartofi') || n.includes('sos') && !n.includes('sushi') && !n.includes('roll')
        })
        
        if (isSmashMe) {
            smashMeOrders.push(o)
        } else {
            sushiMasterOrders.push(o)
        }
    }
    
    console.log(`\nHeuristic split (has burger/smash/cartofi):`)
    console.log(`Smash Me orders: ${smashMeOrders.length}`)
    console.log(`Sushi Master orders: ${sushiMasterOrders.length}`)
    
    // Check what the exact names of a few Smash Me items are
    console.log("\nSample Smash Me items:")
    let c = 0;
    for (const o of smashMeOrders) {
        for (const it of o.order.items) {
             console.log(it.product?.name)
             c++;
        }
        if (c > 10) break;
    }
}

fetchOrders().catch(console.error)
