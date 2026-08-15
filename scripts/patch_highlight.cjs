const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const anchor = `  const [activeFilterColumn, setActiveFilterColumn] = useState<string | null>(null);`;
const addition = `
  const prevDataRef = useRef<any[]>(data);
  const [highlightedRowIds, setHighlightedRowIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const prevData = prevDataRef.current;
    if (prevData !== data) {
      if (prevData && prevData.length > 0) {
        const newHighlighted = new Set<string>();
        const prevMap = new Map(prevData.map((r, i) => [r.id || JSON.stringify(r), r]));
        
        data.forEach((row, i) => {
           const id = row.id || JSON.stringify(row);
           const prevRow = prevMap.get(id);
           
           if (!prevRow) {
              newHighlighted.add(id);
           } else {
              if (JSON.stringify(prevRow) !== JSON.stringify(row)) {
                 newHighlighted.add(id);
              }
           }
        });
        
        if (newHighlighted.size > 0) {
           setHighlightedRowIds(prev => {
              const next = new Set(prev);
              newHighlighted.forEach(id => next.add(id));
              return next;
           });
           setTimeout(() => {
              setHighlightedRowIds(prev => {
                 const next = new Set(prev);
                 newHighlighted.forEach(id => next.delete(id));
                 return next;
              });
           }, 10000);
        }
      }
      prevDataRef.current = data;
    }
  }, [data]);
`;

if (code.includes(anchor)) {
  code = code.replace(anchor, anchor + "\\n" + addition);
}

const trAnchor = `<tr key={i} className="hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0 group/tr">`;
const trReplacement = `{(() => {
                  const rowId = row.id || JSON.stringify(row);
                  const isHighlighted = highlightedRowIds.has(rowId);
                  return (
                    <tr key={i} className={\`transition-all duration-1000 border-b border-gray-100 last:border-0 group/tr \${isHighlighted ? 'bg-green-50 hover:bg-green-100' : 'hover:bg-gray-50'}\`}>
                      {visibleColumns.map((h, idx) => (
                        <td 
                          key={h} 
                          className={\`px-4 py-3 align-middle \${idx === 0 ? \`sticky left-0 shadow-[1px_0_0_0_#f3f4f6] z-[5] transition-colors \${isHighlighted ? 'bg-green-50 group-hover/tr:bg-green-100' : 'bg-white group-hover/tr:bg-gray-50'}\` : ''}\`}
                        >
                          {renderCell(h, row[h])}
                        </td>
                      ))}
                    </tr>
                  );
                })()}`;

// We need to replace the exact block:
const oldTrBlock = `{filteredData.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0 group/tr">
                  {visibleColumns.map((h, idx) => (
                    <td 
                      key={h} 
                      className={\`px-4 py-3 align-middle \${idx === 0 ? 'sticky left-0 bg-white shadow-[1px_0_0_0_#f3f4f6] z-[5] group-hover/tr:bg-gray-50 transition-colors' : ''}\`}
                    >
                      {renderCell(h, row[h])}
                    </td>
                  ))}
                </tr>
              ))}`;

const newTrBlock = `{filteredData.map((row, i) => {
                const rowId = row.id || JSON.stringify(row);
                const isHighlighted = highlightedRowIds.has(rowId);
                return (
                  <tr key={i} className={\`transition-all duration-1000 border-b border-gray-100 last:border-0 group/tr \${isHighlighted ? 'bg-amber-100/50 hover:bg-amber-100/70' : 'hover:bg-gray-50'}\`}>
                    {visibleColumns.map((h, idx) => (
                      <td 
                        key={h} 
                        className={\`px-4 py-3 align-middle \${idx === 0 ? \`sticky left-0 shadow-[1px_0_0_0_#f3f4f6] z-[5] transition-colors \${isHighlighted ? 'bg-[#fef3c7]/50 group-hover/tr:bg-[#fef3c7]/70' : 'bg-white group-hover/tr:bg-gray-50'}\` : ''}\`}
                      >
                        {renderCell(h, row[h])}
                      </td>
                    ))}
                  </tr>
                );
              })}`;

if (code.includes('className="hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0 group/tr"')) {
  code = code.replace(oldTrBlock, newTrBlock);
}

fs.writeFileSync('src/App.tsx', code);
