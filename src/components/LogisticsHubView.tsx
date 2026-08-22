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
  ChevronRight
} from 'lucide-react';
import clsx from 'clsx';
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

    return {
      totalQtyOrdered,
      totalQtyPlanned,
      totalQtyDelivered,
      totalRemaining,
      totalRevenueDelivered,
      totalProfitDelivered,
      overallProgress
    };
  }, [poLines, deliveryPlans, deliveries]);

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
      return matchSearch && matchStatus;
    });
  }, [poLines, deliveryPlans, deliveries, reconcileSearch, reconcileFilterStatus]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header & Integrated Sub-Tab Switcher */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10.5px] font-bold text-teal-600 uppercase tracking-widest bg-teal-50 px-2.5 py-0.5 rounded-md border border-teal-100">
                Logistics & Delivery Operations Hub
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-xs text-slate-500 font-medium">Hợp Nhất Lịch 4 Tầng • Kế Hoạch Điều Độ • Phiếu Xuất Kho • Đối Soát 3 Chiều</span>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
              <Truck className="text-teal-600" size={26} />
              <span>Trung Tâm Kế Hoạch & Điều Độ Giao Nhận</span>
            </h2>
          </div>

          {/* Apple Segmented Switcher */}
          <div className="bg-[#F5F5F7] p-1.5 rounded-2xl flex items-center border border-slate-200/60 text-xs font-semibold overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveSubTab('calendar')}
              className={clsx(
                "px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap",
                activeSubTab === 'calendar' ? "bg-white text-[#007AFF] shadow-xs font-bold" : "text-slate-600 hover:text-slate-900"
              )}
            >
              <CalendarDays size={15} />
              <span>1. Lịch Giao Nhận (4 Tầng)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('plan')}
              className={clsx(
                "px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap",
                activeSubTab === 'plan' ? "bg-white text-teal-700 shadow-xs font-bold" : "text-slate-600 hover:text-slate-900"
              )}
            >
              <ClipboardList size={15} />
              <span>2. Kế Hoạch Điều Độ ({deliveryPlans.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('delivery')}
              className={clsx(
                "px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap",
                activeSubTab === 'delivery' ? "bg-white text-orange-700 shadow-xs font-bold" : "text-slate-600 hover:text-slate-900"
              )}
            >
              <Truck size={15} />
              <span>3. Sổ Giao Hàng PXK ({deliveries.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('reconcile')}
              className={clsx(
                "px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap",
                activeSubTab === 'reconcile' ? "bg-white text-purple-700 shadow-xs font-bold" : "text-slate-600 hover:text-slate-900"
              )}
            >
              <Scale size={15} />
              <span>4. Đối Soát Cân Bằng (3 Chiều)</span>
            </button>
          </div>
        </div>

        {/* 4 Bento Operational Metric Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 pt-1">
          <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Tổng Đặt Hàng (PO)
            </span>
            <div className="text-xl font-bold font-mono text-slate-900 tabular-nums">
              {logisticsKPIs.totalQtyOrdered.toLocaleString("vi-VN")}
            </div>
            <p className="text-[10px] text-slate-400">{poLines.length} dòng hàng cần giao</p>
          </div>

          <div className="p-4 bg-teal-50/70 border border-teal-200/80 rounded-2xl space-y-1">
            <span className="text-[10px] font-bold text-teal-700 uppercase tracking-wider">
              Đã Lên Kế Hoạch
            </span>
            <div className="text-xl font-bold font-mono text-teal-900 tabular-nums">
              {logisticsKPIs.totalQtyPlanned.toLocaleString("vi-VN")}
            </div>
            <p className="text-[10px] text-teal-600">{deliveryPlans.length} chuyến điều độ</p>
          </div>

          <div className="p-4 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl space-y-1">
            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
              Đã Thực Giao (PXK)
            </span>
            <div className="text-xl font-bold font-mono text-emerald-900 tabular-nums">
              {logisticsKPIs.totalQtyDelivered.toLocaleString("vi-VN")}
            </div>
            <p className="text-[10px] text-emerald-600">Đạt {logisticsKPIs.overallProgress}% tiến độ</p>
          </div>

          <div className="p-4 bg-amber-50/70 border border-amber-200/80 rounded-2xl space-y-1">
            <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">
              Còn Lại Cần Giao
            </span>
            <div className="text-xl font-bold font-mono text-amber-900 tabular-nums">
              {logisticsKPIs.totalRemaining.toLocaleString("vi-VN")}
            </div>
            <p className="text-[10px] text-amber-600">Chưa xuất kho</p>
          </div>
        </div>
      </div>

      {/* Sub-View Content */}
      {activeSubTab === 'calendar' && (
        <MasterCalendarView
          deliveryPlans={deliveryPlans}
          deliveries={deliveries}
          poLines={poLines}
          poHeaders={poHeaders}
          customers={customers}
          onPoClick={onPoClick}
          onProductClick={onProductClick}
        />
      )}

      {activeSubTab === 'plan' && (
        <DeliveryPlanView
          deliveryPlans={deliveryPlans}
          poLines={poLines}
          poHeaders={poHeaders}
          deliveries={deliveries}
          products={products}
          onAddPlan={onAddPlan}
          onUpdatePlan={onUpdatePlan}
          onDeletePlan={onDeletePlan}
          onPoClick={onPoClick}
          onProductClick={onProductClick}
        />
      )}

      {activeSubTab === 'delivery' && (
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
      )}

      {activeSubTab === 'reconcile' && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 flex flex-col md:flex-row items-center justify-between gap-3 shadow-2xs">
            <div className="relative flex-1 w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input
                type="text"
                placeholder="Tìm theo số PO, khách hàng, tên sản phẩm..."
                value={reconcileSearch}
                onChange={(e) => setReconcileSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-[#F5F5F7] border border-slate-200/60 rounded-xl text-xs outline-none focus:ring-2 focus:ring-purple-500 font-medium"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto justify-end">
              <select
                value={reconcileFilterStatus}
                onChange={(e) => setReconcileFilterStatus(e.target.value)}
                className="px-3 py-2 bg-[#F5F5F7] border border-slate-200/60 rounded-xl text-xs font-semibold text-slate-700 outline-none cursor-pointer"
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="completed">🟢 Đã giao đủ 100%</option>
                <option value="in_progress">🟡 Đang giao theo đợt</option>
                <option value="planned">📅 Đã lên kế hoạch</option>
                <option value="pending">⚪ Chưa lập kế hoạch</option>
              </select>
            </div>
          </div>

          {/* 3-Way Reconciliation Table */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.03)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#F5F5F7] border-b border-slate-200/80 text-[10.5px] uppercase font-bold text-slate-600 tracking-wider">
                    <th className="px-3.5 py-3.5 text-center w-12">STT</th>
                    <th className="px-3.5 py-3.5">Số PO & Khách Hàng</th>
                    <th className="px-3.5 py-3.5 min-w-[200px]">Sản Phẩm</th>
                    <th className="px-3.5 py-3.5 text-right">1. Đặt (PO)</th>
                    <th className="px-3.5 py-3.5 text-right">2. Kế Hoạch</th>
                    <th className="px-3.5 py-3.5 text-right">3. Thực Giao (PXK)</th>
                    <th className="px-3.5 py-3.5 text-right">Còn Lại</th>
                    <th className="px-3.5 py-3.5 text-center">Tiến Độ</th>
                    <th className="px-3.5 py-3.5 text-center">Trạng Thái</th>
                    <th className="px-3.5 py-3.5 text-right">Doanh Thu Đã Giao</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
                  {reconciliationData.map((row, idx) => (
                    <tr key={row.id} className="hover:bg-[#FBFBFD] transition">
                      <td className="px-3.5 py-3.5 text-center font-mono text-slate-400">
                        {idx + 1}
                      </td>
                      <td className="px-3.5 py-3.5">
                        <button
                          type="button"
                          onClick={() => onPoClick?.(row.poNum)}
                          className="font-mono font-bold text-blue-600 hover:text-blue-800 hover:underline block text-left"
                        >
                          {row.poNum}
                        </button>
                        <span className="text-[11px] text-slate-500 font-medium block truncate max-w-[140px]">
                          {row.customer}
                        </span>
                      </td>
                      <td className="px-3.5 py-3.5">
                        <p className="font-semibold text-slate-900 truncate" title={row.prodName}>
                          {row.prodName}
                        </p>
                        <span className="font-mono text-[10px] text-slate-400">
                          {row.prodCode || "---"} ({row.unit})
                        </span>
                      </td>
                      <td className="px-3.5 py-3.5 text-right font-mono font-bold text-slate-900">
                        {row.qtyOrdered.toLocaleString("vi-VN")}
                      </td>
                      <td className="px-3.5 py-3.5 text-right font-mono font-bold text-teal-700">
                        {row.qtyPlanned.toLocaleString("vi-VN")}
                        {row.plansCount > 0 && (
                          <span className="text-[9.5px] text-slate-400 block font-normal">({row.plansCount} đợt)</span>
                        )}
                      </td>
                      <td className="px-3.5 py-3.5 text-right font-mono font-bold text-emerald-700">
                        {row.qtyDelivered.toLocaleString("vi-VN")}
                        {row.deliveriesCount > 0 && (
                          <span className="text-[9.5px] text-slate-400 block font-normal">({row.deliveriesCount} PXK)</span>
                        )}
                      </td>
                      <td className="px-3.5 py-3.5 text-right font-mono font-bold text-amber-700">
                        {row.remaining.toLocaleString("vi-VN")}
                      </td>
                      <td className="px-3.5 py-3.5 text-center">
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
                      <td className="px-3.5 py-3.5 text-center">
                        {row.status === 'completed' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Khớp 100%
                          </span>
                        )}
                        {row.status === 'in_progress' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            Giao theo đợt
                          </span>
                        )}
                        {row.status === 'planned' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
                            Đã lập lịch
                          </span>
                        )}
                        {row.status === 'pending' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                            Chưa lên lịch
                          </span>
                        )}
                      </td>
                      <td className="px-3.5 py-3.5 text-right font-mono font-bold text-emerald-700">
                        {row.revenue > 0 ? `${row.revenue.toLocaleString("vi-VN")} đ` : "---"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
