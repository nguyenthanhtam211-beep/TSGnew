import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');

const insertFunc = `
  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>, h: string) => {
    const val = e.target.value;
    const updates: any = { [h]: val };

    if (isPOLineTable) {
        if (h === 'Mã giá bán') {
           const pricing = pricingData.find(p => p['Mã giá bán'] === val);
           if (pricing) {
               updates['Tên sản phẩm'] = pricing['Tên sản phẩm'] || '';
               updates['Mã của khách'] = pricing['Mã sản phẩm'] || '';
               updates['Đơn giá bán'] = pricing['Đơn giá bán'] || '';
               updates['Đơn giá nhập'] = pricing['Đơn giá mua'] || pricing['Đơn giá nhập'] || '';
               updates['Lợi nhuận'] = pricing['Lợi nhuận'] || '';
               
               const product = products.find(p => p['Mã sản phẩm'] === pricing['Mã sản phẩm']);
               if (product) {
                   updates['ĐVT'] = product['ĐVT'] || product['Đơn vị tính'] || 'Cái';
                   updates['Nhóm hàng'] = product['Nhóm hàng'] || product['Phân loại'] || '';
               }
               
               const qty = parseNumber(formData['Số lượng'] || 0);
               const price = parseNumber(pricing['Đơn giá bán'] || 0);
               if (qty && price) {
                   updates['Thành tiền dòng'] = (qty * price).toLocaleString('vi-VN');
               }
           }
        }
        if (h === 'Số lượng') {
           const price = parseNumber(formData['Đơn giá bán'] || 0);
           const qty = parseNumber(val);
           if (qty && price) {
               updates['Thành tiền dòng'] = (qty * price).toLocaleString('vi-VN');
           }
        }
    }
    setFormData((prev: any) => ({ ...prev, ...updates }));
  };
`;

code = code.replace(/  const handleProductChange/g, insertFunc + '\n  const handleProductChange');
fs.writeFileSync('src/App.tsx', code);
