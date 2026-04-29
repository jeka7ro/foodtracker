import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const toml = fs.readFileSync('netlify.toml', 'utf8');
const url = toml.match(/VITE_SUPABASE_URL = "(.*)"/)[1];
const supaKey = toml.match(/VITE_SUPABASE_ANON_KEY = "(.*)"/)[1];
const supabase = createClient(url, supaKey);

async function run() {
    console.log("Deleting corrupted Glovo inserts from April 10th 06:42...");
    const { error } = await supabase.from('platform_sales')
        .delete()
        .eq('platform', 'glovo')
        .gte('placed_at', '2026-04-10T06:30:00Z')
        .lte('placed_at', '2026-04-10T06:50:00Z');
        
    console.log("Delete status:", error || "Success");
}
run();
