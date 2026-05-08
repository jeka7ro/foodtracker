import { createClient } from '@supabase/supabase-js'

const check = async () => {
    const token_res = await fetch('https://api-eu.syrve.live/api/1/access_token', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ apiLogin: '56597d13165c49c49c10e351b5eac617' })
    })
    const { token } = await token_res.json()

    // Get all organizations from Iiko
    const orgRes = await fetch('https://api-eu.syrve.live/api/1/organizations', {
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},
        body: JSON.stringify({ returnAdditionalInfo: false, includeDisabled: false })
    })
    const orgData = await orgRes.json()
    const allOrgIds = orgData.organizations.map(o => o.id)
    
    console.log(`Checking ${allOrgIds.length} organizations for Smash Me items...`)

    let totalSmashSales = 0
    
    for (const orgId of allOrgIds) {
        const res = await fetch('https://api-eu.syrve.live/api/1/deliveries/by_delivery_date_and_status', {
            method:'POST',
            headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},
            body: JSON.stringify({ organizationIds: [orgId], deliveryDateFrom: '2026-05-01 00:00:00.000', deliveryDateTo: '2026-05-04 00:00:00.000', statuses:['Closed'] })
        })
        const data = await res.json()
        
        if (data.error) {
            console.log(`Org ${orgId} err: ${data.error}`)
            continue
        }
        
        let smashOrders = 0
        let smashSum = 0
        for (const orgGroup of (data.ordersByOrganizations||[])) {
            for (const o of orgGroup.orders||[]) {
                if (!o.order || !o.order.items) continue
                let isSmashOrder = false
                let orderSum = 0
                for (const it of o.order.items) {
                    if (it.type !== 'Product' || !it.product) continue
                    const n = it.product.name.toLowerCase()
                    if (n.includes('burger') || n.includes('smash') || n.includes('cartof')) {
                        isSmashOrder = true
                        orderSum += it.resultSum || (it.price * (it.amount || 1))
                    }
                }
                if (isSmashOrder) {
                    smashOrders++
                    smashSum += orderSum
                }
            }
        }
        
        if (smashOrders > 0) {
            const orgInfo = orgData.organizations.find(o => o.id === orgId)
            console.log(`Org: ${orgInfo?.name || orgId} sold ${smashOrders} Smash Me orders (Sum: ${smashSum})`)
            totalSmashSales += smashSum
        }
    }
    console.log(`Total Smash Me sales across ALL of Romania: ${totalSmashSales}`)
}
check().catch(console.error)
