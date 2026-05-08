import fetch from 'node-fetch'

const check = async () => {
    // Auth
    const r = await fetch('https://api-eu.syrve.live/api/1/access_token', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiLogin: 'a1fe30cdeb934aa0af01b6a35244b7f0' })
    })
    const token = (await r.json()).token
    
    // Fetch recent orders for all SM orgs
    const orgs = [
        '04062575-5a47-426b-9d35-9dc748f24139', // BUC
        '5defeb54-0db7-4abe-b1e4-fb3e0bb0acb3', // Craiova
        'd4c37445-8246-4b92-ad6a-e27992414654'  // Cluj
    ]
    
    const orderTypes = new Set()
    
    for (const orgId of orgs) {
        const reqBody = {
            organizationIds: [orgId],
            deliveryDateFrom: "2026-05-01 00:00:00.000",
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
        
        for (const o of orders) {
            if (!o.order) continue
            const t = o.order.orderType?.name || 'UNKNOWN'
            orderTypes.add(t)
        }
    }
    
    console.log("ALL ORDER TYPES:")
    for (const t of orderTypes) {
        console.log(`TYPE: "${t}"`)
    }
}
check().catch(console.error)
