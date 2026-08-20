import React, { useState, useMemo } from 'react';
import { 
  Package, Search, Filter, Plus, ShieldCheck, DollarSign, TrendingUp, 
  Building2, Users, FileText, ArrowUpRight, ChevronRight, Eye, 
  Edit3, Trash2, Layers, CheckCircle2, AlertCircle, HardDrive, 
  ExternalLink, Sparkles, Truck, ShoppingCart, Tag, Clock, HelpCircle,
  LayoutGrid, List, Check, X, PlusCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import clsx from 'clsx';
import { toast } from 'react-hot-toast';
import { formatVND, parseNumber } from '../lib/business-logic';
import CompanyLogo from './CompanyLogo';
import { getDriveFolderPath, formatShortFileName } from '../lib/driveSync';

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

      return {
        raw: p,
        code,
        name,
        category: p['Nhóm hàng'] || p['Phân loại'] || 'Chung',
        unit: p['Đơn Vị Tính'] || p['ĐVT'] || 'Cái',
        status: p['Tình trạng'] || 'Đang kinh doanh',
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

  // Categories, Customers, and Suppliers list for filtering
  const categories = useMemo(() => {
    const set = new Set(enrichedProducts.map((p) => p.category).filter(Boolean));
    return ['All', ...Array.from(set)];
  }, [enrichedProducts]);

  const customersList = useMemo(() => {
    const list: string[] = [];
    enrichedProducts.forEach((p) => p.relatedCustomers.forEach((c) => list.push(c)));
    return ['All', ...Array.from(new Set(list))];
  }, [enrichedProducts]);

  const suppliersList = useMemo(() => {
    const list: string[] = [];
    enrichedProducts.forEach((p) => p.relatedSuppliers.forEach((s) => list.push(s)));
    return ['All', ...Array.from(new Set(list))];
  }, [enrichedProducts]);

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

      return matchesSearch && matchesCat && matchesCust && matchesSupp;
    });
  }, [enrichedProducts, searchTerm, selectedCategory, selectedCustomer, selectedSupplier]);

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
      'Khách hàng': p.relatedCustomers[0] || p.raw['Khách hàng'] || '',
      'Mã Nhà Cung Cấp': p.relatedSuppliers[0] || p.raw['Mã Nhà Cung Cấp'] || '',
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
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 bg-slate-50/50 min-h-screen relative">
      {/* 1. Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-black/[0.06] shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-sm shadow-blue-500/20">
              <Package size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900">Danh Mục Sản Phẩm & Liên Kết 360°</h1>
                <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 text-xs font-bold rounded-full border border-blue-200">
                  {metrics.total} Sản phẩm
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Single Source of Truth liên kết đa chiều: Khách hàng • Nhà cung cấp • Bảng giá • Lợi nhuận • Đơn hàng • Specs kỹ thuật • Hợp đồng Drive
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              setEditFormData({
                'Mã sản phẩm': '',
                'Tên sản phẩm': '',
                'Nhóm hàng': 'Thùng carton',
                'Đơn Vị Tính': 'Cái',
                'Khách hàng': 'Thăng Long',
                'Mã Nhà Cung Cấp': 'YFY',
                'Tình trạng': 'Đang kinh doanh'
              });
              setIsAddModalOpen(true);
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-blue-500/20 active:scale-95 transition-all"
          >
            <Plus size={15} />
            <span>Thêm sản phẩm</span>
          </button>

          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80">
            <button
              onClick={() => setViewMode('table')}
              className={clsx(
                "p-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all",
                viewMode === 'table' ? "bg-white text-blue-600 shadow-2xs" : "text-slate-500 hover:text-slate-900"
              )}
              title="Xem dạng bảng liên kết"
            >
              <List size={15} />
              <span className="hidden sm:inline">Bảng chi tiết</span>
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={clsx(
                "p-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all",
                viewMode === 'cards' ? "bg-white text-blue-600 shadow-2xs" : "text-slate-500 hover:text-slate-900"
              )}
              title="Xem dạng lưới thẻ 360°"
            >
              <LayoutGrid size={15} />
              <span className="hidden sm:inline">Thẻ 360°</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Key Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500">Tổng sản phẩm kinh doanh</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">{metrics.total}</h3>
            <p className="text-[11px] text-emerald-600 font-medium mt-0.5">100% đồng bộ Firestore</p>
          </div>
          <div className="w-11 h-11 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
            <Package size={22} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500">Đã liên kết Bảng Giá 2026</p>
            <h3 className="text-2xl font-bold text-emerald-600 mt-1">{metrics.withPricing} <span className="text-xs text-slate-400 font-normal">/ {metrics.total}</span></h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Có đơn giá mua & bán</p>
          </div>
          <div className="w-11 h-11 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
            <DollarSign size={22} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500">Đã có Tiêu chuẩn Specs & CAD</p>
            <h3 className="text-2xl font-bold text-indigo-600 mt-1">{metrics.withSpecs} <span className="text-xs text-slate-400 font-normal">/ {metrics.total}</span></h3>
            <p className="text-[11px] text-indigo-600 font-medium mt-0.5">Chuẩn ISO mẫu kiểm định</p>
          </div>
          <div className="w-11 h-11 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
            <ShieldCheck size={22} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500">Doanh thu phát sinh PO</p>
            <h3 className="text-xl font-bold text-slate-900 mt-1">{formatVND(metrics.totalRev)}</h3>
            <p className="text-[11px] text-blue-600 font-medium mt-0.5">{metrics.withOrders} sản phẩm đã có PO</p>
          </div>
          <div className="w-11 h-11 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center">
            <TrendingUp size={22} />
          </div>
        </div>
      </div>

      {/* 3. Filters & Search Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Tìm theo mã SP, tên sản phẩm, khách hàng, nhà cung cấp..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          />
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200/80">
          <span className="text-[11px] font-bold text-slate-500 px-2">Nhóm:</span>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none py-1 pr-2"
          >
            {categories.map((c) => (
              <option key={c} value={c}>{c === 'All' ? 'Tất cả nhóm' : c}</option>
            ))}
          </select>
        </div>

        {/* Customer Filter */}
        <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200/80">
          <span className="text-[11px] font-bold text-slate-500 px-2">Khách:</span>
          <select
            value={selectedCustomer}
            onChange={(e) => setSelectedCustomer(e.target.value)}
            className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none py-1 pr-2 max-w-[150px] truncate"
          >
            {customersList.map((c) => (
              <option key={c} value={c}>{c === 'All' ? 'Tất cả khách hàng' : c}</option>
            ))}
          </select>
        </div>

        {/* Supplier Filter */}
        <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200/80">
          <span className="text-[11px] font-bold text-slate-500 px-2">NCC:</span>
          <select
            value={selectedSupplier}
            onChange={(e) => setSelectedSupplier(e.target.value)}
            className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none py-1 pr-2 max-w-[150px] truncate"
          >
            {suppliersList.map((s) => (
              <option key={s} value={s}>{s === 'All' ? 'Tất cả NCC' : s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 4. Products Table View */}
      {viewMode === 'table' ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/90 text-[11px] font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200/80">
                  <th className="py-3.5 px-4">Sản Phẩm & Tên Chi Tiết</th>
                  <th className="py-3.5 px-4">Khách Hàng Mua</th>
                  <th className="py-3.5 px-4">Nhà Cung Cấp SX</th>
                  <th className="py-3.5 px-4 text-right">Đơn Giá & Biên LN</th>
                  <th className="py-3.5 px-4">Đơn Hàng Gần Nhất (PO)</th>
                  <th className="py-3.5 px-4">Tiêu Chuẩn Specs</th>
                  <th className="py-3.5 px-4">Hợp Đồng & Drive</th>
                  <th className="py-3.5 px-4 text-center">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <Package size={40} className="mx-auto mb-2 opacity-40 text-slate-400" />
                      <p className="font-semibold text-slate-600">Không tìm thấy sản phẩm nào phù hợp</p>
                      <p className="text-xs text-slate-400 mt-1">Thử thay đổi từ khóa hoặc bộ lọc nhóm hàng / đối tác</p>
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((p, idx) => (
                    <tr 
                      key={p.code || idx}
                      onClick={() => onSelectProductDetails(p.code || p.name)}
                      className="hover:bg-blue-50/40 transition-colors group cursor-pointer"
                    >
                      {/* Product Name & Code */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-slate-100 group-hover:bg-blue-100 text-slate-600 group-hover:text-blue-600 flex items-center justify-center shrink-0 transition-colors">
                            <Package size={17} />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors text-sm">
                                {p.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="font-mono text-[11px] font-bold text-slate-700 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                                {p.code}
                              </span>
                              <span className="text-[11px] text-slate-400">• {p.category}</span>
                              <span className="text-[11px] text-slate-400">• ĐVT: {p.unit}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Customers */}
                      <td className="py-3.5 px-4">
                        {p.relatedCustomers.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {p.relatedCustomers.map((c, cidx) => (
                              <span 
                                key={cidx}
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-sky-50 text-sky-800 rounded-md text-[11px] font-semibold border border-sky-200/60"
                              >
                                <Building2 size={11} className="text-sky-600 shrink-0" />
                                <span className="truncate max-w-[120px]">{c}</span>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Chưa gán KH</span>
                        )}
                      </td>

                      {/* Suppliers */}
                      <td className="py-3.5 px-4">
                        {p.relatedSuppliers.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {p.relatedSuppliers.map((s, sidx) => (
                              <span 
                                key={sidx}
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-900 rounded-md text-[11px] font-semibold border border-amber-200/60"
                              >
                                <CompanyLogo name={s} className="w-3.5 h-3.5 rounded-full shrink-0" />
                                <span className="truncate max-w-[110px]">{s}</span>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Chưa gán NCC</span>
                        )}
                      </td>

                      {/* Price & Margin */}
                      <td className="py-3.5 px-4 text-right">
                        {p.sellPrice > 0 ? (
                          <div>
                            <p className="font-bold text-slate-900">{formatVND(p.sellPrice)}</p>
                            <div className="flex items-center justify-end gap-1.5 mt-0.5 text-[11px]">
                              <span className="text-slate-400">Mua: {formatVND(p.buyPrice)}</span>
                              <span className="font-bold text-emerald-600 bg-emerald-50 px-1 py-0.2 rounded">
                                {p.marginPct}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Chưa có giá</span>
                        )}
                      </td>

                      {/* Latest PO */}
                      <td className="py-3.5 px-4">
                        {p.latestPO ? (
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSelectPoDetails?.(p.latestPO['Số đơn hàng'] || p.latestPO['Đơn hàng']);
                                }}
                                className="font-mono font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 px-1.5 py-0.5 rounded border border-teal-200/70 text-[11px] cursor-pointer"
                              >
                                {p.latestPO['Số đơn hàng'] || p.latestPO['Đơn hàng']}
                              </span>
                              <span className="text-[11px] font-medium text-slate-500">
                                {p.latestPO['Số lượng']} {p.unit}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              Giao: {p.latestPO['Ngày giao hàng'] || p.latestPO['Ngày đặt'] || '---'}
                            </p>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Chưa phát sinh PO</span>
                        )}
                      </td>

                      {/* Technical Specs */}
                      <td className="py-3.5 px-4">
                        {p.primarySpec ? (
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 font-mono font-bold text-[11px] rounded border border-blue-200">
                              {p.primarySpec['Mã Spec']}
                            </span>
                            <span className="text-[11px] text-slate-600 truncate max-w-[100px]" title={p.primarySpec['Tên tiêu chuẩn']}>
                              {p.primarySpec['Tên tiêu chuẩn']}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Chưa lập Spec</span>
                        )}
                      </td>

                      {/* Contracts & Drive Link */}
                      <td className="py-3.5 px-4">
                        {p.contractNumber ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[11px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                              {p.contractNumber}
                            </span>
                            <a
                              href={p.driveSearchUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-1.5 py-0.5 rounded"
                              title="Xem file trên Drive"
                            >
                              <HardDrive size={11} className="text-blue-500" />
                              <span>Drive</span>
                              <ArrowUpRight size={10} />
                            </a>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Chưa gán HĐ</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={(e) => handleOpenEdit(p, e)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-amber-100 text-slate-600 hover:text-amber-700 transition-colors"
                            title="Chỉnh sửa thông tin sản phẩm"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectProductDetails(p.code || p.name);
                            }}
                            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1 shadow-2xs active:scale-95 transition-all"
                          >
                            <Sparkles size={13} />
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
        </div>
      ) : (
        /* Cards View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((p, idx) => (
            <div
              key={p.code || idx}
              onClick={() => onSelectProductDetails(p.code || p.name)}
              className="bg-white rounded-3xl border border-slate-200/80 p-5 hover:shadow-xl hover:shadow-blue-500/5 transition-all cursor-pointer group space-y-4"
            >
              {/* Card Header */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-mono font-bold text-xs rounded-md">
                      {p.code}
                    </span>
                    <span className="text-xs text-slate-500">• {p.category}</span>
                  </div>
                  <h3 className="font-bold text-base text-slate-900 group-hover:text-blue-600 transition-colors mt-1">
                    {p.name}
                  </h3>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => handleOpenEdit(p, e)}
                    className="w-8 h-8 rounded-full bg-slate-100 hover:bg-amber-100 text-slate-600 hover:text-amber-700 flex items-center justify-center transition-colors"
                  >
                    <Edit3 size={15} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectProductDetails(p.code || p.name);
                    }}
                    className="w-8 h-8 rounded-full bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white flex items-center justify-center transition-colors"
                  >
                    <Eye size={16} />
                  </button>
                </div>
              </div>

              {/* 360 Relational Pills */}
              <div className="space-y-2.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-100 text-xs">
                {/* Customers */}
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 flex items-center gap-1 font-medium">
                    <Building2 size={13} className="text-sky-500" /> Khách hàng:
                  </span>
                  <span className="font-bold text-slate-800 truncate max-w-[160px]">
                    {p.relatedCustomers.join(', ') || 'Chưa gán'}
                  </span>
                </div>

                {/* Suppliers */}
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 flex items-center gap-1 font-medium">
                    <Building2 size={13} className="text-amber-500" /> Nhà cung cấp:
                  </span>
                  <span className="font-bold text-slate-800 truncate max-w-[160px]">
                    {p.relatedSuppliers.join(', ') || 'Chưa gán'}
                  </span>
                </div>

                {/* Price & Margin */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                  <span className="text-slate-500 flex items-center gap-1 font-medium">
                    <DollarSign size={13} className="text-emerald-500" /> Giá bán & LN:
                  </span>
                  <span className="font-bold text-slate-900">
                    {p.sellPrice > 0 ? (formatVND(p.sellPrice) + ' (' + p.marginPct + ')') : 'Chưa có giá'}
                  </span>
                </div>

                {/* Latest PO */}
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 flex items-center gap-1 font-medium">
                    <Truck size={13} className="text-teal-500" /> Đơn gần nhất:
                  </span>
                  <span className="font-mono font-semibold text-teal-700">
                    {p.latestPO ? p.latestPO['Số đơn hàng'] || p.latestPO['Đơn hàng'] : 'Chưa có PO'}
                  </span>
                </div>

                {/* Specs */}
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 flex items-center gap-1 font-medium">
                    <ShieldCheck size={13} className="text-blue-500" /> Tiêu chuẩn Specs:
                  </span>
                  <span className="font-mono font-semibold text-blue-700">
                    {p.primarySpec ? p.primarySpec['Mã Spec'] : 'Chưa lập'}
                  </span>
                </div>
              </div>

              {/* Card Footer */}
              <div className="flex items-center justify-between pt-2 text-xs text-slate-500">
                <span className="flex items-center gap-1 font-mono text-[11px]">
                  <HardDrive size={12} className="text-amber-500" />
                  {p.contractNumber || 'HĐ 2026'}
                </span>
                <span className="font-bold text-blue-600 group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                  Xem chi tiết 360° <ChevronRight size={13} />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Product Drawer / Modal */}
      <AnimatePresence>
        {isEditModalOpen && (
          <div className="fixed inset-0 z-[110] bg-black/40 backdrop-blur-xs flex justify-end animate-in fade-in duration-150">
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col border-l border-slate-200"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center font-bold shadow-sm shadow-amber-500/20">
                    <Edit3 size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">Chỉnh Sửa Thông Tin Sản Phẩm</h3>
                    <p className="text-xs text-slate-500">Cập nhật thông tin chi tiết vào hệ thống</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsEditModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-200/70 hover:bg-slate-300 flex items-center justify-center text-slate-600 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSaveEdit} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
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
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1.5">Khách hàng:</label>
                    <input
                      type="text"
                      value={editFormData['Khách hàng'] || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, 'Khách hàng': e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1.5">Nhà cung cấp:</label>
                    <input
                      type="text"
                      value={editFormData['Mã Nhà Cung Cấp'] || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, 'Mã Nhà Cung Cấp': e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none text-slate-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1.5">Nhóm hàng:</label>
                    <input
                      type="text"
                      value={editFormData['Nhóm hàng'] || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, 'Nhóm hàng': e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none text-slate-900"
                    />
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

                <div className="pt-4 border-t border-slate-100 flex gap-3">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 active:scale-95 transition-all disabled:opacity-50"
                  >
                    <Check size={16} />
                    <span>{isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-5 py-3 border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-100 transition-all"
                  >
                    Hủy
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Product Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-[110] bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg bg-white rounded-3xl shadow-2xl flex flex-col border border-slate-200 overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-sm shadow-blue-500/20">
                    <Plus size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">Thêm Mới Sản Phẩm</h3>
                    <p className="text-xs text-slate-500">Đăng ký sản phẩm mới vào hệ thống</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsAddModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-200/70 hover:bg-slate-300 flex items-center justify-center text-slate-600 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

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
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1.5">Khách hàng:</label>
                    <input
                      type="text"
                      value={editFormData['Khách hàng'] || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, 'Khách hàng': e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1.5">Nhà cung cấp:</label>
                    <input
                      type="text"
                      value={editFormData['Mã Nhà Cung Cấp'] || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, 'Mã Nhà Cung Cấp': e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none text-slate-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1.5">Nhóm hàng:</label>
                    <input
                      type="text"
                      value={editFormData['Nhóm hàng'] || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, 'Nhóm hàng': e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none text-slate-900"
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

                <div className="pt-4 border-t border-slate-100 flex gap-3">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 active:scale-95 transition-all disabled:opacity-50"
                  >
                    <Check size={16} />
                    <span>{isSaving ? 'Đang thêm...' : 'Tạo sản phẩm'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-5 py-3 border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-100 transition-all"
                  >
                    Hủy
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}