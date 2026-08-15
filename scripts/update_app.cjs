const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// Add selectedProduct state to App component
let appStartMatch = `export default function App() {`;
let appStartReplace = `export default function App() {
  const [selectedProductDetails, setSelectedProductDetails] = useState<any>(null);`;
content = content.replace(appStartMatch, appStartReplace);

// Update TableView calls
content = content.replace(/<TableView title=(.*?) \/>/g, (match, p1) => {
    return `<TableView title=${p1} onProductClick={(val) => setSelectedProductDetails(val)} />`;
});

// Oh wait, TableView definition needs onProductClick prop.
// And App needs to render the ProductDetailModal.

fs.writeFileSync('src/App.tsx', content);
