const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

let badModal = `
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

content = content.replaceAll(badModal, `    </div>\n  );\n}`);

// Now carefully insert it ONLY at the end of App
content = content.replace(
  'export default function App() {',
  'export default function App() {\n  const [selectedProductDetails, setSelectedProductDetails] = useState<string | null>(null);'
);

content = content.replace(
  '} // end App', // wait I don't know where App ends. It's the last lines of the file maybe?
  ''
);

fs.writeFileSync('src/App.tsx', content);
