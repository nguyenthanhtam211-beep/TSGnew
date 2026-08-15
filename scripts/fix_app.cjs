const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// Update imports for PRICING_DATA etc.
content = content.replace(
    'import { PRICING_DATA, PO_LINES_DATA, PO_HEADER_DATA, DELIVERY_DATA, CUSTOMER_DATA, SUPPLIER_DATA, CONTACT_DATA } from "./data";',
    'import { PRICING_DATA, PO_LINES_DATA, PO_HEADER_DATA, DELIVERY_DATA, CUSTOMER_DATA, SUPPLIER_DATA, CONTACT_DATA, PRODUCT_DATA, DELIVERY_PLAN_DATA } from "./data";'
);

// Add state for these
let oldStates = `  const initialContact = useMemo(() => parseCSV(CONTACT_DATA), []);`;
let newStates = `  const initialContact = useMemo(() => parseCSV(CONTACT_DATA), []);
  const initialProducts = useMemo(() => parseCSV(PRODUCT_DATA), []);
  const initialDeliveryPlan = useMemo(() => parseCSV(DELIVERY_PLAN_DATA), []);`;
content = content.replace(oldStates, newStates);

let oldFire = `  const contactData = useFirestoreCollection('contacts', initialContact);`;
let newFire = `  const contactData = useFirestoreCollection('contacts', initialContact);
  const productData = useFirestoreCollection('products', initialProducts);
  const deliveryPlanData = useFirestoreCollection('delivery_plans', initialDeliveryPlan);`;
content = content.replace(oldFire, newFire);

// Add to Sidebar
let oldSidebar1 = `          <NavItem icon={<Truck size={18} />} label="Giao hàng (PXK)" isActive={activeTab === "delivery"} onClick={() => setActiveTab("delivery")} />`;
let newSidebar1 = `          <NavItem icon={<Truck size={18} />} label="Giao hàng (PXK)" isActive={activeTab === "delivery"} onClick={() => setActiveTab("delivery")} />
          <NavItem icon={<CheckCircle size={18} />} label="Kế hoạch giao hàng" isActive={activeTab === "delivery_plan"} onClick={() => setActiveTab("delivery_plan")} />`;
content = content.replace(oldSidebar1, newSidebar1);

let oldSidebar2 = `          <NavItem icon={<BookUser size={18} />} label="Nhà cung cấp" isActive={activeTab === "suppliers"} onClick={() => setActiveTab("suppliers")} />`;
let newSidebar2 = `          <NavItem icon={<BookUser size={18} />} label="Nhà cung cấp" isActive={activeTab === "suppliers"} onClick={() => setActiveTab("suppliers")} />
          <NavItem icon={<Package size={18} />} label="Sản phẩm" isActive={activeTab === "products"} onClick={() => setActiveTab("products")} />`;
content = content.replace(oldSidebar2, newSidebar2);

// Add to Main Content routing
let oldMain = `        {activeTab === "delivery" && <TableView title="Giao hàng (PXK)" data={deliveryData} showAddButton={true} onAdd={(row) => handleAddToFirestore("deliveries", row)} />}`;
let newMain = `        {activeTab === "delivery" && <TableView title="Giao hàng (PXK)" data={deliveryData} showAddButton={true} onAdd={(row) => handleAddToFirestore("deliveries", row)} />}
        {activeTab === "delivery_plan" && <TableView title="Kế hoạch giao hàng" data={deliveryPlanData} showAddButton={true} onAdd={(row) => handleAddToFirestore("delivery_plans", row)} />}
        {activeTab === "products" && <TableView title="Sản phẩm" data={productData} showAddButton={true} onAdd={(row) => handleAddToFirestore("products", row)} />}`;
content = content.replace(oldMain, newMain);

// Also we should update SettingsView.tsx to allow syncing these
fs.writeFileSync('src/App.tsx', content);
