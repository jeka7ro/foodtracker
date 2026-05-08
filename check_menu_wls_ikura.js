import { createClient } from '@supabase/supabase-js'

const check = async () => {
    const tokenRes = await fetch('https://api-eu.syrve.live/api/1/access_token', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiLogin: '56597d13165c49c49c10e351b5eac617' })
    });
    const { token } = await tokenRes.json();

    const res = await fetch('https://api-eu.syrve.live/api/1/nomenclature', {
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},
        body: JSON.stringify({ organizationId: '04062575-5a47-426b-9d35-9dc748f24139' }) // Bucharest Titan
    })
    const data = await res.json()
    
    console.log("Ikura / WLS products:")
    for (const p of data.products||[]) {
        const n = (p.name||'').toLowerCase()
        if (n.includes('ikura') || n.includes('love') || n.includes('wls') || n.includes('w_')) {
            console.log("- " + p.name)
        }
    }
}
check().catch(console.error)
