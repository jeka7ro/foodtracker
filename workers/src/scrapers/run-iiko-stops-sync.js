import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Fix local path resolving for env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

const IIKO_API_KEY = 'a1fe30cdeb934aa0af01b6a35244b7f0';
const IIKO_BASE = 'https://api-eu.iiko.services/api/1';

async function syncAllIikoStops() {
    console.log(`\n[${new Date().toLocaleTimeString()}] 🚀 INIT SINCRONIZARE BACKGROUND IIKO...`);
    
    // 1. Auth iiko
    const resAuth = await fetch(`${IIKO_BASE}/access_token`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiLogin: IIKO_API_KEY })
    });
    const { token } = await resAuth.json();
    if (!token) {
        console.error("❌ EROARE: Nu m-am putut loga pe iiko.");
        return;
    }

    // 2. Fetch all mapped restaurants from Supabase
    const { data: restaurants, error } = await supabase.from('restaurants').select('*').not('iiko_config', 'is', null);
    if (!restaurants || restaurants.length === 0) {
        console.log("⚠️ Zero restaurante mapate in DB.");
        return;
    }
    const orgIdsInDb = restaurants.map(r => r.iiko_config.organizationId).filter(Boolean);

    // 3. Fetch current stops from iiko for ALL these orgs
    const resStops = await fetch(`${IIKO_BASE}/stop_lists`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ organizationIds: orgIdsInDb })
    });
    const { terminalGroupStopLists } = await resStops.json();

    // 4. Group stops by Organization ID
    const stopsByOrg = {};
    if (terminalGroupStopLists) {
        for (const group of terminalGroupStopLists) {
            if (!stopsByOrg[group.organizationId]) stopsByOrg[group.organizationId] = [];
            if (group.items) stopsByOrg[group.organizationId].push(...group.items);
        }
    }

    // 5. Build global menu map to assign names instead of raw IDs
    let menuMap = new Map();
    if (orgIdsInDb.length > 0) {
        const resMenu = await fetch(`${IIKO_BASE}/nomenclature`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ organizationId: orgIdsInDb[0] }) // Usually the menu is standard
        });
        if (resMenu.status === 200) {
             const mData = await resMenu.json();
             (mData.products || []).forEach(p => menuMap.set(p.id, p.name));
        }
    }

    // 6. Update EACH restaurant in Supabase with its specific stops
    let totalUpdated = 0;
    let globalStoppedCount = 0;
    
    for (const rest of restaurants) {
        const orgId = rest.iiko_config.organizationId;
        const rawItems = stopsByOrg[orgId] || [];
        
        const enhancedStops = rawItems.map(item => ({
             productId: item.productId,
             productName: menuMap.get(item.productId) || 'Produs fără nume',
             balance: item.balance
        }));
        
        globalStoppedCount += enhancedStops.length;

        // Build newly merged JSONB configuration
        const newConfig = {
            ...rest.iiko_config,
            iiko_live_stops: enhancedStops,
            iiko_last_sync_time: new Date().toISOString()
        };

        const { error: updErr } = await supabase.from('restaurants').update({ iiko_config: newConfig }).eq('id', rest.id);
        if (updErr) {
            console.error(`Eroare db la org ${rest.name}:`, updErr.message);
        } else {
            totalUpdated++;
        }
    }

    console.log(`✅ Sincronizare finalizata! Au fost detectate ${globalStoppedCount} produse oprite in total. Baza de date actualizata pentru ${totalUpdated} restaurante.`);
}

// Run forever interval
syncAllIikoStops(); // first execution
setInterval(syncAllIikoStops, 60000); // repeat every 60s
