import fs from 'fs';

const fac = JSON.parse(fs.readFileSync('src/data/factory_imported.json', 'utf8'));

console.log('=== PRODUCTS CATALOG SAMPLE ===');
console.log(fac.products_catalog.slice(0, 5));

console.log('\n=== FINISHED GOODS INVENTORY SAMPLE ===');
console.log(fac.finished_goods_inventory.slice(0, 5));

console.log('\n=== MATERIALS INVENTORY SAMPLE ===');
console.log(fac.materials_inventory.slice(0, 5));

console.log('\n=== LOSS RATES SAMPLE ===');
console.log(fac.loss_rates.slice(0, 5));
