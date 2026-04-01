import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({path: './.env.local'});
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_KEY);

async function addColumn() {
  console.log("Adding is_competitor column...");
  // Use postgres function or direct query if available.
  // Actually, standard supabase-js does not allow executing raw DDL queries unless we use RPC.
  // We can try to just run a raw query workaround, or tell user to run it.
  
  // Since we don't have a custom function to execute SQL via client, let's just 
  console.log("Please run this in your Supabase SQL Editor:");
  console.log("ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS is_competitor BOOLEAN DEFAULT false;");
  process.exit(0);
}

addColumn();
