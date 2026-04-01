import fetch from 'node-fetch';

const API_KEY = 'a1fe30cdeb934aa0af01b6a35244b7f0';
const BASE_URL = 'https://api-eu.iiko.services/api/1';

async function testIiko() {
    try {
        console.log("1. Generam token de acces iiko...");
        const response = await fetch(`${BASE_URL}/access_token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apiLogin: API_KEY })
        });
        
        const data = await response.json();
        if (data.errorDescription) {
            console.error('❌ Eroare Autentificare iiko:', data.errorDescription);
            return;
        }
        
        const token = data.token;
        console.log('✅ Token iiko obtinut cu succes (valabil 1h)');
        
        console.log("2. Extragem lista de restaurante/organizatii...");
        const orgRes = await fetch(`${BASE_URL}/organizations`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ })
        });
        
        const orgData = await orgRes.json();
        const organizations = orgData.organizations || [];
        
        console.log(`✅ S-au gasit ${organizations.length} locatii/organizatii in sistemul vostru de gestiune.`);
        // Listam maxim 5 sa avem o idee:
        organizations.slice(0, 5).forEach(o => {
            console.log(`   - ${o.name} (ID: ${o.id})`);
        });
        
        console.log("\n🔥 Urmeaza generarea datelor reale pentru graficul de 'Vânzări pe ore' (Heatmap) bazat pe aceste ID-uri...");
        
    } catch(err) {
        console.error('❌ A aparut o exceptie la conectarea iiko:', err.message);
    }
}

testIiko();
