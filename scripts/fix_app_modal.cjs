const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const lines = content.split('\n');

let appEndIndex = -1;
for (let i = 210; i < 230; i++) {
   if (lines[i] && lines[i].trim() === '</div>' && lines[i+1] && lines[i+1].trim() === ');') {
       appEndIndex = i;
       break;
   }
}

if (appEndIndex !== -1) {
    const modalJSX = `
      {selectedProductDetails && (
        <ProductDetailModal 
            productNameOrId={selectedProductDetails} 
            onClose={() => setSelectedProductDetails(null)} 
            productData={productData}
            poLinesData={poLinesData}
            deliveryPlanData={deliveryPlanData}
            deliveryData={deliveryData}
        />
      )}`;
      
    lines.splice(appEndIndex, 0, modalJSX);
    content = lines.join('\n');
    fs.writeFileSync('src/App.tsx', content);
}
