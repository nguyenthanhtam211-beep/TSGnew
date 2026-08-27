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

const norm = (t: string) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
const isNorth = (c: string) => {
  const n = norm(c);
  return n.includes('thang long') || n.includes('thanh hoa') || n.includes('bac son');
};
const northDeliveries = deliveryRows.filter(d => isNorth(d['Khách hàng'] || ''));

console.log('=== NORTH PO LINES vs NORTH DELIVERIES MATCHING ===');
console.log(`North PO Lines: ${poLineRows.length}`);
console.log(`North Deliveries: ${northDeliveries.length}`);

let totalOrderedVal = 0;
let totalDeliveredVal = 0;
let totalRemainingVal = 0;

for (const line of poLineRows) {
  const linePoNum = (line['Số đơn hàng'] || '').trim();
  const lineProdName = line['Tên sản phẩm'];
  const lineId = line['STT'];
  const qtyOrdered = parseNumber(line['Số lượng']);
  const unitSellPrice = parseNumber(line['Đơn giá bán']) || (parseNumber(line['Thành tiền dòng']) / qtyOrdered);

  // Match ONLY North deliveries for this PO and this product
  // Method 1: Match by PO Number and Product
  const matchingDeliveries = northDeliveries.filter(d => {
    const dPo = (d['Đơn hàng'] || '').trim();
    if (dPo !== linePoNum) return false;

    // Check product match
    const dProd = d['Tên sản phẩm'] || '';
    const dSku = d['Mã sản phẩm'] || '';
    const lSku = line['Mã của khách'] || line['Mã sản phẩm'] || line['Mã giá bán'] || '';
    
    return norm(dProd) === norm(lineProdName) || 
           dProd.includes(lineProdName) || 
           lineProdName.includes(dProd) ||
           (dSku && lSku && dSku === lSku) ||
           d['Chi tiết đơn hàng'] === lineId;
  });

  const qtyDelivered = matchingDeliveries.reduce((sum, d) => sum + parseNumber(d['Số lượng giao'] ?? d['Số lượng']), 0);
  const qtyRemaining = Math.max(0, qtyOrdered - qtyDelivered);
  
  const orderedVal = qtyOrdered * unitSellPrice;
  const deliveredVal = qtyDelivered * unitSellPrice;
  const remainingVal = qtyRemaining * unitSellPrice;

  totalOrderedVal += orderedVal;
  totalDeliveredVal += deliveredVal;
  totalRemainingVal += remainingVal;

  console.log(`PO: ${linePoNum.padEnd(16)} | Line ${lineId.padEnd(6)} | Ordered: ${String(qtyOrdered).padStart(8)} | Delivered: ${String(qtyDelivered).padStart(8)} | RemQty: ${String(qtyRemaining).padStart(8)} | Price: ${unitSellPrice.toLocaleString('vi-VN').padStart(10)} | RemVal: ${remainingVal.toLocaleString('vi-VN').padStart(15)} ₫ | Vouchers: ${matchingDeliveries.length}`);
}

console.log(`\nTotal North PO Ordered Value:   ${totalOrderedVal.toLocaleString('vi-VN')} ₫`);
console.log(`Total North PO Delivered Value: ${totalDeliveredVal.toLocaleString('vi-VN')} ₫`);
console.log(`Total North PO Remaining Value: ${totalRemainingVal.toLocaleString('vi-VN')} ₫ (Target: 458.712.729 ₫)`);
