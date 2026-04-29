import fetch from 'node-fetch';
const BASE_URL = 'https://api-eu.syrve.live/api/1';
const apiKeys = ['a1fe30cdeb934aa0af01b6a35244b7f0', '124d0880f4b44717b69ee21d45fc2656'];

async function testOlap() {
    for (const key of apiKeys) {
        console.log("Testing Key:", key.substring(0,6));
        const resAuth = await fetch(`${BASE_URL}/access_token`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apiLogin: key })
        });
        const token = (await resAuth.json()).token;
        const resOrgs = await fetch(`${BASE_URL}/organizations`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({})
        });
        const orgs = (await resOrgs.json()).organizations;
        if (!orgs || orgs.length === 0) continue;
        console.log("Found org:", orgs[0].name);

        const d = new Date(); d.setDate(d.getDate() - 15);
        const dateStr = d.toISOString().split('T')[0];

        const olapRes = await fetch(`${BASE_URL}/reports/sales`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
                organizationId: orgs[0].id,
                request: {
                    reportType: "SALES",
                    buildSummary: false,
                    groupByRowLabels: [ "Date" ],
                    aggregateFields: [ "DishDiscountSumInt" ],
                    filters: { "Date": { "filterType": "IncludeValues", "values": [dateStr] } }
                }
            })
        });
        const olapTask = await olapRes.json();
        console.log("Task result:", olapTask);
    }
}
testOlap();
