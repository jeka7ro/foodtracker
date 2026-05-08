import { createClient } from '@supabase/supabase-js'

const check = async () => {
    const token_res = await fetch('https://api-eu.syrve.live/api/1/access_token', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ apiLogin: '56597d13165c49c49c10e351b5eac617' })
    })
    const { token } = await token_res.json()

    const now = new Date()
    const from = new Date(2026, 4, 1)
    from.setHours(0,0,0,0)
    const fmt = d => d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')+' 00:00:00.000'

    // Fetch for Constanta (8ed15b53)
    const res = await fetch('https://api-eu.syrve.live/api/1/deliveries/by_delivery_date_and_status', {
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},
        body: JSON.stringify({ organizationIds: ['8ed15b53-e788-411b-8a06-96d0f9ee005a'], deliveryDateFrom: fmt(from), deliveryDateTo: fmt(now), statuses:['Closed'] })
    })
    const data = await res.json()
    const orders = (data.ordersByOrganizations||[]).flatMap(o => o.orders||[])

    console.log(`Constanta total orders: ${orders.length}`)
    
    // Dump 2 orders that HAVE a burger
    const smashOrders = orders.filter(o => o.order?.items?.some(it => (it.product?.name || '').toLowerCase().includes('burger')))
    // Dump 2 orders that DO NOT have a burger
    const smOrders = orders.filter(o => !o.order?.items?.some(it => (it.product?.name || '').toLowerCase().includes('burger')))
    
    const printKeys = (o) => {
        if (!o || !o.order) return
        console.log({
            id: o.order.id,
            sourceKey: o.order.sourceKey,
            concept: o.order.concept,
            orderType: o.order.orderType,
            deliveryTerminalId: o.order.deliveryTerminalId,
            marketingSource: o.order.marketingSource,
            items: o.order.items.map(it => it.product?.name)
        })
    }
    
    console.log("\n--- SMASH ME ORDERS ---")
    printKeys(smashOrders[0])
    printKeys(smashOrders[1])
    
    console.log("\n--- SUSHI MASTER ORDERS ---")
    printKeys(smOrders[0])
    printKeys(smOrders[1])
}
check().catch(console.error)
