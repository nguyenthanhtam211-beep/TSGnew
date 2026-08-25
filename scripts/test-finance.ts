import Papa from 'papaparse';
import { 
  parseNumber, 
  findPriceRecord, 
  getBuyPriceFromRecord, 
  getSellPriceFromRecord, 
  calculatePOLineFinances, 
  calculateDeliveryFinances 
} from '../src/lib/business-logic';
import { PRICING_DATA, PO_LINES_DATA, DELIVERY_DATA } from '../src/data';

console.log('=== 1. TESTING parseNumber ===');
const testCases: [any, number][] = [
  ['718.062.120,00', 718062120],
  ['718,062,120.00', 718062120],
  ['1.800', 1800],
  ['1,800', 1800],
  ['35.63%', 35.63],
  ['35,63%', 35.63],
  ['16.20%', 16.2],
  [null, 0],
  [undefined, 0],
  ['', 0],
  [1800, 1800],
  [' 233,395.00 ', 233395],
  ['99,000.00', 99000],
  ['77,313.60', 77313.6],
  ['(50.000)', -50000],
  ['-1.800', -1800],
  ['250.000 ₫', 250000]
];

let parseErrors = 0;
for (const [input, expected] of testCases) {
  const result = parseNumber(input);
  if (Math.abs(result - expected) > 0.0001) {
    console.error(`FAIL: parseNumber(${JSON.stringify(input)}) -> ${result}, expected ${expected}`);
    parseErrors++;
  } else {
    console.log(`PASS: parseNumber(${JSON.stringify(input)}) === ${result}`);
  }
}

console.log('\n=== 2. TESTING PRICING MATCHING & COGS ===');
const pricingRows = Papa.parse(PRICING_DATA.trim(), { header: true }).data as any[];
const poLineRows = Papa.parse(PO_LINES_DATA.trim(), { header: true }).data as any[];
const deliveryRows = Papa.parse(DELIVERY_DATA.trim(), { header: true }).data as any[];

console.log(`Loaded ${pricingRows.length} pricing rows, ${poLineRows.length} PO lines, ${deliveryRows.length} deliveries.`);

// Check Gsp_094, Gsp_142, Gsp_148 AVP buy prices
const checkSkus = ['Gsp_094', 'Gsp_142', 'Gsp_148', 'Gsp_117', 'Gsp_150'];
for (const sku of checkSkus) {
  const rec = findPriceRecord(pricingRows, sku);
  if (!rec) {
    console.error(`FAIL: findPriceRecord could not find ${sku}`);
  } else {
    const buyPrice = getBuyPriceFromRecord(rec);
    const sellPrice = getSellPriceFromRecord(rec);
    console.log(`PASS: ${sku} -> BuyPrice: ${buyPrice}, SellPrice: ${sellPrice}, Code: ${rec['Mã giá bán']}`);
    if (buyPrice === 0) {
      console.error(`FAIL: ${sku} buyPrice is 0! Expected AVP/Cost price.`);
    }
  }
}

console.log('\n=== 3. TESTING calculatePOLineFinances ===');
for (const line of poLineRows.slice(0, 5)) {
  const finances = calculatePOLineFinances(line, pricingRows);
  console.log(`PO Line ${line['STT']} (${line['Tên sản phẩm']}): Revenue=${finances.revenue}, Profit=${finances.profit}, Margin=${finances.margin.toFixed(2)}%, PriceCode=${finances.priceCode}`);
  if (isNaN(finances.revenue) || isNaN(finances.profit) || isNaN(finances.margin)) {
    console.error(`FAIL: NaN detected in PO Line ${line['STT']}`);
  }
}

console.log('\n=== 4. TESTING calculateDeliveryFinances ===');
for (const del of deliveryRows.slice(0, 5)) {
  const finances = calculateDeliveryFinances(del, pricingRows, poLineRows);
  console.log(`Delivery ${del['STT']} (PO: ${del['Đơn hàng']}, ${del['Tên sản phẩm']}): Revenue=${finances.revenue}, Profit=${finances.profit}, Margin=${finances.margin.toFixed(2)}%, PriceCode=${finances.priceCode}`);
  if (isNaN(finances.revenue) || isNaN(finances.profit) || isNaN(finances.margin)) {
    console.error(`FAIL: NaN detected in Delivery ${del['STT']}`);
  }
}

console.log('\n=== 5. TESTING PO 26/KHVT/0547 and 26/KHVT/0600 MATCHING ===');
const po547Lines = poLineRows.filter(l => l['Số đơn hàng'] === '26/KHVT/0547');
const po547Deliveries = deliveryRows.filter(d => d['Đơn hàng'] === '26/KHVT/0547');
console.log(`PO 26/KHVT/0547 -> ${po547Lines.length} PO lines, ${po547Deliveries.length} deliveries.`);

const po600Lines = poLineRows.filter(l => l['Số đơn hàng'] === '26/KHVT/0600');
const po600Deliveries = deliveryRows.filter(d => d['Đơn hàng'] === '26/KHVT/0600');
console.log(`PO 26/KHVT/0600 -> ${po600Lines.length} PO lines, ${po600Deliveries.length} deliveries.`);

if (po547Lines.length === 3 && po547Deliveries.length === 1 && po600Lines.length === 1 && po600Deliveries.length === 4) {
  console.log('PASS: PO 547 and PO 600 datasets link perfectly with 0 whitespace issues!');
} else {
  console.error('FAIL: Dataset counts do not match expected!');
}

console.log('\nALL VERIFICATION CHECKS COMPLETE.');
