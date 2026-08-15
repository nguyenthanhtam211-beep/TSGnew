const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const summariesCode = `  const summaries = useMemo(() => {
    if (!data || data.length === 0) return null;
    
    const moneyCols = headers.filter(h => h.includes('Tổng giá trị') || h.includes('Doanh thu') || h.includes('Thành tiền') || h.includes('Lợi nhuận dòng'));
    const statusCols = headers.filter(h => h === 'Trạng Thái' || h === 'Status' || h === 'Trạng thái');

    const metrics: { label: string; value: string | number }[] = [];
    
    metrics.push({ label: 'Tổng số bản ghi', value: filteredData.length });

    moneyCols.forEach(col => {
       const sum = filteredData.reduce((acc, row) => {
         const val = row[col];
         if (val != null) {
            const num = parseFloat(String(val).replace(/,/g, ''));
            if (!isNaN(num)) return acc + num;
         }
         return acc;
       }, 0);
       
       if (sum > 0) {
         metrics.push({ label: \`Tổng \${col}\`, value: new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(sum) });
       }
    });

    statusCols.forEach(col => {
       let completed = 0;
       filteredData.forEach(row => {
          const val = String(row[col] || '');
          if (val === 'Hoàn thành' || val === 'Đã giao' || val === 'Hoàn tất') completed++;
       });
       if (completed > 0) {
          metrics.push({ label: \`Đã hoàn thành\`, value: \`\${completed} / \${filteredData.length}\` });
       }
    });

    return metrics.slice(0, 4);
  }, [data, headers, filteredData]);`;

if (code.includes(summariesCode)) {
  code = code.replace(summariesCode, ""); // remove it from current location

  // insert it after getUniqueValuesForColumn block
  const targetAnchor = `  const getUniqueValuesForColumn = (column: string) => {
    const values = new Set<string>();
    data.forEach(row => {
      if (row[column] != null) {
        values.add(String(row[column]));
      } else {
        values.add(""); // handle empty/null
      }
    });
    return Array.from(values).sort();
  };`;

  if (code.includes(targetAnchor)) {
    code = code.replace(targetAnchor, targetAnchor + "\\n\\n" + summariesCode);
    fs.writeFileSync('src/App.tsx', code);
    console.log("Patched successfully");
  } else {
    console.log("targetAnchor not found");
  }
} else {
  console.log("summariesCode not found");
}

