import React, { useState, useMemo, useCallback } from 'react';
import { 
  Search, X, Copy, Check, Calculator, Eye, Edit3, Tag, Building2, 
  Package, Layers, Percent, TrendingUp, DollarSign, FileText, 
  ArrowUpRight, ChevronDown, ChevronUp, ArrowUpDown, Filter, 
  RotateCcw, Sparkles, Scale, CheckCircle2, ChevronRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'motion/react';
import { parseNumber, formatVND } from '../lib/business-logic';

export interface MobilePricingCatalogProps {
  data: any[];
  contractsData?: any[];
  products?: any[];
  suppliers?: any[];
  specsData?: any[];
  onEdit?: (row: any) => void;
  onDelete?: (row: any) => void;
  onProductClick?: (productNameOrSku: string) => void;
  onNavigateTab?: (tab: string) => void;
  onAddNew?: () => void;
  showAddButton?: boolean;
}

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

export const MobilePricingCatalog: React.FC<MobilePricingCatalogProps> = ({
  data,
  contractsData = [],
  products = [],
  suppliers = [],
  specsData = [],
  onEdit,
  onProductClick,
  onNavigateTab,
  onAddNew,
  showAddButton = false
}) => {
  // Search & Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<string>('all');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('profit_desc');
  const [marginFilter, setMarginFilter] = useState<MarginFilter>('all');
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);

  // Pagination for mobile smooth scrolling (load more)
  const [displayCount, setDisplayCount] = useState(20);

  // Interactive card state
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedSimulatorId, setExpandedSimulatorId] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [expandedSpecsId, setExpandedSpecsId] = useState<string | null>(null);

  // Extract unique customers
  const customers = useMemo(() => {
    const set = new Set<string>();
    data.forEach(r => {
      const c = r['Giao đến'] || r['RP_Khách hàng'] || r['Khách hàng'];
      if (c) set.add(String(c).trim());
    });
    return Array.from(set).sort();
  }, [data]);

  // Extract unique product groups
  const groups = useMemo(() => {
    const set = new Set<string>();
    data.forEach(r => {
      const g = r['Nhóm sản phẩm'] || r['Nhóm hàng'] || r['Phân loại'];
      if (g) set.add(String(g).trim());
    });
    return Array.from(set).sort();
  }, [data]);

  // Enriched and filtered list
  const enrichedList = useMemo(() => {
    return data.map(row => {
      const rowId = row.id || row['Mã giá bán'] || row['Mã sản phẩm'] || JSON.stringify(row);
      const sku = String(row['Mã sản phẩm'] || row['Mã giá bán'] || row['Mã hàng'] || '').trim();
      
      // Intelligent product name resolution
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

      // Calculate or parse Margin %
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
  }, [data, products]);

  // Filtered & Sorted Data
  const filteredList = useMemo(() => {
    let result = enrichedList.filter(item => {
      // Customer filter
      if (selectedCustomer !== 'all' && item._customer !== selectedCustomer) {
        return false;
      }

      // Group filter
      if (selectedGroup !== 'all' && item._group !== selectedGroup) {
        return false;
      }

      // Margin range filter
      if (marginFilter === 'high' && item._marginPct < 30) return false;
      if (marginFilter === 'mid' && (item._marginPct < 20 || item._marginPct >= 30)) return false;
      if (marginFilter === 'low' && item._marginPct >= 20) return false;

      // Search term
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

    // Sorting
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

  // Aggregate statistics for active view
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

  // Active items for pagination / load more
  const displayedItems = useMemo(() => {
    return filteredList.slice(0, displayCount);
  }, [filteredList, displayCount]);

  // Copy quick quote
  const handleCopyQuote = useCallback((item: any, e: React.MouseEvent) => {
    e.stopPropagation();
    const formattedPrice = formatVnCurrency(item._sellPrice);
    const text = `[BÁO GIÁ TSG 2026]\n📦 ${item._prodName}\n🏷️ Đơn giá: ${formattedPrice} / ${item._unit}\n🏢 Khách hàng: ${item._customer || 'Toàn hệ thống'}\n🔖 Mã SP: ${item._sku} (${item._id})`;

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

  // Quick specs toggle
  const toggleSpecs = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedSpecsId(expandedSpecsId === id ? null : id);
  };

  // Reset filters
  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedCustomer('all');
    setSelectedGroup('all');
    setMarginFilter('all');
    setSortBy('profit_desc');
    setDisplayCount(20);
    toast.success('Đã đặt lại bộ lọc danh mục!');
  };

  const getCustomerBadgeColor = (customer: string) => {
    const c = customer.toLowerCase();
    if (c.includes('thăng long')) return 'bg-blue-50 text-blue-700 border-blue-200/80';
    if (c.includes('bắc sơn')) return 'bg-emerald-50 text-emerald-700 border-emerald-200/80';
    if (c.includes('thanh hoá') || c.includes('thanh hoa')) return 'bg-purple-50 text-purple-700 border-purple-200/80';
    return 'bg-slate-100 text-slate-700 border-slate-200/80';
  };

  const getMarginBadge = (pct: number) => {
    if (pct >= 30) {
      return (
        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
          <TrendingUp size={11} className="text-emerald-700" />
          <span>{pct}%</span>
        </span>
      );
    }
    if (pct >= 20) {
      return (
        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-black bg-blue-100 text-blue-800 border border-blue-300">
          <span>{pct}%</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
        <span>{pct}%</span>
      </span>
    );
  };

  return (
    <div className="w-full space-y-3 pb-24 text-slate-800">
      
      {/* 1. Header Toolbar & Quick Subtab Navigation */}
      <div className="bg-white rounded-2xl p-3 border border-slate-200/85 shadow-2xs space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-xs">
              <Package size={16} />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 tracking-tight font-display flex items-center gap-1.5">
                <span>Bảng Giá Niêm Yết 2026</span>
              </h2>
              <p className="text-[11px] text-slate-500 font-medium">
                Tra cứu giá bán, giá vốn & lợi nhuận
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {onNavigateTab && (
              <button
                type="button"
                onClick={() => onNavigateTab('contracts')}
                className="px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-[11px] font-bold border border-blue-200/60 flex items-center gap-1 transition-all cursor-pointer active:scale-95"
                title="Xem Hợp Đồng Mua Bán"
              >
                <Scale size={12} />
                <span>HĐ ({contractsData.length})</span>
                <ArrowUpRight size={11} />
              </button>
            )}

            {showAddButton && onAddNew && (
              <button
                type="button"
                onClick={onAddNew}
                className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-xs active:scale-95"
              >
                <span>+ Thêm giá</span>
              </button>
            )}
          </div>
        </div>

        {/* 2. Spotlight Mobile Search Bar */}
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setDisplayCount(20);
            }}
            placeholder="Tìm theo tên SP, mã SKU, khách hàng..."
            className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200/85 focus:border-blue-500 focus:ring-3 focus:ring-blue-500/15 rounded-xl pl-9.5 pr-8 py-2.5 text-xs font-semibold text-slate-900 outline-none transition-all placeholder:text-slate-400 shadow-2xs"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* 3. Horizontal Customer Filter Pills */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
            <span className="flex items-center gap-1 text-slate-600">
              <Building2 size={12} className="text-blue-600" />
              <span>Khách hàng áp dụng:</span>
            </span>
            <span className="text-slate-400 font-mono">
              {filteredList.length} / {enrichedList.length}
            </span>
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar -mx-1 px-1">
            <button
              type="button"
              onClick={() => {
                setSelectedCustomer('all');
                setDisplayCount(20);
              }}
              className={clsx(
                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 border select-none active:scale-95",
                selectedCustomer === 'all'
                  ? "bg-slate-900 border-slate-900 text-white shadow-xs"
                  : "bg-slate-50 border-slate-200/80 text-slate-600 hover:bg-white"
              )}
            >
              Tất cả ({enrichedList.length})
            </button>

            {customers.map(c => {
              const count = enrichedList.filter(i => i._customer === c).length;
              const isSelected = selectedCustomer === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    setSelectedCustomer(isSelected ? 'all' : c);
                    setDisplayCount(20);
                  }}
                  className={clsx(
                    "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 border select-none active:scale-95 flex items-center gap-1.5",
                    isSelected
                      ? "bg-blue-600 border-blue-600 text-white shadow-xs"
                      : "bg-white border-slate-200/80 text-slate-700 hover:bg-slate-50"
                  )}
                >
                  <span>{c}</span>
                  <span className={clsx(
                    "px-1.5 py-0.2 rounded-full text-[10px] font-mono",
                    isSelected ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                  )}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 4. Horizontal Product Group Filter Pills */}
        <div className="space-y-1 pt-1 border-t border-slate-100">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
            <span className="flex items-center gap-1 text-slate-600">
              <Layers size={12} className="text-indigo-600" />
              <span>Nhóm sản phẩm:</span>
            </span>
            {(selectedCustomer !== 'all' || selectedGroup !== 'all' || marginFilter !== 'all' || searchTerm) && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-[10.5px] text-rose-600 hover:text-rose-700 font-bold flex items-center gap-0.5 cursor-pointer"
              >
                <RotateCcw size={10} />
                <span>Xoá lọc</span>
              </button>
            )}
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar -mx-1 px-1">
            <button
              type="button"
              onClick={() => {
                setSelectedGroup('all');
                setDisplayCount(20);
              }}
              className={clsx(
                "px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer shrink-0 border select-none active:scale-95",
                selectedGroup === 'all'
                  ? "bg-indigo-600 border-indigo-600 text-white shadow-2xs font-bold"
                  : "bg-slate-50 border-slate-200/70 text-slate-600 hover:bg-white"
              )}
            >
              Tất cả nhóm
            </button>

            {groups.map(g => {
              const count = enrichedList.filter(i => i._group === g && (selectedCustomer === 'all' || i._customer === selectedCustomer)).length;
              const isSelected = selectedGroup === g;
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => {
                    setSelectedGroup(isSelected ? 'all' : g);
                    setDisplayCount(20);
                  }}
                  className={clsx(
                    "px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer shrink-0 border select-none active:scale-95 flex items-center gap-1",
                    isSelected
                      ? "bg-indigo-600 border-indigo-600 text-white shadow-2xs font-bold"
                      : "bg-white border-slate-200/70 text-slate-700 hover:bg-slate-50"
                  )}
                >
                  <span>{g}</span>
                  <span className={clsx(
                    "px-1 py-0.1 rounded text-[9.5px] font-mono",
                    isSelected ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                  )}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 5. Sort & Margin Filter Bar */}
        <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between gap-1.5 flex-wrap">
          {/* Quick Sort Select */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1 shrink-0">
              <ArrowUpDown size={11} className="text-slate-400" />
              <span>Sắp xếp:</span>
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-800 outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="profit_desc">💰 Lợi nhuận: Cao nhất</option>
              <option value="margin_desc">📈 Biên LN (%): Cao nhất</option>
              <option value="price_desc">🏷️ Giá bán: Cao → Thấp</option>
              <option value="price_asc">🏷️ Giá bán: Thấp → Cao</option>
              <option value="name_asc">🔤 Tên sản phẩm: A → Z</option>
            </select>
          </div>

          {/* Quick Margin Pills */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setMarginFilter(marginFilter === 'high' ? 'all' : 'high')}
              className={clsx(
                "px-2 py-0.8 rounded-lg text-[10.5px] font-bold border transition-all cursor-pointer active:scale-95 shrink-0",
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
                "px-2 py-0.8 rounded-lg text-[10.5px] font-bold border transition-all cursor-pointer active:scale-95 shrink-0",
                marginFilter === 'mid'
                  ? "bg-blue-600 border-blue-600 text-white shadow-2xs"
                  : "bg-blue-50 border-blue-200 text-blue-800 hover:bg-blue-100"
              )}
            >
              20% - 30%
            </button>
          </div>
        </div>
      </div>

      {/* 2. Mobile Financial KPI Strip (Tóm tắt nhanh) */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white rounded-xl p-2.5 border border-slate-200/80 shadow-2xs text-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Số Sản Phẩm
          </span>
          <p className="text-xs sm:text-sm font-black text-slate-900 mt-0.5 tabular-nums">
            {stats.totalCount} <span className="text-[10px] font-normal text-slate-500">giá</span>
          </p>
          <span className="text-[9.5px] font-medium text-slate-400 block truncate">
            {stats.uniqueSkus} SKU
          </span>
        </div>

        <div className="bg-white rounded-xl p-2.5 border border-slate-200/80 shadow-2xs text-center">
          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">
            Biên LN TB
          </span>
          <p className="text-xs sm:text-sm font-black text-emerald-700 mt-0.5 tabular-nums">
            {stats.avgMargin}%
          </p>
          <span className="text-[9.5px] font-medium text-emerald-600/80 block truncate">
            Tỷ suất bình quân
          </span>
        </div>

        <div className="bg-white rounded-xl p-2.5 border border-slate-200/80 shadow-2xs text-center">
          <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">
            Lợi Nhuận TB
          </span>
          <p className="text-xs sm:text-sm font-black text-blue-700 mt-0.5 tabular-nums truncate">
            +{formatCompactCurrency(stats.avgProfit)}
          </p>
          <span className="text-[9.5px] font-medium text-slate-400 block truncate">
            trên 1 đơn vị
          </span>
        </div>
      </div>

      {/* 3. Product Pricing Cards Feed */}
      {displayedItems.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center border border-slate-200/80 shadow-2xs space-y-3">
          <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
            <Search size={20} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">Không tìm thấy sản phẩm nào</h3>
            <p className="text-xs text-slate-500 mt-1">
              Thử thay đổi từ khoá hoặc xoá bớt bộ lọc khách hàng, nhóm sản phẩm.
            </p>
          </div>
          <button
            type="button"
            onClick={handleResetFilters}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer"
          >
            Đặt lại tất cả bộ lọc
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {displayedItems.map((item) => {
            const isCopied = copiedId === item._id;
            const isSimulating = expandedSimulatorId === item._id;
            const isSpecsExpanded = expandedSpecsId === item._id;
            const simQty = quantities[item._id] || 1000;

            // Calculations for Simulator
            const simRevenue = simQty * item._sellPrice;
            const simCost = simQty * item._costPrice;
            const simProfit = simQty * item._profit;

            // Matching specs if available
            const matchedSpec = specsData.find((s: any) => 
              s['Mã sản phẩm'] === item._sku || 
              s['Sản phẩm liên kết'] === item._prodName ||
              (item._sku && s['Mã Spec'] && s['Mã Spec'].includes(item._sku))
            );

            // Matching contract link
            const matchedContract = contractsData.find((c: any) => 
              (c.contractNumber && c.contractNumber.trim().toLowerCase() === item._contractNum.trim().toLowerCase()) ||
              (c.partnerName && item._customer && c.partnerName.includes(item._customer))
            );
            const driveContractUrl = matchedContract?.attachmentUrl || `https://drive.google.com/drive/search?q=${encodeURIComponent(item._contractNum || item._customer)}`;

            return (
              <div
                key={item._id}
                onClick={() => {
                  if (onProductClick) {
                    onProductClick(item._prodName || item._sku);
                  }
                }}
                className="bg-white rounded-2xl p-3.5 border border-slate-200/85 hover:border-slate-300 shadow-2xs transition-all space-y-3 cursor-pointer active:bg-slate-50/50"
              >
                {/* Card Top: Product Title & Badges */}
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 leading-snug tracking-tight hover:text-blue-600 transition-colors">
                      {item._prodName}
                    </h3>
                    <div className="shrink-0">
                      {getMarginBadge(item._marginPct)}
                    </div>
                  </div>

                  {/* SKU, Customer & Group Badges */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* SKU Code */}
                    {item._sku && (
                      <span className="inline-flex items-center gap-1 text-[10.5px] font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200/60">
                        <Tag size={10} className="text-blue-500" />
                        <span>{item._sku}</span>
                      </span>
                    )}

                    {/* Customer Badge */}
                    {item._customer && (
                      <span className={clsx(
                        "inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-0.5 rounded border truncate max-w-[150px]",
                        getCustomerBadgeColor(item._customer)
                      )}>
                        <Building2 size={10} className="shrink-0" />
                        <span className="truncate">{item._customer}</span>
                      </span>
                    )}

                    {/* Group Badge */}
                    {item._group && (
                      <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/80">
                        <Layers size={9.5} className="text-slate-400" />
                        <span>{item._group}</span>
                      </span>
                    )}

                    {/* Factory / Supplier badge */}
                    {item._isInternalFactory ? (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-teal-800 bg-teal-50 border border-teal-200/80 px-1.5 py-0.5 rounded">
                        <span>🏭 Tâm Sen (SX Nội bộ)</span>
                      </span>
                    ) : item._supplier ? (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-slate-600 bg-slate-50 border border-slate-200/60 px-1.5 py-0.5 rounded">
                        <span>NCC: {item._supplier}</span>
                      </span>
                    ) : null}

                    {/* Contract Badge */}
                    {item._contractNum && (
                      <a
                        href={driveContractUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-1.5 py-0.5 rounded border border-indigo-200/70 transition-colors"
                        title="Xem hợp đồng gốc PDF trên Google Drive"
                      >
                        <FileText size={10} />
                        <span>HĐ: {item._contractNum}</span>
                        <ArrowUpRight size={9} />
                      </a>
                    )}
                  </div>
                </div>

                {/* Card Center: Financial Highlights (Hero Section) */}
                <div className="bg-gradient-to-r from-slate-50 via-blue-50/20 to-emerald-50/30 rounded-xl p-2.5 border border-slate-200/80">
                  <div className="grid grid-cols-12 gap-2 items-center">
                    
                    {/* Selling Price (Giá Bán) - 6 cols */}
                    <div className="col-span-6 border-r border-slate-200/80 pr-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                        Đơn Giá Bán ({item._unit})
                      </span>
                      <div className="flex items-baseline gap-1 mt-0.5">
                        <span className="text-base sm:text-lg font-black text-blue-700 tracking-tight tabular-nums">
                          {formatVnCurrency(item._sellPrice)}
                        </span>
                      </div>
                      {item._newSellPrice && item._newSellPrice !== item._sellPrice && (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded mt-0.5 inline-block">
                          Giá mới: {formatVnCurrency(item._newSellPrice)}
                        </span>
                      )}
                      <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
                        Giá vốn: {formatVnCurrency(item._costPrice)}
                      </span>
                    </div>

                    {/* Profit & Margin - 6 cols */}
                    <div className="col-span-6 pl-1 space-y-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
                        Lợi Nhuận Gộp / ĐV
                      </span>
                      <div className="flex items-baseline gap-1 mt-0.5">
                        <span className="text-sm sm:text-base font-black text-emerald-700 tracking-tight tabular-nums">
                          +{formatVnCurrency(item._profit)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500">
                        <span>Biên LN:</span>
                        <span className="font-bold text-emerald-700 font-mono">
                          {item._marginPct}%
                        </span>
                        {item._avpPrice ? (
                          <span className="text-slate-400 font-mono">
                            (AVP: {formatCompactCurrency(item._avpPrice)})
                          </span>
                        ) : null}
                      </div>
                    </div>

                  </div>
                </div>

                {/* 4. Action Buttons (Touch-First & Thumb-Friendly >= 44px height targets) */}
                <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-slate-100" onClick={(e) => e.stopPropagation()}>
                  
                  {/* Copy Quote Button */}
                  <button
                    type="button"
                    onClick={(e) => handleCopyQuote(item, e)}
                    className={clsx(
                      "flex-1 min-h-[40px] px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 border",
                      isCopied
                        ? "bg-emerald-600 border-emerald-600 text-white shadow-xs"
                        : "bg-slate-50 hover:bg-slate-100 border-slate-200/80 text-slate-700 hover:text-slate-900"
                    )}
                    title="Sao chép thông tin báo giá để gửi Zalo / Tin nhắn"
                  >
                    {isCopied ? (
                      <>
                        <CheckCircle2 size={13} className="text-white" />
                        <span>Đã chép!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={13} className="text-blue-600" />
                        <span>Chép báo giá</span>
                      </>
                    )}
                  </button>

                  {/* Profit Simulator Toggle */}
                  <button
                    type="button"
                    onClick={(e) => toggleSimulator(item._id, e)}
                    className={clsx(
                      "min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-95 border",
                      isSimulating
                        ? "bg-emerald-600 border-emerald-600 text-white shadow-xs"
                        : "bg-emerald-50 hover:bg-emerald-100 border-emerald-200/80 text-emerald-800"
                    )}
                    title="Mở máy tính dự toán lợi nhuận theo số lượng đặt hàng"
                  >
                    <Calculator size={13} />
                    <span>Tính LN</span>
                    {isSimulating ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </button>

                  {/* Specs & Info Toggle */}
                  <button
                    type="button"
                    onClick={(e) => toggleSpecs(item._id, e)}
                    className={clsx(
                      "min-h-[40px] px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-95 border",
                      isSpecsExpanded
                        ? "bg-indigo-600 border-indigo-600 text-white shadow-xs"
                        : "bg-slate-50 hover:bg-slate-100 border-slate-200/80 text-slate-700"
                    )}
                    title="Xem quy cách và thông số kỹ thuật"
                  >
                    <FileText size={13} className={isSpecsExpanded ? "text-white" : "text-indigo-600"} />
                    <span className="hidden sm:inline">Quy cách</span>
                  </button>

                  {/* Edit Button */}
                  {onEdit && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(item);
                      }}
                      className="min-h-[40px] px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 border border-slate-200/80 hover:border-blue-200 transition-all cursor-pointer active:scale-95 flex items-center gap-1"
                      title="Chỉnh sửa đơn giá & ghi chú"
                    >
                      <Edit3 size={13} />
                      <span className="hidden sm:inline">Sửa</span>
                    </button>
                  )}
                </div>

                {/* 5. Accordion: Quick Profit Simulator (Dự toán nhanh doanh thu & lợi nhuận) */}
                <AnimatePresence>
                  {isSimulating && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden pt-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-3 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                            <Calculator size={13} className="text-emerald-700" />
                            <span>Ước Tính Doanh Thu & Lợi Nhuận</span>
                          </span>
                          <span className="text-[11px] font-semibold text-emerald-700 font-mono">
                            ĐVT: {item._unit}
                          </span>
                        </div>

                        {/* Quantity Preset Chips */}
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                            Chọn nhanh số lượng đặt hàng:
                          </span>
                          <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                            {[100, 500, 1000, 2000, 5000, 10000].map(qty => (
                              <button
                                key={qty}
                                type="button"
                                onClick={() => setQuantities(prev => ({ ...prev, [item._id]: qty }))}
                                className={clsx(
                                  "px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 border",
                                  simQty === qty
                                    ? "bg-emerald-700 border-emerald-700 text-white shadow-2xs"
                                    : "bg-white border-emerald-200 text-emerald-800 hover:bg-emerald-100"
                                )}
                              >
                                {new Intl.NumberFormat('vi-VN').format(qty)}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Custom Input */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-700 shrink-0">
                            Hoặc nhập:
                          </span>
                          <input
                            type="number"
                            min="1"
                            value={simQty}
                            onChange={(e) => {
                              const val = Math.max(1, parseInt(e.target.value) || 0);
                              setQuantities(prev => ({ ...prev, [item._id]: val }));
                            }}
                            className="w-full bg-white border border-emerald-300 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            placeholder="Số lượng..."
                          />
                        </div>

                        {/* Simulation Results Breakdown */}
                        <div className="bg-white rounded-lg p-2.5 border border-emerald-200/80 space-y-1.5 text-xs">
                          <div className="flex items-center justify-between text-slate-600">
                            <span>Tổng Doanh Thu:</span>
                            <span className="font-bold font-mono text-slate-900">
                              {formatVnCurrency(simRevenue)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-slate-600">
                            <span>Tổng Chi Phí Vốn:</span>
                            <span className="font-bold font-mono text-slate-700">
                              {formatVnCurrency(simCost)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between pt-1.5 border-t border-emerald-100 text-emerald-800 font-bold">
                            <span className="flex items-center gap-1">
                              <Sparkles size={13} className="text-emerald-600" />
                              <span>Lợi Nhuận Gộp Ước Tính:</span>
                            </span>
                            <span className="text-sm font-black font-mono text-emerald-700">
                              +{formatVnCurrency(simProfit)}
                            </span>
                          </div>
                        </div>

                        {/* Copy Estimation Button */}
                        <button
                          type="button"
                          onClick={() => {
                            const estText = `[DỰ TOÁN LỢI NHUẬN TSG 2026]\n📦 Sản phẩm: ${item._prodName}\n🔢 Số lượng: ${new Intl.NumberFormat('vi-VN').format(simQty)} ${item._unit}\n💰 Đơn giá bán: ${formatVnCurrency(item._sellPrice)}\n💵 Doanh thu dự kiến: ${formatVnCurrency(simRevenue)}\n💎 LỢI NHUẬN DỰ TÍNH: +${formatVnCurrency(simProfit)} (Biên LN ${item._marginPct}%)`;
                            navigator.clipboard.writeText(estText);
                            toast.success('Đã sao chép dự toán lợi nhuận!');
                          }}
                          className="w-full py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                        >
                          <Copy size={12} />
                          <span>Sao chép kết quả dự toán</span>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* 6. Accordion: Technical Specs & Parameters */}
                <AnimatePresence>
                  {isSpecsExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden pt-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2 text-xs">
                        <div className="flex items-center justify-between border-b border-slate-200/80 pb-1.5">
                          <span className="font-bold text-slate-800 flex items-center gap-1.5">
                            <FileText size={13} className="text-indigo-600" />
                            <span>Thông Số & Quy Cách Sản Phẩm</span>
                          </span>
                          {matchedSpec?.['Mã Spec'] && (
                            <span className="font-mono text-[10.5px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200/60">
                              {matchedSpec['Mã Spec']}
                            </span>
                          )}
                        </div>

                        {matchedSpec ? (
                          <div className="space-y-1.5">
                            {matchedSpec['Quy cách đóng gói'] && (
                              <div>
                                <span className="text-[10px] font-bold uppercase text-slate-400 block">Đóng gói:</span>
                                <p className="text-slate-700 font-medium">{matchedSpec['Quy cách đóng gói']}</p>
                              </div>
                            )}

                            {matchedSpec['Thông số kỹ thuật'] && Array.isArray(matchedSpec['Thông số kỹ thuật']) && (
                              <div className="space-y-1 pt-1">
                                <span className="text-[10px] font-bold uppercase text-slate-400 block">Chỉ tiêu kỹ thuật:</span>
                                <div className="space-y-1">
                                  {matchedSpec['Thông số kỹ thuật'].slice(0, 4).map((spec: any, sIdx: number) => (
                                    <div key={sIdx} className="flex justify-between items-center bg-white p-1.5 rounded border border-slate-200/60 text-[11px]">
                                      <span className="text-slate-600">{spec.criterion}</span>
                                      <span className="font-bold text-slate-900 font-mono">{spec.standard} {spec.unit}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-1 text-slate-600">
                            <div className="flex justify-between py-0.5 border-b border-slate-100">
                              <span>Mã giá bán:</span>
                              <span className="font-mono font-bold text-slate-900">{item['Mã giá bán'] || item._id}</span>
                            </div>
                            <div className="flex justify-between py-0.5 border-b border-slate-100">
                              <span>Thời hạn áp dụng:</span>
                              <span className="font-mono text-slate-800">{item['Ngày bắt đầu'] || '12/31/2025'} → {item['Ngày kết thúc'] || '31/12/2026'}</span>
                            </div>
                            <div className="flex justify-between py-0.5 border-b border-slate-100">
                              <span>Đơn vị tính:</span>
                              <span className="font-bold text-slate-900">{item._unit}</span>
                            </div>
                            <div className="flex justify-between py-0.5">
                              <span>Trạng thái giá:</span>
                              <span className="font-bold text-emerald-700">{item._status}</span>
                            </div>
                          </div>
                        )}

                        {onProductClick && (
                          <button
                            type="button"
                            onClick={() => onProductClick(item._prodName || item._sku)}
                            className="w-full mt-1.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                          >
                            <span>Xem hồ sơ đầy đủ sản phẩm</span>
                            <ChevronRight size={13} />
                          </button>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

              </div>
            );
          })}
        </div>
      )}

      {/* 4. Load More Button (Mobile Friendly Infinite Feel) */}
      {displayedItems.length < filteredList.length && (
        <div className="pt-2 text-center">
          <button
            type="button"
            onClick={() => setDisplayCount(prev => prev + 20)}
            className="w-full py-3 bg-white hover:bg-slate-50 border border-slate-200/90 text-slate-700 hover:text-slate-900 font-bold text-xs rounded-xl shadow-2xs transition-all active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Xem thêm 20 sản phẩm tiếp theo</span>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-mono text-[11px]">
              còn {filteredList.length - displayedItems.length}
            </span>
          </button>
        </div>
      )}

      {/* Footer Summary Info */}
      <div className="text-center text-[11px] text-slate-400 font-medium pt-2">
        <span>Hiển thị {displayedItems.length} / {filteredList.length} đơn giá ({enrichedList.length} tổng số)</span>
      </div>

    </div>
  );
};

export default MobilePricingCatalog;
