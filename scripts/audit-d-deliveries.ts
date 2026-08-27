import Papa from 'papaparse';
import {
  parseNumber
} from '../src/lib/business-logic';
import {
  DELIVERY_DATA,
  PO_LINES_DATA
} from '../src/data';

const poLineRows = Papa.parse(PO_LINES_DATA.trim(), { header: true, skipEmptyLines: true }).data as any[];
const deliveryRows = Papa.parse(DELIVERY_DATA.trim(), { header: true, skipEmptyLines: true }).data as any[];

const dRowsWithPoDetail = deliveryRows.filter(d => d['Chi tiết đơn hàng'] && d['Chi tiết đơn hàng'].startsWith('D_'));
console.log(`Total delivery rows with 'Chi tiết đơn hàng' starting with 'D_': ${dRowsWithPoDetail.length}`);

for (const d of dRowsWithPoDetail) {
  console.log(`STT: ${d['STT'].padEnd(5)} | PXK: ${d['Số PXK'].padEnd(10)} | ChiTiet: ${d['Chi tiết đơn hàng'].padEnd(6)} | PO: ${d['Đơn hàng'].padEnd(16)} | KH: ${d['Khách hàng'].padEnd(12)} | SP: ${d['Tên sản phẩm'].padEnd(45)} | Qty: ${d['Số lượng giao'].padEnd(8)} | Rev: ${d['Doanh thu']}`);
}
