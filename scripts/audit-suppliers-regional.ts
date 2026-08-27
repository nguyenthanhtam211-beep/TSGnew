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

const norm = (t: string) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
const isNorth = (c: string) => {
  const n = norm(c);
  return n.includes('thang long') || n.includes('thanh hoa') || n.includes('bac son');
};

const northDeliveries = deliveryRows.filter(d => isNorth(d['Khách hàng'] || ''));
const southDeliveries = deliveryRows.filter(d => !isNorth(d['Khách hàng'] || ''));

console.log('=== NORTH SCOPE SUPPLIERS (52 VOUCHERS) ===');
const northMap = new Map<string, { count: number; rev: number; profit: number }>();
northDeliveries.forEach(d => {
  const s = d['Nhà cung cấp'] || 'Khác';
  const fin = calculateDeliveryFinances(d, pricingRows, poLineRows);
  if (!northMap.has(s)) northMap.set(s, { count: 0, rev: 0, profit: 0 });
  const item = northMap.get(s)!;
  item.count++;
  item.rev += fin.revenue;
  item.profit += fin.profit;
});
for (const [s, data] of northMap.entries()) {
  console.log(`- ${s}: ${data.count} vouchers | Revenue: ${data.rev.toLocaleString('vi-VN')} ₫ | Profit: ${data.profit.toLocaleString('vi-VN')} ₫`);
}

console.log('\n=== SOUTH SCOPE SUPPLIERS (1056 VOUCHERS) ===');
const southMap = new Map<string, { count: number; rev: number; profit: number }>();
southDeliveries.forEach(d => {
  const s = d['Nhà cung cấp'] || 'Khác';
  const fin = calculateDeliveryFinances(d, pricingRows, poLineRows);
  if (!southMap.has(s)) southMap.set(s, { count: 0, rev: 0, profit: 0 });
  const item = southMap.get(s)!;
  item.count++;
  item.rev += fin.revenue;
  item.profit += fin.profit;
});
for (const [s, data] of southMap.entries()) {
  console.log(`- ${s}: ${data.count} vouchers | Revenue: ${data.rev.toLocaleString('vi-VN')} ₫ | Profit: ${data.profit.toLocaleString('vi-VN')} ₫`);
}
