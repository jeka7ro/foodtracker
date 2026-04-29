import fetch from 'node-fetch';

async function run() {
    try {
        const ENV_CONFIGS = [
            { key: 'a1fe30cdeb934aa0af01b6a35244b7f0', baseUrl: 'http://localhost:3005/api/iiko', defaultBrand: 'Sushi Master' },
            { key: '124d0880f4b44717b69ee21d45fc2656', baseUrl: 'http://localhost:3005/api/syrve', defaultBrand: 'Smash Me' }
        ];

        let apiOrgs = [];
        for (const env of ENV_CONFIGS) {
            const resAuth = await fetch(`${env.baseUrl}/access_token`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiLogin: env.key })
            });
            if (resAuth.ok) {
                const { token } = await resAuth.json();
                const resOrgs = await fetch(`${env.baseUrl}/organizations`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({})
                });
                const data = await resOrgs.json();
                if (data.organizations) {
                    apiOrgs.push(...data.organizations);
                }
            } else {
                 console.log("Failed auth:", await resAuth.text());
            }
        }
        
        console.log("Iiko Orgs Mapped from API:", apiOrgs.map(o => ({name: o.name, id: o.id})));
    } catch(e) {
        console.error("error", e);
    }
}

run();
