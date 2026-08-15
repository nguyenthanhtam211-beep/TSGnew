import React, { useState, useMemo } from 'react';
import { 
  Building2, MapPin, Tag, Plus, Search, Edit2, Trash2, X, 
  Upload, LayoutGrid, List, Users, Briefcase, CheckCircle2, 
  Clock, AlertCircle, Phone, FileText, Factory, Globe, Copy, 
  ExternalLink, ChevronRight, Eye, Columns, Cloud, 
  DownloadCloud, FileSpreadsheet, PhoneCall, Send, Sparkles
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { db, storage } from '../firebase';
import { ensureGoogleToken, clearStoredGoogleToken, openGoogleAuthTab } from '../lib/auth';
import { doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { handleFirestoreError, OperationType } from '../lib/errorHelper';
import { toast } from 'react-hot-toast';
import { cleanCompanyName, isNameRepetitive } from '../lib/companyUtils';
import CompanyLogo from './CompanyLogo';
import { getItemKey } from '../hooks/useFirestoreCollection';

export const getCustomerLogo = (c: any) => {
  if (!c) return '';
  return c.logoUrl || c.LogoUrl || c.Logo || c.logo || c.Logo_URL || c.logo_url || '';
};

export default function CustomerView({ initialData: customers = [], contacts = [] }: { initialData?: any[], contacts?: any[] }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [selectedCustomerDetail, setSelectedCustomerDetail] = useState<any>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isSyncingGoogle, setIsSyncingGoogle] = useState(false);
  const [isImportingGoogle, setIsImportingGoogle] = useState(false);

  // Helper to resolve linked contacts for a customer
  const getLinkedContacts = (customer: any) => {
    if (!contacts || contacts.length === 0) return [];
    return contacts.filter(c => {
      const explicitIds = String(customer["Liên hệ liên kết"] || "").split(',').map((id: string) => id.trim());
      if (explicitIds.includes(c.id) || explicitIds.includes(c.ID)) return true;
      
      const compName = String(c["Công ty"] || "").toLowerCase().trim();
      const custName = String(customer["Tên đầy đủ"] || "").toLowerCase().trim();
      const custCode = String(customer["Customer_ID"] || "").toLowerCase().trim();
      
      return compName && (compName === custName || compName === custCode || (custName.length > 3 && custName.includes(compName)));
    });
  };

  const handleSyncGoogle = async () => {
    setIsSyncingGoogle(true);
    const toastId = toast.loading("Đang đồng bộ tới Google Sheets & Drive...");
    try {
      let token = await ensureGoogleToken([
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive.file'
      ]);

      const savedSheetId = localStorage.getItem('google_spreadsheet_id') || '';

      let sheetsRes = await fetch('/api/sheets/sync', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          spreadsheetId: savedSheetId,
          customers: customers
        })
      });

      if (sheetsRes.status === 401) {
        clearStoredGoogleToken();
        token = await ensureGoogleToken([
          'https://www.googleapis.com/auth/spreadsheets',
          'https://www.googleapis.com/auth/drive.file'
        ], true);
        sheetsRes = await fetch('/api/sheets/sync', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            spreadsheetId: savedSheetId,
            customers: customers
          })
        });
      }

      const sheetsData = await sheetsRes.json();
      if (sheetsData.spreadsheetId) {
        localStorage.setItem('google_spreadsheet_id', sheetsData.spreadsheetId);
      }

      toast.success("Đã đồng bộ Google Sheets thành công!", { id: toastId });
    } catch (err: any) {
      toast.error(`Lỗi đồng bộ: ${err.message || err}`, { id: toastId });
    } finally {
      setIsSyncingGoogle(false);
    }
  };

  const [formData, setFormData] = useState({
    Customer_ID: '',
    "Tên đầy đủ": '',
    "Địa chỉ": '',
    "Nhà máy": '',
    "Mã số thuế": '',
    "Số điện thoại": '',
    "Website": '',
    "Phân loại": '',
    "Tình trạng": 'Đang mua',
    "Liên hệ liên kết": '',
    "Ghi chú": '',
    logoUrl: '',
    logoFit: 'contain'
  });

  const handleOpenModal = (customer: any = null) => {
    if (customer) {
      setEditingCustomer(customer);
      setFormData({
        Customer_ID: customer.Customer_ID || '',
        "Tên đầy đủ": customer["Tên đầy đủ"] || '',
        "Địa chỉ": customer["Địa chỉ"] || '',
        "Nhà máy": customer["Nhà máy"] || '',
        "Mã số thuế": customer["Mã số thuế"] || '',
        "Số điện thoại": customer["Số điện thoại"] || '',
        "Website": customer["Website"] || '',
        "Phân loại": customer["Phân loại"] || '',
        "Tình trạng": customer["Tình trạng"] || 'Đang mua',
        "Liên hệ liên kết": customer["Liên hệ liên kết"] || '',
        "Ghi chú": customer["Ghi chú"] || '',
        logoUrl: getCustomerLogo(customer),
        logoFit: customer.logoFit || 'contain'
      });
      setLogoPreview(getCustomerLogo(customer));
    } else {
      setEditingCustomer(null);
      setFormData({
        Customer_ID: `CUST_${Date.now().toString().slice(-4)}`,
        "Tên đầy đủ": '',
        "Địa chỉ": '',
        "Nhà máy": '',
        "Mã số thuế": '',
        "Số điện thoại": '',
        "Website": '',
        "Phân loại": '',
        "Tình trạng": 'Đang mua',
        "Liên hệ liên kết": '',
        "Ghi chú": '',
        logoUrl: '',
        logoFit: 'contain'
      });
      setLogoPreview(null);
    }
    setLogoFile(null);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const loadingToast = toast.loading("Đang lưu khách hàng...");
    try {
      let finalLogoUrl = formData.logoUrl;

      if (logoFile) {
        try {
          const storageRef = ref(storage, `customer_logos/${formData.Customer_ID}_${Date.now()}`);
          const uploadRes = await uploadBytes(storageRef, logoFile);
          finalLogoUrl = await getDownloadURL(uploadRes.ref);
        } catch (uploadErr) {
          console.warn("Storage upload warning:", uploadErr);
        }
      }

      const payload = {
        ...formData,
        logoUrl: finalLogoUrl,
        updatedAt: new Date().toISOString()
      };

      const rawDocId = editingCustomer?.id || getItemKey(editingCustomer || payload, 'customers') || formData.Customer_ID;
      const docId = String(rawDocId).replace(/[/\\#?%[\]\s.]+/g, '_');

      await setDoc(doc(db, 'customers', docId), payload, { merge: true });

      toast.success(editingCustomer ? "Đã cập nhật hồ sơ khách hàng!" : "Đã thêm khách hàng mới!", { id: loadingToast });
      setIsModalOpen(false);
    } catch (error) {
      toast.error("Đã xảy ra lỗi khi lưu thông tin!", { id: loadingToast });
      handleFirestoreError(error, OperationType.WRITE, 'customers');
    }
  };

  const handleDelete = async (id: string, customerId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Bạn có chắc chắn muốn xóa khách hàng "${customerId}"?`)) return;
    const loadingToast = toast.loading("Đang xoá khách hàng...");
    try {
      const targetId = id || getItemKey({ Customer_ID: customerId }, 'customers') || customerId;
      const docId = String(targetId).replace(/[/\\#?%[\]\s.]+/g, '_');
      await setDoc(doc(db, 'customers', docId), { isDeleted: true }, { merge: true });

      toast.success("Đã xoá khách hàng thành công!", { id: loadingToast });
      if (selectedCustomerDetail?.id === docId || selectedCustomerDetail?.["Customer_ID"] === customerId) {
        setSelectedCustomerDetail(null);
      }
    } catch (error) {
      toast.error("Không thể xoá khách hàng!", { id: loadingToast });
      handleFirestoreError(error, OperationType.DELETE, `customers/${id || customerId}`);
    }
  };

  const copyToClipboard = (text: string, label: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(text);
    toast.success(`Đã sao chép ${label}: ${text}`);
  };

  // KPIs
  const stats = useMemo(() => {
    const total = customers.length;
    const active = customers.filter(c => c["Tình trạng"] === "Đang mua").length;
    const negotiating = customers.filter(c => c["Tình trạng"] === "Đang đàm phán").length;
    const stopped = customers.filter(c => c["Tình trạng"] === "Ngừng mua").length;
    const totalContacts = contacts.length;

    return { total, active, negotiating, stopped, totalContacts };
  }, [customers, contacts]);

  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      const matchSearch = 
        c["Customer_ID"]?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c["Tên đầy đủ"]?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c["Địa chỉ"]?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c["Mã số thuế"]?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c["Số điện thoại"]?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchStatus = statusFilter === 'all' || c["Tình trạng"] === statusFilter;
      const matchCategory = categoryFilter === 'all' || c["Phân loại"] === categoryFilter;
      
      return matchSearch && matchStatus && matchCategory;
    });
  }, [customers, searchTerm, statusFilter, categoryFilter]);

  const handleExportToExcel = () => {
    try {
      const exportData = filteredCustomers.map(c => ({
        "Mã KH": c["Customer_ID"] || "",
        "Tên doanh nghiệp": cleanCompanyName(c["Tên đầy đủ"] || ""),
        "Tên pháp lý": c["Tên đầy đủ"] || "",
        "Phân loại": c["Phân loại"] || "",
        "Tình trạng": c["Tình trạng"] || "Đang mua",
        "Mã số thuế": c["Mã số thuế"] || "",
        "Số điện thoại": c["Số điện thoại"] || "",
        "Địa chỉ trụ sở": c["Địa chỉ"] || "",
        "Địa chỉ nhà máy": c["Nhà máy"] || "",
        "Website": c["Website"] || "",
        "Ghi chú": c["Ghi chú"] || ""
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Khach_Hang_TSG");
      XLSX.writeFile(wb, `Danh_Sach_Khach_Hang_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success("Đã xuất file Excel thành công!");
    } catch (err: any) {
      toast.error("Lỗi xuất Excel: " + (err?.message || err));
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-white min-h-screen text-slate-900 font-sans">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-5 pb-24 lg:pb-12">
        
        {/* Apple macOS Clean Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                Khách Hàng
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                {customers.length}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Quản lý hồ sơ pháp lý, địa chỉ nhà máy và mạng lưới nhân sự liên kết.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={handleExportToExcel}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-xs"
              title="Xuất danh sách ra Excel"
            >
              <FileSpreadsheet size={15} className="text-emerald-600" />
              <span>Xuất Excel</span>
            </button>

            <button
              onClick={handleSyncGoogle}
              disabled={isSyncingGoogle}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-all shadow-xs disabled:opacity-50"
              title="Đồng bộ Google Sheets"
            >
              <Cloud size={15} className={`text-blue-600 ${isSyncingGoogle ? "animate-spin" : ""}`} />
              <span>{isSyncingGoogle ? "Đang đồng bộ..." : "Đồng bộ Sheets"}</span>
            </button>

            <button 
              onClick={() => handleOpenModal()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#0071E3] hover:bg-[#0066D6] transition-all shadow-xs"
            >
              <Plus size={16} />
              <span>Thêm khách hàng</span>
            </button>
          </div>
        </div>

        {/* Apple Metrics Bar (Subtle & Clean) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-100 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-medium text-slate-400 block">Đang mua hàng</span>
              <span className="text-lg font-bold text-emerald-600 mt-0.5 block">{stats.active}</span>
            </div>
            <div className="h-8 w-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">
              ✓
            </div>
          </div>

          <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-100 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-medium text-slate-400 block">Đang đàm phán</span>
              <span className="text-lg font-bold text-amber-600 mt-0.5 block">{stats.negotiating}</span>
            </div>
            <div className="h-8 w-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold">
              ⏳
            </div>
          </div>

          <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-100 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-medium text-slate-400 block">Tạm dừng</span>
              <span className="text-lg font-bold text-slate-600 mt-0.5 block">{stats.stopped}</span>
            </div>
            <div className="h-8 w-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold">
              —
            </div>
          </div>

          <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-100 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-medium text-slate-400 block">Nhân sự liên kết</span>
              <span className="text-lg font-bold text-blue-600 mt-0.5 block">{stats.totalContacts}</span>
            </div>
            <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
              👥
            </div>
          </div>
        </div>

        {/* Search & Apple Segmented Control Toolbar */}
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          
          {/* Search Field */}
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Tìm theo mã, tên doanh nghiệp, địa chỉ, MST..."
              className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3] text-xs sm:text-sm transition-all placeholder:text-slate-400"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-between md:justify-end">
            
            {/* Apple Segmented Pill Filter */}
            <div className="flex bg-slate-100 p-1 rounded-xl gap-0.5 overflow-x-auto max-w-full">
              {[
                { key: 'all', label: `Tất cả (${stats.total})` },
                { key: 'Đang mua', label: `Đang mua (${stats.active})` },
                { key: 'Đang đàm phán', label: `Đàm phán (${stats.negotiating})` },
                { key: 'Ngừng mua', label: `Tạm dừng (${stats.stopped})` },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setStatusFilter(tab.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                    statusFilter === tab.key
                      ? 'bg-white text-slate-900 shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* View Mode Toggle */}
            <div className="flex bg-slate-100 p-1 rounded-xl gap-0.5 shrink-0">
              <button 
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg text-xs transition-all ${viewMode === 'table' ? 'bg-white text-[#0071E3] shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                title="Dạng Bảng"
              >
                <List size={16} />
              </button>
              <button 
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg text-xs transition-all ${viewMode === 'grid' ? 'bg-white text-[#0071E3] shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                title="Dạng Thẻ"
              >
                <LayoutGrid size={16} />
              </button>
            </div>

          </div>
        </div>

        {/* Content View */}
        {filteredCustomers.length > 0 ? (
          
          /* MODE 1: APPLE CLEAN TABLE */
          viewMode === 'table' ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs sm:text-sm text-left border-collapse">
                  <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200 text-xs">
                    <tr>
                      <th className="px-5 py-3.5">Mã & Doanh nghiệp</th>
                      <th className="px-5 py-3.5">Địa chỉ trụ sở</th>
                      <th className="px-5 py-3.5">Nhà máy</th>
                      <th className="px-5 py-3.5">Mã số thuế</th>
                      <th className="px-5 py-3.5">Trạng thái</th>
                      <th className="px-5 py-3.5">Nhân sự</th>
                      <th className="px-5 py-3.5 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredCustomers.map((customer, idx) => {
                      const cleanName = cleanCompanyName(customer["Tên đầy đủ"] || "");
                      const cardStatus = customer["Tình trạng"] || "Đang mua";
                      const linkedContacts = getLinkedContacts(customer);
                      const customerKey = customer.id || customer.Customer_ID || `cust-row-${idx}`;

                      return (
                        <tr 
                          key={customerKey}
                          onClick={() => setSelectedCustomerDetail(customer)}
                          className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                        >
                          {/* Company Name & Logo */}
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-3">
                              <CompanyLogo 
                                name={customer["Tên đầy đủ"] || cleanName} 
                                size="sm" 
                                className="shrink-0 rounded-lg shadow-2xs" 
                                logoUrl={getCustomerLogo(customer)} 
                                logoFit={customer.logoFit} 
                              />
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] font-mono font-semibold text-slate-400 uppercase">
                                    {customer["Customer_ID"]}
                                  </span>
                                  {customer["Phân loại"] && (
                                    <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-medium">
                                      {customer["Phân loại"]}
                                    </span>
                                  )}
                                </div>
                                <div className="font-semibold text-slate-900 group-hover:text-[#0071E3] transition-colors truncate mt-0.5">
                                  {cleanName}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Address */}
                          <td className="px-5 py-3 text-slate-600 max-w-xs">
                            <span className="line-clamp-1 text-xs" title={customer["Địa chỉ"]}>
                              {customer["Địa chỉ"] || "—"}
                            </span>
                          </td>

                          {/* Factory */}
                          <td className="px-5 py-3 text-slate-600 max-w-xs">
                            <span className="line-clamp-1 text-xs" title={customer["Nhà máy"]}>
                              {customer["Nhà máy"] || "—"}
                            </span>
                          </td>

                          {/* Tax Code */}
                          <td className="px-5 py-3 font-mono text-xs text-slate-700" onClick={(e) => e.stopPropagation()}>
                            {customer["Mã số thuế"] ? (
                              <button 
                                onClick={(e) => copyToClipboard(customer["Mã số thuế"], "Mã số thuế", e)}
                                className="hover:text-blue-600 transition-colors"
                                title="Sao chép MST"
                              >
                                {customer["Mã số thuế"]}
                              </button>
                            ) : "—"}
                          </td>

                          {/* Status */}
                          <td className="px-5 py-3">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium ${
                              cardStatus === "Đang mua" 
                                ? "bg-emerald-50 text-emerald-700" 
                                : cardStatus === "Đang đàm phán" 
                                ? "bg-amber-50 text-amber-700" 
                                : "bg-slate-100 text-slate-600"
                            }`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${
                                cardStatus === "Đang mua" ? "bg-emerald-500" : cardStatus === "Đang đàm phán" ? "bg-amber-500" : "bg-slate-400"
                              }`} />
                              {cardStatus}
                            </span>
                          </td>

                          {/* Contacts Count */}
                          <td className="px-5 py-3">
                            {linkedContacts.length > 0 ? (
                              <span className="text-xs text-slate-600 font-medium">
                                {linkedContacts.length} liên hệ
                              </span>
                            ) : (
                              <span className="text-xs text-slate-300">—</span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="px-5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => setSelectedCustomerDetail(customer)}
                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Xem hồ sơ"
                              >
                                <Eye size={15} />
                              </button>
                              <button 
                                onClick={() => handleOpenModal(customer)}
                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                title="Chỉnh sửa"
                              >
                                <Edit2 size={15} />
                              </button>
                              <button 
                                onClick={(e) => handleDelete(customer.id, customer.Customer_ID, e)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Xóa"
                              >
                                <Trash2 size={15} />
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
          ) : (
            
            /* MODE 2: APPLE CLEAN CARDS */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCustomers.map((customer, idx) => {
                const cleanName = cleanCompanyName(customer["Tên đầy đủ"] || "");
                const cardStatus = customer["Tình trạng"] || "Đang mua";
                const linkedContacts = getLinkedContacts(customer);
                const customerKey = customer.id || customer.Customer_ID || `cust-card-${idx}`;

                return (
                  <div 
                    key={customerKey}
                    onClick={() => setSelectedCustomerDetail(customer)}
                    className="bg-white rounded-2xl border border-slate-200 p-4 hover:border-slate-300 hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <CompanyLogo 
                            name={customer["Tên đầy đủ"] || cleanName} 
                            size="md" 
                            className="shrink-0 rounded-xl shadow-2xs mt-0.5" 
                            logoUrl={getCustomerLogo(customer)} 
                            logoFit={customer.logoFit} 
                          />
                          <div className="min-w-0">
                            <span className="text-[10px] font-mono font-semibold text-slate-400 uppercase block">
                              {customer["Customer_ID"]}
                            </span>
                            <h3 className="font-semibold text-slate-900 text-sm truncate mt-0.5" title={cleanName}>
                              {cleanName}
                            </h3>
                            {customer["Phân loại"] && (
                              <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-medium mt-1 inline-block">
                                {customer["Phân loại"]}
                              </span>
                            )}
                          </div>
                        </div>

                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0 ${
                          cardStatus === "Đang mua" 
                            ? "bg-emerald-50 text-emerald-700" 
                            : cardStatus === "Đang đàm phán" 
                            ? "bg-amber-50 text-amber-700" 
                            : "bg-slate-100 text-slate-600"
                        }`}>
                          {cardStatus}
                        </span>
                      </div>

                      <div className="mt-3.5 pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
                        {customer["Địa chỉ"] && (
                          <div className="flex items-start gap-2">
                            <MapPin size={13} className="text-slate-400 shrink-0 mt-0.5" />
                            <span className="line-clamp-1 text-slate-700" title={customer["Địa chỉ"]}>
                              {customer["Địa chỉ"]}
                            </span>
                          </div>
                        )}
                        {customer["Nhà máy"] && (
                          <div className="flex items-start gap-2">
                            <Factory size={13} className="text-slate-400 shrink-0 mt-0.5" />
                            <span className="line-clamp-1 text-slate-500" title={customer["Nhà máy"]}>
                              {customer["Nhà máy"]}
                            </span>
                          </div>
                        )}
                        {customer["Mã số thuế"] && (
                          <div className="flex items-center gap-2 font-mono text-slate-500">
                            <FileText size={13} className="text-slate-400 shrink-0" />
                            <span>MST: {customer["Mã số thuế"]}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs" onClick={(e) => e.stopPropagation()}>
                      <div className="text-slate-500">
                        {linkedContacts.length > 0 ? (
                          <span className="font-medium text-blue-600">{linkedContacts.length} người liên hệ</span>
                        ) : (
                          <span className="text-slate-400 italic">Chưa có liên hệ</span>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => handleOpenModal(customer)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition-colors"
                          title="Chỉnh sửa"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button 
                          onClick={(e) => handleDelete(customer.id, customer.Customer_ID, e)}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg transition-colors"
                          title="Xóa"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          )

        ) : (
          <div className="bg-slate-50 rounded-2xl border border-slate-200 p-10 text-center space-y-2">
            <Building2 size={36} className="mx-auto text-slate-300" />
            <div className="text-sm font-semibold text-slate-700">Không tìm thấy khách hàng</div>
            <p className="text-xs text-slate-400">Thử tìm kiếm với từ khóa khác.</p>
          </div>
        )}

      </div>

      {/* Dynamic Add/Edit Customer Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-xl flex flex-col max-h-[90vh] overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/80">
              <h3 className="text-base font-bold text-slate-900">
                {editingCustomer ? 'Chỉnh sửa hồ sơ khách hàng' : 'Thêm khách hàng mới'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 overflow-y-auto flex-1 space-y-4 text-xs sm:text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Mã khách hàng</label>
                  <input
                    type="text"
                    required
                    value={formData.Customer_ID}
                    onChange={(e) => setFormData({ ...formData, Customer_ID: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm outline-none font-mono uppercase"
                    placeholder="VD: CUST-TL"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Phân loại</label>
                  <input
                    type="text"
                    value={formData["Phân loại"]}
                    onChange={(e) => setFormData({ ...formData, "Phân loại": e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm outline-none"
                    placeholder="VD: Carton / Tem nhãn"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Tên đầy đủ (Tên pháp lý)</label>
                <input
                  type="text"
                  required
                  value={formData["Tên đầy đủ"]}
                  onChange={(e) => setFormData({ ...formData, "Tên đầy đủ": e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm outline-none"
                  placeholder="Công ty Cổ phần Bao bì..."
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Địa chỉ trụ sở</label>
                <input
                  type="text"
                  value={formData["Địa chỉ"]}
                  onChange={(e) => setFormData({ ...formData, "Địa chỉ": e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm outline-none"
                  placeholder="Số nhà, đường, quận/huyện, tỉnh thành"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Địa chỉ nhà máy (Giao hàng)</label>
                <input
                  type="text"
                  value={formData["Nhà máy"]}
                  onChange={(e) => setFormData({ ...formData, "Nhà máy": e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm outline-none"
                  placeholder="Khu công nghiệp..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Mã số thuế</label>
                  <input
                    type="text"
                    value={formData["Mã số thuế"]}
                    onChange={(e) => setFormData({ ...formData, "Mã số thuế": e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm outline-none font-mono"
                    placeholder="0101..."
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Trạng thái</label>
                  <select
                    value={formData["Tình trạng"]}
                    onChange={(e) => setFormData({ ...formData, "Tình trạng": e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm outline-none"
                  >
                    <option value="Đang mua">Đang mua</option>
                    <option value="Đang đàm phán">Đang đàm phán</option>
                    <option value="Ngừng mua">Ngừng mua</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Ghi chú</label>
                <textarea
                  rows={2}
                  value={formData["Ghi chú"]}
                  onChange={(e) => setFormData({ ...formData, "Ghi chú": e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm outline-none"
                  placeholder="Thông tin thêm..."
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2.5">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)} 
                  className="px-4 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
                >
                  Hủy
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2 text-xs font-semibold text-white bg-[#0071E3] hover:bg-[#0066D6] rounded-xl shadow-xs transition-all"
                >
                  {editingCustomer ? 'Lưu' : 'Thêm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer Detail Drawer / Modal */}
      {selectedCustomerDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
            
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/80">
              <div className="flex items-center gap-3">
                <CompanyLogo 
                  name={selectedCustomerDetail["Tên đầy đủ"] || selectedCustomerDetail["Customer_ID"]} 
                  size="md" 
                  className="rounded-xl shadow-2xs" 
                  logoUrl={getCustomerLogo(selectedCustomerDetail)} 
                  logoFit={selectedCustomerDetail.logoFit} 
                />
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {cleanCompanyName(selectedCustomerDetail["Tên đầy đủ"] || selectedCustomerDetail["Customer_ID"])}
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    {selectedCustomerDetail["Customer_ID"]} • {selectedCustomerDetail["Phân loại"] || "Khách hàng"}
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedCustomerDetail(null)} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg">
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs sm:text-sm">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[11px] text-slate-400 font-medium block">Tên pháp lý</span>
                  <div className="font-semibold text-slate-800 mt-0.5">
                    {selectedCustomerDetail["Tên đầy đủ"] || "—"}
                  </div>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[11px] text-slate-400 font-medium block">Mã số thuế</span>
                  <div className="font-mono font-semibold text-slate-800 mt-0.5">
                    {selectedCustomerDetail["Mã số thuế"] || "—"}
                  </div>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                <div>
                  <span className="text-[11px] text-slate-400 font-medium block">Địa chỉ trụ sở</span>
                  <div className="text-slate-700 mt-0.5">
                    {selectedCustomerDetail["Địa chỉ"] || "Chưa cập nhật địa chỉ trụ sở"}
                  </div>
                </div>
                {selectedCustomerDetail["Nhà máy"] && (
                  <div className="pt-2 border-t border-slate-200/60">
                    <span className="text-[11px] text-slate-400 font-medium block">Địa chỉ nhà máy giao hàng</span>
                    <div className="text-slate-700 mt-0.5">
                      {selectedCustomerDetail["Nhà máy"]}
                    </div>
                  </div>
                )}
              </div>

              {/* Linked Contacts */}
              <div>
                <span className="font-bold text-slate-800 text-xs block mb-2">
                  Nhân sự liên hệ ({getLinkedContacts(selectedCustomerDetail).length})
                </span>
                <div className="space-y-1.5">
                  {getLinkedContacts(selectedCustomerDetail).length === 0 ? (
                    <div className="text-slate-400 text-xs py-3 italic">Chưa có liên hệ nào trong danh bạ gắn với khách hàng này.</div>
                  ) : (
                    getLinkedContacts(selectedCustomerDetail).map((c: any, cidx: number) => (
                      <div key={cidx} className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                        <div>
                          <span className="font-semibold text-slate-800">{c["Tên"]}</span>
                          {c["Chức vụ"] && <span className="text-slate-400 ml-1.5 text-xs">({c["Chức vụ"]})</span>}
                        </div>
                        {c["Điện thoại"] && (
                          <a href={`tel:${c["Điện thoại"]}`} className="text-blue-600 font-mono text-xs font-semibold">
                            {c["Điện thoại"]}
                          </a>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
