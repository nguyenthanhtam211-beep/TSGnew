import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  CalendarDays, 
  ClipboardList, 
  Truck, 
  Scale, 
  Layers, 
  DollarSign, 
  TrendingUp, 
  Package, 
  CheckCircle, 
  AlertCircle, 
  FileSpreadsheet, 
  ArrowRight, 
  Filter, 
  Search, 
  ExternalLink, 
  ChevronRight,
  Sparkles,
  Plus,
  ArrowUpRight,
  Clock,
  ShieldCheck,
  Building2,
  Share2,
  Calendar,
  X,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import clsx from 'clsx';
import * as XLSX from 'xlsx';
import { toast } from 'react-hot-toast';
import MasterCalendarView from './MasterCalendarView';
import DeliveryPlanView from './DeliveryPlanView';
import DeliveryView from './DeliveryView';
import { parseNumber } from '../lib/business-logic';

interface LogisticsHubProps {
  initialSubTab?: 'calendar' | 'plan' | 'delivery' | 'reconcile';
  deliveryPlans: any[];
  poLines: any[];
  poHeaders: any[];
  deliveries: any[];
  products: any[];
  customers: any[];
  suppliers: any[];
  pricingData?: any[];
  onAddPlan: (plan: any) => Promise<void>;
  onUpdatePlan: (plan: any) => Promise<void>;
  onDeletePlan: (plan: any) => Promise<void>;
  onAddDelivery: (delivery: any) => Promise<void>;
  onEditDelivery: (delivery: any) => Promise<void>;
  onDeleteDelivery: (delivery: any) => Promise<void>;
  onPoClick?: (poNumber: string) => void;
  onProductClick?: (productId: string) => void;
  onCreateCalendarEvent?: (eventData: any) => Promise<void>;
}

export default function LogisticsHubView({
  initialSubTab = 'calendar',
  deliveryPlans = [],
  poLines = [],
  poHeaders = [],
  deliveries = [],
  products = [],
  customers = [],
  suppliers = [],
  pricingData = [],
  onAddPlan,
  onUpdatePlan,
  onDeletePlan,
  onAddDelivery,
  onEditDelivery,
  onDeleteDelivery,
  onPoClick,
  onProductClick,
  onCreateCalendarEvent
}: LogisticsHubProps) {
  const [activeSubTab, setActiveSubTab] = useState<'calendar' | 'plan' | 'delivery' | 'reconcile'>(initialSubTab);
  const [reconcileSearch, setReconcileSearch] = useState('');
  const [reconcileFilterStatus, setReconcileFilterStatus] = useState<string>('ALL');
  const [selectedCustomerFilter, setSelectedCustomerFilter] = useState<string>('ALL');

  // Modal: Quick Plan Creation
  const [isQuickPlanOpen, setIsQuickPlanOpen] = useState(false);
  const [quickPlanForm, setQuickPlanForm] = useState({
    poNumber: '',
    customer: '',
    product: '',
    quantity: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
    vehicle: ''
  });

  // Modal: System PO Selector Table
  const [isPOSelectorModalOpen, setIsPOSelectorModalOpen] = useState(false);
  const [poSearchTerm, setPOSearchTerm] = useState('');
  const [poFilterStatus, setPOFilterStatus] = useState<'ALL' | 'PENDING' | 'COMPLETED'>('PENDING');

  // Enriched PO list for PO Selection Modal
  const availableSystemPOs = useMemo(() => {
    const activePOLines = poLines.filter(line => !line.isDeleted);
    const poGroups = new Map<string, any>();

    activePOLines.forEach(line => {
      const poNum = line['Số đơn hàng'] || line['Đơn hàng'] || line['Số PO'] || line.poNumber;
      const prodName = line['Tên sản phẩm'] || line['Sản phẩm'] || line['Mã hàng'] || line.productName;
      if (!poNum) return;

      if (!poGroups.has(String(poNum))) {
        const header = poHeaders.find(h => 
          (h['Số đơn hàng'] || h['Đơn hàng'] || h['Số PO'] || h.poNumber) === poNum
        );
        poGroups.set(String(poNum), {
          poNumber: String(poNum),
          customer: line['Khách hàng'] || header?.['Khách hàng'] || header?.customer || 'Khách hàng',
          date: header?.['Ngày đặt hàng'] || header?.['Ngày PO'] || line['Ngày đặt hàng'] || '',
          lines: [],
          totalOrdered: 0,
          totalPlanned: 0,
          totalDelivered: 0,
        });
      }

      const group = poGroups.get(String(poNum));
      const qtyOrdered = parseNumber(line['Số lượng'] || line.quantity);
      
      const linePlans = deliveryPlans.filter(p => 
        !p.isDeleted && 
        (p['Đơn hàng'] || p.poNumber) === poNum && 
        (p['Sản phẩm'] || p.product) === prodName
      );
      const qtyPlanned = linePlans.reduce((sum, p) => sum + parseNumber(p['Số lượng cần giao'] || p['Số lượng'] || p.quantity), 0);

      const lineDeliveries = deliveries.filter(d => 
        !d.isDeleted && 
        (d['Đơn hàng'] || d.poNumber) === poNum && 
        (d['Tên sản phẩm'] || d['Sản phẩm'] || d['Mã sản phẩm'] || d.product) === prodName
      );
      const qtyDelivered = lineDeliveries.reduce((sum, d) => sum + parseNumber(d['Số lượng giao'] || d['Số lượng'] || d.quantity), 0);

      const lineObj = {
        productName: prodName || 'Sản phẩm',
        unit: line['ĐVT'] || line['Đơn vị'] || line.unit || 'sp',
        qtyOrdered,
        qtyPlanned,
        qtyDelivered,
        qtyRemainingToPlan: Math.max(0, qtyOrdered - qtyPlanned),
        qtyRemainingToDeliver: Math.max(0, qtyOrdered - qtyDelivered),
      };

      group.lines.push(lineObj);
      group.totalOrdered += qtyOrdered;
      group.totalPlanned += qtyPlanned;
      group.totalDelivered += qtyDelivered;
    });

    // Include headers that might not have lines yet
    poHeaders.forEach(h => {
      const poNum = h['Số đơn hàng'] || h['Đơn hàng'] || h['Số PO'] || h.poNumber;
      if (poNum && !poGroups.has(String(poNum))) {
        poGroups.set(String(poNum), {
          poNumber: String(poNum),
          customer: h['Khách hàng'] || h.customer || 'Khách hàng',
          date: h['Ngày đặt hàng'] || h['Ngày PO'] || '',
          lines: [],
          totalOrdered: 0,
          totalPlanned: 0,
          totalDelivered: 0,
        });
      }
    });

    return Array.from(poGroups.values()).map(g => ({
      ...g,
      remainingToPlan: Math.max(0, g.totalOrdered - g.totalPlanned),
      isCompleted: g.totalOrdered > 0 && g.totalPlanned >= g.totalOrdered,
    }));
  }, [poLines, poHeaders, deliveryPlans, deliveries]);

  // Filtered PO list
  const filteredSystemPOs = useMemo(() => {
    return availableSystemPOs.filter(po => {
      const q = poSearchTerm.toLowerCase().trim();
      const matchesSearch = !q || 
        po.poNumber.toLowerCase().includes(q) || 
        po.customer.toLowerCase().includes(q) ||
        po.lines.some((l: any) => l.productName.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (poFilterStatus === 'PENDING') {
        return !po.isCompleted;
      }
      if (poFilterStatus === 'COMPLETED') {
        return po.isCompleted;
      }
      return true;
    });
  }, [availableSystemPOs, poSearchTerm, poFilterStatus]);

  // Currently selected PO info for Quick Plan form helper
  const selectedPOInfo = useMemo(() => {
    if (!quickPlanForm.poNumber) return null;
    return availableSystemPOs.find(p => p.poNumber.toLowerCase() === quickPlanForm.poNumber.toLowerCase()) || null;
  }, [quickPlanForm.poNumber, availableSystemPOs]);

  const handleSelectPOFromTable = (po: any, specificLine?: any) => {
    const targetLine = specificLine || (po.lines && po.lines.length > 0 ? po.lines[0] : null);
    const targetProduct = targetLine ? targetLine.productName : '';
    const targetQty = targetLine ? (targetLine.qtyRemainingToPlan > 0 ? targetLine.qtyRemainingToPlan : targetLine.qtyOrdered) : '';

    setQuickPlanForm(prev => ({
      ...prev,
      poNumber: po.poNumber,
      customer: po.customer || prev.customer,
      product: targetProduct || prev.product,
      quantity: targetQty ? String(targetQty) : prev.quantity
    }));

    setIsPOSelectorModalOpen(false);
    setIsPOComboboxOpen(false);
    setIsQuickPlanOpen(true);
    toast.success(`Đã chọn đơn hàng ${po.poNumber}`);
  };

  // Inline PO Combobox State & Click Outside Listener
  const [isPOComboboxOpen, setIsPOComboboxOpen] = useState(false);
  const poComboboxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (poComboboxRef.current && !poComboboxRef.current.contains(event.target as Node)) {
        setIsPOComboboxOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const comboboxFilteredPOs = useMemo(() => {
    const q = (quickPlanForm.poNumber || '').toLowerCase().trim();
    if (!q) return availableSystemPOs;
    return availableSystemPOs.filter(po => 
      po.poNumber.toLowerCase().includes(q) || 
      po.customer.toLowerCase().includes(q) ||
      po.lines.some((l: any) => l.productName.toLowerCase().includes(q))
    );
  }, [availableSystemPOs, quickPlanForm.poNumber]);

  // Unique customers for filter
  const customerOptions = useMemo(() => {
    const set = new Set<string>();
    poLines.forEach(l => {
      const c = l['Khách hàng'] || l['Tên khách hàng'] || l['RP_Khách hàng'];
      if (c && typeof c === 'string' && c.trim()) set.add(c.trim());
    });
    return Array.from(set);
  }, [poLines]);

  // Overall Logistics KPI Metrics
  const logisticsKPIs = useMemo(() => {
    let totalQtyOrdered = 0;
    let totalQtyPlanned = 0;
    let totalQtyDelivered = 0;
    let totalRevenueDelivered = 0;
    let totalProfitDelivered = 0;

    poLines.forEach(l => {
      totalQtyOrdered += parseNumber(l['Số lượng']);
    });

    deliveryPlans.forEach(p => {
      totalQtyPlanned += parseNumber(p['Số lượng cần giao'] || p['Số lượng']);
    });

    deliveries.forEach(d => {
      const q = parseNumber(d['Số lượng giao'] || d['Số lượng']);
      totalQtyDelivered += q;
      totalRevenueDelivered += parseNumber(d['Doanh thu']);
      totalProfitDelivered += parseNumber(d['Lợi nhuận gộp']);
    });

    const totalRemaining = Math.max(0, totalQtyOrdered - totalQtyDelivered);
    const overallProgress = totalQtyOrdered > 0 ? Math.round((totalQtyDelivered / totalQtyOrdered) * 100) : 0;
    const profitMargin = totalRevenueDelivered > 0 ? ((totalProfitDelivered / totalRevenueDelivered) * 100).toFixed(1) : '0.0';

    return {
      totalQtyOrdered,
      totalQtyPlanned,
      totalQtyDelivered,
      totalRemaining,
      totalRevenueDelivered,
      totalProfitDelivered,
      profitMargin,
      overallProgress,
      activePOCount: poHeaders.length,
      planCount: deliveryPlans.length,
      deliveryCount: deliveries.length
    };
  }, [poLines, deliveryPlans, deliveries, poHeaders]);

  // 3-Way Reconciliation Rows
  const reconciliationData = useMemo(() => {
    return poLines.map((line, idx) => {
      const poNum = line['Số đơn hàng'] || line['Đơn hàng'] || '';
      const prodName = line['Tên sản phẩm'] || '';
      const prodCode = line['Mã của khách'] || line['Mã sản phẩm'] || '';
      const customer = line['Khách hàng'] || '';
      const unit = line['ĐVT'] || 'Cái';
      const qtyOrdered = parseNumber(line['Số lượng']);

      // Find matched plans
      const matchedPlans = deliveryPlans.filter(dp => 
        (dp['Đơn hàng'] && dp['Đơn hàng'].trim().toLowerCase() === poNum.trim().toLowerCase()) &&
        (dp['Sản phẩm'] && (dp['Sản phẩm'].includes(prodName) || prodName.includes(dp['Sản phẩm'])))
      );
      const qtyPlanned = matchedPlans.reduce((sum, p) => sum + parseNumber(p['Số lượng cần giao'] || p['Số lượng']), 0);

      // Find matched deliveries (PXK)
      const matchedDeliveries = deliveries.filter(d => 
        (d['Đơn hàng'] && d['Đơn hàng'].trim().toLowerCase() === poNum.trim().toLowerCase()) &&
        (d['Tên sản phẩm'] && (d['Tên sản phẩm'].includes(prodName) || prodName.includes(d['Tên sản phẩm'])))
      );
      const qtyDelivered = matchedDeliveries.reduce((sum, d) => sum + parseNumber(d['Số lượng giao'] || d['Số lượng']), 0);
      const revenue = matchedDeliveries.reduce((sum, d) => sum + parseNumber(d['Doanh thu']), 0);
      const profit = matchedDeliveries.reduce((sum, d) => sum + parseNumber(d['Lợi nhuận gộp']), 0);

      const remaining = Math.max(0, qtyOrdered - qtyDelivered);
      const progress = qtyOrdered > 0 ? Math.round((qtyDelivered / qtyOrdered) * 100) : 0;
      const planDiff = qtyPlanned - qtyOrdered;
      const isOverDelivered = qtyDelivered > qtyOrdered && qtyOrdered > 0;
      const isUnderPlanned = qtyPlanned < qtyOrdered && qtyDelivered < qtyOrdered;
      const isOverPlanned = qtyPlanned > qtyOrdered && qtyOrdered > 0;
      const isDiscrepancy = isOverDelivered || (qtyPlanned !== qtyOrdered && qtyDelivered < qtyOrdered && qtyPlanned > 0);

      let status = 'pending';
      if (isOverDelivered) status = 'discrepancy';
      else if (progress >= 100) status = 'completed';
      else if (progress > 0) status = 'in_progress';
      else if (qtyPlanned > 0) status = 'planned';

      return {
        id: line['STT'] || line.id || idx,
        poNum,
        customer,
        prodCode,
        prodName,
        unit,
        qtyOrdered,
        qtyPlanned,
        qtyDelivered,
        planDiff,
        remaining,
        progress,
        revenue,
        profit,
        status,
        isOverDelivered,
        isUnderPlanned,
        isOverPlanned,
        isDiscrepancy,
        plansCount: matchedPlans.length,
        deliveriesCount: matchedDeliveries.length
      };
    }).filter(row => {
      const q = reconcileSearch.toLowerCase().trim();
      const matchSearch = !q || 
        row.poNum.toLowerCase().includes(q) ||
        row.customer.toLowerCase().includes(q) ||
        row.prodName.toLowerCase().includes(q) ||
        row.prodCode.toLowerCase().includes(q);

      let matchStatus = true;
      if (reconcileFilterStatus === 'discrepancy') {
        matchStatus = row.isDiscrepancy;
      } else if (reconcileFilterStatus !== 'ALL') {
        matchStatus = row.status === reconcileFilterStatus;
      }

      const matchCustomer = selectedCustomerFilter === 'ALL' || row.customer.toLowerCase().includes(selectedCustomerFilter.toLowerCase());
      return matchSearch && matchStatus && matchCustomer;
    });
  }, [poLines, deliveryPlans, deliveries, reconcileSearch, reconcileFilterStatus, selectedCustomerFilter]);

  // Export Reconciliation to Excel
  const handleExportReconciliationExcel = () => {
    try {
      const rows = reconciliationData.map((r, i) => ({
        'STT': i + 1,
        'Số đơn hàng (PO)': r.poNum,
        'Khách hàng': r.customer,
        'Mã sản phẩm': r.prodCode,
        'Tên sản phẩm': r.prodName,
        'ĐVT': r.unit,
        '1. Đặt hàng (PO)': r.qtyOrdered,
        '2. Đã lên Kế hoạch': r.qtyPlanned,
        '3. Đã xuất kho (PXK)': r.qtyDelivered,
        'Số lượng Còn lại': r.remaining,
        'Tiến độ giao (%)': `${r.progress}%`,
        'Trạng thái': r.status === 'completed' ? 'Đã giao đủ 100%' : r.status === 'in_progress' ? 'Đang giao dở' : r.status === 'planned' ? 'Đã lên lịch' : 'Chưa lên lịch',
        'Doanh thu thực giao (VNĐ)': r.revenue,
        'Lợi nhuận gộp (VNĐ)': r.profit
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Doi_Soat_Logistics_3_Chieu");
      XLSX.writeFile(wb, `TSG_DoiSoat_Logistics_360_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success("Đã xuất file Excel đối soát thành công!");
    } catch (e: any) {
      toast.error("Lỗi xuất Excel: " + e.message);
    }
  };

  const handleCreateQuickPlanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickPlanForm.poNumber || !quickPlanForm.product || !quickPlanForm.quantity) {
      toast.error("Vui lòng nhập đầy đủ Số PO, Sản phẩm và Số lượng!");
      return;
    }

    try {
      const newPlan = {
        'Đơn hàng': quickPlanForm.poNumber,
        'Khách hàng': quickPlanForm.customer,
        'Sản phẩm': quickPlanForm.product,
        'Số lượng cần giao': parseNumber(quickPlanForm.quantity),
        'Ngày dự kiến': quickPlanForm.date,
        'Ghi chú': quickPlanForm.notes,
        'Xe vận chuyển': quickPlanForm.vehicle,
        'Trạng thái': 'Mới'
      };
      await onAddPlan(newPlan);
      toast.success("Đã lập kế hoạch giao hàng mới thành công!");
      setIsQuickPlanOpen(false);
      setQuickPlanForm({
        poNumber: '',
        customer: '',
        product: '',
        quantity: '',
        date: new Date().toISOString().split('T')[0],
        notes: '',
        vehicle: ''
      });
    } catch (err: any) {
      toast.error("Lỗi khi lập kế hoạch: " + err.message);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 font-sans">
      {/* 🌟 HERO EXECUTIVE COMMAND BANNER */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0F172A] rounded-3xl p-6 sm:p-8 text-white shadow-2xl border border-slate-700/50">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-80 h-80 bg-gradient-to-bl from-teal-500/20 via-blue-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-12 w-64 h-64 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div className="space-y-2">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/20 border border-teal-400/30 text-teal-300 text-[11px] font-bold uppercase tracking-wider backdrop-blur-md">
                  <Sparkles size={13} className="text-teal-400 animate-pulse" />
                  TSG Logistics Command Center 360°
                </span>
                <span className="text-slate-500">•</span>
                <div className="flex items-center gap-1.5 text-xs text-slate-300 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse" />
                  <span>Hệ thống điều độ thời gian thực</span>
                </div>
              </div>
              
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
                <Truck className="text-teal-400" size={32} />
                <span>Kế Hoạch & Giao Hàng 360°</span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
                Hợp nhất toàn bộ quy trình logistics: Điều độ lịch giao 4 tầng, phân bổ chuyến theo đơn hàng PO, kiểm soát phiếu xuất kho (PXK) và đối soát cân bằng tiến độ 3 chiều.
              </p>
            </div>

            {/* Top Quick Actions */}
            <div className="flex items-center gap-2.5 flex-wrap lg:justify-end">
              <button
                type="button"
                onClick={() => setIsPOSelectorModalOpen(true)}
                className="px-4 py-2.5 bg-teal-500/20 hover:bg-teal-500/30 border border-teal-400/40 text-teal-200 hover:text-white rounded-2xl text-xs font-bold backdrop-blur-md active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
                title="Xem bảng chọn đơn hàng PO hệ thống để lên kế hoạch"
              >
                <Package size={16} className="text-teal-300" />
                <span>Bảng Chọn PO ({availableSystemPOs.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setIsQuickPlanOpen(true)}
                className="px-4 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-white rounded-2xl text-xs font-bold shadow-lg shadow-teal-500/25 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
              >
                <Plus size={16} />
                <span>Lập Kế Hoạch Giao Mới</span>
              </button>

              <button
                type="button"
                onClick={handleExportReconciliationExcel}
                className="px-4 py-2.5 bg-white/10 hover:bg-white/20 border border-white/15 text-white rounded-2xl text-xs font-semibold backdrop-blur-md active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
                title="Xuất file Excel đối soát 3 chiều"
              >
                <FileSpreadsheet size={16} className="text-emerald-400" />
                <span>Xuất Excel Đối Soát</span>
              </button>
            </div>
          </div>

          {/* 🌟 4 PILLARS SEGMENTED SWITCHER (Apple macOS Sequoia Glass Style) */}
          <div className="bg-slate-900/70 p-1.5 rounded-2xl border border-white/10 backdrop-blur-xl flex items-center overflow-x-auto gap-1 mobile-scroll-x select-none">
            <button
              type="button"
              onClick={() => setActiveSubTab('calendar')}
              className={clsx(
                "flex-1 min-w-[170px] py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2.5 cursor-pointer select-none",
                activeSubTab === 'calendar'
                  ? "bg-white text-slate-900 shadow-md shadow-black/20 font-extrabold"
                  : "text-slate-300 hover:text-white hover:bg-white/5"
              )}
            >
              <CalendarDays size={16} className={activeSubTab === 'calendar' ? "text-blue-600" : "text-slate-400"} />
              <span>1. Lịch Giao Nhận (4 Tầng)</span>
              <span className={clsx(
                "text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold",
                activeSubTab === 'calendar' ? "bg-blue-100 text-blue-800" : "bg-white/10 text-slate-300"
              )}>
                Năm/Tháng
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('plan')}
              className={clsx(
                "flex-1 min-w-[170px] py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2.5 cursor-pointer select-none",
                activeSubTab === 'plan'
                  ? "bg-white text-slate-900 shadow-md shadow-black/20 font-extrabold"
                  : "text-slate-300 hover:text-white hover:bg-white/5"
              )}
            >
              <ClipboardList size={16} className={activeSubTab === 'plan' ? "text-teal-600" : "text-slate-400"} />
              <span>2. Kế Hoạch Điều Độ</span>
              <span className={clsx(
                "text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold",
                activeSubTab === 'plan' ? "bg-teal-100 text-teal-800" : "bg-white/10 text-slate-300"
              )}>
                {logisticsKPIs.planCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('delivery')}
              className={clsx(
                "flex-1 min-w-[170px] py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2.5 cursor-pointer select-none",
                activeSubTab === 'delivery'
                  ? "bg-white text-slate-900 shadow-md shadow-black/20 font-extrabold"
                  : "text-slate-300 hover:text-white hover:bg-white/5"
              )}
            >
              <Truck size={16} className={activeSubTab === 'delivery' ? "text-orange-600" : "text-slate-400"} />
              <span>3. Sổ Giao Hàng PXK</span>
              <span className={clsx(
                "text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold",
                activeSubTab === 'delivery' ? "bg-orange-100 text-orange-800" : "bg-white/10 text-slate-300"
              )}>
                {logisticsKPIs.deliveryCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('reconcile')}
              className={clsx(
                "flex-1 min-w-[170px] py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2.5 cursor-pointer select-none",
                activeSubTab === 'reconcile'
                  ? "bg-white text-slate-900 shadow-md shadow-black/20 font-extrabold"
                  : "text-slate-300 hover:text-white hover:bg-white/5"
              )}
            >
              <Scale size={16} className={activeSubTab === 'reconcile' ? "text-purple-600" : "text-slate-400"} />
              <span>4. Đối Soát 3 Chiều</span>
              <span className={clsx(
                "text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold",
                activeSubTab === 'reconcile' ? "bg-purple-100 text-purple-800" : "bg-white/10 text-slate-300"
              )}>
                {logisticsKPIs.overallProgress}%
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* 📊 6 BENTO OPERATIONAL KPI CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-1 hover:border-blue-300 transition group">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider">Tổng Đặt (PO)</span>
            <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Package size={13} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
            {logisticsKPIs.totalQtyOrdered.toLocaleString('vi-VN')}
          </div>
          <p className="text-[10.5px] text-slate-500 font-medium">{poLines.length} mặt hàng trong {logisticsKPIs.activePOCount} PO</p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-1 hover:border-teal-300 transition group">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-bold text-teal-700 uppercase tracking-wider">Đã Lên Lịch</span>
            <div className="w-6 h-6 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
              <ClipboardList size={13} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold tracking-tight text-teal-700 tabular-nums">
            {logisticsKPIs.totalQtyPlanned.toLocaleString('vi-VN')}
          </div>
          <p className="text-[10.5px] text-teal-600 font-medium">{logisticsKPIs.planCount} chuyến điều độ</p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-1 hover:border-emerald-300 transition group">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-bold text-emerald-700 uppercase tracking-wider">Thực Giao (PXK)</span>
            <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Truck size={13} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold tracking-tight text-emerald-700 tabular-nums">
            {logisticsKPIs.totalQtyDelivered.toLocaleString('vi-VN')}
          </div>
          <p className="text-[10.5px] text-emerald-600 font-medium">Đạt {logisticsKPIs.overallProgress}% tiến độ</p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-1 hover:border-amber-300 transition group">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-bold text-amber-700 uppercase tracking-wider">Còn Lại Chưa Giao</span>
            <div className="w-6 h-6 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock size={13} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold tracking-tight text-amber-700 tabular-nums">
            {logisticsKPIs.totalRemaining.toLocaleString('vi-VN')}
          </div>
          <p className="text-[10.5px] text-amber-600 font-medium">Cần giao tiếp</p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-1 hover:border-indigo-300 transition group">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-bold text-indigo-700 uppercase tracking-wider">Doanh Thu Đã Giao</span>
            <div className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <DollarSign size={13} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold tracking-tight text-indigo-900 truncate tabular-nums" title={`${logisticsKPIs.totalRevenueDelivered.toLocaleString('vi-VN')} đ`}>
            {logisticsKPIs.totalRevenueDelivered >= 1e9 
              ? `${(logisticsKPIs.totalRevenueDelivered / 1e9).toFixed(2)} tỷ đ`
              : `${(logisticsKPIs.totalRevenueDelivered / 1e6).toFixed(1)} tr đ`}
          </div>
          <p className="text-[10.5px] text-indigo-600 font-medium">Từ {logisticsKPIs.deliveryCount} PXK xuất kho</p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-1 hover:border-rose-300 transition group">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-bold text-rose-700 uppercase tracking-wider">Lợi Nhuận Gộp</span>
            <div className="w-6 h-6 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <TrendingUp size={13} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold tracking-tight text-rose-700 truncate tabular-nums" title={`${logisticsKPIs.totalProfitDelivered.toLocaleString('vi-VN')} đ`}>
            {logisticsKPIs.totalProfitDelivered >= 1e9 
              ? `${(logisticsKPIs.totalProfitDelivered / 1e9).toFixed(2)} tỷ đ`
              : `${(logisticsKPIs.totalProfitDelivered / 1e6).toFixed(1)} tr đ`}
          </div>
          <p className="text-[10.5px] text-rose-600 font-bold font-mono">Biên LN: {logisticsKPIs.profitMargin}%</p>
        </div>
      </div>

      {/* 🌟 SUB-VIEW TAB CONTENT */}
      {activeSubTab === 'calendar' && (
        <div className="animate-in fade-in duration-200">
          <MasterCalendarView
            deliveryPlans={deliveryPlans}
            deliveries={deliveries}
            poLines={poLines}
            poHeaders={poHeaders}
            customers={customers}
            products={products}
            onAddPlan={onAddPlan}
            onPoClick={onPoClick}
            onProductClick={onProductClick}
          />
        </div>
      )}

      {activeSubTab === 'plan' && (
        <div className="animate-in fade-in duration-200">
          <DeliveryPlanView
            deliveryPlans={deliveryPlans}
            poLines={poLines}
            poHeaders={poHeaders}
            deliveries={deliveries}
            products={products}
            pricingData={pricingData}
            onAddPlan={onAddPlan}
            onUpdatePlan={onUpdatePlan}
            onDeletePlan={onDeletePlan}
            onPoClick={onPoClick}
            onProductClick={onProductClick}
          />
        </div>
      )}

      {activeSubTab === 'delivery' && (
        <div className="animate-in fade-in duration-200">
          <DeliveryView
            deliveryData={deliveries}
            poLinesData={poLines}
            customerData={customers}
            supplierData={suppliers}
            productData={products}
            pricingData={pricingData}
            onAdd={onAddDelivery}
            onEdit={onEditDelivery}
            onDelete={onDeleteDelivery}
            onProductClick={onProductClick}
            onPoClick={onPoClick}
            onCreateCalendarEvent={onCreateCalendarEvent}
          />
        </div>
      )}

      {activeSubTab === 'reconcile' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* Reconciliation 4-Box Executive Summary */}
          {(() => {
            const balancedCount = reconciliationData.filter(r => r.status === 'completed').length;
            const inProgressCount = reconciliationData.filter(r => r.status === 'in_progress').length;
            const discrepancyCount = reconciliationData.filter(r => r.isDiscrepancy).length;
            const pendingCount = reconciliationData.filter(r => r.status === 'pending').length;
            const totalRecRevenue = reconciliationData.reduce((sum, r) => sum + r.revenue, 0);

            return (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div className="bg-white rounded-2xl p-3.5 border border-emerald-200/80 bg-emerald-50/20 shadow-xs flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Khớp 100% Cân Bằng</div>
                    <div className="text-xl font-bold font-mono text-emerald-800 mt-0.5 tabular-nums">
                      {balancedCount} <span className="text-xs font-normal text-emerald-600">dòng</span>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                    {reconciliationData.length > 0 ? Math.round((balancedCount / reconciliationData.length) * 100) : 0}%
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-3.5 border border-amber-200/80 bg-amber-50/20 shadow-xs flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Đang Giao Theo Đợt</div>
                    <div className="text-xl font-bold font-mono text-amber-800 mt-0.5 tabular-nums">
                      {inProgressCount} <span className="text-xs font-normal text-amber-600">dòng</span>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-xs">
                    {reconciliationData.length > 0 ? Math.round((inProgressCount / reconciliationData.length) * 100) : 0}%
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-3.5 border border-rose-200/80 bg-rose-50/20 shadow-xs flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-rose-700">Cảnh Báo Lệch / Cần Rà Soát</div>
                    <div className="text-xl font-bold font-mono text-rose-800 mt-0.5 tabular-nums">
                      {discrepancyCount} <span className="text-xs font-normal text-rose-600">dòng</span>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold text-xs">
                    ⚠️
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-3.5 border border-indigo-200/80 bg-indigo-50/20 shadow-xs flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">Doanh Thu Đã Xuất Giao</div>
                    <div className="text-lg font-bold font-mono text-indigo-900 mt-0.5 tabular-nums truncate max-w-[170px]" title={`${totalRecRevenue.toLocaleString('vi-VN')} đ`}>
                      {totalRecRevenue >= 1e9 ? `${(totalRecRevenue / 1e9).toFixed(2)} Tỷ đ` : `${(totalRecRevenue / 1e6).toFixed(1)} Tr đ`}
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                    <DollarSign size={15} />
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Controls Bar */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-5 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xs">
            <div className="relative flex-1 w-full md:w-96">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Tìm theo số PO, khách hàng, tên sản phẩm..."
                value={reconcileSearch}
                onChange={(e) => setReconcileSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-[#F5F5F7] border border-slate-200/70 rounded-2xl text-xs outline-none focus:ring-2 focus:ring-purple-500 font-medium"
              />
              {reconcileSearch && (
                <button
                  onClick={() => setReconcileSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto justify-end flex-wrap">
              {/* Customer Filter */}
              <select
                value={selectedCustomerFilter}
                onChange={(e) => setSelectedCustomerFilter(e.target.value)}
                className="px-3.5 py-2.5 bg-[#F5F5F7] border border-slate-200/70 rounded-2xl text-xs font-bold text-slate-700 outline-none cursor-pointer hover:bg-slate-100 transition"
              >
                <option value="ALL">Tất cả khách hàng ({customerOptions.length})</option>
                {customerOptions.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={reconcileFilterStatus}
                onChange={(e) => setReconcileFilterStatus(e.target.value)}
                className="px-3.5 py-2.5 bg-[#F5F5F7] border border-slate-200/70 rounded-2xl text-xs font-bold text-slate-700 outline-none cursor-pointer hover:bg-slate-100 transition"
              >
                <option value="ALL">Tất cả tiến độ ({reconciliationData.length})</option>
                <option value="completed">🟢 Đã giao đủ 100% (Cân bằng)</option>
                <option value="in_progress">🟡 Đang giao theo đợt</option>
                <option value="discrepancy">🔴 Cảnh báo chênh lệch / Xuất vượt</option>
                <option value="planned">📅 Đã lên kế hoạch</option>
                <option value="pending">⚪ Chưa lên kế hoạch</option>
              </select>
            </div>
          </div>

          {/* 3-Way Reconciliation Matrix Table */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.03)] overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                  <Scale size={18} className="text-purple-600" />
                  <span>Ma Trận Đối Soát Cân Bằng 3 Chiều</span>
                </h3>
                <p className="text-xs text-slate-500">Đối chiếu chi tiết giữa Đặt Hàng (PO) • Kế Hoạch Điều Độ • Phiếu Xuất Kho (PXK)</p>
              </div>
              <span className="text-xs font-semibold tabular-nums bg-purple-50 text-purple-700 px-3 py-1 rounded-full border border-purple-200">
                {reconciliationData.length} Dòng Sản Phẩm
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#F8F9FA] border-b border-slate-200/80 text-[10.5px] uppercase font-extrabold text-slate-600 tracking-wider">
                    <th className="px-4 py-3.5 text-center w-12">STT</th>
                    <th className="px-4 py-3.5">Số PO & Khách Hàng</th>
                    <th className="px-4 py-3.5 min-w-[220px]">Sản Phẩm & Quy Cách</th>
                    <th className="px-4 py-3.5 text-right font-bold text-slate-900">1. Đặt (PO)</th>
                    <th className="px-4 py-3.5 text-right font-bold text-teal-700">2. Kế Hoạch</th>
                    <th className="px-4 py-3.5 text-right font-bold text-emerald-700">3. Thực Giao (PXK)</th>
                    <th className="px-4 py-3.5 text-right font-bold text-amber-700">Còn Lại</th>
                    <th className="px-4 py-3.5 text-center">Tiến Độ</th>
                    <th className="px-4 py-3.5 text-center">Cân Bằng & Trạng Thái</th>
                    <th className="px-4 py-3.5 text-right">Doanh Thu Đã Giao</th>
                    <th className="px-4 py-3.5 text-right">Lợi Nhuận Gộp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
                  {reconciliationData.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-12 text-center text-slate-400">
                        Không tìm thấy dòng đối soát nào phù hợp với bộ lọc.
                      </td>
                    </tr>
                  ) : (
                    reconciliationData.map((row, idx) => {
                      const isRowDiscrepancy = row.isOverDelivered || row.isUnderPlanned || row.isOverPlanned;
                      
                      return (
                      <tr 
                        key={row.id} 
                        className={clsx(
                          "transition group",
                          row.isOverDelivered ? "bg-rose-50/30 hover:bg-rose-50/60" : "hover:bg-slate-50/80"
                        )}
                      >
                        <td className="px-4 py-3.5 text-center text-slate-400 tabular-nums font-mono">
                          {idx + 1}
                        </td>
                        <td className="px-4 py-3.5">
                          <button
                            type="button"
                            onClick={() => onPoClick?.(row.poNum)}
                            className="font-semibold tabular-nums text-blue-600 hover:text-blue-800 hover:underline block text-left"
                          >
                            {row.poNum}
                          </button>
                          <span className="text-[11px] text-slate-500 font-medium block truncate max-w-[160px]" title={row.customer}>
                            {row.customer}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <button
                            type="button"
                            onClick={() => onProductClick?.(row.prodCode || row.prodName)}
                            className="font-bold text-slate-900 hover:text-blue-600 truncate text-left block max-w-[260px]"
                            title={row.prodName}
                          >
                            {row.prodName}
                          </button>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="font-mono text-[10px] text-slate-400">
                              {row.prodCode || "---"}
                            </span>
                            <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-semibold font-mono">
                              {row.unit}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-right font-bold tabular-nums font-mono text-slate-900">
                          {row.qtyOrdered.toLocaleString("vi-VN")}
                        </td>
                        <td className="px-4 py-3.5 text-right font-bold tabular-nums font-mono text-teal-700">
                          {row.qtyPlanned.toLocaleString("vi-VN")}
                          {row.plansCount > 0 && (
                            <span className="text-[9.5px] text-slate-400 block font-normal">({row.plansCount} đợt)</span>
                          )}
                          {row.isUnderPlanned && (
                            <span className="text-[9px] text-amber-600 font-bold block bg-amber-50 px-1 rounded mt-0.5 border border-amber-200/60">
                              Thiếu KH: -{(row.qtyOrdered - row.qtyPlanned).toLocaleString("vi-VN")}
                            </span>
                          )}
                          {row.isOverPlanned && (
                            <span className="text-[9px] text-teal-600 font-bold block bg-teal-50 px-1 rounded mt-0.5 border border-teal-200/60">
                              KH dư: +{(row.qtyPlanned - row.qtyOrdered).toLocaleString("vi-VN")}
                            </span>
                          )}
                        </td>
                        <td className={clsx(
                          "px-4 py-3.5 text-right font-bold tabular-nums font-mono",
                          row.isOverDelivered ? "text-rose-600 bg-rose-50/50 rounded-lg" : "text-emerald-700"
                        )}>
                          {row.qtyDelivered.toLocaleString("vi-VN")}
                          {row.deliveriesCount > 0 && (
                            <span className="text-[9.5px] text-slate-400 block font-normal">({row.deliveriesCount} PXK)</span>
                          )}
                          {row.isOverDelivered && (
                            <span className="text-[9px] text-rose-700 font-extrabold block bg-rose-100 px-1 rounded mt-0.5 border border-rose-200">
                              Vượt PO: +{(row.qtyDelivered - row.qtyOrdered).toLocaleString("vi-VN")}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right font-bold tabular-nums font-mono text-amber-700">
                          {row.remaining.toLocaleString("vi-VN")}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <div className="w-16 mx-auto bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div
                              className={clsx(
                                "h-full rounded-full transition-all duration-300",
                                row.progress >= 100 ? "bg-emerald-500" : row.progress > 0 ? "bg-amber-500" : "bg-slate-300"
                              )}
                              style={{ width: `${Math.min(100, row.progress)}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-semibold font-mono tabular-nums text-slate-600 mt-1 block">
                            {row.progress}%
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          {row.isOverDelivered ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200 inline-block shadow-2xs">
                              🔴 Xuất vượt PO
                            </span>
                          ) : row.status === 'completed' ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-block shadow-2xs">
                              🟢 Khớp 100%
                            </span>
                          ) : row.status === 'in_progress' ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200 inline-block shadow-2xs">
                              🟡 Giao theo đợt
                            </span>
                          ) : row.status === 'planned' ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-teal-50 text-teal-700 border border-teal-200 inline-block shadow-2xs">
                              📅 Đã lên lịch
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-600 border border-slate-200 inline-block">
                              ⚪ Chưa lên lịch
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right font-semibold font-mono tabular-nums text-slate-900">
                          {row.revenue > 0 ? `${row.revenue.toLocaleString("vi-VN")} đ` : "---"}
                        </td>
                        <td className="px-4 py-3.5 text-right font-semibold font-mono tabular-nums text-rose-700">
                          {row.profit > 0 ? `${row.profit.toLocaleString("vi-VN")} đ` : "---"}
                        </td>
                      </tr>
                    );
                  }))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 QUICK PLAN MODAL */}
      {isQuickPlanOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-200 space-y-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center">
                  <ClipboardList size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 tracking-tight">Lập Kế Hoạch Điều Độ Mới</h3>
                  <p className="text-xs text-slate-500">Phân bổ chuyến giao hàng theo PO cho đội vận tải</p>
                </div>
              </div>
              <button
                onClick={() => setIsQuickPlanOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateQuickPlanSubmit} className="space-y-4">
              {/* Số Đơn Hàng PO with Interactive Selection Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-800">
                    Số Đơn Hàng PO * <span className="text-[11px] font-medium text-teal-600">(Chọn từ hệ thống)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsPOSelectorModalOpen(true)}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-700 hover:text-white bg-teal-50 hover:bg-teal-600 border border-teal-300 px-3 py-1 rounded-xl transition shadow-2xs cursor-pointer active:scale-95"
                  >
                    <Package size={13} />
                    <span>Mở Bảng Chọn PO ({availableSystemPOs.length})</span>
                  </button>
                </div>

                {/* Big Visual Table Modal Trigger Button */}
                <div
                  onClick={() => setIsPOSelectorModalOpen(true)}
                  className="w-full p-3 bg-gradient-to-r from-teal-50 via-teal-50/60 to-emerald-50 hover:from-teal-100/90 hover:to-emerald-100/90 border-2 border-dashed border-teal-400 hover:border-teal-600 rounded-2xl cursor-pointer transition flex items-center justify-between group shadow-2xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                      <Package size={20} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-extrabold text-teal-950 flex items-center gap-1.5">
                        <span>{quickPlanForm.poNumber ? `Đã chọn PO: ${quickPlanForm.poNumber}` : 'BẤM VÀO ĐÂY ĐỂ CHỌN PO TỪ BẢNG HỆ THỐNG'}</span>
                      </div>
                      <p className="text-[11px] text-teal-700 truncate mt-0.5">
                        {quickPlanForm.poNumber 
                          ? `${quickPlanForm.customer} • Bấm để mở lại bảng chọn PO khác` 
                          : `Xem danh sách đầy đủ ${availableSystemPOs.length} đơn PO với khách hàng & sản phẩm`}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 px-3 py-1.5 bg-teal-600 group-hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1">
                    <span>Bảng Chọn PO</span>
                    <ChevronRight size={14} />
                  </span>
                </div>

                {/* Direct Dropdown Select as Quick Alternative */}
                <div className="relative">
                  <select
                    required
                    value={quickPlanForm.poNumber}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!val) {
                        setQuickPlanForm(prev => ({ ...prev, poNumber: '', customer: '', product: '', quantity: '' }));
                        return;
                      }
                      const found = availableSystemPOs.find(p => p.poNumber === val);
                      if (found) {
                        handleSelectPOFromTable(found);
                      } else {
                        setQuickPlanForm(prev => ({ ...prev, poNumber: val }));
                      }
                    }}
                    className="w-full px-3.5 py-2.5 bg-[#F5F5F7] hover:bg-slate-100 focus:bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 outline-none focus:ring-2 focus:ring-teal-500 transition cursor-pointer"
                  >
                    <option value="">-- Hoặc nhấp chọn nhanh mã PO từ danh sách thả xuống ({availableSystemPOs.length} đơn) --</option>
                    {availableSystemPOs.map((po, idx) => (
                      <option key={idx} value={po.poNumber}>
                        {po.poNumber} | {po.customer} (Còn {po.remainingToPlan.toLocaleString('vi-VN')} sp)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Selected PO helper badge & Quick Line Selector */}
                {selectedPOInfo && (
                  <div className="p-3 bg-teal-50/90 border border-teal-200 rounded-2xl space-y-2 text-xs animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono font-bold text-teal-800 bg-white px-2 py-0.5 rounded border border-teal-200 shrink-0">
                          {selectedPOInfo.poNumber}
                        </span>
                        <span className="font-bold text-slate-800 truncate">
                          {selectedPOInfo.customer}
                        </span>
                        {selectedPOInfo.date && (
                          <span className="text-[10.5px] text-slate-500 shrink-0">
                            ({selectedPOInfo.date})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] font-bold text-teal-700">
                          Còn {selectedPOInfo.remainingToPlan.toLocaleString('vi-VN')} sp
                        </span>
                        <button
                          type="button"
                          onClick={() => setQuickPlanForm(prev => ({ ...prev, poNumber: '', customer: '', product: '', quantity: '' }))}
                          className="text-[11px] text-red-600 hover:underline"
                        >
                          Hủy chọn
                        </button>
                      </div>
                    </div>

                    {selectedPOInfo.lines.length > 0 && (
                      <div className="pt-1.5 border-t border-teal-100">
                        <div className="text-[10.5px] text-slate-500 mb-1 font-semibold">
                          Bấm vào sản phẩm để tự động điền vào kế hoạch:
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedPOInfo.lines.map((l: any, lIdx: number) => {
                            const isLineSel = quickPlanForm.product === l.productName;
                            return (
                              <button
                                key={lIdx}
                                type="button"
                                onClick={() => {
                                  setQuickPlanForm(prev => ({
                                    ...prev,
                                    product: l.productName,
                                    quantity: String(l.qtyRemainingToPlan > 0 ? l.qtyRemainingToPlan : l.qtyOrdered)
                                  }));
                                }}
                                className={`px-2.5 py-1 rounded-lg text-[11px] transition cursor-pointer flex items-center gap-1.5 ${
                                  isLineSel
                                    ? 'bg-teal-600 text-white font-bold shadow-2xs'
                                    : 'bg-white text-slate-700 border border-teal-200 hover:bg-teal-100'
                                }`}
                              >
                                <span>{l.productName}</span>
                                <span className={`text-[10px] px-1 py-0.2 rounded font-mono ${
                                  isLineSel ? 'bg-teal-700 text-teal-100' : 'bg-slate-100 text-slate-600'
                                }`}>
                                  Còn {l.qtyRemainingToPlan.toLocaleString('vi-VN')} {l.unit}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Khách Hàng</label>
                  <input
                    type="text"
                    placeholder="Tên khách hàng"
                    value={quickPlanForm.customer}
                    onChange={(e) => setQuickPlanForm({ ...quickPlanForm, customer: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-[#F5F5F7] border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Ngày Dự Kiến Giao *</label>
                  <input
                    type="date"
                    required
                    value={quickPlanForm.date}
                    onChange={(e) => setQuickPlanForm({ ...quickPlanForm, date: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-[#F5F5F7] border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tên Sản Phẩm *</label>
                  {selectedPOInfo && selectedPOInfo.lines.length > 0 ? (
                    <div className="space-y-1.5">
                      <select
                        value={quickPlanForm.product}
                        onChange={(e) => {
                          const matched = selectedPOInfo.lines.find((l: any) => l.productName === e.target.value);
                          setQuickPlanForm({
                            ...quickPlanForm,
                            product: e.target.value,
                            quantity: matched ? String(matched.qtyRemainingToPlan > 0 ? matched.qtyRemainingToPlan : matched.qtyOrdered) : quickPlanForm.quantity
                          });
                        }}
                        className="w-full px-3.5 py-2.5 bg-[#F5F5F7] border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-teal-500"
                      >
                        <option value="">-- Chọn sản phẩm từ PO --</option>
                        {selectedPOInfo.lines.map((l: any, lIdx: number) => (
                          <option key={lIdx} value={l.productName}>
                            {l.productName} (Còn {l.qtyRemainingToPlan.toLocaleString('vi-VN')} {l.unit})
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        placeholder="Hoặc gõ tên mặt hàng khác..."
                        value={quickPlanForm.product}
                        onChange={(e) => setQuickPlanForm({ ...quickPlanForm, product: e.target.value })}
                        className="w-full px-3 py-1.5 text-[11px] bg-[#F5F5F7] border border-slate-200 rounded-xl text-slate-700 outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    </div>
                  ) : (
                    <input
                      type="text"
                      required
                      placeholder="Tên hoặc quy cách sản phẩm"
                      value={quickPlanForm.product}
                      onChange={(e) => setQuickPlanForm({ ...quickPlanForm, product: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-[#F5F5F7] border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Số Lượng *</label>
                  <input
                    type="number"
                    required
                    placeholder="VD: 5000"
                    value={quickPlanForm.quantity}
                    onChange={(e) => setQuickPlanForm({ ...quickPlanForm, quantity: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-[#F5F5F7] border border-slate-200 rounded-xl text-xs font-semibold tabular-nums outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Xe / Tài Xế</label>
                  <input
                    type="text"
                    placeholder="Biển số xe / Lái xe"
                    value={quickPlanForm.vehicle}
                    onChange={(e) => setQuickPlanForm({ ...quickPlanForm, vehicle: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-[#F5F5F7] border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Ghi Chú</label>
                  <input
                    type="text"
                    placeholder="Ghi chú giao nhận..."
                    value={quickPlanForm.notes}
                    onChange={(e) => setQuickPlanForm({ ...quickPlanForm, notes: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-[#F5F5F7] border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsQuickPlanOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-md shadow-teal-500/20 active:scale-95 transition"
                >
                  Lưu Kế Hoạch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🌟 SYSTEM PO SELECTOR TABLE MODAL */}
      {isPOSelectorModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-5 sm:p-7 max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 space-y-5 animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center">
                  <Package size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                    Bảng Chọn Đơn Hàng (PO) Trong Hệ Thống
                  </h3>
                  <p className="text-xs text-slate-500">
                    Chọn đơn đặt hàng để tự động nạp khách hàng, mặt hàng và số lượng còn lại vào kế hoạch
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPOSelectorModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition"
              >
                <X size={20} />
              </button>
            </div>

            {/* Search & Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between shrink-0">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm kiếm theo mã PO, khách hàng, tên mặt hàng..."
                  value={poSearchTerm}
                  onChange={(e) => setPOSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-[#F5F5F7] border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="flex items-center gap-1.5 p-1 bg-[#F5F5F7] rounded-xl border border-slate-200/80 text-xs font-semibold shrink-0">
                <button
                  type="button"
                  onClick={() => setPOFilterStatus('PENDING')}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    poFilterStatus === 'PENDING'
                      ? 'bg-white text-teal-700 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Cần lên lịch ({availableSystemPOs.filter(p => !p.isCompleted).length})
                </button>
                <button
                  type="button"
                  onClick={() => setPOFilterStatus('ALL')}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    poFilterStatus === 'ALL'
                      ? 'bg-white text-teal-700 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Tất cả ({availableSystemPOs.length})
                </button>
                <button
                  type="button"
                  onClick={() => setPOFilterStatus('COMPLETED')}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    poFilterStatus === 'COMPLETED'
                      ? 'bg-white text-teal-700 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Đã hoàn thành ({availableSystemPOs.filter(p => p.isCompleted).length})
                </button>
              </div>
            </div>

            {/* PO List Table */}
            <div className="flex-1 overflow-y-auto border border-slate-200 rounded-2xl">
              {filteredSystemPOs.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <Package className="mx-auto text-slate-300" size={40} />
                  <p className="text-sm font-semibold text-slate-600">Không tìm thấy đơn hàng PO nào phù hợp</p>
                  <p className="text-xs text-slate-400">Thử tìm kiếm với từ khóa khác hoặc chuyển bộ lọc trạng thái</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 bg-[#F5F5F7] border-b border-slate-200 text-slate-700 font-bold z-10">
                    <tr>
                      <th className="py-3 px-3.5">Mã PO / Ngày đặt</th>
                      <th className="py-3 px-3.5">Khách hàng</th>
                      <th className="py-3 px-3.5">Mặt hàng & Số lượng</th>
                      <th className="py-3 px-3.5 text-center">Tiến độ</th>
                      <th className="py-3 px-3.5 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredSystemPOs.map((po, idx) => (
                      <tr key={idx} className="hover:bg-teal-50/30 transition group">
                        <td className="py-3 px-3.5 align-top">
                          <div className="font-mono font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200 inline-block">
                            {po.poNumber}
                          </div>
                          {po.date && (
                            <div className="text-[10.5px] text-slate-400 mt-1 flex items-center gap-1">
                              <Calendar size={11} />
                              <span>{po.date}</span>
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-3.5 align-top">
                          <div className="font-bold text-slate-900 text-xs">
                            {po.customer}
                          </div>
                          <div className="text-[10.5px] text-slate-400 mt-0.5">
                            {po.lines.length} mặt hàng
                          </div>
                        </td>

                        <td className="py-3 px-3.5 align-top space-y-1.5">
                          {po.lines.map((line: any, lIdx: number) => (
                            <div
                              key={lIdx}
                              className="flex items-center justify-between gap-2 p-1.5 bg-[#FBFBFD] rounded-lg border border-slate-100"
                            >
                              <div className="truncate max-w-[200px]" title={line.productName}>
                                <span className="font-medium text-slate-800">{line.productName}</span>
                                <span className="text-[10px] text-slate-400 ml-1">
                                  ({line.qtyOrdered.toLocaleString('vi-VN')} {line.unit})
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                  line.qtyRemainingToPlan > 0
                                    ? 'bg-amber-50 text-amber-700 border border-amber-200/60'
                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                                }`}>
                                  {line.qtyRemainingToPlan > 0 ? `Còn ${line.qtyRemainingToPlan.toLocaleString('vi-VN')}` : 'Đã đủ'}
                                </span>
                                {po.lines.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleSelectPOFromTable(po, line)}
                                    className="px-2 py-0.5 text-[10px] font-bold text-teal-700 bg-white border border-teal-200 hover:bg-teal-50 rounded transition"
                                  >
                                    Chọn dòng
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </td>

                        <td className="py-3 px-3.5 align-top text-center w-28">
                          <div className="text-[10.5px] font-bold text-slate-800">
                            {po.totalPlanned.toLocaleString('vi-VN')} / {po.totalOrdered.toLocaleString('vi-VN')}
                          </div>
                          <div className="w-full bg-slate-200 rounded-full h-1.5 mt-1 overflow-hidden">
                            <div
                              className="bg-teal-600 h-full rounded-full transition-all"
                              style={{
                                width: `${Math.min(100, po.totalOrdered > 0 ? (po.totalPlanned / po.totalOrdered) * 100 : 0)}%`
                              }}
                            />
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {po.totalOrdered > 0 ? Math.round((po.totalPlanned / po.totalOrdered) * 100) : 0}% đã lên lịch
                          </div>
                        </td>

                        <td className="py-3 px-3.5 align-top text-right">
                          <button
                            type="button"
                            onClick={() => handleSelectPOFromTable(po)}
                            className="inline-flex items-center gap-1 px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-2xs hover:shadow transition active:scale-95 cursor-pointer"
                          >
                            <Check size={13} />
                            <span>Chọn PO Này</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-slate-100 pt-3 shrink-0">
              <div className="text-xs text-slate-500">
                Hiển thị <strong>{filteredSystemPOs.length}</strong> đơn đặt hàng PO
              </div>
              <button
                type="button"
                onClick={() => setIsPOSelectorModalOpen(false)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
