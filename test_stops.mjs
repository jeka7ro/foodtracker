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
    const orgIds = organizations.map(o => o.id);

    const resStops = await fetch(`${IIKO_BASE}/stop_lists`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ organizationIds: orgIds })
    });
    const data = await resStops.json();
    console.log(JSON.stringify(data.terminalGroupStopLists || data, null, 2));
}
run();
