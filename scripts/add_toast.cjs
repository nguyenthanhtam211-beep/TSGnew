const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// Add import
content = content.replace("import React,", "import { Toaster, toast } from 'react-hot-toast';\nimport React,");

// Update handleAddToFirestore
let oldHandle = `  const handleAddToFirestore = async (colName: string, row: any) => {
    try {
      await addDoc(collection(db, colName), row);
    } catch (err) {
      console.error(\`Failed to add to \${colName}\`, err);
    }
  };`;

let newHandle = `  const handleAddToFirestore = async (colName: string, row: any) => {
    const toastId = toast.loading('Đang lưu dữ liệu...');
    try {
      await addDoc(collection(db, colName), row);
      toast.success('Lưu dữ liệu thành công!', { id: toastId });
    } catch (err) {
      console.error(\`Failed to add to \${colName}\`, err);
      toast.error('Lỗi khi lưu dữ liệu!', { id: toastId });
    }
  };`;

content = content.replace(oldHandle, newHandle);

// Add Toaster to render
let oldReturn = `  return (
    <div className="flex h-screen bg-gray-50 text-gray-900 font-sans">
      {/* Sidebar */}`;

let newReturn = `  return (
    <div className="flex h-screen bg-gray-50 text-gray-900 font-sans">
      <Toaster position="top-right" />
      {/* Sidebar */}`;

content = content.replace(oldReturn, newReturn);

fs.writeFileSync('src/App.tsx', content);
