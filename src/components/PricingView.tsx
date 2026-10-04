import React, { useState, useMemo, useCallback } from 'react';
import { 
  Package, Search, Filter, Plus, DollarSign, TrendingUp, 
  Building2, Users, FileText, ArrowUpRight, ChevronRight, Eye, 
  Edit3, Trash2, Layers, CheckCircle2, AlertCircle, 
  ExternalLink, Sparkles, LayoutGrid, List, Check, X, 
  PlusCircle, ChevronDown, ChevronUp, Copy, ArrowUpDown, 
  RotateCcw, Scale, Download, Printer, Calculator, Tag
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import clsx from 'clsx';
import * as XLSX from 'xlsx';
import { toast } from 'react-hot-toast';
import { formatVND, parseNumber } from '../lib/business-logic';
import { exportGenericTableToPDF } from '../lib/pdf-exporter';
import MobilePricingCatalog from './MobilePricingCatalog';
import { 
  Button, 
  Modal, 
  Drawer 
} from './ui';

export interface PricingViewProps {
  pricingData: any[];
  contractsData?: any[];
  products?: any[];
  suppliers?: any[];
  poHeaders?: any[];
  poLinesData?: any[];
  deliveryData?: any[];
  deliveryPlanData?: any[];
  customerData?: any[];
  specsData?: any[];
  title?: string;
  onEditPrice?: (row: any) => Promise<void> | void;
  onAddPrice?: (row: any) => Promise<void> | void;
  onDeletePrice?: (row: any) => Promise<void> | void;
  onSelectProductDetails?: (productNameOrSku: string) => void;
  onSelectPoDetails?: (poNumber: string) => void;
  onNavigateTab?: (tab: string) => void;
}

type ViewMode = 'grid' | 'table';
type SortOption = 'profit_desc' | 'margin_desc' | 'price_desc' | 'price_asc' | 'name_asc';
type MarginFilter = 'all' | 'high' | 'mid' | 'low';

const formatVnCurrency = (val: number) => {
  return new Intl.NumberFormat('vi-VN').format(Math.round(val)) + ' ₫';
};

const formatCompactCurrency = (val: number) => {
  if (Math.abs(val) >= 1_000_000_000) {
    return (val / 1_000_000_000).toFixed(2).replace(/\.00$/, '') + ' tỷ ₫';
  }
  if (Math.abs(val) >= 1_000_000) {
    return (val / 1_000_000).toFixed(1).replace(/\.0$/, '') + ' tr ₫';
  }
  if (Math.abs(val) >= 1_000) {
    return (val / 1_000).toFixed(0) + 'k ₫';
  }
  return formatVnCurrency(val);
};

export default function PricingView({
  pricingData = [],
  contractsData = [],
  products = [],
  suppliers = [],
  poHeaders = [],
  poLinesData = [],
  deliveryData = [],
  deliveryPlanData = [],
  customerData = [],
  specsData = [],
  title = "Bảng giá 2026 (Phân loại theo Khách hàng & Nhóm hàng)",
  onEditPrice,
  onAddPrice,
  onDeletePrice,
  onSelectProductDetails,
  onSelectPoDetails,
  onNavigateTab
}: PricingViewProps) {
  // View states
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<string>('all');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('profit_desc');
  const [marginFilter, setMarginFilter] = useState<MarginFilter>('all');

  // Interactive cards & simulators
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedSimulatorId, setExpandedSimulatorId] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [expandedSpecsId, setExpandedSpecsId] = useState<string | null>(null);

  // Modal states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<any | null>(null);
  const [formData, setFormData] = useState<any>({});

  // Extract unique customers
  const customers = useMemo(() => {
    const set = new Set<string>();
    pricingData.forEach(r => {
      const c = r['Giao đến'] || r['RP_Khách hàng'] || r['Khách hàng'];
      if (c) set.add(String(c).trim());
    });
    return Array.from(set).sort();
  }, [pricingData]);

  // Extract unique product groups
  const groups = useMemo(() => {
    const set = new Set<string>();
    pricingData.forEach(r => {
      const g = r['Nhóm sản phẩm'] || r['Nhóm hàng'] || r['Phân loại'];
      if (g) set.add(String(g).trim());
    });
    return Array.from(set).sort();
  }, [pricingData]);

  // Enriched items
  const enrichedList = useMemo(() => {
    return pricingData.map(row => {
      const rowId = row.id || row['Mã giá bán'] || row['Mã sản phẩm'] || JSON.stringify(row);
      const sku = String(row['Mã sản phẩm'] || row['Mã giá bán'] || row['Mã hàng'] || '').trim();
      
      let prodName = String(row['Tên sản phẩm'] || row['Sản phẩm'] || row['Tên hàng'] || '').trim();
      if (!prodName && products.length > 0 && sku) {
        const found = products.find((p: any) => 
          p['Mã sản phẩm'] === sku || p['Mã hàng'] === sku || p.id === sku || p['Mã giá bán'] === sku
        );
        if (found) {
          prodName = found['Tên sản phẩm'] || found['Sản phẩm'] || '';
        }
      }
      if (!prodName) prodName = sku || 'Sản phẩm chưa đặt tên';

      const customer = String(row['RP_Khách hàng'] || row['Giao đến'] || row['Khách hàng'] || '').trim();
      const supplier = String(row['RP_Nhà cung cấp'] || row['Nhà cung cấp'] || '').trim();
      const group = String(row['Nhóm sản phẩm'] || row['Nhóm hàng'] || row['Phân loại'] || 'Chung').trim();
      const unit = String(row['ĐVT'] || 'Cái').trim();
      const contractNum = String(row['Số hợp đồng'] || row['Hợp đồng'] || '').trim();
      const status = String(row['Trạng thái giá'] || row['Trạng thái'] || 'Đang hiệu lực').trim();

      const sellPrice = parseNumber(row['Đơn giá bán'] || row['Giá bán']);
      const newSellPrice = row['Đơn giá bán mới'] ? parseNumber(row['Đơn giá bán mới']) : null;
      const costPrice = parseNumber(row['Đơn giá mua'] || row['Giá mua'] || row['Đơn giá nhập']);
      const avpPrice = row['Giá AVP'] ? parseNumber(row['Giá AVP']) : null;

      let profit = parseNumber(row['Lợi nhuận'] || row['Lợi nhuận (1)']);
      if (!profit && sellPrice > 0 && costPrice > 0) {
        profit = sellPrice - costPrice;
      }

      let marginPct = 0;
      if (row['Biên lợi nhuận']) {
        marginPct = parseNumber(row['Biên lợi nhuận']);
      } else if (sellPrice > 0 && profit > 0) {
        marginPct = Math.round((profit / sellPrice) * 100);
      }

      const isInternalFactory = supplier.toLowerCase().includes('tâm sen') || supplier.toLowerCase().includes('tam sen');

      return {
        ...row,
        _id: rowId,
        _prodName: prodName,
        _sku: sku,
        _customer: customer,
        _supplier: supplier,
        _group: group,
        _unit: unit,
        _contractNum: contractNum,
        _status: status,
        _sellPrice: sellPrice,
        _newSellPrice: newSellPrice,
        _costPrice: costPrice,
        _avpPrice: avpPrice,
        _profit: profit,
        _marginPct: marginPct,
        _isInternalFactory: isInternalFactory
      };
    });
  }, [pricingData, products]);

  // Filtered & Sorted items
  const filteredList = useMemo(() => {
    let result = enrichedList.filter(item => {
      if (selectedCustomer !== 'all' && item._customer !== selectedCustomer) {
        return false;
      }

      if (selectedGroup !== 'all' && item._group !== selectedGroup) {
        return false;
      }

      if (marginFilter === 'high' && item._marginPct < 30) return false;
      if (marginFilter === 'mid' && (item._marginPct < 20 || item._marginPct >= 30)) return false;
      if (marginFilter === 'low' && item._marginPct >= 20) return false;

      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const matchName = item._prodName.toLowerCase().includes(query);
        const matchSku = item._sku.toLowerCase().includes(query);
        const matchCust = item._customer.toLowerCase().includes(query);
        const matchPrice = String(item._sellPrice).includes(query);
        const matchContract = item._contractNum.toLowerCase().includes(query);
        const matchSupplier = item._supplier.toLowerCase().includes(query);
        if (!matchName && !matchSku && !matchCust && !matchPrice && !matchContract && !matchSupplier) {
          return false;
        }
      }

      return true;
    });

    result.sort((a, b) => {
      if (sortBy === 'profit_desc') return b._profit - a._profit;
      if (sortBy === 'margin_desc') return b._marginPct - a._marginPct;
      if (sortBy === 'price_desc') return b._sellPrice - a._sellPrice;
      if (sortBy === 'price_asc') return a._sellPrice - b._sellPrice;
      if (sortBy === 'name_asc') return a._prodName.localeCompare(b._prodName, 'vi');
      return 0;
    });

    return result;
  }, [enrichedList, selectedCustomer, selectedGroup, marginFilter, searchTerm, sortBy]);

  // Statistics
  const stats = useMemo(() => {
    const totalCount = filteredList.length;
    if (totalCount === 0) return { totalCount: 0, avgMargin: 0, avgProfit: 0, uniqueSkus: 0 };

    const skus = new Set(filteredList.map(i => i._sku).filter(Boolean));
    const sumMargin = filteredList.reduce((acc, i) => acc + i._marginPct, 0);
    const sumProfit = filteredList.reduce((acc, i) => acc + i._profit, 0);

    return {
      totalCount,
      avgMargin: Math.round(sumMargin / totalCount),
      avgProfit: Math.round(sumProfit / totalCount),
      uniqueSkus: skus.size
    };
  }, [filteredList]);

  // Handle quick quote copy
  const handleCopyQuote = useCallback((item: any, e: React.MouseEvent) => {
    e.stopPropagation();
    const formattedPrice = formatVnCurrency(item._sellPrice);
    const text = `[BÁO GIÁ TSG 2026]\n📦 ${item._prodName}\n🏷️ Đơn giá: ${formattedPrice} / ${item._unit}\n🏢 Khách hàng: ${item._customer || 'Toàn hệ thống'}\n🔖 Mã SP: ${item._sku} (${item['Mã giá bán'] || item._id})`;

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
      setCopiedId(item._id);
      toast.success(`Đã sao chép báo giá "${item._prodName}"!`, {
        icon: '📋',
        duration: 2500
      });
      setTimeout(() => setCopiedId(null), 2500);
    }
  }, []);

  // Quick simulator toggle
  const toggleSimulator = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (expandedSimulatorId === id) {
      setExpandedSimulatorId(null);
    } else {
      setExpandedSimulatorId(id);
      if (!quantities[id]) {
        setQuantities(prev => ({ ...prev, [id]: 1000 }));
      }
    }
  };

  // Open custom edit modal with auto calculations
  const handleOpenEdit = (item: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingRow(item);
    setFormData({
      'Mã giá bán': item['Mã giá bán'] || item._id,
      'Mã sản phẩm': item['Mã sản phẩm'] || item._sku,
      'Tên sản phẩm': item['Tên sản phẩm'] || item._prodName,
      'RP_Khách hàng': item['RP_Khách hàng'] || item._customer,
      'Giao đến': item['Giao đến'] || item._customer,
      'RP_Nhà cung cấp': item['RP_Nhà cung cấp'] || item._supplier,
      'Nhóm sản phẩm': item['Nhóm sản phẩm'] || item._group,
      'ĐVT': item['ĐVT'] || item._unit,
      'Đơn giá bán': item['Đơn giá bán'] || item._sellPrice,
      'Đơn giá bán mới': item['Đơn giá bán mới'] || '',
      'Đơn giá mua': item['Đơn giá mua'] || item._costPrice,
      'Giá AVP': item['Giá AVP'] || item._avpPrice || '',
      'Lợi nhuận': item['Lợi nhuận'] || item._profit,
      'Biên lợi nhuận': item['Biên lợi nhuận'] || `${item._marginPct}%`,
      'Số hợp đồng': item['Số hợp đồng'] || item._contractNum,
      'Ngày bắt đầu': item['Ngày bắt đầu'] || '12/31/2025',
      'Ngày kết thúc': item['Ngày kết thúc'] || '31/12/2026',
      'Trạng thái giá': item['Trạng thái giá'] || item._status,
      'Ghi chú': item['Ghi chú'] || ''
    });
    setIsEditModalOpen(true);
  };

  // Open custom add modal
  const handleOpenAdd = () => {
    const nextCode = `Gsp_${String(enrichedList.length + 100).padStart(3, '0')}`;
    setFormData({
      'Mã giá bán': nextCode,
      'Mã sản phẩm': '',
      'Tên sản phẩm': '',
      'RP_Khách hàng': customers[0] || 'Thăng Long',
      'Giao đến': customers[0] || 'Thăng Long',
      'RP_Nhà cung cấp': 'Tâm Sen',
      'Nhóm sản phẩm': groups[0] || 'Thùng carton',
      'ĐVT': 'Cái',
      'Đơn giá bán': '',
      'Đơn giá mua': '',
      'Giá AVP': '',
      'Lợi nhuận': '',
      'Biên lợi nhuận': '',
      'Số hợp đồng': '',
      'Ngày bắt đầu': '01/01/2026',
      'Ngày kết thúc': '31/12/2026',
      'Trạng thái giá': 'Đang hiệu lực',
      'Ghi chú': ''
    });
    setIsAddModalOpen(true);
  };

  // Recalculate profit and margin on form input change
  const handleFormChange = (key: string, value: any) => {
    setFormData((prev: any) => {
      const updated = { ...prev, [key]: value };
      
      if (key === 'Đơn giá bán' || key === 'Đơn giá mua') {
        const sell = parseNumber(key === 'Đơn giá bán' ? value : updated['Đơn giá bán']);
        const buy = parseNumber(key === 'Đơn giá mua' ? value : updated['Đơn giá mua']);
        if (sell > 0 && buy >= 0) {
          const profit = sell - buy;
          const margin = Math.round((profit / sell) * 100);
          updated['Lợi nhuận'] = profit;
          updated['Biên lợi nhuận'] = `${margin}%`;
        }
      }
      return updated;
    });
  };

  // Submit edit form
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onEditPrice) return;
    try {
      await onEditPrice({
        ...editingRow,
        ...formData
      });
      setIsEditModalOpen(false);
      setEditingRow(null);
      toast.success('🎉 Đã cập nhật đơn giá thành công!');
    } catch (err: any) {
      toast.error('Lỗi khi lưu đơn giá: ' + (err?.message || err));
    }
  };

  // Submit add form
  const handleSaveAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onAddPrice) return;
    try {
      await onAddPrice({
        id: formData['Mã giá bán'],
        ...formData
      });
      setIsAddModalOpen(false);
      toast.success('🎉 Đã thêm đơn giá mới thành công!');
    } catch (err: any) {
      toast.error('Lỗi khi thêm đơn giá: ' + (err?.message || err));
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    const exportRows = filteredList.map(r => ({
      'Mã giá bán': r['Mã giá bán'] || r._id,
      'Số hợp đồng': r._contractNum,
      'Mã sản phẩm': r._sku,
      'Tên sản phẩm': r._prodName,
      'Khách hàng': r._customer,
      'Nơi giao': r['Giao đến'] || r._customer,
      'Nhà cung cấp': r._supplier,
      'Nhóm sản phẩm': r._group,
      'ĐVT': r._unit,
      'Đơn giá mua': r._costPrice,
      'Giá AVP': r._avpPrice || '',
      'Đơn giá bán': r._sellPrice,
      'Đơn giá bán mới': r._newSellPrice || '',
      'Lợi nhuận': r._profit,
      'Biên lợi nhuận': `${r._marginPct}%`,
      'Ngày bắt đầu': r['Ngày bắt đầu'],
      'Ngày kết thúc': r['Ngày kết thúc'],
      'Trạng thái': r._status
    }));
    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Bang_Gia_2026");
    XLSX.writeFile(wb, `TSG_Bang_Gia_2026_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success('Đã xuất file Excel thành công!');
  };

  // Export to PDF
  const handleExportPDF = () => {
    try {
      const exportRows = filteredList.map(r => ({
        'Mã giá': r['Mã giá bán'] || r._id,
        'Mã SP': r._sku,
        'Tên sản phẩm': r._prodName,
        'Khách hàng': r._customer,
        'ĐVT': r._unit,
        'Giá bán': formatVnCurrency(r._sellPrice),
        'Giá mua': formatVnCurrency(r._costPrice),
        'Lợi nhuận': `+${formatVnCurrency(r._profit)}`,
        'Biên LN': `${r._marginPct}%`,
        'Hợp đồng': r._contractNum
      }));
      exportGenericTableToPDF({
        title: 'BẢNG GIÁ NIÊM YẾT TSG 2026',
        columns: ['Mã giá', 'Mã SP', 'Tên sản phẩm', 'Khách hàng', 'ĐVT', 'Giá bán', 'Giá mua', 'Lợi nhuận', 'Biên LN', 'Hợp đồng'],
        data: exportRows,
        filename: `TSG_Bang_Gia_2026_${new Date().toISOString().slice(0, 10)}.pdf`
      });
      toast.success('Đã xuất file PDF thành công!');
    } catch (err: any) {
      toast.error('Lỗi xuất PDF: ' + (err?.message || err));
    }
  };

  const getCustomerBadgeClass = (customer: string) => {
    const c = customer.toLowerCase();
    if (c.includes('thăng long')) return 'bg-blue-50 text-blue-700 border-blue-200/80';
    if (c.includes('bắc sơn')) return 'bg-emerald-50 text-emerald-700 border-emerald-200/80';
    if (c.includes('thanh hoá') || c.includes('thanh hoa')) return 'bg-purple-50 text-purple-700 border-purple-200/80';
    return 'bg-slate-100 text-slate-700 border-slate-200/80';
  };

  const getMarginBadge = (pct: number) => {
    if (pct >= 30) {
      return (
        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
          <TrendingUp size={11} className="text-emerald-700" />
          <span>{pct}%</span>
        </span>
      );
    }
    if (pct >= 20) {
      return (
        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-black bg-blue-100 text-blue-800 border border-blue-300">
          <span>{pct}%</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
        <span>{pct}%</span>
      </span>
    );
  };

  return (
    <div className="flex-1 p-3 sm:p-6 lg:p-8 flex flex-col md:h-full md:overflow-hidden relative pb-28 md:pb-8 bg-canvas min-h-0">
      
      {/* 📱 Mobile Experience (Active on screens < 768px) */}
      <div className="block md:hidden">
        <MobilePricingCatalog
          data={pricingData}
          contractsData={contractsData}
          products={products}
          suppliers={suppliers}
          specsData={specsData}
          onEdit={(row) => handleOpenEdit(row)}
          onDelete={onDeletePrice}
          onProductClick={(val) => onSelectProductDetails?.(val)}
          onNavigateTab={onNavigateTab}
          onAddNew={onAddPrice ? handleOpenAdd : undefined}
          showAddButton={Boolean(onAddPrice)}
        />
      </div>

      {/* 💻 Executive Desktop Experience (Active on screens >= 768px) */}
      <div className="hidden md:flex md:flex-col md:h-full md:min-h-0 space-y-4">

        {/* 1. Header Toolbar & Subtab Switchers */}
        <div className="flex items-center justify-between gap-3 flex-wrap flex-shrink-0">
          {/* Subtab Pills */}
          <div className="flex items-center bg-slate-200/80 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold border border-slate-300/60 shadow-2xs">
            <button
              type="button"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-2xs font-bold"
            >
              <Package size={14} className="text-emerald-600" />
              <span>Bảng Giá Niêm Yết 2026 ({filteredList.length})</span>
            </button>
            {onNavigateTab && (
              <>
                <button
                  type="button"
                  onClick={() => onNavigateTab('contracts')}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:white transition-all cursor-pointer"
                >
                  <Scale size={14} className="text-blue-600" />
                  <span>Hợp Đồng & Phụ Lục ({contractsData?.length || 0}) ↗</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateTab('commissions')}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:white transition-all cursor-pointer"
                >
                  <span>Chính Sách Hoa Hồng ↗</span>
                </button>
              </>
            )}
          </div>

          {/* Desktop Right Actions & View Switcher */}
          <div className="flex items-center gap-2">
            {/* View Mode Toggle: Grid vs Table */}
            <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 shadow-2xs">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={clsx(
                  "flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer",
                  viewMode === 'grid'
                    ? "bg-white text-blue-700 shadow-2xs"
                    : "text-slate-500 hover:text-slate-800"
                )}
                title="Chế độ Lưới Thẻ Báo Giá (Bento Grid)"
              >
                <LayoutGrid size={13} />
                <span>Thẻ Giá</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={clsx(
                  "flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer",
                  viewMode === 'table'
                    ? "bg-white text-blue-700 shadow-2xs"
                    : "text-slate-500 hover:text-slate-800"
                )}
                title="Chế độ Bảng Kế Toán (Financial Table)"
              >
                <List size={13} />
                <span>Bảng Số Liệu</span>
              </button>
            </div>

            <Button
              variant="secondary"
              size="sm"
              icon={<Download size={14} />}
              onClick={handleExportExcel}
              title="Xuất Bảng Excel"
            >
              <span>Excel</span>
            </Button>

            <Button
              variant="secondary"
              size="sm"
              icon={<FileText size={14} />}
              onClick={handleExportPDF}
              title="Xuất Báo Cáo PDF"
            >
              <span>PDF</span>
            </Button>

            {onAddPrice && (
              <Button
                variant="primary"
                size="sm"
                icon={<Plus size={14} />}
                onClick={handleOpenAdd}
                title="Thêm đơn giá niêm yết mới"
              >
                <span>+ Thêm đơn giá</span>
              </Button>
            )}
          </div>
        </div>

        {/* 2. Desktop Financial Overview KPI Cards */}
        <div className="grid grid-cols-3 gap-3 flex-shrink-0">
          <div className="bg-white border border-slate-200/85 hover:border-slate-300 rounded-xl p-3.5 flex items-center gap-3.5 shadow-2xs">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <Package size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Tổng Sản Phẩm / Đơn Giá
              </p>
              <p className="text-base font-black text-slate-900 font-display tracking-tight mt-0.5 tabular-nums">
                {stats.totalCount} đơn giá <span className="text-xs font-semibold text-slate-500">({stats.uniqueSkus} SKU)</span>
              </p>
            </div>
          </div>

          <div className="bg-white border border-slate-200/85 hover:border-slate-300 rounded-xl p-3.5 flex items-center gap-3.5 shadow-2xs">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <TrendingUp size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
                Biên Lợi Nhuận Trung Bình
              </p>
              <p className="text-base font-black text-emerald-700 font-display tracking-tight mt-0.5 tabular-nums">
                {stats.avgMargin}% <span className="text-xs font-semibold text-emerald-600/80">(Tỷ suất danh mục)</span>
              </p>
            </div>
          </div>

          <div className="bg-white border border-slate-200/85 hover:border-slate-300 rounded-xl p-3.5 flex items-center gap-3.5 shadow-2xs">
            <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <DollarSign size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-teal-700 uppercase tracking-wider">
                Lợi Nhuận Gộp Bình Quân
              </p>
              <p className="text-base font-black text-teal-800 font-display tracking-tight mt-0.5 tabular-nums">
                +{formatCompactCurrency(stats.avgProfit)} <span className="text-xs font-semibold text-slate-500">/ đơn vị SP</span>
              </p>
            </div>
          </div>
        </div>

        {/* 3. Desktop Search & Filter Capsule */}
        <div className="bg-white border border-slate-200/85 rounded-xl p-3.5 space-y-3 shadow-2xs flex-shrink-0">
          <div className="flex items-center gap-3">
            {/* Search Bar */}
            <div className="relative flex-1 max-w-md">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm nhanh theo tên SP, mã SKU, khách hàng, hợp đồng, đơn giá..."
                className="w-full bg-[#F8FAFA] hover:bg-white focus:bg-white border border-slate-200/85 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 rounded-xl pl-9 pr-8 py-2 text-xs font-semibold text-slate-900 outline-none transition-all placeholder:text-slate-400"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X size={10} />
                </button>
              )}
            </div>

            {/* Quick Sort Select */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                <ArrowUpDown size={12} className="text-slate-400" />
                <span>Sắp xếp:</span>
              </span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="profit_desc">💰 Lợi nhuận: Cao nhất</option>
                <option value="margin_desc">📈 Biên LN (%): Cao nhất</option>
                <option value="price_desc">🏷️ Giá bán: Cao → Thấp</option>
                <option value="price_asc">🏷️ Giá bán: Thấp → Cao</option>
                <option value="name_asc">🔤 Tên sản phẩm: A → Z</option>
              </select>
            </div>

            {/* Margin Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-500">Biên độ:</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setMarginFilter(marginFilter === 'high' ? 'all' : 'high')}
                  className={clsx(
                    "px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer",
                    marginFilter === 'high'
                      ? "bg-emerald-600 border-emerald-600 text-white shadow-2xs"
                      : "bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100"
                  )}
                >
                  ⭐ Lãi &gt; 30%
                </button>
                <button
                  type="button"
                  onClick={() => setMarginFilter(marginFilter === 'mid' ? 'all' : 'mid')}
                  className={clsx(
                    "px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer",
                    marginFilter === 'mid'
                      ? "bg-blue-600 border-blue-600 text-white shadow-2xs"
                      : "bg-blue-50 border-blue-200 text-blue-800 hover:bg-blue-100"
                  )}
                >
                  20% - 30%
                </button>
              </div>
            </div>

            {(selectedCustomer !== 'all' || selectedGroup !== 'all' || marginFilter !== 'all' || searchTerm) && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCustomer('all');
                  setSelectedGroup('all');
                  setMarginFilter('all');
                  setSortBy('profit_desc');
                }}
                className="text-xs text-rose-600 hover:text-rose-700 font-bold flex items-center gap-1 ml-auto cursor-pointer"
              >
                <RotateCcw size={12} />
                <span>Xóa lọc</span>
              </button>
            )}
          </div>

          {/* Segmented Filter Pills (Khách hàng & Nhóm hàng) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-100 text-xs">
            {/* By Customer */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                <Building2 size={12} className="text-blue-600" />
                <span>Theo Khách hàng ({customers.length}):</span>
              </span>
              <div className="flex gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setSelectedCustomer('all')}
                  className={clsx(
                    "px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border",
                    selectedCustomer === 'all'
                      ? "bg-blue-600 border-blue-600 text-white shadow-2xs"
                      : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                  )}
                >
                  Tất cả ({enrichedList.length})
                </button>
                {customers.map(c => {
                  const count = enrichedList.filter(i => i._customer === c).length;
                  const isSel = selectedCustomer === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setSelectedCustomer(isSel ? 'all' : c)}
                      className={clsx(
                        "px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border flex items-center gap-1",
                        isSel
                          ? "bg-blue-600 border-blue-600 text-white shadow-2xs"
                          : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                      )}
                    >
                      <span>{c}</span>
                      <span className={clsx("text-[10px] font-mono px-1 rounded", isSel ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500")}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* By Product Group */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                <Layers size={12} className="text-indigo-600" />
                <span>Theo Nhóm hàng ({groups.length}):</span>
              </span>
              <div className="flex gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setSelectedGroup('all')}
                  className={clsx(
                    "px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border",
                    selectedGroup === 'all'
                      ? "bg-indigo-600 border-indigo-600 text-white shadow-2xs"
                      : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                  )}
                >
                  Tất cả nhóm
                </button>
                {groups.map(g => {
                  const count = enrichedList.filter(i => i._group === g && (selectedCustomer === 'all' || i._customer === selectedCustomer)).length;
                  const isSel = selectedGroup === g;
                  return (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setSelectedGroup(isSel ? 'all' : g)}
                      className={clsx(
                        "px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border flex items-center gap-1",
                        isSel
                          ? "bg-indigo-600 border-indigo-600 text-white shadow-2xs"
                          : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                      )}
                    >
                      <span>{g}</span>
                      <span className={clsx("text-[10px] font-mono px-1 rounded", isSel ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500")}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* 4. Main Body: Bento Grid Mode OR Financial Table Mode */}
        <div className="flex-1 overflow-auto min-h-0">
          {filteredList.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-200/85 shadow-2xs space-y-3">
              <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                <Search size={22} />
              </div>
              <h3 className="text-sm font-bold text-slate-800">Không tìm thấy đơn giá phù hợp</h3>
              <p className="text-xs text-slate-500">
                Hãy thử xoá bớt bộ lọc hoặc gõ từ khoá tìm kiếm khác.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCustomer('all');
                  setSelectedGroup('all');
                  setMarginFilter('all');
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
              >
                Đặt lại tất cả bộ lọc
              </button>
            </div>
          ) : viewMode === 'grid' ? (
            /* Bento Grid Mode (Desktop Cards) */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 pb-4">
              {filteredList.map((item) => {
                const isCopied = copiedId === item._id;
                const isSimulating = expandedSimulatorId === item._id;
                const isSpecsExpanded = expandedSpecsId === item._id;
                const simQty = quantities[item._id] || 1000;

                const simRevenue = simQty * item._sellPrice;
                const simCost = simQty * item._costPrice;
                const simProfit = simQty * item._profit;

                const matchedContract = contractsData.find((c: any) => 
                  (c.contractNumber && c.contractNumber.trim().toLowerCase() === item._contractNum.trim().toLowerCase()) ||
                  (c.partnerName && item._customer && c.partnerName.includes(item._customer))
                );
                const driveContractUrl = matchedContract?.attachmentUrl || `https://drive.google.com/drive/search?q=${encodeURIComponent(item._contractNum || item._customer)}`;

                return (
                  <div
                    key={item._id}
                    onClick={() => onSelectProductDetails?.(item._prodName || item._sku)}
                    className="bg-white rounded-2xl p-4 border border-slate-200/85 hover:border-blue-400 hover:shadow-md transition-all space-y-3 cursor-pointer group flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      {/* Top Row: Name & Margin Badge */}
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors leading-snug">
                          {item._prodName}
                        </h3>
                        <div className="shrink-0">
                          {getMarginBadge(item._marginPct)}
                        </div>
                      </div>

                      {/* Badges: SKU, Customer, Group, Supplier */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {item._sku && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200/60">
                            <Tag size={10} className="text-blue-500" />
                            <span>{item._sku}</span>
                          </span>
                        )}

                        {item._customer && (
                          <span className={clsx(
                            "inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded border",
                            getCustomerBadgeClass(item._customer)
                          )}>
                            <Building2 size={10} className="shrink-0" />
                            <span>{item._customer}</span>
                          </span>
                        )}

                        {item._group && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/80">
                            <Layers size={10} className="text-slate-400" />
                            <span>{item._group}</span>
                          </span>
                        )}

                        {item._isInternalFactory ? (
                          <span className="inline-flex items-center gap-0.5 text-[10.5px] font-bold text-teal-800 bg-teal-50 border border-teal-200/80 px-2 py-0.5 rounded">
                            <span>🏭 Tâm Sen (Nội bộ)</span>
                          </span>
                        ) : item._supplier ? (
                          <span className="inline-flex items-center gap-0.5 text-[10.5px] font-medium text-slate-600 bg-slate-50 border border-slate-200/60 px-1.5 py-0.5 rounded">
                            <span>NCC: {item._supplier}</span>
                          </span>
                        ) : null}

                        {item._contractNum && (
                          <a
                            href={driveContractUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-[10.5px] font-mono font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded border border-indigo-200/70 transition-colors"
                            title="Mở tài liệu hợp đồng PDF trên Google Drive"
                          >
                            <FileText size={10} />
                            <span>HĐ: {item._contractNum}</span>
                            <ArrowUpRight size={10} />
                          </a>
                        )}
                      </div>

                      {/* Financial Hero Box */}
                      <div className="bg-gradient-to-r from-slate-50 via-blue-50/20 to-emerald-50/30 rounded-xl p-3 border border-slate-200/80">
                        <div className="grid grid-cols-2 gap-2 items-center">
                          {/* Selling Price */}
                          <div className="border-r border-slate-200/80 pr-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                              Đơn Giá Bán ({item._unit})
                            </span>
                            <div className="text-lg font-black text-blue-700 tracking-tight tabular-nums mt-0.5">
                              {formatVnCurrency(item._sellPrice)}
                            </div>
                            <span className="text-[10.5px] font-mono text-slate-400 block mt-0.5">
                              Giá vốn: {formatVnCurrency(item._costPrice)}
                            </span>
                          </div>

                          {/* Profit */}
                          <div className="pl-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
                              Lợi Nhuận Gộp / ĐV
                            </span>
                            <div className="text-base font-black text-emerald-700 tracking-tight tabular-nums mt-0.5">
                              +{formatVnCurrency(item._profit)}
                            </div>
                            <span className="text-[10.5px] font-semibold text-slate-500 block mt-0.5">
                              Biên LN: <strong className="text-emerald-700 font-mono">{item._marginPct}%</strong>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Profit Simulator (Accordion) */}
                      {isSimulating && (
                        <div
                          className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 space-y-2 text-xs"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-emerald-900 flex items-center gap-1.5">
                              <Calculator size={13} className="text-emerald-700" />
                              <span>Ước Tính Doanh Thu & Lợi Nhuận</span>
                            </span>
                            <span className="font-mono text-emerald-700 font-bold">
                              ĐVT: {item._unit}
                            </span>
                          </div>

                          <div className="flex gap-1.5 overflow-x-auto pb-1">
                            {[100, 500, 1000, 2000, 5000].map(qty => (
                              <button
                                key={qty}
                                type="button"
                                onClick={() => setQuantities(prev => ({ ...prev, [item._id]: qty }))}
                                className={clsx(
                                  "px-2 py-0.5 rounded-lg text-xs font-bold border transition-all cursor-pointer",
                                  simQty === qty
                                    ? "bg-emerald-700 border-emerald-700 text-white"
                                    : "bg-white border-emerald-200 text-emerald-800 hover:bg-emerald-100"
                                )}
                              >
                                {new Intl.NumberFormat('vi-VN').format(qty)}
                              </button>
                            ))}
                          </div>

                          <div className="bg-white rounded-lg p-2 border border-emerald-200/80 space-y-1 text-xs">
                            <div className="flex justify-between text-slate-600">
                              <span>Doanh thu ({simQty} {item._unit}):</span>
                              <span className="font-bold font-mono text-slate-900">{formatVnCurrency(simRevenue)}</span>
                            </div>
                            <div className="flex justify-between text-slate-600">
                              <span>Chi phí vốn:</span>
                              <span className="font-bold font-mono text-slate-700">{formatVnCurrency(simCost)}</span>
                            </div>
                            <div className="flex justify-between pt-1 border-t border-emerald-100 text-emerald-800 font-bold">
                              <span>Lợi nhuận gộp ước tính:</span>
                              <span className="font-black font-mono text-emerald-700">+{formatVnCurrency(simProfit)}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Bottom Action Buttons */}
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 mt-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={(e) => handleCopyQuote(item, e)}
                        className={clsx(
                          "px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border",
                          isCopied
                            ? "bg-emerald-600 border-emerald-600 text-white shadow-xs"
                            : "bg-slate-50 hover:bg-slate-100 border-slate-200/80 text-slate-700"
                        )}
                        title="Sao chép báo giá chuẩn để gửi tin nhắn"
                      >
                        {isCopied ? <Check size={13} /> : <Copy size={13} className="text-blue-600" />}
                        <span>{isCopied ? 'Đã chép!' : 'Chép báo giá'}</span>
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => toggleSimulator(item._id, e)}
                          className={clsx(
                            "px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer border",
                            isSimulating
                              ? "bg-emerald-600 border-emerald-600 text-white shadow-xs"
                              : "bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-800"
                          )}
                          title="Mở máy tính dự toán lợi nhuận"
                        >
                          <Calculator size={13} />
                          <span>Tính LN</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => onSelectProductDetails?.(item._prodName || item._sku)}
                          className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200/80 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                          title="Xem thông tin chi tiết sản phẩm"
                        >
                          <Eye size={13} />
                          <span>Chi tiết</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => handleOpenEdit(item, e)}
                          className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-blue-600 border border-slate-200/80 rounded-xl transition-all cursor-pointer"
                          title="Chỉnh sửa đơn giá"
                        >
                          <Edit3 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Financial Table Mode (Desktop Data Grid) */
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
              <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
                <thead className="bg-[#F8FAFA] border-b border-slate-200/85">
                  <tr>
                    <th className="px-3.5 py-3 font-bold text-slate-600 uppercase tracking-wider text-[11px]">Mã Giá / SKU</th>
                    <th className="px-3.5 py-3 font-bold text-slate-600 uppercase tracking-wider text-[11px]">Tên Sản Phẩm</th>
                    <th className="px-3.5 py-3 font-bold text-slate-600 uppercase tracking-wider text-[11px]">Khách Hàng</th>
                    <th className="px-3.5 py-3 font-bold text-slate-600 uppercase tracking-wider text-[11px]">Nhà Cung Cấp</th>
                    <th className="px-3.5 py-3 font-bold text-slate-600 uppercase tracking-wider text-[11px] text-right">Đơn Giá Bán</th>
                    <th className="px-3.5 py-3 font-bold text-slate-600 uppercase tracking-wider text-[11px] text-right">Đơn Giá Mua</th>
                    <th className="px-3.5 py-3 font-bold text-slate-600 uppercase tracking-wider text-[11px] text-right">Lợi Nhuận Gộp</th>
                    <th className="px-3.5 py-3 font-bold text-slate-600 uppercase tracking-wider text-[11px] text-center">Biên LN (%)</th>
                    <th className="px-3.5 py-3 font-bold text-slate-600 uppercase tracking-wider text-[11px]">Hợp Đồng</th>
                    <th className="px-3.5 py-3 font-bold text-slate-600 uppercase tracking-wider text-[11px] text-center">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredList.map((item) => {
                    const isCopied = copiedId === item._id;
                    const matchedContract = contractsData.find((c: any) => 
                      (c.contractNumber && c.contractNumber.trim().toLowerCase() === item._contractNum.trim().toLowerCase()) ||
                      (c.partnerName && item._customer && c.partnerName.includes(item._customer))
                    );
                    const driveContractUrl = matchedContract?.attachmentUrl || `https://drive.google.com/drive/search?q=${encodeURIComponent(item._contractNum || item._customer)}`;

                    return (
                      <tr
                        key={item._id}
                        onClick={() => onSelectProductDetails?.(item._prodName || item._sku)}
                        className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                      >
                        <td className="px-3.5 py-2.5 font-mono font-bold text-slate-700">
                          <div className="flex flex-col">
                            <span className="text-blue-700">{item['Mã giá bán'] || item._id}</span>
                            <span className="text-[10px] text-slate-400 font-mono">{item._sku}</span>
                          </div>
                        </td>

                        <td className="px-3.5 py-2.5 font-bold text-slate-900 group-hover:text-blue-600 transition-colors max-w-xs truncate" title={item._prodName}>
                          {item._prodName}
                          <span className="text-[11px] font-normal text-slate-400 ml-1">({item._unit})</span>
                        </td>

                        <td className="px-3.5 py-2.5">
                          {item._customer ? (
                            <span className={clsx("inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold border", getCustomerBadgeClass(item._customer))}>
                              <Building2 size={10} className="shrink-0" />
                              <span>{item._customer}</span>
                            </span>
                          ) : '—'}
                        </td>

                        <td className="px-3.5 py-2.5">
                          {item._isInternalFactory ? (
                            <span className="inline-flex items-center gap-0.5 text-xs font-bold text-teal-800 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded">
                              🏭 Tâm Sen (Nội bộ)
                            </span>
                          ) : (
                            <span className="text-slate-600 font-medium">{item._supplier || '—'}</span>
                          )}
                        </td>

                        <td className="px-3.5 py-2.5 font-mono font-bold text-blue-700 text-right tabular-nums text-sm">
                          {formatVnCurrency(item._sellPrice)}
                        </td>

                        <td className="px-3.5 py-2.5 font-mono text-slate-500 text-right tabular-nums">
                          {formatVnCurrency(item._costPrice)}
                        </td>

                        <td className="px-3.5 py-2.5 font-mono font-bold text-emerald-700 text-right tabular-nums text-sm">
                          +{formatVnCurrency(item._profit)}
                        </td>

                        <td className="px-3.5 py-2.5 text-center">
                          {getMarginBadge(item._marginPct)}
                        </td>

                        <td className="px-3.5 py-2.5 font-mono text-indigo-700">
                          {item._contractNum ? (
                            <a
                              href={driveContractUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 hover:underline text-[11px] font-bold"
                            >
                              <span>{item._contractNum}</span>
                              <ArrowUpRight size={10} />
                            </a>
                          ) : '—'}
                        </td>

                        <td className="px-3.5 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => handleCopyQuote(item, e)}
                              className="p-1.5 hover:bg-blue-50 text-slate-500 hover:text-blue-600 rounded-lg transition-colors cursor-pointer"
                              title="Sao chép báo giá"
                            >
                              {isCopied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                            </button>
                            <button
                              type="button"
                              onClick={() => onSelectProductDetails?.(item._prodName || item._sku)}
                              className="p-1.5 hover:bg-blue-50 text-slate-500 hover:text-blue-600 rounded-lg transition-colors cursor-pointer"
                              title="Xem chi tiết sản phẩm"
                            >
                              <Eye size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleOpenEdit(item, e)}
                              className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-blue-600 rounded-lg transition-colors cursor-pointer"
                              title="Chỉnh sửa đơn giá"
                            >
                              <Edit3 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

      {/* 5. Custom Modal Chỉnh Sửa Đơn Giá Niêm Yết (Không còn bảng trắng và trống!) */}
      <Modal
        open={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingRow(null);
        }}
        title="Chỉnh Sửa Đơn Giá Bán & Lợi Nhuận"
        subtitle={`Cập nhật thông tin báo giá cho mã ${formData['Mã giá bán'] || ''}`}
        icon={<Edit3 size={18} />}
        size="lg"
        footer={
          <div className="flex items-center justify-between w-full">
            {onDeletePrice && editingRow && (
              <Button
                variant="danger"
                size="sm"
                icon={<Trash2 size={13} />}
                onClick={() => {
                  if (window.confirm(`Bạn có chắc chắn muốn xoá đơn giá "${formData['Tên sản phẩm']}"?`)) {
                    onDeletePrice(editingRow);
                    setIsEditModalOpen(false);
                  }
                }}
              >
                Xóa giá này
              </Button>
            )}
            <div className="flex items-center gap-2 ml-auto">
              <Button variant="ghost" onClick={() => setIsEditModalOpen(false)}>
                Hủy
              </Button>
              <Button variant="primary" type="submit" form="pricing-edit-form">
                Lưu Thay Đổi
              </Button>
            </div>
          </div>
        }
      >
        <form id="pricing-edit-form" onSubmit={handleSaveEdit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {/* Tên sản phẩm */}
            <div className="space-y-1 col-span-2">
              <label className="font-bold text-slate-600 uppercase tracking-wide">Tên sản phẩm</label>
              <input
                type="text"
                required
                value={formData['Tên sản phẩm'] || ''}
                onChange={(e) => handleFormChange('Tên sản phẩm', e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            {/* Mã giá bán */}
            <div className="space-y-1">
              <label className="font-bold text-slate-600 uppercase tracking-wide">Mã giá bán (ID)</label>
              <input
                type="text"
                readOnly
                value={formData['Mã giá bán'] || ''}
                className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl font-mono text-slate-700 cursor-not-allowed outline-none"
              />
            </div>

            {/* Mã sản phẩm */}
            <div className="space-y-1">
              <label className="font-bold text-slate-600 uppercase tracking-wide">Mã sản phẩm (SKU)</label>
              <input
                type="text"
                value={formData['Mã sản phẩm'] || ''}
                onChange={(e) => handleFormChange('Mã sản phẩm', e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            {/* Khách hàng áp dụng */}
            <div className="space-y-1">
              <label className="font-bold text-slate-600 uppercase tracking-wide">Khách hàng áp dụng</label>
              <select
                value={formData['RP_Khách hàng'] || ''}
                onChange={(e) => {
                  handleFormChange('RP_Khách hàng', e.target.value);
                  handleFormChange('Giao đến', e.target.value);
                }}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
              >
                {customers.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Nhà cung cấp */}
            <div className="space-y-1">
              <label className="font-bold text-slate-600 uppercase tracking-wide">Nhà cung cấp / Nguồn hàng</label>
              <select
                value={formData['RP_Nhà cung cấp'] || ''}
                onChange={(e) => handleFormChange('RP_Nhà cung cấp', e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
              >
                <option value="Tâm Sen">Tâm Sen (Nhà máy tự sản xuất nội bộ)</option>
                <option value="YFY">YFY (Bao bì YFY Hà Nam)</option>
                <option value="Tuấn Bằng">Tuấn Bằng (In bao bì Tuấn Bằng)</option>
                <option value="THP">THP (Bao bì Thuận Hòa Phát)</option>
                {suppliers.filter(s => !['Tâm Sen', 'YFY', 'Tuấn Bằng', 'THP'].includes(s.name || s['Nhà Cung Cấp'])).map(s => {
                  const val = s.name || s['Nhà Cung Cấp'] || s['Supplier_ID'];
                  return <option key={val} value={val}>{val}</option>;
                })}
              </select>
            </div>

            {/* Nhóm sản phẩm */}
            <div className="space-y-1">
              <label className="font-bold text-slate-600 uppercase tracking-wide">Nhóm sản phẩm</label>
              <select
                value={formData['Nhóm sản phẩm'] || ''}
                onChange={(e) => handleFormChange('Nhóm sản phẩm', e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
              >
                <option value="Thùng carton">Thùng carton</option>
                <option value="Nguyên liệu">Nguyên liệu (Lưỡi gà)</option>
                <option value="In ấn ">In ấn (Nhãn, tem)</option>
                <option value="Khác">Khác</option>
              </select>
            </div>

            {/* Đơn vị tính */}
            <div className="space-y-1">
              <label className="font-bold text-slate-600 uppercase tracking-wide">Đơn vị tính (ĐVT)</label>
              <select
                value={formData['ĐVT'] || ''}
                onChange={(e) => handleFormChange('ĐVT', e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
              >
                <option value="Cái">Cái</option>
                <option value="Cuộn">Cuộn</option>
                <option value="Kg">Kg</option>
                <option value="Tờ">Tờ</option>
              </select>
            </div>

            {/* Đơn giá bán */}
            <div className="space-y-1">
              <label className="font-bold text-blue-700 uppercase tracking-wide">Đơn giá bán niêm yết (₫)</label>
              <input
                type="number"
                required
                value={formData['Đơn giá bán'] || ''}
                onChange={(e) => handleFormChange('Đơn giá bán', e.target.value)}
                className="w-full px-3 py-2 bg-blue-50/50 border border-blue-300 rounded-xl font-mono font-bold text-blue-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Nhập giá bán..."
              />
              {formData['Đơn giá bán'] && (
                <span className="text-[11px] font-semibold text-blue-600 block">
                  Định dạng: {formatVnCurrency(parseNumber(formData['Đơn giá bán']))}
                </span>
              )}
            </div>

            {/* Đơn giá mua / Giá vốn */}
            <div className="space-y-1">
              <label className="font-bold text-slate-600 uppercase tracking-wide">Đơn giá mua / Giá vốn (₫)</label>
              <input
                type="number"
                required
                value={formData['Đơn giá mua'] || ''}
                onChange={(e) => handleFormChange('Đơn giá mua', e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono text-slate-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Nhập giá vốn..."
              />
              {formData['Đơn giá mua'] && (
                <span className="text-[11px] font-semibold text-slate-500 block">
                  Định dạng: {formatVnCurrency(parseNumber(formData['Đơn giá mua']))}
                </span>
              )}
            </div>

            {/* Lợi nhuận (Tự động tính) */}
            <div className="space-y-1">
              <label className="font-bold text-emerald-700 uppercase tracking-wide flex items-center justify-between">
                <span>Lợi nhuận gộp (₫)</span>
                <span className="text-[10px] text-emerald-600 font-semibold">Tự động tính</span>
              </label>
              <input
                type="text"
                readOnly
                value={formatVnCurrency(parseNumber(formData['Lợi nhuận'] || 0))}
                className="w-full px-3 py-2 bg-emerald-50 border border-emerald-300 rounded-xl font-mono font-bold text-emerald-900 text-sm outline-none cursor-not-allowed"
              />
            </div>

            {/* Biên lợi nhuận (Tự động tính) */}
            <div className="space-y-1">
              <label className="font-bold text-emerald-700 uppercase tracking-wide flex items-center justify-between">
                <span>Biên lợi nhuận (%)</span>
                <span className="text-[10px] text-emerald-600 font-semibold">Tự động tính</span>
              </label>
              <input
                type="text"
                readOnly
                value={formData['Biên lợi nhuận'] || '0%'}
                className="w-full px-3 py-2 bg-emerald-50 border border-emerald-300 rounded-xl font-mono font-bold text-emerald-900 text-sm outline-none cursor-not-allowed"
              />
            </div>

            {/* Số hợp đồng */}
            <div className="space-y-1">
              <label className="font-bold text-slate-600 uppercase tracking-wide">Số hợp đồng</label>
              <input
                type="text"
                value={formData['Số hợp đồng'] || ''}
                onChange={(e) => handleFormChange('Số hợp đồng', e.target.value)}
                placeholder="VD: 177/HĐ-TLTL"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            {/* Trạng thái giá */}
            <div className="space-y-1">
              <label className="font-bold text-slate-600 uppercase tracking-wide">Trạng thái giá</label>
              <select
                value={formData['Trạng thái giá'] || 'Đang hiệu lực'}
                onChange={(e) => handleFormChange('Trạng thái giá', e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
              >
                <option value="Đang hiệu lực">Đang hiệu lực</option>
                <option value="Hết hiệu lực">Hết hiệu lực</option>
                <option value="Đang đàm phán">Đang đàm phán</option>
              </select>
            </div>
          </div>
        </form>
      </Modal>

      {/* 6. Custom Modal Thêm Mới Đơn Giá */}
      <Modal
        open={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Thêm Đơn Giá Niêm Yết Mới"
        subtitle="Nhập thông tin sản phẩm và biểu giá bán năm 2026"
        icon={<PlusCircle size={18} />}
        size="lg"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button variant="ghost" onClick={() => setIsAddModalOpen(false)}>
              Hủy
            </Button>
            <Button variant="primary" type="submit" form="pricing-add-form">
              Tạo Đơn Giá
            </Button>
          </div>
        }
      >
        <form id="pricing-add-form" onSubmit={handleSaveAdd} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="space-y-1 col-span-2">
              <label className="font-bold text-slate-600 uppercase tracking-wide">Tên sản phẩm *</label>
              <input
                type="text"
                required
                placeholder="Nhập tên sản phẩm..."
                value={formData['Tên sản phẩm'] || ''}
                onChange={(e) => handleFormChange('Tên sản phẩm', e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-600 uppercase tracking-wide">Mã giá bán (Tự động)</label>
              <input
                type="text"
                readOnly
                value={formData['Mã giá bán'] || ''}
                className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl font-mono text-slate-700 cursor-not-allowed outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-600 uppercase tracking-wide">Mã sản phẩm (SKU) *</label>
              <input
                type="text"
                required
                placeholder="VD: TH130/07 hoặc LGTPS-002-71"
                value={formData['Mã sản phẩm'] || ''}
                onChange={(e) => handleFormChange('Mã sản phẩm', e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-600 uppercase tracking-wide">Khách hàng áp dụng *</label>
              <select
                value={formData['RP_Khách hàng'] || ''}
                onChange={(e) => {
                  handleFormChange('RP_Khách hàng', e.target.value);
                  handleFormChange('Giao đến', e.target.value);
                }}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
              >
                {customers.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-600 uppercase tracking-wide">Nhà cung cấp / Nguồn hàng</label>
              <select
                value={formData['RP_Nhà cung cấp'] || ''}
                onChange={(e) => handleFormChange('RP_Nhà cung cấp', e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
              >
                <option value="Tâm Sen">Tâm Sen (Nhà máy tự sản xuất nội bộ)</option>
                <option value="YFY">YFY (Bao bì YFY Hà Nam)</option>
                <option value="Tuấn Bằng">Tuấn Bằng (In bao bì Tuấn Bằng)</option>
                <option value="THP">THP (Bao bì Thuận Hòa Phát)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-600 uppercase tracking-wide">Nhóm sản phẩm</label>
              <select
                value={formData['Nhóm sản phẩm'] || ''}
                onChange={(e) => handleFormChange('Nhóm sản phẩm', e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
              >
                <option value="Thùng carton">Thùng carton</option>
                <option value="Nguyên liệu">Nguyên liệu (Lưỡi gà)</option>
                <option value="In ấn ">In ấn (Nhãn, tem)</option>
                <option value="Khác">Khác</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-600 uppercase tracking-wide">Đơn vị tính (ĐVT)</label>
              <select
                value={formData['ĐVT'] || ''}
                onChange={(e) => handleFormChange('ĐVT', e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
              >
                <option value="Cái">Cái</option>
                <option value="Cuộn">Cuộn</option>
                <option value="Kg">Kg</option>
                <option value="Tờ">Tờ</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-blue-700 uppercase tracking-wide">Đơn giá bán niêm yết (₫) *</label>
              <input
                type="number"
                required
                value={formData['Đơn giá bán'] || ''}
                onChange={(e) => handleFormChange('Đơn giá bán', e.target.value)}
                className="w-full px-3 py-2 bg-blue-50/50 border border-blue-300 rounded-xl font-mono font-bold text-blue-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="VD: 12500"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-600 uppercase tracking-wide">Đơn giá mua / Giá vốn (₫) *</label>
              <input
                type="number"
                required
                value={formData['Đơn giá mua'] || ''}
                onChange={(e) => handleFormChange('Đơn giá mua', e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono text-slate-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="VD: 8500"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-emerald-700 uppercase tracking-wide">Lợi nhuận gộp (₫) - Tự động</label>
              <input
                type="text"
                readOnly
                value={formatVnCurrency(parseNumber(formData['Lợi nhuận'] || 0))}
                className="w-full px-3 py-2 bg-emerald-50 border border-emerald-300 rounded-xl font-mono font-bold text-emerald-900 text-sm outline-none cursor-not-allowed"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-emerald-700 uppercase tracking-wide">Biên lợi nhuận (%) - Tự động</label>
              <input
                type="text"
                readOnly
                value={formData['Biên lợi nhuận'] || '0%'}
                className="w-full px-3 py-2 bg-emerald-50 border border-emerald-300 rounded-xl font-mono font-bold text-emerald-900 text-sm outline-none cursor-not-allowed"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-600 uppercase tracking-wide">Số hợp đồng</label>
              <input
                type="text"
                value={formData['Số hợp đồng'] || ''}
                onChange={(e) => handleFormChange('Số hợp đồng', e.target.value)}
                placeholder="VD: 177/HĐ-TLTL"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-600 uppercase tracking-wide">Trạng thái giá</label>
              <select
                value={formData['Trạng thái giá'] || 'Đang hiệu lực'}
                onChange={(e) => handleFormChange('Trạng thái giá', e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
              >
                <option value="Đang hiệu lực">Đang hiệu lực</option>
                <option value="Đang đàm phán">Đang đàm phán</option>
              </select>
            </div>
          </div>
        </form>
      </Modal>

    </div>
  );
}
