import * as fs from 'fs';
import * as xlsx from 'xlsx';
const buf = fs.readFileSync('martie.xlsx');
const workbook = xlsx.read(buf, { type: 'buffer' });
const sheetName = workbook.SheetNames[0];
const json = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "", range: 1 });
console.log(Object.keys(json[0]));
console.log(json[0]);
