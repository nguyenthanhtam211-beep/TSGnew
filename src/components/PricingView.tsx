import React, { useState, useMemo, useCallback } from 'react';
import { 
  Package, Search, Plus, DollarSign, TrendingUp, 
  Building2, FileText, ArrowUpRight, Eye, 
  Edit3, Trash2, Layers, CheckCircle2, 
  Download, Copy, ArrowUpDown, RotateCcw, 
  Scale, Tag, X, List, LayoutGrid, Check,
  SlidersHorizontal, ChevronRight, HelpCircle,
  FileSpreadsheet, ShieldCheck, Factory, Sparkles,
  Columns
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

type ViewMode = 'pricebook' | 'master_detail';
type SortOption = 'name_asc' | 'price_desc' | 'price_asc' | 'profit_desc';

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
  // View states
  const [viewMode, setViewMode] = useState<ViewMode>('pricebook');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<string>('all');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('name_asc');
  
  // Toggle internal financial breakdown (COGS & Profit) vs clean customer quote view
  const [showInternalFinancials, setShowInternalFinancials] = useState<boolean>(true);

  // Active selected item for Master-Detail view
  const [activeItemId, setActiveItemId] = useState<string | null>(null);

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

      // Find matching specs if available
      const matchedSpec = specsData.find((s: any) => 
        (sku && s['Mã sản phẩm'] === sku) || 
        (prodName && s['Tên sản phẩm'] === prodName)
      );

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
        _isInternalFactory: isInternalFactory,
        _specs: matchedSpec
      };
    });
  }, [pricingData, products, specsData]);

  // Count items per customer
  const customerCounts = useMemo(() => {
    const map: Record<string, number> = {};
    enrichedList.forEach(item => {
      const c = item._customer || 'Khác';
      map[c] = (map[c] || 0) + 1;
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
      return 0;
    });

    return result;
  }, [enrichedList, selectedCustomer, selectedGroup, searchTerm, sortBy]);

  // Unique SKUs count
  const uniqueSkusCount = useMemo(() => {
    return new Set(filteredList.map(i => i._sku).filter(Boolean)).size;
  }, [filteredList]);

  // Group items hierarchically: Customer -> Category Group
  const hierarchicalData = useMemo(() => {
    // If a specific customer is selected, group by category groups
    // If 'all' customers selected, group by customer then by category groups
    const result: {
      customerName: string;
      categories: {
        categoryName: string;
        items: typeof filteredList;
      }[];
    }[] = [];

    const targetCustomers = selectedCustomer === 'all' 
      ? Array.from(new Set(filteredList.map(i => i._customer || 'Khác'))).sort()
      : [selectedCustomer];

    targetCustomers.forEach(cust => {
      const custItems = filteredList.filter(i => (i._customer || 'Khác') === cust);
      if (custItems.length === 0) return;

      const groupNames = Array.from(new Set(custItems.map(i => i._group || 'Chung'))).sort();
      const categories = groupNames.map(g => ({
        categoryName: g,
        items: custItems.filter(i => (i._group || 'Chung') === g)
      }));

      result.push({
        customerName: cust,
        categories
      });
    });

    return result;
  }, [filteredList, selectedCustomer]);

  // Active item for Master-Detail view
  const activeItem = useMemo(() => {
    if (!activeItemId && filteredList.length > 0) {
      return filteredList[0];
    }
    return filteredList.find(i => i._id === activeItemId) || filteredList[0] || null;
  }, [filteredList, activeItemId]);

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

  const getCategoryIcon = (categoryName: string) => {
    const c = categoryName.toLowerCase();
    if (c.includes('thùng') || c.includes('carton')) return <Package size={15} className="text-amber-600" />;
    if (c.includes('nguyên liệu') || c.includes('lưỡi gà')) return <Layers size={15} className="text-blue-600" />;
    if (c.includes('in') || c.includes('nhãn')) return <Tag size={15} className="text-purple-600" />;
    return <Package size={15} className="text-slate-500" />;
  };

  return (
    <div className="flex-1 p-3 sm:p-5 lg:p-6 flex flex-col md:h-full md:overflow-hidden relative pb-28 md:pb-4 bg-slate-100/70 min-h-0 space-y-3">
      
      {/* 📱 Mobile Experience (< 768px) */}
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

      {/* 💻 Executive Desktop Experience (>= 768px) */}
      <div className="hidden md:flex md:flex-col md:h-full md:min-h-0 space-y-3">

        {/* 1. Header Bar: Tiêu Đề & Chỉ Thống Kê Số Sản Phẩm (Bỏ Tổng Lợi Nhuận Theo Yêu Cầu) */}
        <div className="bg-white rounded-xl border border-slate-200/90 px-4 py-2.5 flex items-center justify-between gap-4 shadow-xs flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold shadow-2xs">
              <FileSpreadsheet size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-black text-slate-900 tracking-tight uppercase">
                  Sổ Bảng Giá Niêm Yết 2026
                </h1>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                  {filteredList.length} sản phẩm
                </span>
                {uniqueSkusCount > 0 && (
                  <span className="text-[11px] font-medium text-slate-500">
                    ({uniqueSkusCount} mã SKU)
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500">
                Phân loại theo <strong className="text-slate-700">{customers.length} khách hàng</strong> & <strong className="text-slate-700">{groups.length} nhóm hàng hóa</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Toggle Chế Độ Xem Nội Bộ (Giá Vốn & Lãi) vs Báo Giá Khách Hàng Thuần Túy */}
            <button
              type="button"
              onClick={() => setShowInternalFinancials(!showInternalFinancials)}
              className={clsx(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer",
                showInternalFinancials 
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
              )}
              title="Bật/Tắt hiển thị phân tích Giá vốn & Lợi nhuận nội bộ"
            >
              <ShieldCheck size={14} className={showInternalFinancials ? "text-emerald-600" : "text-slate-400"} />
              <span>{showInternalFinancials ? 'Đang hiện giá vốn & lãi' : 'Ẩn giá vốn (Chỉ hiện giá bán)'}</span>
            </button>

            {/* Chuyển Chế Độ: Sổ Báo Giá Theo Nhóm Hàng vs Chi Tiết 2 Khung */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode('pricebook')}
                className={clsx(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer",
                  viewMode === 'pricebook'
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-500 hover:text-slate-800"
                )}
                title="Xem dạng Sổ Báo Giá theo Phân Nhóm Hàng"
              >
                <List size={13} />
                <span>Sổ báo giá</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('master_detail')}
                className={clsx(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer",
                  viewMode === 'master_detail'
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-500 hover:text-slate-800"
                )}
                title="Xem dạng 2 Khung (Duyệt danh sách & So sánh chi tiết)"
              >
                <Columns size={13} />
                <span>Chi tiết 2 khung</span>
              </button>
            </div>

            <Button
              variant="secondary"
              size="sm"
              icon={<Download size={13} />}
              onClick={handleExportExcel}
              title="Xuất Excel"
            >
              <span>Excel</span>
            </Button>

            <Button
              variant="secondary"
              size="sm"
              icon={<FileText size={13} />}
              onClick={handleExportPDF}
              title="Xuất PDF"
            >
              <span>PDF</span>
            </Button>

            {onAddPrice && (
              <Button
                variant="primary"
                size="sm"
                icon={<Plus size={13} />}
                onClick={handleOpenAdd}
                title="Thêm giá mới"
              >
                <span>+ Thêm giá</span>
              </Button>
            )}
          </div>
        </div>

        {/* 2. Customer Tabs: Phân loại theo Khách hàng (Cấp 1) */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-1.5 shadow-xs flex-shrink-0">
          <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
            <button
              type="button"
              onClick={() => setSelectedCustomer('all')}
              className={clsx(
                "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-2",
                selectedCustomer === 'all'
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-transparent text-slate-600 hover:bg-slate-100"
              )}
            >
              <Building2 size={13} />
              <span>Tất cả khách hàng</span>
              <span className={clsx(
                "text-[10px] font-mono px-1.5 py-0.2 rounded-full",
                selectedCustomer === 'all' ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600"
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
                    "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-2",
                    isSelected
                      ? "bg-blue-600 text-white shadow-xs"
                      : "bg-transparent text-slate-600 hover:bg-slate-100"
                  )}
                >
                  <span>{cust}</span>
                  <span className={clsx(
                    "text-[10px] font-mono px-1.5 py-0.2 rounded-full",
                    isSelected ? "bg-white/20 text-white font-bold" : "bg-slate-200 text-slate-600"
                  )}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Toolbar: Tìm kiếm & Sắp xếp nhanh */}
        <div className="bg-white rounded-xl border border-slate-200/90 px-3 py-2 flex items-center justify-between gap-3 shadow-xs flex-shrink-0 text-xs">
          <div className="flex items-center gap-2.5 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm nhanh theo tên sản phẩm hoặc mã SKU..."
                className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-blue-500 rounded-lg pl-8 pr-7 py-1.5 text-xs font-medium text-slate-900 outline-none transition-all placeholder:text-slate-400"
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

            {/* Nhóm hàng Filter */}
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="all">Tất cả nhóm hàng</option>
              {groups.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-medium text-slate-400">Sắp xếp:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700 outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="name_asc">Tên sản phẩm (A → Z)</option>
                <option value="price_desc">Giá bán: Cao → Thấp</option>
                <option value="price_asc">Giá bán: Thấp → Cao</option>
                <option value="profit_desc">Lợi nhuận cao nhất</option>
              </select>
            </div>

            {(selectedCustomer !== 'all' || selectedGroup !== 'all' || searchTerm) && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCustomer('all');
                  setSelectedGroup('all');
                  setSortBy('name_asc');
                }}
                className="text-xs text-rose-600 hover:text-rose-700 font-medium flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw size={11} />
                <span>Đặt lại</span>
              </button>
            )}
          </div>
        </div>

        {/* 4. MAIN CONTENT AREA */}
        <div className="flex-1 overflow-auto min-h-0">
          {filteredList.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                <Search size={20} />
              </div>
              <h3 className="text-sm font-bold text-slate-800">Không tìm thấy sản phẩm phù hợp</h3>
              <p className="text-xs text-slate-500">
                Thử đổi từ khóa tìm kiếm hoặc bấm đặt lại bộ lọc.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCustomer('all');
                  setSelectedGroup('all');
                }}
                className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
              >
                Đặt lại bộ lọc
              </button>
            </div>
          ) : viewMode === 'pricebook' ? (
            /* ========================================================================= */
            /* 📑 THIẾT KẾ 1: SỔ BÁO GIÁ THEO PHÂN NHÓM HÀNG (QUOTATION PRICE BOOK)      */
            /* ========================================================================= */
            <div className="space-y-4 pb-6">
              {hierarchicalData.map(custGroup => (
                <div key={custGroup.customerName} className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                  {/* Customer Banner (Chỉ hiện khi xem 'Tất cả khách hàng') */}
                  {selectedCustomer === 'all' && (
                    <div className="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Building2 size={16} className="text-blue-400" />
                        <h2 className="text-xs font-bold tracking-wide uppercase">
                          Khách hàng: {custGroup.customerName}
                        </h2>
                      </div>
                      <span className="text-[11px] font-mono text-slate-300">
                        {custGroup.categories.reduce((acc, cat) => acc + cat.items.length, 0)} sản phẩm
                      </span>
                    </div>
                  )}

                  {/* Render Categories within this Customer */}
                  <div className="divide-y divide-slate-100">
                    {custGroup.categories.map(cat => (
                      <div key={cat.categoryName} className="p-4 space-y-2.5">
                        {/* Category Subheader */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="p-1 rounded bg-slate-100 text-slate-700">
                              {getCategoryIcon(cat.categoryName)}
                            </span>
                            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                              {cat.categoryName}
                            </h3>
                            <span className="text-[11px] font-semibold text-slate-400">
                              ({cat.items.length} mặt hàng)
                            </span>
                          </div>
                        </div>

                        {/* Clean Quotation Table (Không còn 3 cột giá cạnh nhau!) */}
                        <div className="rounded-lg border border-slate-300/90 shadow-2xs overflow-hidden">
                          <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
                            <thead className="bg-slate-100/95 border-b-2 border-slate-300 text-slate-800 text-[11.5px] font-extrabold uppercase tracking-wider shadow-2xs select-none">
                              <tr>
                                <th className="px-3 py-2.5 w-10 text-center text-slate-500 font-mono font-bold">#</th>
                                <th className="px-3.5 py-2.5 text-slate-900 font-black tracking-wide">
                                  Sản Phẩm & Mã Hiệu
                                </th>
                                <th className="px-3 py-2.5 text-center w-16 text-slate-700 font-extrabold">
                                  ĐVT
                                </th>
                                <th className="px-4 py-2.5 text-right text-blue-950 font-black bg-blue-100/80 border-x border-blue-200/70 w-36 tracking-tight">
                                  Đơn Giá Bán
                                </th>
                                {showInternalFinancials && (
                                  <th className="px-4 py-2.5 text-right text-emerald-950 font-black bg-emerald-100/80 border-r border-emerald-200/70 w-52 tracking-tight">
                                    Cấu Trúc Lợi Nhuận
                                  </th>
                                )}
                                <th className="px-3.5 py-2.5 text-slate-800 font-extrabold w-32">
                                  Hợp Đồng
                                </th>
                                <th className="px-3 py-2.5 text-center w-24 text-slate-700 font-extrabold">
                                  Thao Tác
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                              {cat.items.map((item, idx) => {
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
                                    className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                                  >
                                    {/* STT */}
                                    <td className="px-3 py-2.5 text-center text-slate-400 font-mono text-[11px]">
                                      {idx + 1}
                                    </td>

                                    {/* Tên sản phẩm & Mã SKU */}
                                    <td className="px-3.5 py-2.5">
                                      <div className="flex flex-col">
                                        <span className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                                          {item._prodName}
                                        </span>
                                        <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                                          {item._sku && (
                                            <span className="font-mono text-slate-500">
                                              Mã: {item._sku}
                                            </span>
                                          )}
                                          {item._isInternalFactory ? (
                                            <span className="text-teal-700 font-medium">
                                              • 🏭 Nhà máy Tâm Sen
                                            </span>
                                          ) : item._supplier ? (
                                            <span className="text-slate-400">
                                              • NCC: {item._supplier}
                                            </span>
                                          ) : null}
                                        </div>
                                      </div>
                                    </td>

                                    {/* ĐVT */}
                                    <td className="px-3 py-2.5 text-center text-slate-600">
                                      {item._unit}
                                    </td>

                                    {/* ĐƠN GIÁ BÁN (Cột Giá Duy Nhất, To Rõ, Không Bị Nhầm Lẫn) */}
                                    <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-900 text-sm bg-blue-50/20 tabular-nums">
                                      {formatVnCurrency(item._sellPrice)}
                                    </td>

                                    {/* Cấu Trúc Lợi Nhuận Trực Quan (Gom gọn Giá vốn & Lãi vào 1 khối thông minh) */}
                                    {showInternalFinancials && (
                                      <td className="px-4 py-2.5 text-right bg-emerald-50/10">
                                        <div className="flex flex-col items-end">
                                          <div className="flex items-center gap-1.5 font-mono">
                                            <span className="font-bold text-emerald-700">
                                              +{formatVnCurrency(item._profit)}
                                            </span>
                                            {item._marginPct > 0 && (
                                              <span className="text-[10px] font-extrabold px-1 py-0.2 rounded bg-emerald-100 text-emerald-800">
                                                {item._marginPct}%
                                              </span>
                                            )}
                                          </div>
                                          <span className="text-[10px] text-slate-400 font-mono mt-0.5">
                                            Vốn: {formatVnCurrency(item._costPrice)}
                                            {item._avpPrice ? ` • AVP: ${formatVnCurrency(item._avpPrice)}` : ''}
                                          </span>
                                        </div>
                                      </td>
                                    )}

                                    {/* Hợp đồng */}
                                    <td className="px-3 py-2.5 text-slate-500 font-mono text-[11px]">
                                      {item._contractNum ? (
                                        <a
                                          href={driveContractUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          onClick={(e) => e.stopPropagation()}
                                          className="text-slate-600 hover:text-blue-600 hover:underline inline-flex items-center gap-0.5"
                                          title="Mở hợp đồng Google Drive"
                                        >
                                          <span>{item._contractNum}</span>
                                          <ArrowUpRight size={10} />
                                        </a>
                                      ) : '—'}
                                    </td>

                                    {/* Thao tác */}
                                    <td className="px-3 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                                      <div className="flex items-center justify-center gap-1">
                                        <button
                                          type="button"
                                          onClick={(e) => handleCopyQuote(item, e)}
                                          className="p-1 hover:bg-slate-100 text-slate-500 hover:text-blue-600 rounded transition-colors cursor-pointer"
                                          title="Chép báo giá"
                                        >
                                          {isCopied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => onSelectProductDetails?.(item._prodName || item._sku)}
                                          className="p-1 hover:bg-slate-100 text-slate-500 hover:text-blue-600 rounded transition-colors cursor-pointer"
                                          title="Xem chi tiết"
                                        >
                                          <Eye size={12} />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={(e) => handleOpenEdit(item, e)}
                                          className="p-1 hover:bg-slate-100 text-slate-500 hover:text-blue-600 rounded transition-colors cursor-pointer"
                                          title="Sửa giá"
                                        >
                                          <Edit3 size={12} />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* ========================================================================= */
            /* 🔍 THIẾT KẾ 2: MASTER-DETAIL (CHI TIẾT 2 KHUNG - DUYỆT & SO SÁNH GIÁ)     */
            /* ========================================================================= */
            <div className="flex h-full gap-3 overflow-hidden">
              {/* Left Pane: Clean Product Catalog List (38% Width) */}
              <div className="w-[38%] bg-white rounded-xl border border-slate-200 flex flex-col h-full overflow-hidden shadow-2xs">
                <div className="p-3 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Danh Sách Sản Phẩm ({filteredList.length})
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Chọn để xem hồ sơ giá
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                  {filteredList.map((item) => {
                    const isSelected = activeItem?._id === item._id;
                    return (
                      <div
                        key={item._id}
                        onClick={() => setActiveItemId(item._id)}
                        className={clsx(
                          "p-3 transition-all cursor-pointer flex items-center justify-between gap-3 text-xs",
                          isSelected
                            ? "bg-blue-50/70 border-l-4 border-l-blue-600"
                            : "hover:bg-slate-50 border-l-4 border-l-transparent"
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <h4 className={clsx(
                            "font-bold truncate",
                            isSelected ? "text-blue-900" : "text-slate-800"
                          )}>
                            {item._prodName}
                          </h4>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                            <span className="font-mono text-slate-500">{item._sku}</span>
                            <span>•</span>
                            <span className="truncate">{item._customer}</span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className={clsx(
                            "font-mono font-bold block",
                            isSelected ? "text-blue-700" : "text-slate-900"
                          )}>
                            {formatVnCurrency(item._sellPrice)}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            /{item._unit}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Pane: Dossier & Visual Price Architecture (62% Width) */}
              <div className="flex-1 bg-white rounded-xl border border-slate-200 flex flex-col h-full overflow-y-auto shadow-2xs p-5 space-y-5">
                {activeItem ? (
                  <>
                    {/* Header: Product Overview */}
                    <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700">
                            {activeItem._group}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            {activeItem._customer}
                          </span>
                          {activeItem._isInternalFactory && (
                            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
                              Nhà máy Tâm Sen
                            </span>
                          )}
                        </div>
                        <h2 className="text-lg font-black text-slate-900 mt-2 leading-snug">
                          {activeItem._prodName}
                        </h2>
                        <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 font-mono">
                          <span>Mã SKU: <strong>{activeItem._sku}</strong></span>
                          <span>•</span>
                          <span>Mã giá: <strong>{activeItem['Mã giá bán'] || activeItem._id}</strong></span>
                          <span>•</span>
                          <span>ĐVT: <strong>{activeItem._unit}</strong></span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => handleCopyQuote(activeItem, e)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <Copy size={13} />
                          <span>Sao chép báo giá</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleOpenEdit(activeItem, e)}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <Edit3 size={13} />
                          <span>Sửa giá</span>
                        </button>
                      </div>
                    </div>

                    {/* Visual Price Architecture: Giải Thích Rõ Ý Nghĩa Từng Mức Giá */}
                    <div className="space-y-2.5">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                        <DollarSign size={14} className="text-slate-600" />
                        <span>Cấu Trúc Đơn Giá & Lợi Nhuận Sản Phẩm</span>
                      </h3>

                      <div className="grid grid-cols-3 gap-3">
                        {/* Giá Bán Niêm Yết */}
                        <div className="bg-blue-50/60 rounded-xl p-3.5 border border-blue-200/80">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 block">
                            Đơn Giá Bán Niêm Yết
                          </span>
                          <div className="text-lg font-black text-blue-900 font-mono mt-1 tabular-nums">
                            {formatVnCurrency(activeItem._sellPrice)}
                          </div>
                          <span className="text-[11px] text-blue-600 font-medium block mt-0.5">
                            Áp dụng cho {activeItem._customer}
                          </span>
                        </div>

                        {/* Giá Vốn Mua Vào */}
                        <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                            Đơn Giá Vốn Mua Vào
                          </span>
                          <div className="text-lg font-bold text-slate-800 font-mono mt-1 tabular-nums">
                            {formatVnCurrency(activeItem._costPrice)}
                          </div>
                          <span className="text-[11px] text-slate-500 block mt-0.5 truncate">
                            Nguồn: {activeItem._supplier || 'Tâm Sen'}
                          </span>
                        </div>

                        {/* Lợi Nhuận Gộp */}
                        <div className="bg-emerald-50/70 rounded-xl p-3.5 border border-emerald-200/80">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">
                            Lợi Nhuận Gộp / Đơn Vị
                          </span>
                          <div className="text-lg font-black text-emerald-700 font-mono mt-1 tabular-nums">
                            +{formatVnCurrency(activeItem._profit)}
                          </div>
                          <span className="text-[11px] font-bold text-emerald-800 block mt-0.5">
                            Biên lợi nhuận: {activeItem._marginPct}%
                          </span>
                        </div>
                      </div>

                      {/* Benchmark Price (Giá AVP nếu có) */}
                      {activeItem._avpPrice && (
                        <div className="bg-amber-50/50 border border-amber-200/70 rounded-lg p-2.5 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-amber-900">Mức giá tham chiếu AVP (An Việt Phát):</span>
                            <span className="font-mono font-bold text-amber-800">{formatVnCurrency(activeItem._avpPrice)}</span>
                          </div>
                          <span className="text-slate-500 text-[11px]">
                            Chênh lệch so với giá bán: {formatVnCurrency(activeItem._sellPrice - activeItem._avpPrice)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Technical Specifications from SpecsData */}
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                        <Layers size={14} className="text-slate-600" />
                        <span>Thông Số Quy Cách & Tiêu Chuẩn Kỹ Thuật</span>
                      </h3>

                      {activeItem._specs ? (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                            <span className="text-[10px] text-slate-400 block font-medium">Quy cách</span>
                            <span className="font-semibold text-slate-800 block mt-0.5">{activeItem._specs['Quy cách'] || '—'}</span>
                          </div>
                          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                            <span className="text-[10px] text-slate-400 block font-medium">Kích thước (DxRxC)</span>
                            <span className="font-semibold text-slate-800 block mt-0.5">{activeItem._specs['Kích thước'] || '—'}</span>
                          </div>
                          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                            <span className="text-[10px] text-slate-400 block font-medium">Định lượng / Loại sóng</span>
                            <span className="font-semibold text-slate-800 block mt-0.5">{activeItem._specs['Loại sóng'] || activeItem._specs['Định lượng'] || '—'}</span>
                          </div>
                          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                            <span className="text-[10px] text-slate-400 block font-medium">Trọng lượng riêng</span>
                            <span className="font-semibold text-slate-800 block mt-0.5">{activeItem._specs['Trọng lượng'] || '—'}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 bg-slate-50 rounded-lg text-slate-400 text-xs text-center border border-dashed border-slate-200">
                          Chưa có thông số mở rộng trong danh mục Specs. Bấm "Chi tiết" để kiểm tra hệ thống.
                        </div>
                      )}
                    </div>

                    {/* Legal Contract Information */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-600">Hợp đồng kinh tế:</span>
                        <span className="font-mono text-slate-800">{activeItem._contractNum || 'Chưa liên kết'}</span>
                        <span className="text-slate-400">• Hiệu lực: {activeItem['Ngày bắt đầu'] || '2026'} - {activeItem['Ngày kết thúc'] || '31/12/2026'}</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => onSelectProductDetails?.(activeItem._prodName || activeItem._sku)}
                        className="text-blue-600 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <span>Mở toàn bộ hồ sơ sản phẩm</span>
                        <ArrowUpRight size={13} />
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-400 text-xs">
                    Vui lòng chọn sản phẩm bên trái để xem hồ sơ giá.
                  </div>
                )}
              </div>
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

            <div className="space-y-1">
              <label className="font-bold text-slate-600 uppercase tracking-wide">Mã giá bán (ID)</label>
              <input
                type="text"
                readOnly
                value={formData['Mã giá bán'] || ''}
                className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl font-mono text-slate-700 cursor-not-allowed outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-600 uppercase tracking-wide">Mã sản phẩm (SKU)</label>
              <input
                type="text"
                value={formData['Mã sản phẩm'] || ''}
                onChange={(e) => handleFormChange('Mã sản phẩm', e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

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
}
