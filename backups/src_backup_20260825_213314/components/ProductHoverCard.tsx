import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Package, Hash, Box, Info } from 'lucide-react';
import { clsx } from 'clsx';

interface ProductHoverCardProps {
  productName: string;
  productCode?: string;
  pricingData: any[];
  specsData?: any[];
  children: React.ReactNode;
  className?: string;
}

export const ProductHoverCard: React.FC<ProductHoverCardProps> = ({ 
  productName, 
  productCode, 
  pricingData, 
  specsData = [],
  children,
  className
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const productInfo = pricingData.find(p => 
    p['Tên sản phẩm'] === productName || 
    p['Mã sản phẩm'] === productCode ||
    p['Mã giá'] === productCode
  );

  const productSpec = specsData.find(s => 
    s['Sản phẩm liên kết'] === productName || 
    s['Mã sản phẩm liên kết'] === productCode ||
    s['Sản phẩm liên kết'] === productInfo?.['Tên sản phẩm']
  );

  const productThumbnail = useMemo(() => {
    if (productInfo?.['Hình ảnh']) return productInfo['Hình ảnh'];
    if (productSpec?.['Hình ảnh thiết kế']) return productSpec['Hình ảnh thiết kế'];
    
    // Default placeholders
    const category = productInfo?.['Nhóm hàng'] || '';
    if (category.includes('Carton')) return "https://images.unsplash.com/photo-1589939705384-5185137a7f0f?q=80&w=200&auto=format&fit=crop";
    if (category.includes('Nhãn')) return "https://images.unsplash.com/photo-1626785774573-4b799315345d?q=80&w=200&auto=format&fit=crop";
    return "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=200&auto=format&fit=crop";
  }, [productInfo, productSpec]);

  const handleMouseEnter = (e: React.MouseEvent) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    
    const rect = e.currentTarget.getBoundingClientRect();
    setPosition({
      x: rect.left,
      y: rect.top - 10
    });
    
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, 400); // 400ms delay to avoid accidental triggers
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <div 
      ref={containerRef}
      className={clsx("relative inline-block", className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <span className="cursor-help border-b border-dotted border-gray-400 hover:text-blue-600 transition-colors">
        {children}
      </span>

      <AnimatePresence>
        {isVisible && productInfo && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            style={{
              position: 'fixed',
              left: position.x,
              top: position.y,
              transform: 'translateY(-100%)',
              zIndex: 9999
            }}
            className="w-72 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden pointer-events-none"
          >
            <div className="bg-blue-600 p-4 flex items-center gap-4">
              <div className="w-12 h-12 bg-white rounded-xl flex-shrink-0 overflow-hidden shadow-lg border border-white/20">
                <img src={productThumbnail} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-white font-bold text-sm truncate leading-tight">
                  {productInfo['Tên sản phẩm'] || productName}
                </h4>
                <p className="text-blue-100 text-[10px] uppercase tracking-widest font-black mt-0.5">
                  {productInfo['Nhóm hàng'] || 'Chi tiết sản phẩm'}
                </p>
              </div>
            </div>

            <div className="p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 text-gray-400">
                  <Hash size={14} />
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 uppercase font-bold tracking-tight">Mã sản phẩm / Giá</p>
                  <p className="text-sm text-gray-700 font-mono font-medium">
                    {productInfo['Mã sản phẩm'] || productInfo['Mã giá'] || 'N/A'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="mt-0.5 text-gray-400">
                  <Box size={14} />
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 uppercase font-bold tracking-tight">Đơn vị tính</p>
                  <p className="text-sm text-gray-700 font-medium">
                    {productInfo['ĐVT'] || 'Cái'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="mt-0.5 text-gray-400">
                  <Info size={14} />
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 uppercase font-bold tracking-tight">Nhà cung cấp</p>
                  <p className="text-sm text-gray-700 font-medium">
                    {productInfo['Tên nhà cung cấp'] || 'Chưa xác định'}
                  </p>
                </div>
              </div>

              {productSpec && (
                <div className="pt-2 mt-2 border-t border-blue-50">
                   <div className="flex items-center gap-2 mb-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                      <p className="text-[10px] text-blue-600 font-black uppercase tracking-widest">Thông số kỹ thuật</p>
                   </div>
                   <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
                      <p className="text-gray-500 truncate"><span className="font-bold text-gray-700">Material:</span> {productSpec['Chất liệu'] || '—'}</p>
                      <p className="text-gray-500 truncate"><span className="font-bold text-gray-700">Size:</span> {productSpec['Kích thước'] || '—'}</p>
                      <p className="text-gray-500 truncate"><span className="font-bold text-gray-700">Định lượng:</span> {productSpec['Độ dày/Định lượng'] || '—'}</p>
                      <p className="text-gray-500 truncate"><span className="font-bold text-gray-700">Dung sai:</span> {productSpec['Dung sai'] || '—'}</p>
                   </div>
                </div>
              )}

              <div className="pt-2 mt-2 border-t border-gray-50 flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-gray-400 uppercase font-bold tracking-tight">Tồn kho dự kiến</p>
                  <p className="text-sm text-blue-600 font-bold">
                    Liên hệ kho
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-gray-400 uppercase font-bold tracking-tight">Biên LN</p>
                  <p className="text-sm text-green-600 font-bold">
                    {productInfo['% Lợi nhuận'] || '—'}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-gray-50 px-4 py-2 flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <p className="text-[10px] text-gray-500 font-medium italic">
                Nhấn để xem lịch sử giao dịch đầy đủ
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
