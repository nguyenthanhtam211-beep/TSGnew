import React, { useState, useMemo } from 'react';
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
  X
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

      let status = 'pending';
      if (progress >= 100) status = 'completed';
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

      const matchStatus = reconcileFilterStatus === 'ALL' || row.status === reconcileFilterStatus;
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
          <div className="bg-slate-900/70 p-1.5 rounded-2xl border border-white/10 backdrop-blur-xl flex items-center overflow-x-auto gap-1">
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
          <div className="text-xl font-extrabold font-mono text-slate-900 tabular-nums">
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
          <div className="text-xl font-extrabold font-mono text-teal-700 tabular-nums">
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
          <div className="text-xl font-extrabold font-mono text-emerald-700 tabular-nums">
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
          <div className="text-xl font-extrabold font-mono text-amber-700 tabular-nums">
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
          <div className="text-xl font-extrabold font-mono text-indigo-900 tabular-nums truncate" title={`${logisticsKPIs.totalRevenueDelivered.toLocaleString('vi-VN')} đ`}>
            {logisticsKPIs.totalRevenueDelivered >= 1e9 
              ? `${(logisticsKPIs.totalRevenueDelivered / 1e9).toFixed(2)} Tỷ`
              : `${(logisticsKPIs.totalRevenueDelivered / 1e6).toFixed(1)} Tr`}
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
          <div className="text-xl font-extrabold font-mono text-rose-700 tabular-nums truncate" title={`${logisticsKPIs.totalProfitDelivered.toLocaleString('vi-VN')} đ`}>
            {logisticsKPIs.totalProfitDelivered >= 1e9 
              ? `${(logisticsKPIs.totalProfitDelivered / 1e9).toFixed(2)} Tỷ`
              : `${(logisticsKPIs.totalProfitDelivered / 1e6).toFixed(1)} Tr`}
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
                <option value="ALL">Tất cả tiến độ</option>
                <option value="completed">🟢 Đã giao đủ 100%</option>
                <option value="in_progress">🟡 Đang giao theo đợt</option>
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
              <span className="text-xs font-mono font-bold bg-purple-50 text-purple-700 px-3 py-1 rounded-full border border-purple-200">
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
                    <th className="px-4 py-3.5 text-center">Trạng Thái</th>
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
                    reconciliationData.map((row, idx) => (
                      <tr key={row.id} className="hover:bg-slate-50/80 transition group">
                        <td className="px-4 py-3.5 text-center font-mono text-slate-400">
                          {idx + 1}
                        </td>
                        <td className="px-4 py-3.5">
                          <button
                            type="button"
                            onClick={() => onPoClick?.(row.poNum)}
                            className="font-mono font-bold text-blue-600 hover:text-blue-800 hover:underline block text-left"
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
                        <td className="px-4 py-3.5 text-right font-mono font-extrabold text-slate-900">
                          {row.qtyOrdered.toLocaleString("vi-VN")}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono font-extrabold text-teal-700">
                          {row.qtyPlanned.toLocaleString("vi-VN")}
                          {row.plansCount > 0 && (
                            <span className="text-[9.5px] text-slate-400 block font-normal">({row.plansCount} đợt)</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono font-extrabold text-emerald-700">
                          {row.qtyDelivered.toLocaleString("vi-VN")}
                          {row.deliveriesCount > 0 && (
                            <span className="text-[9.5px] text-slate-400 block font-normal">({row.deliveriesCount} PXK)</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono font-extrabold text-amber-700">
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
                          <span className="text-[10px] font-mono font-bold text-slate-600 mt-1 block">
                            {row.progress}%
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          {row.status === 'completed' && (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-block shadow-2xs">
                              🟢 Khớp 100%
                            </span>
                          )}
                          {row.status === 'in_progress' && (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200 inline-block shadow-2xs">
                              🟡 Giao theo đợt
                            </span>
                          )}
                          {row.status === 'planned' && (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-teal-50 text-teal-700 border border-teal-200 inline-block shadow-2xs">
                              📅 Đã lên lịch
                            </span>
                          )}
                          {row.status === 'pending' && (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-600 border border-slate-200 inline-block">
                              ⚪ Chưa lên lịch
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono font-bold text-slate-900">
                          {row.revenue > 0 ? `${row.revenue.toLocaleString("vi-VN")} đ` : "---"}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono font-bold text-rose-700">
                          {row.profit > 0 ? `${row.profit.toLocaleString("vi-VN")} đ` : "---"}
                        </td>
                      </tr>
                    ))
                  )}
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
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Số Đơn Hàng PO *</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: PO-TL-2026-001"
                  value={quickPlanForm.poNumber}
                  onChange={(e) => setQuickPlanForm({ ...quickPlanForm, poNumber: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-[#F5F5F7] border border-slate-200 rounded-xl text-xs font-mono font-medium outline-none focus:ring-2 focus:ring-teal-500"
                />
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
                  <input
                    type="text"
                    required
                    placeholder="Tên hoặc quy cách sản phẩm"
                    value={quickPlanForm.product}
                    onChange={(e) => setQuickPlanForm({ ...quickPlanForm, product: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-[#F5F5F7] border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Số Lượng *</label>
                  <input
                    type="number"
                    required
                    placeholder="VD: 5000"
                    value={quickPlanForm.quantity}
                    onChange={(e) => setQuickPlanForm({ ...quickPlanForm, quantity: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-[#F5F5F7] border border-slate-200 rounded-xl text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-teal-500"
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
    </div>
  );
}
