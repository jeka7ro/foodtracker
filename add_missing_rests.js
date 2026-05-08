import { createClient } from '@supabase/supabase-js'

const fixDb = async () => {
    const token_res = await fetch('https://api-eu.syrve.live/api/1/access_token', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ apiLogin: '56597d13165c49c49c10e351b5eac617' })
    })
    const { token } = await token_res.json()

    const orgRes = await fetch('https://api-eu.syrve.live/api/1/organizations', {
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},
        body: JSON.stringify({ returnAdditionalInfo: false, includeDisabled: false })
    })
    const orgData = await orgRes.json()

    const supabase = createClient(
        'https://arzxvzjyiwmkxgoagjcq.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyenh2emp5aXdta3hnb2FnamNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNTU3NjMsImV4cCI6MjA4ODczMTc2M30.bGsx8wA1EDSXuuQs0keCDOx4L4PPY9Ar3LhVJer7DGM'
    )
    
    const { data: brands } = await supabase.from('brands').select('*')
    const { data: existingRests } = await supabase.from('restaurants').select('*')
    
    const smashBrandId = brands.find(b => b.name === 'Smash Me')?.id
    const wlsBrandId = brands.find(b => b.name === 'We Love Sushi')?.id
    const ikuraBrandId = brands.find(b => b.name === 'Ikura Sushi')?.id
    
    if (!smashBrandId) { console.error('Smash Me brand not found'); return }

    const newRests = []
    
    // For every organization, check if we have a Smash Me restaurant with that orgId
    for (const org of orgData.organizations) {
        // Extract city from the org name (e.g. "SM CLUJ", "SM CONSTANTA", "SM BUC TITAN")
        let city = org.name.replace('SM ', '').trim()
        
        // Find if this orgId already has a Smash Me in DB
        const existingSmash = existingRests.find(r => r.brand_id === smashBrandId && (r.iiko_restaurant_id === org.id || r.name.toLowerCase().includes(city.toLowerCase())))
        if (!existingSmash) {
            newRests.push({
                brand_id: smashBrandId,
                name: `Smash Me ${city}`,
                city: city,
                is_active: true,
                iiko_restaurant_id: org.id,
                iiko_config: { excluded_product_name_patterns: ["sushimaster","ikura","we love sushi","love roll","love set"] }
            })
            console.log(`Will add: Smash Me ${city}`)
        }
    }
    
    if (newRests.length > 0) {
        const { error } = await supabase.from('restaurants').insert(newRests)
        if (error) console.error(error)
        else console.log(`Successfully added ${newRests.length} new Smash Me restaurants!`)
    } else {
        console.log('No new restaurants to add.')
    }
}
fixDb().catch(console.error)
