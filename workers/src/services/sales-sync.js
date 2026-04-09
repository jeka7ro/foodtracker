import { supabase } from './supabase.js'

export class SalesSync {

    constructor() {
        this.progress = {
            isSyncing: false,
            total: 0,
            current: 0,
            message: '',
            percent: 0
        };
    }

    async syncSales(daysBack = 30) {
        if (this.progress.isSyncing) return { success: false, error: "Already syncing" };

        this.progress.isSyncing = true;
        this.progress.current = 0;
        this.progress.total = 0;
        this.progress.percent = 0;
        this.progress.message = `Inițializare verificare pentru ultimele ${daysBack} zile...`;

        console.log(`[SalesSync] Starting sales sync for last ${daysBack} days...`)
        
        try {
            const { data: restaurants, error: fetchErr } = await supabase
                .from('restaurants')
                .select('*, brands(name)')
                .eq('is_active', true)
            
            if (fetchErr) {
                console.error('[SalesSync] Failed to fetch restaurants:', fetchErr)
                throw new Error(fetchErr.message)
            }

            const formatIikoDate = (d) => {
                return d.getFullYear() + '-' + 
                    String(d.getMonth()+1).padStart(2,'0') + '-' + 
                    String(d.getDate()).padStart(2,'0') + ' ' +
                    String(d.getHours()).padStart(2,'0') + ':' +
                    String(d.getMinutes()).padStart(2,'0') + ':' +
                    String(d.getSeconds()).padStart(2,'0') + '.000'
            }

            let totalUpserted = 0

            // Authenticate keys once
            const tokens = {}
            const apiKeys = ['a1fe30cdeb934aa0af01b6a35244b7f0', '124d0880f4b44717b69ee21d45fc2656']
            for (const k of apiKeys) {
                try {
                    const resAuth = await fetch('https://api-eu.syrve.live/api/1/access_token', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ apiLogin: k })
                    })
                    if (resAuth.ok) tokens[k] = (await resAuth.json()).token
                } catch(e) {}
            }

            // Calculate total iterations
            let validRests = 0;
            for (const r of restaurants) {
                const orgId = r.iiko_restaurant_id || r.iiko_config?.organization_id
                if (orgId) validRests++;
            }
            // we chunk by 1 day at a time
            this.progress.total = validRests * daysBack;

            for (const r of restaurants) {
                const orgId = r.iiko_restaurant_id || r.iiko_config?.organization_id
                if (!orgId) continue
                
                const brandName = (r.brands?.name || '').toLowerCase()
                let apiKey = r.iiko_config?.api_login
                if (!apiKey) {
                    if (brandName.includes('smash')) apiKey = '124d0880f4b44717b69ee21d45fc2656'
                    else apiKey = 'a1fe30cdeb934aa0af01b6a35244b7f0'
                }

                const token = tokens[apiKey]
                if (!token) {
                    this.progress.current += daysBack; // skip silently
                    continue;
                }

                let currentDaysBack = daysBack;
                while (currentDaysBack > 0) {
                    let chunkDays = Math.min(currentDaysBack, 1);
                    
                    const toDate = new Date()
                    toDate.setDate(toDate.getDate() - (daysBack - currentDaysBack))
                    toDate.setHours(23, 59, 59, 999)

                    const fromDate = new Date(toDate)
                    fromDate.setDate(fromDate.getDate() - chunkDays + 1)
                    fromDate.setHours(0, 0, 0, 0)

                    currentDaysBack -= chunkDays;

                    // Update UI 
                    const simpleDate = fromDate.toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' });
                    this.progress.message = `[${r.name}] ⏳ Se trage ziua ${simpleDate} ...`;
                    this.progress.percent = Math.floor((this.progress.current / (this.progress.total || 1)) * 100);

                    const deliveryDateFrom = formatIikoDate(fromDate)
                    const deliveryDateTo = formatIikoDate(toDate)

                    try {
                        const reqBody = {
                            organizationIds: [orgId],
                            deliveryDateFrom,
                            deliveryDateTo,
                            statuses: ["Closed"]
                        }
                        
                        let res;
                        let retries = 3;
                        while(retries > 0) {
                            res = await fetch(`https://api-eu.syrve.live/api/1/deliveries/by_delivery_date_and_status`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                                body: JSON.stringify(reqBody)
                            });
                            if (res.ok) break;
                            const errTxt = await res.text().catch(() => 'no text');
                            console.log(`[Sync] Rate limited or error from iiko (HTTP ${res.status}): ${errTxt} | Retrying in 5s...`);
                            await new Promise(r => setTimeout(r, 6000));
                            retries--;
                        }
                        
                        if (!res || !res.ok) {
                            console.error('[Sync] Abandoning chunk after 3 failed retries.');
                            continue;
                        }
                        
                        // Safety delay between successful requests to prevent future rate limits
                        await new Promise(r => setTimeout(r, 800));

                        const resData = await res.json()
                        const orgOrdersArray = resData.ordersByOrganizations || []

                        for (const orgOrders of orgOrdersArray) {
                            const orders = orgOrders.orders || []
                            if (orders.length === 0) continue

                            const dbRows = []
                            for (const o of orders) {
                                if (!o.order) continue

                                const rawSource = o.order.sourceKey || ''
                                let platform = rawSource.trim()
                                if (!platform) platform = 'IN-STORE'
                                else if (platform.toLowerCase().includes('glovo')) platform = 'glovo'
                                else if (platform.toLowerCase().includes('wolt')) platform = 'wolt'
                                else if (platform.toLowerCase().includes('bolt')) platform = 'bolt'

                                const total_amount = o.order.sum || 0
                                
                                let placed_at = null
                                try {
                                    let ds = o.order.whenClosed || o.order.whenCreated
                                    if (ds) placed_at = new Date(ds.replace(' ', 'T')).toISOString()
                                } catch(e) {}
                                if (!placed_at) placed_at = new Date().toISOString()
                                    
                                let order_id = o.order.id || o.id

                                const items = []
                                if (o.order.items) {
                                    for (const it of o.order.items) {
                                        if (it.type === 'Product' && it.product) {
                                            items.push({
                                                product_name: it.product.name,
                                                price: it.price,
                                                amount: it.amount,
                                                resultSum: it.resultSum,
                                                quantity: it.amount
                                            })
                                        }
                                    }
                                }

                                dbRows.push({
                                    restaurant_id: r.id,
                                    order_id: order_id,
                                    platform: platform,
                                    total_amount: total_amount,
                                    placed_at: placed_at,
                                    items: items
                                })
                            }

                            if (dbRows.length > 0) {
                                const { error: insErr } = await supabase
                                    .from('platform_sales')
                                    .upsert(dbRows, { onConflict: 'order_id' })
                                
                                if (!insErr) {
                                    totalUpserted += dbRows.length
                                }
                            }
                        }
                    } catch (err) {
                        // ignore and proceed to not break the whole chain
                    }

                    this.progress.current += chunkDays;
                    this.progress.percent = Math.floor((this.progress.current / (this.progress.total || 1)) * 100);
                }
            }

            console.log(`[SalesSync] Completed! Total orders synced: ${totalUpserted}`)
            this.progress.message = `Sincronizare finalizată! ${totalUpserted} comenzi procesate istorice.`;
            return { success: true, count: totalUpserted }
        } catch (e) {
            this.progress.message = `Eroare proces: ${e.message}`;
            return { success: false, error: e.message }
        } finally {
            // Keep isSyncing true for 2 more seconds so UI sees 100% completion
            setTimeout(() => {
                this.progress.isSyncing = false;
            }, 3000);
        }
    }
}

export const salesSync = new SalesSync()
