import fs from 'fs';

const accRaw = fs.readFileSync('src/data/accounting_imported.json', 'utf8');
const facRaw = fs.readFileSync('src/data/factory_imported.json', 'utf8');

const acc = JSON.parse(accRaw);
const fac = JSON.parse(facRaw);

console.log('=== ACCOUNTING_IMPORTED.JSON KEYS & SIZES ===');
for (const [k, v] of Object.entries(acc)) {
  console.log(`- ${k}: ${Array.isArray(v) ? v.length + ' items' : typeof v}`);
}

console.log('\n=== FACTORY_IMPORTED.JSON KEYS & SIZES ===');
for (const [k, v] of Object.entries(fac)) {
  console.log(`- ${k}: ${Array.isArray(v) ? v.length + ' items' : typeof v}`);
}
