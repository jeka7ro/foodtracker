import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const toml = fs.readFileSync('netlify.toml', 'utf8');
const url = toml.match(/VITE_SUPABASE_URL = "(.*)"/)[1];
const supaKey = toml.match(/VITE_SUPABASE_ANON_KEY = "(.*)"/)[1];
const supabase = createClient(url, supaKey);

async function run() {
    console.log("Fetching index list using rpc...");
}
