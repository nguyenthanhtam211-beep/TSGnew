import Papa from 'papaparse';
import {
  parseNumber,
  calculatePOLineFinances,
  calculateDeliveryFinances
} from '../src/lib/business-logic';
import {
  PRICING_DATA,
  PO_HEADER_DATA,
  PO_LINES_DATA,
  DELIVERY_DATA
} from '../src/data';

const pricingRows = Papa.parse(PRICING_DATA.trim(), { header: true, skipEmptyLines: true }).data as any[];
const poHeaderRows = Papa.parse(PO_HEADER_DATA.trim(), { header: true, skipEmptyLines: true }).data as any[];
const poLineRows = Papa.parse(PO_LINES_DATA.trim(), { header: true, skipEmptyLines: true }).data as any[];
const deliveryRows = Papa.parse(DELIVERY_DATA.trim(), { header: true, skipEmptyLines: true }).data as any[];

console.log('=== PO LINES AND DELIVERY LINKAGE INSPECTION ===');
for (const pl of poLineRows) {
  console.log(`PO Line STT: ${pl['STT']} | PO: "${pl['Số đơn hàng']}" | SP: "${pl['Tên sản phẩm']}" | Qty: ${pl['Số lượng']} | Price: ${pl['Đơn giá bán']} | Total: ${pl['Thành tiền dòng']}`);
}

console.log('\n=== NORTH DELIVERIES INSPECTION (52 VOUCHERS) ===');
const norm = (t: string) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
const isNorth = (c: string) => {
  const n = norm(c);
  return n.includes('thang long') || n.includes('thanh hoa') || n.includes('bac son');
};
const northDeliveries = deliveryRows.filter(d => isNorth(d['Khách hàng'] || ''));

console.log(`Found ${northDeliveries.length} North deliveries.`);
for (const nd of northDeliveries) {
  console.log(`STT: ${nd['STT']} | Chi tiết đơn hàng: "${nd['Chi tiết đơn hàng']}" | Đơn hàng: "${nd['Đơn hàng']}" | SP: "${nd['Tên sản phẩm']}" | Qty: ${nd['Số lượng giao']} | Rev: ${nd['Doanh thu']}`);
}
