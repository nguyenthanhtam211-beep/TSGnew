const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace('import TasksView from "./components/TasksView";', 'import TasksView from "./components/TasksView";\nimport { ProductDetailModal } from "./components/ProductDetailModal";');

content = content.replace('  const [selectedProductDetails, setSelectedProductDetails] = useState<any>(null);\n', '');

fs.writeFileSync('src/App.tsx', content);
