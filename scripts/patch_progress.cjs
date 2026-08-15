const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const oldProgress = `    // Progress percentage
    if (header === 'Tiến độ giao' || header === 'Tiến độ sản phẩm' || header.includes('% Lợi nhuận')) {
      const isPercent = strVal.includes('%');
      const num = parseFloat(strVal.replace(/,/g, '').replace(/%/g, ''));
      if (!isNaN(num)) {
         return (
            <div className="flex items-center gap-2">
              <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                 <div className={\`h-full \${num >= 100 ? 'bg-green-500' : 'bg-blue-500'}\`} style={{ width: \`\${Math.min(100, num)}%\` }}></div>
              </div>
              <span className="text-xs font-medium text-gray-700">{strVal}</span>
            </div>
         );
      }
    }`;

const newProgress = `    // Progress percentage
    if (header === 'Tiến độ' || header === 'Tiến độ giao' || header === 'Tiến độ sản phẩm' || header.includes('% Lợi nhuận')) {
      const isPercent = strVal.includes('%');
      const num = parseFloat(strVal.replace(/,/g, '').replace(/%/g, ''));
      if (!isNaN(num)) {
         return (
            <div className="flex items-center gap-2">
              <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                 <div className={\`h-full \${num >= 100 ? 'bg-green-500' : 'bg-orange-500'}\`} style={{ width: \`\${Math.min(100, num)}%\` }}></div>
              </div>
              <span className="text-xs font-medium text-gray-700">{strVal}</span>
            </div>
         );
      }
    }`;

if (code.includes(oldProgress)) {
  code = code.replace(oldProgress, newProgress);
  fs.writeFileSync('src/App.tsx', code);
  console.log("Patched successfully");
} else {
  console.log("Not found");
}
