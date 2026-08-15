import React, { useState, useEffect, useMemo } from 'react';
import { db, storage } from '../firebase';
import { collection, onSnapshot, addDoc, updateDoc, doc, deleteDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { handleFirestoreError, OperationType } from '../lib/errorHelper';
import { 
  Building2, 
  MapPin, 
  Star, 
  Globe, 
  PlusCircle, 
  Search, 
  Edit2, 
  Trash2, 
  X, 
  LayoutGrid, 
  List, 
  Award, 
  Factory, 
  AlertCircle, 
  CheckCircle2, 
  ShieldAlert, 
  ExternalLink,
  Phone,
  FileText,
  UserCheck,
  FileSpreadsheet,
  Sparkles,
  Eye,
  Copy
} from 'lucide-react';
import * as XLSX from 'xlsx';
import CompanyLogo from './CompanyLogo';
import { getItemKey } from '../hooks/useFirestoreCollection';

export const getSupplierLogo = (s: any) => {
  if (!s) return '';
  return s.logoUrl || s.LogoUrl || s.Logo || s.logo || s.Logo_URL || s.logo_url || '';
};
import { toast } from 'react-hot-toast';
import { cleanCompanyName, isNameRepetitive } from '../lib/companyUtils';

export default function SupplierView({ initialData: suppliers = [], contacts = [] }: { initialData?: any[], contacts?: any[] }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<any>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  
  const getLinkedContacts = (supplier: any) => {
    if (!contacts || contacts.length === 0) return [];
    return contacts.filter(c => {
      const explicitIds = String(supplier["Liên hệ liên kết"] || "").split(',').map((id: string) => id.trim());
      if (explicitIds.includes(c.id) || explicitIds.includes(c.ID)) return true;
      
      const compName = String(c["Công ty"] || "").toLowerCase().trim();
      const suppName = String(supplier["Tên Nhà Cung Cấp"] || "").toLowerCase().trim();
      const suppCode = String(supplier["Mã nhà cung cấp"] || "").toLowerCase().trim();
      
      return compName && (compName === suppName || compName === suppCode || (suppName.length > 3 && suppName.includes(compName)));
    });
  };

  const [formData, setFormData] = useState({
    "Mã nhà cung cấp": "",
    "Tên Nhà Cung Cấp": "",
    "Nhóm hàng": "",
    "Tình trạng": "Đang hoạt động",
    "Đánh giá": "5",
    "Địa chỉ": "",
    "Nhà máy": "",
    "Số điện thoại": "",
    "Mã số thuế": "",
    "logoUrl": "",
    "Liên hệ liên kết": "",
    "Website": "",
    "logoFit": "contain"
  });

  const handleOpenModal = (supplier: any = null) => {
    if (supplier) {
      setEditingSupplier(supplier);
      const existingLogo = getSupplierLogo(supplier);
      setFormData({
        "Mã nhà cung cấp": supplier["Mã nhà cung cấp"] || "",
        "Tên Nhà Cung Cấp": supplier["Tên Nhà Cung Cấp"] || "",
        "Nhóm hàng": supplier["Nhóm hàng"] || "",
        "Tình trạng": supplier["Tình trạng"] || "Đang hoạt động",
        "Đánh giá": supplier["Đánh giá"] || "5",
        "Địa chỉ": supplier["Địa chỉ"] || "",
        "Nhà máy": supplier["Nhà máy"] || "",
        "Số điện thoại": supplier["Số điện thoại"] || "",
        "Mã số thuế": supplier["Mã số thuế"] || "",
        "logoUrl": existingLogo,
        "Liên hệ liên kết": supplier["Liên hệ liên kết"] || "",
        "Website": supplier["Website"] || "",
        "logoFit": supplier["logoFit"] || "contain"
      });
      setLogoPreview(existingLogo || null);
    } else {
      setEditingSupplier(null);
      setFormData({
        "Mã nhà cung cấp": "",
        "Tên Nhà Cung Cấp": "",
        "Nhóm hàng": "",
        "Tình trạng": "Đang hoạt động",
        "Đánh giá": "5",
        "Địa chỉ": "",
        "Nhà máy": "",
        "Số điện thoại": "",
        "Mã số thuế": "",
        "logoUrl": "",
        "Liên hệ liên kết": "",
        "Website": "",
        "logoFit": "contain"
      });
      setLogoPreview(null);
    }
    setLogoFile(null);
    setIsModalOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setLogoFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setLogoPreview(result);
        setFormData(prev => ({ ...prev, logoUrl: result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData["Mã nhà cung cấp"] || !formData["Tên Nhà Cung Cấp"]) {
      toast.error("Vui lòng điền đủ Mã nhà cung cấp và Tên nhà cung cấp!");
      return;
    }

    const code = formData["Mã nhà cung cấp"].trim();
    const isDuplicate = suppliers.some(s => 
      s["Mã nhà cung cấp"]?.trim().toLowerCase() === code.toLowerCase() && 
      (!editingSupplier || (s.id !== editingSupplier.id && s["Mã nhà cung cấp"] !== editingSupplier["Mã nhà cung cấp"]))
    );
    if (isDuplicate && !editingSupplier) {
      toast.error(`Mã nhà cung cấp "${code}" đã tồn tại trên hệ thống! Vui lòng chọn mã khác.`);
      return;
    }
    
    const loadingToast = toast.loading(editingSupplier ? "Đang cập nhật nhà cung cấp..." : "Đang thêm nhà cung cấp mới...");
    
    try {
      let logoUrl = formData.logoUrl || getSupplierLogo(editingSupplier) || "";

      if (logoFile) {
        try {
          const sanitizedCode = code.replace(/[/\\#?%[\]\s.]+/g, '_');
          const storageRef = ref(storage, `logos_suppliers/${sanitizedCode}`);
          await uploadBytes(storageRef, logoFile);
          logoUrl = await getDownloadURL(storageRef);
        } catch (storageError) {
          console.warn("Storage upload failed or unavailable, using preview URL:", storageError);
          if (logoPreview) {
            logoUrl = logoPreview;
          }
        }
      } else if (logoPreview && !logoUrl) {
        logoUrl = logoPreview;
      }

      const payload = { 
        ...formData, 
        "Mã nhà cung cấp": code,
        logoUrl,
        LogoUrl: logoUrl,
        Logo: logoUrl,
        updatedAt: new Date().toISOString()
      };

      const rawDocId = editingSupplier?.id || getItemKey(editingSupplier || payload, 'suppliers') || code;
      const docId = String(rawDocId).replace(/[/\\#?%[\]\s.]+/g, '_');

      await setDoc(doc(db, 'suppliers', docId), payload, { merge: true });
      toast.success(editingSupplier ? "Cập nhật thông tin nhà cung cấp thành công!" : "Thêm nhà cung cấp mới thành công!", { id: loadingToast });
      setIsModalOpen(false);
    } catch (error) {
      console.error("Update supplier error:", error);
      toast.error("Đã xảy ra lỗi khi lưu thông tin!", { id: loadingToast });
      handleFirestoreError(error, OperationType.WRITE, 'suppliers');
    }
  };

  const handleDelete = async (id: string, supplierId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (true) {
      const loadingToast = toast.loading("Đang xoá nhà cung cấp...");
      try {
        const docId = id || supplierId;
        await setDoc(doc(db, 'suppliers', docId), { isDeleted: true }, { merge: true });
        toast.success("Đã xoá nhà cung cấp thành công!", { id: loadingToast });
      } catch (error) {
        toast.error("Không thể xoá nhà cung cấp!", { id: loadingToast });
        handleFirestoreError(error, OperationType.DELETE, 'suppliers');
      }
    }
  };

  const filteredSuppliers = useMemo(() => {
    // Unique by supplier ID to prevent duplicate listings
    const uniqueSuppliers = suppliers.filter((s, index, self) => 
      index === self.findIndex((t) => (
        t["Mã nhà cung cấp"]?.trim() === s["Mã nhà cung cấp"]?.trim()
      ))
    );

    return uniqueSuppliers.filter(c => {
      const matchSearch = 
        c["Mã nhà cung cấp"]?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c["Tên Nhà Cung Cấp"]?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c["Địa chỉ"]?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c["Nhóm hàng"]?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchStatus = statusFilter === 'all' || c["Tình trạng"] === statusFilter;
      
      return matchSearch && matchStatus;
    });
  }, [suppliers, searchTerm, statusFilter]);

  // KPIs
  const stats = useMemo(() => {
    const total = suppliers.length;
    const active = suppliers.filter(s => s["Tình trạng"] === "Đang hoạt động").length;
    const paused = suppliers.filter(s => s["Tình trạng"] === "Tạm ngưng" || s["Tình trạng"] === "Tạm dừng").length;
    const highlyRated = suppliers.filter(s => parseInt(s["Đánh giá"] || "0") >= 5).length;

    return { total, active, paused, highlyRated };
  }, [suppliers]);

  const [selectedSupplierDetail, setSelectedSupplierDetail] = useState<any>(null);

  const handleExportToExcel = () => {
    try {
      const exportData = filteredSuppliers.map(s => ({
        "Mã NCC": s["Mã nhà cung cấp"] || "",
        "Tên nhà cung cấp": cleanCompanyName(s["Tên Nhà Cung Cấp"] || ""),
        "Tên pháp lý": s["Tên Nhà Cung Cấp"] || "",
        "Nhóm hàng": s["Nhóm hàng"] || "",
        "Tình trạng": s["Tình trạng"] || "Đang hoạt động",
        "Đánh giá": `${s["Đánh giá"] || "5"} sao`,
        "Mã số thuế": s["Mã số thuế"] || "",
        "Số điện thoại": s["Số điện thoại"] || "",
        "Địa chỉ trụ sở": s["Địa chỉ"] || "",
        "Địa chỉ nhà máy": s["Nhà máy"] || "",
        "Website": s["Website"] || "",
        "Ghi chú": s["Ghi chú"] || ""
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Nha_Cung_Cap_TSG");
      XLSX.writeFile(wb, `Danh_Ba_Nha_Cung_Cap_TSG_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success("Đã xuất danh bạ nhà cung cấp ra file Excel thành công!");
    } catch (err: any) {
      toast.error("Lỗi xuất Excel: " + (err?.message || err));
    }
  };

  const copyToClipboard = (text: string, label: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(text);
    toast.success(`Đã sao chép ${label}: ${text}`);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/70 min-h-screen">
      <div className="p-3 sm:p-5 lg:p-8 max-w-[1600px] mx-auto space-y-5 sm:space-y-6 pb-24 lg:pb-8">
        
        {/* Hero Header with Decorative Gradient Banner */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-purple-950 to-indigo-950 p-5 sm:p-8 text-white shadow-xl shadow-purple-950/20 border border-slate-800">
          <div className="absolute right-0 top-0 -mt-10 -mr-10 w-96 h-96 rounded-full bg-purple-500/10 blur-3xl pointer-events-none" />
          <div className="absolute left-1/3 bottom-0 w-80 h-80 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5 sm:gap-6">
            <div className="space-y-1.5 sm:space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-400/30 text-purple-300 text-xs font-semibold backdrop-blur-md">
                <Sparkles size={14} className="text-purple-400 animate-pulse" />
                <span>Hệ Thống Quản Trị Chuỗi Cung Ứng & NCC Chiến Lược</span>
              </div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2.5 sm:gap-3">
                <Factory className="text-purple-400 shrink-0" size={30} />
                Danh Mục Nhà Cung Cấp TSG
              </h1>
              <p className="text-slate-300 text-xs sm:text-sm max-w-2xl leading-relaxed">
                Quản lý hồ sơ đối tác gia công, nhà máy bao bì, phân loại nhóm nguyên vật liệu và xếp hạng uy tín cung ứng.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">
              <button
                onClick={handleExportToExcel}
                className="inline-flex items-center justify-center gap-2 bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3.5 py-2.5 sm:py-3 rounded-2xl font-bold text-xs sm:text-sm transition-all duration-300 shadow-md hover:-translate-y-0.5"
                title="Xuất toàn bộ danh bạ nhà cung cấp ra Excel"
              >
                <FileSpreadsheet size={16} className="text-emerald-400" />
                <span>Xuất Excel</span>
              </button>

              <button 
                onClick={() => handleOpenModal()}
                className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-2xl font-bold text-xs sm:text-sm transition-all duration-300 shadow-lg shadow-purple-600/25 hover:shadow-purple-600/40 hover:-translate-y-0.5 active:translate-y-0 border border-purple-400/30"
              >
                <PlusCircle size={18} />
                <span>Thêm Nhà Cung Cấp</span>
              </button>
            </div>
          </div>

          {/* Quick Filter Tabs inside Hero */}
          <div className="flex flex-wrap gap-2 mt-5 pt-5 border-t border-slate-800/80">
            {[
              { key: 'all', label: `Tất cả NCC (${stats.total})` },
              { key: 'Đang hoạt động', label: `Đang hoạt động (${stats.active})` },
              { key: 'rated_5', label: `Đánh giá 5★ (${stats.highlyRated})` },
              { key: 'Tạm ngưng', label: `Tạm ngưng (${stats.paused})` },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key === 'rated_5' ? 'all' : tab.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                  (statusFilter === tab.key) || (tab.key === 'all' && statusFilter === 'all')
                    ? "bg-purple-600 border-purple-400 text-white shadow-md shadow-purple-600/30"
                    : "bg-slate-800/60 border-slate-700/60 text-slate-300 hover:text-white hover:bg-slate-800"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* KPIs Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3 sm:gap-4 hover:border-purple-200 transition-all">
            <div className="h-11 w-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
              <Building2 size={20} />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tổng Nhà Cung Cấp</p>
              <p className="text-xl sm:text-2xl font-extrabold text-slate-800 mt-0.5">{stats.total}</p>
            </div>
          </div>

          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3 sm:gap-4 hover:border-green-200 transition-all">
            <div className="h-11 w-11 rounded-xl bg-green-50 text-green-600 flex items-center justify-center shrink-0">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Đang hoạt động</p>
              <p className="text-xl sm:text-2xl font-extrabold text-green-600 mt-0.5">{stats.active}</p>
            </div>
          </div>

          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3 sm:gap-4 hover:border-amber-200 transition-all">
            <div className="h-11 w-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <AlertCircle size={20} />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tạm ngưng/Khác</p>
              <p className="text-xl sm:text-2xl font-extrabold text-amber-600 mt-0.5">{stats.paused}</p>
            </div>
          </div>

          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3 sm:gap-4 hover:border-yellow-200 transition-all">
            <div className="h-11 w-11 rounded-xl bg-yellow-50 text-yellow-600 flex items-center justify-center shrink-0">
              <Award size={20} />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Đánh giá 5 Sao</p>
              <p className="text-xl sm:text-2xl font-extrabold text-yellow-600 mt-0.5">{stats.highlyRated}</p>
            </div>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 sm:p-4 shadow-sm flex flex-col md:flex-row gap-3 sm:gap-4 items-center justify-between">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Tìm theo mã, tên, địa chỉ, nhóm hàng..."
              className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 text-sm transition-all placeholder:text-slate-400"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 w-full md:w-auto justify-end">
            <span className="text-xs text-slate-500 font-medium">
              Hiển thị <strong>{filteredSuppliers.length}</strong> nhà cung cấp
            </span>

            {/* Grid / List toggle */}
            <div className="flex bg-slate-100 p-1 rounded-xl gap-0.5 border border-slate-200/40">
              <button 
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                title="Lưới đối tác"
              >
                <LayoutGrid size={18} />
              </button>
              <button 
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                title="Bảng chi tiết"
              >
                <List size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Suppliers List / Grid */}
        {filteredSuppliers.length > 0 ? (
          viewMode === 'grid' ? (
            /* Card view */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredSuppliers.map((supplier) => {
                const partnerStatus = supplier["Tình trạng"] || "Đang hoạt động";
                const ratingCount = parseInt(supplier["Đánh giá"] || "5");
                const cleanName = cleanCompanyName(supplier["Tên Nhà Cung Cấp"] || "");
                const displayName = cleanName || supplier["Mã nhà cung cấp"];
                return (
                  <div 
                    key={supplier.id || supplier["Mã nhà cung cấp"]} 
                    className="bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-200 p-4 flex flex-col justify-between group relative"
                  >
                    <div>
                      {/* Logo and Quick actions */}
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <CompanyLogo name={supplier["Tên Nhà Cung Cấp"] || displayName} size="sm" className="mt-0.5 shrink-0" logoUrl={getSupplierLogo(supplier)} logoFit={supplier.logoFit} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="inline-block text-[9px] font-mono font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded tracking-wider shrink-0 select-none uppercase">
                                {supplier["Mã nhà cung cấp"]}
                              </span>
                              {supplier["Nhóm hàng"] && (
                                <span className="font-semibold text-slate-600 bg-purple-50/50 border border-purple-100/50 px-1.5 py-0.5 rounded text-[9px] uppercase shrink-0">
                                  {supplier["Nhóm hàng"]}
                                </span>
                              )}
                            </div>
                            <h4 className="font-extrabold text-slate-900 text-sm mt-1.5 group-hover:text-purple-600 transition-colors truncate" title={displayName}>
                              {displayName}
                            </h4>
                            {!isNameRepetitive(displayName, supplier["Tên Nhà Cung Cấp"]) && (
                              <p className="text-[11px] text-slate-400 font-normal truncate mt-0.5" title={supplier["Tên Nhà Cung Cấp"]}>
                                {supplier["Tên Nhà Cung Cấp"]}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Actions menu */}
                        <div className="flex items-center gap-1 transition-opacity duration-200">
                          <button 
                            onClick={() => handleOpenModal(supplier)}
                            className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-md transition-colors bg-white shadow-sm border border-slate-100"
                            title="Chỉnh sửa thông tin"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button 
                            onClick={(e) => handleDelete(supplier.id, supplier["Mã nhà cung cấp"], e)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors bg-white shadow-sm border border-slate-100"
                            title="Xoá nhà cung cấp"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Details */}
                      <div className="mt-3 space-y-1.5 text-xs text-slate-600">
                        {/* Rating stars */}
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-slate-400 font-semibold uppercase mr-1">Đánh giá:</span>
                          <div className="flex items-center gap-0.5">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star 
                                key={i} 
                                size={11} 
                                className={i < ratingCount ? "fill-amber-400 text-amber-400" : "text-slate-200 fill-slate-100"} 
                              />
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 text-slate-500 truncate text-[11px]">
                          <MapPin size={12} className="text-slate-400 shrink-0" />
                          <span className="truncate" title={supplier["Địa chỉ"]}>
                            {supplier["Địa chỉ"] || "Chưa cập nhật địa chỉ trụ sở"}
                          </span>
                        </div>

                        {/* More supplier info */}
                        <div className="grid grid-cols-2 gap-2 text-[11px] pt-1.5 border-t border-slate-100/50">
                          {supplier["Mã số thuế"] && (
                            <div className="flex items-center gap-1 text-slate-500 min-w-0">
                              <FileText size={11} className="text-slate-400 shrink-0" />
                              <span className="font-mono truncate" title={`MST: ${supplier["Mã số thuế"]}`}>
                                MST: {supplier["Mã số thuế"]}
                              </span>
                            </div>
                          )}
                          {supplier["Số điện thoại"] && (
                            <div className="flex items-center gap-1 text-slate-500 min-w-0">
                              <Phone size={11} className="text-slate-400 shrink-0" />
                              <span className="truncate font-mono" title={`SĐT: ${supplier["Số điện thoại"]}`}>
                                SĐT: {supplier["Số điện thoại"]}
                              </span>
                            </div>
                          )}
                        </div>

                        {supplier["Nhà máy"] && (
                          <div className="flex items-center gap-1.5 text-slate-500 truncate text-[11px] mt-1">
                            <Factory size={11} className="text-slate-400 shrink-0" />
                            <span className="truncate" title={`Nhà máy: ${supplier["Nhà máy"]}`}>
                              Nhà máy: {supplier["Nhà máy"]}
                            </span>
                          </div>
                        )}

                        {/* Associated Contacts */}
                        {getLinkedContacts(supplier).length > 0 && (
                          <div className="mt-2.5 pt-2 border-t border-slate-100">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                              <UserCheck size={11} className="text-purple-500" />
                              <span>Nhân sự liên hệ ({getLinkedContacts(supplier).length})</span>
                            </div>
                            <div className="space-y-1">
                              {getLinkedContacts(supplier).slice(0, 2).map((c: any, cidx: number) => (
                                <div key={cidx} className="bg-slate-50/50 hover:bg-slate-50 rounded-lg p-1.5 flex items-center justify-between border border-slate-100/50 text-[11px]">
                                  <div className="min-w-0 flex-1 mr-2">
                                    <span className="font-semibold text-slate-700">{c["Tên"]}</span>
                                    {c["Chức vụ"] && <span className="text-slate-400 ml-1 text-[10px]">({c["Chức vụ"]})</span>}
                                  </div>
                                  {c["Điện thoại"] && (
                                    <span className="text-purple-600 font-medium font-mono shrink-0 select-all text-[10px]">{c["Điện thoại"]}</span>
                                  )}
                                </div>
                              ))}
                              {getLinkedContacts(supplier).length > 2 && (
                                <div className="text-[10px] text-slate-400 text-center font-medium pt-0.5">
                                  + {getLinkedContacts(supplier).length - 2} liên hệ khác trong danh bạ
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Footer Row */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        partnerStatus === "Đang hoạt động" ? "bg-green-50 text-green-700 border border-green-100" :
                        partnerStatus === "Tạm ngưng" ? "bg-amber-50 text-amber-700 border border-amber-100" :
                        "bg-red-50 text-red-700 border border-red-100"
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${
                          partnerStatus === "Đang hoạt động" ? "bg-green-500" :
                          partnerStatus === "Tạm ngưng" ? "bg-amber-500" :
                          "bg-red-500"
                        }`} />
                        {partnerStatus}
                      </span>
                      
                      {supplier["Website"] ? (
                        <a 
                          href={supplier["Website"].startsWith('http') ? supplier["Website"] : `https://${supplier["Website"]}`} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-xs font-bold text-purple-600 hover:text-purple-800 flex items-center gap-1 transition-colors"
                        >
                          Website <ExternalLink size={12} />
                        </a>
                      ) : (
                        <button 
                          onClick={() => handleOpenModal(supplier)}
                          className="text-xs font-semibold text-slate-400 hover:text-purple-600 transition-all"
                        >
                          Thêm liên kết
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Table list view */
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden animate-in fade-in duration-200">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50/70 text-slate-500 font-semibold border-b border-slate-200/80">
                    <tr>
                      <th className="px-6 py-4">Mã NCC</th>
                      <th className="px-6 py-4">Nhà Cung Cấp</th>
                      <th className="px-6 py-4">Nhóm hàng</th>
                      <th className="px-6 py-4">Thông tin địa chỉ</th>
                      <th className="px-6 py-4">Liên hệ & Mã số thuế</th>
                      <th className="px-6 py-4">Nhân sự liên kết</th>
                      <th className="px-6 py-4">Trạng thái & Đánh giá</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredSuppliers.map((supplier, idx) => {
                      const cleanName = cleanCompanyName(supplier["Tên Nhà Cung Cấp"] || "");
                      const displayName = cleanName || supplier["Mã nhà cung cấp"];
                      const partnerStatus = supplier["Tình trạng"] || "Hoạt động";
                      const linkedContacts = getLinkedContacts(supplier);
                      return (
                        <tr 
                          key={idx} 
                          onClick={() => handleOpenModal(supplier)}
                          className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
                        >
                          <td className="px-6 py-4 font-mono font-bold text-slate-600">{supplier["Mã nhà cung cấp"]}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <CompanyLogo name={supplier["Tên Nhà Cung Cấp"] || displayName} size="sm" logoUrl={getSupplierLogo(supplier)} logoFit={supplier.logoFit} />
                              <div className="flex flex-col min-w-0">
                                <span className="font-extrabold text-slate-800 text-sm leading-snug">{displayName}</span>
                                {!isNameRepetitive(displayName, supplier["Tên Nhà Cung Cấp"]) && (
                                  <span className="text-[11px] text-slate-400 font-normal line-clamp-1 max-w-[240px]" title={supplier["Tên Nhà Cung Cấp"]}>
                                    {supplier["Tên Nhà Cung Cấp"]}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {supplier["Nhóm hàng"] ? (
                              <span className="inline-flex items-center gap-1 text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-lg text-xs font-semibold">
                                <Building2 size={12} className="text-slate-400" />
                                {supplier["Nhóm hàng"]}
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-1 text-xs text-slate-600 max-w-[250px]">
                              {supplier["Địa chỉ"] && (
                                <div className="flex items-center gap-1 text-[11px] truncate">
                                  <MapPin size={11} className="text-slate-400 shrink-0" />
                                  <span className="truncate" title={`Trụ sở: ${supplier["Địa chỉ"]}`}>TS: {supplier["Địa chỉ"]}</span>
                                </div>
                              )}
                              {supplier["Nhà máy"] && (
                                <div className="flex items-center gap-1 text-[11px] truncate">
                                  <Factory size={11} className="text-slate-400 shrink-0" />
                                  <span className="truncate" title={`Nhà máy: ${supplier["Nhà máy"]}`}>NM: {supplier["Nhà máy"]}</span>
                                </div>
                              )}
                              {!supplier["Địa chỉ"] && !supplier["Nhà máy"] && <span className="text-slate-400">-</span>}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-1 text-xs text-slate-600">
                              {supplier["Mã số thuế"] && (
                                <div className="flex items-center gap-1 font-mono text-[11px]">
                                  <span className="text-slate-400">MST:</span>
                                  <span className="text-slate-700 select-all">{supplier["Mã số thuế"]}</span>
                                </div>
                              )}
                              {supplier["Số điện thoại"] && (
                                <div className="flex items-center gap-1 font-mono text-[11px]">
                                  <span className="text-slate-400">SĐT:</span>
                                  <span className="text-slate-700 select-all">{supplier["Số điện thoại"]}</span>
                                </div>
                              )}
                              {!supplier["Mã số thuế"] && !supplier["Số điện thoại"] && <span className="text-slate-400">-</span>}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {linkedContacts.length > 0 ? (
                              <div className="flex flex-col gap-1 max-w-[200px]">
                                {linkedContacts.slice(0, 2).map((c: any, cidx: number) => (
                                  <div key={c.id || c.ID || `supplier-contact-${cidx}`} className="text-xs">
                                    <span className="font-semibold text-slate-700">{c["Tên"]}</span>
                                    {c["Chức vụ"] && <span className="text-slate-400 text-[10px] ml-1">({c["Chức vụ"]})</span>}
                                    {c["Điện thoại"] && <div className="text-[10px] text-slate-400 font-mono">{c["Điện thoại"]}</div>}
                                  </div>
                                ))}
                                {linkedContacts.length > 2 && (
                                  <span className="text-[10px] text-purple-600 font-medium">+ {linkedContacts.length - 2} liên hệ khác</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-1.5">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-bold rounded-full w-fit ${
                                partnerStatus === "Hoạt động" || partnerStatus === "Đang hoạt động" ? "bg-green-50 text-green-700 border border-green-100" :
                                partnerStatus === "Tạm ngưng" ? "bg-amber-50 text-amber-700 border border-amber-100" :
                                "bg-red-50 text-red-700 border border-red-100"
                              }`}>
                                {partnerStatus}
                              </span>
                              <div className="flex items-center gap-0.5">
                                {Array.from({ length: 5 }).map((_, i) => (
                                  <Star 
                                    key={i} 
                                    size={10} 
                                    className={i < parseInt(supplier["Đánh giá"] || "0") ? "fill-amber-400 text-amber-400" : "text-slate-200 fill-slate-100"} 
                                  />
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )
        ) : (
          /* Empty State */
          <div className="bg-white border border-slate-200/80 rounded-2xl p-16 flex flex-col items-center justify-center text-center shadow-sm">
            <div className="h-16 w-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 mb-4 border border-slate-100">
              <Building2 size={28} />
            </div>
            <h4 className="text-lg font-bold text-slate-800">Không tìm thấy nhà cung cấp</h4>
            <p className="text-sm text-slate-400 max-w-sm mt-1">
              {searchTerm || statusFilter !== 'all' 
                ? 'Thử điều chỉnh từ khóa tìm kiếm hoặc bộ lọc trạng thái để tìm thấy đối tác cần thiết.' 
                : 'Chưa có thông tin nhà cung cấp nào. Hãy bấm nút Thêm nhà cung cấp để bắt đầu khởi tạo.'}
            </p>
            {(searchTerm || statusFilter !== 'all') && (
              <button 
                onClick={() => { setSearchTerm(''); setStatusFilter('all'); }}
                className="mt-4 text-xs font-semibold text-purple-600 hover:text-purple-800 bg-purple-50 px-3 py-1.5 rounded-lg hover:bg-purple-100 transition-all"
              >
                Xoá bộ lọc tìm kiếm
              </button>
            )}
          </div>
        )}
      </div>

      {/* Modern Dialog Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-100 flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center px-6 py-5 border-b border-slate-100 bg-slate-50/50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                  <Factory size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">
                    {editingSupplier ? 'Chỉnh sửa Nhà Cung Cấp' : 'Thêm Nhà Cung Cấp'}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">Nhập các trường thông tin cơ bản của nhà cung cấp đối tác.</p>
                </div>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-5">
              
              {/* ID and Name */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-1">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Mã Nhà Cung Cấp <span className="text-red-500">*</span></label>
                  <input 
                    type="text" 
                    required
                    placeholder="NCC-..."
                    disabled={!!editingSupplier}
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm bg-slate-50 disabled:bg-slate-100/80 disabled:cursor-not-allowed text-slate-700 font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all" 
                    value={formData["Mã nhà cung cấp"]}
                    onChange={e => setFormData({...formData, "Mã nhà cung cấp": e.target.value.toUpperCase()})}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Tên nhà cung cấp <span className="text-red-500">*</span></label>
                  <input 
                    type="text" 
                    required
                    placeholder="Công ty Cổ phần..."
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all" 
                    value={formData["Tên Nhà Cung Cấp"]}
                    onChange={e => setFormData({...formData, "Tên Nhà Cung Cấp": e.target.value})}
                  />
                </div>
              </div>

              {/* Classification and Status */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Nhóm hàng cung ứng</label>
                  <input 
                    type="text" 
                    placeholder="VD: Bao bì, Mực in, Hoá chất..."
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all" 
                    value={formData["Nhóm hàng"]}
                    onChange={e => setFormData({...formData, "Nhóm hàng": e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Trạng thái hợp tác</label>
                  <select 
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                    value={formData["Tình trạng"]}
                    onChange={e => setFormData({...formData, "Tình trạng": e.target.value})}
                  >
                    <option value="Đang hoạt động">Đang hoạt động</option>
                    <option value="Tạm ngưng">Tạm ngưng</option>
                    <option value="Ngừng hợp tác">Ngừng hợp tác</option>
                  </select>
                </div>
              </div>

              {/* Rating & Website */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Chất lượng (1-5 sao)</label>
                  <select 
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                    value={formData["Đánh giá"]}
                    onChange={e => setFormData({...formData, "Đánh giá": e.target.value})}
                  >
                    <option value="5">⭐⭐⭐⭐⭐ (Xuất sắc)</option>
                    <option value="4">⭐⭐⭐⭐ (Tốt)</option>
                    <option value="3">⭐⭐⭐ (Trung bình)</option>
                    <option value="2">⭐⭐ (Yếu)</option>
                    <option value="1">⭐ (Kém)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Website doanh nghiệp</label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                      type="text" 
                      placeholder="www.congty.com"
                      className="w-full pl-10 pr-3.5 py-2 text-sm border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all" 
                      value={formData["Website"]}
                      onChange={e => setFormData({...formData, "Website": e.target.value})}
                    />
                  </div>
                </div>
              </div>

              {/* Address (Trụ sở) & Factory (Nhà máy) */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Địa chỉ Trụ sở chính</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                      type="text" 
                      placeholder="Số nhà, Đường, Quận/Huyện, Tỉnh thành..."
                      className="w-full pl-10 pr-3.5 py-2 text-sm border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all" 
                      value={formData["Địa chỉ"]}
                      onChange={e => setFormData({...formData, "Địa chỉ": e.target.value})}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Địa chỉ Nhà máy / Cơ sở sản xuất</label>
                  <div className="relative">
                    <Factory className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                      type="text" 
                      placeholder="Khu công nghiệp, Nhà máy, Tỉnh thành..."
                      className="w-full pl-10 pr-3.5 py-2 text-sm border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all" 
                      value={formData["Nhà máy"]}
                      onChange={e => setFormData({...formData, "Nhà máy": e.target.value})}
                    />
                  </div>
                </div>
              </div>

              {/* Tax Code and Phone Number */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Mã số thuế</label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                      type="text" 
                      placeholder="Mã số thuế doanh nghiệp..."
                      className="w-full pl-10 pr-3.5 py-2 text-sm border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all font-mono" 
                      value={formData["Mã số thuế"] || ""}
                      onChange={e => setFormData({...formData, "Mã số thuế": e.target.value})}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Số điện thoại</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                      type="text" 
                      placeholder="Số điện thoại bàn/di động..."
                      className="w-full pl-10 pr-3.5 py-2 text-sm border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all font-mono" 
                      value={formData["Số điện thoại"] || ""}
                      onChange={e => setFormData({...formData, "Số điện thoại": e.target.value})}
                    />
                  </div>
                </div>
              </div>

              {/* Logo Upload / URL Link */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/50 space-y-3">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Logo Nhà cung cấp</label>
                <div className="flex items-center gap-4">
                  {logoPreview ? (
                    <img 
                      src={logoPreview} 
                      alt="Logo preview" 
                      className={`w-14 h-14 rounded-xl border border-slate-200 bg-white ${formData.logoFit === 'contain' ? 'object-contain p-1' : 'object-cover'}`} 
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-slate-200/60 border border-dashed border-slate-300 flex items-center justify-center text-slate-400 text-[10px] text-center p-1 font-medium select-none">
                      Chưa có Logo
                    </div>
                  )}
                  <div className="flex-1 space-y-2">
                    {/* File Upload */}
                    <div className="flex items-center gap-2">
                      <input 
                        type="file" 
                        id="supplier-logo-upload"
                        accept="image/*"
                        className="hidden" 
                        onChange={handleFileChange}
                      />
                      <label 
                        htmlFor="supplier-logo-upload"
                        className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold cursor-pointer hover:bg-slate-50 transition-colors shadow-sm"
                      >
                        Chọn tệp tải lên
                      </label>
                      {logoFile && <span className="text-[10px] text-slate-500 font-mono truncate max-w-[120px]">{logoFile.name}</span>}
                    </div>
                    {/* Direct Image URL Link */}
                    <div className="relative">
                      <Globe className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                      <input 
                        type="text" 
                        placeholder="Hoặc dán đường link ảnh logo..."
                        className="w-full pl-8 pr-2.5 py-1 text-xs border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 bg-white transition-all" 
                        value={formData["logoUrl"] || ""}
                        onChange={e => {
                          setFormData({...formData, "logoUrl": e.target.value});
                          setLogoPreview(e.target.value || null);
                        }}
                      />
                    </div>
                    {/* Logo Fit Selector */}
                    <div className="flex items-center gap-3 pt-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cách hiển thị:</span>
                      <label className="inline-flex items-center gap-1 cursor-pointer text-xs font-medium text-slate-600 select-none">
                        <input 
                          type="radio" 
                          name="logoFit" 
                          value="contain" 
                          checked={formData.logoFit === 'contain'} 
                          onChange={() => setFormData({...formData, logoFit: 'contain'})}
                          className="text-purple-600 focus:ring-purple-500" 
                        />
                        Chứa toàn bộ (Contain)
                      </label>
                      <label className="inline-flex items-center gap-1 cursor-pointer text-xs font-medium text-slate-600 select-none">
                        <input 
                          type="radio" 
                          name="logoFit" 
                          value="cover" 
                          checked={formData.logoFit === 'cover'} 
                          onChange={() => setFormData({...formData, logoFit: 'cover'})}
                          className="text-purple-600 focus:ring-purple-500" 
                        />
                        Cắt vừa khung (Cover)
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Associated Contacts Link selection */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Gắn với liên hệ trong danh bạ</label>
                {contacts.length > 0 ? (
                  <div className="border border-slate-200 rounded-xl p-3 bg-white max-h-[140px] overflow-y-auto space-y-2">
                    {contacts.map((c: any) => {
                      const contactId = c.id || c.ID;
                      const explicitIds = String(formData["Liên hệ liên kết"] || "").split(',').map((id: string) => id.trim());
                      const isChecked = explicitIds.includes(contactId);
                      return (
                        <label key={contactId} className="flex items-start gap-2.5 p-1.5 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors text-xs">
                          <input 
                            type="checkbox"
                            className="rounded text-purple-600 focus:ring-purple-500 mt-0.5"
                            checked={isChecked}
                            onChange={(e) => {
                              let newIds = [...explicitIds];
                              if (e.target.checked) {
                                if (!newIds.includes(contactId)) newIds.push(contactId);
                              } else {
                                newIds = newIds.filter(id => id !== contactId);
                              }
                              setFormData({
                                ...formData,
                                "Liên hệ liên kết": newIds.filter(Boolean).join(',')
                              });
                            }}
                          />
                          <div className="min-w-0">
                            <span className="font-semibold text-slate-800">{c["Tên"]}</span>
                            {c["Chức vụ"] && <span className="text-slate-400 ml-1">({c["Chức vụ"]})</span>}
                            {c["Công ty"] && <div className="text-[10px] text-slate-400">Công ty: {c["Công ty"]}</div>}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">Không có liên hệ nào trong danh bạ hiện có. Hãy tạo thêm ở tab Danh Bạ.</p>
                )}
              </div>
              
              {/* Actions Footer */}
              <div className="pt-5 border-t border-slate-100 flex items-center justify-between shrink-0">
                {editingSupplier ? (
                  <button 
                    type="button" 
                    onClick={(e) => handleDelete(editingSupplier.id, editingSupplier.Supplier_ID, e)}
                    className="flex items-center gap-1.5 px-3 py-2 text-red-600 hover:bg-red-50 rounded-xl text-sm font-semibold transition-all border border-transparent hover:border-red-100"
                  >
                    <Trash2 size={16} />
                    Xoá nhà cung cấp
                  </button>
                ) : <div />}
                <div className="flex items-center gap-3">
                  <button 
                    type="button" 
                    onClick={() => setIsModalOpen(false)}
                    className="px-4.5 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold transition-all"
                  >
                    Huỷ
                  </button>
                  <button 
                    type="submit" 
                    className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-semibold shadow-sm shadow-purple-100 hover:shadow-md transition-all active:scale-98"
                  >
                    {editingSupplier ? 'Cập nhật' : 'Thêm mới'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
