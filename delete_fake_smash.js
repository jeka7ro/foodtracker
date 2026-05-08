import { createClient } from '@supabase/supabase-js'

const check = async () => {
    const supabase = createClient(
        'https://arzxvzjyiwmkxgoagjcq.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyenh2emp5aXdta3hnb2FnamNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNTU3NjMsImV4cCI6MjA4ODczMTc2M30.bGsx8wA1EDSXuuQs0keCDOx4L4PPY9Ar3LhVJer7DGM'
    )
    
    // Find all Smash Me restaurants that I added today
    const { data: rests } = await supabase.from('restaurants').select('id, name').filter('name', 'ilike', 'Smash Me%')
    
    const idsToDelete = []
    for (const r of rests) {
        if (r.name !== 'Smash Me Cluj-Napoca' && r.name !== 'Smash Me Constanta') {
            idsToDelete.push(r.id)
            console.log("Deleting", r.name)
        }
    }
    
    if (idsToDelete.length > 0) {
        await supabase.from('restaurants').delete().in('id', idsToDelete)
        console.log(`Deleted ${idsToDelete.length} fake Smash Me restaurants`)
    }
}
check().catch(console.error)
