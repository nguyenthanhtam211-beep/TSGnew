import React, { useState, useMemo } from 'react';
import { 
  Percent, Plus, Search, Filter, Calendar, CheckCircle2, Clock, 
  AlertCircle, DollarSign, Download, Eye, Edit3, Trash2, UserCheck,
  Building2, ArrowUpRight, ArrowDownRight, Wallet, Receipt, CreditCard,
  ChevronRight, Tag, Scale, CalendarDays, Sparkles, RefreshCw, FileText, Check
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import clsx from 'clsx';
import * as XLSX from 'xlsx';
import MacTrafficLights from './MacTrafficLights';
import { formatVND, parseNumber, formatDateForDisplay, parseDateToISO } from '../lib/business-logic';
import CompanyLogo from './CompanyLogo';

export type CommissionMethod = 'profit_percent' | 'weight_rate' | 'monthly_lump_sum';

export interface CommissionItem {
  id?: string;
  type: 'Chia % Lợi nhuận' | 'Theo trọng lượng (kg)' | 'Chi khoán theo tháng' | 'Theo đơn hàng' | 'Theo tháng';
  calculationMethod?: CommissionMethod;
  customerName: string;
  beneficiaryName: string; // Tên người nhận hoa hồng (từ danh bạ/khách hàng)
  beneficiaryPhone?: string;
  beneficiaryBank?: string; // STK & Ngân hàng nhận
  poNumber?: string; // Số PO nếu chi theo PO
  period?: string; // Tháng/Kỳ (YYYY-MM) nếu chi theo tháng
  productName?: string; // Tên sản phẩm áp dụng (e.g. Lưỡi gà trắng)
  
  // 1. Chia % Lợi nhuận
  baseProfit?: number; // Lợi nhuận gộp cơ sở
  profitPercent?: number; // % Lợi nhuận chia (e.g. 10%, 15%)
  
  // 2. Theo trọng lượng kg
  weightKg?: number; // Số lượng trọng lượng (kg)
  ratePerKg?: number; // Định mức hưởng (₫/kg, e.g. 1000 ₫/kg)
  
  // 3. Doanh thu & Tổng tiền hoa hồng
  baseRevenue?: number; // Doanh thu làm căn cứ (nếu có)
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
  poLinesData?: any[];
  deliveryData?: any[];
  onAddCommission?: (item: CommissionItem) => Promise<void>;
  onUpdateCommission?: (item: CommissionItem) => Promise<void>;
  onDeleteCommission?: (item: CommissionItem) => Promise<void>;
}

export default function CommissionView({
  commissionData = [],
  customerData = [],
  contactData = [],
  poHeaderData = [],
  poLinesData = [],
  deliveryData = [],
  onAddCommission,
  onUpdateCommission,
  onDeleteCommission
}: CommissionViewProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'profit_percent' | 'weight_rate' | 'monthly_lump_sum' | 'paid' | 'pending'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCommission, setSelectedCommission] = useState<CommissionItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMobileDetailOpen, setIsMobileDetailOpen] = useState(false);
  const [editingCommission, setEditingCommission] = useState<CommissionItem | null>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<CommissionItem>>({
    type: 'Chia % Lợi nhuận',
    calculationMethod: 'profit_percent',
    customerName: '',
    beneficiaryName: '',
    beneficiaryPhone: '',
    beneficiaryBank: '',
    poNumber: '',
    period: new Date().toISOString().substring(0, 7), // YYYY-MM
    productName: 'Lưỡi gà trắng',
    baseProfit: 0,
    profitPercent: 10,
    weightKg: 5000,
    ratePerKg: 1000,
    baseRevenue: 0,
    commissionAmount: 0,
    paymentStatus: 'Chờ duyệt',
    paymentDate: new Date().toISOString().split('T')[0],
    notes: ''
  });

  // Normalize item method for legacy compatibility
  const getItemMethod = (c: CommissionItem): CommissionMethod => {
    if (c.calculationMethod) return c.calculationMethod;
    if (c.type === 'Theo trọng lượng (kg)' || (c.weightKg && c.weightKg > 0)) return 'weight_rate';
    if (c.type === 'Chi khoán theo tháng' || c.type === 'Theo tháng') return 'monthly_lump_sum';
    return 'profit_percent';
  };

  // Filtered List
  const filteredCommissions = useMemo(() => {
    return commissionData.filter(c => {
      const method = getItemMethod(c);
      if (activeTab === 'profit_percent' && method !== 'profit_percent') return false;
      if (activeTab === 'weight_rate' && method !== 'weight_rate') return false;
      if (activeTab === 'monthly_lump_sum' && method !== 'monthly_lump_sum') return false;
      if (activeTab === 'paid' && c.paymentStatus !== 'Đã thanh toán') return false;
      if (activeTab === 'pending' && c.paymentStatus === 'Đã thanh toán') return false;

      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        (c.customerName || '').toLowerCase().includes(query) ||
        (c.beneficiaryName || '').toLowerCase().includes(query) ||
        (c.poNumber || '').toLowerCase().includes(query) ||
        (c.productName || '').toLowerCase().includes(query) ||
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

    const profitShareTotal = commissionData
      .filter(c => getItemMethod(c) === 'profit_percent')
      .reduce((sum, c) => sum + (parseNumber(c.commissionAmount) || 0), 0);

    const weightRateTotal = commissionData
      .filter(c => getItemMethod(c) === 'weight_rate')
      .reduce((sum, c) => sum + (parseNumber(c.commissionAmount) || 0), 0);

    const lumpSumTotal = commissionData
      .filter(c => getItemMethod(c) === 'monthly_lump_sum')
      .reduce((sum, c) => sum + (parseNumber(c.commissionAmount) || 0), 0);

    return { total, totalAmount, paidAmount, pendingAmount, profitShareTotal, weightRateTotal, lumpSumTotal };
  }, [commissionData]);

  // Open Create Modal with default method
  const handleOpenAdd = (method: CommissionMethod = 'profit_percent') => {
    setEditingCommission(null);
    const firstCust = customerData[0]?.['Tên khách hàng'] || customerData[0]?.['Khách hàng'] || 'Thăng Long';
    const firstPO = poHeaderData[0]?.['Đơn hàng'] || poHeaderData[0]?.['Số đơn hàng'] || '26/KHVT/0082';
    
    // Auto find PO profit
    const poDeliveries = deliveryData.filter(d => d['Đơn hàng'] === firstPO);
    const defaultProfit = poDeliveries.reduce((sum, d) => sum + parseNumber(d['Lợi nhuận gộp'] || d['Lợi nhuận dòng']), 0) || 50000000;
    const defaultRev = poDeliveries.reduce((sum, d) => sum + parseNumber(d['Doanh thu']), 0) || 150000000;

    let initAmount = 0;
    let typeName: CommissionItem['type'] = 'Chia % Lợi nhuận';

    if (method === 'profit_percent') {
      typeName = 'Chia % Lợi nhuận';
      initAmount = Math.round(defaultProfit * 0.1); // 10% profit
    } else if (method === 'weight_rate') {
      typeName = 'Theo trọng lượng (kg)';
      initAmount = 5000 * 1000; // 5,000 kg * 1,000đ
    } else {
      typeName = 'Chi khoán theo tháng';
      initAmount = 10000000; // 10M default lump sum
    }

    setFormData({
      type: typeName,
      calculationMethod: method,
      customerName: firstCust,
      beneficiaryName: '',
      beneficiaryPhone: '',
      beneficiaryBank: '',
      poNumber: firstPO,
      period: new Date().toISOString().substring(0, 7),
      productName: 'Lưỡi gà trắng 95mm x 800m x 230gsm',
      baseProfit: defaultProfit,
      profitPercent: 10,
      weightKg: 5000,
      ratePerKg: 1000,
      baseRevenue: defaultRev,
      commissionAmount: initAmount,
      paymentStatus: 'Chờ duyệt',
      paymentDate: new Date().toISOString().split('T')[0],
      notes: method === 'profit_percent' 
        ? 'Chia 10% lợi nhuận gộp theo thỏa thuận' 
        : method === 'weight_rate' 
        ? 'Hoa hồng theo định mức 1.000 ₫/kg Lưỡi gà trắng' 
        : 'Chi khoán hoa hồng phát triển thị trường theo tháng'
    });
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (item: CommissionItem) => {
    setEditingCommission(item);
    const method = getItemMethod(item);
    setFormData({
      ...item,
      calculationMethod: method,
      paymentDate: parseDateToISO(item.paymentDate)
    });
    setIsModalOpen(true);
  };

  // Handle calculation updates dynamically
  const handleRecalculate = (updates: Partial<CommissionItem>) => {
    const next = { ...formData, ...updates };
    const method = next.calculationMethod || getItemMethod(next as CommissionItem);
    let comm = parseNumber(next.commissionAmount);

    if (method === 'profit_percent') {
      const profit = parseNumber(next.baseProfit);
      const percent = parseNumber(next.profitPercent);
      comm = Math.round((profit * percent) / 100);
      next.type = 'Chia % Lợi nhuận';
    } else if (method === 'weight_rate') {
      const kg = parseNumber(next.weightKg);
      const rate = parseNumber(next.ratePerKg);
      comm = Math.round(kg * rate);
      next.type = 'Theo trọng lượng (kg)';
    } else if (method === 'monthly_lump_sum') {
      next.type = 'Chi khoán theo tháng';
      // In monthly lump sum, keep the user-entered commission amount
    }

    setFormData({
      ...next,
      commissionAmount: comm
    });
  };

  // Switch Method in Modal
  const handleSwitchMethod = (method: CommissionMethod) => {
    let typeName: CommissionItem['type'] = 'Chia % Lợi nhuận';
    let defaultNotes = '';
    if (method === 'profit_percent') {
      typeName = 'Chia % Lợi nhuận';
      defaultNotes = 'Chia 10% lợi nhuận gộp đơn hàng';
    } else if (method === 'weight_rate') {
      typeName = 'Theo trọng lượng (kg)';
      defaultNotes = 'Hoa hồng định mức 1.000 ₫/kg Lưỡi gà trắng';
    } else {
      typeName = 'Chi khoán theo tháng';
      defaultNotes = 'Chi khoán theo tháng (nhập thủ công)';
    }

    handleRecalculate({
      calculationMethod: method,
      type: typeName,
      notes: defaultNotes
    });
  };

  // Select PO to auto-populate revenue & profit
  const handleSelectPO = (poNum: string) => {
    const matchedPO = poHeaderData.find(p => p['Đơn hàng'] === poNum || p['Số đơn hàng'] === poNum);
    const poDeliveries = deliveryData.filter(d => d['Đơn hàng'] === poNum);
    
    const profit = poDeliveries.reduce((sum, d) => sum + parseNumber(d['Lợi nhuận gộp'] || d['Lợi nhuận dòng']), 0) || 
                   (matchedPO ? parseNumber(matchedPO['Tổng giá trị đơn hàng']) * 0.25 : parseNumber(formData.baseProfit));
    
    const rev = poDeliveries.reduce((sum, d) => sum + parseNumber(d['Doanh thu']), 0) || 
                (matchedPO ? parseNumber(matchedPO['Tổng giá trị đơn hàng']) : parseNumber(formData.baseRevenue));

    const cust = matchedPO ? (matchedPO['Khách hàng'] || formData.customerName) : formData.customerName;

    // Estimate kg if lưỡi gà
    const totalKg = poDeliveries
      .filter(d => String(d['Tên sản phẩm'] || '').toLowerCase().includes('lưỡi gà') || String(d['Tên sản phẩm'] || '').toLowerCase().includes('lgt'))
      .reduce((sum, d) => sum + parseNumber(d['Số lượng giao']), 0) || 5000;

    handleRecalculate({
      poNumber: poNum,
      customerName: cust,
      baseProfit: profit,
      baseRevenue: rev,
      weightKg: totalKg > 0 ? totalKg : formData.weightKg
    });
  };

  // Select beneficiary from contacts
  const handleSelectBeneficiary = (contactName: string) => {
    const matchedContact = contactData.find(c => (c['Họ và tên'] || c['Tên']) === contactName);
    setFormData(prev => ({
      ...prev,
      beneficiaryName: contactName,
      beneficiaryPhone: matchedContact ? (matchedContact['Số điện thoại'] || matchedContact['Điện thoại'] || prev.beneficiaryPhone) : prev.beneficiaryPhone,
      beneficiaryBank: matchedContact ? (matchedContact['STK'] || matchedContact['Ngân hàng'] || prev.beneficiaryBank) : prev.beneficiaryBank,
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
      const method = formData.calculationMethod || 'profit_percent';
      let typeLabel: CommissionItem['type'] = 'Chia % Lợi nhuận';
      if (method === 'profit_percent') typeLabel = 'Chia % Lợi nhuận';
      else if (method === 'weight_rate') typeLabel = 'Theo trọng lượng (kg)';
      else typeLabel = 'Chi khoán theo tháng';

      const payload: CommissionItem = {
        ...formData,
        id: editingCommission?.id || `comm_${Date.now()}`,
        type: typeLabel,
        calculationMethod: method,
        customerName: formData.customerName || '',
        beneficiaryName: formData.beneficiaryName || '',
        beneficiaryPhone: formData.beneficiaryPhone || '',
        beneficiaryBank: formData.beneficiaryBank || '',
        poNumber: method !== 'monthly_lump_sum' ? (formData.poNumber || '') : '',
        period: formData.period || new Date().toISOString().substring(0, 7),
        productName: formData.productName || '',
        baseProfit: parseNumber(formData.baseProfit),
        profitPercent: parseNumber(formData.profitPercent),
        weightKg: parseNumber(formData.weightKg),
        ratePerKg: parseNumber(formData.ratePerKg),
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

  // Export Excel
  const handleExportExcel = () => {
    try {
      const dataToExport = filteredCommissions.map(c => {
        const method = getItemMethod(c);
        let formulaText = '';
        if (method === 'profit_percent') {
          formulaText = `${c.profitPercent || 10}% × ${formatVND(c.baseProfit || 0)} LN`;
        } else if (method === 'weight_rate') {
          formulaText = `${(c.weightKg || 0).toLocaleString()} kg × ${formatVND(c.ratePerKg || 1000)}/kg`;
        } else {
          formulaText = `Khoán tháng ${c.period || 'N/A'}`;
        }

        return {
          "Mã Phiếu": c.id || '',
          "Phương thức": c.type,
          "Khách hàng": c.customerName,
          "Người nhận": c.beneficiaryName,
          "Số điện thoại": c.beneficiaryPhone || '',
          "Tài khoản ngân hàng": c.beneficiaryBank || '',
          "Số Đơn hàng (PO)": c.poNumber || '',
          "Kỳ Tháng": c.period || '',
          "Công thức / Định mức": formulaText,
          "Tiền Hoa Hồng (VND)": parseNumber(c.commissionAmount),
          "Trạng thái": c.paymentStatus,
          "Ngày chi": formatDateForDisplay(c.paymentDate),
          "Ghi chú": c.notes || ''
        };
      });

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Danh_Sach_Hoa_Hong");
      XLSX.writeFile(wb, `Bang_Ke_Hoa_Hong_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success(`Đã xuất bảng kê ${dataToExport.length} phiếu hoa hồng sang Excel!`);
    } catch (e) {
      console.error(e);
      toast.error('Lỗi khi xuất file Excel!');
    }
  };

  return (
    <div className="flex-1 bg-[#F5F5F7] flex flex-col min-h-full overflow-y-auto pb-24 lg:pb-8">
      {/* Top Header */}
      <div className="bg-white/80 backdrop-blur-md border-b border-black/[0.06] px-4 sm:px-6 lg:px-8 py-4 sm:py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 text-xs font-bold uppercase tracking-wider">
              Tài chính & Chiết khấu
            </span>
            <h1 className="text-lg sm:text-xl font-bold text-[#1D1D1F] tracking-tight">Quản Lý Hoa Hồng (3 Phương Thức Chiết Khấu)</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Hỗ trợ linh hoạt: <strong>Chia % Lợi nhuận</strong>, <strong>Theo trọng lượng (1.000 ₫/kg Lưỡi gà)</strong> hoặc <strong>Chi khoán theo tháng</strong> (Nhập thủ công độc lập)
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleExportExcel}
            className="px-3 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-bold shadow-2xs transition-all flex items-center gap-1.5"
          >
            <Download size={14} className="text-slate-500" />
            Xuất Excel
          </button>
          
          {/* Quick Create Dropdown / Buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleOpenAdd('profit_percent')}
              className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-purple-500/20 active:scale-95 transition-all flex items-center gap-1.5"
            >
              <Plus size={14} />
              + Lập Phiếu Hoa Hồng
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="px-4 sm:px-6 lg:px-8 pt-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
          {/* Total */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-black/[0.06] shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">Tổng Hoa Hồng Đã Lập</span>
              <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
                <Receipt size={16} />
              </div>
            </div>
            <div className="mt-2.5">
              <p className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
                {formatVND(stats.totalAmount)}
              </p>
              <span className="text-[11px] text-slate-400 font-medium">{stats.total} phiếu hoa hồng</span>
            </div>
          </div>

          {/* Method 1: Profit Share */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-black/[0.06] shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-700">1. Chia % Lợi Nhuận</span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                <Percent size={16} />
              </div>
            </div>
            <div className="mt-2.5">
              <p className="text-xl sm:text-2xl font-black text-blue-900 font-mono">
                {formatVND(stats.profitShareTotal)}
              </p>
              <span className="text-[11px] text-blue-500 font-medium">Theo tỷ lệ % LN gộp KH</span>
            </div>
          </div>

          {/* Method 2: Weight Rate (LGT) */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-black/[0.06] shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-700">2. Theo Trọng Lượng (Kg)</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                <Scale size={16} />
              </div>
            </div>
            <div className="mt-2.5">
              <p className="text-xl sm:text-2xl font-black text-emerald-900 font-mono">
                {formatVND(stats.weightRateTotal)}
              </p>
              <span className="text-[11px] text-emerald-600 font-medium">Định mức 1.000 ₫/kg LGT</span>
            </div>
          </div>

          {/* Method 3: Monthly Lump Sum */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-black/[0.06] shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-700">3. Chi Khoán Theo Tháng</span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                <CalendarDays size={16} />
              </div>
            </div>
            <div className="mt-2.5">
              <p className="text-xl sm:text-2xl font-black text-amber-900 font-mono">
                {formatVND(stats.lumpSumTotal)}
              </p>
              <span className="text-[11px] text-amber-600 font-medium">Khoán trọn gói nhập tay</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="px-4 sm:px-6 lg:px-8 pt-5 flex-1 flex flex-col lg:flex-row gap-5 min-h-0">
        {/* Left: Commission List & Filters */}
        <div className="flex-1 bg-white rounded-2xl border border-black/[0.06] shadow-2xs flex flex-col overflow-hidden">
          {/* Filter Bar & Tabs */}
          <div className="p-3.5 sm:p-4 border-b border-black/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#FBFBFD]">
            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              <button
                onClick={() => setActiveTab('all')}
                className={clsx(
                  "px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap",
                  activeTab === 'all'
                    ? "bg-slate-900 text-white shadow-2xs"
                    : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                )}
              >
                Tất cả ({commissionData.length})
              </button>
              <button
                onClick={() => setActiveTab('profit_percent')}
                className={clsx(
                  "px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1",
                  activeTab === 'profit_percent'
                    ? "bg-blue-600 text-white shadow-2xs"
                    : "bg-white text-blue-700 hover:bg-blue-50 border border-blue-200"
                )}
              >
                <Percent size={12} />
                Chia % Lợi nhuận
              </button>
              <button
                onClick={() => setActiveTab('weight_rate')}
                className={clsx(
                  "px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1",
                  activeTab === 'weight_rate'
                    ? "bg-emerald-600 text-white shadow-2xs"
                    : "bg-white text-emerald-700 hover:bg-emerald-50 border border-emerald-200"
                )}
              >
                <Scale size={12} />
                Theo Trọng lượng (kg)
              </button>
              <button
                onClick={() => setActiveTab('monthly_lump_sum')}
                className={clsx(
                  "px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1",
                  activeTab === 'monthly_lump_sum'
                    ? "bg-amber-600 text-white shadow-2xs"
                    : "bg-white text-amber-700 hover:bg-amber-50 border border-amber-200"
                )}
              >
                <CalendarDays size={12} />
                Khoán theo tháng
              </button>
              <button
                onClick={() => setActiveTab('pending')}
                className={clsx(
                  "px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap",
                  activeTab === 'pending'
                    ? "bg-purple-600 text-white shadow-2xs"
                    : "bg-white text-purple-700 hover:bg-purple-50 border border-purple-200"
                )}
              >
                Chờ duyệt
              </button>
              <button
                onClick={() => setActiveTab('paid')}
                className={clsx(
                  "px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap",
                  activeTab === 'paid'
                    ? "bg-teal-600 text-white shadow-2xs"
                    : "bg-white text-teal-700 hover:bg-teal-50 border border-teal-200"
                )}
              >
                Đã thanh toán
              </button>
            </div>

            {/* Search Input */}
            <div className="relative min-w-[220px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm khách hàng, người nhận, PO..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {/* Table Container */}
          <div className="flex-1 overflow-x-auto min-h-0">
            {filteredCommissions.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6">
                <Receipt size={40} className="text-slate-300 stroke-[1.5] mb-2" />
                <p className="text-sm font-bold text-slate-700">Chưa có phiếu hoa hồng nào</p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">
                  Bạn có thể lập phiếu hoa hồng mới theo 3 hình thức: Chia % Lợi nhuận, Theo trọng lượng kg hoặc Chi khoán theo tháng.
                </p>
                <button
                  onClick={() => handleOpenAdd('profit_percent')}
                  className="mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
                >
                  + Lập Phiếu Hoa Hồng Mới
                </button>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-black/[0.06] bg-[#F5F5F7] text-slate-500 font-bold">
                    <th className="py-3 px-4">Khách Hàng</th>
                    <th className="py-3 px-4">Người Nhận Hoa Hồng</th>
                    <th className="py-3 px-4">Phương Thức & Căn Cứ</th>
                    <th className="py-3 px-4 text-right">Định Mức / Tỷ Lệ</th>
                    <th className="py-3 px-4 text-right">Tiền Hoa Hồng</th>
                    <th className="py-3 px-4 text-center">Trạng Thái</th>
                    <th className="py-3 px-4 text-center">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.04]">
                  {filteredCommissions.map((item, index) => {
                    const isSelected = selectedCommission?.id === item.id;
                    const method = getItemMethod(item);

                    return (
                      <tr
                        key={item.id || index}
                        onClick={() => setSelectedCommission(item)}
                        className={clsx(
                          "hover:bg-purple-50/40 cursor-pointer transition-colors",
                          isSelected ? "bg-purple-50/70" : ""
                        )}
                      >
                        {/* Customer */}
                        <td className="py-3 px-4 font-bold text-slate-900">
                          <div className="flex items-center gap-2">
                            <CompanyLogo name={item.customerName} size="sm" />
                            <div>
                              <span className="truncate max-w-[150px] block">{item.customerName}</span>
                              {item.poNumber && (
                                <span className="text-[10px] text-blue-600 font-mono block">PO: {item.poNumber}</span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Beneficiary */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5">
                            <UserCheck size={14} className="text-purple-600 shrink-0" />
                            <div>
                              <p className="font-bold text-purple-950">{item.beneficiaryName}</p>
                              {item.beneficiaryPhone && (
                                <span className="text-[10px] text-slate-400">{item.beneficiaryPhone}</span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Method & Basis */}
                        <td className="py-3 px-4">
                          {method === 'profit_percent' && (
                            <div>
                              <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold text-[11px] inline-flex items-center gap-1">
                                <Percent size={11} /> Chia % Lợi Nhuận
                              </span>
                              <span className="text-[10px] text-slate-500 block mt-0.5">
                                LN cơ sở: {formatVND(item.baseProfit || 0)}
                              </span>
                            </div>
                          )}

                          {method === 'weight_rate' && (
                            <div>
                              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold text-[11px] inline-flex items-center gap-1">
                                <Scale size={11} /> Theo Trọng Lượng
                              </span>
                              <span className="text-[10px] text-slate-500 block mt-0.5">
                                Khối lượng: {(item.weightKg || 0).toLocaleString()} kg
                              </span>
                            </div>
                          )}

                          {method === 'monthly_lump_sum' && (
                            <div>
                              <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-bold text-[11px] inline-flex items-center gap-1">
                                <CalendarDays size={11} /> Khoán Tháng
                              </span>
                              <span className="text-[10px] text-slate-500 block mt-0.5">
                                Kỳ: Tháng {item.period || 'N/A'}
                              </span>
                            </div>
                          )}
                        </td>

                        {/* Rate / Formula */}
                        <td className="py-3 px-4 text-right font-bold text-slate-700">
                          {method === 'profit_percent' && (
                            <span className="text-blue-700">{item.profitPercent || 10}%</span>
                          )}
                          {method === 'weight_rate' && (
                            <span className="text-emerald-700">{formatVND(item.ratePerKg || 1000)}/kg</span>
                          )}
                          {method === 'monthly_lump_sum' && (
                            <span className="text-amber-700 text-[11px]">Khoán trọn gói</span>
                          )}
                        </td>

                        {/* Amount */}
                        <td className="py-3 px-4 text-right font-bold text-purple-700 text-sm font-mono">
                          {formatVND(item.commissionAmount)}
                        </td>

                        {/* Payment Status */}
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

                        {/* Actions */}
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

        {/* Right: Commission Detail Panel (Desktop) */}
        <div className="hidden lg:flex w-96 bg-white rounded-2xl border border-black/[0.06] shadow-2xs flex-col overflow-hidden">
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

              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {/* Main Card */}
                <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-100 p-4 rounded-2xl text-center space-y-1">
                  <span className="text-xs font-semibold text-purple-700 uppercase">Tiền Hoa Hồng Thực Nhận</span>
                  <p className="text-2xl font-black text-purple-900 font-mono">
                    {formatVND(selectedCommission.commissionAmount)}
                  </p>
                  <span className="inline-block text-[11px] font-bold px-2 py-0.5 rounded bg-white/80 text-purple-800 border border-purple-200">
                    Trạng thái: {selectedCommission.paymentStatus}
                  </span>
                </div>

                {/* Information list */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Phương Thức & Căn Cứ Chi</h4>
                  <div className="bg-[#F5F5F7] p-3.5 rounded-xl space-y-2.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Khách hàng:</span>
                      <span className="font-bold text-slate-900">{selectedCommission.customerName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Phương thức:</span>
                      <span className="font-bold text-purple-700">{selectedCommission.type}</span>
                    </div>

                    {getItemMethod(selectedCommission) === 'profit_percent' && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Lợi nhuận gộp cơ sở:</span>
                          <span className="font-bold text-slate-900">{formatVND(selectedCommission.baseProfit || 0)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Tỷ lệ % chia:</span>
                          <span className="font-bold text-blue-700">{selectedCommission.profitPercent || 10}%</span>
                        </div>
                      </>
                    )}

                    {getItemMethod(selectedCommission) === 'weight_rate' && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Sản phẩm:</span>
                          <span className="font-bold text-slate-900">{selectedCommission.productName || 'Lưỡi gà trắng'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Trọng lượng:</span>
                          <span className="font-bold text-slate-900">{(selectedCommission.weightKg || 0).toLocaleString()} kg</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Định mức hưởng:</span>
                          <span className="font-bold text-emerald-700">{formatVND(selectedCommission.ratePerKg || 1000)}/kg</span>
                        </div>
                      </>
                    )}

                    {getItemMethod(selectedCommission) === 'monthly_lump_sum' && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Kỳ tháng:</span>
                        <span className="font-bold text-amber-700">Tháng {selectedCommission.period || 'N/A'}</span>
                      </div>
                    )}

                    {selectedCommission.poNumber && (
                      <div className="flex justify-between border-t border-slate-200/60 pt-2">
                        <span className="text-slate-500">Số đơn hàng (PO):</span>
                        <span className="font-mono font-bold text-blue-600">{selectedCommission.poNumber}</span>
                      </div>
                    )}

                    <div className="flex justify-between border-t border-slate-200/60 pt-2">
                      <span className="text-slate-500">Ngày giải ngân:</span>
                      <span className="font-medium text-slate-800">{formatDateForDisplay(selectedCommission.paymentDate)}</span>
                    </div>

                    {selectedCommission.beneficiaryBank && (
                      <div className="flex justify-between border-t border-slate-200/60 pt-2">
                        <span className="text-slate-500">Tài khoản nhận:</span>
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
                để xem chi tiết công thức, định mức và người thụ hưởng
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Modal (With 3 Methods & Full Manual Override) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[95vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-black/[0.08]">
            {/* Header */}
            <div className="px-6 py-4 border-b border-black/[0.06] flex items-center justify-between bg-[#F5F5F7]">
              <div className="flex items-center gap-3">
                <MacTrafficLights onClose={() => setIsModalOpen(false)} />
                <div className="h-4 w-px bg-black/[0.08]" />
                <h3 className="text-sm font-bold text-[#1D1D1F] flex items-center gap-2">
                  <Receipt size={16} className="text-purple-600" />
                  {editingCommission ? 'Cập Nhật Phiếu Hoa Hồng' : 'Lập Phiếu Hoa Hồng Mới (3 Phương Thức)'}
                </h3>
              </div>
            </div>

            <form onSubmit={handleSaveCommission} className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* 3 Methods Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wide flex items-center gap-1">
                  <Tag size={13} className="text-purple-600" />
                  Chọn Phương Thức Tính Hoa Hồng
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {/* Option 1 */}
                  <button
                    type="button"
                    onClick={() => handleSwitchMethod('profit_percent')}
                    className={clsx(
                      "p-2.5 rounded-xl text-left border transition-all flex flex-col justify-between",
                      (formData.calculationMethod || 'profit_percent') === 'profit_percent'
                        ? "bg-blue-50 border-blue-400 text-blue-900 shadow-2xs ring-1 ring-blue-300"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs flex items-center gap-1">
                        <Percent size={13} className="text-blue-600" />
                        1. Chia % LN
                      </span>
                      {(formData.calculationMethod || 'profit_percent') === 'profit_percent' && (
                        <Check size={13} className="text-blue-600" />
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500">Tính theo % lợi nhuận gộp</span>
                  </button>

                  {/* Option 2 */}
                  <button
                    type="button"
                    onClick={() => handleSwitchMethod('weight_rate')}
                    className={clsx(
                      "p-2.5 rounded-xl text-left border transition-all flex flex-col justify-between",
                      formData.calculationMethod === 'weight_rate'
                        ? "bg-emerald-50 border-emerald-400 text-emerald-900 shadow-2xs ring-1 ring-emerald-300"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs flex items-center gap-1">
                        <Scale size={13} className="text-emerald-600" />
                        2. Trọng lượng (kg)
                      </span>
                      {formData.calculationMethod === 'weight_rate' && (
                        <Check size={13} className="text-emerald-600" />
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500">1.000 ₫/kg Lưỡi gà trắng</span>
                  </button>

                  {/* Option 3 */}
                  <button
                    type="button"
                    onClick={() => handleSwitchMethod('monthly_lump_sum')}
                    className={clsx(
                      "p-2.5 rounded-xl text-left border transition-all flex flex-col justify-between",
                      formData.calculationMethod === 'monthly_lump_sum'
                        ? "bg-amber-50 border-amber-400 text-amber-900 shadow-2xs ring-1 ring-amber-300"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs flex items-center gap-1">
                        <CalendarDays size={13} className="text-amber-600" />
                        3. Khoán Tháng
                      </span>
                      {formData.calculationMethod === 'monthly_lump_sum' && (
                        <Check size={13} className="text-amber-600" />
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500">Nhập số tiền trọn gói</span>
                  </button>
                </div>
              </div>

              {/* Customer & PO Selection */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Khách Hàng *</label>
                  <input
                    type="text"
                    required
                    list="comm-cust-list"
                    placeholder="Tên khách hàng..."
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
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                    {formData.calculationMethod === 'monthly_lump_sum' ? 'Kỳ Tháng (YYYY-MM)' : 'Đơn Hàng (PO)'}
                  </label>
                  {formData.calculationMethod === 'monthly_lump_sum' ? (
                    <input
                      type="month"
                      value={formData.period || ''}
                      onChange={e => setFormData({ ...formData, period: e.target.value })}
                      className="w-full px-3.5 py-2 bg-[#F5F5F7] border border-slate-200 rounded-xl text-xs font-bold focus:bg-white focus:border-purple-500 outline-none"
                    />
                  ) : (
                    <select
                      value={formData.poNumber || ''}
                      onChange={e => handleSelectPO(e.target.value)}
                      className="w-full px-3.5 py-2 bg-[#F5F5F7] border border-slate-200 rounded-xl text-xs font-mono font-bold focus:bg-white focus:border-purple-500 outline-none"
                    >
                      <option value="">Chọn PO hoặc tự nhập</option>
                      {poHeaderData.map((po, i) => (
                        <option key={i} value={po['Đơn hàng'] || po['Số đơn hàng']}>
                          {po['Đơn hàng'] || po['Số đơn hàng']} - {po['Khách hàng']}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Method-Specific Calculation Inputs */}
              {formData.calculationMethod === 'profit_percent' && (
                <div className="bg-blue-50/70 p-4 rounded-2xl border border-blue-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-900 flex items-center gap-1">
                      <Percent size={14} className="text-blue-600" />
                      Công Thức: Chia % Lợi Nhuận Gộp
                    </span>
                    <span className="text-[11px] text-blue-700 font-mono">
                      {formatVND(parseNumber(formData.baseProfit))} × {formData.profitPercent}%
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-blue-800">Lợi Nhuận Gộp Cơ Sở (₫)</label>
                      <input
                        type="number"
                        value={formData.baseProfit || ''}
                        onChange={e => handleRecalculate({ baseProfit: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-1.5 bg-white border border-blue-200 rounded-xl text-xs font-bold outline-none text-right font-mono"
                        placeholder="50,000,000"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-blue-800">Tỷ Lệ % Hưởng (%)</label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          step="0.5"
                          value={formData.profitPercent || ''}
                          onChange={e => handleRecalculate({ profitPercent: parseFloat(e.target.value) || 0 })}
                          className="w-full px-3 py-1.5 bg-white border border-blue-200 rounded-xl text-xs font-bold outline-none text-center font-mono"
                          placeholder="10"
                        />
                        <span className="text-xs font-bold text-blue-800">%</span>
                      </div>
                    </div>
                  </div>

                  {/* Quick percentage buttons */}
                  <div className="flex items-center gap-1.5 pt-1">
                    <span className="text-[10px] text-blue-600 font-medium">Chọn nhanh:</span>
                    {[5, 10, 15, 20, 25].map(pct => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => handleRecalculate({ profitPercent: pct })}
                        className={clsx(
                          "px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all",
                          formData.profitPercent === pct
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-white text-blue-700 border-blue-200 hover:bg-blue-100"
                        )}
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {formData.calculationMethod === 'weight_rate' && (
                <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-900 flex items-center gap-1">
                      <Scale size={14} className="text-emerald-600" />
                      Công Thức: Theo Trọng Lượng (Kg) × Định Mức
                    </span>
                    <span className="text-[11px] text-emerald-700 font-mono">
                      {(parseNumber(formData.weightKg)).toLocaleString()} kg × {formatVND(parseNumber(formData.ratePerKg))}/kg
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-emerald-800">Tổng Trọng Lượng (Kg)</label>
                      <input
                        type="number"
                        value={formData.weightKg || ''}
                        onChange={e => handleRecalculate({ weightKg: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-1.5 bg-white border border-emerald-200 rounded-xl text-xs font-bold outline-none text-right font-mono"
                        placeholder="5,000"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-emerald-800">Định Mức Hoa Hồng (₫/kg)</label>
                      <input
                        type="number"
                        step="100"
                        value={formData.ratePerKg || ''}
                        onChange={e => handleRecalculate({ ratePerKg: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-1.5 bg-white border border-emerald-200 rounded-xl text-xs font-bold outline-none text-right font-mono"
                        placeholder="1,000"
                      />
                    </div>
                  </div>

                  {/* Quick rate buttons */}
                  <div className="flex items-center gap-1.5 pt-1">
                    <span className="text-[10px] text-emerald-600 font-medium">Định mức mẫu:</span>
                    {[500, 1000, 1500, 2000, 3000].map(rate => (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => handleRecalculate({ ratePerKg: rate })}
                        className={clsx(
                          "px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all",
                          formData.ratePerKg === rate
                            ? "bg-emerald-600 text-white border-emerald-600"
                            : "bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                        )}
                      >
                        {rate.toLocaleString()} ₫/kg
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {formData.calculationMethod === 'monthly_lump_sum' && (
                <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-200 space-y-2">
                  <span className="text-xs font-bold text-amber-900 flex items-center gap-1">
                    <CalendarDays size={14} className="text-amber-600" />
                    Chi Khoán Trọn Gói Theo Tháng (Nhập Thủ Công)
                  </span>
                  <p className="text-[11px] text-amber-700">
                    Khoản chi định kỳ hoặc thưởng doanh số khoán hàng tháng không phụ thuộc vào công thức trọng lượng hay % lợi nhuận.
                  </p>
                </div>
              )}

              {/* Total Commission Amount (Fully Editable) */}
              <div className="bg-purple-50 p-4 rounded-2xl border border-purple-200 space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-purple-950 uppercase tracking-wide flex items-center gap-1">
                    <DollarSign size={14} className="text-purple-600" />
                    Tiền Hoa Hồng Thực Chi (VNĐ) *
                  </label>
                  <span className="text-[10px] text-purple-600 font-medium">Có thể nhập/sửa tay trực tiếp</span>
                </div>
                <input
                  type="number"
                  required
                  value={formData.commissionAmount || ''}
                  onChange={e => setFormData({ ...formData, commissionAmount: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2.5 bg-white border border-purple-300 rounded-xl text-base font-black text-purple-900 outline-none text-right font-mono shadow-2xs"
                  placeholder="0"
                />
              </div>

              {/* Beneficiary Details */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Người Thụ Hưởng *</label>
                  <input
                    type="text"
                    required
                    list="comm-contact-list"
                    placeholder="Họ tên người nhận..."
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

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Số Điện Thoại</label>
                  <input
                    type="text"
                    placeholder="0912..."
                    value={formData.beneficiaryPhone || ''}
                    onChange={e => setFormData({ ...formData, beneficiaryPhone: e.target.value })}
                    className="w-full px-3.5 py-2 bg-[#F5F5F7] border border-slate-200 rounded-xl text-xs font-mono focus:bg-white focus:border-purple-500 outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Tài Khoản / Ngân Hàng Nhận</label>
                <input
                  type="text"
                  placeholder="STK - Tên Ngân Hàng (VD: 1903... Techcombank)"
                  value={formData.beneficiaryBank || ''}
                  onChange={e => setFormData({ ...formData, beneficiaryBank: e.target.value })}
                  className="w-full px-3.5 py-2 bg-[#F5F5F7] border border-slate-200 rounded-xl text-xs font-mono focus:bg-white focus:border-purple-500 outline-none"
                />
              </div>

              {/* Status & Date */}
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
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Ngày Chi / Giải Ngân</label>
                  <input
                    type="date"
                    value={formData.paymentDate || ''}
                    onChange={e => setFormData({ ...formData, paymentDate: e.target.value })}
                    className="w-full px-3.5 py-2 bg-[#F5F5F7] border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-purple-500 outline-none"
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Ghi Chú Thỏa Thuận</label>
                <textarea
                  rows={2}
                  value={formData.notes || ''}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Ghi chú chi tiết thỏa thuận hoặc căn cứ chiết khấu..."
                  className="w-full px-3.5 py-2 bg-[#F5F5F7] border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-purple-500 outline-none"
                />
              </div>

              {/* Buttons */}
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
                  className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-purple-500/20 active:scale-95 transition-all"
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
