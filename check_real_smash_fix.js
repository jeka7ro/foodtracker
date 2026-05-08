import { createClient } from '@supabase/supabase-js'

const check = async () => {
    const tokenRes = await fetch('https://api-eu.syrve.live/api/1/access_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiLogin: '124d0880f4b44717b69ee21d45fc2656' })
    });
    const { token } = await tokenRes.json();

    const orgsRes = await fetch('https://api-eu.syrve.live/api/1/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ returnAdditionalInfo: false, includeDisabled: false })
    });
    const orgs = await orgsRes.json();
    const allOrgIds = orgs.organizations.map(o => o.id);

    const res = await fetch('https://api-eu.syrve.live/api/1/deliveries/by_delivery_date_and_status', {
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},
        body: JSON.stringify({ organizationIds: allOrgIds, deliveryDateFrom: '2026-05-01 00:00:00.000', deliveryDateTo: '2026-05-02 00:00:00.000', statuses:['Closed'] })
    })
    const data = await res.json()
    
    if (data.error) {
        console.error("API ERROR:", data)
        return
    }
    
    let totalSales = 0
    let totalOrders = 0
    
    for (const orgGroup of (data.ordersByOrganizations||[])) {
        for (const o of orgGroup.orders||[]) {
            if (!o.order || !o.order.items) continue
            let orderSum = 0
            for (const it of o.order.items) {
                if (it.type !== 'Product' || !it.product) continue
                orderSum += it.resultSum || (it.price * (it.amount || 1))
            }
            totalSales += orderSum
            totalOrders++
        }
    }
    
    console.log(`REAL Smash Me Server Data (May 1): ${totalOrders} orders, Total: ${totalSales} RON`)
}
check().catch(console.error)
