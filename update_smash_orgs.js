import { createClient } from '@supabase/supabase-js'

const check = async () => {
    const supabase = createClient(
        'https://arzxvzjyiwmkxgoagjcq.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyenh2emp5aXdta3hnb2FnamNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNTU3NjMsImV4cCI6MjA4ODczMTc2M30.bGsx8wA1EDSXuuQs0keCDOx4L4PPY9Ar3LhVJer7DGM'
    )
    
    await supabase.from('restaurants').update({ iiko_restaurant_id: '9c63cff6-1d66-442d-a98d-2302656e3943' }).eq('name', 'Smash Me Cluj-Napoca')
    await supabase.from('restaurants').update({ iiko_restaurant_id: '8308e796-8780-4d18-ae66-4e430178c778' }).eq('name', 'Smash Me Constanta')
    console.log("Updated Smash Me orgIds in DB")
}
check().catch(console.error)
