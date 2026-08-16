import React, { useMemo, useState } from 'react';
import { 
  FileText, 
  Calendar, 
  TrendingUp, 
  DollarSign, 
  Activity, 
  X, 
  AlertCircle, 
  ShoppingCart, 
  Truck, 
  CheckCircle,
  Package,
  AlertTriangle,
  Clock,
  PlusCircle,
  Layers
} from 'lucide-react';
import { DualPODocumentModal } from './DualPODocumentModal';
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
import { ProductHoverCard } from './ProductHoverCard';
import { ProductCombobox } from './ProductCombobox';
import { PricingCombobox } from './PricingCombobox';
import clsx from 'clsx';
import MacTrafficLights from './MacTrafficLights';

interface PODetailModalProps {
  poNumber: string;
  onClose: () => void;
  poHeaderData: any[];
  poLinesData: any[];
  deliveryData: any[];
  deliveryPlanData: any[];
  productData?: any[];
  pricingData?: any[];
  supplierData?: any[];
  onProductClick?: (productNameOrId: string) => void;
  onAddPOLine?: (row: any) => void;
}

export function PODetailModal({ 
  poNumber, 
  onClose, 
  poHeaderData, 
  poLinesData, 
  deliveryData, 
  deliveryPlanData,
  productData = [],
  pricingData = [],
  supplierData = [],
  onProductClick,
  onAddPOLine
}: PODetailModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'details'>('overview');
  const [isMaximized, setIsMaximized] = useState(false);
  const [showAddLineForm, setShowAddLineForm] = useState(false);
  const [showDualPOModal, setShowDualPOModal] = useState(false);
  const [newLineData, setNewLineData] = useState<any>({
    'Tên sản phẩm': '',
    'Mã giá bán': '',
    'Số lượng': '',
    'Ngày đặt hàng': '',
    'Ngày giao': '',
  });

  const cleanPoNumber = useMemo(() => String(poNumber).trim(), [poNumber]);

  const poHeader = useMemo(() => {
    return poHeaderData.find(po => {
      const currentPO = String(po['Đơn hàng'] || po['Số PO'] || po['Số đơn hàng'] || '').trim();
      return currentPO.toLowerCase() === cleanPoNumber.toLowerCase();
    }) || { 'Đơn hàng': cleanPoNumber };
  }, [cleanPoNumber, poHeaderData]);

  // Set default date when poHeader is loaded
  React.useEffect(() => {
    if (poHeader) {
      setNewLineData((prev: any) => ({
        ...prev,
        'Ngày đặt hàng': poHeader['Ngày đặt hàng'] || new Date().toISOString().split('T')[0],
      }));
    }
  }, [poHeader]);

  const handleProductChangeInModal = (val: string) => {
    let product = productData.find(p => p['Mã hàng'] === val || p['Mã sản phẩm'] === val || p['Sản phẩm'] === val || p['Tên sản phẩm'] === val || p.id === val);
    const updates: any = { 'Tên sản phẩm': val };
    
    if (product) {
      const productVal = product['Mã hàng'] || product['Mã sản phẩm'] || product['Sản phẩm'] || product.id;
      updates['Tên sản phẩm'] = product['Tên sản phẩm'] || product['Sản phẩm'] || '';
      updates['ĐVT'] = product['ĐVT'] || product['Đơn vị tính'] || product['Đơn Vị Tính'] || 'Cái';
      updates['Nhóm hàng'] = product['Nhóm hàng'] || product['Phân loại'] || '';
      
      const pricingList = pricingData.filter(p => p['Mã sản phẩm'] === productVal);
      if (pricingList.length > 0) {
        const customerName = poHeader['Khách hàng'] || '';
        let pricing = pricingList.find(p => p['RP_Khách hàng'] === customerName);
        if (!pricing) pricing = pricingList[0];
        
        if (pricing) {
          updates['Mã của khách'] = product['Mã của khách'] || pricing['Mã sản phẩm'] || '';
          updates['Mã giá bán'] = pricing['Mã giá bán'] || '';
          updates['Đơn giá bán'] = pricing['Đơn giá bán'] || '';
          updates['Đơn giá nhập'] = pricing['Đơn giá mua'] || pricing['Đơn giá nhập'] || '';
          updates['Lợi nhuận'] = pricing['Lợi nhuận'] || '';
          
          const qty = parseFloat(newLineData['Số lượng'] || '0');
          const price = parseFloat(String(pricing['Đơn giá bán'] || '0').replace(/[^0-9.-]+/g, ""));
          if (!isNaN(qty) && !isNaN(price)) {
            updates['Thành tiền dòng'] = (qty * price).toLocaleString('vi-VN');
          }
        }
      } else {
        updates['Mã của khách'] = product['Mã của khách'] || '';
      }
    }
    setNewLineData((prev: any) => ({ ...prev, ...updates }));
  };

  const handlePriceChangeInModal = (val: string) => {
    const pricing = pricingData.find(p => p['Mã giá bán'] === val);
    const updates: any = { 'Mã giá bán': val };
    
    if (pricing) {
      updates['Mã của khách'] = pricing['Mã sản phẩm'] || '';
      updates['Đơn giá bán'] = pricing['Đơn giá bán'] || '';
      updates['Đơn giá nhập'] = pricing['Đơn giá mua'] || pricing['Đơn giá nhập'] || '';
      updates['Lợi nhuận'] = pricing['Lợi nhuận'] || '';
      
      const product = productData.find(p => p['Mã sản phẩm'] === pricing['Mã sản phẩm']);
      if (product) {
        updates['ĐVT'] = product['ĐVT'] || product['Đơn vị tính'] || product['Đơn Vị Tính'] || 'Cái';
        updates['Nhóm hàng'] = product['Nhóm hàng'] || product['Phân loại'] || '';
        updates['Tên sản phẩm'] = product['Tên sản phẩm'] || product['Sản phẩm'] || pricing['Tên sản phẩm'] || '';
      } else {
        updates['Tên sản phẩm'] = pricing['Tên sản phẩm'] || '';
      }
      
      const qty = parseFloat(newLineData['Số lượng'] || '0');
      const price = parseFloat(String(pricing['Đơn giá bán'] || '0').replace(/[^0-9.-]+/g, ""));
      if (!isNaN(qty) && !isNaN(price)) {
        updates['Thành tiền dòng'] = (qty * price).toLocaleString('vi-VN');
      }
    }
    setNewLineData((prev: any) => ({ ...prev, ...updates }));
  };

  const handleQtyChangeInModal = (val: string) => {
    const updates: any = { 'Số lượng': val };
    const qty = parseFloat(val || '0');
    const price = parseFloat(String(newLineData['Đơn giá bán'] || '0').replace(/[^0-9.-]+/g, ""));
    if (!isNaN(qty) && !isNaN(price)) {
      updates['Thành tiền dòng'] = (qty * price).toLocaleString('vi-VN');
    }
    setNewLineData((prev: any) => ({ ...prev, ...updates }));
  };

  const handleAddLineSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLineData['Tên sản phẩm'] || !newLineData['Mã giá bán'] || !newLineData['Số lượng']) {
      alert("Vui lòng điền đủ Tên sản phẩm, Mã giá bán và Số lượng");
      return;
    }
    
    if (onAddPOLine) {
      onAddPOLine({
        'Số đơn hàng': cleanPoNumber,
        'Khách hàng': poHeader['Khách hàng'] || '',
        ...newLineData
      });
      
      setNewLineData((prev: any) => ({
        ...prev,
        'Tên sản phẩm': '',
        'Mã giá bán': '',
        'Số lượng': '',
        'Ngày giao': '',
      }));
      setShowAddLineForm(false);
    }
  };

  const relatedPoLines = useMemo(() => {
    return poLinesData.filter(line => {
      const currentPO = String(line['Số đơn hàng'] || line['Đơn hàng'] || '').trim();
      return currentPO.toLowerCase() === cleanPoNumber.toLowerCase();
    });
  }, [cleanPoNumber, poLinesData]);

  const relatedDeliveries = useMemo(() => {
    return deliveryData.filter(del => {
      const currentPO = String(del['Đơn hàng'] || del['Số đơn hàng'] || '').trim();
      return currentPO.toLowerCase() === cleanPoNumber.toLowerCase();
    });
  }, [cleanPoNumber, deliveryData]);

  const relatedDeliveryPlans = useMemo(() => {
    return deliveryPlanData.filter(plan => {
      const currentPO = String(plan['Đơn hàng'] || plan['Số đơn hàng'] || '').trim();
      return currentPO.toLowerCase() === cleanPoNumber.toLowerCase();
    });
  }, [cleanPoNumber, deliveryPlanData]);

  // Calculations for stats
  const stats = useMemo(() => {
    let totalOrderedQty = 0;
    let totalDeliveredQty = 0;
    let totalAmount = 0;

    relatedPoLines.forEach(line => {
      const qty = parseFloat(String(line['Số lượng'] || '0').replace(/,/g, ''));
      const price = parseFloat(String(line['Đơn giá bán'] || '0').replace(/,/g, ''));
      totalOrderedQty += isNaN(qty) ? 0 : qty;
      totalAmount += isNaN(qty || price) ? 0 : (qty * price);
    });

    relatedDeliveries.forEach(del => {
      const delQty = parseFloat(String(del['Số lượng giao'] || '0').replace(/,/g, ''));
      totalDeliveredQty += isNaN(delQty) ? 0 : delQty;
    });

    const completionRate = totalOrderedQty > 0 ? (totalDeliveredQty / totalOrderedQty) * 100 : 0;

    return {
      totalOrderedQty,
      totalDeliveredQty,
      completionRate,
      totalAmount
    };
  }, [relatedPoLines, relatedDeliveries]);

  // Recharts chart data: product breakdown (ordered vs delivered)
  const chartData = useMemo(() => {
    const productGroups: Record<string, { ordered: number, delivered: number }> = {};

    relatedPoLines.forEach(line => {
      const pName = line['Tên sản phẩm'] || line['Mã của khách'] || 'Sản phẩm khác';
      const qty = parseFloat(String(line['Số lượng'] || '0').replace(/,/g, ''));
      if (!productGroups[pName]) {
        productGroups[pName] = { ordered: 0, delivered: 0 };
      }
      productGroups[pName].ordered += isNaN(qty) ? 0 : qty;
    });

    relatedDeliveries.forEach(del => {
      const pName = del['Tên sản phẩm'] || del['Mã sản phẩm'] || 'Sản phẩm khác';
      const qty = parseFloat(String(del['Số lượng giao'] || '0').replace(/,/g, ''));
      if (!productGroups[pName]) {
        productGroups[pName] = { ordered: 0, delivered: 0 };
      }
      productGroups[pName].delivered += isNaN(qty) ? 0 : qty;
    });

    return Object.entries(productGroups).map(([name, vals]) => ({
      name: name.length > 25 ? name.substring(0, 22) + '...' : name,
      fullName: name,
      'Số lượng đặt': vals.ordered,
      'Số lượng giao': vals.delivered,
    }));
  }, [relatedPoLines, relatedDeliveries]);

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
              <div className="h-10 w-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-2xs">
                <ShoppingCart size={20} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[#1D1D1F]">Chi tiết Đơn hàng: {poHeader['Đơn hàng']}</h2>
                <div className="flex flex-wrap items-center gap-2 mt-0.5">
                  {poHeader['Khách hàng'] && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 bg-blue-100 text-blue-800 rounded">
                      Khách hàng: {poHeader['Khách hàng']}
                    </span>
                  )}
                  {poHeader['Phân loại'] && (
                    <span className="text-xs text-slate-500 font-medium">
                      {poHeader['Phân loại']}
                    </span>
                  )}
                  {poHeader['Trạng Thái'] && (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                      poHeader['Trạng Thái'] === 'Hoàn thành' ? 'bg-green-100 text-green-800' : 
                      poHeader['Trạng Thái'] === 'Mới nhận' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {poHeader['Trạng Thái']}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 bg-white shrink-0">
          <div className="flex">
            <button 
              className={`py-3 px-4 font-semibold text-sm border-b-2 transition-colors ${activeTab === 'overview' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              onClick={() => setActiveTab('overview')}
            >
              Tổng quan Đơn hàng (PO)
            </button>
            <button 
              className={`py-3 px-4 font-semibold text-sm border-b-2 transition-colors ${activeTab === 'details' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              onClick={() => setActiveTab('details')}
            >
              Sản phẩm & Lịch giao hàng ({relatedPoLines.length + relatedDeliveryPlans.length + relatedDeliveries.length})
            </button>
          </div>

          <button
            onClick={() => setShowDualPOModal(true)}
            className="my-1.5 px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold transition shadow-sm flex items-center gap-1.5"
          >
            <Layers className="w-3.5 h-3.5" />
            📄 Xem & Xuất Bộ 2 PO (Tâm Sen - AVP)
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50/30">
          
          {activeTab === 'overview' ? (
            <div className="space-y-6">
              
              {/* Order Lifecycle Stepper */}
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <h4 className="text-sm font-bold text-gray-800 mb-6 flex items-center gap-1.5">
                  <Activity className="text-emerald-500" size={18} /> Vòng đời đơn hàng
                </h4>
                <div className="relative flex items-center justify-between w-full px-2">
                  {(() => {
                    const steps = ['Mới tạo', 'Đang xử lý', 'Đang giao', 'Hoàn thành'];
                    let currentStep = 0;
                    if (poHeader['Trạng Thái'] === 'Hoàn thành' || (stats.completionRate >= 100 && stats.totalOrderedQty > 0)) {
                      currentStep = 3;
                    } else if (stats.totalDeliveredQty > 0) {
                      currentStep = 2;
                    } else if (relatedPoLines.length > 0 || relatedDeliveryPlans.length > 0) {
                      currentStep = 1;
                    }

                    return (
                      <>
                        <div className="absolute left-[16px] right-[16px] top-4 h-1 bg-gray-200 rounded-full z-0">
                          <div 
                            className="absolute left-0 top-0 h-full bg-emerald-500 rounded-full z-0 transition-all duration-500"
                            style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
                          ></div>
                        </div>
                        
                        {steps.map((step, idx) => {
                          const isCompleted = idx <= currentStep;
                          const isCurrent = idx === currentStep;
                          return (
                            <div key={step} className="relative z-10 flex flex-col items-center gap-2">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 ${isCompleted ? 'bg-emerald-500 text-white ring-4 ring-white shadow-md' : 'bg-white border-2 border-gray-300 text-gray-400 ring-4 ring-white'}`}>
                                {isCompleted && !isCurrent ? <CheckCircle size={16} /> : idx + 1}
                              </div>
                              <span className={`text-xs font-semibold ${isCurrent ? 'text-emerald-700' : isCompleted ? 'text-gray-800' : 'text-gray-400'}`}>
                                {step}
                              </span>
                            </div>
                          );
                        })}
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Stat Highlight Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3">
                  <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
                    <TrendingUp size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Tổng giá trị đơn</p>
                    <p className="text-base font-bold text-gray-900 truncate" title={poHeader['Tổng giá trị đơn hàng'] || currencyFormatter.format(stats.totalAmount)}>
                      {poHeader['Tổng giá trị đơn hàng'] ? (poHeader['Tổng giá trị đơn hàng'].includes('₫') || poHeader['Tổng giá trị đơn hàng'].includes('VND') ? poHeader['Tổng giá trị đơn hàng'] : currencyFormatter.format(parseFloat(String(poHeader['Tổng giá trị đơn hàng']).replace(/,/g, '')))) : currencyFormatter.format(stats.totalAmount)}
                    </p>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3">
                  <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                    <ShoppingCart size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Tổng sản lượng đặt</p>
                    <p className="text-lg font-bold text-gray-900">{numberFormatter.format(stats.totalOrderedQty)}</p>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3">
                  <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
                    <Truck size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Thực tế đã giao</p>
                    <p className="text-lg font-bold text-gray-900">{numberFormatter.format(stats.totalDeliveredQty)}</p>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3">
                  <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
                    <Activity size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Tiến độ hoàn thành</p>
                    <p className="text-lg font-bold text-amber-600">{stats.completionRate.toFixed(1)}%</p>
                  </div>
                </div>
              </div>

              {/* Progress Bar & File Attachments */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-center">
                  <h4 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-1.5">
                    <CheckCircle className="text-emerald-500" size={16} /> Tiến độ thực hiện đơn hàng chung
                  </h4>
                  <div className="w-full bg-gray-100 h-4 rounded-full overflow-hidden relative">
                    <div 
                      className={`h-full transition-all duration-500 ${stats.completionRate >= 100 ? 'bg-green-500' : 'bg-emerald-500'}`}
                      style={{ width: `${Math.min(100, stats.completionRate)}%` }}
                    />
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-gray-800">
                      {numberFormatter.format(stats.totalDeliveredQty)} / {numberFormatter.format(stats.totalOrderedQty)} đơn vị ({stats.completionRate.toFixed(1)}%)
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-2 text-right italic">Dựa trên đối chiếu số lượng đơn hàng (PO Lines) và số phiếu xuất kho (PXK)</p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-1.5">
                      <FileText className="text-blue-500" size={16} /> Tài liệu đính kèm
                    </h4>
                    {poHeader['Tệp đơn hàng'] ? (
                      <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-100 flex items-center justify-between">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <FileText size={18} className="text-blue-600 shrink-0" />
                          <span className="text-xs font-semibold text-blue-900 truncate" title={poHeader['Tệp đơn hàng']}>
                            {poHeader['Tệp đơn hàng']}
                          </span>
                        </div>
                        <span className="text-[10px] font-medium text-blue-500 hover:underline cursor-pointer shrink-0">Tải xuống</span>
                      </div>
                    ) : (
                      <div className="p-3 bg-gray-50 rounded-lg border border-dashed border-gray-200 flex items-center justify-center text-xs text-gray-400">
                        Chưa tải lên file đơn hàng (PDF/Ảnh)
                      </div>
                    )}
                  </div>
                  <div className="text-[11px] text-gray-400 mt-2">
                    Ngày đặt: {poHeader['Ngày đặt hàng'] || 'Chưa rõ'}
                  </div>
                </div>
              </div>

              {/* Bar Chart Section */}
              {chartData.length > 0 && (
                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="text-emerald-500" size={18} />
                      <h3 className="font-bold text-gray-800 text-sm md:text-base">Sản lượng Giao hàng vs Đặt hàng theo từng mặt hàng</h3>
                    </div>
                  </div>
                  <div className="h-64 sm:h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={chartData}
                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} stroke="#64748b" />
                        <YAxis tickLine={false} axisLine={false} fontSize={11} stroke="#64748b" />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                          labelStyle={{ fontWeight: '600', color: '#1e293b' }}
                        />
                        <Legend verticalAlign="top" height={36} iconType="circle" />
                        <Bar dataKey="Số lượng giao" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                        <Bar dataKey="Số lượng đặt" fill="#cbd5e1" radius={[4, 4, 0, 0]} barSize={20} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

            </div>
          ) : (
            <div className="space-y-8">
              
              {/* Detailed PO Lines */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="text-emerald-500" size={18} />
                    <h3 className="text-lg font-bold text-gray-800">Chi tiết sản phẩm đặt hàng (PO Lines)</h3>
                    <span className="bg-emerald-100 text-emerald-700 py-0.5 px-2 rounded-full text-xs font-bold">
                      {relatedPoLines.length}
                    </span>
                  </div>
                  {onAddPOLine && (
                    <button
                      onClick={() => setShowAddLineForm(!showAddLineForm)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm"
                    >
                      <PlusCircle size={14} />
                      {showAddLineForm ? 'Đóng form' : 'Thêm chi tiết đơn'}
                    </button>
                  )}
                </div>

                {showAddLineForm && (
                  <form onSubmit={handleAddLineSubmit} className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-5 mb-5 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="font-bold text-emerald-800 text-xs uppercase tracking-wider mb-2">Tạo nhanh chi tiết đơn hàng</div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Đơn hàng (PO_Number)</label>
                        <input
                          type="text"
                          disabled
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-100 text-gray-500 outline-none"
                          value={cleanPoNumber}
                        />
                      </div>
                      
                      <div className="md:col-span-2">
                        <ProductCombobox
                          label="Tên sản phẩm"
                          value={newLineData['Tên sản phẩm']}
                          onChange={handleProductChangeInModal}
                          products={productData}
                          labelClassName="block text-xs font-semibold text-gray-600 mb-1"
                        />
                      </div>

                      <div>
                        <PricingCombobox
                          label="Mã giá bán"
                          value={newLineData['Mã giá bán']}
                          onChange={handlePriceChangeInModal}
                          pricingData={pricingData}
                          labelClassName="block text-xs font-semibold text-gray-600 mb-1"
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Số lượng</label>
                        <input
                          type="number"
                          required
                          placeholder="Nhập số lượng"
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                          value={newLineData['Số lượng']}
                          onChange={(e) => handleQtyChangeInModal(e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Ngày giao hàng dự kiến</label>
                        <input
                          type="date"
                          required
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                          value={newLineData['Ngày giao'] || ''}
                          onChange={(e) => setNewLineData((prev: any) => ({ ...prev, 'Ngày giao': e.target.value }))}
                        />
                      </div>
                    </div>

                    {newLineData['Tên sản phẩm'] && (
                      <div className="bg-white border border-emerald-100 rounded-lg p-3 text-xs grid grid-cols-2 md:grid-cols-4 gap-2">
                        <div><span className="text-gray-400">ĐVT:</span> <span className="font-medium text-gray-800">{newLineData['ĐVT'] || 'Cái'}</span></div>
                        <div><span className="text-gray-400">Nhóm hàng:</span> <span className="font-medium text-gray-800">{newLineData['Nhóm hàng'] || 'N/A'}</span></div>
                        <div><span className="text-gray-400">Đơn giá bán:</span> <span className="font-semibold text-emerald-600">{newLineData['Đơn giá bán'] ? `${Number(String(newLineData['Đơn giá bán']).replace(/[^0-9.-]+/g, "")).toLocaleString('vi-VN')}đ` : '0đ'}</span></div>
                        <div><span className="text-gray-400">Thành tiền dòng:</span> <span className="font-bold text-gray-950">{newLineData['Thành tiền dòng'] ? `${newLineData['Thành tiền dòng']}đ` : '0đ'}</span></div>
                      </div>
                    )}

                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowAddLineForm(false)}
                        className="px-4 py-2 border border-gray-200 text-gray-600 text-xs font-semibold rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Hủy bỏ
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
                      >
                        Xác nhận Thêm
                      </button>
                    </div>
                  </form>
                )}
                
                {relatedPoLines.length > 0 ? (
                  <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 border-b border-gray-200 text-gray-500">
                          <tr>
                            <th className="px-4 py-3 font-medium">STT</th>
                            <th className="px-4 py-3 font-medium">Sản phẩm</th>
                            <th className="px-4 py-3 font-medium">Đơn vị</th>
                            <th className="px-4 py-3 font-medium text-right">Số lượng đặt</th>
                            <th className="px-4 py-3 font-medium text-right">Đơn giá bán</th>
                            <th className="px-4 py-3 font-medium text-right">Thành tiền dòng</th>
                            <th className="px-4 py-3 font-medium">Tiến độ SP</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {relatedPoLines.map((po, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-gray-500 font-mono text-xs">{po['STT'] || (idx + 1)}</td>
                              <td className="px-4 py-3">
                                <ProductHoverCard 
                                  productName={po['Tên sản phẩm'] || po['Mã của khách'] || ''} 
                                  productCode={po['Mã sản phẩm'] || po['Mã giá'] || ''} 
                                  pricingData={pricingData}
                                >
                                  <span 
                                    className="text-blue-600 font-medium hover:text-blue-800 hover:underline cursor-pointer"
                                    onClick={() => {
                                      if (onProductClick) {
                                        onProductClick(po['Tên sản phẩm'] || po['Mã của khách'] || '');
                                      }
                                    }}
                                  >
                                    {po['Tên sản phẩm'] || po['Mã của khách']}
                                  </span>
                                </ProductHoverCard>
                              </td>
                              <td className="px-4 py-3 text-gray-600">{po['ĐVT'] || 'Cái'}</td>
                              <td className="px-4 py-3 text-right font-medium">{numberFormatter.format(parseFloat(String(po['Số lượng'] || '0').replace(/,/g, '')))}</td>
                              <td className="px-4 py-3 text-right text-gray-600 font-medium">
                                {po['Đơn giá bán'] ? (po['Đơn giá bán'].includes('₫') ? po['Đơn giá bán'] : currencyFormatter.format(parseFloat(String(po['Đơn giá bán']).replace(/,/g, '')))) : '-'}
                              </td>
                              <td className="px-4 py-3 text-right text-emerald-600 font-bold">
                                {po['Thành tiền dòng'] ? (po['Thành tiền dòng'].includes('₫') ? po['Thành tiền dòng'] : currencyFormatter.format(parseFloat(String(po['Thành tiền dòng']).replace(/,/g, '')))) : '-'}
                              </td>
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
                    <p>Không có sản phẩm chi tiết cho đơn hàng này.</p>
                  </div>
                )}
              </section>

              {/* Delivery Plans */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="text-blue-500" size={18} />
                  <h3 className="text-lg font-bold text-gray-800">Kế hoạch giao hàng liên quan</h3>
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
                            <th className="px-4 py-3 font-medium">Sản phẩm</th>
                            <th className="px-4 py-3 font-medium">Ngày dự kiến</th>
                            <th className="px-4 py-3 font-medium text-right">Số lượng cần giao</th>
                            <th className="px-4 py-3 font-medium">Trạng thái</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {relatedDeliveryPlans.map((plan, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="px-4 py-3 font-medium text-gray-900">{plan['Mã kế hoạch']}</td>
                              <td className="px-4 py-3">
                                <ProductHoverCard productName={plan['Sản phẩm'] || ''} pricingData={pricingData}>
                                  <span 
                                    className="text-blue-600 font-medium hover:text-blue-800 hover:underline cursor-pointer"
                                    onClick={() => {
                                      if (onProductClick) {
                                        onProductClick(plan['Sản phẩm'] || '');
                                      }
                                    }}
                                  >
                                    {plan['Sản phẩm']}
                                  </span>
                                </ProductHoverCard>
                              </td>
                              <td className="px-4 py-3 font-medium text-blue-600">{plan['Ngày dự kiến']}</td>
                              <td className="px-4 py-3 text-right font-medium">{numberFormatter.format(parseFloat(String(plan['Số lượng cần giao'] || '0').replace(/,/g, '')))}</td>
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
                    <p>Không tìm thấy kế hoạch giao hàng nào liên kết với PO này.</p>
                  </div>
                )}
              </section>

              {/* Delivery History (PXK) */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Truck className="text-purple-500" size={18} />
                  <h3 className="text-lg font-bold text-gray-800">Lịch sử giao thực tế (PXK)</h3>
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
                            <th className="px-4 py-3 font-medium">Sản phẩm</th>
                            <th className="px-4 py-3 font-medium">Ngày giao</th>
                            <th className="px-4 py-3 font-medium text-right">SL Giao / Đặt</th>
                            <th className="px-4 py-3 font-medium">Tiến độ giao</th>
                            <th className="px-4 py-3 font-medium">Trạng thái</th>
                            <th className="px-4 py-3 font-medium">Sự cố</th>
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
                                    className="text-blue-600 font-medium hover:text-blue-800 hover:underline cursor-pointer"
                                    onClick={() => {
                                      if (onProductClick) {
                                        onProductClick(del['Tên sản phẩm'] || del['Mã sản phẩm'] || '');
                                      }
                                    }}
                                  >
                                    {del['Tên sản phẩm'] || del['Mã sản phẩm']}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-gray-600">{del['Ngày giao']}</td>
                                <td className="px-4 py-3 text-right">
                                  <span className="font-semibold text-gray-900">{numberFormatter.format(parseFloat(String(del['Số lượng giao'] || '0').replace(/,/g, '')))}</span>
                                  <span className="text-gray-400 mx-1">/</span>
                                  <span className="text-gray-500">{numberFormatter.format(parseFloat(String(del['Số lượng đặt'] || '0').replace(/,/g, '')))}</span>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                       <div className={`h-full ${percent >= 100 ? 'bg-green-500' : 'bg-orange-500'}`} style={{ width: `${Math.min(100, percent)}%` }}></div>
                                    </div>
                                    <span className="text-xs font-medium text-gray-700">{del['Tiến độ giao'] || '0%'}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                   <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                                      del['Status'] === 'Hoàn thành' ? 'bg-green-100 text-green-700 border-green-200' :
                                      del['Status'] === 'Đang tiến hành' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                                      'bg-gray-100 text-gray-700 border-gray-200'
                                   }`}>
                                     {del['Status'] || 'Chưa rõ'}
                                   </span>
                                </td>
                                <td className="px-4 py-3">
                                  {del['Sự cố'] && del['Sự cố'] !== '0' && del['Sự cố'] !== '' ? (
                                    <div className="flex items-center gap-1 text-red-600" title={del['Chi tiết sự cố'] || 'Có sự cố'}>
                                      <AlertTriangle size={14} className="shrink-0" />
                                      <span className="text-xs font-medium max-w-[120px] truncate">{del['Chi tiết sự cố'] || 'Có sự cố'}</span>
                                    </div>
                                  ) : (
                                    <span className="text-xs text-gray-400">-</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-dashed border-gray-300 p-6 flex flex-col items-center justify-center text-gray-500">
                    <AlertCircle size={24} className="mb-2 text-gray-400" />
                    <p>Chưa có lịch sử xuất kho thực tế cho đơn hàng này.</p>
                  </div>
                )}
              </section>

            </div>
          )}
          
        </div>
      </div>

      {/* Dual PO Review Modal */}
      <DualPODocumentModal
        isOpen={showDualPOModal}
        onClose={() => setShowDualPOModal(false)}
        customerPoNumber={cleanPoNumber}
        poCustomer={poHeader['Khách hàng'] || "Thăng Long"}
        poDate={poHeader['Ngày đặt hàng'] || ""}
        poLines={relatedPoLines}
        supplierData={supplierData}
        productData={productData}
        pricingData={pricingData}
      />
    </div>
  );
}
