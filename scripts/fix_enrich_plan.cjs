const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

let hookSection = `  const enrichedDeliveryData = useMemo(() => {`;
let newHookSection = `  const enrichedDeliveryPlanData = useMemo(() => {
    return deliveryPlanData.map(row => {
      const product = productData.find(p => p['Tên sản phẩm'] === row['Sản phẩm'] || p['Mã sản phẩm'] === row['Sản phẩm']);
      if (product) {
        return {
          ...row,
          'Sản phẩm': product['Tên sản phẩm'] || row['Sản phẩm']
        };
      }
      return row;
    });
  }, [deliveryPlanData, productData]);

  const enrichedDeliveryData = useMemo(() => {`;

content = content.replace(hookSection, newHookSection);

content = content.replace(
  '{activeTab === "delivery_plan" && <TableView title="Kế hoạch giao hàng" data={deliveryPlanData} showAddButton={true} onAdd={(row) => handleAddToFirestore("delivery_plans", row)} />}',
  '{activeTab === "delivery_plan" && <TableView title="Kế hoạch giao hàng" data={enrichedDeliveryPlanData} showAddButton={true} onAdd={(row) => handleAddToFirestore("delivery_plans", row)} />}'
);

fs.writeFileSync('src/App.tsx', content);
