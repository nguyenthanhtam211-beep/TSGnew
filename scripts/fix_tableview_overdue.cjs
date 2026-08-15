const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

if (!content.includes('AlertTriangle')) {
    content = content.replace('X, Filter', 'X, Filter, AlertTriangle');
}
if (!content.includes('parse, isBefore, startOfDay')) {
    content = content.replace('import { db } from "./firebase";', 'import { parse, isBefore, startOfDay } from "date-fns";\nimport { db } from "./firebase";');
}

// Update the TR rendering
let oldTrStart = `            <tbody>
              {paginatedData.map((row, i) => {
                const rowId = row.id || JSON.stringify(row);
                const isHighlighted = highlightedRowIds.has(rowId);
                return (
                  <tr key={i} className={\`transition-all duration-1000 border-b border-gray-100 last:border-0 group/tr \${isHighlighted ? 'bg-amber-100/50 hover:bg-amber-100/70' : 'hover:bg-gray-50'}\`}>
                    {visibleColumns.map((h, idx) => (`;

let newTrStart = `            <tbody>
              {paginatedData.map((row, i) => {
                const rowId = row.id || JSON.stringify(row);
                const isHighlighted = highlightedRowIds.has(rowId);
                
                // Overdue check
                let isOverdue = false;
                if (row['Ngày giao']) {
                    try {
                        const dateStr = String(row['Ngày giao']);
                        // Parse dd/MM/yyyy
                        const parsedDate = parse(dateStr.split(' ')[0], 'dd/MM/yyyy', new Date());
                        if (!isNaN(parsedDate.getTime())) {
                            if (isBefore(parsedDate, startOfDay(new Date()))) {
                                const status = String(row['Trạng Thái'] || row['Status'] || row['Trạng thái'] || '');
                                const completedStatuses = ['Hoàn thành', 'Đã giao', 'Hoàn tất', 'Hủy', 'Đã hủy'];
                                if (!completedStatuses.includes(status)) {
                                    isOverdue = true;
                                }
                            }
                        }
                    } catch (e) {}
                }
                
                const rowClass = isOverdue 
                    ? 'bg-red-50 hover:bg-red-100' 
                    : (isHighlighted ? 'bg-amber-100/50 hover:bg-amber-100/70' : 'hover:bg-gray-50');

                return (
                  <tr key={i} className={\`transition-all duration-1000 border-b border-gray-100 last:border-0 group/tr \${rowClass}\`}>
                    {visibleColumns.map((h, idx) => (`;

content = content.replace(oldTrStart, newTrStart);

// Also we need to add the warning icon in the "Ngày giao" column or somewhere.
// Let's modify renderCell slightly:
let oldRenderCellDate = `    // Date
    if (header.includes('Ngày') || header.includes('Thời gian')) {
       return <span className="text-gray-600">{strVal}</span>;
    }`;

let newRenderCellDate = `    // Date
    if (header.includes('Ngày') || header.includes('Thời gian')) {
       if (header === 'Ngày giao') {
         // Re-check overdue just for this cell to show icon
         let isOverdue = false;
         try {
             const parsedDate = parse(strVal.split(' ')[0], 'dd/MM/yyyy', new Date());
             if (!isNaN(parsedDate.getTime()) && isBefore(parsedDate, startOfDay(new Date()))) {
                 const status = String(value?.['Trạng Thái'] || value?.['Status'] || value?.['Trạng thái'] || '');
                 // Wait, renderCell only gets the string value of the cell, not the whole row.
                 // We need to pass row to renderCell to check status.
             }
         } catch(e) {}
       }
       return <span className="text-gray-600">{strVal}</span>;
    }`;
// Actually, it's easier to just pass the whole row to renderCell, or check the overdue state at the row level and render the icon if isOverdue and column is 'Ngày giao'.
// Let's modify the <td> content instead of renderCell.

let oldTd = `                      <td 
                        key={h} 
                        className={\`px-4 py-3 align-middle \${idx === 0 ? \`sticky left-0 shadow-[1px_0_0_0_#f3f4f6] z-[5] transition-colors \${isHighlighted ? 'bg-[#fef3c7]/50 group-hover/tr:bg-[#fef3c7]/70' : 'bg-white group-hover/tr:bg-gray-50'}\` : ''}\`}
                      >
                        {renderCell(h, row[h])}
                      </td>`;

let newTd = `                      <td 
                        key={h} 
                        className={\`px-4 py-3 align-middle \${idx === 0 ? \`sticky left-0 shadow-[1px_0_0_0_#f3f4f6] z-[5] transition-colors \${isOverdue ? 'bg-red-50 group-hover/tr:bg-red-100' : isHighlighted ? 'bg-[#fef3c7]/50 group-hover/tr:bg-[#fef3c7]/70' : 'bg-white group-hover/tr:bg-gray-50'}\` : ''}\`}
                      >
                        <div className="flex items-center gap-2">
                           {renderCell(h, row[h])}
                           {h === 'Ngày giao' && isOverdue && (
                               <AlertTriangle size={16} className="text-red-500" title="Quá hạn giao hàng" />
                           )}
                        </div>
                      </td>`;

content = content.replace(oldTd, newTd);

fs.writeFileSync('src/App.tsx', content);
