import React, { useState, useMemo, useCallback } from 'react';
import { 
  Package, Search, Plus, DollarSign, TrendingUp, 
  Building2, FileText, ArrowUpRight, Eye, 
  Edit3, Trash2, Layers, CheckCircle2, 
  Download, Copy, ArrowUpDown, RotateCcw, 
  Scale, Tag, X, List, LayoutGrid, Check
} from 'lucide-react';
import clsx from 'clsx';
import * as XLSX from 'xlsx';
import { toast } from 'react-hot-toast';
import { formatVND, parseNumber } from '../lib/business-logic';
import { exportGenericTableToPDF } from '../lib/pdf-exporter';
import MobilePricingCatalog from './MobilePricingCatalog';
import { Button, Modal } from './ui';

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

type ViewMode = 'table' | 'cards';
type SortOption = 'name_asc' | 'price_desc' | 'price_asc' | 'profit_desc' | 'margin_desc';
type MarginFilter = 'all' | 'high' | 'mid';

const formatVnCurrency = (val: number) => {
  return new Intl.NumberFormat('vi-VN').format(Math.round(val)) + ' ₫';
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
  // View states: Default to clean table mode for high legibility
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<string>('all');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('name_asc');
  const [marginFilter, setMarginFilter] = useState<MarginFilter>('all');
  const [groupByCustomer, setGroupByCustomer] = useState<boolean>(false);

  // Clipboard feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);

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

  // Enriched items with clean parsed attributes
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

  // Count items per customer
  const customerCounts = useMemo(() => {
    const map: Record<string, number> = {};
    enrichedList.forEach(item => {
      const c = item._customer || 'Khác';
      map[c] = (map[c] || 0) + 1;
    });
    return map;
  }, [enrichedList]);

  // Count items per group
  const groupCounts = useMemo(() => {
    const map: Record<string, number> = {};
    enrichedList.forEach(item => {
      const g = item._group || 'Khác';
      map[g] = (map[g] || 0) + 1;
    });
    return map;
  }, [enrichedList]);

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

      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const matchName = item._prodName.toLowerCase().includes(query);
        const matchSku = item._sku.toLowerCase().includes(query);
        const matchCust = item._customer.toLowerCase().includes(query);
        const matchPrice = String(item._sellPrice).includes(query);
        const matchContract = item._contractNum.toLowerCase().includes(query);
        if (!matchName && !matchSku && !matchCust && !matchPrice && !matchContract) {
          return false;
        }
      }

      return true;
    });

    result.sort((a, b) => {
      if (sortBy === 'name_asc') return a._prodName.localeCompare(b._prodName, 'vi');
      if (sortBy === 'price_desc') return b._sellPrice - a._sellPrice;
      if (sortBy === 'price_asc') return a._sellPrice - b._sellPrice;
      if (sortBy === 'profit_desc') return b._profit - a._profit;
      if (sortBy === 'margin_desc') return b._marginPct - a._marginPct;
      return 0;
    });

    return result;
  }, [enrichedList, selectedCustomer, selectedGroup, marginFilter, searchTerm, sortBy]);

  // Unique SKUs count
  const uniqueSkusCount = useMemo(() => {
    return new Set(filteredList.map(i => i._sku).filter(Boolean)).size;
  }, [filteredList]);

  // Grouped by customer for grouped view
  const groupedByCustomerData = useMemo(() => {
    const groupsMap: Record<string, typeof filteredList> = {};
    filteredList.forEach(item => {
      const cust = item._customer || 'Khách hàng khác';
      if (!groupsMap[cust]) groupsMap[cust] = [];
      groupsMap[cust].push(item);
    });
    return groupsMap;
  }, [filteredList]);

  // Quick copy quote to clipboard
  const handleCopyQuote = useCallback((item: any, e: React.MouseEvent) => {
    e.stopPropagation();
    const formattedPrice = formatVnCurrency(item._sellPrice);
    const text = `[BÁO GIÁ TSG 2026]\n📦 ${item._prodName}\n🏷️ Đơn giá: ${formattedPrice} / ${item._unit}\n🏢 Khách hàng: ${item._customer || 'Toàn hệ thống'}\n🔖 Mã SP: ${item._sku} (${item['Mã giá bán'] || item._id})`;

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
      setCopiedId(item._id);
      toast.success(`Đã sao chép giá "${item._prodName}"!`, {
        icon: '📋',
        duration: 2500
      });
      setTimeout(() => setCopiedId(null), 2500);
    }
  }, []);

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
    if (c.includes('thăng long')) return 'bg-blue-50 text-blue-700 border-blue-200';
    if (c.includes('bắc sơn')) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (c.includes('thanh hoá') || c.includes('thanh hoa')) return 'bg-purple-50 text-purple-700 border-purple-200';
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  return (
    <div className="flex-1 p-3 sm:p-6 lg:p-7 flex flex-col md:h-full md:overflow-hidden relative pb-28 md:pb-6 bg-slate-50/50 min-h-0 space-y-4">
      
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

      {/* 💻 Clean Desktop Experience (Active on screens >= 768px) */}
      <div className="hidden md:flex md:flex-col md:h-full md:min-h-0 space-y-3.5">

        {/* 1. Header Toolbar: Title, Clean Statistics & Quick Actions */}
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center justify-between gap-4 shadow-2xs flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-xs">
              <Package size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-black text-slate-900 tracking-tight">
                  Bảng Giá Bán 2026
                </h1>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  {filteredList.length} sản phẩm
                </span>
                {uniqueSkusCount > 0 && (
                  <span className="text-[11px] font-semibold text-slate-500">
                    ({uniqueSkusCount} mã SKU)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Đang áp dụng cho <strong className="text-slate-800 font-semibold">{customers.length} khách hàng</strong> trên <strong className="text-slate-800 font-semibold">{groups.length} nhóm hàng hóa</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Switcher */}
            <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={clsx(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer",
                  viewMode === 'table'
                    ? "bg-white text-blue-700 shadow-2xs"
                    : "text-slate-500 hover:text-slate-800"
                )}
                title="Xem dạng Bảng tra cứu chuẩn (Gọn gàng, dễ đối chiếu)"
              >
                <List size={14} />
                <span>Bảng dữ liệu</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={clsx(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer",
                  viewMode === 'cards'
                    ? "bg-white text-blue-700 shadow-2xs"
                    : "text-slate-500 hover:text-slate-800"
                )}
                title="Xem dạng Thẻ sản phẩm nổi bật"
              >
                <LayoutGrid size={14} />
                <span>Thẻ sản phẩm</span>
              </button>
            </div>

            <Button
              variant="secondary"
              size="sm"
              icon={<Download size={14} />}
              onClick={handleExportExcel}
              title="Xuất file Excel"
            >
              <span>Excel</span>
            </Button>

            <Button
              variant="secondary"
              size="sm"
              icon={<FileText size={14} />}
              onClick={handleExportPDF}
              title="Xuất file PDF"
            >
              <span>PDF</span>
            </Button>

            {onAddPrice && (
              <Button
                variant="primary"
                size="sm"
                icon={<Plus size={14} />}
                onClick={handleOpenAdd}
                title="Thêm đơn giá sản phẩm mới"
              >
                <span>+ Thêm giá mới</span>
              </Button>
            )}
          </div>
        </div>

        {/* 2. Customer Navigation Tabs (Primary Level Filter - Rõ ràng, không rối mắt) */}
        <div className="bg-white rounded-xl border border-slate-200 p-2 shadow-2xs flex-shrink-0">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-2 shrink-0 flex items-center gap-1">
              <Building2 size={13} className="text-slate-500" />
              <span>Khách hàng:</span>
            </span>

            <button
              type="button"
              onClick={() => setSelectedCustomer('all')}
              className={clsx(
                "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer border flex items-center gap-1.5",
                selectedCustomer === 'all'
                  ? "bg-blue-600 border-blue-600 text-white shadow-2xs"
                  : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
              )}
            >
              <span>Tất cả khách hàng</span>
              <span className={clsx(
                "text-[10px] font-mono px-1.5 py-0.2 rounded-full",
                selectedCustomer === 'all' ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600 font-bold"
              )}>
                {enrichedList.length}
              </span>
            </button>

            {customers.map((cust) => {
              const isSelected = selectedCustomer === cust;
              const count = customerCounts[cust] || 0;
              return (
                <button
                  key={cust}
                  type="button"
                  onClick={() => setSelectedCustomer(cust)}
                  className={clsx(
                    "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer border flex items-center gap-1.5",
                    isSelected
                      ? "bg-blue-600 border-blue-600 text-white shadow-2xs"
                      : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                  )}
                >
                  <span>{cust}</span>
                  <span className={clsx(
                    "text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold",
                    isSelected ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                  )}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Secondary Toolbar: Search, Product Groups & Sort */}
        <div className="bg-white rounded-xl border border-slate-200 px-3.5 py-2.5 flex items-center justify-between gap-3 shadow-2xs flex-shrink-0 text-xs flex-wrap">
          <div className="flex items-center gap-3 flex-1 min-w-[320px]">
            {/* Search Input */}
            <div className="relative flex-1 max-w-sm">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm tên sản phẩm, mã SKU, hợp đồng..."
                className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-blue-500 rounded-lg pl-8 pr-7 py-1.5 text-xs font-semibold text-slate-900 outline-none transition-all placeholder:text-slate-400"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 flex items-center justify-center cursor-pointer"
                >
                  <X size={10} />
                </button>
              )}
            </div>

            {/* Product Groups Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto">
              <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1 shrink-0">
                <Layers size={12} />
                <span>Nhóm:</span>
              </span>
              <button
                type="button"
                onClick={() => setSelectedGroup('all')}
                className={clsx(
                  "px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer border",
                  selectedGroup === 'all'
                    ? "bg-slate-800 border-slate-800 text-white"
                    : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                )}
              >
                Tất cả ({filteredList.length})
              </button>

              {groups.map(g => {
                const isSel = selectedGroup === g;
                const count = groupCounts[g] || 0;
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setSelectedGroup(isSel ? 'all' : g)}
                    className={clsx(
                      "px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer border flex items-center gap-1",
                      isSel
                        ? "bg-slate-800 border-slate-800 text-white"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    <span>{g}</span>
                    <span className={clsx("text-[10px] font-mono", isSel ? "text-slate-300" : "text-slate-400")}>
                      ({count})
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Sort Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                <ArrowUpDown size={12} />
                <span>Sắp xếp:</span>
              </span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="name_asc">🔤 Tên sản phẩm (A → Z)</option>
                <option value="price_desc">🏷️ Giá bán (Cao → Thấp)</option>
                <option value="price_asc">🏷️ Giá bán (Thấp → Cao)</option>
                <option value="profit_desc">💰 Lợi nhuận cao nhất</option>
                <option value="margin_desc">📈 Biên LN (%) cao nhất</option>
              </select>
            </div>

            {/* Group By Customer Toggle (Only when all customers selected) */}
            {selectedCustomer === 'all' && viewMode === 'table' && (
              <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-slate-600 select-none">
                <input
                  type="checkbox"
                  checked={groupByCustomer}
                  onChange={(e) => setGroupByCustomer(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Gom nhóm theo Khách hàng</span>
              </label>
            )}

            {(selectedCustomer !== 'all' || selectedGroup !== 'all' || searchTerm) && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCustomer('all');
                  setSelectedGroup('all');
                  setSortBy('name_asc');
                }}
                className="text-xs text-rose-600 hover:text-rose-700 font-bold flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw size={12} />
                <span>Đặt lại lọc</span>
              </button>
            )}
          </div>
        </div>

        {/* 4. Main Body: Clean Table Mode OR 2-Column Clean Cards */}
        <div className="flex-1 overflow-auto min-h-0 bg-white rounded-xl border border-slate-200 shadow-2xs">
          {filteredList.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                <Search size={22} />
              </div>
              <h3 className="text-sm font-bold text-slate-800">Không tìm thấy sản phẩm phù hợp</h3>
              <p className="text-xs text-slate-500">
                Vui lòng thử từ khoá tìm kiếm khác hoặc bấm đặt lại bộ lọc.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCustomer('all');
                  setSelectedGroup('all');
                }}
                className="px-3.5 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold shadow-xs transition-all cursor-pointer"
              >
                Đặt lại bộ lọc
              </button>
            </div>
          ) : viewMode === 'table' ? (
            /* ======================================================== */
            /* 📋 EXECUTIVE TABLE VIEW: TÊN SẢN PHẨM & GIÁ BÁN NỔI BẬT */
            /* ======================================================== */
            <div className="overflow-x-auto">
              {groupByCustomer && selectedCustomer === 'all' ? (
                /* Grouped Table Sections */
                <div className="divide-y divide-slate-200">
                  {Object.entries(groupedByCustomerData).map(([custName, items]) => (
                    <div key={custName} className="p-3 bg-slate-50/40">
                      <div className="flex items-center gap-2 mb-2 px-1">
                        <Building2 size={15} className="text-blue-600" />
                        <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                          {custName}
                        </h3>
                        <span className="text-[11px] font-bold px-2 py-0.2 bg-blue-100 text-blue-800 rounded-full">
                          {items.length} sản phẩm
                        </span>
                      </div>
                      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                        <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
                          {renderTableHeader(false)}
                          <tbody className="divide-y divide-slate-100">
                            {items.map(item => renderTableRow(item, false))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* Flat Clean Table */
                <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
                  {renderTableHeader(true)}
                  <tbody className="divide-y divide-slate-100">
                    {filteredList.map(item => renderTableRow(item, true))}
                  </tbody>
                </table>
              )}
            </div>
          ) : (
            /* ======================================================== */
            /* 🗂️ CLEAN 2-COLUMN CARDS (KHÔNG DÙNG 3 CỘT RỐI MẮT NỮA!)  */
            /* ======================================================== */
            <div className="p-4 grid grid-cols-1 xl:grid-cols-2 gap-3.5">
              {filteredList.map((item) => {
                const isCopied = copiedId === item._id;
                const matchedContract = contractsData.find((c: any) => 
                  (c.contractNumber && c.contractNumber.trim().toLowerCase() === item._contractNum.trim().toLowerCase()) ||
                  (c.partnerName && item._customer && c.partnerName.includes(item._customer))
                );
                const driveContractUrl = matchedContract?.attachmentUrl || `https://drive.google.com/drive/search?q=${encodeURIComponent(item._contractNum || item._customer)}`;

                return (
                  <div
                    key={item._id}
                    onClick={() => onSelectProductDetails?.(item._prodName || item._sku)}
                    className="bg-white rounded-xl p-4 border border-slate-200 hover:border-blue-400 hover:shadow-sm transition-all cursor-pointer group flex flex-col justify-between space-y-3"
                  >
                    {/* Top: Product Name (Hero Element) */}
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors leading-snug">
                            {item._prodName}
                          </h3>
                          <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                            {item._sku && (
                              <span className="font-mono font-bold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
                                SKU: {item._sku}
                              </span>
                            )}
                            <span>•</span>
                            <span className="font-medium text-slate-600">ĐVT: {item._unit}</span>
                            {item._isInternalFactory && (
                              <>
                                <span>•</span>
                                <span className="font-bold text-teal-700">🏭 Nhà máy Tâm Sen</span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Customer Badge */}
                        {item._customer && (
                          <span className={clsx("shrink-0 text-xs font-bold px-2.5 py-1 rounded-md border", getCustomerBadgeClass(item._customer))}>
                            {item._customer}
                          </span>
                        )}
                      </div>

                      {/* Middle: Clear Prominent Price Section */}
                      <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-baseline justify-between gap-4">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                            Đơn giá bán niêm yết
                          </span>
                          <div className="text-xl font-black text-blue-700 font-mono tracking-tight tabular-nums mt-0.5">
                            {formatVnCurrency(item._sellPrice)}
                            <span className="text-xs font-semibold text-slate-500 ml-1">/ {item._unit}</span>
                          </div>
                        </div>

                        {/* Profit summary chip */}
                        <div className="text-right">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                            Lợi nhuận gộp
                          </span>
                          <div className="text-sm font-bold text-emerald-700 font-mono tabular-nums mt-0.5 flex items-center justify-end gap-1.5">
                            <span>+{formatVnCurrency(item._profit)}</span>
                            {item._marginPct > 0 && (
                              <span className="text-xs px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-extrabold">
                                {item._marginPct}%
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                            Giá vốn: {formatVnCurrency(item._costPrice)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom: Subtle Actions Footer */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2 text-slate-500">
                        {item._group && (
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium text-[11px]">
                            {item._group}
                          </span>
                        )}
                        {item._contractNum && (
                          <a
                            href={driveContractUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-indigo-600 hover:underline flex items-center gap-0.5 text-[11px]"
                            title="Mở hợp đồng Google Drive"
                          >
                            <span>HĐ: {item._contractNum}</span>
                            <ArrowUpRight size={11} />
                          </a>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => handleCopyQuote(item, e)}
                          className={clsx(
                            "px-2.5 py-1 rounded-md font-bold transition-all flex items-center gap-1 cursor-pointer border text-xs",
                            isCopied
                              ? "bg-emerald-600 border-emerald-600 text-white"
                              : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700"
                          )}
                          title="Sao chép báo giá nhanh"
                        >
                          {isCopied ? <Check size={12} /> : <Copy size={12} className="text-blue-600" />}
                          <span>{isCopied ? 'Đã chép' : 'Chép giá'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => onSelectProductDetails?.(item._prodName || item._sku)}
                          className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-md font-bold flex items-center gap-1 transition-all cursor-pointer text-xs"
                          title="Xem thông số kỹ thuật chi tiết"
                        >
                          <Eye size={12} />
                          <span>Chi tiết</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => handleOpenEdit(item, e)}
                          className="p-1 hover:bg-slate-100 text-slate-600 hover:text-blue-600 border border-slate-200 rounded-md transition-all cursor-pointer"
                          title="Chỉnh sửa đơn giá"
                        >
                          <Edit3 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* 5. Custom Modal Chỉnh Sửa Đơn Giá Niêm Yết */}
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
        icon={<Plus size={18} />}
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

  // Helper render Table Header
  function renderTableHeader(showCustomerCol: boolean) {
    return (
      <thead className="bg-slate-50 border-b border-slate-200">
        <tr>
          <th className="px-4 py-3 font-extrabold text-slate-700 uppercase tracking-wider text-[11px] w-[35%]">
            Tên Sản Phẩm & Quy Cách
          </th>
          {showCustomerCol && (
            <th className="px-3.5 py-3 font-bold text-slate-600 uppercase tracking-wider text-[11px] w-[15%]">
              Khách Hàng
            </th>
          )}
          <th className="px-3 py-3 font-bold text-slate-600 uppercase tracking-wider text-[11px] w-[12%]">
            Nhóm Hàng
          </th>
          <th className="px-3 py-3 font-bold text-slate-600 uppercase tracking-wider text-[11px] text-center w-[6%]">
            ĐVT
          </th>
          <th className="px-4 py-3 font-extrabold text-blue-900 uppercase tracking-wider text-[11px] text-right w-[14%] bg-blue-50/40">
            Đơn Giá Bán
          </th>
          <th className="px-3.5 py-3 font-bold text-slate-600 uppercase tracking-wider text-[11px] text-right w-[10%]">
            Giá Vốn
          </th>
          <th className="px-3.5 py-3 font-bold text-emerald-800 uppercase tracking-wider text-[11px] text-right w-[12%]">
            Lợi Nhuận Gộp
          </th>
          <th className="px-3 py-3 font-bold text-slate-600 uppercase tracking-wider text-[11px] text-center w-[8%]">
            Thao Tác
          </th>
        </tr>
      </thead>
    );
  }

  // Helper render Table Row
  function renderTableRow(item: any, showCustomerCol: boolean) {
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
        {/* Tên sản phẩm & Quy cách (Hero column) */}
        <td className="px-4 py-3">
          <div className="flex flex-col">
            <span className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors leading-snug">
              {item._prodName}
            </span>
            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
              {item._sku && (
                <span className="font-mono text-blue-600 font-semibold">
                  Mã: {item._sku}
                </span>
              )}
              {item._isInternalFactory ? (
                <span className="font-semibold text-teal-700 bg-teal-50 px-1 rounded">
                  🏭 Tâm Sen (Nội bộ)
                </span>
              ) : item._supplier ? (
                <span className="text-slate-500">
                  NCC: {item._supplier}
                </span>
              ) : null}
              {item._contractNum && (
                <a
                  href={driveContractUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="font-mono text-indigo-600 hover:underline flex items-center gap-0.5"
                  title="Mở hợp đồng Google Drive"
                >
                  <span>HĐ: {item._contractNum}</span>
                  <ArrowUpRight size={10} />
                </a>
              )}
            </div>
          </div>
        </td>

        {/* Khách hàng */}
        {showCustomerCol && (
          <td className="px-3.5 py-3">
            {item._customer ? (
              <span className={clsx("inline-block px-2.5 py-0.5 rounded text-xs font-bold border", getCustomerBadgeClass(item._customer))}>
                {item._customer}
              </span>
            ) : (
              <span className="text-slate-400">—</span>
            )}
          </td>
        )}

        {/* Nhóm hàng */}
        <td className="px-3 py-3">
          <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium text-[11px]">
            {item._group || 'Chung'}
          </span>
        </td>

        {/* ĐVT */}
        <td className="px-3 py-3 text-center text-slate-600 font-medium">
          {item._unit}
        </td>

        {/* ĐƠN GIÁ BÁN (Hero Metric - Nổi bật nhất) */}
        <td className="px-4 py-3 text-right font-mono font-extrabold text-blue-700 tabular-nums text-base bg-blue-50/20">
          {formatVnCurrency(item._sellPrice)}
        </td>

        {/* Giá vốn */}
        <td className="px-3.5 py-3 text-right font-mono text-slate-500 tabular-nums text-xs">
          {formatVnCurrency(item._costPrice)}
        </td>

        {/* Lợi nhuận gộp */}
        <td className="px-3.5 py-3 text-right">
          <div className="flex flex-col items-end">
            <span className="font-mono font-bold text-emerald-700 tabular-nums text-xs">
              +{formatVnCurrency(item._profit)}
            </span>
            {item._marginPct > 0 && (
              <span className="text-[10px] font-extrabold text-emerald-800 bg-emerald-50 px-1 py-0.2 rounded mt-0.5">
                {item._marginPct}%
              </span>
            )}
          </div>
        </td>

        {/* Thao tác */}
        <td className="px-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-center gap-1">
            <button
              type="button"
              onClick={(e) => handleCopyQuote(item, e)}
              className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-blue-600 rounded-md transition-colors cursor-pointer"
              title="Sao chép báo giá nhanh"
            >
              {isCopied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
            </button>
            <button
              type="button"
              onClick={() => onSelectProductDetails?.(item._prodName || item._sku)}
              className="p-1.5 hover:bg-blue-50 text-slate-500 hover:text-blue-600 rounded-md transition-colors cursor-pointer"
              title="Xem thông số kỹ thuật chi tiết"
            >
              <Eye size={13} />
            </button>
            <button
              type="button"
              onClick={(e) => handleOpenEdit(item, e)}
              className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-blue-600 rounded-md transition-colors cursor-pointer"
              title="Chỉnh sửa đơn giá"
            >
              <Edit3 size={13} />
            </button>
          </div>
        </td>
      </tr>
    );
  }
}
