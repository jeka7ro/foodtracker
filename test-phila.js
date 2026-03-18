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
    
    own.forEach(o => {
        const pName = o.product_name || ''
        const keyWithCity = `${pName.trim().toLowerCase()}___${o.city || ''}`
        const normKey = `${normalizeName(pName)}___${o.city || ''}`
        
        const val = { price: o.price }
        ownMap[keyWithCity] = val
        if (normalizeName(pName)) {
            normalizedOwnMap[normKey] = val
        }
    })
    
    const compName = 'Philadelphia Classic'
    const compCity = 'Bucharest'
    
    let exactOwn = ownMap[`${compName.trim().toLowerCase()}___${compCity}`]
    let usingNorm = false;
    let fallback = null;
    if (!exactOwn) {
        exactOwn = normalizedOwnMap[`${normalizeName(compName)}___${compCity}`]
        usingNorm = true;
    }
    
    if (!exactOwn && normalizeName('Philadelphia Classic')) {
        // partial
        const compWords = normalizeName(compName).split(' ')
        const bestMatchKey = Object.keys(normalizedOwnMap).find(k => {
            const ownW = k.split('___')[0];
            if (!ownW || ownW.length < 4) return false;
            const ownWords = ownW.split(' ');
            const criticalIngredients = ['somon', 'salmon', 'ton', 'tuna', 'shrimp', 'crevete', 'creveti', 'pui', 'chicken', 'vita', 'beef', 'porc', 'pork', 'veg', 'vegan']
            const compCriticals = compWords.filter(w => criticalIngredients.includes(w))
            const ownCriticals = ownWords.filter(w => criticalIngredients.includes(w))
            const hasConflictingIngredients = compCriticals.some(c => ownCriticals.length > 0 && !ownCriticals.includes(c)) || 
                                              ownCriticals.some(o => compCriticals.length > 0 && !compCriticals.includes(o))
            if (hasConflictingIngredients) return false;
            const intersection = ownWords.filter(w => compWords.includes(w));
            return intersection.length >= Math.max(ownWords.length - 1, 1) && intersection.length >= Math.max(compWords.length - 1, 1);
        });
        if (bestMatchKey) { fallback = normalizedOwnMap[bestMatchKey]; }
    }
    
    console.log("Matched?", !!exactOwn, "usingNorm?", usingNorm, "Fallback match?", fallback)
    console.log("normKey for comp:", `${normalizeName(compName)}___${compCity}`)
    console.log("In normalizedOwnMap?", normalizedOwnMap[`${normalizeName(compName)}___${compCity}`])
}
test()
