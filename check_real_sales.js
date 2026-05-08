import { createClient } from '@supabase/supabase-js'

const check = async () => {
    // Authenticate with SMASH ME API token to get the exact menu
    let tokenRes = await fetch('https://api-eu.syrve.live/api/1/access_token', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiLogin: '124d0880f4b44717b69ee21d45fc2656' })
    });
    let d_t = await tokenRes.json();
    let smashToken = d_t.token;

    let orgsRes = await fetch('https://api-eu.syrve.live/api/1/organizations', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + smashToken },
        body: JSON.stringify({ returnAdditionalInfo: false, includeDisabled: false })
    });
    let orgs = await orgsRes.json();
    let smashOrgIds = orgs.organizations.map(o => o.id);

    let res = await fetch('https://api-eu.syrve.live/api/1/nomenclature', {
        method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${smashToken}`},
        body: JSON.stringify({ organizationId: smashOrgIds[0] })
    })
    let menuData = await res.json()
    
    // Create a Set of all Smash Me product names (lowercase)
    const smashProductNames = new Set(menuData.products.map(p => p.name.toLowerCase().trim()))
    
    console.log(`Extracted ${smashProductNames.size} products from real Smash Me menu.`)

    // Now query the Sushi Master server where the sales actually are
    tokenRes = await fetch('https://api-eu.syrve.live/api/1/access_token', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiLogin: '56597d13165c49c49c10e351b5eac617' })
    });
    d_t = await tokenRes.json();
    let sushiToken = d_t.token;

    orgsRes = await fetch('https://api-eu.syrve.live/api/1/organizations', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sushiToken },
        body: JSON.stringify({ returnAdditionalInfo: false, includeDisabled: false })
    });
    orgs = await orgsRes.json();
    let sushiOrgIds = orgs.organizations.map(o => o.id);

    res = await fetch('https://api-eu.syrve.live/api/1/deliveries/by_delivery_date_and_status', {
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${sushiToken}`},
        body: JSON.stringify({ organizationIds: sushiOrgIds, deliveryDateFrom: '2026-05-01 00:00:00.000', deliveryDateTo: '2026-05-05 23:59:59.000', statuses:['Closed'] })
    })
    let salesData = await res.json()
    
    let smashSales = 0
    let smashOrders = 0
    
    for (const orgGroup of (salesData.ordersByOrganizations||[])) {
        for (const o of orgGroup.orders||[]) {
            if (!o.order || !o.order.items) continue
            let isSmash = false
            let orderSum = 0
            for (const it of o.order.items) {
                if (it.type !== 'Product' || !it.product) continue
                const name = it.product.name.toLowerCase().trim()
                
                // If it EXACTLY matches a Smash Me menu item, OR it's a burger/smash keyword (fallback)
                if (smashProductNames.has(name) || name.includes('burger') || name.includes('smash') || name.includes('cartof')) {
                    isSmash = true
                    orderSum += it.resultSum || (it.price * (it.amount || 1))
                }
            }
            if (isSmash) {
                smashSales += orderSum
                smashOrders++
            }
        }
    }
    
    console.log(`REAL SMASH ME SALES IN MAY (across all Romania): ${smashOrders} orders, Total: ${smashSales} RON`)
}
check().catch(console.error)
