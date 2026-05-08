// Iiko-only sync — fara Puppeteer, fara Wolt/Glovo scrapers
// Trage comenzile din ultimele 7 zile direct din API iiko/syrve
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    'https://arzxvzjyiwmkxgoagjcq.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyenh2emp5aXdta3hnb2FnamNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNTU3NjMsImV4cCI6MjA4ODczMTc2M30.bGsx8wA1EDSXuuQs0keCDOx4L4PPY9Ar3LhVJer7DGM'
)

const DAYS_BACK = 30
const API_KEYS = ['a1fe30cdeb934aa0af01b6a35244b7f0', '124d0880f4b44717b69ee21d45fc2656', '56597d13165c49c49c10e351b5eac617']

const fmt = (d) => d.getFullYear() + '-' +
    String(d.getMonth()+1).padStart(2,'0') + '-' +
    String(d.getDate()).padStart(2,'0') + ' ' +
    String(d.getHours()).padStart(2,'0') + ':' +
    String(d.getMinutes()).padStart(2,'0') + ':' +
    String(d.getSeconds()).padStart(2,'0') + '.000'

async function getToken(apiKey) {
    const r = await fetch('https://api-eu.syrve.live/api/1/access_token', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiLogin: apiKey })
    })
    if (!r.ok) return null
    return (await r.json()).token
}

async function run() {
    console.log(`\n[IIKO SYNC] Pornesc sync ultimele ${DAYS_BACK} zile...`)
    
    // Get all restaurants
    const { data: restaurants } = await supabase.from('restaurants')
        .select('id,name,iiko_restaurant_id,iiko_config,brands(name)').eq('is_active', true)
    
    console.log(`[IIKO SYNC] ${restaurants.length} restaurante active`)
    
    // Get tokens
    const tokens = {}
    for (const k of API_KEYS) {
        tokens[k] = await getToken(k)
        console.log(`[IIKO SYNC] Token pentru ${k.slice(0,8)}...: ${tokens[k] ? 'OK' : 'FAIL'}`)
    }
    
    let totalUpserted = 0
    
    for (const r of restaurants) {
        // Fallback for virtual brands that don't have an orgId set in DB
        const ORG_FALLBACK = {
            'Smash Me Cluj-Napoca': '9c63cff6-1d66-442d-a98d-2302656e3943',
            'Smash Me Constanta': '8308e796-8780-4d18-ae66-4e430178c778',
            'Ikura Sushi Cluj-Napoca': '90296b11-9ba9-4279-a69b-1f84e193315e',
            'Sushi Master Cluj-Napoca': '90296b11-9ba9-4279-a69b-1f84e193315e',
            'We Love Sushi Bucharest': '04062575-5a47-426b-9d35-9dc748f24139',
            'Sushi Master Bucharest': '04062575-5a47-426b-9d35-9dc748f24139',
            'Ikura Sushi Bucharest - Halelor': '04062575-5a47-426b-9d35-9dc748f24139',
            'We Love Sushi Brasov': 'adddb5a0-26e5-4d50-b472-1c74726c3f72'
        }
        
        // Ensure the db row also has the correct iiko_restaurant_id
        if (r.name === 'Smash Me Cluj-Napoca' && r.iiko_restaurant_id !== ORG_FALLBACK['Smash Me Cluj-Napoca']) {
            r.iiko_restaurant_id = ORG_FALLBACK['Smash Me Cluj-Napoca'];
        }
        if (r.name === 'Smash Me Constanta' && r.iiko_restaurant_id !== ORG_FALLBACK['Smash Me Constanta']) {
            r.iiko_restaurant_id = ORG_FALLBACK['Smash Me Constanta'];
        }
        
        const orgId = r.iiko_restaurant_id || r.iiko_config?.organization_id || ORG_FALLBACK[r.name]
        if (!orgId) { console.log(`[SKIP] ${r.name} - no orgId`); continue }
        
        // Pick API key: explicit in DB > orgId map > brand name heuristic
        const ORG_KEY_MAP = {
            '8ed15b53-e788-411b-8a06-96d0f9ee005a': '56597d13165c49c49c10e351b5eac617', // SM Constanta
            'adddb5a0-26e5-4d50-b472-1c74726c3f72': '56597d13165c49c49c10e351b5eac617', // SM Brasov + WLS Brasov
            '90296b11-9ba9-4279-a69b-1f84e193315e': '56597d13165c49c49c10e351b5eac617', // Cluj locations (Sushi/Ikura)
            '04062575-5a47-426b-9d35-9dc748f24139': '56597d13165c49c49c10e351b5eac617', // Bucharest locations
            '9c63cff6-1d66-442d-a98d-2302656e3943': '124d0880f4b44717b69ee21d45fc2656', // Smash Me Cluj
            '8308e796-8780-4d18-ae66-4e430178c778': '124d0880f4b44717b69ee21d45fc2656'  // Smash Me Constanta
        }
        let apiKey = r.iiko_config?.api_login
            || ORG_KEY_MAP[orgId]
            || (r.brands?.name?.toLowerCase().includes('smash') ? API_KEYS[1] : API_KEYS[0])
        
        let token = tokens[apiKey]
        if (!token) { console.log(`[SKIP] ${r.name} - no token`); continue }
        
        // Sync day by day
        for (let d = DAYS_BACK - 1; d >= 0; d--) {
            const toDate = new Date()
            toDate.setDate(toDate.getDate() - d)
            toDate.setHours(23, 59, 59, 999)
            
            const fromDate = new Date(toDate)
            fromDate.setHours(0, 0, 0, 0)
            
            const dayStr = fromDate.toLocaleDateString('ro-RO', { day:'2-digit', month:'2-digit' })
            process.stdout.write(`  [${r.name}] ${dayStr}... `)
            
            try {
                const res = await fetch('https://api-eu.syrve.live/api/1/deliveries/by_delivery_date_and_status', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ organizationIds: [orgId], deliveryDateFrom: fmt(fromDate), deliveryDateTo: fmt(toDate), statuses: ['Closed'] })
                })
                
                if (!res.ok) {
                    const txt = await res.text().catch(() => '')
                    if (res.status === 403 || txt.includes('ORGANIZATION_DENIED')) {
                        console.log(`SKIP (403)`)
                        break
                    }
                    console.log(`ERR ${res.status}`)
                    continue
                }
                
                const data = await res.json()
                let orders = (data.ordersByOrganizations || []).flatMap(o => o.orders || [])
                
                // Am eliminat filtrul la nivel de comandă.
                // Acum filtrăm la nivel de ITEM în interiorul buclei pentru a gestiona comenzile mixte (ex: Burger + Sushi).
                
                if (orders.length === 0) { console.log(`0 comenzi`); await new Promise(r => setTimeout(r, 300)); continue }
                
                const bName = (r.brands?.name || '').toLowerCase()
                const isSmashRest = bName.includes('smash')
                const isWlsRest = bName.includes('we love')
                const isIkuraRest = bName.includes('ikura')
                const isSmRest = !isSmashRest && !isWlsRest && !isIkuraRest                
                const rows = []
                for (const o of orders) {
                    if (!o.order) continue
                    const raw = (o.order.sourceKey || '').trim()
                    let platform = raw || 'in-store'
                    if (raw.toLowerCase().includes('glovo')) platform = 'glovo'
                    else if (raw.toLowerCase().includes('wolt')) platform = 'wolt'
                    else if (raw.toLowerCase().includes('bolt')) platform = 'bolt'
                    
                    let placed_at = null
                    try {
                        const ds = o.order.whenClosed || o.order.whenCreated
                        if (ds) placed_at = new Date(ds.replace(' ','T')).toISOString()
                    } catch(e) {}
                    if (!placed_at) placed_at = new Date().toISOString()
                    
                    let orderSum = 0
                    const items = []
                    if (o.order.items) {
                        for (const it of o.order.items) {
                            if (it.type === 'Product' && it.product) {
                                const pName = (it.product.name || '').toLowerCase()
                                
                                const orderTypeName = (o.order.orderType?.name || '').toLowerCase()
                                const isIkuraOrder = orderTypeName.includes('_i ') || orderTypeName.includes('ikura')
                                const isWlsOrder = orderTypeName.includes('_w ') || orderTypeName.includes('wls') || orderTypeName.includes('we love')

                                // INCLUSION FILTER pentru brandurile virtuale care împart POS-ul cu Sushi Master
                                if (isSmashRest) {
                                    // NO FILTERING for Smash Me because it runs on its own dedicated server and token.
                                }
                                else if (isWlsRest) {
                                    if (!isWlsOrder) {
                                        const hasWlsWords = pName.includes('we love') || pName.includes('wls') || pName.includes('w_') || pName.includes('love ') || pName.includes('delivery') || pName.includes('cola') || pName.includes('apa minerala') || pName.includes('apa plata');
                                        if (!hasWlsWords) continue;
                                    } else {
                                        if (pName.includes('sushimaster') || pName.includes('shanghai') || pName.includes('big in japan')) continue;
                                    }
                                }
                                else if (isIkuraRest) {
                                    if (!isIkuraOrder) {
                                        const hasIkuraWords = pName.includes('ikura') || pName.startsWith('i_') || pName.includes(' i_') || pName.includes('delivery') || pName.includes('cola') || pName.includes('apa minerala') || pName.includes('apa plata');
                                        if (!hasIkuraWords) continue;
                                    } else {
                                        if (pName.includes('sushimaster') || pName.includes('shanghai') || pName.includes('big in japan')) continue;
                                    }
                                }
                                else if (isSmRest) {
                                    if (pName.includes('we love') || pName.includes('wls') || pName.includes('w_') || pName.includes('love ') || pName.includes('ikura') || pName.startsWith('i_') || pName.includes(' i_') || pName.includes('burger') || pName.includes('smash')) {
                                        continue
                                    }
                                }
                                
                                const itemSum = it.resultSum || it.price || 0
                                orderSum += itemSum
                                items.push({
                                    product_name: it.product.name,
                                    quantity: it.amount || 1,
                                    sum: itemSum
                                })
                            }
                        }
                    }
                    
                    // Dacă după filtrare nu mai există niciun produs, ignorăm comanda
                    if (items.length === 0) continue
                    
                    // Pentru comenzile mixte, adăugăm un sufix la order_id pentru a nu fi suprascrise de celelalte branduri pe același orderId de Iiko
                    const baseId = o.order.id || o.id
                    const uniqueOrderId = baseId + '_' + r.id
                    
                    rows.push({
                        order_id: uniqueOrderId,
                        restaurant_id: r.id,
                        platform,
                        total_amount: orderSum,
                        placed_at: placed_at,
                        items
                    })
                }
                
                // Deduplicate rows by order_id
                const uniqueRowsMap = new Map()
                for (const row of rows) {
                    uniqueRowsMap.set(row.order_id, row)
                }
                const uniqueRows = Array.from(uniqueRowsMap.values())
                
                if (uniqueRows.length > 0) {
                    const { error } = await supabase.from('platform_sales').upsert(uniqueRows, { onConflict: 'order_id' })
                    if (error) { console.log(`DB ERR: ${error.message}`); continue }
                    totalUpserted += uniqueRows.length
                    console.log(`${uniqueRows.length} comenzi ✓`)
                } else {
                    console.log(`0 valide`)
                }
                
                await new Promise(r => setTimeout(r, 500))
            } catch(e) {
                console.log(`EXCEPTION: ${e.message}`)
            }
        }
    }
    
    console.log(`\n[IIKO SYNC] GATA. Total upserted: ${totalUpserted} comenzi.`)
    
    // Verify last sale
    const { data: latest } = await supabase.from('platform_sales').select('placed_at').order('placed_at', { ascending: false }).limit(1)
    console.log(`[IIKO SYNC] Ultima comanda in DB: ${latest?.[0]?.placed_at}`)
}

run().catch(console.error)
