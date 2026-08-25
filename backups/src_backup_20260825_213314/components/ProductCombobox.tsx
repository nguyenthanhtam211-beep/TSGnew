import React, { useState, useRef, useEffect } from 'react';

export const ProductCombobox = ({ value, onChange, products, label, className, labelClassName }: { value: string, onChange: (val: string) => void, products: any[], label: string, className?: string, labelClassName?: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
     if (value && !isOpen) {
       const p = products.find(x => x['Mã hàng'] === value || x['Mã sản phẩm'] === value || x['Sản phẩm'] === value || x['Tên sản phẩm'] === value || x.id === value);
       if (p) {
         setSearch(p['Tên sản phẩm'] ? `[${p['Mã sản phẩm'] || p['Mã hàng'] || p.id}] ${p['Tên sản phẩm']}` : value);
       } else {
         setSearch(value);
       }
     } else if (!value && !isOpen) {
       setSearch("");
     }
  }, [value, products, isOpen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        if (value) {
           const p = products.find(x => x['Mã hàng'] === value || x['Mã sản phẩm'] === value || x['Sản phẩm'] === value || x['Tên sản phẩm'] === value || x.id === value);
           if (p) {
             setSearch(p['Tên sản phẩm'] ? `[${p['Mã sản phẩm'] || p['Mã hàng'] || p.id}] ${p['Tên sản phẩm']}` : value);
           } else {
             setSearch(value);
           }
        } else {
           setSearch("");
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [value, products]);

  const filtered = products.filter(p => {
      const code = (p['Mã hàng'] || p['Mã sản phẩm'] || p['Sản phẩm'] || p.id || "").toLowerCase();
      const name = (p['Tên sản phẩm'] || "").toLowerCase();
      const s = search.toLowerCase();
      return code.includes(s) || name.includes(s);
  });

  return (
    <div ref={wrapperRef} className="relative flex flex-col gap-1.5 w-full">
      <label className={labelClassName || "text-sm font-medium text-gray-700"}>{label}</label>
      <input 
        type="text" 
        value={search}
        onChange={e => {
           setSearch(e.target.value);
           setIsOpen(true);
           onChange(e.target.value); // Trigger parent's change handler to allow fuzzy lookup
        }}
        onFocus={() => setIsOpen(true)}
        className={className || "border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all w-full"}
        placeholder="Nhập mã hoặc tên sản phẩm..."
      />
      {isOpen && (
        <div className="absolute z-50 w-full mt-[64px] bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {filtered.map(p => {
             const val = p['Mã hàng'] || p['Mã sản phẩm'] || p['Sản phẩm'] || p.id;
             const name = p['Tên sản phẩm'] || p['Sản phẩm'] || '';
             const group = p['Nhóm hàng'] || p['Phân loại'] || '';
             const customer = p['Khách hàng'] || '';
             const unit = p['ĐVT'] || p['Đơn vị tính'] || p['Đơn Vị Tính'] || '';
             
             const lbl = name ? `[${val}] ${name}` : val;
             return (
               <div 
                 key={val} 
                 className="px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 border-b border-gray-50 flex flex-col gap-0.5 text-left"
                 onClick={() => {
                   setSearch(lbl);
                   setIsOpen(false);
                   onChange(val);
                 }}
               >
                 <div className="font-semibold text-gray-800">
                   <span className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded text-xs mr-1.5">{val}</span>
                   {name || 'Chưa có tên'}
                 </div>
                 <div className="text-xs text-gray-500 flex flex-wrap gap-x-3 gap-y-0.5">
                   {group && <span>Nhóm: <strong className="text-gray-600">{group}</strong></span>}
                   {customer && <span>Khách: <strong className="text-gray-600">{customer}</strong></span>}
                   {unit && <span>ĐVT: <strong className="text-gray-600">{unit}</strong></span>}
                 </div>
               </div>
             )
          })}
          {filtered.length === 0 && <div className="px-3 py-2 text-sm text-gray-500">Không tìm thấy sản phẩm</div>}
        </div>
      )}
    </div>
  );
};
