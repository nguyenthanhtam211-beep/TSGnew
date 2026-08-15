const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// I'll search for the problematic block using regex and replace it
let start = code.indexOf('<table className="w-full text-left border-collapse text-sm whitespace-nowrap">');
let end = code.indexOf('{isModalOpen && (');

if (start !== -1 && end !== -1) {
    let newTable = `<table className="w-full text-left border-collapse text-sm whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-700 sticky top-0 shadow-[0_1px_0_0_#e5e7eb] z-10">
              <tr>
                {visibleColumns.map((h, idx) => (
                  <th key={h} className={\`px-4 py-3 font-semibold border-b border-gray-200 bg-gray-50 \${idx === 0 ? 'sticky left-0 shadow-[1px_0_0_0_#e5e7eb] z-[15]' : ''}\`}>
                    <div className="flex items-center justify-between relative gap-2">
                      <span className="truncate">{h}</span>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setActiveFilterColumn(activeFilterColumn === h ? null : h); }}
                        className={\`p-1.5 rounded-md transition-colors flex-shrink-0 \${columnFilters[h] && columnFilters[h].size > 0 ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-200'}\`}
                        title="Lọc dữ liệu"
                      >
                        <Filter size={14} className={columnFilters[h] && columnFilters[h].size > 0 ? "fill-blue-100" : ""} />
                      </button>
                      
                      {activeFilterColumn === h && (
                        <div ref={filterRef} className="absolute top-full right-0 mt-1 z-50 w-64 bg-white border border-gray-200 shadow-xl rounded-lg p-3 max-h-72 flex flex-col font-normal text-sm">
                          <div className="flex justify-between items-center mb-2 pb-2 border-b border-gray-100">
                            <span className="font-semibold text-gray-800">Lọc: {h}</span>
                            <button onClick={() => clearColumnFilter(h)} className="text-xs text-blue-600 hover:text-blue-800">Xoá lọc</button>
                          </div>
                          <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-1.5">
                            {getUniqueValuesForColumn(h).map(val => (
                              <label key={val} className="flex items-start gap-2 cursor-pointer group/label">
                                <input 
                                  type="checkbox" 
                                  checked={columnFilters[h]?.has(val) || false}
                                  onChange={() => toggleFilterValue(h, val)}
                                  className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4 flex-shrink-0"
                                />
                                <span className="text-gray-700 break-words group-hover/label:text-blue-600 transition-colors">{val || "(Trống)"}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((row, i) => {
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
              })}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white px-4 py-3 border border-gray-200 border-t-0 rounded-b-lg flex-shrink-0">
          <div className="flex flex-1 justify-between sm:hidden">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Trang trước
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Trang sau
            </button>
          </div>
          <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Hiển thị <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> đến <span className="font-medium">{Math.min(currentPage * itemsPerPage, filteredData.length)}</span> trong số <span className="font-medium">{filteredData.length}</span> kết quả
              </p>
            </div>
            <div>
              <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                >
                  <span className="sr-only">Previous</span>
                  <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                >
                  <span className="sr-only">Next</span>
                  <ChevronRight className="h-5 w-5" aria-hidden="true" />
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}

      `;
    
    // Check if isModalOpen && ( is repeated and fix it too
    let after = code.substring(end);
    // remove all occurrences of {isModalOpen && ( until we hit the real modal
    let realModal = `      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">`;
    let realModalStart = code.indexOf(realModal);
    
    if (realModalStart !== -1) {
       code = code.substring(0, start) + newTable + code.substring(realModalStart);
    } else {
       console.log("Could not find real modal");
    }
}
fs.writeFileSync('src/App.tsx', code);
