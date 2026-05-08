import { createClient } from '@supabase/supabase-js'

const check = async () => {
    const token_res = await fetch('https://api-eu.syrve.live/api/1/access_token', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ apiLogin: '56597d13165c49c49c10e351b5eac617' })
    })
    const { token } = await token_res.json()

    const res = await fetch('https://api-eu.syrve.live/api/1/deliveries/by_delivery_date_and_status', {
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},
        body: JSON.stringify({ organizationIds: ['8ed15b53-e788-411b-8a06-96d0f9ee005a'], deliveryDateFrom: '2026-05-01 00:00:00.000', deliveryDateTo: '2026-05-02 00:00:00.000', statuses:['Closed'] })
    })
    const data = await res.json()
    const orders = (data.ordersByOrganizations||[]).flatMap(o => o.orders||[])
    
    for (const o of orders) {
        if (!o.order || !o.order.items) continue
        const hasBurger = o.order.items.some(it => (it.product?.name||'').toLowerCase().includes('burger'))
        if (hasBurger) {
            console.log(`Order Sum: ${o.order.sum}`)
            let manualSum = 0
            for (const it of o.order.items) {
                if (it.type !== 'Product' || !it.product) continue
                const name = it.product.name.toLowerCase()
                if (!name.includes('burger') && !name.includes('delivery') && !name.includes('cola')) continue
                
                console.log(`  - ${it.amount}x ${it.product.name} | resultSum=${it.resultSum} | price=${it.price}`)
                manualSum += it.resultSum || (it.price * (it.amount || 1))
            }
            console.log(`  Manual Sum (Smash): ${manualSum}`)
            console.log("---")
            break
        }
    }
}
check().catch(console.error)
