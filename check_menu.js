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
    
    let allItemNames = new Set()
    for (const o of orders) {
        if (!o.order || !o.order.items) continue
        for (const it of o.order.items) {
            if (it.type === 'Product' && it.product) {
                allItemNames.add(it.product.name)
            }
        }
    }
    
    const smashLike = []
    const sushiLike = []
    
    const isSmash = name => {
        const n = name.toLowerCase()
        return n.includes('burger') || n.includes('smash') || n.includes('cartofi') || n.includes('crispy') || n.includes('strips') || n.includes('nuggets')
    }
    
    for (const name of Array.from(allItemNames).sort()) {
        if (isSmash(name)) smashLike.push(name)
        else sushiLike.push(name)
    }
    
    console.log("--- Smash-like items ---")
    console.log(smashLike.join('\n'))
    
    console.log("\n--- Unknown/Sushi items (first 50) ---")
    console.log(sushiLike.slice(0, 50).join('\n'))
    
}
check().catch(console.error)
