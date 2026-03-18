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

async function testComp() {
    const { data: comp } = await supabase.from('competitor_products').select('product_name, city').ilike('product_name', '%phila%')
    const match = comp?.find(c => normalizeName(c.product_name).includes('classic'))
    console.log("COMP Phila", match, normalizeName(match?.product_name||''))
}
testComp()
