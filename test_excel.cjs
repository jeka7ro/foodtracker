const XLSX = require('xlsx');

function checkFile(filename) {
    console.log(`\n--- Checking ${filename} ---`);
    try {
        const workbook = XLSX.readFile(filename);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        console.log(`Total rows: ${jsonData.length}`);
        if (jsonData.length > 0) {
            console.log(`Header row length: ${jsonData[0].length}`);
            console.log(`Row 10 length:`, jsonData[10] ? jsonData[10].length : 'N/A');
            console.log(`Sample row (index 10):`, jsonData[10]);
        }
    } catch (err) {
        console.log(`Error reading ${filename}:`, err.message);
    }
}

checkFile('ianuar.xlsx');
checkFile('feb.xlsx');
checkFile('martie.xlsx');
