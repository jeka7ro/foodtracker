import fs from 'fs';
let content = fs.readFileSync('workers/src/scrapers/sync-iiko-catalog.js', 'utf8');

const regex = /const resMenu = await fetch\(`\$\{IIKO_BASE\}\/nomenclature`, \{[\s\S]*?body: JSON\.stringify\(\{ organizationId: organizations\[0\]\.id \}\)[\s\S]*?\}\);\s*const menuData = await resMenu\.json\(\);\s*console\.log\('\[4\/4\] Parsare si salvare in Supabase\.\.\.'\);\s*const groupsMap = new Map\(\(menuData\.groups \|\| \[\]\)\.map\(g => \[g\.id, g\.name\]\)\);\s*const rawProducts = \(menuData\.products \|\| \[\]\)[\s\S]*?\.filter\(p => p\.type && \(p\.type\.toLowerCase\(\) === 'dish' \|\| p\.type\.toLowerCase\(\) === 'good'\)\);/;

const replacement = `
        const allProductsMap = new Map();
        
        console.log(\`[3/4] Descarcare meniu din \${organizations.length} organizatii pentru a capta toate brandurile...\`);
        for(let i=0; i<organizations.length; i++) {
            const org = organizations[i];
            console.log(\`  -> Descarcare nomenclature pt \${org.name} (\${i+1}/\${organizations.length})...\`);
            const resMenu = await fetch(\`\${IIKO_BASE}/nomenclature\`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': \`Bearer \${token}\` },
                body: JSON.stringify({ organizationId: org.id })
            });
            const menuData = await resMenu.json();
            
            const groupsMap = new Map((menuData.groups || []).map(g => [g.id, g.name]));
            
            const items = (menuData.products || [])
                .filter(p => p.type && (p.type.toLowerCase() === 'dish' || p.type.toLowerCase() === 'good'));
                
            for(const p of items) {
                if(!allProductsMap.has(p.id)) {
                    p.resolvedCategory = groupsMap.get(p.parentGroup) || 'Meniu General';
                    allProductsMap.set(p.id, p);
                }
            }
        }
        
        const rawProducts = Array.from(allProductsMap.values());
        console.log(\`[4/4] S-au gasit \${rawProducts.length} produse unice in toata reteaua! Parsare si salvare in Supabase...\`);
`;
content = content.replace(regex, replacement);
content = content.replace("const category = groupsMap.get(p.parentGroup) || 'Meniu General';", "const category = p.resolvedCategory;");
fs.writeFileSync('workers/src/scrapers/sync-iiko-catalog.js', content);
