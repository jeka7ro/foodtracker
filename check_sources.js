import { createClient } from '@supabase/supabase-js'

const check = async () => {
    const tokenRes = await fetch('https://api-eu.syrve.live/api/1/access_token', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiLogin: '56597d13165c49c49c10e351b5eac617' })
    });
    const { token } = await tokenRes.json();

    const res = await fetch('https://api-eu.syrve.live/api/1/deliveries/by_delivery_date_and_status', {
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},
        body: JSON.stringify({ organizationIds: ['8ed15b53-e788-411b-8a06-96d0f9ee005a'], deliveryDateFrom: '2026-05-01 00:00:00.000', deliveryDateTo: '2026-05-02 00:00:00.000', statuses:['Closed'] })
    })
    const data = await res.json()
    
    const sources = new Set()
    for (const orgGroup of (data.ordersByOrganizations||[])) {
        for (const o of orgGroup.orders||[]) {
            sources.add(o.order.sourceKey)
            if (o.order.orderType) sources.add('Type: ' + o.order.orderType.name)
        }
    }
    
    console.log("Sources in Constanta:", Array.from(sources))
}
check().catch(console.error)
