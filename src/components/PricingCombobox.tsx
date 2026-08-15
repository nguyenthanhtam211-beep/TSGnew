import React, { useState, useRef, useEffect } from 'react';

interface PricingComboboxProps {
  value: string;
  onChange: (val: string) => void;
  pricingData: any[];
  label: string;
  className?: string;
  labelClassName?: string;
}

export const PricingCombobox: React.FC<PricingComboboxProps> = ({
  value,
  onChange,
  pricingData,
  label,
  className,
  labelClassName
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value && !isOpen) {
      const p = pricingData.find(x => x['Mã giá bán'] === value);
      if (p) {
        setSearch(`[${value}] ${p['Tên sản phẩm'] || ''} (${p['RP_Khách hàng'] || 'Giá chung'})`);
      } else {
        setSearch(value);
      }
    } else if (!value && !isOpen) {
      setSearch("");
    }
  }, [value, pricingData, isOpen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        if (value) {
          const p = pricingData.find(x => x['Mã giá bán'] === value);
          if (p) {
            setSearch(`[${value}] ${p['Tên sản phẩm'] || ''} (${p['RP_Khách hàng'] || 'Giá chung'})`);
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
  }, [value, pricingData]);

  const filtered = pricingData.filter(p => {
    const code = (p['Mã giá bán'] || "").toLowerCase();
    const prodCode = (p['Mã sản phẩm'] || "").toLowerCase();
    const prodName = (p['Tên sản phẩm'] || "").toLowerCase();
    const customer = (p['RP_Khách hàng'] || "").toLowerCase();
    const s = search.toLowerCase();
    return code.includes(s) || prodCode.includes(s) || prodName.includes(s) || customer.includes(s);
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
        }}
        onFocus={() => setIsOpen(true)}
        className={className || "border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all w-full"}
        placeholder="Tìm theo mã giá, tên sản phẩm, khách hàng..."
      />
      {isOpen && (
        <div className="absolute z-50 w-full mt-[68px] bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {filtered.slice(0, 50).map((p, idx) => {
            const val = p['Mã giá bán'];
            const pName = p['Tên sản phẩm'] || '';
            const cust = p['RP_Khách hàng'] || 'Giá chung';
            const price = p['Đơn giá bán'] || '0';
            const buyPrice = p['Đơn giá mua'] || '0';
            
            return (
              <div 
                key={`${val}-${idx}`} 
                className="px-3 py-2 cursor-pointer hover:bg-blue-50 border-b border-gray-50 flex flex-col gap-0.5 text-left"
                onClick={() => {
                  setSearch(`[${val}] ${pName} (${cust})`);
                  setIsOpen(false);
                  onChange(val);
                }}
              >
                <div className="text-sm font-semibold text-gray-800">
                  <span className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded text-xs mr-1.5">{val}</span>
                  {pName}
                </div>
                <div className="text-xs text-gray-500 flex flex-wrap gap-x-3 gap-y-0.5">
                  <span>Khách: <strong className="text-gray-700">{cust}</strong></span>
                  <span>Giá bán: <strong className="text-green-600">{price}đ</strong></span>
                  <span>Giá mua: <strong className="text-amber-600">{buyPrice}đ</strong></span>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && <div className="px-3 py-2 text-sm text-gray-500">Không tìm thấy mã giá bán</div>}
          {filtered.length > 50 && <div className="px-3 py-1.5 text-xs text-gray-400 bg-gray-50 text-center border-t">Hiển thị 50 kết quả đầu tiên</div>}
        </div>
      )}
    </div>
  );
};
