import Papa from 'papaparse';
import fs from 'fs';
import path from 'path';
import {
  parseNumber,
  findPriceRecord,
  getBuyPriceFromRecord,
  getSellPriceFromRecord,
  calculatePOLineFinances,
  calculateDeliveryFinances
} from '../src/lib/business-logic';
import {
  PRICING_DATA,
  PO_HEADER_DATA,
  PO_LINES_DATA,
  DELIVERY_DATA,
  DELIVERY_PLAN_DATA,
  CUSTOMER_DATA,
  SUPPLIER_DATA,
  PRODUCT_DATA
} from '../src/data';

console.log('=== STEP 1: PARSING MASTER DATA TABLES ===');
const pricingRows = Papa.parse(PRICING_DATA.trim(), { header: true, skipEmptyLines: true }).data as any[];
const poHeaderRows = Papa.parse(PO_HEADER_DATA.trim(), { header: true, skipEmptyLines: true }).data as any[];
const poLineRows = Papa.parse(PO_LINES_DATA.trim(), { header: true, skipEmptyLines: true }).data as any[];
const deliveryRows = Papa.parse(DELIVERY_DATA.trim(), { header: true, skipEmptyLines: true }).data as any[];
const customerRows = Papa.parse(CUSTOMER_DATA.trim(), { header: true, skipEmptyLines: true }).data as any[];
const supplierRows = Papa.parse(SUPPLIER_DATA.trim(), { header: true, skipEmptyLines: true }).data as any[];
const productRows = Papa.parse(PRODUCT_DATA.trim(), { header: true, skipEmptyLines: true }).data as any[];

console.log(`Master Data Row Counts:`);
console.log(`- Pricing: ${pricingRows.length}`);
console.log(`- PO Headers: ${poHeaderRows.length}`);
console.log(`- PO Lines: ${poLineRows.length}`);
console.log(`- Deliveries: ${deliveryRows.length}`);
console.log(`- Customers: ${customerRows.length}`);
console.log(`- Suppliers: ${supplierRows.length}`);
console.log(`- Products: ${productRows.length}`);

// Normalization helper
const norm = (t: string) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

// Classify deliveries into North, South, Other
const isNorth = (cust: string) => {
  const n = norm(cust);
  return n.includes('thang long') || n.includes('thanh hoa') || n.includes('bac son');
};
const isSouth = (cust: string) => {
  const n = norm(cust);
  return n.includes('ben tre') || n.includes('sai gon') || n.includes('quoc dai');
};

const northDeliveries = deliveryRows.filter(d => isNorth(d['Khách hàng'] || d['Tên khách hàng'] || d['RP_Khách hàng']));
const southDeliveries = deliveryRows.filter(d => isSouth(d['Khách hàng'] || d['Tên khách hàng'] || d['RP_Khách hàng']));
const otherDeliveries = deliveryRows.filter(d => !isNorth(d['Khách hàng'] || d['Tên khách hàng'] || d['RP_Khách hàng']) && !isSouth(d['Khách hàng'] || d['Tên khách hàng'] || d['RP_Khách hàng']));

console.log('\n=== STEP 2: DELIVERY SCOPE BREAKDOWN ===');
console.log(`Total Deliveries: ${deliveryRows.length}`);
console.log(`- North Deliveries: ${northDeliveries.length}`);
console.log(`- South Deliveries: ${southDeliveries.length}`);
console.log(`- Other Deliveries: ${otherDeliveries.length}`);

// Calculate North Revenue, COGS, Profit, Margin
let northRev = 0;
let northCOGS = 0;
let northProfit = 0;

for (const d of northDeliveries) {
  const fin = calculateDeliveryFinances(d, pricingRows, poLineRows);
  const rev = fin.revenue;
  const prof = fin.profit;
  const cogs = rev - prof;
  northRev += rev;
  northCOGS += cogs;
  northProfit += prof;
}

console.log('\n=== STEP 3: NORTH FINANCIAL METRICS ===');
console.log(`Calculated North Revenue: ${northRev.toLocaleString('vi-VN')} ₫ (Target: 5.419.475.060 ₫)`);
console.log(`Calculated North COGS:    ${northCOGS.toLocaleString('vi-VN')} ₫ (Target: 3.957.078.067 ₫)`);
console.log(`Calculated North Profit:  ${northProfit.toLocaleString('vi-VN')} ₫ (Target: 1.462.396.993 ₫)`);
console.log(`Calculated North Margin:  ${((northProfit / northRev) * 100).toFixed(4)}% (Target: 26.98%)`);

// Calculate South Revenue, COGS, Profit
let southRev = 0;
let southCOGS = 0;
let southProfit = 0;

for (const d of southDeliveries) {
  const fin = calculateDeliveryFinances(d, pricingRows, poLineRows);
  const rev = fin.revenue;
  const prof = fin.profit;
  const cogs = rev - prof;
  southRev += rev;
  southCOGS += cogs;
  southProfit += prof;
}

console.log('\n=== STEP 4: SOUTH FINANCIAL METRICS ===');
console.log(`Calculated South Revenue: ${southRev.toLocaleString('vi-VN')} ₫ (Target: 45.556.624.491 ₫)`);
console.log(`Calculated South COGS:    ${southCOGS.toLocaleString('vi-VN')} ₫`);
console.log(`Calculated South Profit:  ${southProfit.toLocaleString('vi-VN')} ₫`);
console.log(`Calculated South Margin:  ${((southProfit / southRev) * 100).toFixed(4)}%`);

// Company Wide
const totalCompanyRev = northRev + southRev;
console.log('\n=== STEP 5: COMPANY-WIDE METRICS ===');
console.log(`Calculated Company Revenue: ${totalCompanyRev.toLocaleString('vi-VN')} ₫ (Target: 50.976.099.551 ₫)`);
console.log(`Calculated Total Vouchers:  ${deliveryRows.length} (Target: 1.108 vouchers)`);

// Check Tam Sen Factory / Lưỡi Gà Trắng
console.log('\n=== STEP 6: INVESTIGATING LƯỠI GÀ TRẮNG & TÂM SEN FACTORY ===');
const luoiGaItems = pricingRows.filter(p => {
  const name = norm(p['Tên sản phẩm'] || '');
  const code = norm(p['Mã sản phẩm'] || p['Mã giá bán'] || '');
  return name.includes('luoi ga') || code.includes('luoi ga') || code.includes('lgt') || code.includes('gsp_09');
});
console.log(`Found ${luoiGaItems.length} Lưỡi Gà pricing items:`);
for (const item of luoiGaItems) {
  console.log(`- Mã: ${item['Mã giá bán'] || item['Mã sản phẩm']} | Tên: ${item['Tên sản phẩm']} | KH: ${item['RP_Khách hàng'] || item['Giao đến']} | Mua: ${item['Đơn giá mua']} | AVP: ${item['Giá AVP']} | Bán: ${item['Đơn giá bán']} | NCC: ${item['RP_Nhà cung cấp']}`);
}

// Deliveries for Lưỡi Gà Trắng
const luoiGaDeliveries = deliveryRows.filter(d => {
  const name = norm(d['Tên sản phẩm'] || '');
  const sku = norm(d['Mã sản phẩm'] || '');
  return name.includes('luoi ga') || sku.includes('lgt');
});
console.log(`\nFound ${luoiGaDeliveries.length} Lưỡi Gà deliveries:`);
for (const d of luoiGaDeliveries.slice(0, 10)) {
  const fin = calculateDeliveryFinances(d, pricingRows, poLineRows);
  console.log(`- PXK: ${d['Số PXK']} | PO: ${d['Đơn hàng']} | SP: ${d['Tên sản phẩm']} | Qty: ${d['Số lượng giao']} | Rev: ${fin.revenue.toLocaleString('vi-VN')} | BuyPrice: ${fin.buyPrice} | SellPrice: ${fin.sellPrice} | Profit: ${fin.profit.toLocaleString('vi-VN')} | Margin: ${fin.margin.toFixed(2)}% | NCC: ${d['Nhà cung cấp']}`);
}

// Inspect accounting_imported.json and factory_imported.json
console.log('\n=== STEP 7: CHECKING ACCOUNTING_IMPORTED.JSON & FACTORY_IMPORTED.JSON ===');
const accPath = path.join(__dirname, '../src/data/accounting_imported.json');
const facPath = path.join(__dirname, '../src/data/factory_imported.json');

if (fs.existsSync(accPath)) {
  const accData = JSON.parse(fs.readFileSync(accPath, 'utf8'));
  console.log(`accounting_imported.json size/keys: ${Array.isArray(accData) ? accData.length + ' items' : Object.keys(accData).join(', ')}`);
}
if (fs.existsSync(facPath)) {
  const facData = JSON.parse(fs.readFileSync(facPath, 'utf8'));
  console.log(`factory_imported.json size/keys: ${Array.isArray(facData) ? facData.length + ' items' : Object.keys(facData).join(', ')}`);
}
