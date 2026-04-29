const code = `
                if (count && count > 0) {
                    const step = 1000
                    const promises = []
                    
                    for (let i = 0; i < count; i += step) {
                        let query = supabase.from('platform_sales').select('*')
`
console.log("Analyzing fetch pattern");
