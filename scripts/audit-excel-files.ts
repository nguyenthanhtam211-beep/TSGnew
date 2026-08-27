import XLSX from 'xlsx';
import fs from 'fs';

console.log('=== CHECKING EXCEL FILES ===');
if (fs.existsSync('factory_sheet.xlsx')) {
  const buf = fs.readFileSync('factory_sheet.xlsx');
  const wb = XLSX.read(buf, { type: 'buffer' });
  console.log('factory_sheet.xlsx sheets:', wb.SheetNames);
}
if (fs.existsSync('scratch_sheet.xlsx')) {
  const buf = fs.readFileSync('scratch_sheet.xlsx');
  const wb = XLSX.read(buf, { type: 'buffer' });
  console.log('scratch_sheet.xlsx sheets:', wb.SheetNames);
  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name];
    const data = XLSX.utils.sheet_to_json(sheet);
    console.log(`Sheet "${name}" rows: ${data.length}`);
    if (data.length > 0) {
      console.log(`Sample keys for "${name}":`, Object.keys(data[0] as any).slice(0, 8));
    }
  }
}
