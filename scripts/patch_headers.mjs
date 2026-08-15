import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');

const replacement = `
  const headers = useMemo(() => {
    if (!data || data.length === 0) return [];
    let maxKeys = 0;
    let bestHeaders: string[] = [];
    for (let i = 0; i < Math.min(data.length, 50); i++) {
        const keys = Object.keys(data[i]);
        if (keys.length > maxKeys) {
            maxKeys = keys.length;
            bestHeaders = keys;
        }
    }
    
    // Filter out unnecessary columns
    const excludeCols = ['Các mục mẹ 2', 'Tiến độ sản phẩm', 'Tiến độ đơn hàng'];
    return bestHeaders.filter(h => !excludeCols.includes(h));
  }, [data]);
`;

code = code.replace(/  const headers = useMemo\(\(\) => \{[\s\S]*?  \}, \[data\]\);/, replacement);
fs.writeFileSync('src/App.tsx', code);
