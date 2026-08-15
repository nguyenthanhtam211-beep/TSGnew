const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

let hookSection = `  const deliveryPlanData = useFirestoreCollection('delivery_plans', initialDeliveryPlan);`;
let newHookSection = `  const deliveryPlanData = useFirestoreCollection('delivery_plans', initialDeliveryPlan);

  const enrichedPricingData = useMemo(() => {
    return pricingData.map(row => {
      const product = productData.find(p => p['Mã sản phẩm'] === row['Mã sản phẩm']);
      if (product) {
        return {
          ...row,
          'Tên sản phẩm': product['Tên sản phẩm'] || row['Tên sản phẩm'],
          'ĐVT': product['Đơn Vị Tính'] || row['ĐVT'],
          'Nhóm sản phẩm': product['Nhóm hàng'] || row['Nhóm sản phẩm'],
        };
      }
      return row;
    });
  }, [pricingData, productData]);

  const enrichedPoLinesData = useMemo(() => {
    return poLinesData.map(row => {
      let productCode = row['Mã của khách']?.split(',')[0];
      const priceRow = pricingData.find(p => p['Mã giá bán'] === row['Mã giá bán']);
      if (priceRow && priceRow['Mã sản phẩm']) {
          productCode = priceRow['Mã sản phẩm'];
      }
      
      const product = productData.find(p => p['Mã sản phẩm'] === productCode || p['Mã sản phẩm'] === row['Mã của khách']);
      
      if (product) {
        return {
          ...row,
          'Tên sản phẩm': product['Tên sản phẩm'] || row['Tên sản phẩm'],
          'ĐVT': product['Đơn Vị Tính'] || row['ĐVT'],
          'Nhóm hàng': product['Nhóm hàng'] || row['Nhóm hàng'],
        };
      }
      return row;
    });
  }, [poLinesData, pricingData, productData]);

  const enrichedDeliveryData = useMemo(() => {
    return deliveryData.map(row => {
      const priceRow = pricingData.find(p => p['Mã giá bán'] === row['Mã sản phẩm']);
      let productCode = priceRow ? priceRow['Mã sản phẩm'] : row['Mã sản phẩm'];
      const product = productData.find(p => p['Mã sản phẩm'] === productCode);
      
      if (product) {
        return {
          ...row,
          'Tên sản phẩm': product['Tên sản phẩm'] || row['Tên sản phẩm'],
          'ĐVT': product['Đơn Vị Tính'] || row['ĐVT'],
          'Nhóm hàng': product['Nhóm hàng'] || row['Nhóm hàng'],
        };
      }
      return row;
    });
  }, [deliveryData, pricingData, productData]);
`;

content = content.replace(hookSection, newHookSection);

// Update Main Content routing
content = content.replace(
  '{activeTab === "pricing" && <TableView title="Giá 2026" data={pricingData} showAddButton={true} onAdd={(row) => handleAddToFirestore("pricing", row)} />}',
  '{activeTab === "pricing" && <TableView title="Giá 2026" data={enrichedPricingData} showAddButton={true} onAdd={(row) => handleAddToFirestore("pricing", row)} />}'
);
content = content.replace(
  '{activeTab === "po_lines" && <TableView title="Chi tiết PO" data={poLinesData} showAddButton={true} onAdd={(row) => handleAddToFirestore("po_lines", row)} />}',
  '{activeTab === "po_lines" && <TableView title="Chi tiết PO" data={enrichedPoLinesData} showAddButton={true} onAdd={(row) => handleAddToFirestore("po_lines", row)} />}'
);
content = content.replace(
  '{activeTab === "delivery" && <TableView title="Giao hàng (PXK)" data={deliveryData} showAddButton={true} onAdd={(row) => handleAddToFirestore("deliveries", row)} />}',
  '{activeTab === "delivery" && <TableView title="Giao hàng (PXK)" data={enrichedDeliveryData} showAddButton={true} onAdd={(row) => handleAddToFirestore("deliveries", row)} />}'
);

fs.writeFileSync('src/App.tsx', content);
