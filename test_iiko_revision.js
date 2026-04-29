import fetch from 'node-fetch';
const BASE_URL = 'https://api-eu.syrve.live/api/1';
const key = 'a1fe30cdeb934aa0af01b6a35244b7f0';

async function testApi() {
    const resAuth = await fetch(`${BASE_URL}/access_token`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiLogin: key })
    });
    const token = (await resAuth.json()).token;
    
    // Test by_revision
    const res = await fetch(`${BASE_URL}/deliveries/by_revision`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
            organizationIds: ["effc9518-ceef-4eec-8ad5-9b48ae84c540"]
            // "By omission returns data for yesterday and today" -> Wait, what if I pass startRevision: 0
            // startRevision: 0 // "If startRevision is not specified or 0, returns ALL data."
        })
    });
    const json = await res.json();
    console.log("By Revision without startRevision:", typeof json.ordersByOrganizations);
    
    const res2 = await fetch(`${BASE_URL}/deliveries/by_revision`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
            organizationIds: ["effc9518-ceef-4eec-8ad5-9b48ae84c540"],
            startRevision: 100 // a very low revision
        })
    });
    const json2 = await res2.json();
    console.log("By Revision with startRevision 100:", json2?.error || typeof json2.ordersByOrganizations);
}
testApi();
