import React, { useState, useMemo } from 'react';
import { 
  Package, Search, Filter, Plus, ShieldCheck, DollarSign, TrendingUp, 
  Building2, Users, FileText, ArrowUpRight, ChevronRight, Eye, 
  Edit3, Trash2, Layers, CheckCircle2, AlertCircle, HardDrive, 
  ExternalLink, Sparkles, Truck, ShoppingCart, Tag, Clock, HelpCircle,
  LayoutGrid, List, Check, X, PlusCircle, ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import clsx from 'clsx';
import { toast } from 'react-hot-toast';
import { formatVND, parseNumber, getDefaultSpecs } from '../lib/business-logic';
import CompanyLogo from './CompanyLogo';
import { getDriveFolderPath, formatShortFileName } from '../lib/driveSync';
import { 
  CockpitTableToolbar, 
  CockpitPagination, 
  CockpitTableEmptyState, 
  CockpitBadge,
  Modal,
  Drawer,
  Button,
  IconButton
} from './ui';

interface ProductsViewProps {
  productData: any[];
  pricingData: any[];
  poLinesData: any[];
  poHeaderData?: any[];
  deliveryData: any[];
  deliveryPlanData: any[];
  specsData: any[];
  contractsData?: any[];
  customerData?: any[];
  supplierData?: any[];
  onAddProduct?: (product: any) => Promise<void>;
  onEditProduct?: (product: any) => Promise<void>;
  onDeleteProduct?: (product: any) => Promise<void>;
  onSelectProductDetails: (productNameOrId: string) => void;
  onSelectPoDetails?: (poNumber: string) => void;
  onSelectContract?: (contractNumber: string) => void;
}

export default function ProductsView({
  productData = [],
  pricingData = [],
  poLinesData = [],
  poHeaderData = [],
  deliveryData = [],
  deliveryPlanData = [],
  specsData = [],
  contractsData = [],
  customerData = [],
  supplierData = [],
  onAddProduct,
  onEditProduct,
  onDeleteProduct,
  onSelectProductDetails,
  onSelectPoDetails,
  onSelectContract,
}: ProductsViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedCustomer, setSelectedCustomer] = useState<string>('All');
  const [selectedSupplier, setSelectedSupplier] = useState<string>('All');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [activeTab, setActiveTab] = useState<'all' | 'with_pricing' | 'with_orders' | 'with_specs'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Edit / Add modal states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [editFormData, setEditFormData] = useState<any>({});
  const [isSaving, setIsSaving] = useState(false);

  // Enrich each product with 360-degree relational data
  const enrichedProducts = useMemo(() => {
    return productData.map((p) => {
      const code = (p['Mã sản phẩm'] || p['SKU'] || p['Mã hàng'] || '').trim();
      let name = (p['Tên sản phẩm'] || p['Sản phẩm'] || '').trim();

      // 1. Relational Pricing & Margins
      const matchedPricings = pricingData.filter((pr) => {
        const prCode = (pr['Mã sản phẩm'] || '').trim();
        const prName = (pr['Tên sản phẩm'] || '').trim();
        return (code && prCode === code) || (name && prName === name);
      });

      // Name fallback from pricing or specs if not defined
      if (!name) {
        if (matchedPricings.length > 0 && matchedPricings[0]['Tên sản phẩm']) {
          name = matchedPricings[0]['Tên sản phẩm'].trim();
        } else {
          const matchedSp = specsData.find(s => (s['Mã sản phẩm'] || '').trim() === code);
          if (matchedSp && (matchedSp['Tên tiêu chuẩn'] || matchedSp['Sản phẩm liên kết'])) {
            name = (matchedSp['Tên tiêu chuẩn'] || matchedSp['Sản phẩm liên kết']).trim();
          }
        }
      }
      if (!name) name = code;

      const primaryPricing = matchedPricings[0] || null;
      const buyPrice = primaryPricing ? parseNumber(primaryPricing['Đơn giá mua'] || primaryPricing['Đơn giá nhập'] || 0) : 0;
      const sellPrice = primaryPricing ? parseNumber(primaryPricing['Đơn giá bán'] || primaryPricing['Giá AVP'] || 0) : 0;
      const profitUnit = primaryPricing ? parseNumber(primaryPricing['Lợi nhuận'] || (sellPrice - buyPrice)) : 0;
      const marginPct = primaryPricing?.['Biên lợi nhuận'] || (sellPrice > 0 ? `${Math.round((profitUnit / sellPrice) * 100)}%` : '—');

      // 2. Relational Customers
      const relatedCustomers = Array.from(
        new Set(
          [
            p['Khách hàng'],
            ...matchedPricings.map((pr) => pr['RP_Khách hàng'] || pr['Khách hàng']),
            ...poLinesData.filter((po) => po['Tên sản phẩm'] === name || (code && po['Mã của khách']?.includes(code))).map((po) => po['Khách hàng'])
          ].filter(Boolean)
        )
      );

      // 3. Relational Suppliers
      const relatedSuppliers = Array.from(
        new Set(
          [
            p['Mã Nhà Cung Cấp'] || p['Nhà cung cấp'],
            ...matchedPricings.map((pr) => pr['RP_Nhà cung cấp'] || pr['Nhà cung cấp'])
          ].filter(Boolean)
        )
      );

      // 4. Relational Specs
      const matchedSpecs = specsData.filter((s) => {
        const sLink = (s['Sản phẩm liên kết'] || '').trim();
        const sCode = (s['Mã sản phẩm'] || s['Mã sản phẩm liên kết'] || '').trim();
        const specId = (s['Mã Spec'] || '').trim();
        return (name && sLink === name) || (code && sCode === code) || (p['Thông Số Sản Phẩm'] && p['Thông Số Sản Phẩm'] === specId);
      });
      const primarySpec = matchedSpecs[0] || null;

      // 5. Relational Orders (Recent POs)
      const matchedPOLines = poLinesData.filter((po) => {
        const poName = (po['Tên sản phẩm'] || '').trim();
        const poCode = (po['Mã của khách'] || '').trim();
        return poName === name || (code && poCode.includes(code));
      });

      const latestPO = matchedPOLines.length > 0 ? matchedPOLines[matchedPOLines.length - 1] : null;
      const totalOrderedQty = matchedPOLines.reduce((sum, po) => sum + parseNumber(po['Số lượng'] || 0), 0);
      const totalRevenue = matchedPOLines.reduce((sum, po) => sum + parseNumber(po['Thành tiền dòng'] || 0), 0);

      // 6. Relational Contracts & Google Drive Path
      const contractNumber = primaryPricing?.['Số hợp đồng'] || (contractsData.find(c => (c.products || []).some((cp: any) => cp.productCode === code || cp.productName === name)))?.contractNumber || '';
      const driveFolder = getDriveFolderPath(latestPO?.['Ngày đặt'] || '2026-01-15', '05_SPECS');
      const shortFileName = formatShortFileName('SPEC', code || 'SP', relatedCustomers[0] || 'TSG', 'pdf');

      const specsDescription = p['Quy cách'] || p['Quy cách kỹ thuật'] || p['Thông số kỹ thuật'] || primarySpec?.['Thông số chi tiết'] || primarySpec?.['Quy cách'] || getDefaultSpecs(name, code, p['Đơn Vị Tính'] || p['ĐVT'] || 'Cái');

      return {
        raw: p,
        code,
        name,
        category: p['Nhóm hàng'] || p['Phân loại'] || 'Chung',
        unit: p['Đơn Vị Tính'] || p['ĐVT'] || 'Cái',
        status: p['Tình trạng'] || 'Đang kinh doanh',
        specsDescription,
        matchedPricings,
        primaryPricing,
        buyPrice,
        sellPrice,
        profitUnit,
        marginPct,
        relatedCustomers,
        relatedSuppliers,
        primarySpec,
        matchedSpecs,
        matchedPOLines,
        latestPO,
        totalOrderedQty,
        totalRevenue,
        contractNumber,
        driveFolderPath: driveFolder.fullPath,
        shortFileName,
        driveSearchUrl: `https://drive.google.com/drive/search?q=${encodeURIComponent(shortFileName)}`
      };
    });
  }, [productData, pricingData, poLinesData, specsData, contractsData]);

  // Master options list for Customers
  const allCustomerOptions = useMemo(() => {
    const set = new Set<string>();
    (customerData || []).forEach((c: any) => {
      const name = c['Tên khách hàng'] || c['Customer_ID'] || c.name || c['Khách hàng'];
      if (name) set.add(String(name).trim());
    });
    enrichedProducts.forEach(p => p.relatedCustomers.forEach(c => set.add(c)));
    ['Thăng Long', 'Bắc Sơn', 'Thanh Hoá', 'Ngân Sơn', 'Sài Gòn', 'Bến Tre', 'Diageo Việt Nam'].forEach(c => set.add(c));
    return Array.from(set).filter(Boolean).sort();
  }, [customerData, enrichedProducts]);

  // Master options list for Suppliers
  const allSupplierOptions = useMemo(() => {
    const set = new Set<string>();
    (supplierData || []).forEach((s: any) => {
      const name = s['Tên nhà cung cấp'] || s['Mã nhà cung cấp'] || s['Mã NCC'] || s.name || s['Nhà cung cấp'];
      if (name) set.add(String(name).trim());
    });
    enrichedProducts.forEach(p => p.relatedSuppliers.forEach(s => set.add(s)));
    ['YFY', 'Tâm Sen', 'Tuấn Bằng', 'THP', 'Bao bì Đồng Nai', 'Xương Giang'].forEach(s => set.add(s));
    return Array.from(set).filter(Boolean).sort();
  }, [supplierData, enrichedProducts]);

  // Master options list for Categories
  const allCategoryOptions = useMemo(() => {
    const set = new Set<string>(['Thùng carton', 'Nguyên liệu', 'In ấn', 'Bao bì & Nhãn']);
    enrichedProducts.forEach(p => {
      if (p.category && p.category !== 'Chung') set.add(p.category);
    });
    return Array.from(set).filter(Boolean).sort();
  }, [enrichedProducts]);

  // Categories, Customers, and Suppliers list for toolbar filtering
  const categories = useMemo(() => {
    return ['All', ...allCategoryOptions];
  }, [allCategoryOptions]);

  const customersList = useMemo(() => {
    return ['All', ...allCustomerOptions];
  }, [allCustomerOptions]);

  const suppliersList = useMemo(() => {
    return ['All', ...allSupplierOptions];
  }, [allSupplierOptions]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return enrichedProducts.filter((p) => {
      const q = searchTerm.toLowerCase();
      const matchesSearch = 
        !searchTerm ||
        p.code.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.relatedCustomers.some((c) => c.toLowerCase().includes(q)) ||
        p.relatedSuppliers.some((s) => s.toLowerCase().includes(q));

      const matchesCat = selectedCategory === 'All' || p.category === selectedCategory;
      const matchesCust = selectedCustomer === 'All' || p.relatedCustomers.includes(selectedCustomer);
      const matchesSupp = selectedSupplier === 'All' || p.relatedSuppliers.includes(selectedSupplier);

      const matchesTab = 
        activeTab === 'all' ? true :
        activeTab === 'with_pricing' ? p.matchedPricings.length > 0 :
        activeTab === 'with_orders' ? p.matchedPOLines.length > 0 :
        activeTab === 'with_specs' ? !!p.primarySpec : true;

      return matchesSearch && matchesCat && matchesCust && matchesSupp && matchesTab;
    });
  }, [enrichedProducts, searchTerm, selectedCategory, selectedCustomer, selectedSupplier, activeTab]);

  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredProducts.slice(start, start + pageSize);
  }, [filteredProducts, currentPage, pageSize]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const total = enrichedProducts.length;
    const withSpecs = enrichedProducts.filter((p) => p.primarySpec).length;
    const withPricing = enrichedProducts.filter((p) => p.matchedPricings.length > 0).length;
    const withOrders = enrichedProducts.filter((p) => p.matchedPOLines.length > 0).length;
    const totalRev = enrichedProducts.reduce((sum, p) => sum + p.totalRevenue, 0);

    return { total, withSpecs, withPricing, withOrders, totalRev };
  }, [enrichedProducts]);

  // Handle opening edit drawer
  const handleOpenEdit = (p: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingProduct(p);
    setEditFormData({
      ...p.raw,
      'Mã sản phẩm': p.code,
      'Tên sản phẩm': p.name,
      'Nhóm hàng': p.category,
      'Đơn Vị Tính': p.unit,
      'Khách hàng': p.relatedCustomers[0] || p.raw['Khách hàng'] || allCustomerOptions[0] || 'Thăng Long',
      'Mã Nhà Cung Cấp': p.relatedSuppliers[0] || p.raw['Mã Nhà Cung Cấp'] || allSupplierOptions[0] || 'YFY',
      'Thông Số Sản Phẩm': p.primarySpec?.['Mã Spec'] || p.raw['Thông Số Sản Phẩm'] || '',
      'Trọng lượng riêng': p.raw['Trọng lượng riêng'] || '',
      'Tình trạng': p.status || 'Đang kinh doanh'
    });
    setIsEditModalOpen(true);
  };

  // Handle saving edit form
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onEditProduct) return;
    
    setIsSaving(true);
    const toastId = toast.loading('Đang lưu thông tin sản phẩm...');
    try {
      await onEditProduct(editFormData);
      toast.success('Đã lưu thành công!', { id: toastId });
      setIsEditModalOpen(false);
      setEditingProduct(null);
    } catch (err) {
      console.error(err);
      toast.error('Lỗi khi lưu dữ liệu!', { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle saving new product
  const handleSaveAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onAddProduct) return;

    setIsSaving(true);
    const toastId = toast.loading('Đang tạo sản phẩm mới...');
    try {
      await onAddProduct(editFormData);
      toast.success('Đã thêm sản phẩm thành công!', { id: toastId });
      setIsAddModalOpen(false);
      setEditFormData({});
    } catch (err) {
      console.error(err);
      toast.error('Lỗi khi tạo sản phẩm!', { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full max-w-[1720px] mx-auto p-4 sm:p-6 lg:p-8 space-y-4 bg-[#F8FAFA] min-h-screen relative font-sans">
      {/* 1. Universal Cockpit Toolbar */}
      <CockpitTableToolbar
        moduleCode="MOD // 05 · PRODUCTS"
        title="Danh Mục Sản Phẩm & Mã Hiệu"
        subtitle="Hồ sơ 360° đa chiều: Bảng giá • Khách hàng • Nhà cung cấp • Specs • Hợp đồng Drive"
        icon={<Package size={22} className="text-white" />}
        stats={[
          { label: 'Tổng SKU', value: metrics.total, tone: 'default' },
          { label: 'Có Báo Giá', value: metrics.withPricing, tone: 'cobalt' },
          { label: 'Có Đơn PO', value: metrics.withOrders, tone: 'emerald' },
          { label: 'Có Specs QC', value: metrics.withSpecs, tone: 'amber' },
        ]}
        searchTerm={searchTerm}
        onSearchChange={(v) => { setSearchTerm(v); setCurrentPage(1); }}
        searchPlaceholder="Tìm theo mã SKU, tên sản phẩm, khách hàng, nhà cung cấp..."
        searchResultCount={filteredProducts.length}
        tabs={[
          { id: 'all', label: 'Tất cả sản phẩm', count: enrichedProducts.length },
          { id: 'with_pricing', label: 'Có bảng giá', count: metrics.withPricing },
          { id: 'with_orders', label: 'Có đơn PO', count: metrics.withOrders },
          { id: 'with_specs', label: 'Đã lập Specs', count: metrics.withSpecs },
        ]}
        activeTab={activeTab}
        onTabChange={(t) => { setActiveTab(t as any); setCurrentPage(1); }}
        filtersSlot={(
          <>
            {/* Category Filter */}
            <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200/90 text-xs">
              <span className="text-[11px] font-semibold text-slate-500">Nhóm:</span>
              <select
                value={selectedCategory}
                onChange={(e) => { setSelectedCategory(e.target.value); setCurrentPage(1); }}
                className="bg-transparent font-medium text-slate-800 focus:outline-none pr-1 cursor-pointer"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>{c === 'All' ? 'Tất cả nhóm' : c}</option>
                ))}
              </select>
            </div>

            {/* Customer Filter */}
            <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200/90 text-xs">
              <span className="text-[11px] font-semibold text-slate-500">Khách:</span>
              <select
                value={selectedCustomer}
                onChange={(e) => { setSelectedCustomer(e.target.value); setCurrentPage(1); }}
                className="bg-transparent font-medium text-slate-800 focus:outline-none pr-1 max-w-[130px] truncate cursor-pointer"
              >
                {customersList.map((c) => (
                  <option key={c} value={c}>{c === 'All' ? 'Tất cả khách hàng' : c}</option>
                ))}
              </select>
            </div>

            {/* Supplier Filter */}
            <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200/90 text-xs">
              <span className="text-[11px] font-semibold text-slate-500">NCC:</span>
              <select
                value={selectedSupplier}
                onChange={(e) => { setSelectedSupplier(e.target.value); setCurrentPage(1); }}
                className="bg-transparent font-medium text-slate-800 focus:outline-none pr-1 max-w-[130px] truncate cursor-pointer"
              >
                {suppliersList.map((s) => (
                  <option key={s} value={s}>{s === 'All' ? 'Tất cả NCC' : s}</option>
                ))}
              </select>
            </div>
          </>
        )}
        onAddNew={() => {
          setEditFormData({
            'Mã sản phẩm': '',
            'Tên sản phẩm': '',
            'Nhóm hàng': 'Thùng carton',
            'Đơn Vị Tính': 'Cái',
            'Khách hàng': allCustomerOptions[0] || 'Thăng Long',
            'Mã Nhà Cung Cấp': allSupplierOptions[0] || 'YFY',
            'Tình trạng': 'Đang kinh doanh'
          });
          setIsAddModalOpen(true);
        }}
        addNewLabel="Thêm sản phẩm"
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {/* 2. Products Table View */}
      {viewMode === 'table' ? (
        <div className="cockpit-table-shell">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1150px] text-left border-collapse">
              <thead>
                <tr className="cockpit-table-header">
                  <th className="py-3 px-4 w-[28%]">Sản Phẩm & Mã Hiệu</th>
                  <th className="py-3 px-3 w-[13%]">Khách Hàng</th>
                  <th className="py-3 px-3 w-[13%]">Nhà Cung Cấp</th>
                  <th className="py-3 px-3 w-[14%] text-right">Đơn Giá & Biên LN</th>
                  <th className="py-3 px-3 w-[12%]">Đơn Gần Nhất</th>
                  <th className="py-3 px-3 w-[15%]">Quy Cách Kỹ Thuật (Specs)</th>
                  <th className="py-3 px-3 w-[10%]">Hợp Đồng</th>
                  <th className="py-3 px-4 text-center w-[8%]">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8">
                      <CockpitTableEmptyState 
                        searchTerm={searchTerm}
                        onClearSearch={() => setSearchTerm('')}
                        title="Không tìm thấy sản phẩm nào"
                        description="Thử thay đổi từ khóa tìm kiếm hoặc chuyển sang tab lọc khác"
                      />
                    </td>
                  </tr>
                ) : (
                  paginatedProducts.map((p, idx) => (
                    <tr 
                      key={p.code || idx}
                      onClick={() => onSelectProductDetails(p.code || p.name)}
                      className="cockpit-table-row group cursor-pointer"
                    >
                      {/* Product Name & Code */}
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-xl bg-slate-100 group-hover:bg-blue-50 text-slate-600 group-hover:text-blue-600 flex items-center justify-center shrink-0 transition-colors border border-slate-200/60">
                            <Package size={15} />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate" title={p.name}>
                              {p.name}
                            </p>
                            <div className="flex items-center gap-1.5 mt-0.5 text-[11px]">
                              <span className="cockpit-code">
                                {p.code}
                              </span>
                              <span className="text-slate-400 truncate">• {p.category}</span>
                              <span className="text-slate-400 shrink-0">• ĐVT: {p.unit}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Customers */}
                      <td className="py-2.5 px-3">
                        {p.relatedCustomers.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {p.relatedCustomers.map((c, cidx) => (
                              <span 
                                key={cidx}
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[11px] font-medium border border-slate-200/80"
                              >
                                <span className="truncate max-w-[100px]">{c}</span>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      {/* Suppliers */}
                      <td className="py-2.5 px-3">
                        {p.relatedSuppliers.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {p.relatedSuppliers.map((s, sidx) => (
                              <span 
                                key={sidx}
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[11px] font-medium border border-slate-200/80"
                              >
                                <Building2 size={11} className="text-slate-500 shrink-0" />
                                <span className="truncate max-w-[95px]">{s}</span>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      {/* Price & Margin */}
                      <td className="py-2.5 px-3 text-right">
                        {p.sellPrice > 0 ? (
                          <div>
                            <p className="font-bold text-slate-900 font-mono tabular-nums text-xs">{formatVND(p.sellPrice)}</p>
                            <div className="flex items-center justify-end gap-1.5 mt-0.5 text-[10.5px]">
                              <span className="text-slate-400 font-mono tabular-nums">Mua: {formatVND(p.buyPrice)}</span>
                              <span className="font-bold font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                                {p.marginPct}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      {/* Latest PO */}
                      <td className="py-2.5 px-3">
                        {p.latestPO ? (
                          <div>
                            <span 
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectPoDetails?.(p.latestPO['Số đơn hàng'] || p.latestPO['Đơn hàng']);
                              }}
                              className="font-mono font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 px-1.5 py-0.5 rounded border border-teal-200/70 text-[11px] cursor-pointer inline-block"
                            >
                              {p.latestPO['Số đơn hàng'] || p.latestPO['Đơn hàng']}
                            </span>
                            <p className="text-[10px] text-slate-400 mt-0.5 truncate font-mono tabular-nums">
                              {p.latestPO['Số lượng']} {p.unit}
                            </p>
                          </div>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      {/* Technical Specs & Quy Cách */}
                      <td className="py-2.5 px-3 max-w-[200px]">
                        <div className="flex flex-col gap-0.5">
                          {p.primarySpec ? (
                            <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 font-mono font-bold text-[10px] rounded border border-blue-200 inline-block w-fit">
                              {p.primarySpec['Mã Spec']}
                            </span>
                          ) : null}
                          <p className="text-[11px] text-slate-600 truncate line-clamp-1" title={p.specsDescription}>
                            {p.specsDescription}
                          </p>
                        </div>
                      </td>

                      {/* Contracts & Drive Link */}
                      <td className="py-2.5 px-3">
                        {p.contractNumber ? (
                          <div className="flex items-center gap-1">
                            <span className="font-mono text-[11px] font-semibold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 truncate max-w-[70px]">
                              {p.contractNumber}
                            </span>
                            <a
                              href={p.driveSearchUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 px-1 py-0.5 rounded shrink-0"
                              title="Xem file trên Drive"
                            >
                              <HardDrive size={10} />
                              <ArrowUpRight size={9} />
                            </a>
                          </div>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={(e) => handleOpenEdit(p, e)}
                            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                            title="Chỉnh sửa thông tin"
                          >
                            <Edit3 size={13} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectProductDetails(p.code || p.name);
                            }}
                            className="px-2 py-1 bg-slate-900 hover:bg-blue-600 text-white rounded-lg text-[11px] font-semibold inline-flex items-center gap-1 shadow-2xs active:scale-95 transition-all"
                          >
                            <Sparkles size={11} />
                            <span>360°</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Unified Pagination */}
          {filteredProducts.length > 0 && (
            <CockpitPagination
              currentPage={currentPage}
              totalItems={filteredProducts.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
            />
          )}
        </div>
      ) : (
        /* Cards View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4.5">
          {filteredProducts.map((p, idx) => (
            <div
              key={p.code || idx}
              onClick={() => onSelectProductDetails(p.code || p.name)}
              className="bg-white rounded-2xl border border-slate-200/80 p-4.5 hover:shadow-lg hover:shadow-blue-500/5 transition-all cursor-pointer group space-y-3.5 shadow-2xs"
            >
              {/* Card Header */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="px-1.5 py-0.2 bg-slate-100 text-slate-700 font-mono font-bold text-[11px] rounded border border-slate-200/80">
                      {p.code}
                    </span>
                    <span className="text-[11px] text-slate-500">• {p.category}</span>
                  </div>
                  <h3 className="font-bold text-sm text-slate-900 group-hover:text-blue-600 transition-colors mt-1 line-clamp-1">
                    {p.name}
                  </h3>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => handleOpenEdit(p, e)}
                    className="w-6 h-6 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors"
                  >
                    <Edit3 size={12} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectProductDetails(p.code || p.name);
                    }}
                    className="w-6 h-6 rounded-md bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white flex items-center justify-center transition-colors"
                  >
                    <Eye size={12} />
                  </button>
                </div>
              </div>

              {/* 360 Relational Pills */}
              <div className="space-y-1.5 bg-slate-50/70 p-3 rounded-xl border border-slate-100 text-xs">
                {/* Customers */}
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium text-[11px]">Khách hàng:</span>
                  <span className="font-semibold text-slate-800 truncate max-w-[150px] text-[11px]">
                    {p.relatedCustomers.join(', ') || '—'}
                  </span>
                </div>

                {/* Suppliers */}
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium text-[11px]">Nhà cung cấp:</span>
                  <span className="font-semibold text-slate-800 truncate max-w-[150px] text-[11px]">
                    {p.relatedSuppliers.join(', ') || '—'}
                  </span>
                </div>

                {/* Price & Margin */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-200/50">
                  <span className="text-slate-500 font-medium text-[11px]">Giá bán & LN:</span>
                  <span className="font-bold text-slate-900 text-[11px]">
                    {p.sellPrice > 0 ? (formatVND(p.sellPrice) + ' (' + p.marginPct + ')') : '—'}
                  </span>
                </div>

                {/* Latest PO */}
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium text-[11px]">Đơn gần nhất:</span>
                  <span className="font-mono font-medium text-teal-700 text-[11px]">
                    {p.latestPO ? p.latestPO['Số đơn hàng'] || p.latestPO['Đơn hàng'] : '—'}
                  </span>
                </div>

                {/* Specs */}
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium text-[11px]">Specs:</span>
                  <span className="font-mono font-medium text-blue-700 text-[11px]">
                    {p.primarySpec ? p.primarySpec['Mã Spec'] : '—'}
                  </span>
                </div>
              </div>

              {/* Card Footer */}
              <div className="flex items-center justify-between pt-0.5 text-xs text-slate-500">
                <span className="flex items-center gap-1 font-mono text-[10.5px] text-slate-400">
                  <HardDrive size={11} />
                  {p.contractNumber || 'HĐ 2026'}
                </span>
                <span className="font-semibold text-blue-600 text-xs group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                  Hồ sơ 360° <ChevronRight size={12} />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Product Drawer */}
      <Drawer
        open={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Chỉnh Sửa Thông Tin Sản Phẩm"
        subtitle="Cập nhật thông tin chi tiết vào hệ thống"
        icon={<Edit3 size={16} />}
        width="md"
      >
        <form onSubmit={handleSaveEdit} className="p-6 space-y-4 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1.5">Tên sản phẩm (*):</label>
                  <input
                    type="text"
                    required
                    value={editFormData['Tên sản phẩm'] || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, 'Tên sản phẩm': e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none font-bold text-slate-900"
                    placeholder="Nhập tên đầy đủ sản phẩm..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1.5">Mã sản phẩm / SKU (*):</label>
                    <input
                      type="text"
                      required
                      value={editFormData['Mã sản phẩm'] || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, 'Mã sản phẩm': e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none font-mono font-bold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1.5">Đơn vị tính (ĐVT):</label>
                    <select
                      value={editFormData['Đơn Vị Tính'] || 'Cái'}
                      onChange={(e) => setEditFormData({ ...editFormData, 'Đơn Vị Tính': e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none font-bold text-slate-800"
                    >
                      <option value="Cái">Cái</option>
                      <option value="Cuộn">Cuộn</option>
                      <option value="Kg">Kg</option>
                      <option value="Tờ">Tờ</option>
                      <option value="Hộp">Hộp</option>
                      <option value="Bao">Bao</option>
                    </select>
                  </div>
                </div>

                {/* Customer Selector Dropdown */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1.5">Khách hàng:</label>
                    <select
                      value={editFormData['Khách hàng'] || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, 'Khách hàng': e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none font-semibold text-slate-900 cursor-pointer"
                    >
                      <option value="">-- Chọn khách hàng --</option>
                      {allCustomerOptions.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  {/* Supplier Selector Dropdown */}
                  <div>
                    <label className="font-bold text-slate-700 block mb-1.5">Nhà cung cấp:</label>
                    <select
                      value={editFormData['Mã Nhà Cung Cấp'] || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, 'Mã Nhà Cung Cấp': e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none font-semibold text-slate-900 cursor-pointer"
                    >
                      <option value="">-- Chọn nhà cung cấp --</option>
                      {allSupplierOptions.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1.5">Nhóm hàng:</label>
                    <select
                      value={editFormData['Nhóm hàng'] || 'Thùng carton'}
                      onChange={(e) => setEditFormData({ ...editFormData, 'Nhóm hàng': e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none font-semibold text-slate-900 cursor-pointer"
                    >
                      {allCategoryOptions.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1.5">Mã Spec kỹ thuật:</label>
                    <input
                      type="text"
                      value={editFormData['Thông Số Sản Phẩm'] || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, 'Thông Số Sản Phẩm': e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none font-mono text-slate-900"
                      placeholder="VD: Spec-001"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1.5">Trọng lượng riêng:</label>
                    <input
                      type="text"
                      value={editFormData['Trọng lượng riêng'] || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, 'Trọng lượng riêng': e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none text-slate-900"
                      placeholder="VD: 680 (±5%)"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1.5">Tình trạng:</label>
                    <select
                      value={editFormData['Tình trạng'] || 'Đang kinh doanh'}
                      onChange={(e) => setEditFormData({ ...editFormData, 'Tình trạng': e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none font-bold text-slate-800"
                    >
                      <option value="Đang kinh doanh">Đang kinh doanh</option>
                      <option value="Sắp mở bán">Sắp mở bán</option>
                      <option value="Tạm dừng">Tạm dừng</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1.5">Quy cách kỹ thuật (Specs):</label>
                  <textarea
                    rows={2}
                    value={editFormData['Quy cách'] || editFormData['Quy cách kỹ thuật'] || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, 'Quy cách': e.target.value, 'Quy cách kỹ thuật': e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none text-slate-900 text-xs"
                    placeholder="VD: Nhãn in Offset nhiều màu, cán bóng, bế định hình theo TCKT đã duyệt..."
                  />
                </div>

                <div className="pt-4 border-t border-line flex gap-3">
                  <Button
                    type="submit"
                    variant="primary"
                    loading={isSaving}
                    className="flex-1"
                  >
                    Lưu thay đổi
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setIsEditModalOpen(false)}
                  >
                    Hủy
                  </Button>
                </div>
              </form>
      </Drawer>

      {/* Add Product Modal */}
      <Modal
        open={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Thêm Mới Sản Phẩm"
        subtitle="Đăng ký sản phẩm mới vào hệ thống"
        icon={<Plus size={16} />}
        size="md"
      >
        <form onSubmit={handleSaveAdd} className="p-6 space-y-4 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1.5">Tên sản phẩm (*):</label>
                  <input
                    type="text"
                    required
                    value={editFormData['Tên sản phẩm'] || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, 'Tên sản phẩm': e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none font-bold text-slate-900"
                    placeholder="VD: Thùng Thăng Long Bao cứng TH130/07"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1.5">Mã sản phẩm / SKU (*):</label>
                    <input
                      type="text"
                      required
                      value={editFormData['Mã sản phẩm'] || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, 'Mã sản phẩm': e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none font-mono font-bold text-slate-900"
                      placeholder="VD: TH130/07"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1.5">Đơn vị tính (ĐVT):</label>
                    <select
                      value={editFormData['Đơn Vị Tính'] || 'Cái'}
                      onChange={(e) => setEditFormData({ ...editFormData, 'Đơn Vị Tính': e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none font-bold text-slate-800"
                    >
                      <option value="Cái">Cái</option>
                      <option value="Cuộn">Cuộn</option>
                      <option value="Kg">Kg</option>
                      <option value="Tờ">Tờ</option>
                      <option value="Hộp">Hộp</option>
                      <option value="Bao">Bao</option>
                    </select>
                  </div>
                </div>

                {/* Dropdowns for Customer and Supplier */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1.5">Khách hàng:</label>
                    <select
                      value={editFormData['Khách hàng'] || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, 'Khách hàng': e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none font-semibold text-slate-900 cursor-pointer"
                    >
                      <option value="">-- Chọn khách hàng --</option>
                      {allCustomerOptions.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1.5">Nhà cung cấp:</label>
                    <select
                      value={editFormData['Mã Nhà Cung Cấp'] || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, 'Mã Nhà Cung Cấp': e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none font-semibold text-slate-900 cursor-pointer"
                    >
                      <option value="">-- Chọn nhà cung cấp --</option>
                      {allSupplierOptions.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1.5">Nhóm hàng:</label>
                    <select
                      value={editFormData['Nhóm hàng'] || 'Thùng carton'}
                      onChange={(e) => setEditFormData({ ...editFormData, 'Nhóm hàng': e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none font-semibold text-slate-900 cursor-pointer"
                    >
                      {allCategoryOptions.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1.5">Tình trạng:</label>
                    <select
                      value={editFormData['Tình trạng'] || 'Đang kinh doanh'}
                      onChange={(e) => setEditFormData({ ...editFormData, 'Tình trạng': e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none font-bold text-slate-800"
                    >
                      <option value="Đang kinh doanh">Đang kinh doanh</option>
                      <option value="Sắp mở bán">Sắp mở bán</option>
                      <option value="Tạm dừng">Tạm dừng</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1.5">Quy cách kỹ thuật (Specs):</label>
                  <textarea
                    rows={2}
                    value={editFormData['Quy cách'] || editFormData['Quy cách kỹ thuật'] || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, 'Quy cách': e.target.value, 'Quy cách kỹ thuật': e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none text-slate-900 text-xs"
                    placeholder="VD: Thùng carton 5 lớp sóng AB dập ghim / Nhãn in Offset cán bóng..."
                  />
                </div>

                <div className="pt-4 border-t border-line flex gap-3">
                  <Button
                    type="submit"
                    variant="primary"
                    loading={isSaving}
                    className="flex-1"
                  >
                    Tạo sản phẩm
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setIsAddModalOpen(false)}
                  >
                    Hủy
                  </Button>
                </div>
              </form>
      </Modal>
    </div>
  );
}