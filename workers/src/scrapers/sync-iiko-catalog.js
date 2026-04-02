import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Fix local path resolving for env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

const IIKO_API_KEY = 'a1fe30cdeb934aa0af01b6a35244b7f0';
const IIKO_BASE = 'https://api-eu.iiko.services/api/1';

async function syncIikoCatalog() {
    console.log(`\n[${new Date().toLocaleTimeString()}] 🚀 INIT SYNC NOMENCLATOR IIKO -> SUPABASE...`);
    
    try {
        // 1. Auth iiko
        console.log('[1/4] Autentificare in iiko Cloud...');
        const resAuth = await fetch(`${IIKO_BASE}/access_token`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apiLogin: IIKO_API_KEY })
        });
        if (!resAuth.ok) throw new Error('Eroare la autentificarea Iiko');
        const { token } = await resAuth.json();

        // 2. Fetch first org
        console.log('[2/4] Preluare organizatii...');
        const resOrgs = await fetch(`${IIKO_BASE}/organizations`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({})
        });
        const { organizations } = await resOrgs.json();
        if (!organizations || !organizations.length) throw new Error('Nu exista organizatii!');
        
        // 3. Download Nomenclature
        console.log('[3/4] Descarcare meniu global...');
        
        const allProductsMap = new Map();
        
        console.log(`[3/4] Descarcare meniu din ${organizations.length} organizatii pentru a capta toate brandurile...`);
        for(let i=0; i<organizations.length; i++) {
            const org = organizations[i];
            console.log(`  -> Descarcare nomenclature pt ${org.name} (${i+1}/${organizations.length})...`);
            const resMenu = await fetch(`${IIKO_BASE}/nomenclature`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ organizationId: org.id })
            });
            const menuData = await resMenu.json();
            
            const groupsMap = new Map((menuData.groups || []).map(g => [g.id, g.name]));
            
            const items = (menuData.products || [])
                .filter(p => p.type && (p.type.toLowerCase() === 'dish' || p.type.toLowerCase() === 'good'));
                
            for(const p of items) {
                if(!allProductsMap.has(p.id)) {
                    p.resolvedCategory = groupsMap.get(p.parentGroup) || 'Meniu General';
                    allProductsMap.set(p.id, p);
                }
            }
        }
        
        const rawProducts = Array.from(allProductsMap.values());
        console.log(`[4/4] S-au gasit ${rawProducts.length} produse unice in toata reteaua! Parsare si salvare in Supabase...`);


        let newCount = 0;
        let updateCount = 0;

        for (const p of rawProducts) {
            const category = p.resolvedCategory;
            let computedBrandName = 'Sushi Master'; 
            
            const upCat = category.toUpperCase();
            const upName = p.name.toUpperCase();

            // Dynamic Brand Matching (similar to frontend)
            if (upCat.includes('IKURA') || upName.includes('IKURA')) computedBrandName = 'Ikura Sushi';
            else if (upCat.includes('SMASH') || upName.includes('SMASH')) computedBrandName = 'Smash Me';
            else if (upCat.includes('W LS') || upCat.includes('WE LOVE') || upName.includes('W LS') || upName.includes('WE LOVE') || upName.includes('W LOVE')) computedBrandName = 'We Love Sushi';
            else if (upCat.includes('BOWL')) computedBrandName = 'Super Bowl';

            const payload = {
                iiko_id: p.id,
                name: p.name,
                sku: p.code,
                category,
                price: p.defaultUnit || p.prices?.[0] ? null : 0,
                brand_name: computedBrandName,
                weight: p.weight || null,
                measure_unit: p.measureUnit || 'kg',
                image_url: p.imageLinks?.[0] || null,
                last_synced_at: new Date().toISOString()
            };

            // Check if exists
            const { data: existing, error: findError } = await supabase
                .from('iiko_catalog')
                .select('id, last_synced_at')
                .eq('iiko_id', p.id)
                .single();

            if (existing) {
                // Update
                await supabase.from('iiko_catalog').update(payload).eq('iiko_id', p.id);
                updateCount++;
            } else {
                // Insert
                await supabase.from('iiko_catalog').insert([payload]);
                newCount++;
            }
        }

        console.log(`✅ SYNC FINALIZAT! Produse noi: ${newCount} | Produse actualizate: ${updateCount}`);
        
    } catch (err) {
        console.error('❌ EROARE CRITICA:', err.message);
    }
}

syncIikoCatalog();
