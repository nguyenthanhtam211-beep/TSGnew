const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// Update TableView signature
content = content.replace(
    'function TableView({ title, data, showAddButton, onAdd }: { title: string, data: any[], showAddButton?: boolean, onAdd?: (row: any) => Promise<void> | void }) {',
    'function TableView({ title, data, showAddButton, onAdd, onProductClick }: { title: string, data: any[], showAddButton?: boolean, onAdd?: (row: any) => Promise<void> | void, onProductClick?: (val: string) => void }) {'
);

// Add product click handler to renderCell
let oldRenderCell = `  const renderCell = (header: string, value: any) => {
    if (value == null || value === '') return <span className="text-gray-400">-</span>;
    const strVal = String(value);`;
    
let newRenderCell = `  const renderCell = (header: string, value: any) => {
    if (value == null || value === '') return <span className="text-gray-400">-</span>;
    const strVal = String(value);

    // Clickable Product Link
    if (header === 'Tên sản phẩm' || header === 'Mã sản phẩm' || header === 'Sản phẩm') {
        return (
            <span 
                className="text-blue-600 font-medium hover:text-blue-800 hover:underline cursor-pointer transition-colors"
                onClick={(e) => {
                    e.stopPropagation();
                    if (onProductClick) onProductClick(strVal);
                }}
            >
                {strVal}
            </span>
        );
    }`;

content = content.replace(oldRenderCell, newRenderCell);

// Render the modal in App
let modalString = `
      {selectedProductDetails && (
        <ProductDetailModal 
            productNameOrId={selectedProductDetails} 
            onClose={() => setSelectedProductDetails(null)} 
            productData={productData}
            poLinesData={poLinesData}
            deliveryPlanData={deliveryPlanData}
            deliveryData={deliveryData}
        />
      )}
    </div>
  );
}`;

content = content.replace(/    <\/div>\n  \);\n}/g, modalString);

fs.writeFileSync('src/App.tsx', content);
