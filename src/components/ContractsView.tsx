import React, { useState, useMemo } from 'react';
import { 
  FileText, Plus, Search, Filter, Calendar, CheckCircle2, Clock, 
  AlertTriangle, ArrowUpRight, DollarSign, Download, Eye, Edit3, 
  Trash2, Sparkles, Scale, Building2, User, ChevronRight, FileCheck,
  Paperclip, Tag, ArrowRight, ShieldCheck
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import clsx from 'clsx';
import MacTrafficLights from './MacTrafficLights';
import { formatVND, parseNumber, formatDateForDisplay, parseDateToISO } from '../lib/business-logic';
import CompanyLogo from './CompanyLogo';

export interface ContractItem {
  id?: string;
  contractNumber: string; // Số hợp đồng (e.g. 01/2026/HĐMB-TS)
  title: string; // Tên/Trích yếu hợp đồng
  partnerName: string; // Khách hàng hoặc Nhà cung cấp
  partnerType: 'Khách hàng' | 'Nhà cung cấp';
  contractType: 'Bán hàng' | 'Mua hàng' | 'Nguyên tắc' | 'Gia công';
  signDate: string; // Ngày ký (YYYY-MM-DD or DD/MM/YYYY)
  effectiveDate: string; // Ngày có hiệu lực
  expirationDate: string; // Ngày hết hạn
  totalValue: number; // Giá trị hợp đồng (VNĐ)
  paymentTerms: string; // Điều khoản thanh toán (e.g. 30 ngày sau khi nhận hóa đơn)
  status: 'Hiệu lực' | 'Hết hạn' | 'Đang thương thảo' | 'Thanh lý';
  attachmentName?: string; // Tên tệp đính kèm scan
  attachmentUrl?: string;
  notes?: string;
  // Danh mục sản phẩm cam kết trong hợp đồng
  products?: {
    productCode: string;
    productName: string;
    unit: string;
    contractPrice: number; // Đơn giá ký kết
    quantity?: number;
    notes?: string;
  }[];
  // Danh sách phụ lục đi kèm
  appendices?: {
    appendixNumber: string;
    title: string;
    signDate: string;
    content: string;
    priceAdjustment?: string;
  }[];
}

interface ContractsViewProps {
  contractsData?: any[];
  pricingData?: any[];
  customerData?: any[];
  supplierData?: any[];
  onAddContract?: (contract: ContractItem) => Promise<void>;
  onUpdateContract?: (contract: ContractItem) => Promise<void>;
  onDeleteContract?: (contract: ContractItem) => Promise<void>;
}

export default function ContractsView({
  contractsData = [],
  pricingData = [],
  customerData = [],
  supplierData = [],
  onAddContract,
  onUpdateContract,
  onDeleteContract
}: ContractsViewProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'customer' | 'supplier' | 'audit'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContract, setSelectedContract] = useState<ContractItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<ContractItem | null>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<ContractItem>>({
    contractNumber: '',
    title: '',
    partnerName: '',
    partnerType: 'Khách hàng',
    contractType: 'Bán hàng',
    signDate: new Date().toISOString().split('T')[0],
    effectiveDate: new Date().toISOString().split('T')[0],
    expirationDate: '',
    totalValue: 0,
    paymentTerms: 'Chuyển khoản 30 ngày',
    status: 'Hiệu lực',
    notes: '',
    products: [],
    appendices: []
  });

  // Filtered contracts list
  const filteredContracts = useMemo(() => {
    return contractsData.filter(c => {
      if (activeTab === 'customer' && c.partnerType !== 'Khách hàng') return false;
      if (activeTab === 'supplier' && c.partnerType !== 'Nhà cung cấp') return false;
      
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        (c.contractNumber || '').toLowerCase().includes(query) ||
        (c.title || '').toLowerCase().includes(query) ||
        (c.partnerName || '').toLowerCase().includes(query) ||
        (c.contractType || '').toLowerCase().includes(query)
      );
    });
  }, [contractsData, activeTab, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const total = contractsData.length;
    const active = contractsData.filter(c => c.status === 'Hiệu lực').length;
    const totalVal = contractsData.reduce((acc, c) => acc + (parseNumber(c.totalValue) || 0), 0);
    const expiringSoon = contractsData.filter(c => {
      if (!c.expirationDate || c.status !== 'Hiệu lực') return false;
      const exp = new Date(parseDateToISO(c.expirationDate));
      const now = new Date();
      const diffDays = (exp.getTime() - now.getTime()) / (1000 * 3600 * 24);
      return diffDays >= 0 && diffDays <= 45;
    }).length;

    return { total, active, totalVal, expiringSoon };
  }, [contractsData]);

  // Handle open Add/Edit Modal
  const handleOpenAdd = () => {
    setEditingContract(null);
    setFormData({
      contractNumber: `HĐ-${new Date().getFullYear()}/${Math.floor(100 + Math.random() * 900)}`,
      title: 'Hợp đồng mua bán hàng hóa nguyên vật liệu',
      partnerName: customerData[0]?.['Tên khách hàng'] || '',
      partnerType: 'Khách hàng',
      contractType: 'Bán hàng',
      signDate: new Date().toISOString().split('T')[0],
      effectiveDate: new Date().toISOString().split('T')[0],
      expirationDate: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().split('T')[0],
      totalValue: 0,
      paymentTerms: 'Thanh toán chuyển khoản trong vòng 30 ngày kể từ ngày giao hàng & xuất HĐ',
      status: 'Hiệu lực',
      notes: 'Hợp đồng làm căn cứ pháp lý đối chiếu giá mua bán với Kế toán',
      products: [
        { productCode: '', productName: '', unit: 'Thùng', contractPrice: 0, quantity: 1000 }
      ],
      appendices: []
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (contract: ContractItem) => {
    setEditingContract(contract);
    setFormData({
      ...contract,
      signDate: parseDateToISO(contract.signDate),
      effectiveDate: parseDateToISO(contract.effectiveDate),
      expirationDate: parseDateToISO(contract.expirationDate)
    });
    setIsModalOpen(true);
  };

  const handleSaveContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.contractNumber || !formData.partnerName) {
      toast.error('Vui lòng nhập Số hợp đồng và Đối tác!');
      return;
    }

    try {
      const payload: ContractItem = {
        ...formData,
        id: editingContract?.id || `contract_${Date.now()}`,
        contractNumber: formData.contractNumber || '',
        title: formData.title || 'Hợp đồng kinh tế',
        partnerName: formData.partnerName || '',
        partnerType: formData.partnerType || 'Khách hàng',
        contractType: formData.contractType || 'Bán hàng',
        signDate: formData.signDate || '',
        effectiveDate: formData.effectiveDate || '',
        expirationDate: formData.expirationDate || '',
        totalValue: parseNumber(formData.totalValue),
        paymentTerms: formData.paymentTerms || '',
        status: formData.status || 'Hiệu lực',
        products: formData.products || [],
        appendices: formData.appendices || []
      };

      if (editingContract && onUpdateContract) {
        await onUpdateContract(payload);
        toast.success('Đã cập nhật Hợp đồng!');
      } else if (onAddContract) {
        await onAddContract(payload);
        toast.success('Đã thêm mới Hợp đồng thành công!');
      }

      setIsModalOpen(false);
    } catch (err: any) {
      console.error('Save contract error:', err);
      toast.error('Lỗi khi lưu hợp đồng!');
    }
  };

  const handleDelete = async (contract: ContractItem) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa Hợp đồng ${contract.contractNumber}?`)) {
      if (onDeleteContract) {
        await onDeleteContract(contract);
        toast.success('Đã xóa Hợp đồng!');
        if (selectedContract?.id === contract.id) setSelectedContract(null);
      }
    }
  };

  // Add a product line in contract form
  const handleAddProductLine = () => {
    setFormData(prev => ({
      ...prev,
      products: [
        ...(prev.products || []),
        { productCode: '', productName: '', unit: 'Cái', contractPrice: 0, quantity: 0 }
      ]
    }));
  };

  // Remove a product line
  const handleRemoveProductLine = (idx: number) => {
    setFormData(prev => ({
      ...prev,
      products: (prev.products || []).filter((_, i) => i !== idx)
    }));
  };

  return (
    <div className="flex-1 bg-[#F5F5F7] flex flex-col min-h-full overflow-y-auto pb-24 lg:pb-8">
      {/* Top Header */}
      <div className="bg-white/80 backdrop-blur-md border-b border-black/[0.06] px-4 sm:px-6 lg:px-8 py-4 sm:py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-xs font-bold uppercase tracking-wider">
              Pháp lý & Kế toán
            </span>
            <h1 className="text-lg sm:text-xl font-bold text-[#1D1D1F] tracking-tight">Hợp Đồng & Phụ Lục Kinh Tế</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Quản lý hồ sơ Hợp đồng kinh tế, Phụ lục đơn giá cam kết làm chứng từ đối chiếu giá kế toán & OCR
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-4 py-2 bg-[#007AFF] hover:bg-[#0062CC] text-white rounded-xl text-xs font-bold shadow-sm shadow-blue-500/20 active:scale-95 transition-all"
          >
            <Plus size={16} />
            Thêm Hợp Đồng Mới
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="px-4 sm:px-6 lg:px-8 py-4 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-black/[0.06] shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1 sm:mb-2">
            <span className="truncate">Tổng Hợp đồng</span>
            <FileText size={16} className="text-blue-500 shrink-0" />
          </div>
          <p className="text-lg sm:text-xl lg:text-2xl font-bold text-[#1D1D1F]">{stats.total}</p>
          <span className="text-[10px] sm:text-[11px] text-slate-400">Đã lưu trong hệ thống</span>
        </div>

        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-black/[0.06] shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1 sm:mb-2">
            <span className="truncate">Đang Có Hiệu Lực</span>
            <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
          </div>
          <p className="text-lg sm:text-xl lg:text-2xl font-bold text-emerald-600">{stats.active}</p>
          <span className="text-[10px] sm:text-[11px] text-emerald-600/80">Căn cứ pháp lý chuẩn</span>
        </div>

        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-black/[0.06] shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1 sm:mb-2">
            <span className="truncate">Sắp Hết Hạn (&lt;45 ngày)</span>
            <Clock size={16} className="text-amber-500 shrink-0" />
          </div>
          <p className="text-lg sm:text-xl lg:text-2xl font-bold text-amber-600">{stats.expiringSoon}</p>
          <span className="text-[10px] sm:text-[11px] text-amber-600/80">Cần tái ký / lập phụ lục</span>
        </div>

        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-black/[0.06] shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1 sm:mb-2">
            <span className="truncate">Tổng Giá Trị Cam Kết</span>
            <DollarSign size={16} className="text-purple-500 shrink-0" />
          </div>
          <p className="text-base sm:text-lg lg:text-2xl font-bold text-purple-700 truncate" title={formatVND(stats.totalVal)}>{formatVND(stats.totalVal)}</p>
          <span className="text-[10px] sm:text-[11px] text-purple-600/80">Quy mô các hợp đồng</span>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 px-4 sm:px-6 lg:px-8 flex flex-col lg:flex-row gap-4 sm:gap-6 min-h-0">
        {/* Left: Contracts Table List */}
        <div className="flex-1 bg-white rounded-2xl border border-black/[0.06] shadow-2xs flex flex-col min-h-[400px] overflow-hidden">
          {/* Filter Bar */}
          <div className="p-3 sm:p-4 border-b border-black/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1 bg-[#F5F5F7] p-1 rounded-xl overflow-x-auto max-w-full">
              <button
                onClick={() => setActiveTab('all')}
                className={clsx(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                  activeTab === 'all' ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-900"
                )}
              >
                Tất cả ({contractsData.length})
              </button>
              <button
                onClick={() => setActiveTab('customer')}
                className={clsx(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                  activeTab === 'customer' ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-900"
                )}
              >
                HĐ Khách hàng
              </button>
              <button
                onClick={() => setActiveTab('supplier')}
                className={clsx(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                  activeTab === 'supplier' ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-900"
                )}
              >
                HĐ Nhà cung cấp
              </button>
            </div>

            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input
                type="text"
                placeholder="Tìm số HĐ, tên đối tác..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 bg-[#F5F5F7] border border-transparent rounded-xl text-xs focus:bg-white focus:border-blue-500 outline-none transition-all"
              />
            </div>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto">
            {filteredContracts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400">
                <FileText size={48} className="mb-3 text-slate-300 stroke-[1.5]" />
                <p className="text-sm font-semibold text-slate-600">Chưa có Hợp đồng nào</p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">
                  Hãy bấm "Thêm Hợp Đồng Mới" hoặc quét OCR hợp đồng PDF/scan để nạp danh mục đơn giá đối chiếu
                </p>
                <button
                  onClick={handleOpenAdd}
                  className="mt-4 px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl text-xs font-bold transition-all"
                >
                  + Thêm Hợp Đồng Đầu Tiên
                </button>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-[#F5F5F7] text-slate-500 font-semibold border-b border-black/[0.06] z-10">
                  <tr>
                    <th className="py-3 px-4">Số Hợp Đồng</th>
                    <th className="py-3 px-4">Đối Tác</th>
                    <th className="py-3 px-4">Loại HĐ</th>
                    <th className="py-3 px-4">Ngày Ký</th>
                    <th className="py-3 px-4">Thời Hạn</th>
                    <th className="py-3 px-4 text-right">Giá Trị (VNĐ)</th>
                    <th className="py-3 px-4 text-center">Trạng Thái</th>
                    <th className="py-3 px-4 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.04]">
                  {filteredContracts.map((contract, index) => {
                    const isSelected = selectedContract?.id === contract.id;
                    return (
                      <tr
                        key={contract.id || index}
                        onClick={() => setSelectedContract(contract)}
                        className={clsx(
                          "hover:bg-blue-50/50 cursor-pointer transition-colors",
                          isSelected ? "bg-blue-50/70" : ""
                        )}
                      >
                        <td className="py-3 px-4 font-mono font-bold text-blue-600">
                          {contract.contractNumber}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <CompanyLogo name={contract.partnerName} size="sm" />
                            <div>
                              <p className="font-bold text-slate-900 truncate max-w-[180px]">{contract.partnerName}</p>
                              <span className="text-[10px] text-slate-400">{contract.partnerType}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium text-[11px]">
                            {contract.contractType}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {formatDateForDisplay(contract.signDate)}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {formatDateForDisplay(contract.expirationDate) || 'Vô thời hạn'}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900">
                          {contract.totalValue ? formatVND(contract.totalValue) : 'Theo đơn đặt'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={clsx(
                            "px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1",
                            contract.status === 'Hiệu lực' ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                            contract.status === 'Hết hạn' ? "bg-red-50 text-red-700 border border-red-200" :
                            "bg-amber-50 text-amber-700 border border-amber-200"
                          )}>
                            <span className={clsx(
                              "w-1.5 h-1.5 rounded-full",
                              contract.status === 'Hiệu lực' ? "bg-emerald-500" :
                              contract.status === 'Hết hạn' ? "bg-red-500" : "bg-amber-500"
                            )} />
                            {contract.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => handleOpenEdit(contract)}
                              className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                              title="Chỉnh sửa"
                            >
                              <Edit3 size={14} />
                            </button>
                            <button
                              onClick={() => handleDelete(contract)}
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

        {/* Right: Contract Detail & Price Matching Panel */}
        <div className="w-full lg:w-96 bg-white rounded-2xl border border-black/[0.06] shadow-2xs flex flex-col min-h-[350px] overflow-hidden">
          {selectedContract ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Detail Header */}
              <div className="p-4 border-b border-black/[0.06] bg-[#F5F5F7] flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Chi Tiết Hợp Đồng</span>
                  <h3 className="text-sm font-bold text-slate-900 font-mono mt-0.5">{selectedContract.contractNumber}</h3>
                </div>
                <button
                  onClick={() => handleOpenEdit(selectedContract)}
                  className="px-2.5 py-1 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold shadow-2xs transition-all flex items-center gap-1"
                >
                  <Edit3 size={12} />
                  Sửa
                </button>
              </div>

              <div className="flex-1 overflow-auto p-5 space-y-5">
                {/* General Info */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Thông tin chung</h4>
                  <div className="bg-[#F5F5F7] p-3 rounded-xl space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Đối tác:</span>
                      <span className="font-bold text-slate-900 text-right">{selectedContract.partnerName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Loại hợp đồng:</span>
                      <span className="font-semibold text-slate-800">{selectedContract.contractType}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Ngày ký:</span>
                      <span className="font-medium text-slate-800">{formatDateForDisplay(selectedContract.signDate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Thời hạn:</span>
                      <span className="font-medium text-slate-800">
                        {formatDateForDisplay(selectedContract.effectiveDate)} ➔ {formatDateForDisplay(selectedContract.expirationDate) || 'Không thời hạn'}
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-slate-200/60 pt-2">
                      <span className="text-slate-500">Điều khoản TT:</span>
                      <span className="font-medium text-slate-800 text-right">{selectedContract.paymentTerms}</span>
                    </div>
                  </div>
                </div>

                {/* Price Table in Contract (Căn cứ đối chiếu) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Bảng Đơn Giá Ký Kết</h4>
                    <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                      {(selectedContract.products || []).length} mục
                    </span>
                  </div>

                  {(selectedContract.products || []).length === 0 ? (
                    <div className="p-4 bg-slate-50 rounded-xl text-center text-xs text-slate-400 border border-dashed border-slate-200">
                      Chưa nhập danh mục đơn giá cam kết trong hợp đồng này.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {(selectedContract.products || []).map((p, idx) => (
                        <div key={idx} className="p-3 bg-[#F5F5F7] rounded-xl border border-black/[0.04] space-y-1.5 text-xs">
                          <div className="flex justify-between items-start">
                            <span className="font-bold text-slate-900">{p.productName}</span>
                            <span className="font-bold text-blue-600 font-mono">{formatVND(p.contractPrice)}</span>
                          </div>
                          <div className="flex justify-between text-[11px] text-slate-500">
                            <span>ĐVT: {p.unit}</span>
                            {p.quantity ? <span>Số lượng: {p.quantity.toLocaleString('vi-VN')}</span> : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Appendices */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Phụ Lục Hợp Đồng</h4>
                    <span className="text-[10px] font-bold text-slate-500">
                      {(selectedContract.appendices || []).length} phụ lục
                    </span>
                  </div>

                  {(selectedContract.appendices || []).length === 0 ? (
                    <div className="p-3 bg-slate-50 rounded-xl text-center text-[11px] text-slate-400">
                      Không có phụ lục điều chỉnh giá
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {(selectedContract.appendices || []).map((app, idx) => (
                        <div key={idx} className="p-3 bg-amber-50/60 border border-amber-200/60 rounded-xl space-y-1 text-xs">
                          <div className="flex justify-between font-bold text-amber-900">
                            <span>{app.appendixNumber}</span>
                            <span className="text-[11px] font-normal text-amber-700">{formatDateForDisplay(app.signDate)}</span>
                          </div>
                          <p className="text-slate-700 text-[11px]">{app.title}</p>
                          {app.priceAdjustment && (
                            <span className="inline-block text-[10px] font-semibold text-emerald-700 bg-emerald-100/60 px-1.5 py-0.5 rounded">
                              {app.priceAdjustment}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-6 text-center text-slate-400">
              <Scale size={36} className="mb-2 text-slate-300 stroke-[1.5]" />
              <p className="text-xs font-bold text-slate-600">Chọn 1 Hợp đồng</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                để xem chi tiết điều khoản và danh mục đơn giá cam kết làm căn cứ kế toán
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Contract Modal - Apple macOS Window Style */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-black/[0.08] max-h-[90vh] flex flex-col">
            {/* Apple Header */}
            <div className="px-6 py-4 border-b border-black/[0.06] flex items-center justify-between bg-[#F5F5F7] shrink-0">
              <div className="flex items-center gap-3">
                <MacTrafficLights onClose={() => setIsModalOpen(false)} />
                <div className="h-4 w-px bg-black/[0.08]" />
                <h3 className="text-sm font-bold text-[#1D1D1F] flex items-center gap-2">
                  <FileText size={16} className="text-blue-600" />
                  {editingContract ? 'Cập Nhật Hợp Đồng' : 'Thêm Hợp Đồng Mới'}
                </h3>
              </div>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveContract} className="flex-1 overflow-auto p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Số Hợp Đồng *</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: 01/2026/HĐMB-TSG"
                    value={formData.contractNumber || ''}
                    onChange={e => setFormData({ ...formData, contractNumber: e.target.value })}
                    className="w-full px-3.5 py-2 bg-[#F5F5F7] border border-slate-200 rounded-xl text-xs font-mono font-bold focus:bg-white focus:border-blue-500 outline-none transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Trích yếu / Tiêu đề</label>
                  <input
                    type="text"
                    placeholder="Hợp đồng mua bán nguyên vật liệu..."
                    value={formData.title || ''}
                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3.5 py-2 bg-[#F5F5F7] border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-blue-500 outline-none transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Đối Tác (Khách / NCC) *</label>
                  <input
                    type="text"
                    required
                    list="partner-list"
                    placeholder="Chọn hoặc nhập tên đối tác"
                    value={formData.partnerName || ''}
                    onChange={e => setFormData({ ...formData, partnerName: e.target.value })}
                    className="w-full px-3.5 py-2 bg-[#F5F5F7] border border-slate-200 rounded-xl text-xs font-bold focus:bg-white focus:border-blue-500 outline-none transition-all"
                  />
                  <datalist id="partner-list">
                    {customerData.map((c, i) => (
                      <option key={`c-${i}`} value={c['Tên khách hàng'] || c['Khách hàng']} />
                    ))}
                    {supplierData.map((s, i) => (
                      <option key={`s-${i}`} value={s['Tên nhà cung cấp'] || s['Nhà cung cấp']} />
                    ))}
                  </datalist>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Phân Loại</label>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={formData.partnerType || 'Khách hàng'}
                      onChange={e => setFormData({ ...formData, partnerType: e.target.value as any })}
                      className="px-3 py-2 bg-[#F5F5F7] border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-blue-500 outline-none transition-all"
                    >
                      <option value="Khách hàng">Khách hàng</option>
                      <option value="Nhà cung cấp">Nhà cung cấp</option>
                    </select>
                    <select
                      value={formData.contractType || 'Bán hàng'}
                      onChange={e => setFormData({ ...formData, contractType: e.target.value as any })}
                      className="px-3 py-2 bg-[#F5F5F7] border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-blue-500 outline-none transition-all"
                    >
                      <option value="Bán hàng">Bán hàng</option>
                      <option value="Mua hàng">Mua hàng</option>
                      <option value="Nguyên tắc">Nguyên tắc</option>
                      <option value="Gia công">Gia công</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Ngày Ký</label>
                  <input
                    type="date"
                    value={formData.signDate || ''}
                    onChange={e => setFormData({ ...formData, signDate: e.target.value })}
                    className="w-full px-3.5 py-2 bg-[#F5F5F7] border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-blue-500 outline-none transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Ngày Hết Hạn</label>
                  <input
                    type="date"
                    value={formData.expirationDate || ''}
                    onChange={e => setFormData({ ...formData, expirationDate: e.target.value })}
                    className="w-full px-3.5 py-2 bg-[#F5F5F7] border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-blue-500 outline-none transition-all"
                  />
                </div>
              </div>

              {/* Product Pricing Section in Contract */}
              <div className="border-t border-slate-200 pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 uppercase">Danh Mục Sản Phẩm & Đơn Giá Cam Kết</h4>
                    <p className="text-[11px] text-slate-500">Căn cứ để kế toán đối chiếu chéo khi xuất hóa đơn & nhận PO</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddProductLine}
                    className="px-3 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                  >
                    <Plus size={14} />
                    Thêm Hàng Hóa
                  </button>
                </div>

                <div className="space-y-2">
                  {(formData.products || []).map((prod, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 bg-[#F5F5F7] p-3 rounded-xl items-center">
                      <div className="col-span-5">
                        <input
                          type="text"
                          placeholder="Tên sản phẩm / quy cách"
                          value={prod.productName}
                          onChange={e => {
                            const newProducts = [...(formData.products || [])];
                            newProducts[idx].productName = e.target.value;
                            setFormData({ ...formData, products: newProducts });
                          }}
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold outline-none"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="text"
                          placeholder="ĐVT (Thùng/Cái)"
                          value={prod.unit}
                          onChange={e => {
                            const newProducts = [...(formData.products || [])];
                            newProducts[idx].unit = e.target.value;
                            setFormData({ ...formData, products: newProducts });
                          }}
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none text-center"
                        />
                      </div>
                      <div className="col-span-4">
                        <input
                          type="number"
                          placeholder="Đơn giá (VNĐ)"
                          value={prod.contractPrice || ''}
                          onChange={e => {
                            const newProducts = [...(formData.products || [])];
                            newProducts[idx].contractPrice = parseFloat(e.target.value) || 0;
                            setFormData({ ...formData, products: newProducts });
                          }}
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-blue-600 outline-none text-right"
                        />
                      </div>
                      <div className="col-span-1 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveProductLine(idx)}
                          className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-200">
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
                  Lưu Hợp Đồng
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
