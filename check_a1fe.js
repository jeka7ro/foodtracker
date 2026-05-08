import { createClient } from '@supabase/supabase-js'

const check = async () => {
    const tokenRes = await fetch('https://api-eu.syrve.live/api/1/access_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiLogin: 'a1fe30cdeb934aa0af01b6a35244b7f0' })
    });
    const d_t = await tokenRes.json();
    
    if (!tokenRes.ok) {
        console.log("Error:", d_t);
        return;
    }

    const orgsRes = await fetch('https://api-eu.syrve.live/api/1/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + d_t.token },
        body: JSON.stringify({ returnAdditionalInfo: true, includeDisabled: false })
    });
    const orgs = await orgsRes.json();
    console.log(`Gasite ${orgs.organizations?.length || 0} organizatii:`);
    
    if (orgs.organizations) {
        orgs.organizations.forEach(o => {
            console.log(`- ${o.name} (ID: ${o.id})`);
        });
    }
}
check().catch(console.error)
