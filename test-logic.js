import fs from 'fs'
import { createClient } from '@supabase/supabase-js'
const env = fs.readFileSync('workers/.env', 'utf8')
const supabase = createClient(env.match(/SUPABASE_URL=(.*)/)[1].trim(), env.match(/SUPABASE_SERVICE_KEY=(.*)/)[1].trim())

const normalizeName = (n) => {
    if (!n) return '';
    let s = n.toLowerCase().trim();
    s = s.replace(/we love /g, '');
    s = s.replace(/crevete|creveți|creveti|shrimps|ebi/g, 'shrimp');
    s = s.replace(/\bton\b|tuna/g, 'tuna');
    s = s.replace(/crabi|crab/g, 'crab');
    s = s.replace(/phila\b/g, 'philadelphia');
    s = s.replace(/fume|afumat/g, 'fume');
    return s.split(/[\s\-]+/).filter(w => w.length > 2 && w !== 'sus' && w !== 'cu').sort().join(' ');
}

async function test() {
    const { data: own } = await supabase.from('own_product_snapshots').select('product_name, city, price, brands(name, logo_url)').limit(10000)
    
    const ownMap = {}
    const normalizedOwnMap = {}
    
    own.forEach((o, i) => {
        const brandObj = Array.isArray(o.brands) ? o.brands[0] : o.brands
        const pName = o.product_name || ''
        const keyWithCity = `${pName.trim().toLowerCase()}___${o.city || ''}`
        const normKey = `${normalizeName(pName)}___${o.city || ''}`
        
        const val = { price: o.price, brand: brandObj?.name }
        ownMap[keyWithCity] = val
        if (normalizeName(pName)) {
            normalizedOwnMap[normKey] = val
        }
    })
    
    const { data: comp } = await supabase.from('competitor_products').select('product_name, city, category').eq('city', 'Bucharest').limit(1000)
    
    let matched = 0
    let failed = 0
    
    comp.forEach(p => {
        const fullName = p.product_name || ''
        const compCity = p.city || ''
        
        let exactOwn = ownMap[`${fullName.trim().toLowerCase()}___${compCity}`]
        if (!exactOwn) exactOwn = normalizedOwnMap[`${normalizeName(fullName)}___${compCity}`]
        
        if (exactOwn) matched++
        else failed++

        if (fullName.includes('Philadelphia Classic') && !exactOwn) {
            console.log("FAIL for", fullName, compCity, "norm:", normalizeName(fullName), "expected key:", `${normalizeName(fullName)}___${compCity}`)
            console.log("In normalizedOwnMap?", normalizedOwnMap[`${normalizeName(fullName)}___${compCity}`])
        }
    })
    
    console.log(`Matched: ${matched}, Failed: ${failed}`)
}
test()
