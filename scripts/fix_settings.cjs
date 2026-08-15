const fs = require('fs');
let content = fs.readFileSync('src/components/SettingsView.tsx', 'utf8');

// Add imports
content = content.replace(
    'import { PRICING_DATA, PO_HEADER_DATA, PO_LINES_DATA, DELIVERY_DATA, CUSTOMER_DATA, SUPPLIER_DATA, CONTACT_DATA } from "../data";',
    'import { PRICING_DATA, PO_HEADER_DATA, PO_LINES_DATA, DELIVERY_DATA, CUSTOMER_DATA, SUPPLIER_DATA, CONTACT_DATA, PRODUCT_DATA, DELIVERY_PLAN_DATA } from "../data";'
);

// Update handleSyncFirebase
let oldSync = `        { name: "contacts", data: parseCSV(CONTACT_DATA), idField: "Tên" }
      ];`;
let newSync = `        { name: "contacts", data: parseCSV(CONTACT_DATA), idField: "Tên" },
        { name: "products", data: parseCSV(PRODUCT_DATA), idField: "Mã sản phẩm" },
        { name: "delivery_plans", data: parseCSV(DELIVERY_PLAN_DATA), idField: "Mã kế hoạch" }
      ];`;
content = content.replace(oldSync, newSync);

fs.writeFileSync('src/components/SettingsView.tsx', content);
