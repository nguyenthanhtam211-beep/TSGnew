import fs from 'fs';
const content = `import React, { useState, useMemo } from 'react';
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
  const [planForm, setPlanForm] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);

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
      'Mã kế hoạch': \`KP-\${Date.now().toString().slice(-6)}\`,
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
      toast.error(\`Số lượng không được vượt quá \${planForm.maxQty.toLocaleString()}\`);
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
  
  const handleDelete = async (plan: any) => {
    if (window.confirm("Bạn có chắc muốn xóa kế hoạch này?")) {
      await onDeletePlan(plan);
    }
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
                    <button className={\`p-1.5 rounded-lg transition-colors \${expandedPOs.has(po.poNumber) ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-400'}\`}>
                      <ChevronRight className={\`transition-transform duration-200 \${expandedPOs.has(po.poNumber) ? 'rotate-90' : ''}\`} size={18} />
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
                        <div className="bg-emerald-500 h-full" style={{ width: \`\${Math.min(100, (po.totalDelivered / po.totalOrdered) * 100)}%\` }} />
                        <div className="bg-blue-400 h-full opacity-50" style={{ width: \`\${Math.min(100, ((po.totalPlanned - po.totalDelivered) / po.totalOrdered) * 100)}%\` }} />
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
                              <tr className={\`hover:bg-white transition-colors \${isFullyDelivered ? 'bg-emerald-50/20' : ''}\`}>
                                <td className="px-6 py-3">
                                  {line.plans.length > 0 && (
                                    <button 
                                      onClick={() => toggleLine(line.lineId)}
                                      className={\`p-1 rounded-md transition-colors \${expandedLines.has(line.lineId) ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-200 text-gray-400'}\`}
                                    >
                                      <ChevronRight className={\`transition-transform duration-200 \${expandedLines.has(line.lineId) ? 'rotate-90' : ''}\`} size={14} />
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
                                    <span className={\`font-bold \${line.qtyRemainingToDeliver > 0 ? 'text-amber-600' : 'text-gray-400'}\`}>
                                      {line.qtyRemainingToDeliver.toLocaleString()}
                                    </span>
                                    {!isFullyPlanned && (
                                      <button 
                                        onClick={() => handleOpenAddPlan(line, po.poNumber, po.customer)}
                                        className="text-[10px] uppercase tracking-wider font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-2 py-1 rounded border border-blue-100 flex items-center gap-1"
                                      >
                                        <Plus size={10} />
                                        Thêm KH
                                      </button>
                                    )}
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
                                        <table className="w-full text-xs">
                                          <thead className="bg-blue-50/50 text-blue-800 font-bold border-b border-blue-100">
                                            <tr>
                                              <th className="px-4 py-2">Mã Kế Hoạch</th>
                                              <th className="px-4 py-2">Ngày Dự Kiến</th>
                                              <th className="px-4 py-2 text-right">SL Giao Dự Kiến</th>
                                              <th className="px-4 py-2 text-center">Trạng Thái (Dự theo thực tế)</th>
                                              <th className="px-4 py-2 text-right">Thao Tác</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-blue-50">
                                            {line.plans.map((p: any) => (
                                              <tr key={p.id || p['Mã kế hoạch']} className="hover:bg-blue-50/30">
                                                <td className="px-4 py-2 font-mono font-bold text-gray-700">{p['Mã kế hoạch']}</td>
                                                <td className="px-4 py-2 text-gray-600 font-medium">{p['Ngày dự kiến']}</td>
                                                <td className="px-4 py-2 text-right font-bold text-blue-700">{parseNumber(p['Số lượng cần giao']).toLocaleString()}</td>
                                                <td className="px-4 py-2 text-center">
                                                  <span className={\`px-2 py-0.5 rounded-md font-bold text-[10px] border \${
                                                    p.status === 'Hoàn thành' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                                                    p.status === 'Đang giao' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                    'bg-blue-50 text-blue-700 border-blue-200'
                                                  }\`}>
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
                                                    <button 
                                                      onClick={() => handleDelete(p)}
                                                      className="text-gray-400 hover:text-red-600 transition-colors"
                                                      title="Xóa"
                                                    >
                                                      <Trash2 size={14} />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
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
    </div>
  );
}
`

fs.writeFileSync('src/components/DeliveryPlanView.tsx', content);
