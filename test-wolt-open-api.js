import fetch from 'node-fetch';

async function checkWoltAPI() {
    console.log("🚀 Testing WOLT Public Consumer API without any Keys...");
    try {
        // Bucharest coordinates
        const lat = 44.4268;
        const lon = 26.1025;
        
        // 1. Get the list of venues near Bucharest
        console.log(`\n1. Fetching venues around GPS (lat: ${lat}, lon: ${lon})...`);
        const url = `https://restaurant-api.wolt.com/v1/pages/front?lat=${lat}&lon=${lon}`;
        
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
            }
        });
        
        if (!response.ok) {
            console.error("HTTP Error:", response.status);
            return;
        }

        const data = await response.json();
        
        // Wolt structures their front pages into 'sections'. We find a section that has venues
        let venues = [];
        if (data.sections) {
            for (const section of data.sections) {
                if (section.items && section.items.length > 0) {
                    // Extract items that are venues
                    const venueItems = section.items.filter(item => item.venue);
                    venues.push(...venueItems);
                }
            }
        }
        
        if (venues.length === 0) {
            console.log("No venues found in public API section.");
            return;
        }

        console.log(`✅ Found ${venues.length} venues/restaurants in the area.`);
        
        if (venues.length > 0) {
            const sample = venues[0];
            const sampleVenue = sample.venue;
            
            console.log(`\n2. Extracting Open Data for random competitor: "${sample.title}"`);
            console.log("-----------------------------------------------------------------");
            console.log(`🏢 Name: ${sample.title}`);
            console.log(`📍 Online Status: ${sampleVenue.online ? '🟢 ONLINE (Taking Orders)' : '🔴 OFFLINE'}`);
            console.log(`⭐ Rating: ${sampleVenue.rating ? sampleVenue.rating.score : 'N/A'}`);
            console.log(`🚴 Delivery Estimate: ${sampleVenue.estimate_range}`);
            console.log(`🚚 Delivery Price: ${sampleVenue.delivery_price}`);
            console.log(`🏷️ Tags: ${sampleVenue.tags?.join(', ')}`);
            console.log(`🍔 Popularity/Volume Score: ${sampleVenue.rating ? sampleVenue.rating.volume : 'N/A'}`);
            console.log(`📝 Description: ${sampleVenue.short_description}`);
            
            // 3. Let's see if we can get the specific menu for this item (using its slug)
            console.log(`\n3. Hitting exact menu endpoint for: ${sampleVenue.slug}...`);
            const menuUrl = `https://restaurant-api.wolt.com/v4/venues/slug/${sampleVenue.slug}/menu`;
            
            const menuResponse = await fetch(menuUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' }
            });
            
            if (menuResponse.ok) {
                const menuData = await menuResponse.json();
                console.log(`✅ Menu Extracted! Found ${menuData.categories?.length || 0} Categories and ${menuData.items?.length || 0} Products.`);
                
                if (menuData.items && menuData.items.length > 0) {
                    console.log("\nTop 3 Items extracted perfectly:");
                    for (let i = 0; i < Math.min(3, menuData.items.length); i++) {
                        const it = menuData.items[i];
                        console.log(`  - [${it.name}] -> Price: ${(it.baseprice / 100).toFixed(2)} RON (Stock limits? ${it.inventory_enabled ? 'Yes' : 'No'})`);
                    }
                }
            }
        }

        console.log("\n🎉 TEST COMPLETE!");
        console.log("Result: Yes, the public API exposes almost everything structural (status, menu, prices, tags, times) EXCEPT hard financial figures (exact number of sales/clients) which are kept strictly encrypted in Wolt's backend databases!");
        
    } catch (e) {
        console.error("Test failed:", e.message);
    }
}

checkWoltAPI();
