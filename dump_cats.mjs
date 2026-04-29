import fetch from 'node-fetch';
const IIKO_API_KEY = 'a1fe30cdeb934aa0af01b6a35244b7f0';
const IIKO_BASE = 'https://api-eu.iiko.services/api/1';
async function run() {
    const resAuth = await fetch(`${IIKO_BASE}/access_token`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiLogin: IIKO_API_KEY })
    });
    const { token } = await resAuth.json();
    const resOrgs = await fetch(`${IIKO_BASE}/organizations`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({})
    });
    const { organizations } = await resOrgs.json();
    
    const allCount = {};
    for (const o of organizations) {
        const resMenu = await fetch(`${IIKO_BASE}/nomenclature`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ organizationId: o.id })
        });
        const m = await resMenu.json();
        const groupsMap = new Map((m.groups || []).map(g => [g.id, g.name]));
        (m.products||[]).forEach(p => {
             const cat = groupsMap.get(p.parentGroup) || 'UNCATEGORIZED';
             allCount[cat] = (allCount[cat] || 0) + 1;
        });
    }
    console.log(allCount);
}
run();
