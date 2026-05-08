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
        body: JSON.stringify({ organizationIds: ['adddb5a0-26e5-4d50-b472-1c74726c3f72'], deliveryDateFrom: fmt(from), deliveryDateTo: fmt(now), statuses:['Closed'] })
    })
    const data2 = await res.json()
    const orders = (data2.ordersByOrganizations||[]).flatMap(o => o.orders||[])

    console.log(`Fetched ${orders.length} orders for Brasov (WLS+SM).`)
    
    let wlsCount = 0;
    let smCount = 0;
    
    for (const o of orders) {
        if (!o.order || !o.order.items) continue;
        const itemNames = o.order.items.map(it => (it.product?.name || '').toLowerCase()).join(' ')
        
        // "We Love Sushi" virtual brand items
        if (itemNames.includes('we love') || itemNames.includes('wls')) {
            wlsCount++
        } else {
            smCount++
        }
    }
    
    console.log(`WLS orders: ${wlsCount}`)
    console.log(`SM orders: ${smCount}`)
}

fetchOrders().catch(console.error)
