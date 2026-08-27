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

console.log('=== PO LINE FULFILLMENT AUDIT BY STT ===');
let totalOrderedVal = 0;
let totalDeliveredVal = 0;
let totalRemainingVal = 0;

let linesWithRemaining = [];

for (const line of poLineRows) {
  const lineId = line['STT'];
  const poNum = line['Số đơn hàng'];
  const prodName = line['Tên sản phẩm'];
  const qtyOrdered = parseNumber(line['Số lượng']);
  const unitPrice = parseNumber(line['Đơn giá bán']) || (parseNumber(line['Thành tiền dòng']) / qtyOrdered);

  const matchedDeliveries = deliveryRows.filter(d => !d.isDeleted && d['Chi tiết đơn hàng'] === lineId);
  const qtyDelivered = matchedDeliveries.reduce((sum, d) => sum + parseNumber(d['Số lượng giao'] ?? d['Số lượng']), 0);
  const qtyRemaining = Math.max(0, qtyOrdered - qtyDelivered);
  
  const orderedVal = parseNumber(line['Thành tiền dòng']) || (qtyOrdered * unitPrice);
  const deliveredVal = qtyDelivered * unitPrice;
  const remainingVal = qtyRemaining * unitPrice;

  totalOrderedVal += orderedVal;
  totalDeliveredVal += deliveredVal;
  totalRemainingVal += remainingVal;

  const isFulfilled = qtyDelivered >= qtyOrdered;
  if (!isFulfilled) {
    linesWithRemaining.push({
      lineId,
      poNum,
      prodName,
      qtyOrdered,
      qtyDelivered,
      qtyRemaining,
      unitPrice,
      remainingVal
    });
  }

  console.log(`STT: ${lineId.padEnd(6)} | PO: ${poNum.padEnd(16)} | Ordered: ${String(qtyOrdered).padStart(8)} | Delivered: ${String(qtyDelivered).padStart(8)} | Rem: ${String(qtyRemaining).padStart(8)} | UnitPrice: ${unitPrice.toLocaleString('vi-VN').padStart(10)} | RemVal: ${remainingVal.toLocaleString('vi-VN').padStart(15)} ₫ | Matched Vouchers: ${matchedDeliveries.length}`);
}

console.log('\n=== SUMMARY OF PO LINES WITH REMAINING QUANTITY ===');
let sumRemVal = 0;
for (const l of linesWithRemaining) {
  console.log(`- STT: ${l.lineId} | PO: ${l.poNum} | SP: ${l.prodName} | Ordered: ${l.qtyOrdered} | Delivered: ${l.qtyDelivered} | Remaining: ${l.qtyRemaining} | Price: ${l.unitPrice.toLocaleString('vi-VN')} | RemValue: ${l.remainingVal.toLocaleString('vi-VN')} ₫`);
  sumRemVal += l.remainingVal;
}

console.log(`\nTotal Expected Remaining PO Value (Chỉ tiêu Doanh thu dự kiến PO còn lại): ${sumRemVal.toLocaleString('vi-VN')} ₫ (Target: 458.712.729 ₫)`);
