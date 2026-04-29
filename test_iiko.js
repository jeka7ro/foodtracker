import fetch from 'node-fetch';

const BASE_URL = 'https://api-eu.syrve.live/api/1';
const key = '124d0880f4b44717b69ee21d45fc2656';

async function testApi() {
    const resAuth = await fetch(`${BASE_URL}/access_token`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiLogin: key })
    });
    const token = (await resAuth.json()).token;
    
    // We fetch without restricting organizationIds to let Iiko check all organizations
    // owned by this token
    const res = await fetch(`${BASE_URL}/deliveries/by_delivery_date_and_status`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
            deliveryDateFrom: "2026-04-12 00:00:00.000",
            deliveryDateTo: "2026-04-12 23:59:59.000",
            statuses: ["Closed"]
        })
    });
    const json = await res.json();
    let total = 0;
    if(json?.ordersByOrganizations) {
        for(let org of json.ordersByOrganizations) {
            total += org.orders.length;
        }
    }
    console.log("April 12 Total Closed Orders (Token 2):", total);
}
testApi();
