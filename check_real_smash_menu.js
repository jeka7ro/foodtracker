import { createClient } from '@supabase/supabase-js'

const check = async () => {
    // Authenticate with SMASH ME API token
    const tokenRes = await fetch('https://api-eu.syrve.live/api/1/access_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiLogin: '124d0880f4b44717b69ee21d45fc2656' })
    });
    const d_t = await tokenRes.json();
    const token = d_t.token;

    // Get Orgs
    const orgsRes = await fetch('https://api-eu.syrve.live/api/1/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ returnAdditionalInfo: false, includeDisabled: false })
    });
    const orgs = await orgsRes.json();
    const allOrgIds = orgs.organizations.map(o => o.id);

    // Get Menu
    const res = await fetch('https://api-eu.syrve.live/api/1/nomenclature', {
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},
        body: JSON.stringify({ organizationId: allOrgIds[0] })
    })
    const data = await res.json()
    
    console.log(`REAL Smash Me Server Menu:`)
    for (const p of data.products||[]) {
        console.log(`- ${p.name}`)
    }
}
check().catch(console.error)
