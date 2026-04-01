import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const API_KEY = process.env.IIKO_API_KEY || 'a1fe30cdeb934aa0af01b6a35244b7f0';
const BASE_URL = 'https://api-eu.iiko.services/api/1';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function syncIikoSales() {
    console.log("🔥 Pornire SINCRONIZARE iiko API -> Supabase...");

    // 1. Get Token
    const resAuth = await fetch(`${BASE_URL}/access_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiLogin: API_KEY })
    });
    const authData = await resAuth.json();
    if (authData.errorDescription) {
        throw new Error(`Auth Error: ${authData.errorDescription}`);
    }
    const token = authData.token;
    console.log("✅ Autentificat cu succes pe iiko!");

    // 2. Extragem restaurantele din baza noastra (Supabase) ca sa stim ID-urile
    const { data: restaurants, error: restErr } = await supabase
        .from('restaurants')
        .select('id, name, iiko_config')
        .eq('is_active', true);
        
    if (restErr) throw new Error("Eroare Supabase: " + restErr.message);

    const validRestaurants = restaurants.filter(r => r.iiko_config && r.iiko_config.organizationId);
    console.log(`📡 Avem ${validRestaurants.length} restaurante mapate cu iiko in baza noastra.`);

    if (validRestaurants.length === 0) {
        console.log("❌ Nu ai adaugat 'organizationId' in coloana 'iiko_config' pentru restaurantele din baza!");
        console.log("Vom face noi o mapare de proba, extragand direct de la iiko prima locatie:");
        
        // Luam organizatiile de la iiko
        const orgRes = await fetch(`${BASE_URL}/organizations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ })
        });
        const oData = await orgRes.json();
        const firstId = oData.organizations[0]?.id;
        
        if (!firstId) {
             console.log("Nu am gasit locatii..."); return;
        }
        
        // Salvam ca proba pe ultimul restaurant din Supabase daca exista
        if (restaurants.length > 0) {
             console.log(`🔗 Mapez automat ${restaurants[0].name} cu ID-ul iiko: ${firstId}...`);
             validRestaurants.push({ ...restaurants[0], iiko_config: { organizationId: firstId } });
        }
    }

    // Asteptam date pentru azi
    const azi = new Date().toISOString().split('T')[0]; // ex: 2026-04-01
    
    // 3. Extragem vânzările pt fiecare
    for (const rest of validRestaurants) {
        const orgId = rest.iiko_config.organizationId;
        console.log(`\n📥 Descarcam si trimitem comenzi iiko pentru ${rest.name}...`);
        
        // Preluam deliveries
        const deliveryRes = await fetch(`${BASE_URL}/deliveries/by_delivery_date_and_status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
                organizationIds: [orgId],
                deliveryDateFrom: `${azi} 00:00:00.000`,
                deliveryDateTo: `${azi} 23:59:59.000`
            })
        });
        
        const dData = await deliveryRes.json();
        const orders = dData.orders || [];
        console.log(`📦 Am gasit ${orders.length} comenzi pentru azi din iiko.`);
        
        let inserted = 0;
        for (const o of orders) {
             const sum = o.sum || o.order?.sum || 0;
             const time = o.creationStatus?.time || o.order?.creationStatus?.time || new Date().toISOString();
             const externalId = o.id || o.order?.id;
             let source = 'iiko';
             if (o.orderType?.name?.includes('Glovo')) source = 'glovo';
             else if (o.orderType?.name?.includes('Bolt')) source = 'bolt';
             else if (o.orderType?.name?.includes('Wolt')) source = 'wolt';

             const { error: insErr } = await supabase
                 .from('platform_sales')
                 .upsert({
                     restaurant_id: rest.id,
                     platform: source,
                     order_id: externalId,
                     total_amount: sum,
                     placed_at: time
                 }, { onConflict: 'order_id' }) // daca tabela permite upser pe identificatorul de comanda

             if (!insErr) inserted++;
        }
        console.log(`✅ Am integrat cu succes ${inserted} comenzi in Heatmap-ul tau (Tabelul 'platform_sales')!`);
    }
}

syncIikoSales().catch(err => console.error("Eroare Sincronizare:", err));
