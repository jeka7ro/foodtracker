const fs = require('fs');
const content = fs.readFileSync('src/pages/MarketingAnalytics.jsx', 'utf8');

const lines = content.split('\n');
let depth = 0;
let inReturn = false;
let startLine = 0;
for(let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('return (') && !inReturn) {
        inReturn = true;
        startLine = i;
    }
    if (inReturn) {
        const opens = (line.match(/<div(\s|>)/g) || []).length;
        const closes = (line.match(/<\/div>/g) || []).length;
        depth += opens;
        depth -= closes;
        if (opens !== closes && depth < 0) {
            console.log(`Mismatch at line ${i+1}: opens ${opens}, closes ${closes}, depth ${depth}`);
        }
    }
}
console.log('Final depth:', depth);
