const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const insertFunc = `
  const handleProductChange = (e: React.ChangeEvent<HTMLSelectElement>, h: string) => {
    const val = e.target.value;
    const updates: any = { [h]: val };
    
    if (isPOLineTable) {
      const product = products.find(p => p['Mã hàng'] === val || p['Mã sản phẩm'] === val || p['Sản phẩm'] === val || p.id === val);
      if (product) {
        updates['ĐVT'] = product['ĐVT'] || product['Đơn vị tính'] || 'Cái';
        updates['Nhóm hàng'] = product['Nhóm hàng'] || product['Phân loại'] || '';
        updates['Tên sản phẩm'] = product['Tên sản phẩm'] || product['Sản phẩm'] || '';
        
        const poNum = formData['Số đơn hàng'] || formData['Đơn hàng'];
        if (poNum && poHeaders.length > 0) {
           const poHeader = poHeaders.find(r => r['Đơn hàng'] === poNum);
           if (poHeader && poHeader['Khách hàng']) {
              const customerName = poHeader['Khách hàng'];
              const pricing = pricingData.find(p => p['Mã sản phẩm'] === val && p['RP_Khách hàng'] === customerName);
              if (pricing) {
                  updates['Mã của khách'] = product['Mã của khách'] || pricing['Mã sản phẩm'] || '';
                  updates['Mã giá bán'] = pricing['Mã giá bán'] || '';
                  updates['Đơn giá bán'] = pricing['Đơn giá bán'] || '';
                  updates['Đơn giá nhập'] = pricing['Đơn giá mua'] || pricing['Đơn giá nhập'] || '';
                  updates['Lợi nhuận'] = pricing['Lợi nhuận'] || '';
                  
                  const qty = parseNumber(formData['Số lượng'] || 0);
                  const price = parseNumber(pricing['Đơn giá bán'] || 0);
                  updates['Thành tiền dòng'] = (qty * price).toLocaleString('vi-VN');
              }
           }
        }
      }
    }
    setFormData(prev => ({ ...prev, ...updates }));
  };
`;

code = code.replace(/  \}, \[data, poHeaders\]\);\n/, "  }, [data, poHeaders]);\n" + insertFunc);
fs.writeFileSync('src/App.tsx', code);
