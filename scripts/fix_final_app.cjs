const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

if (!content.includes('import { ProductDetailModal }')) {
  content = content.replace(
      'import TasksView from "./components/TasksView";',
      'import TasksView from "./components/TasksView";\nimport { ProductDetailModal } from "./components/ProductDetailModal";'
  );
}

// Remove the multiple ProductDetailModal instances if my sed replaced them inside TableView instead of App!
// Let me check if I inserted the modal inside TableView!
