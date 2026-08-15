const fs = require('fs');
let content = fs.readFileSync('src/components/SettingsView.tsx', 'utf8');

// Add import
content = content.replace("import React, { useState, useEffect } from 'react';", "import React, { useState, useEffect } from 'react';\nimport { toast } from 'react-hot-toast';");

// Update handleSyncFirebase
let oldHandle = `    try {
      // Dummy batch sync for demonstration, in a real app you'd loop correctly
      const collections = [`;

let newHandle = `    const toastId = toast.loading('Đang nạp dữ liệu...');
    try {
      // Dummy batch sync for demonstration, in a real app you'd loop correctly
      const collections = [`;

content = content.replace(oldHandle, newHandle);

let oldSuccess = `      setSyncStatus("Nạp dữ liệu thành công!");
      setSyncSuccess(true);`;

let newSuccess = `      setSyncStatus("Nạp dữ liệu thành công!");
      setSyncSuccess(true);
      toast.success('Nạp dữ liệu chuẩn thành công!', { id: toastId });`;

content = content.replace(oldSuccess, newSuccess);

let oldError = `      console.error(error);
      setSyncStatus(\`Lỗi: \${error.message}\`);
      handleFirestoreError(error, OperationType.WRITE, 'batch-sync');`;

let newError = `      console.error(error);
      setSyncStatus(\`Lỗi: \${error.message}\`);
      toast.error('Lỗi khi nạp dữ liệu!', { id: toastId });
      handleFirestoreError(error, OperationType.WRITE, 'batch-sync');`;

content = content.replace(oldError, newError);

// Update handleExportSheets
let oldExportTry = `    setIsExportingSheets(true);
    setExportStatus("Đang tạo bảng tính...");
    try {`;

let newExportTry = `    setIsExportingSheets(true);
    setExportStatus("Đang tạo bảng tính...");
    const toastId2 = toast.loading('Đang tạo Google Sheets...');
    try {`;

content = content.replace(oldExportTry, newExportTry);

let oldExportSuccess = `      setExportStatus(\`Bảng tính tạo thành công! ID: \${spreadsheetId}\`);
      setSpreadsheetUrl(url);
      window.open(url, "_blank");`;

let newExportSuccess = `      setExportStatus(\`Bảng tính tạo thành công! ID: \${spreadsheetId}\`);
      setSpreadsheetUrl(url);
      window.open(url, "_blank");
      toast.success('Tạo bảng tính thành công!', { id: toastId2 });`;

content = content.replace(oldExportSuccess, newExportSuccess);

let oldExportError = `    } catch (error: any) {
      console.error(error);
      setExportStatus(\`Lỗi xuất file: \${error.message}\`);
    } finally {`;

let newExportError = `    } catch (error: any) {
      console.error(error);
      setExportStatus(\`Lỗi xuất file: \${error.message}\`);
      toast.error(\`Lỗi xuất file: \${error.message}\`, { id: toastId2 });
    } finally {`;

content = content.replace(oldExportError, newExportError);

fs.writeFileSync('src/components/SettingsView.tsx', content);
