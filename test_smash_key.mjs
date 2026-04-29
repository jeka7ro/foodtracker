import fetch from 'node-fetch';
const SYRVE_KEY = '124d0880f4b44717b69ee21d45fc2656';
const SYRVE_BASE = 'https://api-eu.syrve.live/api/1';
(async () => {
    try {
        console.log("Testing Syrve API:");
        const resAuth = await fetch(`${SYRVE_BASE}/access_token`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apiLogin: SYRVE_KEY })
        });
        const { token } = await resAuth.json();
        const resOrgs = await fetch(`${SYRVE_BASE}/organizations`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({})
        });
        const { organizations } = await resOrgs.json();
        console.log("Organizations for this key:", organizations.length);
        
        let allProductsCount = 0;
        let smashFound = [];
        
        for (const org of organizations) {
            const resMenu = await fetch(`${SYRVE_BASE}/nomenclature`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ organizationId: org.id })
            });
            const m = await resMenu.json();
            const products = m.products || [];
            allProductsCount += products.length;
            
            const smashItems = products.filter(p => true); // log first 3 names
            if (smashItems.length > 0 && smashFound.length === 0) {
                 smashFound.push(...smashItems.slice(0, 3).map(p => ({ category: '?', name: p.name })));
            }
        }
        
        console.log("Total products scanned:", allProductsCount);
        console.log("Samples:", smashFound);
    } catch(e) {
        console.error("Error:", e.message);
    }
})();
