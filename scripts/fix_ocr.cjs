const fs = require('fs');
let content = fs.readFileSync('src/components/OCRView.tsx', 'utf8');

// The string to replace
let oldStr = `      }));
      onAddDelivery(deliveryRows);
    }
    setIsSaved(true);
  };`;

let newStr = `      }));
      onAddDelivery(deliveryRows);
    }
    setIsSaved(true);
    toast.success('Đã lưu dữ liệu vào hệ thống!', { id: toastId });
    } catch (err) {
       console.error(err);
       toast.error('Lỗi khi lưu dữ liệu!', { id: toastId });
    }
  };`;

content = content.replace(oldStr, newStr);

fs.writeFileSync('src/components/OCRView.tsx', content);
