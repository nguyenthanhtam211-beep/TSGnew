import fs from 'fs';

const accRaw = fs.readFileSync('src/data/accounting_imported.json', 'utf8');
const facRaw = fs.readFileSync('src/data/factory_imported.json', 'utf8');

const acc = JSON.parse(accRaw);
const fac = JSON.parse(facRaw);

console.log('=== ACCOUNTING_IMPORTED.JSON ===');
console.log('Type:', Array.isArray(acc) ? `Array of ${acc.length} items` : typeof acc);
console.log('Content preview:', JSON.stringify(acc, null, 2).slice(0, 1000));

console.log('\n=== FACTORY_IMPORTED.JSON ===');
console.log('Type:', Array.isArray(fac) ? `Array of ${fac.length} items` : typeof fac);
console.log('Content preview:', JSON.stringify(fac, null, 2).slice(0, 1000));
