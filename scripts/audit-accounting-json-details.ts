import fs from 'fs';

const acc = JSON.parse(fs.readFileSync('src/data/accounting_imported.json', 'utf8'));

console.log('=== ACCOUNTING POS SAMPLE ===');
console.log(acc.pos.slice(0, 3));

console.log('\n=== ACCOUNTING INVOICES SAMPLE ===');
console.log(acc.invoices.slice(0, 3));

// Check total revenue in accounting invoices
let totalAccRev = 0;
let northAccRev = 0;
let southAccRev = 0;

for (const inv of acc.invoices) {
  const amount = Number(inv.amount) || Number(inv['Thành tiền']) || Number(inv['Doanh thu']) || 0;
  totalAccRev += amount;
  const cust = String(inv.customer || inv['Khách hàng'] || '');
  if (cust.includes('Thăng Long') || cust.includes('Thanh Hóa') || cust.includes('Bắc Sơn')) {
    northAccRev += amount;
  } else {
    southAccRev += amount;
  }
}

console.log(`\nInvoices count: ${acc.invoices.length}`);
console.log(`Total Accounting Invoice Amount: ${totalAccRev.toLocaleString('vi-VN')} ₫`);
console.log(`North Invoice Amount: ${northAccRev.toLocaleString('vi-VN')} ₫`);
console.log(`South Invoice Amount: ${southAccRev.toLocaleString('vi-VN')} ₫`);
