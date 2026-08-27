import Papa from 'papaparse';
import fs from 'fs';
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

console.log('=== DEEP DIVE AUDIT ===');
const pricingRows = Papa.parse(PRICING_DATA.trim(), { header: true, skipEmptyLines: true }).data as any[];
const poHeaderRows = Papa.parse(PO_HEADER_DATA.trim(), { header: true, skipEmptyLines: true }).data as any[];
const poLineRows = Papa.parse(PO_LINES_DATA.trim(), { header: true, skipEmptyLines: true }).data as any[];
const deliveryRows = Papa.parse(DELIVERY_DATA.trim(), { header: true, skipEmptyLines: true }).data as any[];
const customerRows = Papa.parse(CUSTOMER_DATA.trim(), { header: true, skipEmptyLines: true }).data as any[];

const norm = (t: string) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

// 1. Check all customers in DELIVERY_DATA
const customerCounts: Record<string, { count: number; rev: number; cogs: number; profit: number }> = {};

for (const d of deliveryRows) {
  const cust = d['Khách hàng'] || d['Tên khách hàng'] || 'KHÔNG RÕ';
  if (!customerCounts[cust]) {
    customerCounts[cust] = { count: 0, rev: 0, cogs: 0, profit: 0 };
  }
  const fin = calculateDeliveryFinances(d, pricingRows, poLineRows);
  customerCounts[cust].count++;
  customerCounts[cust].rev += fin.revenue;
  customerCounts[cust].profit += fin.profit;
  customerCounts[cust].cogs += (fin.revenue - fin.profit);
}

console.log('\n--- CUSTOMER BREAKDOWN IN DELIVERY_DATA ---');
let grandTotalRev = 0;
let grandTotalCount = 0;
let grandTotalCogs = 0;
let grandTotalProfit = 0;

for (const [cust, data] of Object.entries(customerCounts)) {
  console.log(`- ${cust}: ${data.count} vouchers | Rev: ${data.rev.toLocaleString('vi-VN')} ₫ | COGS: ${data.cogs.toLocaleString('vi-VN')} ₫ | Profit: ${data.profit.toLocaleString('vi-VN')} ₫`);
  grandTotalRev += data.rev;
  grandTotalCount += data.count;
  grandTotalCogs += data.cogs;
  grandTotalProfit += data.profit;
}

console.log(`\nGRAND TOTAL: ${grandTotalCount} vouchers | Rev: ${grandTotalRev.toLocaleString('vi-VN')} ₫ | COGS: ${grandTotalCogs.toLocaleString('vi-VN')} ₫ | Profit: ${grandTotalProfit.toLocaleString('vi-VN')} ₫`);

// 2. Check North customers vs South customers
console.log('\n--- REGIONAL AUDIT ---');
const northCustNames = ['Thăng Long', 'Thanh Hóa', 'Bắc Sơn', 'Công ty TNHH MTV Thuốc lá Thăng Long', 'Công ty TNHH MTV Thuốc lá Thanh Hoá', 'Công ty TNHH MTV Thuốc lá BẮc Sơn', 'Thuốc lá Thăng Long', 'Thuốc lá Thanh Hoá', 'Thuốc lá Bắc Sơn'];
const southCustNames = ['Bến Tre', 'Sài Gòn', 'Quốc Đại', 'Thuốc lá Bến Tre', 'Thuốc lá Sài Gòn', 'Công ty TNHH MTV Thuốc lá Sài Gòn', 'Công ty TNHH MTV Thuốc lá Bến Tre'];

const isNorth = (c: string) => {
  const n = norm(c);
  return n.includes('thang long') || n.includes('thanh hoa') || n.includes('bac son');
};

const isSouth = (c: string) => {
  const n = norm(c);
  return n.includes('ben tre') || n.includes('sai gon') || n.includes('quoc dai');
};

const northRows = deliveryRows.filter(d => isNorth(d['Khách hàng'] || ''));
const southRows = deliveryRows.filter(d => isSouth(d['Khách hàng'] || ''));
const unclassified = deliveryRows.filter(d => !isNorth(d['Khách hàng'] || '') && !isSouth(d['Khách hàng'] || ''));

console.log(`North count: ${northRows.length}`);
console.log(`South count: ${southRows.length}`);
console.log(`Unclassified count: ${unclassified.length}`);
if (unclassified.length > 0) {
  console.log('Unclassified vouchers:');
  for (const u of unclassified) {
    const fin = calculateDeliveryFinances(u, pricingRows, poLineRows);
    console.log(`  STT: ${u['STT']} | PXK: ${u['Số PXK']} | PO: ${u['Đơn hàng']} | KH: "${u['Khách hàng']}" | SP: ${u['Tên sản phẩm']} | Rev: ${fin.revenue.toLocaleString('vi-VN')}`);
  }
}

// 3. Inspect PO remaining revenue (R2)
console.log('\n--- PO & REMAINING REVENUE AUDIT (R2) ---');
console.log(`Total PO Headers: ${poHeaderRows.length}`);
console.log(`Total PO Lines: ${poLineRows.length}`);

let totalPoLineOrderedValue = 0;
let totalDeliveredValueAgainstPO = 0;
let totalRemainingPOValue = 0;

for (const line of poLineRows) {
  const lineFin = calculatePOLineFinances(line, pricingRows);
  const qtyOrdered = parseNumber(line['Số lượng']);
  const unitSellPrice = lineFin.sellPrice;
  const lineTotalValue = lineFin.revenue;
  totalPoLineOrderedValue += lineTotalValue;

  // Find deliveries for this PO line
  const matchingDeliveries = deliveryRows.filter(d => 
    !d.isDeleted && (
      (d['Chi tiết đơn hàng'] && String(d['Chi tiết đơn hàng']) === String(line['STT'])) ||
      (d['Đơn hàng'] && line['Số đơn hàng'] && String(d['Đơn hàng']).trim().toLowerCase() === String(line['Số đơn hàng']).trim().toLowerCase() && (
        norm(d['Tên sản phẩm']) === norm(line['Tên sản phẩm']) ||
        d['Mã sản phẩm'] === line['Mã sản phẩm'] ||
        d['Mã sản phẩm'] === line['Mã của khách'] ||
        d['Mã sản phẩm'] === line['Mã giá bán']
      ))
    )
  );

  const deliveredQty = matchingDeliveries.reduce((sum, d) => sum + parseNumber(d['Số lượng giao'] ?? d['Số lượng']), 0);
  const remainingQty = Math.max(0, qtyOrdered - deliveredQty);
  const deliveredValue = deliveredQty * unitSellPrice;
  const remainingValue = remainingQty * unitSellPrice;

  totalDeliveredValueAgainstPO += deliveredValue;
  totalRemainingPOValue += remainingValue;

  console.log(`PO Line STT ${line['STT']} | PO: ${line['Số đơn hàng']} | SP: ${line['Tên sản phẩm']} | Ordered: ${qtyOrdered} | Delivered: ${deliveredQty} | Remaining: ${remainingQty} | UnitPrice: ${unitSellPrice.toLocaleString('vi-VN')} | RemValue: ${remainingValue.toLocaleString('vi-VN')} ₫`);
}

console.log(`\nPO Ordered Total Value:   ${totalPoLineOrderedValue.toLocaleString('vi-VN')} ₫`);
console.log(`PO Delivered Total Value: ${totalDeliveredValueAgainstPO.toLocaleString('vi-VN')} ₫`);
console.log(`PO Remaining Total Value: ${totalRemainingPOValue.toLocaleString('vi-VN')} ₫ (Target: 458.712.729 ₫)`);

// 4. Inspect Tâm Sen Factory / Lưỡi Gà Trắng Root Cause in depth
console.log('\n--- ROOT CAUSE INVESTIGATION: LƯỠI GÀ TRẮNG COGS ---');
const tamSenDeliveries = deliveryRows.filter(d => {
  const ncc = norm(d['Nhà cung cấp'] || '');
  const sp = norm(d['Tên sản phẩm'] || '');
  return ncc.includes('tam sen') || sp.includes('luoi ga') || sp.includes('lgt');
});

console.log(`Total deliveries involving Tâm Sen or Lưỡi Gà: ${tamSenDeliveries.length}`);
let zeroCogsCount = 0;
let zeroCogsRev = 0;
let nonzeroCogsCount = 0;

for (const d of tamSenDeliveries) {
  const fin = calculateDeliveryFinances(d, pricingRows, poLineRows);
  if (fin.buyPrice === 0) {
    zeroCogsCount++;
    zeroCogsRev += fin.revenue;
    console.log(`[ZERO COGS] PXK: ${d['Số PXK']} | PO: ${d['Đơn hàng']} | KH: ${d['Khách hàng']} | SP: ${d['Tên sản phẩm']} | Qty: ${d['Số lượng giao']} | Rev: ${fin.revenue.toLocaleString('vi-VN')} ₫ | BuyPrice: ${fin.buyPrice} | SellPrice: ${fin.sellPrice}`);
  } else {
    nonzeroCogsCount++;
  }
}
console.log(`\nSummary Tâm Sen / Lưỡi Gà deliveries:`);
console.log(`- Zero COGS Deliveries: ${zeroCogsCount} (Total Revenue: ${zeroCogsRev.toLocaleString('vi-VN')} ₫)`);
console.log(`- Non-Zero COGS Deliveries: ${nonzeroCogsCount}`);

// Inspect factory_imported.json & accounting_imported.json
try {
  const accContent = fs.readFileSync('src/data/accounting_imported.json', 'utf8');
  const acc = JSON.parse(accContent);
  console.log(`\naccounting_imported.json loaded: ${Array.isArray(acc) ? acc.length : Object.keys(acc).length} records`);
  if (Array.isArray(acc) && acc.length > 0) {
    console.log(`Sample acc record keys: ${Object.keys(acc[0]).join(', ')}`);
  }
} catch (e: any) {
  console.error('Error reading accounting_imported.json:', e.message);
}

try {
  const facContent = fs.readFileSync('src/data/factory_imported.json', 'utf8');
  const fac = JSON.parse(facContent);
  console.log(`\nfactory_imported.json loaded: ${Array.isArray(fac) ? fac.length : Object.keys(fac).length} records`);
  if (Array.isArray(fac) && fac.length > 0) {
    console.log(`Sample factory record keys: ${Object.keys(fac[0]).join(', ')}`);
    console.log(`Sample factory record:`, fac[0]);
  }
} catch (e: any) {
  console.error('Error reading factory_imported.json:', e.message);
}
