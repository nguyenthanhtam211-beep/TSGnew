const fs = require('fs');
let content = fs.readFileSync('src/components/OCRView.tsx', 'utf8');

// Add import
content = content.replace("import React, { useState } from 'react';", "import React, { useState } from 'react';\nimport { toast } from 'react-hot-toast';");

// Update handleSaveToSystem
let oldHandle = `    if (dataToSave.documentType === "PO") {
      // 1. Calculate total order value`;

let newHandle = `    const toastId = toast.loading('Đang lưu vào hệ thống...');
    try {
    if (dataToSave.documentType === "PO") {
      // 1. Calculate total order value`;

content = content.replace(oldHandle, newHandle);

let oldEnd = `      // Insert Delivery Lines
      onAddDelivery(deliveryRows);
    }
  };`;

let newEnd = `      // Insert Delivery Lines
      onAddDelivery(deliveryRows);
    }
    toast.success('Đã lưu dữ liệu vào hệ thống!', { id: toastId });
    } catch (err) {
       console.error(err);
       toast.error('Lỗi khi lưu dữ liệu!', { id: toastId });
    }
  };`;

content = content.replace(oldEnd, newEnd);

fs.writeFileSync('src/components/OCRView.tsx', content);
