import Papa from 'papaparse';
import {
  parseNumber,
  calculateDeliveryFinances
} from '../src/lib/business-logic';
import {
  PRICING_DATA,
  PO_LINES_DATA,
  DELIVERY_DATA,
  SUPPLIER_DATA
} from '../src/data';

const pricingRows = Papa.parse(PRICING_DATA.trim(), { header: true, skipEmptyLines: true }).data as any[];
const poLineRows = Papa.parse(PO_LINES_DATA.trim(), { header: true, skipEmptyLines: true }).data as any[];
const deliveryRows = Papa.parse(DELIVERY_DATA.trim(), { header: true, skipEmptyLines: true }).data as any[];

const map = new Map<string, {name: string, rawName: string, revenue: number, profit: number, volume: number, count: number, isSelfManufactured: boolean}>();

deliveryRows.forEach(d => {
  const supplierRaw = d["Nhà cung cấp"] || "Khác";
  const isTS = supplierRaw.toLowerCase().includes("tâm sen") || supplierRaw.toLowerCase().includes("tam sen") || supplierRaw.toLowerCase() === "tsg";
  const displayName = isTS ? "Tâm Sen (Tự SX)" : (supplierRaw === "Khác" ? "Khác" : `${supplierRaw} (NCC)`);
  const fin = calculateDeliveryFinances(d, pricingRows, poLineRows);
  const rev = fin.revenue;
  const prof = fin.profit;
  const vol = parseNumber(d["Số lượng giao"]);

  if (!map.has(displayName)) map.set(displayName, { name: displayName, rawName: supplierRaw, revenue: 0, profit: 0, volume: 0, count: 0, isSelfManufactured: isTS });
  const item = map.get(displayName)!;
  item.revenue += rev;
  item.profit += prof;
  item.volume += vol;
  item.count += 1;
});

const sortedSuppliers = Array.from(map.values()).sort((a,b) => b.revenue - a.revenue);
console.log('=== SUPPLIER & SOURCE STATS BREAKDOWN ===');
for (const s of sortedSuppliers) {
  console.log(`- Source: ${s.name.padEnd(20)} | Role: ${s.isSelfManufactured ? 'TỰ SẢN XUẤT (NỘI BỘ)' : 'ĐỐI TÁC NGOÀI'} | Vouchers: ${String(s.count).padStart(5)} | Revenue: ${s.revenue.toLocaleString('vi-VN').padStart(18)} ₫ | Profit: ${s.profit.toLocaleString('vi-VN').padStart(18)} ₫`);
}
