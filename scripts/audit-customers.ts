import Papa from 'papaparse';
import {
  parseNumber,
  calculateDeliveryFinances
} from '../src/lib/business-logic';
import {
  PRICING_DATA,
  PO_LINES_DATA,
  DELIVERY_DATA
} from '../src/data';

const pricingRows = Papa.parse(PRICING_DATA.trim(), { header: true, skipEmptyLines: true }).data as any[];
const poLineRows = Papa.parse(PO_LINES_DATA.trim(), { header: true, skipEmptyLines: true }).data as any[];
const deliveryRows = Papa.parse(DELIVERY_DATA.trim(), { header: true, skipEmptyLines: true }).data as any[];

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

console.log('=== CUSTOMER SUMMARY TABLE ===');
for (const [cust, data] of Object.entries(customerCounts)) {
  console.log(`Customer: "${cust}" | Count: ${data.count} | Revenue: ${data.rev.toLocaleString('vi-VN')} ₫ | COGS: ${data.cogs.toLocaleString('vi-VN')} ₫ | Profit: ${data.profit.toLocaleString('vi-VN')} ₫`);
}

// Check unclassified or other customers
const norm = (t: string) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
const isNorth = (c: string) => {
  const n = norm(c);
  return n.includes('thang long') || n.includes('thanh hoa') || n.includes('bac son');
};
const isSouth = (c: string) => {
  const n = norm(c);
  return n.includes('ben tre') || n.includes('sai gon') || n.includes('quoc dai');
};

const unclassified = deliveryRows.filter(d => !isNorth(d['Khách hàng'] || '') && !isSouth(d['Khách hàng'] || ''));
console.log('\n=== UNCLASSIFIED DELIVERIES ===');
unclassified.forEach(d => {
  const fin = calculateDeliveryFinances(d, pricingRows, poLineRows);
  console.log(`STT: ${d['STT']} | PXK: ${d['Số PXK']} | PO: ${d['Đơn hàng']} | KH: "${d['Khách hàng']}" | SP: ${d['Tên sản phẩm']} | Rev: ${fin.revenue.toLocaleString('vi-VN')} ₫ | COGS: ${(fin.revenue - fin.profit).toLocaleString('vi-VN')} ₫`);
});
