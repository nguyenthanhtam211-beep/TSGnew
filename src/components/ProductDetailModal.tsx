import React, { useMemo, useState } from 'react';
import { 
  Package, 
  Truck, 
  ShoppingCart, 
  Calendar, 
  X, 
  AlertCircle, 
  TrendingUp, 
  DollarSign, 
  Activity, 
  Clock, 
  FileText,
  ShieldCheck,
  Layers,
  Ruler,
  Palette,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import clsx from 'clsx';
import MacTrafficLights from './MacTrafficLights';

interface ProductDetailModalProps {
  productNameOrId: string;
  onClose: () => void;
  productData: any[];
  pricingData: any[];
  poLinesData: any[];
  deliveryPlanData: any[];
  deliveryData: any[];
  specsData?: any[];
  onPoClick?: (poNumber: string) => void;
}

export function ProductDetailModal({ 
  productNameOrId, 
  onClose, 
  productData, 
  pricingData,
  poLinesData, 
  deliveryPlanData, 
  deliveryData,
  specsData = [],
  onPoClick
}: ProductDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'details' | 'specs'>('overview');
  const [compareWithId, setCompareWithId] = useState<string | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);
  
  const product = useMemo(() => {
    return productData.find(p => p['Tên sản phẩm'] === productNameOrId || p['Mã sản phẩm'] === productNameOrId) || { 'Tên sản phẩm': productNameOrId };
  }, [productNameOrId, productData]);

  const compareProduct = useMemo(() => {
    if (!compareWithId) return null;
    return productData.find(p => p['Mã sản phẩm'] === compareWithId || p['Tên sản phẩm'] === compareWithId);
  }, [productData, compareWithId]);

  const compareSpecs = useMemo(() => {
    if (!compareProduct) return [];
    return specsData.filter(s => 
      s['Sản phẩm liên kết'] === compareProduct['Tên sản phẩm'] ||
      s['Mã sản phẩm liên kết'] === compareProduct['Mã sản phẩm']
    );
  }, [specsData, compareProduct]);

  const relatedPoLines = useMemo(() => {
    return poLinesData.filter(po => 
      po['Tên sản phẩm'] === product['Tên sản phẩm'] || 
      po['Mã của khách']?.includes(product['Mã sản phẩm'])
    );
  }, [poLinesData, product]);

  const relatedDeliveryPlans = useMemo(() => {
    return deliveryPlanData.filter(plan => 
      plan['Sản phẩm'] === product['Tên sản phẩm'] || 
      plan['Sản phẩm'] === product['Mã sản phẩm']
    );
  }, [deliveryPlanData, product]);

  const relatedDeliveries = useMemo(() => {
    return deliveryData.filter(del => 
      del['Tên sản phẩm'] === product['Tên sản phẩm'] || 
      del['Mã sản phẩm'] === product['Mã sản phẩm']
    );
  }, [deliveryData, product]);

  const relatedSpecs = useMemo(() => {
    return specsData.filter(s => 
      s['Sản phẩm liên kết'] === product['Tên sản phẩm'] ||
      s['Mã sản phẩm liên kết'] === product['Mã sản phẩm']
    );
  }, [specsData, product]);

  const productImages = useMemo(() => {
    const images = [];
    if (product['Hình ảnh']) images.push(product['Hình ảnh']);
    relatedSpecs.forEach(s => {
      if (s['Hình ảnh thiết kế']) images.push(s['Hình ảnh thiết kế']);
    });
    // Add default placeholders based on product category if no images found
    if (images.length === 0) {
      if (product['Nhóm hàng']?.includes('Carton')) {
        images.push("https://images.unsplash.com/photo-1589939705384-5185137a7f0f?q=80&w=500&auto=format&fit=crop");
      } else if (product['Nhóm hàng']?.includes('Nhãn')) {
        images.push("https://images.unsplash.com/photo-1626785774573-4b799315345d?q=80&w=500&auto=format&fit=crop");
      } else {
        images.push("https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=500&auto=format&fit=crop");
      }
    }
    return images;
  }, [product, relatedSpecs]);

  const similarProducts = useMemo(() => {
    if (!product['Nhóm hàng']) return [];
    return productData.filter(p => 
      p['Nhóm hàng'] === product['Nhóm hàng'] && 
      p['Tên sản phẩm'] !== product['Tên sản phẩm']
    ).slice(0, 3);
  }, [productData, product]);

  const comparisonData = useMemo(() => {
    return similarProducts.map(p => {
      const pSpecs = specsData.filter(s => 
        s['Sản phẩm liên kết'] === p['Tên sản phẩm'] ||
        s['Mã sản phẩm liên kết'] === p['Mã sản phẩm']
      );
      const pPricing = pricingData.find(pr => pr['Tên sản phẩm'] === p['Tên sản phẩm']);
      return {
        product: p,
        specs: pSpecs,
        pricing: pPricing
      };
    });
  }, [similarProducts, specsData, pricingData]);

  // Dynamic 6-month calculation based on context date (July 2026)
  const chartData = useMemo(() => {
    const months = [
      { num: 2, label: 'Tháng 2', year: 2026 },
      { num: 3, label: 'Tháng 3', year: 2026 },
      { num: 4, label: 'Tháng 4', year: 2026 },
      { num: 5, label: 'Tháng 5', year: 2026 },
      { num: 6, label: 'Tháng 6', year: 2026 },
      { num: 7, label: 'Tháng 7', year: 2026 },
    ];

    return months.map(m => {
      const monthlyDeliveries = relatedDeliveries.filter(del => {
        const dateParts = String(del['Ngày giao'] || '').split('/');
        if (dateParts.length === 3) {
          const monthVal = parseInt(dateParts[1]);
          const yearVal = parseInt(dateParts[2]);
          return monthVal === m.num && yearVal === m.year;
        }
        if (del['Tháng']) {
          return parseInt(del['Tháng']) === m.num;
        }
        return false;
      });

      const deliveredQty = monthlyDeliveries.reduce((sum, del) => {
        const val = parseFloat(String(del['Số lượng giao'] || '0').replace(/,/g, ''));
        return sum + (isNaN(val) ? 0 : val);
      }, 0);

      const orderedQty = monthlyDeliveries.reduce((sum, del) => {
        const val = parseFloat(String(del['Số lượng đặt'] || '0').replace(/,/g, ''));
        return sum + (isNaN(val) ? 0 : val);
      }, 0);

      return {
        name: m.label,
        'Thực giao': deliveredQty,
        'Đặt hàng': orderedQty,
      };
    });
  }, [relatedDeliveries]);

  // Overall statistics for highlights
  const stats = useMemo(() => {
    const totalDelivered = relatedDeliveries.reduce((sum, del) => {
      const val = parseFloat(String(del['Số lượng giao'] || '0').replace(/,/g, ''));
      return sum + (isNaN(val) ? 0 : val);
    }, 0);

    const totalOrdered = relatedDeliveries.reduce((sum, del) => {
      const val = parseFloat(String(del['Số lượng đặt'] || '0').replace(/,/g, ''));
      return sum + (isNaN(val) ? 0 : val);
    }, 0);

    const totalRevenue = relatedDeliveries.reduce((sum, del) => {
      const val = parseFloat(String(del['Doanh thu'] || '0').replace(/,/g, ''));
      return sum + (isNaN(val) ? 0 : val);
    }, 0);

    const nextDelivery = [...relatedDeliveryPlans].sort((a, b) => {
      const dateA = String(a['Ngày dự kiến'] || '').split('/').reverse().join('-');
      const dateB = String(b['Ngày dự kiến'] || '').split('/').reverse().join('-');
      return dateA.localeCompare(dateB);
    })[0];

    return {
      totalDelivered,
      totalOrdered,
      totalRevenue,
      nextDelivery,
    };
  }, [relatedDeliveries, relatedDeliveryPlans]);

  const currencyFormatter = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });
  const numberFormatter = new Intl.NumberFormat('vi-VN');

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 sm:p-6">
      <div className={clsx(
        "bg-white rounded-2xl shadow-2xl w-full flex flex-col overflow-hidden transition-all duration-200 animate-in fade-in zoom-in-95",
        isMaximized ? "max-w-7xl h-[95vh]" : "max-w-5xl max-h-[90vh]"
      )}>
        
        {/* Apple macOS Window Header */}
        <div className="px-6 py-4 border-b border-black/[0.06] flex justify-between items-center bg-[#F5F5F7]">
          <div className="flex items-center gap-4">
            <MacTrafficLights 
              onClose={onClose} 
              onMaximize={() => setIsMaximized(!isMaximized)}
              isMaximized={isMaximized}
            />
            <div className="h-4 w-px bg-black/[0.08]" />
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-2xs">
                <Package size={20} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[#1D1D1F]">{product['Tên sản phẩm']}</h2>
                {product['Mã sản phẩm'] && (
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-semibold px-2 py-0.5 bg-gray-200 text-gray-700 rounded-md">
                      {product['Mã sản phẩm']}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">
                      {product['Nhóm hàng']} • {product['Đơn Vị Tính']}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 px-6 bg-white shrink-0">
          <button 
            className={`py-3 px-4 font-semibold text-sm border-b-2 transition-colors ${activeTab === 'overview' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('overview')}
          >
            Tổng quan Sản phẩm
          </button>
          <button 
            className={`py-3 px-4 font-semibold text-sm border-b-2 transition-colors ${activeTab === 'details' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('details')}
          >
            Thông tin chi tiết & Lịch sử ({relatedDeliveryPlans.length + relatedPoLines.length + relatedDeliveries.length})
          </button>
          <button 
            className={`py-3 px-4 font-semibold text-sm border-b-2 transition-colors ${activeTab === 'specs' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('specs')}
          >
            Tiêu chuẩn kỹ thuật (Specs)
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50/30">
          
          {activeTab === 'overview' ? (
            <div className="space-y-8 animate-in fade-in duration-500">
              {/* Main Visual & Key Stats Section */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left: Product Image / Design */}
                <div className="lg:col-span-4 space-y-4">
                  <div className="aspect-[4/5] bg-white rounded-[2.5rem] overflow-hidden border-4 border-white shadow-2xl relative group">
                    <img 
                      src={productImages[0]} 
                      alt={product['Tên sản phẩm']} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-8">
                      <div className="text-white">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-2 opacity-80">TSG Visual Standard</p>
                        <h4 className="text-lg font-bold">Hình ảnh tham chiếu định chuẩn</h4>
                      </div>
                    </div>
                    <div className="absolute top-6 right-6 px-4 py-1.5 bg-white/90 backdrop-blur shadow-sm rounded-full">
                      <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">{product['Nhóm hàng']}</span>
                    </div>
                  </div>
                  
                  {productImages.length > 1 && (
                    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                      {productImages.map((img, idx) => (
                        <button 
                          key={idx} 
                          className={clsx(
                            "w-20 h-20 rounded-2xl bg-white border-2 overflow-hidden flex-shrink-0 transition-all",
                            idx === 0 ? "border-blue-500 shadow-md" : "border-transparent opacity-60 hover:opacity-100"
                          )}
                        >
                          <img src={img} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Right: Technical Highlights & Core Stats */}
                <div className="lg:col-span-8 space-y-6">
                  {/* Top Stats Row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-blue-600 p-8 rounded-[2.5rem] text-white shadow-xl shadow-blue-600/20 relative overflow-hidden group">
                      <div className="absolute -right-8 -bottom-8 opacity-10 group-hover:scale-110 transition-transform duration-700">
                        <Package size={200} />
                      </div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-1 opacity-80">Trạng thái định mức</p>
                      <h4 className="text-3xl font-black mb-6">Đang kinh doanh</h4>
                      <div className="flex items-center justify-between pt-6 border-t border-white/20">
                        <div>
                          <p className="text-[10px] font-bold uppercase opacity-60">Đơn vị tính</p>
                          <p className="font-bold text-lg">{product['Đơn vị tính'] || 'Cái'}</p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-3 mb-6">
                          <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                            <Activity size={20} />
                          </div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Hiệu suất cung ứng 2026</p>
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                          <div>
                            <p className="text-2xl font-black text-slate-900">{numberFormatter.format(stats.totalDelivered)}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Sản lượng đã giao</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bar Chart Section */}
              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="text-blue-500" size={18} />
                    <h3 className="font-bold text-gray-800 text-sm md:text-base">Sản lượng giao hàng & Đặt hàng (6 tháng gần đây)</h3>
                  </div>
                  <span className="text-xs text-gray-400 font-mono">Dữ liệu 2026</span>
                </div>
                <div className="h-64 sm:h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={chartData}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} stroke="#64748b" />
                      <YAxis tickLine={false} axisLine={false} fontSize={12} stroke="#64748b" />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        labelStyle={{ fontWeight: '600', color: '#1e293b' }}
                      />
                      <Legend verticalAlign="top" height={36} iconType="circle" />
                      <Bar dataKey="Thực giao" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={24} />
                      <Bar dataKey="Đặt hàng" fill="#94a3b8" radius={[4, 4, 0, 0]} barSize={24} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Specs and Details Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Linked Specs Summary */}
                <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="text-blue-600" size={18} />
                      <h4 className="font-bold text-gray-800">Tiêu chuẩn kỹ thuật (Specs)</h4>
                    </div>
                    {relatedSpecs.length > 0 && (
                      <button 
                        onClick={() => setActiveTab('specs')}
                        className="text-xs font-bold text-blue-600 hover:underline"
                      >
                        Xem tất cả
                      </button>
                    )}
                  </div>
                  
                  {relatedSpecs.length > 0 ? (
                    <div className="space-y-4">
                      {relatedSpecs.slice(0, 2).map((spec, sidx) => (
                        <div key={sidx} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-sm font-bold text-slate-900">{spec['Tên tiêu chuẩn']}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-200 text-slate-600 rounded">
                              {spec['Mã Spec']}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            {spec['Chất liệu'] && (
                              <div className="flex items-center gap-1 text-slate-500">
                                <span className="font-semibold text-slate-700">Chất liệu:</span> {spec['Chất liệu']}
                              </div>
                            )}
                            {spec['Kích thước'] && (
                              <div className="flex items-center gap-1 text-slate-500">
                                <span className="font-semibold text-slate-700">Kích thước:</span> {spec['Kích thước']}
                              </div>
                            )}
                            {spec['Độ dày/Định lượng'] && (
                              <div className="flex items-center gap-1 text-slate-500">
                                <span className="font-semibold text-slate-700">Định lượng:</span> {spec['Độ dày/Định lượng']}
                              </div>
                            )}
                            {spec['Màu sắc/In ấn'] && (
                              <div className="flex items-center gap-1 text-slate-500">
                                <span className="font-semibold text-slate-700">In ấn:</span> {spec['Màu sắc/In ấn']}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                      {relatedSpecs.length > 2 && (
                        <p className="text-center text-xs text-slate-400 italic">Còn {relatedSpecs.length - 2} tiêu chuẩn khác...</p>
                      )}
                    </div>
                  ) : (
                    <div className="p-8 text-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                      <p className="text-xs text-slate-400">Chưa có tiêu chuẩn kỹ thuật nào được liên kết.</p>
                    </div>
                  )}
                </div>

                {/* General Info Card */}
                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <FileText className="text-blue-500" size={18} />
                      <h4 className="font-bold text-gray-800">Thuộc tính chính</h4>
                    </div>
                    <div className="space-y-3">
                      <div className="p-3 bg-gray-50 rounded-xl">
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Nhà cung cấp</p>
                        <p className="text-sm font-semibold text-gray-800">{product['Mã Nhà Cung Cấp'] || '-'}</p>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-xl">
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Trọng lượng riêng</p>
                        <p className="text-sm font-semibold text-gray-800">{product['Trọng lượng riêng'] || '-'}</p>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-xl">
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Tình trạng</p>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold mt-0.5 ${
                          product['Tình trạng'] === 'Sắp mở bán' ? 'bg-amber-100 text-amber-800' : 
                          product['Tình trạng'] === 'Đang kinh doanh' ? 'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {product['Tình trạng'] || '-'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Next Delivery Plan Card */}
              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="text-orange-500" size={18} />
                  <h4 className="font-bold text-gray-800">Lịch giao hàng sắp tới tiếp theo</h4>
                </div>
                {stats.nextDelivery ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-orange-50/40 p-4 rounded-xl border border-orange-100">
                    <div className="flex flex-col gap-1">
                      <p className="text-xs text-gray-500 font-medium">Kế hoạch</p>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-orange-800">{stats.nextDelivery['Mã kế hoạch']}</span>
                        <span className="text-xs font-medium text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded">
                          {stats.nextDelivery['Ngày dự kiến']}
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-medium">Khách hàng</p>
                      <p className="font-bold text-gray-800 truncate">{stats.nextDelivery['Khách hàng']}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500 font-medium">Số lượng cần giao</p>
                      <p className="text-lg font-black text-gray-900">{numberFormatter.format(stats.nextDelivery['Số lượng cần giao'])} {product['Đơn Vị Tính']}</p>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 text-center text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                    <p className="text-sm">Không có kế hoạch giao hàng sắp tới.</p>
                  </div>
                )}
              </div>

              {/* Technical Comparison Section */}
              {comparisonData.length > 0 && (
                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="text-blue-600" size={18} />
                    <h4 className="font-bold text-gray-800 uppercase text-xs tracking-widest">Phân tích kỹ thuật & Giá (Cùng nhóm: {product['Nhóm hàng']})</h4>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="py-2 px-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Sản phẩm</th>
                          <th className="py-2 px-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Giá bán</th>
                          <th className="py-2 px-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Spec chính</th>
                          <th className="py-2 px-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Đánh giá kỹ thuật</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {/* Current Product */}
                        <tr className="bg-blue-50/50">
                          <td className="py-3 px-3">
                            <p className="text-sm font-bold text-blue-700">{product['Tên sản phẩm']} (Đang xem)</p>
                            <p className="text-[10px] text-blue-500 font-mono">{product['Mã sản phẩm']}</p>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <p className="text-sm font-black text-slate-900">
                              {pricingData.find(pr => pr['Tên sản phẩm'] === product['Tên sản phẩm'])?.['Giá bán (TSG→KH)'] || '—'}
                            </p>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <div className="flex flex-col items-center">
                              <span className="text-xs font-bold text-slate-700">
                                {relatedSpecs[0]?.['Độ dày/Định lượng'] || relatedSpecs[0]?.['Kích thước'] || 'N/A'}
                              </span>
                              <span className="text-[10px] text-slate-400 italic font-medium">
                                {relatedSpecs[0]?.['Chất liệu'] || '—'}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex flex-col gap-1">
                              <p className="text-[10px] text-slate-600 line-clamp-1">
                                {relatedSpecs[0]?.['Ghi chú'] || 'Đạt chuẩn kỹ thuật TSG'}
                              </p>
                              <div className="flex gap-1">
                                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                              </div>
                            </div>
                          </td>
                        </tr>
                        {/* Comparison Products */}
                        {comparisonData.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="py-3 px-3">
                              <p className="text-sm font-semibold text-slate-700">{item.product['Tên sản phẩm']}</p>
                              <p className="text-[10px] text-slate-400 font-mono">{item.product['Mã sản phẩm']}</p>
                            </td>
                            <td className="py-3 px-3 text-right">
                              <p className="text-sm font-bold text-slate-600">
                                {item.pricing?.['Giá bán (TSG→KH)'] || '—'}
                              </p>
                            </td>
                            <td className="py-3 px-3 text-center">
                              <div className="flex flex-col items-center">
                                <span className="text-xs font-medium text-slate-600">
                                  {item.specs[0]?.['Độ dày/Định lượng'] || item.specs[0]?.['Kích thước'] || '—'}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  {item.specs[0]?.['Chất liệu'] || '—'}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <p className="text-[10px] text-slate-400 line-clamp-1 italic">
                                {item.specs[0]?.['Ghi chú'] || 'Đang cập nhật đánh giá'}
                              </p>
                            </td>
                            <td className="py-3 px-3 text-right">
                               <button 
                                 onClick={() => setCompareWithId(item.product['Mã sản phẩm'])}
                                 className="px-3 py-1 bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-600 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
                               >
                                 So sánh
                               </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Side-by-Side Comparison Modal-like View */}
              <AnimatePresence>
                {compareWithId && compareProduct && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="fixed inset-0 z-[110] flex items-center justify-center p-4 md:p-8 bg-slate-900/40 backdrop-blur-md"
                  >
                    <div className="bg-white w-full max-w-5xl h-full max-h-[90vh] rounded-[3rem] shadow-2xl flex flex-col overflow-hidden border border-white">
                      <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center">
                            <TrendingUp size={24} />
                          </div>
                          <div>
                            <h2 className="text-2xl font-black text-slate-900">So sánh kỹ thuật hệ thống</h2>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Technical Benchmarking</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => setCompareWithId(null)}
                          className="p-3 bg-slate-100 text-slate-500 hover:bg-slate-200 rounded-full transition-colors"
                        >
                          <X size={24} />
                        </button>
                      </div>

                      <div className="flex-1 overflow-y-auto p-8 space-y-12">
                        {/* Headers */}
                        <div className="grid grid-cols-2 gap-12">
                          <div className="space-y-4">
                            <div className="aspect-video bg-blue-50 rounded-3xl overflow-hidden border-2 border-blue-100 flex items-center justify-center p-8">
                               <img src={productImages[0]} className="max-w-full max-h-full object-contain" alt={product['Tên sản phẩm']} referrerPolicy="no-referrer" />
                            </div>
                            <div>
                              <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1">Sản phẩm hiện tại</p>
                              <h3 className="text-xl font-black text-slate-900">{product['Tên sản phẩm']}</h3>
                              <p className="text-xs font-mono text-slate-400">{product['Mã sản phẩm']}</p>
                            </div>
                          </div>
                          <div className="space-y-4">
                            <div className="aspect-video bg-slate-50 rounded-3xl overflow-hidden border-2 border-slate-100 flex items-center justify-center p-8">
                               <img 
                                src={compareProduct['Hình ảnh'] || "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=200&auto=format&fit=crop"} 
                                className="max-w-full max-h-full object-contain" 
                                alt={compareProduct['Tên sản phẩm']} 
                                referrerPolicy="no-referrer"
                              />
                            </div>
                            <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Đối tượng so sánh</p>
                              <h3 className="text-xl font-black text-slate-900">{compareProduct['Tên sản phẩm']}</h3>
                              <p className="text-xs font-mono text-slate-400">{compareProduct['Mã sản phẩm']}</p>
                            </div>
                          </div>
                        </div>

                        {/* Specs Comparison Table */}
                        <div className="bg-slate-50 rounded-3xl p-1 overflow-hidden border border-slate-100">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="border-b border-slate-100">
                                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tiêu chí kỹ thuật</th>
                                <th className="p-6 text-sm font-black text-blue-600 bg-blue-50/30">{product['Tên sản phẩm']}</th>
                                <th className="p-6 text-sm font-black text-slate-700">{compareProduct['Tên sản phẩm']}</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {[
                                { label: 'Nhóm hàng', key: 'Nhóm hàng' },
                                { label: 'Chất liệu', specKey: 'Chất liệu' },
                                { label: 'Định lượng', specKey: 'Độ dày/Định lượng' },
                                { label: 'Kích thước', specKey: 'Kích thước' },
                                { label: 'Màu sắc', specKey: 'Màu sắc' },
                                { label: 'Dung sai', specKey: 'Dung sai' },
                                { label: 'Thiết kế', specKey: 'Mô tả bản vẽ' },
                                { label: 'Đơn giá bán', priceKey: 'Giá bán (TSG→KH)' },
                              ].map((row, idx) => {
                                const val1 = row.key ? product[row.key] : 
                                            row.specKey ? relatedSpecs[0]?.[row.specKey] :
                                            row.priceKey ? pricingData.find(p => p['Tên sản phẩm'] === product['Tên sản phẩm'])?.[row.priceKey] : '—';
                                
                                const val2 = row.key ? compareProduct[row.key] :
                                            row.specKey ? compareSpecs[0]?.[row.specKey] :
                                            row.priceKey ? pricingData.find(p => p['Tên sản phẩm'] === compareProduct['Tên sản phẩm'])?.[row.priceKey] : '—';

                                return (
                                  <tr key={idx} className="group hover:bg-white transition-colors">
                                    <td className="p-6">
                                      <p className="text-xs font-bold text-slate-400 group-hover:text-slate-600 transition-colors uppercase tracking-wider">{row.label}</p>
                                    </td>
                                    <td className="p-6 bg-blue-50/10">
                                      <p className="text-sm font-bold text-slate-900">{val1 || '—'}</p>
                                    </td>
                                    <td className="p-6">
                                      <p className="text-sm font-semibold text-slate-600">{val2 || '—'}</p>
                                      {val1 !== val2 && val1 && val2 && (
                                        <span className="text-[10px] text-amber-600 font-bold uppercase mt-1 inline-block">Khác biệt</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        <div className="flex items-center gap-2 p-6 bg-blue-50 rounded-3xl border border-blue-100">
                           <Info className="text-blue-500 shrink-0" size={20} />
                           <p className="text-sm text-blue-700 font-medium italic">Dữ liệu được trích xuất từ bảng Specs (Hợp đồng gốc) và bảng giá TSG Business OS đang hiệu lực 2026.</p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : activeTab === 'details' ? (
            <div className="space-y-8">
              
              {/* Delivery Plans */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="text-blue-500" size={18} />
                  <h3 className="text-lg font-bold text-gray-800">Kế hoạch giao hàng sắp tới</h3>
                  <span className="bg-blue-100 text-blue-700 py-0.5 px-2 rounded-full text-xs font-bold ml-2">
                    {relatedDeliveryPlans.length}
                  </span>
                </div>
                
                {relatedDeliveryPlans.length > 0 ? (
                  <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 border-b border-gray-200 text-gray-500">
                          <tr>
                            <th className="px-4 py-3 font-medium">Mã Kế Hoạch</th>
                            <th className="px-4 py-3 font-medium">Đơn hàng</th>
                            <th className="px-4 py-3 font-medium">Ngày dự kiến</th>
                            <th className="px-4 py-3 font-medium text-right">Số lượng</th>
                            <th className="px-4 py-3 font-medium">Trạng thái</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {relatedDeliveryPlans.map((plan, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="px-4 py-3 font-medium text-gray-900">{plan['Mã kế hoạch']}</td>
                              <td className="px-4 py-3">
                                <span 
                                  className="text-emerald-600 font-semibold hover:text-emerald-800 hover:underline cursor-pointer"
                                  onClick={() => onPoClick && onPoClick(plan['Đơn hàng'])}
                                >
                                  {plan['Đơn hàng']}
                                </span>
                              </td>
                              <td className="px-4 py-3 font-medium text-blue-600">{plan['Ngày dự kiến']}</td>
                              <td className="px-4 py-3 text-right font-medium">{numberFormatter.format(plan['Số lượng cần giao'])}</td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                  plan['Trạng thái'] === 'Mới' ? 'bg-blue-50 text-blue-700' :
                                  plan['Trạng thái'] === 'Đang xử lý' ? 'bg-amber-50 text-amber-700' :
                                  'bg-gray-50 text-gray-700'
                                }`}>
                                  {plan['Trạng thái']}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-dashed border-gray-300 p-6 flex flex-col items-center justify-center text-gray-500">
                    <AlertCircle size={24} className="mb-2 text-gray-400" />
                    <p>Không có kế hoạch giao hàng nào cho sản phẩm này.</p>
                  </div>
                )}
              </section>

              {/* PO Lines */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <ShoppingCart className="text-emerald-500" size={18} />
                  <h3 className="text-lg font-bold text-gray-800">Đơn hàng (PO Lines)</h3>
                  <span className="bg-emerald-100 text-emerald-700 py-0.5 px-2 rounded-full text-xs font-bold ml-2">
                    {relatedPoLines.length}
                  </span>
                </div>
                
                {relatedPoLines.length > 0 ? (
                  <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 border-b border-gray-200 text-gray-500">
                          <tr>
                            <th className="px-4 py-3 font-medium">Số đơn hàng</th>
                            <th className="px-4 py-3 font-medium">Ngày giao</th>
                            <th className="px-4 py-3 font-medium text-right">Số lượng</th>
                            <th className="px-4 py-3 font-medium text-right">Đơn giá bán</th>
                            <th className="px-4 py-3 font-medium">Tiến độ SP</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {relatedPoLines.map((po, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="px-4 py-3">
                                <span 
                                  className="text-emerald-600 font-semibold hover:text-emerald-800 hover:underline cursor-pointer"
                                  onClick={() => onPoClick && onPoClick(po['Số đơn hàng'])}
                                >
                                  {po['Số đơn hàng']}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-gray-600">{po['Ngày giao']}</td>
                              <td className="px-4 py-3 text-right font-medium">{numberFormatter.format(po['Số lượng'])}</td>
                              <td className="px-4 py-3 text-right text-gray-600 font-medium">{po['Đơn giá bán']}</td>
                              <td className="px-4 py-3 text-xs text-gray-500">{po['Tiến độ sản phẩm'] || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-dashed border-gray-300 p-6 flex flex-col items-center justify-center text-gray-500">
                    <AlertCircle size={24} className="mb-2 text-gray-400" />
                    <p>Sản phẩm này chưa xuất hiện trong đơn hàng nào.</p>
                  </div>
                )}
              </section>

              {/* Deliveries */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Truck className="text-purple-500" size={18} />
                  <h3 className="text-lg font-bold text-gray-800">Lịch sử giao hàng (PXK)</h3>
                  <span className="bg-purple-100 text-purple-700 py-0.5 px-2 rounded-full text-xs font-bold ml-2">
                    {relatedDeliveries.length}
                  </span>
                </div>
                
                {relatedDeliveries.length > 0 ? (
                  <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 border-b border-gray-200 text-gray-500">
                          <tr>
                            <th className="px-4 py-3 font-medium">Số PXK</th>
                            <th className="px-4 py-3 font-medium">Đơn hàng</th>
                            <th className="px-4 py-3 font-medium">Ngày giao</th>
                            <th className="px-4 py-3 font-medium text-right">SL Giao / Đặt</th>
                            <th className="px-4 py-3 font-medium">Tiến độ</th>
                            <th className="px-4 py-3 font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {relatedDeliveries.map((del, idx) => {
                            const percent = parseFloat(String(del['Tiến độ giao'] || '0').replace('%',''));
                            return (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="px-4 py-3 font-medium text-gray-900">{del['Số PXK'] || '-'}</td>
                              <td className="px-4 py-3">
                                <span 
                                  className="text-emerald-600 font-semibold hover:text-emerald-800 hover:underline cursor-pointer"
                                  onClick={() => onPoClick && onPoClick(del['Đơn hàng'])}
                                >
                                  {del['Đơn hàng'] || '-'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-gray-600">{del['Ngày giao']}</td>
                              <td className="px-4 py-3 text-right">
                                <span className="font-medium text-gray-900">{numberFormatter.format(del['Số lượng giao'])}</span>
                                <span className="text-gray-400 mx-1">/</span>
                                <span className="text-gray-500">{numberFormatter.format(del['Số lượng đặt'])}</span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                     <div className={`h-full ${percent >= 100 ? 'bg-green-500' : 'bg-orange-500'}`} style={{ width: `${Math.min(100, percent)}%` }}></div>
                                  </div>
                                  <span className="text-xs font-medium text-gray-700">{del['Tiến độ giao']}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                 <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                                    del['Status'] === 'Hoàn thành' ? 'bg-green-100 text-green-700 border-green-200' :
                                    del['Status'] === 'Đang tiến hành' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                                    'bg-gray-100 text-gray-700 border-gray-200'
                                 }`}>
                                   {del['Status']}
                                 </span>
                              </td>
                            </tr>
                          )})}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-dashed border-gray-300 p-6 flex flex-col items-center justify-center text-gray-500">
                    <AlertCircle size={24} className="mb-2 text-gray-400" />
                    <p>Chưa có dữ liệu giao hàng thực tế cho sản phẩm này.</p>
                  </div>
                )}
              </section>

            </div>
          ) : (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="text-blue-600" size={18} />
                <h3 className="text-lg font-bold text-gray-800">Thông số kỹ thuật định chuẩn</h3>
              </div>

              {relatedSpecs.length > 0 ? (
                <div className="grid grid-cols-1 gap-6">
                  {relatedSpecs.map((spec, sidx) => (
                    <div key={sidx} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                      <div className="bg-slate-900 px-6 py-3 flex justify-between items-center">
                        <h4 className="text-white font-bold text-sm">{spec['Tên tiêu chuẩn']}</h4>
                        <span className="text-[10px] font-mono text-slate-400 px-2 py-0.5 bg-white/10 rounded tracking-wider">
                          {spec['Mã Spec']}
                        </span>
                      </div>
                      <div className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                          <div className="space-y-4">
                            <div className="flex items-start gap-3">
                              <Layers className="text-slate-400 mt-0.5" size={16} />
                              <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Chất liệu</p>
                                <p className="text-sm text-slate-700 font-semibold">{spec['Chất liệu'] || '—'}</p>
                              </div>
                            </div>
                            <div className="flex items-start gap-3">
                              <Ruler className="text-slate-400 mt-0.5" size={16} />
                              <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Kích thước / Định lượng</p>
                                <p className="text-sm text-slate-700 font-semibold">
                                  {spec['Kích thước']} {spec['Độ dày/Định lượng'] ? `(${spec['Độ dày/Định lượng']})` : ''}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div className="flex items-start gap-3">
                              <Palette className="text-slate-400 mt-0.5" size={16} />
                              <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Màu sắc / In ấn</p>
                                <p className="text-sm text-slate-700 font-semibold">{spec['Màu sắc/In ấn'] || '—'}</p>
                              </div>
                            </div>
                            <div className="flex items-start gap-3">
                              <ShieldCheck className="text-slate-400 mt-0.5" size={16} />
                              <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Dung sai cho phép</p>
                                <p className="text-sm text-slate-700 font-semibold">{spec['Dung sai'] || '—'}</p>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div className="flex items-start gap-3">
                              <Package className="text-slate-400 mt-0.5" size={16} />
                              <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Quy cách đóng gói</p>
                                <p className="text-xs text-slate-600 leading-relaxed italic">{spec['Quy cách đóng gói'] || '—'}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {(spec['Ghi chú'] || spec['Ngày cập nhật']) && (
                          <div className="mt-6 pt-6 border-t border-slate-50 flex flex-col md:flex-row justify-between gap-4">
                            <div className="flex-1">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Ghi chú kỹ thuật</p>
                              <p className="text-xs text-slate-500 italic">{spec['Ghi chú'] || 'Không có ghi chú thêm.'}</p>
                            </div>
                            <div className="text-right flex flex-col justify-end">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ngày cập nhật Spec</p>
                              <p className="text-xs font-mono text-slate-500">{spec['Ngày cập nhật']}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-3xl border-2 border-dashed border-slate-100 p-12 text-center">
                  <ShieldCheck className="mx-auto text-slate-200 mb-4" size={48} />
                  <p className="text-slate-500 font-bold">Chưa có thông số kỹ thuật (Specs)</p>
                  <p className="text-slate-400 text-xs mt-1">Sản phẩm này chưa được gán tiêu chuẩn định chuẩn chính thức.</p>
                </div>
              )}
            </div>
          )}
          
        </div>
      </div>
    </div>
  );
}
