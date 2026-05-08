import * as fs from 'fs';
let content = fs.readFileSync('olap_SALES_2026-04-10.csv', 'utf8');
if (content.includes('\u0000')) {
    content = fs.readFileSync('olap_SALES_2026-04-10.csv', 'utf16le');
}
const lines = content.split('\n');
const items = new Set();
for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(';');
    if (parts.length > 5) {
        const dName = parts[4].toLowerCase();
        if (dName.includes('smash') || dName.includes('burger')) {
            items.add(parts[4]);
        }
    }
}
console.log(Array.from(items));
