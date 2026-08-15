import React, { useState, useMemo } from 'react';
import { 
  Calendar, 
  Package, 
  Users, 
  Search, 
  ChevronRight, 
  Edit2,
  Trash2,
  CheckCircle,
  X,
  Plus
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';

interface DeliveryPlanViewProps {
  deliveryPlans: any[];
  poLines: any[];
  poHeaders: any[];
  deliveries: any[];
  products: any[];
  pricingData?: any[];
  onAddPlan: (plan: any) => Promise<void>;
  onUpdatePlan: (plan: any) => Promise<void>;
  onDeletePlan: (row: any) => Promise<void>;
  onPoClick?: (poNumber: string) => void;
  onProductClick?: (productId: string) => void;
}

const parseNumber = (val: any): number => {
  if (val == null) return 0;
  if (typeof val === 'number') return val;
  const cleaned = String(val).replace(/,/g, '').trim();
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
};

export default function DeliveryPlanView({
  deliveryPlans,
  poLines,
  poHeaders,
  deliveries,
  onAddPlan,
  onUpdatePlan,
  onDeletePlan
}: DeliveryPlanViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedPOs, setExpandedPOs] = useState<Set<string>>(new Set());
  const [expandedLines, setExpandedLines] = useState<Set<string>>(new Set());
  
  // Modal states
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [selectedPlans, setSelectedPlans] = useState<Set<string>>(new Set());
  const [planForm, setPlanForm] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Multi-batch split modal state
  const [isMultiModalOpen, setIsMultiModalOpen] = useState(false);
  const [multiBatchData, setMultiBatchData] = useState<{
    poNumber: string;
    customer: string;
    prodName: string;
    totalQtyToPlan: number;
    batches: { date: string; qty: number }[];
  } | null>(null);

  const handleOpenMultiBatch = (line: any, poNumber: string, customer: string) => {
    const prodName = line['Tên sản phẩm'] || line['Mã hàng'];
    const remaining = line.qtyRemainingToPlan > 0 ? line.qtyRemainingToPlan : line.qtyOrdered;
    const half1 = Math.ceil(remaining / 2);
    const half2 = remaining - half1;
    
    // Default 2 batches: 1 week from now, 2 weeks from now
    const today = new Date();
    const d1 = new Date(today);
    d1.setDate(d1.getDate() + 7);
    const d2 = new Date(today);
    d2.setDate(d2.getDate() + 14);

    const fmtDate = (d: Date) => {
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    };

    setMultiBatchData({
      poNumber,
      customer,
      prodName,
      totalQtyToPlan: remaining,
      batches: [
        { date: fmtDate(d1), qty: half1 },
        { date: fmtDate(d2), qty: half2 }
      ]
    });
    setIsMultiModalOpen(true);
  };

  const handleSaveMultiBatch = async () => {
    if (!multiBatchData) return;
    const { poNumber, customer, prodName, batches } = multiBatchData;

    toast.loading("Đang tạo các đợt giao hàng...", { id: "multi-batch" });
    try {
      for (let i = 0; i < batches.length; i++) {
        const b = batches[i];
        if (!b.qty || b.qty <= 0) continue;
        const planCode = `KH-${poNumber}-${Date.now().toString().slice(-4)}-Đ${i + 1}`;
        await onAddPlan({
          'Mã kế hoạch': planCode,
          'Đơn hàng': poNumber,
          'Khách hàng': customer,
          'Sản phẩm': prodName,
          'Ngày dự kiến': b.date,
          'Số lượng cần giao': b.qty,
          'Trạng thái': 'Chờ giao',
          'Tạo lúc': new Date().toISOString()
        });
      }
      toast.success(`Đã tạo thành công ${batches.length} đợt giao hàng!`, { id: "multi-batch" });
      setIsMultiModalOpen(false);
    } catch (error) {
      toast.error("Có lỗi khi tạo kế hoạch nhiều đợt", { id: "multi-batch" });
    }
  };

  // 1. Enrich PO Lines with planning and delivery progress
  const enrichedPOs = useMemo(() => {
    // Map active PO lines
    const activePOLines = poLines.filter(line => !line.isDeleted);
    
    // Group by PO
    const poGroups = new Map<string, any>();
    
    activePOLines.forEach(line => {
      const poNum = line['Số đơn hàng'] || line['Đơn hàng'];
      const prodName = line['Tên sản phẩm'] || line['Mã hàng'];
      if (!poNum) return;
      
      if (!poGroups.has(poNum)) {
        const header = poHeaders.find(h => h['Số đơn hàng'] === poNum || h['Đơn hàng'] === poNum);
        poGroups.set(poNum, {
          poNumber: poNum,
          customer: line['Khách hàng'] || header?.['Khách hàng'] || 'Unknown',
          date: header?.['Ngày đặt hàng'] || '',
          lines: [],
          totalOrdered: 0,
          totalPlanned: 0,
          totalDelivered: 0,
        });
      }
      
      const group = poGroups.get(poNum);
      
      // Calculate for this line
      const qtyOrdered = parseNumber(line['Số lượng']);
      
      // Match plans
      const linePlans = deliveryPlans.filter(p => !p.isDeleted && p['Đơn hàng'] === poNum && p['Sản phẩm'] === prodName);
      const qtyPlanned = linePlans.reduce((sum, p) => sum + parseNumber(p['Số lượng cần giao']), 0);
      
      // Match deliveries (Delivery could match by PO + Product)
      const lineDeliveries = deliveries.filter(d => !d.isDeleted && d['Đơn hàng'] === poNum && (d['Tên sản phẩm'] === prodName || d['Mã sản phẩm'] === line['Mã hàng']));
      const qtyDelivered = lineDeliveries.reduce((sum, d) => sum + parseNumber(d['Số lượng giao']), 0);
      
      const lineObj = {
        ...line,
        lineId: line.id || line['STT'], // Ensure unique ID for toggling
        qtyOrdered,
        qtyPlanned,
        qtyDelivered,
        qtyRemainingToPlan: Math.max(0, qtyOrdered - qtyPlanned),
        qtyRemainingToDeliver: Math.max(0, qtyOrdered - qtyDelivered),
        plans: linePlans.map(p => {
          // Determine status based on actual deliveries vs plan
          let status = 'Mới';
          if (qtyDelivered >= qtyPlanned && qtyPlanned > 0) status = 'Hoàn thành';
          else if (qtyDelivered > 0) status = 'Đang giao';
          return { ...p, status };
        }).sort((a, b) => {
           // sort by date
           const dateA = a['Ngày dự kiến'] ? a['Ngày dự kiến'].split('/').reverse().join('') : '';
           const dateB = b['Ngày dự kiến'] ? b['Ngày dự kiến'].split('/').reverse().join('') : '';
           return dateA.localeCompare(dateB);
        })
      };
      
      group.lines.push(lineObj);
      group.totalOrdered += qtyOrdered;
      group.totalPlanned += qtyPlanned;
      group.totalDelivered += qtyDelivered;
    });
    
    // Convert to array and filter
    const searchLow = searchTerm.toLowerCase();
    return Array.from(poGroups.values())
      .filter(g => 
        g.poNumber.toLowerCase().includes(searchLow) || 
        g.customer.toLowerCase().includes(searchLow)
      )
      .sort((a, b) => {
        // sort by newest PO first (assuming date format is DD/MM/YYYY)
        const dateA = a.date ? a.date.split('/').reverse().join('') : '';
        const dateB = b.date ? b.date.split('/').reverse().join('') : '';
        return dateB.localeCompare(dateA);
      });
  }, [poLines, poHeaders, deliveryPlans, deliveries, searchTerm]);

  const togglePO = (poNum: string) => {
    const next = new Set(expandedPOs);
    if (next.has(poNum)) next.delete(poNum);
    else next.add(poNum);
    setExpandedPOs(next);
  };
  
  const toggleLine = (lineId: string) => {
    const next = new Set(expandedLines);
    if (next.has(lineId)) next.delete(lineId);
    else next.add(lineId);
    setExpandedLines(next);
  };

  const handleOpenAddPlan = (line: any, poNum: string, customer: string) => {
    if (line.qtyRemainingToPlan <= 0) {
      toast.error('Chi tiết đơn hàng này đã được lên kế hoạch đủ số lượng.');
      return;
    }
    
    setPlanForm({
      'Mã kế hoạch': `KP-${Date.now().toString().slice(-6)}`,
      'Đơn hàng': poNum,
      'Sản phẩm': line['Tên sản phẩm'] || line['Mã hàng'],
      'Khách hàng': customer,
      'Ngày dự kiến': format(new Date(), 'dd/MM/yyyy'),
      'Số lượng cần giao': line.qtyRemainingToPlan,
      'Trạng thái': 'Mới',
      // Internal tracking
      lineId: line.lineId,
      maxQty: line.qtyRemainingToPlan
    });
    setIsEditing(false);
    setIsPlanModalOpen(true);
  };

  const handleOpenEditPlan = (plan: any, line: any) => {
    setPlanForm({
      ...plan,
      lineId: line.lineId,
      maxQty: line.qtyRemainingToPlan + parseNumber(plan['Số lượng cần giao']) // can edit up to remaining + current
    });
    setIsEditing(true);
    setIsPlanModalOpen(true);
  };

  const handleSavePlan = async () => {
    if (!planForm['Ngày dự kiến'] || planForm['Số lượng cần giao'] <= 0) {
      toast.error('Vui lòng nhập ngày dự kiến và số lượng hợp lệ.');
      return;
    }
    if (planForm['Số lượng cần giao'] > planForm.maxQty) {
      toast.error(`Số lượng không được vượt quá ${planForm.maxQty.toLocaleString()}`);
      return;
    }
    
    // Clean internal fields
    const { lineId, maxQty, status, ...planData } = planForm;
    planData['Trạng thái'] = 'Mới';
    
    if (isEditing) {
      await onUpdatePlan(planData);
    } else {
      await onAddPlan(planData);
    }
    setIsPlanModalOpen(false);
  };
  
  const handleToggleSelectPlan = (planId: string) => {
    const next = new Set(selectedPlans);
    if (next.has(planId)) next.delete(planId);
    else next.add(planId);
    setSelectedPlans(next);
  };

  const handleDeleteSelected = async () => {
    const plansToDelete = enrichedPOs
      .flatMap(po => po.lines)
      .flatMap(line => line.plans || [])
      .filter(p => selectedPlans.has(p.id || p['Mã kế hoạch']));
      
    if (plansToDelete.length === 0) {
      toast.error("Không tìm thấy kế hoạch để xóa");
      return;
    }
    
    toast.loading("Đang xóa...", { id: "delete-plans" });
    try {
      await Promise.all(plansToDelete.map(plan => onDeletePlan(plan)));
      setSelectedPlans(new Set());
      toast.success(`Đã xóa thành công ${plansToDelete.length} kế hoạch`, { id: "delete-plans" });
    } catch (error) {
      toast.error("Có lỗi khi xóa", { id: "delete-plans" });
    }
  };

  const handleDelete = async (plan: any) => {
    await onDeletePlan(plan);
  };

  return (
    <div className="flex flex-col h-full bg-gray-50/50">
      <div className="flex-none px-8 py-6 bg-white border-b border-gray-100 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Calendar className="text-blue-600" size={28} />
            Kế Hoạch Giao Hàng
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Lập kế hoạch từ Đơn hàng (PO) đảm bảo 100% khớp với số lượng thực tế.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text"
              placeholder="Tìm Đơn hàng, khách hàng..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-64 transition-all"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          {enrichedPOs.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border border-gray-100 shadow-sm">
              <Package className="mx-auto h-12 w-12 text-gray-300 mb-4" />
              <h3 className="text-lg font-bold text-gray-900 mb-1">Không có dữ liệu</h3>
              <p className="text-gray-500">Chưa có đơn hàng nào hoặc không tìm thấy kết quả.</p>
            </div>
          ) : (
            enrichedPOs.map(po => (
              <div key={po.poNumber} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden transition-all hover:border-blue-200">
                {/* PO Header */}
                <div 
                  className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => togglePO(po.poNumber)}
                >
                  <div className="flex items-center gap-4">
                    <button className={`p-1.5 rounded-lg transition-colors ${expandedPOs.has(po.poNumber) ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-400'}`}>
                      <ChevronRight className={`transition-transform duration-200 ${expandedPOs.has(po.poNumber) ? 'rotate-90' : ''}`} size={18} />
                    </button>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-gray-900 text-lg">PO: {po.poNumber}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-600 border border-gray-200">
                          {po.date}
                        </span>
                      </div>
                      <div className="text-sm font-medium text-gray-500 mt-0.5 flex items-center gap-1.5">
                        <Users size={14} />
                        {po.customer}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-8">
                    {/* PO Progress */}
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-3 text-sm">
                        <span className="text-gray-500">Đặt: <strong className="text-gray-900">{po.totalOrdered.toLocaleString()}</strong></span>
                        <span className="text-blue-600">Kế hoạch: <strong>{po.totalPlanned.toLocaleString()}</strong></span>
                        <span className="text-emerald-600">Đã giao: <strong>{po.totalDelivered.toLocaleString()}</strong></span>
                      </div>
                      <div className="w-48 h-1.5 bg-gray-100 rounded-full overflow-hidden flex">
                        <div className="bg-emerald-500 h-full" style={{ width: `${Math.min(100, (po.totalDelivered / po.totalOrdered) * 100)}%` }} />
                        <div className="bg-blue-400 h-full opacity-50" style={{ width: `${Math.min(100, ((po.totalPlanned - po.totalDelivered) / po.totalOrdered) * 100)}%` }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* PO Lines & Plans */}
                {expandedPOs.has(po.poNumber) && (
                  <div className="border-t border-gray-100 bg-gray-50/30">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-gray-50/80 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                        <tr>
                          <th className="px-6 py-3 w-8"></th>
                          <th className="px-4 py-3">Sản phẩm</th>
                          <th className="px-4 py-3 text-right">SL Đặt</th>
                          <th className="px-4 py-3 text-right">Đã Lên KH</th>
                          <th className="px-4 py-3 text-right">Đã Giao</th>
                          <th className="px-4 py-3 text-right">Còn Lại (Cần Giao)</th>
                          <th className="px-6 py-3 text-center">Tiến độ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {po.lines.map((line: any) => {
                          const isFullyPlanned = line.qtyRemainingToPlan <= 0;
                          const isFullyDelivered = line.qtyRemainingToDeliver <= 0;
                          
                          return (
                            <React.Fragment key={line.lineId}>
                              {/* PO Line Row */}
                              <tr className={`hover:bg-white transition-colors ${isFullyDelivered ? 'bg-emerald-50/20' : ''}`}>
                                <td className="px-6 py-3">
                                  {line.plans.length > 0 && (
                                    <button 
                                      onClick={() => toggleLine(line.lineId)}
                                      className={`p-1 rounded-md transition-colors ${expandedLines.has(line.lineId) ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-200 text-gray-400'}`}
                                    >
                                      <ChevronRight className={`transition-transform duration-200 ${expandedLines.has(line.lineId) ? 'rotate-90' : ''}`} size={14} />
                                    </button>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  <div className="font-medium text-gray-900">{line['Tên sản phẩm'] || line['Mã hàng']}</div>
                                  <div className="text-xs text-gray-500">ĐVT: {line['ĐVT']}</div>
                                </td>
                                <td className="px-4 py-3 text-right font-bold text-gray-900">{line.qtyOrdered.toLocaleString()}</td>
                                <td className="px-4 py-3 text-right font-medium text-blue-600">{line.qtyPlanned.toLocaleString()}</td>
                                <td className="px-4 py-3 text-right font-medium text-emerald-600">{line.qtyDelivered.toLocaleString()}</td>
                                <td className="px-4 py-3 text-right">
                                  <div className="flex flex-col items-end gap-1">
                                    <span className={`font-bold ${line.qtyRemainingToDeliver > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                                      {line.qtyRemainingToDeliver.toLocaleString()}
                                    </span>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                      {!isFullyPlanned && (
                                        <button 
                                          onClick={() => handleOpenAddPlan(line, po.poNumber, po.customer)}
                                          className="text-[10px] uppercase tracking-wider font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded border border-blue-200 flex items-center gap-1 transition-colors"
                                          title="Thêm 1 đợt giao hàng"
                                        >
                                          <Plus size={10} />
                                          Thêm KH
                                        </button>
                                      )}
                                      <button 
                                        onClick={() => handleOpenMultiBatch(line, po.poNumber, po.customer)}
                                        className="text-[10px] uppercase tracking-wider font-bold text-indigo-700 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded border border-indigo-200 flex items-center gap-1 transition-colors"
                                        title="Chia đơn hàng thành nhiều đợt giao"
                                      >
                                        <Calendar size={10} />
                                        Chia nhiều đợt
                                      </button>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-3">
                                  <div className="flex items-center justify-center">
                                    {isFullyDelivered ? (
                                      <CheckCircle className="text-emerald-500" size={20} />
                                    ) : (
                                      <div className="text-xs font-bold text-gray-400">
                                        {line.qtyOrdered > 0 ? Math.round((line.qtyDelivered / line.qtyOrdered) * 100) : 0}%
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>

                              {/* Nested Plans for this line */}
                              {expandedLines.has(line.lineId) && line.plans.length > 0 && (
                                <tr>
                                  <td colSpan={7} className="p-0 border-b border-gray-100 bg-blue-50/20">
                                    <div className="px-14 py-3">
                                      <div className="bg-white rounded-xl border border-blue-100 shadow-sm overflow-hidden">
                                        <div className="flex justify-between items-center px-4 py-2 border-b border-blue-100 bg-blue-50/50">
                                          <span className="font-bold text-blue-800 text-xs uppercase tracking-wider">Danh sách Kế hoạch</span>
                                          {selectedPlans.size > 0 && (
                                            <button 
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteSelected();
                                              }}
                                              className="bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1 rounded border border-red-200 font-bold text-xs transition-colors"
                                            >
                                              Xóa {selectedPlans.size} mục đã chọn
                                            </button>
                                          )}
                                        </div>
                                        <table className="w-full text-xs">
                                          <thead className="bg-blue-50/50 text-blue-800 font-bold border-b border-blue-100">
                                            <tr>
                                              <th className="px-4 py-2 w-10 text-center">Chọn</th>
                                              <th className="px-4 py-2">Mã Kế hoạch</th>
                                              <th className="px-4 py-2">Ngày Dự Kiến</th>
                                              <th className="px-4 py-2 text-right">SL Giao Dự Kiến</th>
                                              <th className="px-4 py-2 text-center">Trạng Thái (Dự theo thực tế)</th>
                                              <th className="px-4 py-2 text-right">Thao Tác</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-blue-50">
                                            {line.plans.map((p: any) => (
                                              <tr key={p.id || p['Mã kế hoạch']} className="hover:bg-blue-50/30">
                                                <td className="px-4 py-2 text-center">
                                                  <input 
                                                    type="checkbox" 
                                                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                                                    checked={selectedPlans.has(p.id || p['Mã kế hoạch'])}
                                                    onChange={() => handleToggleSelectPlan(p.id || p['Mã kế hoạch'])}
                                                  />
                                                </td>
                                                <td className="px-4 py-2 font-mono font-bold text-gray-700">{p['Mã kế hoạch']}</td>
                                                <td className="px-4 py-2 text-gray-600 font-medium">{p['Ngày dự kiến']}</td>
                                                <td className="px-4 py-2 text-right font-bold text-blue-700">{parseNumber(p['Số lượng cần giao']).toLocaleString()}</td>
                                                <td className="px-4 py-2 text-center">
                                                  <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] border ${
                                                    p.status === 'Hoàn thành' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                                                    p.status === 'Đang giao' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                    'bg-blue-50 text-blue-700 border-blue-200'
                                                  }`}>
                                                    {p.status}
                                                  </span>
                                                </td>
                                                <td className="px-4 py-2">
                                                  <div className="flex items-center justify-end gap-2">
                                                    <button 
                                                      onClick={() => handleOpenEditPlan(p, line)}
                                                      className="text-gray-400 hover:text-blue-600 transition-colors"
                                                      title="Sửa"
                                                    >
                                                      <Edit2 size={14} />
                                                    </button>
                                                  </div>
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Plan Modal */}
      {isPlanModalOpen && planForm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                {isEditing ? 'Chỉnh Sửa Kế Hoạch' : 'Thêm Kế Hoạch Mới'}
              </h3>
              <button onClick={() => setIsPlanModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="bg-blue-50 rounded-xl p-3 border border-blue-100 space-y-1 mb-2">
                <div className="text-xs text-blue-600 font-bold uppercase tracking-wider">Đơn hàng: {planForm['Đơn hàng']}</div>
                <div className="text-sm font-medium text-gray-800">{planForm['Sản phẩm']}</div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Mã Kế Hoạch</label>
                <input 
                  type="text" 
                  readOnly
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-mono text-gray-500 outline-none"
                  value={planForm['Mã kế hoạch']}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Ngày Dự Kiến Giao</label>
                <input 
                  type="date" 
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 font-medium text-gray-900"
                  value={planForm['Ngày dự kiến'] ? planForm['Ngày dự kiến'].split('/').reverse().join('-') : ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setPlanForm({
                      ...planForm,
                      'Ngày dự kiến': val ? val.split('-').reverse().join('/') : ''
                    })
                  }}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 flex justify-between">
                  <span>Số Lượng Giao</span>
                  <span className="text-blue-600 font-medium">Tối đa: {planForm.maxQty.toLocaleString()}</span>
                </label>
                <input 
                  type="number" 
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-lg font-bold outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  value={planForm['Số lượng cần giao'] || ''}
                  onChange={(e) => setPlanForm({ ...planForm, 'Số lượng cần giao': parseInt(e.target.value) || 0 })}
                  max={planForm.maxQty}
                  min={1}
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 bg-gray-50/50">
              <button 
                onClick={() => setIsPlanModalOpen(false)}
                className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-100 transition-all"
              >
                Hủy
              </button>
              <button 
                onClick={handleSavePlan}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-md shadow-blue-100 transition-all"
              >
                Lưu Kế Hoạch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Multi-Batch Delivery Planning Modal */}
      {isMultiModalOpen && multiBatchData && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-indigo-50/60">
              <div>
                <h3 className="font-bold text-indigo-950 text-base flex items-center gap-2">
                  <Calendar className="text-indigo-600" size={20} />
                  Chia Đơn Hàng Thành Nhiều Đợt Giao
                </h3>
                <p className="text-xs text-indigo-700 mt-0.5">PO: {multiBatchData.poNumber} — {multiBatchData.prodName}</p>
              </div>
              <button onClick={() => setIsMultiModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-200 flex justify-between items-center text-xs">
                <span className="text-gray-600 font-medium">Tổng số lượng cần lập KH:</span>
                <span className="font-bold text-gray-900 text-sm">{multiBatchData.totalQtyToPlan.toLocaleString()}</span>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Danh Sách Các Đợt Giao</label>
                  <button 
                    type="button"
                    onClick={() => {
                      const newBatches = [...multiBatchData.batches];
                      const lastBatch = newBatches[newBatches.length - 1];
                      newBatches.push({ date: lastBatch ? lastBatch.date : '01/08/2026', qty: 0 });
                      setMultiBatchData({ ...multiBatchData, batches: newBatches });
                    }}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200 flex items-center gap-1"
                  >
                    <Plus size={12} /> Thêm Đợt
                  </button>
                </div>

                {multiBatchData.batches.map((b, idx) => (
                  <div key={idx} className="p-3 bg-indigo-50/30 rounded-xl border border-indigo-100 flex items-center gap-3">
                    <div className="w-16 font-bold text-xs text-indigo-900 bg-indigo-100/80 px-2 py-1.5 rounded-lg text-center shrink-0">
                      Đợt {idx + 1}
                    </div>
                    <div className="flex-1">
                      <label className="block text-[10px] font-bold text-gray-500 mb-0.5">Ngày Dự Kiến Giao</label>
                      <input 
                        type="date"
                        className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-gray-900 bg-white"
                        value={b.date ? b.date.split('/').reverse().join('-') : ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          const formatted = val ? val.split('-').reverse().join('/') : '';
                          const next = [...multiBatchData.batches];
                          next[idx].date = formatted;
                          setMultiBatchData({ ...multiBatchData, batches: next });
                        }}
                      />
                    </div>
                    <div className="w-28">
                      <label className="block text-[10px] font-bold text-gray-500 mb-0.5">Số Lượng</label>
                      <input 
                        type="number"
                        className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 bg-white"
                        value={b.qty || ''}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          const next = [...multiBatchData.batches];
                          next[idx].qty = val;
                          setMultiBatchData({ ...multiBatchData, batches: next });
                        }}
                      />
                    </div>
                    {multiBatchData.batches.length > 1 && (
                      <button 
                        type="button"
                        onClick={() => {
                          const next = multiBatchData.batches.filter((_, i) => i !== idx);
                          setMultiBatchData({ ...multiBatchData, batches: next });
                        }}
                        className="text-gray-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                        title="Xóa đợt này"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}

                {/* Total check */}
                {(() => {
                  const currentSum = multiBatchData.batches.reduce((sum, b) => sum + (b.qty || 0), 0);
                  const diff = multiBatchData.totalQtyToPlan - currentSum;
                  return (
                    <div className={`p-2.5 rounded-xl text-xs font-bold flex justify-between items-center ${
                      diff === 0 ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-amber-50 text-amber-800 border border-amber-200'
                    }`}>
                      <span>Tổng các đợt đã phân chia: {currentSum.toLocaleString()}</span>
                      <span>{diff === 0 ? '✓ Đã khớp 100%' : `Còn lại: ${diff.toLocaleString()}`}</span>
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 bg-gray-50/50">
              <button 
                onClick={() => setIsMultiModalOpen(false)}
                className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-100 transition-all text-xs uppercase tracking-wider"
              >
                Hủy
              </button>
              <button 
                onClick={handleSaveMultiBatch}
                className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-md shadow-indigo-100 transition-all text-xs uppercase tracking-wider flex items-center justify-center gap-1.5"
              >
                <CheckCircle size={16} />
                Lưu Các Đợt Giao
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
