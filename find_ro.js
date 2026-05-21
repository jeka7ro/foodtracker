const fs = require('fs');
const path = require('path');
const glob = require('glob');

const files = glob.sync('src/pages/*.jsx');
const roRegex = /[A-ZĂÎÂȘȚ][a-zăîâșț]+( [a-zăîâșțA-ZĂÎÂȘȚ]+){1,}/g; // very simple heuristic

let total = 0;
files.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    if (!content.includes('useLanguage')) {
        console.log(`[NO_LANG] ${file}`);
        total++;
    }
});
console.log(`Total files without useLanguage: ${total}`);
