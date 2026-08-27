import fs from 'fs';

const acc = JSON.parse(fs.readFileSync('src/data/accounting_imported.json', 'utf8'));

console.log('=== ACCOUNTING INVOICES SUMMARY BY CUSTOMER ===');
const custMap: Record<string, { count: number; rev: number; cogs: number; profit: number }> = {};

for (const inv of acc.invoices) {
  const cust = inv['Khách hàng'] || 'Khác';
  if (!custMap[cust]) {
    custMap[cust] = { count: 0, rev: 0, cogs: 0, profit: 0 };
  }
  custMap[cust].count++;
  custMap[cust].rev += Number(inv['Doanh thu']) || 0;
  custMap[cust].cogs += Number(inv['Giá vốn']) || 0;
  custMap[cust].profit += Number(inv['Lợi nhuận gộp']) || 0;
}

for (const [c, d] of Object.entries(custMap)) {
  console.log(`- Customer: "${c}" | Count: ${d.count} | Rev: ${d.rev.toLocaleString('vi-VN')} ₫ | COGS: ${d.cogs.toLocaleString('vi-VN')} ₫ | Profit: ${d.profit.toLocaleString('vi-VN')} ₫`);
}
