import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://arzxvzjyiwmkxgoagjcq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyenh2emp5aXdta3hnb2FnamNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNTU3NjMsImV4cCI6MjA4ODczMTc2M30.bGsx8wA1EDSXuuQs0keCDOx4L4PPY9Ar3LhVJer7DGM'
);

async function run() {
    await supabase.from('restaurants').delete().in('name', ['IKURA ORADEA', 'SM ORADEA', 'SM BUC TITAN', 'SM CLUJ']);
    
    await supabase.from('restaurants').insert([
        {
            name: "IKURA ORADEA", city: "ORADEA", is_active: true,
            iiko_restaurant_id: "fba7fb0d-5872-4d7a-a660-fef7b539fa04",
            wolt_url: "https://wolt.com/ro/rou/oradea/restaurant/ikura-sushi-oradea-67dd59415e61a1513fbf7045"
        },
        {
            name: "SM ORADEA", city: "ORADEA", is_active: true,
            iiko_restaurant_id: "647d6cc7-874e-4f32-84cc-fca2114ac3be",
            wolt_url: "https://wolt.com/ro/rou/oradea/restaurant/sushi-master-oradea-67dd59415e61a1513fbf7038"
        },
        {
            name: "SM BUC TITAN", city: "BUCURESTI", is_active: true,
            iiko_restaurant_id: "bdcce8f6-17b5-4b36-bef8-dd5ae9fcd2e9"
        },
        {
            name: "SM CLUJ", city: "CLUJ-NAPOCA", is_active: true,
            iiko_restaurant_id: "1722dadd-55a0-4ff9-8f4b-2d7c50ff3411"
        }
    ]);
    console.log("Done inserting manually!");
}
run();
