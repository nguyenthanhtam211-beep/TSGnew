const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

if (!content.includes('import { ProductDetailModal } from "./components/ProductDetailModal";')) {
    content = content.replace(
        'import { SettingsView } from "./components/SettingsView";',
        'import { SettingsView } from "./components/SettingsView";\nimport { ProductDetailModal } from "./components/ProductDetailModal";'
    );
    fs.writeFileSync('src/App.tsx', content);
}
