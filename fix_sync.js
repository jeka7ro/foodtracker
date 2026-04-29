import { readFileSync, writeFileSync } from 'fs';
let content = readFileSync('/Users/eugeniucazmal/Downloads/dev_office/aggregator-monitor-fba2535a/workers/src/services/sales-sync.js', 'utf8');

// Replace the fetch call with a retry loop and delay
content = content.replace(
    `const res = await fetch(\`https://api-eu.syrve.live/api/1/deliveries/by_delivery_date_and_status\`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': \`Bearer \${token}\` },
                            body: JSON.stringify(reqBody)
                        })

                        if (!res.ok) continue`,
    `let res;
                        let retries = 3;
                        while(retries > 0) {
                            res = await fetch(\`https://api-eu.syrve.live/api/1/deliveries/by_delivery_date_and_status\`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', 'Authorization': \`Bearer \${token}\` },
                                body: JSON.stringify(reqBody)
                            });
                            if (res.ok) break;
                            const errTxt = await res.text();
                            console.log(\`[Sync] Iiko API Error (HTTP \${res.status}): \${errTxt} | Retrying...\`);
                            await new Promise(r => setTimeout(r, 8000));
                            retries--;
                        }
                        
                        if (!res || !res.ok) {
                            console.error('[Sync] Abandoning chunk after retries.');
                            continue;
                        }
                        
                        // Sleep to avoid rate limits
                        await new Promise(r => setTimeout(r, 600));`
);

writeFileSync('/Users/eugeniucazmal/Downloads/dev_office/aggregator-monitor-fba2535a/workers/src/services/sales-sync.js', content);
