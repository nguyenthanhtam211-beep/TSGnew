import React, { useState, useMemo } from 'react';
import { 
  Percent, Plus, Search, Filter, Calendar, CheckCircle2, Clock, 
  AlertCircle, DollarSign, Download, Eye, Edit3, Trash2, UserCheck,
  Building2, ArrowUpRight, ArrowDownRight, Wallet, Receipt, CreditCard,
  ChevronRight, Tag
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import clsx from 'clsx';
import MacTrafficLights from './MacTrafficLights';
import { formatVND, parseNumber, formatDateForDisplay, parseDateToISO } from '../lib/business-logic';
import CompanyLogo from './CompanyLogo';

export interface CommissionItem {
  id?: string;
  type: 'Theo đơn hàng' | 'Theo tháng';
  customerName: string;
  beneficiaryName: string; // Tên người nhận hoa hồng (từ danh bạ/khách hàng)
  beneficiaryPhone?: string;
  beneficiaryBank?: string; // STK & Ngân hàng nhận
  poNumber?: string; // Số PO nếu chi theo PO
  period?: string; // Tháng/Kỳ (YYYY-MM) nếu chi theo tháng
  calculationType: 'percentage' | 'fixed_amount';
  rate?: number; // Tỷ lệ % (e.g. 2.5%)
  baseRevenue: number; // Doanh thu làm căn cứ tính hoa hồng
  commissionAmount: number; // Tiền hoa hồng thực nhận
  paymentStatus: 'Chờ duyệt' | 'Đã duyệt' | 'Đã thanh toán';
  paymentDate?: string;
  paidBy?: string;
  notes?: string;
  createdAt?: string;
}

interface CommissionViewProps {
  commissionData?: CommissionItem[];
  customerData?: any[];
  contactData?: any[];
  poHeaderData?: any[];
  onAddCommission?: (item: CommissionItem) => Promise<void>;
  onUpdateCommission?: (item: CommissionItem) => Promise<void>;
  onDeleteCommission?: (item: CommissionItem) => Promise<void>;
}

export default function CommissionView({
  commissionData = [],
  customerData = [],
  contactData = [],
  poHeaderData = [],
  onAddCommission,
  onUpdateCommission,
  onDeleteCommission
}: CommissionViewProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'by_po' | 'by_month' | 'paid' | 'pending'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCommission, setSelectedCommission] = useState<CommissionItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCommission, setEditingCommission] = useState<CommissionItem | null>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<CommissionItem>>({
    type: 'Theo đơn hàng',
    customerName: '',
    beneficiaryName: '',
    beneficiaryPhone: '',
    beneficiaryBank: '',
    poNumber: '',
    period: new Date().toISOString().substring(0, 7), // YYYY-MM
    calculationType: 'percentage',
    rate: 3, // 3% default
    baseRevenue: 0,
    commissionAmount: 0,
    paymentStatus: 'Chờ duyệt',
    paymentDate: new Date().toISOString().split('T')[0],
    notes: ''
  });

  // Filtered List
  const filteredCommissions = useMemo(() => {
    return commissionData.filter(c => {
      if (activeTab === 'by_po' && c.type !== 'Theo đơn hàng') return false;
      if (activeTab === 'by_month' && c.type !== 'Theo tháng') return false;
      if (activeTab === 'paid' && c.paymentStatus !== 'Đã thanh toán') return false;
      if (activeTab === 'pending' && c.paymentStatus === 'Đã thanh toán') return false;

      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        (c.customerName || '').toLowerCase().includes(query) ||
        (c.beneficiaryName || '').toLowerCase().includes(query) ||
        (c.poNumber || '').toLowerCase().includes(query) ||
        (c.notes || '').toLowerCase().includes(query)
      );
    });
  }, [commissionData, activeTab, searchQuery]);

  // Financial Stats
  const stats = useMemo(() => {
    const total = commissionData.length;
    const totalAmount = commissionData.reduce((sum, c) => sum + (parseNumber(c.commissionAmount) || 0), 0);
    const paidAmount = commissionData
      .filter(c => c.paymentStatus === 'Đã thanh toán')
      .reduce((sum, c) => sum + (parseNumber(c.commissionAmount) || 0), 0);
    const pendingAmount = totalAmount - paidAmount;

    return { total, totalAmount, paidAmount, pendingAmount };
  }, [commissionData]);

  // Open Create Modal
  const handleOpenAdd = () => {
    setEditingCommission(null);
    const firstCust = customerData[0]?.['Tên khách hàng'] || customerData[0]?.['Khách hàng'] || '';
    setFormData({
      type: 'Theo đơn hàng',
      customerName: firstCust,
      beneficiaryName: '',
      beneficiaryPhone: '',
      beneficiaryBank: '',
      poNumber: poHeaderData[0]?.['Đơn hàng'] || poHeaderData[0]?.['Số đơn hàng'] || '',
      period: new Date().toISOString().substring(0, 7),
      calculationType: 'percentage',
      rate: 3,
      baseRevenue: parseNumber(poHeaderData[0]?.['Tổng giá trị đơn hàng']) || 100000000,
      commissionAmount: (parseNumber(poHeaderData[0]?.['Tổng giá trị đơn hàng']) || 100000000) * 0.03,
      paymentStatus: 'Chờ duyệt',
      paymentDate: new Date().toISOString().split('T')[0],
      notes: 'Hoa hồng trích thưởng phát triển doanh số khách hàng'
    });
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (item: CommissionItem) => {
    setEditingCommission(item);
    setFormData({
      ...item,
      paymentDate: parseDateToISO(item.paymentDate)
    });
    setIsModalOpen(true);
  };

  // Handle calculation updates
  const handleRecalculate = (updates: Partial<CommissionItem>) => {
    const next = { ...formData, ...updates };
    let comm = parseNumber(next.commissionAmount);

    if (next.calculationType === 'percentage') {
      const base = parseNumber(next.baseRevenue);
      const r = parseNumber(next.rate);
      comm = Math.round((base * r) / 100);
    }

    setFormData({
      ...next,
      commissionAmount: comm
    });
  };

  // Select PO to auto-populate revenue
  const handleSelectPO = (poNum: string) => {
    const matchedPO = poHeaderData.find(p => p['Đơn hàng'] === poNum || p['Số đơn hàng'] === poNum);
    const base = matchedPO ? parseNumber(matchedPO['Tổng giá trị đơn hàng']) : parseNumber(formData.baseRevenue);
    const cust = matchedPO ? (matchedPO['Khách hàng'] || formData.customerName) : formData.customerName;

    handleRecalculate({
      poNumber: poNum,
      customerName: cust,
      baseRevenue: base
    });
  };

  // Select beneficiary from contacts
  const handleSelectBeneficiary = (contactName: string) => {
    const matchedContact = contactData.find(c => (c['Họ và tên'] || c['Tên']) === contactName);
    setFormData(prev => ({
      ...prev,
      beneficiaryName: contactName,
      beneficiaryPhone: matchedContact ? (matchedContact['Số điện thoại'] || matchedContact['Điện thoại'] || prev.beneficiaryPhone) : prev.beneficiaryPhone,
      customerName: matchedContact?.['Công ty'] || prev.customerName
    }));
  };

  // Save Commission
  const handleSaveCommission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customerName || !formData.beneficiaryName) {
      toast.error('Vui lòng nhập Khách hàng và Người nhận hoa hồng!');
      return;
    }

    try {
      const payload: CommissionItem = {
        ...formData,
        id: editingCommission?.id || `comm_${Date.now()}`,
        type: formData.type || 'Theo đơn hàng',
        customerName: formData.customerName || '',
        beneficiaryName: formData.beneficiaryName || '',
        beneficiaryPhone: formData.beneficiaryPhone || '',
        beneficiaryBank: formData.beneficiaryBank || '',
        poNumber: formData.type === 'Theo đơn hàng' ? (formData.poNumber || '') : '',
        period: formData.type === 'Theo tháng' ? (formData.period || '') : '',
        calculationType: formData.calculationType || 'percentage',
        rate: parseNumber(formData.rate),
        baseRevenue: parseNumber(formData.baseRevenue),
        commissionAmount: parseNumber(formData.commissionAmount),
        paymentStatus: formData.paymentStatus || 'Chờ duyệt',
        paymentDate: formData.paymentDate || new Date().toISOString().split('T')[0],
        notes: formData.notes || '',
        createdAt: editingCommission?.createdAt || new Date().toISOString()
      };

      if (editingCommission && onUpdateCommission) {
        await onUpdateCommission(payload);
        toast.success('Đã cập nhật Phiếu Hoa hồng!');
      } else if (onAddCommission) {
        await onAddCommission(payload);
        toast.success('Đã lập Phiếu Hoa hồng thành công!');
      }

      setIsModalOpen(false);
    } catch (err: any) {
      console.error('Save commission error:', err);
      toast.error('Lỗi khi lưu phiếu hoa hồng!');
    }
  };

  // Delete
  const handleDelete = async (item: CommissionItem) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa phiếu hoa hồng cho ${item.beneficiaryName}?`)) {
      if (onDeleteCommission) {
        await onDeleteCommission(item);
        toast.success('Đã xóa phiếu hoa hồng!');
        if (selectedCommission?.id === item.id) setSelectedCommission(null);
      }
    }
  };

  return (
    <div className="flex-1 bg-[#F5F5F7] flex flex-col h-full overflow-hidden">
      {/* Top Header */}
      <div className="bg-white/80 backdrop-blur-md border-b border-black/[0.06] px-8 py-5 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 text-xs font-bold uppercase tracking-wider">
              Tài chính & Chiết khấu
            </span>
            <h1 className="text-xl font-bold text-[#1D1D1F] tracking-tight">Quản Lý Hoa Hồng (Commission)</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Quản lý chi phí hoa hồng theo Đơn hàng (PO) hoặc theo Tháng cho người liên hệ khách hàng & đối chiếu lợi nhuận ròng
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-4 py-2 bg-[#007AFF] hover:bg-[#0062CC] text-white rounded-xl text-xs font-bold shadow-sm shadow-blue-500/20 active:scale-95 transition-all"
          >
            <Plus size={16} />
            Lập Phiếu Hoa Hồng
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="px-8 py-4 grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-black/[0.06] shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-2">
            <span>Tổng Phiếu Hoa Hồng</span>
            <Receipt size={16} className="text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-[#1D1D1F]">{stats.total}</p>
          <span className="text-[11px] text-slate-400">Giao dịch hoa hồng</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-black/[0.06] shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-2">
            <span>Tổng Hoa Hồng Phát Sinh</span>
            <DollarSign size={16} className="text-purple-500" />
          </div>
          <p className="text-2xl font-bold text-purple-700">{formatVND(stats.totalAmount)}</p>
          <span className="text-[11px] text-purple-600/80">Khấu trừ vào lợi nhuận</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-black/[0.06] shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-2">
            <span>Đã Thanh Toán</span>
            <CheckCircle2 size={16} className="text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-emerald-600">{formatVND(stats.paidAmount)}</p>
          <span className="text-[11px] text-emerald-600/80">Đã chi chuyển khoản</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-black/[0.06] shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-2">
            <span>Còn Phải Chi (Chờ duyệt)</span>
            <Clock size={16} className="text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-amber-600">{formatVND(stats.pendingAmount)}</p>
          <span className="text-[11px] text-amber-600/80">Cần duyệt & giải ngân</span>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 px-8 pb-8 overflow-hidden flex gap-6">
        {/* Left: Commission Records List */}
        <div className="flex-1 bg-white rounded-2xl border border-black/[0.06] shadow-2xs flex flex-col overflow-hidden">
          {/* Filters */}
          <div className="p-4 border-b border-black/[0.06] flex items-center justify-between gap-4">
            <div className="flex items-center gap-1 bg-[#F5F5F7] p-1 rounded-xl">
              <button
                onClick={() => setActiveTab('all')}
                className={clsx(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                  activeTab === 'all' ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-900"
                )}
              >
                Tất cả ({commissionData.length})
              </button>
              <button
                onClick={() => setActiveTab('by_po')}
                className={clsx(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                  activeTab === 'by_po' ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-900"
                )}
              >
                Theo Đơn Hàng (PO)
              </button>
              <button
                onClick={() => setActiveTab('by_month')}
                className={clsx(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                  activeTab === 'by_month' ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-900"
                )}
              >
                Theo Tháng
              </button>
              <button
                onClick={() => setActiveTab('pending')}
                className={clsx(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                  activeTab === 'pending' ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-900"
                )}
              >
                Chờ duyệt
              </button>
            </div>

            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input
                type="text"
                placeholder="Tìm khách hàng, người nhận, số PO..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 bg-[#F5F5F7] border border-transparent rounded-xl text-xs focus:bg-white focus:border-blue-500 outline-none transition-all"
              />
            </div>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto">
            {filteredCommissions.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400">
                <Percent size={48} className="mb-3 text-slate-300 stroke-[1.5]" />
                <p className="text-sm font-semibold text-slate-600">Chưa có Phiếu Hoa hồng nào</p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">
                  Hãy bấm "Lập Phiếu Hoa Hồng" để quản lý chiết khấu, hoa hồng theo đơn hoặc theo tháng
                </p>
                <button
                  onClick={handleOpenAdd}
                  className="mt-4 px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl text-xs font-bold transition-all"
                >
                  + Lập Phiếu Đầu Tiên
                </button>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-[#F5F5F7] text-slate-500 font-semibold border-b border-black/[0.06] z-10">
                  <tr>
                    <th className="py-3 px-4">Khách Hàng</th>
                    <th className="py-3 px-4">Người Nhận Hoa Hồng</th>
                    <th className="py-3 px-4">Căn Cứ Chi</th>
                    <th className="py-3 px-4 text-right">Doanh Thu Cơ Sở</th>
                    <th className="py-3 px-4 text-center">Tỷ Lệ</th>
                    <th className="py-3 px-4 text-right">Tiền Hoa Hồng</th>
                    <th className="py-3 px-4 text-center">Trạng Thái</th>
                    <th className="py-3 px-4 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.04]">
                  {filteredCommissions.map((item, index) => {
                    const isSelected = selectedCommission?.id === item.id;
                    return (
                      <tr
                        key={item.id || index}
                        onClick={() => setSelectedCommission(item)}
                        className={clsx(
                          "hover:bg-blue-50/50 cursor-pointer transition-colors",
                          isSelected ? "bg-blue-50/70" : ""
                        )}
                      >
                        <td className="py-3 px-4 font-bold text-slate-900">
                          <div className="flex items-center gap-2">
                            <CompanyLogo name={item.customerName} size="sm" />
                            <span className="truncate max-w-[150px]">{item.customerName}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5">
                            <UserCheck size={14} className="text-purple-600" />
                            <div>
                              <p className="font-bold text-purple-950">{item.beneficiaryName}</p>
                              {item.beneficiaryPhone && (
                                <span className="text-[10px] text-slate-400">{item.beneficiaryPhone}</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {item.type === 'Theo đơn hàng' ? (
                            <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-mono font-bold text-[11px]">
                              PO: {item.poNumber || 'N/A'}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-bold text-[11px]">
                              Tháng {item.period || 'N/A'}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-600 font-medium">
                          {formatVND(item.baseRevenue)}
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-slate-700">
                          {item.calculationType === 'percentage' ? `${item.rate}%` : 'Cố định'}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-purple-700 text-sm">
                          {formatVND(item.commissionAmount)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={clsx(
                            "px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1",
                            item.paymentStatus === 'Đã thanh toán' ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                            item.paymentStatus === 'Đã duyệt' ? "bg-blue-50 text-blue-700 border border-blue-200" :
                            "bg-amber-50 text-amber-700 border border-amber-200"
                          )}>
                            <span className={clsx(
                              "w-1.5 h-1.5 rounded-full",
                              item.paymentStatus === 'Đã thanh toán' ? "bg-emerald-500" :
                              item.paymentStatus === 'Đã duyệt' ? "bg-blue-500" : "bg-amber-500"
                            )} />
                            {item.paymentStatus}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => handleOpenEdit(item)}
                              className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                              title="Chỉnh sửa"
                            >
                              <Edit3 size={14} />
                            </button>
                            <button
                              onClick={() => handleDelete(item)}
                              className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                              title="Xóa"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right: Commission Detail Panel */}
        <div className="w-96 bg-white rounded-2xl border border-black/[0.06] shadow-2xs flex flex-col overflow-hidden">
          {selectedCommission ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="p-4 border-b border-black/[0.06] bg-[#F5F5F7] flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider">Chi Tiết Phiếu Hoa Hồng</span>
                  <h3 className="text-sm font-bold text-slate-900 mt-0.5">{selectedCommission.beneficiaryName}</h3>
                </div>
                <button
                  onClick={() => handleOpenEdit(selectedCommission)}
                  className="px-2.5 py-1 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold shadow-2xs transition-all flex items-center gap-1"
                >
                  <Edit3 size={12} />
                  Sửa
                </button>
              </div>

              <div className="flex-1 overflow-auto p-5 space-y-5">
                {/* Main Card */}
                <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-100 p-4 rounded-2xl text-center space-y-1">
                  <span className="text-xs font-semibold text-purple-700 uppercase">Tiền Hoa Hồng Thực Nhận</span>
                  <p className="text-2xl font-bold text-purple-900 font-mono">
                    {formatVND(selectedCommission.commissionAmount)}
                  </p>
                  <span className="inline-block text-[11px] font-bold px-2 py-0.5 rounded bg-white/80 text-purple-800 border border-purple-200">
                    Trạng thái: {selectedCommission.paymentStatus}
                  </span>
                </div>

                {/* Information list */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Thông Tin Thanh Toán</h4>
                  <div className="bg-[#F5F5F7] p-3.5 rounded-xl space-y-2.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Khách hàng:</span>
                      <span className="font-bold text-slate-900">{selectedCommission.customerName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Hình thức chi:</span>
                      <span className="font-semibold text-slate-800">{selectedCommission.type}</span>
                    </div>
                    {selectedCommission.poNumber && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Số đơn hàng (PO):</span>
                        <span className="font-mono font-bold text-blue-600">{selectedCommission.poNumber}</span>
                      </div>
                    )}
                    {selectedCommission.period && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Kỳ tháng:</span>
                        <span className="font-bold text-amber-700">Tháng {selectedCommission.period}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-slate-500">Doanh thu cơ sở:</span>
                      <span className="font-semibold text-slate-800">{formatVND(selectedCommission.baseRevenue)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Tỷ lệ chiết khấu:</span>
                      <span className="font-bold text-purple-700">{selectedCommission.rate}%</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-200/60 pt-2">
                      <span className="text-slate-500">Ngày giải ngân:</span>
                      <span className="font-medium text-slate-800">{formatDateForDisplay(selectedCommission.paymentDate)}</span>
                    </div>
                    {selectedCommission.beneficiaryBank && (
                      <div className="flex justify-between border-t border-slate-200/60 pt-2">
                        <span className="text-slate-500">Thông tin TK:</span>
                        <span className="font-mono text-slate-800 text-right">{selectedCommission.beneficiaryBank}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Notes */}
                {selectedCommission.notes && (
                  <div className="space-y-1.5">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ghi Chú</h4>
                    <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200/60">
                      {selectedCommission.notes}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-6 text-center text-slate-400">
              <Percent size={36} className="mb-2 text-slate-300 stroke-[1.5]" />
              <p className="text-xs font-bold text-slate-600">Chọn 1 Phiếu Hoa Hồng</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                để xem chi tiết số tiền chiết khấu, tỷ lệ và người thụ hưởng
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 border border-black/[0.08]">
            <div className="px-6 py-4 border-b border-black/[0.06] flex items-center justify-between bg-[#F5F5F7]">
              <div className="flex items-center gap-3">
                <MacTrafficLights onClose={() => setIsModalOpen(false)} />
                <div className="h-4 w-px bg-black/[0.08]" />
                <h3 className="text-sm font-bold text-[#1D1D1F] flex items-center gap-2">
                  <Receipt size={16} className="text-purple-600" />
                  {editingCommission ? 'Cập Nhật Phiếu Hoa Hồng' : 'Lập Phiếu Hoa Hồng Mới'}
                </h3>
              </div>
            </div>

            <form onSubmit={handleSaveCommission} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Hình Thức Chi Hoa Hồng</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleRecalculate({ type: 'Theo đơn hàng' })}
                    className={clsx(
                      "py-2 px-3 rounded-xl text-xs font-bold border transition-all",
                      formData.type === 'Theo đơn hàng'
                        ? "bg-purple-50 border-purple-300 text-purple-700 shadow-2xs"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    )}
                  >
                    Theo Đơn Hàng (PO)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRecalculate({ type: 'Theo tháng' })}
                    className={clsx(
                      "py-2 px-3 rounded-xl text-xs font-bold border transition-all",
                      formData.type === 'Theo tháng'
                        ? "bg-purple-50 border-purple-300 text-purple-700 shadow-2xs"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    )}
                  >
                    Theo Tháng / Kỳ
                  </button>
                </div>
              </div>

              {formData.type === 'Theo đơn hàng' ? (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Chọn Đơn Hàng (PO)</label>
                  <select
                    value={formData.poNumber || ''}
                    onChange={e => handleSelectPO(e.target.value)}
                    className="w-full px-3.5 py-2 bg-[#F5F5F7] border border-slate-200 rounded-xl text-xs font-mono font-bold focus:bg-white focus:border-purple-500 outline-none"
                  >
                    <option value="">Chọn đơn hàng áp dụng hoa hồng</option>
                    {poHeaderData.map((po, i) => (
                      <option key={i} value={po['Đơn hàng'] || po['Số đơn hàng']}>
                        {po['Đơn hàng'] || po['Số đơn hàng']} - {po['Khách hàng']} ({formatVND(parseNumber(po['Tổng giá trị đơn hàng']))})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Kỳ Tháng (YYYY-MM)</label>
                  <input
                    type="month"
                    value={formData.period || ''}
                    onChange={e => setFormData({ ...formData, period: e.target.value })}
                    className="w-full px-3.5 py-2 bg-[#F5F5F7] border border-slate-200 rounded-xl text-xs font-bold focus:bg-white focus:border-purple-500 outline-none"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Khách Hàng *</label>
                  <input
                    type="text"
                    required
                    list="comm-cust-list"
                    placeholder="Tên khách hàng"
                    value={formData.customerName || ''}
                    onChange={e => setFormData({ ...formData, customerName: e.target.value })}
                    className="w-full px-3.5 py-2 bg-[#F5F5F7] border border-slate-200 rounded-xl text-xs font-bold focus:bg-white focus:border-purple-500 outline-none"
                  />
                  <datalist id="comm-cust-list">
                    {customerData.map((c, i) => (
                      <option key={i} value={c['Tên khách hàng'] || c['Khách hàng']} />
                    ))}
                  </datalist>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Người Nhận Hoa Hồng *</label>
                  <input
                    type="text"
                    required
                    list="comm-contact-list"
                    placeholder="Họ tên người nhận"
                    value={formData.beneficiaryName || ''}
                    onChange={e => handleSelectBeneficiary(e.target.value)}
                    className="w-full px-3.5 py-2 bg-[#F5F5F7] border border-slate-200 rounded-xl text-xs font-bold focus:bg-white focus:border-purple-500 outline-none"
                  />
                  <datalist id="comm-contact-list">
                    {contactData.map((ct, i) => (
                      <option key={i} value={ct['Họ và tên'] || ct['Tên']} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 bg-purple-50/60 p-3.5 rounded-xl border border-purple-100">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-purple-900">Doanh thu cơ sở</label>
                  <input
                    type="number"
                    value={formData.baseRevenue || ''}
                    onChange={e => handleRecalculate({ baseRevenue: parseFloat(e.target.value) || 0 })}
                    className="w-full px-2.5 py-1.5 bg-white border border-purple-200 rounded-lg text-xs font-bold outline-none text-right"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-purple-900">Tỷ lệ (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.rate || ''}
                    onChange={e => handleRecalculate({ rate: parseFloat(e.target.value) || 0 })}
                    className="w-full px-2.5 py-1.5 bg-white border border-purple-200 rounded-lg text-xs font-bold outline-none text-center"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-purple-900">Tiền hoa hồng (VNĐ)</label>
                  <input
                    type="number"
                    value={formData.commissionAmount || ''}
                    onChange={e => setFormData({ ...formData, commissionAmount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-2.5 py-1.5 bg-white border border-purple-200 rounded-lg text-xs font-mono font-bold text-purple-700 outline-none text-right"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Trạng Thái Thanh Toán</label>
                  <select
                    value={formData.paymentStatus || 'Chờ duyệt'}
                    onChange={e => setFormData({ ...formData, paymentStatus: e.target.value as any })}
                    className="w-full px-3.5 py-2 bg-[#F5F5F7] border border-slate-200 rounded-xl text-xs font-bold focus:bg-white focus:border-purple-500 outline-none"
                  >
                    <option value="Chờ duyệt">Chờ duyệt</option>
                    <option value="Đã duyệt">Đã duyệt</option>
                    <option value="Đã thanh toán">Đã thanh toán</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Ngày Chi / Kế Hoạch</label>
                  <input
                    type="date"
                    value={formData.paymentDate || ''}
                    onChange={e => setFormData({ ...formData, paymentDate: e.target.value })}
                    className="w-full px-3.5 py-2 bg-[#F5F5F7] border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-purple-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-[#007AFF] hover:bg-[#0062CC] text-white rounded-xl text-xs font-bold shadow-sm shadow-blue-500/20 active:scale-95 transition-all"
                >
                  Lưu Phiếu Hoa Hồng
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
