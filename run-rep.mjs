import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({path: './.env.local'});
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials!");
  process.exit(1);
}

process.env.SUPABASE_URL = supabaseUrl;
process.env.SUPABASE_SERVICE_KEY = supabaseKey;

async function run() {
    console.log("\nStarting ReputationScraper manually...");
    const { ReputationScraper } = await import('./workers/src/scrapers/reputation-scraper.js');
    const scraper = new ReputationScraper();
    await scraper.runAllScrapes();
}

run();
