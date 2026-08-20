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
  Info,
  Building2,
  Users,
  HardDrive,
  ArrowUpRight,
  ExternalLink,
  Printer,
  Sparkles,
  ChevronRight,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import clsx from 'clsx';
import MacTrafficLights from './MacTrafficLights';
import { formatVND, parseNumber, formatDateForDisplay } from '../lib/business-logic';
import CompanyLogo from './CompanyLogo';
import { getDriveFolderPath, formatShortFileName } from '../lib/driveSync';

interface ProductDetailModalProps {
  productNameOrId: string;
  onClose: () => void;
  productData: any[];
  pricingData: any[];
  poLinesData: any[];
  deliveryPlanData: any[];
  deliveryData: any[];
  specsData?: any[];
  contractsData?: any[];
  customerData?: any[];
  supplierData?: any[];
  onPoClick?: (poNumber: string) => void;
  onNavigateToCustomer?: (customerName: string) => void;
  onNavigateToSupplier?: (supplierName: string) => void;
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
  contractsData = [],
  customerData = [],
  supplierData = [],
  onPoClick,
  onNavigateToCustomer,
  onNavigateToSupplier
}: ProductDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'360_hub' | 'pricing_margin' | 'orders_delivery' | 'specs_tds' | 'contracts_drive'>('360_hub');
  const [isMaximized, setIsMaximized] = useState(false);
  
  // Find current product
  const product = useMemo(() => {
    const p = productData.find(item => 
      item['Tên sản phẩm'] === productNameOrId || 
      item['Mã sản phẩm'] === productNameOrId ||
      item['SKU'] === productNameOrId ||
      item['Mã hàng'] === productNameOrId
    );
    return p || { 'Tên sản phẩm': productNameOrId, 'Mã sản phẩm': productNameOrId };
  }, [productNameOrId, productData]);

  const productCode = (product['Mã sản phẩm'] || product['SKU'] || product['Mã hàng'] || '').trim();
  const productName = (product['Tên sản phẩm'] || product['Sản phẩm'] || productNameOrId).trim();

  // 1. Relational Pricing & Margins
  const matchedPricings = useMemo(() => {
    return pricingData.filter((pr) => {
      const prCode = (pr['Mã sản phẩm'] || '').trim();
      const prName = (pr['Tên sản phẩm'] || '').trim();
      return (productCode && prCode === productCode) || (productName && prName === productName);
    });
  }, [pricingData, productCode, productName]);

  const primaryPricing = matchedPricings[0] || null;
  const buyPrice = primaryPricing ? parseNumber(primaryPricing['Đơn giá mua'] || primaryPricing['Đơn giá nhập'] || 0) : 0;
  const sellPrice = primaryPricing ? parseNumber(primaryPricing['Đơn giá bán'] || primaryPricing['Giá AVP'] || 0) : 0;
  const profitUnit = primaryPricing ? parseNumber(primaryPricing['Lợi nhuận'] || (sellPrice - buyPrice)) : 0;
  const marginPct = primaryPricing?.['Biên lợi nhuận'] || (sellPrice > 0 ? (Math.round((profitUnit / sellPrice) * 100) + '%') : '—');

  // 2. Relational Customers
  const relatedCustomers = useMemo(() => {
    const list: Array<{ name: string; location: string; totalQty: number; revenue: number }> = [];
    const custMap = new Map<string, { location: string; totalQty: number; revenue: number }>();

    // From product master
    if (product['Khách hàng']) {
      custMap.set(product['Khách hàng'], { location: 'Kho khách hàng', totalQty: 0, revenue: 0 });
    }

    // From pricings
    matchedPricings.forEach(pr => {
      const c = pr['RP_Khách hàng'] || pr['Khách hàng'];
      if (c) {
        const existing = custMap.get(c) || { location: pr['Giao đến'] || pr['Địa điểm giao hàng'] || 'Hà Nội', totalQty: 0, revenue: 0 };
        custMap.set(c, existing);
      }
    });

    // From PO Lines
    poLinesData.filter(po => 
      po['Tên sản phẩm'] === productName || 
      (productCode && po['Mã của khách']?.includes(productCode))
    ).forEach(po => {
      const c = po['Khách hàng'] || product['Khách hàng'] || 'Khách hàng TSG';
      const existing = custMap.get(c) || { location: po['Điểm giao'] || 'Kho chỉ định', totalQty: 0, revenue: 0 };
      existing.totalQty += parseNumber(po['Số lượng'] || 0);
      existing.revenue += parseNumber(po['Thành tiền dòng'] || 0);
      custMap.set(c, existing);
    });

    custMap.forEach((val, key) => {
      list.push({ name: key, ...val });
    });

    return list;
  }, [product, matchedPricings, poLinesData, productName, productCode]);

  // 3. Relational Suppliers
  const relatedSuppliers = useMemo(() => {
    const list: Array<{ name: string; materialGroup: string }> = [];
    const suppSet = new Set<string>();

    if (product['Mã Nhà Cung Cấp'] || product['Nhà cung cấp']) {
      const s = product['Mã Nhà Cung Cấp'] || product['Nhà cung cấp'];
      suppSet.add(s);
      list.push({ name: s, materialGroup: product['Nhóm hàng'] || 'Nguyên vật liệu / Bao bì' });
    }

    matchedPricings.forEach(pr => {
      const s = pr['RP_Nhà cung cấp'] || pr['Nhà cung cấp'];
      if (s && !suppSet.has(s)) {
        suppSet.add(s);
        list.push({ name: s, materialGroup: pr['Nhóm sản phẩm'] || 'Bao bì & In ấn' });
      }
    });

    return list;
  }, [product, matchedPricings]);

  // 4. Relational Orders (Recent POs & PO Lines)
  const relatedPoLines = useMemo(() => {
    return poLinesData.filter(po => 
      po['Tên sản phẩm'] === productName || 
      (productCode && po['Mã của khách']?.includes(productCode))
    );
  }, [poLinesData, productName, productCode]);

  const latestPO = useMemo(() => {
    return relatedPoLines.length > 0 ? relatedPoLines[relatedPoLines.length - 1] : null;
  }, [relatedPoLines]);

  const totalOrderedQty = useMemo(() => {
    return relatedPoLines.reduce((sum, po) => sum + parseNumber(po['Số lượng'] || 0), 0);
  }, [relatedPoLines]);

  const totalRevenue = useMemo(() => {
    return relatedPoLines.reduce((sum, po) => sum + parseNumber(po['Thành tiền dòng'] || 0), 0);
  }, [relatedPoLines]);

  // 5. Relational Deliveries
  const relatedDeliveries = useMemo(() => {
    return deliveryData.filter(del => 
      del['Tên sản phẩm'] === productName || 
      (productCode && del['Mã sản phẩm'] === productCode)
    );
  }, [deliveryData, productName, productCode]);

  const totalDeliveredQty = useMemo(() => {
    return relatedDeliveries.reduce((sum, del) => sum + parseNumber(del['Số lượng giao'] || del['Số lượng'] || 0), 0);
  }, [relatedDeliveries]);

  // 6. Relational Specs
  const matchedSpecs = useMemo(() => {
    return specsData.filter(s => {
      const sLink = (s['Sản phẩm liên kết'] || '').trim();
      const sCode = (s['Mã sản phẩm'] || s['Mã sản phẩm liên kết'] || '').trim();
      const specId = (s['Mã Spec'] || '').trim();
      return (productName && sLink === productName) || (productCode && sCode === productCode) || (product['Thông Số Sản Phẩm'] && product['Thông Số Sản Phẩm'] === specId);
    });
  }, [specsData, productName, productCode, product]);

  const primarySpec = matchedSpecs[0] || null;

  // 7. Relational Contracts & Google Drive Path
  const relatedContracts = useMemo(() => {
    const list: any[] = [];
    const cNumSet = new Set<string>();

    matchedPricings.forEach(pr => {
      const cNum = pr['Số hợp đồng'];
      if (cNum && !cNumSet.has(cNum)) {
        cNumSet.add(cNum);
        list.push({
          contractNumber: cNum,
          partnerName: pr['RP_Khách hàng'] || pr['Khách hàng'],
          signDate: pr['Ngày bắt đầu'] || '2026-01-15',
          status: pr['Trạng thái giá'] || 'Đang hiệu lực'
        });
      }
    });

    contractsData.forEach(c => {
      const hasProd = (c.products || []).some((cp: any) => cp.productCode === productCode || cp.productName === productName);
      if (hasProd && !cNumSet.has(c.contractNumber)) {
        cNumSet.add(c.contractNumber);
        list.push(c);
      }
    });

    return list;
  }, [matchedPricings, contractsData, productCode, productName]);

  const driveInfo = useMemo(() => {
    const dateInput = latestPO?.['Ngày đặt'] || '2026-01-15';
    const folder = getDriveFolderPath(dateInput, '05_SPECS');
    const shortFileName = formatShortFileName('SPEC', productCode || 'SP', relatedCustomers[0]?.name || 'TSG', 'pdf');
    return {
      folderPath: folder.fullPath,
      fileName: shortFileName,
      url: 'https://drive.google.com/drive/search?q=' + encodeURIComponent(shortFileName)
    };
  }, [latestPO, productCode, relatedCustomers]);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-3 sm:p-6 animate-in fade-in duration-200">
      <div className={clsx(
        "bg-white rounded-3xl shadow-2xl w-full flex flex-col overflow-hidden transition-all duration-200 border border-black/[0.08]",
        isMaximized ? "max-w-7xl h-[95vh]" : "max-w-5xl max-h-[92vh]"
      )}>
        
        {/* Apple macOS Header */}
        <div className="px-6 py-4 border-b border-black/[0.06] flex justify-between items-center bg-[#F5F5F7]">
          <div className="flex items-center gap-4">
            <MacTrafficLights 
              onClose={onClose} 
              onMaximize={() => setIsMaximized(!isMaximized)}
              isMaximized={isMaximized}
            />
            <div className="h-4 w-px bg-black/[0.08]" />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-indigo-600 text-white rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm shadow-blue-500/20">
                <Package size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-xs bg-slate-200 text-slate-800 px-2 py-0.5 rounded-md">
                    {productCode || 'SKU'}
                  </span>
                  <h2 className="text-base font-bold text-[#1D1D1F]">{productName}</h2>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {product['Nhóm hàng'] || 'Sản phẩm TSG'} • ĐVT: {product['Đơn Vị Tính'] || 'Cái'} • Tình trạng: <span className="font-bold text-emerald-600">{product['Tình trạng'] || 'Đang kinh doanh'}</span>
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200/60 hover:bg-slate-300 flex items-center justify-center text-slate-600 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 px-6 bg-white shrink-0 overflow-x-auto gap-1">
          {[
            { id: '360_hub', label: '🌟 Quan Hệ Thực Thể 360°', icon: Sparkles },
            { id: 'pricing_margin', label: '💰 Bảng Giá & Lợi Nhuận', count: matchedPricings.length, icon: DollarSign },
            { id: 'orders_delivery', label: '📦 Đơn Hàng & Giao Hàng', count: relatedPoLines.length, icon: ShoppingCart },
            { id: 'specs_tds', label: '📐 Tiêu Chuẩn Kỹ Thuật (Specs)', count: matchedSpecs.length, icon: ShieldCheck },
            { id: 'contracts_drive', label: '📑 Hợp Đồng & Google Drive', count: relatedContracts.length, icon: HardDrive },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={clsx(
                  "py-3 px-3.5 font-bold text-xs border-b-2 flex items-center gap-1.5 transition-all whitespace-nowrap",
                  isActive 
                    ? "border-blue-600 text-blue-600 bg-blue-50/40" 
                    : "border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                )}
              >
                <Icon size={14} className={isActive ? "text-blue-600" : "text-slate-400"} />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span className={clsx(
                    "px-1.5 py-0.2 rounded-full text-[10px] font-mono",
                    isActive ? "bg-blue-100 text-blue-800 font-bold" : "bg-slate-100 text-slate-600"
                  )}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-[#F8FAFC]">
          
          {/* TAB 1: 360° RELATIONAL HUB */}
          {activeTab === '360_hub' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              
              {/* 6 Key Cross-linked Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                
                {/* 1. Khách Hàng Đặt Mua */}
                <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
                        <Building2 size={18} />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Khách Hàng Đặt Mua</h4>
                        <p className="text-[11px] text-slate-500">Đơn vị tiêu thụ sản phẩm</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    {relatedCustomers.length > 0 ? (
                      relatedCustomers.map((cust, idx) => (
                        <div key={idx} className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
                          <div>
                            <p className="font-bold text-slate-900">{cust.name}</p>
                            <p className="text-[10px] text-slate-500">Giao đến: {cust.location}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-blue-600">{cust.totalQty.toLocaleString('vi-VN')} {product['Đơn Vị Tính'] || 'Cái'}</p>
                            <p className="text-[10px] text-slate-400">{formatVND(cust.revenue)}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400 italic py-2">Chưa có thông tin khách hàng gán</p>
                    )}
                  </div>
                </div>

                {/* 2. Nhà Cung Cấp Sản Xuất */}
                <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                        <Building2 size={18} />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Nhà Cung Cấp SX</h4>
                        <p className="text-[11px] text-slate-500">Đơn vị gia công / sản xuất</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    {relatedSuppliers.length > 0 ? (
                      relatedSuppliers.map((supp, idx) => (
                        <div key={idx} className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <CompanyLogo name={supp.name} className="w-6 h-6 rounded-full shrink-0" />
                            <div>
                              <p className="font-bold text-slate-900">{supp.name}</p>
                              <p className="text-[10px] text-slate-500">{supp.materialGroup}</p>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded">
                            Đối tác chiến lược
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400 italic py-2">Chưa có thông tin nhà cung cấp</p>
                    )}
                  </div>
                </div>

                {/* 3. Đơn Giá & Biên Lợi Nhuận */}
                <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                        <DollarSign size={18} />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Giá Bán & Lợi Nhuận</h4>
                        <p className="text-[11px] text-slate-500">Căn cứ Bảng giá 2026</p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-lg">
                      {marginPct}
                    </span>
                  </div>
                  <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Đơn giá bán niêm yết:</span>
                      <span className="font-bold text-slate-900">{formatVND(sellPrice)}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Đơn giá mua (NCC):</span>
                      <span className="font-medium text-slate-600">{formatVND(buyPrice)}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500">Lợi nhuận gộp/đơn vị:</span>
                      <span className="font-bold text-emerald-600">{formatVND(profitUnit)} / {product['Đơn Vị Tính'] || 'Cái'}</span>
                    </div>
                  </div>
                </div>

                {/* 4. Đơn Hàng Gần Nhất (Recent PO) */}
                <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold">
                        <ShoppingCart size={18} />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Đơn Hàng Gần Nhất</h4>
                        <p className="text-[11px] text-slate-500">Lịch sử đặt & giao PO</p>
                      </div>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-slate-100 text-xs">
                    {latestPO ? (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                            {latestPO['Số đơn hàng'] || latestPO['Đơn hàng']}
                          </span>
                          <span className="text-[11px] text-slate-500">{latestPO['Ngày đặt']}</span>
                        </div>
                        <div className="flex justify-between text-xs pt-1">
                          <span className="text-slate-500">Số lượng đặt:</span>
                          <span className="font-bold text-slate-900">{Number(latestPO['Số lượng']).toLocaleString('vi-VN')} {product['Đơn Vị Tính'] || 'Cái'}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">Tổng đặt tích lũy:</span>
                          <span className="font-bold text-blue-600">{totalOrderedQty.toLocaleString('vi-VN')} {product['Đơn Vị Tính'] || 'Cái'}</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic py-2">Chưa phát sinh đơn hàng PO</p>
                    )}
                  </div>
                </div>

                {/* 5. Tiêu Chuẩn Kỹ Thuật (Specs) */}
                <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                        <ShieldCheck size={18} />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Tiêu Chuẩn Kỹ Thuật</h4>
                        <p className="text-[11px] text-slate-500">Hồ sơ TDS & CAD ISO</p>
                      </div>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-slate-100 text-xs">
                    {primarySpec ? (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                            {primarySpec['Mã Spec']}
                          </span>
                          <span className="text-[11px] text-slate-500">v{primarySpec['Phiên bản'] || '1.0'}</span>
                        </div>
                        <p className="font-semibold text-slate-800 line-clamp-1">{primarySpec['Tên tiêu chuẩn']}</p>
                        <p className="text-[11px] text-slate-500">Chất liệu: {primarySpec['Chất liệu'] || 'Giấy Carton / Ivory'}</p>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic py-2">Chưa thiết lập hồ sơ Specs</p>
                    )}
                  </div>
                </div>

                {/* 6. Hợp Đồng & Thư Mục Drive */}
                <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                        <HardDrive size={18} />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Hợp Đồng & Drive</h4>
                        <p className="text-[11px] text-slate-500">Lưu trữ Google Drive</p>
                      </div>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-slate-100 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                        {relatedContracts[0]?.contractNumber || primaryPricing?.['Số hợp đồng'] || '177/HĐ-TLTL'}
                      </span>
                      <a
                        href={driveInfo.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-0.5 rounded"
                      >
                        <span>Mở Drive</span>
                        <ArrowUpRight size={12} />
                      </a>
                    </div>
                    <p className="text-[10px] text-slate-500 truncate font-mono" title={driveInfo.folderPath}>
                      📁 {driveInfo.folderPath}
                    </p>
                  </div>
                </div>

              </div>

              {/* Visual Reference & Specs Matrix Preview */}
              {primarySpec && (
                <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-900 text-sm uppercase tracking-wide flex items-center gap-2">
                      <Layers size={16} className="text-blue-600" /> Bảng Chỉ Tiêu Kỹ Thuật Trọng Điểm ({primarySpec['Mã Spec']})
                    </h4>
                    <button
                      onClick={() => setActiveTab('specs_tds')}
                      className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                    >
                      Xem toàn bộ hồ sơ TDS <ChevronRight size={14} />
                    </button>
                  </div>

                  <div className="overflow-x-auto rounded-2xl border border-slate-200">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-100 text-slate-600 font-bold uppercase text-[10px]">
                          <th className="py-2.5 px-4">CHỈ TIÊU</th>
                          <th className="py-2.5 px-3 text-center">ĐVT</th>
                          <th className="py-2.5 px-4">TIÊU CHUẨN MẪU</th>
                          <th className="py-2.5 px-3 text-center">DUNG SAI</th>
                          <th className="py-2.5 px-4">PHƯƠNG PHÁP THỬ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {(primarySpec['Thông số kỹ thuật'] || []).slice(0, 4).map((p: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-2.5 px-4 font-bold text-slate-900">{p.criterion}</td>
                            <td className="py-2.5 px-3 text-center font-mono text-slate-600">{p.unit}</td>
                            <td className="py-2.5 px-4 font-bold text-blue-700">{p.standard}</td>
                            <td className="py-2.5 px-3 text-center text-slate-600">{p.tolerance || '-'}</td>
                            <td className="py-2.5 px-4 text-slate-500">{p.testMethod || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* TAB 2: PRICING & MARGIN */}
          {activeTab === 'pricing_margin' && (
            <div className="space-y-5 animate-in fade-in duration-300">
              <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Bảng Giá 2026 Của Sản Phẩm</h3>
                    <p className="text-xs text-slate-500">Đơn giá mua, bán, biên lợi nhuận theo từng khách hàng & địa điểm giao</p>
                  </div>
                  <span className="px-3 py-1 bg-emerald-50 text-emerald-700 font-bold text-xs rounded-full border border-emerald-200">
                    {matchedPricings.length} tầng giá
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] border-b border-slate-200">
                        <th className="py-3 px-4">Mã Giá</th>
                        <th className="py-3 px-4">Khách Hàng</th>
                        <th className="py-3 px-4">Nhà Cung Cấp</th>
                        <th className="py-3 px-4">Điểm Giao</th>
                        <th className="py-3 px-4 text-right">Đơn Giá Mua</th>
                        <th className="py-3 px-4 text-right">Đơn Giá Bán</th>
                        <th className="py-3 px-4 text-right">Lợi Nhuận</th>
                        <th className="py-3 px-4 text-center">Biên LN</th>
                        <th className="py-3 px-4">Hợp Đồng</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {matchedPricings.map((pr, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="py-3 px-4 font-mono font-bold text-blue-700">{pr['Mã giá bán']}</td>
                          <td className="py-3 px-4 font-bold text-slate-900">{pr['RP_Khách hàng'] || pr['Khách hàng']}</td>
                          <td className="py-3 px-4 text-slate-600">{pr['RP_Nhà cung cấp'] || pr['Nhà cung cấp']}</td>
                          <td className="py-3 px-4 text-slate-600">{pr['Giao đến'] || 'Hà Nội'}</td>
                          <td className="py-3 px-4 text-right text-slate-600">{formatVND(parseNumber(pr['Đơn giá mua'] || pr['Đơn giá nhập'] || 0))}</td>
                          <td className="py-3 px-4 text-right font-bold text-slate-900">{formatVND(parseNumber(pr['Đơn giá bán'] || pr['Giá AVP'] || 0))}</td>
                          <td className="py-3 px-4 text-right font-bold text-emerald-600">{formatVND(parseNumber(pr['Lợi nhuận'] || 0))}</td>
                          <td className="py-3 px-4 text-center">
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-bold rounded-md">
                              {pr['Biên lợi nhuận'] || '—'}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px] text-rose-700">{pr['Số hợp đồng'] || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ORDERS & DELIVERIES */}
          {activeTab === 'orders_delivery' && (
            <div className="space-y-5 animate-in fade-in duration-300">
              <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Danh Sách Đơn Hàng PO Đã Đặt</h3>
                    <p className="text-xs text-slate-500">Tổng cộng: {totalOrderedQty.toLocaleString('vi-VN')} {product['Đơn Vị Tính'] || 'Cái'} • Doanh thu: {formatVND(totalRevenue)}</p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] border-b border-slate-200">
                        <th className="py-3 px-4">Mã Đơn Hàng (PO)</th>
                        <th className="py-3 px-4">Khách Hàng</th>
                        <th className="py-3 px-4 text-right">Số Lượng Đặt</th>
                        <th className="py-3 px-4 text-right">Đơn Giá Bán</th>
                        <th className="py-3 px-4 text-right">Thành Tiền</th>
                        <th className="py-3 px-4">Ngày Đặt</th>
                        <th className="py-3 px-4">Ngày Giao Hàng</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {relatedPoLines.map((po, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="py-3 px-4 font-mono font-bold text-teal-700">{po['Số đơn hàng'] || po['Đơn hàng']}</td>
                          <td className="py-3 px-4 font-bold text-slate-900">{po['Khách hàng'] || product['Khách hàng']}</td>
                          <td className="py-3 px-4 text-right font-bold text-slate-900">{Number(po['Số lượng']).toLocaleString('vi-VN')}</td>
                          <td className="py-3 px-4 text-right text-slate-600">{formatVND(parseNumber(po['Đơn giá bán'] || 0))}</td>
                          <td className="py-3 px-4 text-right font-bold text-blue-600">{formatVND(parseNumber(po['Thành tiền dòng'] || 0))}</td>
                          <td className="py-3 px-4 text-slate-600">{po['Ngày đặt']}</td>
                          <td className="py-3 px-4 text-slate-600">{po['Ngày giao hàng'] || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: SPECS & TDS */}
          {activeTab === 'specs_tds' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              {primarySpec ? (
                <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs overflow-hidden p-6 space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                    <div>
                      <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 font-mono font-bold text-xs rounded-md border border-blue-200">
                        {primarySpec['Mã Spec']} - v{primarySpec['Phiên bản'] || '1.0'}
                      </span>
                      <h3 className="text-lg font-bold text-slate-900 mt-1.5">{primarySpec['Tên tiêu chuẩn']}</h3>
                      <p className="text-xs text-slate-500">Khách hàng áp dụng: {primarySpec['Khách hàng']} | Người duyệt: {primarySpec['Người phê duyệt'] || 'Ban Giám Đốc TSG'}</p>
                    </div>
                  </div>

                  {/* Specs Table */}
                  <div className="overflow-x-auto rounded-2xl border border-slate-200">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-100 text-slate-600 font-bold uppercase text-[10px]">
                          <th className="py-3 px-4 w-1/3">CHỈ TIÊU</th>
                          <th className="py-3 px-3 text-center w-20">ĐVT</th>
                          <th className="py-3 px-4 w-1/4">TIÊU CHUẨN MẪU</th>
                          <th className="py-3 px-3 text-center">DUNG SAI</th>
                          <th className="py-3 px-4">PHƯƠNG PHÁP THỬ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {(primarySpec['Thông số kỹ thuật'] || []).map((p: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-3 px-4 font-bold text-slate-900">{p.criterion}</td>
                            <td className="py-3 px-3 text-center font-mono text-slate-600">{p.unit}</td>
                            <td className="py-3 px-4 font-bold text-blue-700 text-sm">{p.standard}</td>
                            <td className="py-3 px-3 text-center text-slate-600">{p.tolerance || '-'}</td>
                            <td className="py-3 px-4 text-slate-600">{p.testMethod || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Packaging */}
                  {primarySpec['Quy cách đóng gói'] && (
                    <div className="bg-blue-50/60 p-4 rounded-2xl border border-blue-100">
                      <h5 className="font-bold text-blue-950 text-xs mb-1">Quy cách đóng gói & Bảo quản:</h5>
                      <p className="text-slate-700 text-xs leading-relaxed">{primarySpec['Quy cách đóng gói']}</p>
                    </div>
                  )}

                  {/* CAD Image */}
                  {primarySpec['Hình ảnh thiết kế'] && (
                    <div>
                      <h5 className="font-bold text-slate-900 text-xs uppercase mb-2">Bản vẽ CAD / Thiết kế đính kèm:</h5>
                      <div className="h-56 rounded-2xl bg-slate-50 border border-slate-200 overflow-hidden flex items-center justify-center p-2">
                        <img src={primarySpec['Hình ảnh thiết kế']} className="h-full object-contain rounded-xl" alt="CAD" referrerPolicy="no-referrer" />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-12 text-center text-slate-400 bg-white rounded-3xl border border-slate-200">
                  <ShieldCheck size={48} className="mx-auto mb-2 opacity-40 text-blue-500" />
                  <p className="font-bold text-slate-700">Chưa có tiêu chuẩn kỹ thuật Specs cho sản phẩm này</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: CONTRACTS & DRIVE */}
          {activeTab === 'contracts_drive' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-6 space-y-6">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Hợp Đồng Pháp Lý & Thư Mục Google Drive</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Lưu trữ phân cấp khoa học theo Năm $ightarrow$ Tháng</p>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                      <HardDrive size={15} className="text-blue-600" /> Đường dẫn thư mục Google Drive:
                    </span>
                    <a
                      href={driveInfo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs"
                    >
                      <ExternalLink size={13} /> Mở trên Google Drive
                    </a>
                  </div>
                  <p className="font-mono text-xs text-slate-700 bg-white p-3 rounded-xl border border-slate-200/80 break-all">
                    {driveInfo.folderPath}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Tên file lưu trữ quy chuẩn: <strong className="text-slate-800 font-mono">{driveInfo.fileName}</strong>
                  </p>
                </div>

                {/* Contracts List */}
                <div className="space-y-3">
                  <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wide">Hợp đồng kinh tế liên quan:</h4>
                  {relatedContracts.map((c, idx) => (
                    <div key={idx} className="p-4 bg-white rounded-2xl border border-slate-200 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 text-xs">
                            {c.contractNumber}
                          </span>
                          <span className="font-bold text-slate-800 text-xs">{c.title || 'Hợp đồng mua bán bao bì'}</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Đối tác: {c.partnerName} • Ngày ký: {c.signDate}</p>
                      </div>
                      <a
                        href={'https://drive.google.com/drive/search?q=' + encodeURIComponent(c.contractNumber)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold flex items-center gap-1"
                      >
                        <FileText size={13} /> PDF Gốc <ArrowUpRight size={12} />
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}