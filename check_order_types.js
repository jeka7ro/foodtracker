import fetch from 'node-fetch'

const check = async () => {
    // Auth
    const r = await fetch('https://api-eu.syrve.live/api/1/access_token', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiLogin: 'a1fe30cdeb934aa0af01b6a35244b7f0' })
    })
    const token = (await r.json()).token
    
    // Fetch recent orders for an org
    const orgId = '04062575-5a47-426b-9d35-9dc748f24139' // Sushi Master Bucharest (also We Love Sushi)
    const reqBody = {
        organizationIds: [orgId],
        deliveryDateFrom: "2026-05-04 00:00:00.000",
        deliveryDateTo: "2026-05-04 23:59:59.000",
        statuses: ["Closed"]
    }
    
    const res = await fetch(`https://api-eu.syrve.live/api/1/deliveries/by_delivery_date_and_status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(reqBody)
    });
    
    const data = await res.json()
    const orders = (data.ordersByOrganizations || [])[0]?.orders || []
    
    const orderTypes = new Set()
    const byType = {}
    
    for (const o of orders) {
        if (!o.order) continue
        const t = o.order.orderType?.name || 'UNKNOWN'
        orderTypes.add(t)
        
        byType[t] = byType[t] || []
        if (byType[t].length < 3) {
            byType[t].push(o.order.items.filter(it => it.type === 'Product').map(it => it.product.name))
        }
    }
    
    console.log("Order Types Found:")
    for (const t of orderTypes) {
        console.log(`\nTYPE: ${t}`)
        console.log(`Examples:`)
        for (const ex of byType[t]) {
            console.log(` - ${ex.join(', ')}`)
        }
    }
}
check().catch(console.error)
