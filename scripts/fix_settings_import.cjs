const fs = require('fs');
let content = fs.readFileSync('src/components/SettingsView.tsx', 'utf8');

content = content.replace(
    "import { PRICING_DATA, PO_HEADER_DATA, PO_LINES_DATA, DELIVERY_DATA, CUSTOMER_DATA, SUPPLIER_DATA, CONTACT_DATA } from '../data';",
    "import { PRICING_DATA, PO_HEADER_DATA, PO_LINES_DATA, DELIVERY_DATA, CUSTOMER_DATA, SUPPLIER_DATA, CONTACT_DATA, PRODUCT_DATA, DELIVERY_PLAN_DATA } from '../data';"
);

fs.writeFileSync('src/components/SettingsView.tsx', content);
