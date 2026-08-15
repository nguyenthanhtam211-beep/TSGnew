const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// Remove toast from handleAddToFirestore
let oldHandle = `  const handleAddToFirestore = async (colName: string, row: any) => {
    const toastId = toast.loading('Đang lưu dữ liệu...');
    try {
      await addDoc(collection(db, colName), row);
      toast.success('Lưu dữ liệu thành công!', { id: toastId });
    } catch (err) {
      console.error(\`Failed to add to \${colName}\`, err);
      toast.error('Lỗi khi lưu dữ liệu!', { id: toastId });
    }
  };`;

let newHandle = `  const handleAddToFirestore = async (colName: string, row: any) => {
    try {
      await addDoc(collection(db, colName), row);
    } catch (err) {
      console.error(\`Failed to add to \${colName}\`, err);
      throw err;
    }
  };`;

content = content.replace(oldHandle, newHandle);

// Add toast to TableView handleSubmit
let oldSubmit = `  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onAdd) {
      onAdd(formData);
    }
    setIsModalOpen(false);
    setFormData({});
  };`;

let newSubmit = `  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (onAdd) {
      const toastId = toast.loading('Đang thêm mới...');
      try {
        await onAdd(formData);
        toast.success('Đã thêm mới dữ liệu!', { id: toastId });
      } catch (err) {
        toast.error('Có lỗi xảy ra khi thêm mới!', { id: toastId });
      }
    }
    setIsModalOpen(false);
    setFormData({});
  };`;

content = content.replace(oldSubmit, newSubmit);

fs.writeFileSync('src/App.tsx', content);
