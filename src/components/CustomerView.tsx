import React, { useState, useMemo } from 'react';
import { 
  Building2, 
  MapPin, 
  Tag, 
  PlusCircle, 
  Search, 
  Edit2, 
  Trash2, 
  X, 
  Upload, 
  LayoutGrid, 
  List, 
  Users, 
  Briefcase, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Phone,
  FileText,
  Factory,
  Globe,
  Copy,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Eye,
  Columns,
  Cloud,
  DownloadCloud,
  FileSpreadsheet
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
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'compact'>('grid');
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
    const toastId = toast.loading("Đang đồng bộ danh sách khách hàng tới Google Sheets & Drive...");
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
      if (!sheetsRes.ok) {
        throw new Error(sheetsData.error || "Không thể đồng bộ Google Sheets");
      }

      if (sheetsData.spreadsheetId) {
        localStorage.setItem('google_spreadsheet_id', sheetsData.spreadsheetId);
      }

      const driveRes = await fetch('/api/drive/sync-customers', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ customers })
      });
      const driveData = await driveRes.json();

      toast.success(
        <div>
          <p className="font-bold text-sm">Đã đồng bộ {customers.length} khách hàng lên Google!</p>
          {sheetsData.spreadsheetUrl && (
            <a href={sheetsData.spreadsheetUrl} target="_blank" rel="noreferrer" className="text-blue-200 hover:text-white underline text-xs block mt-1">
              Mở Google Sheets ↗
            </a>
          )}
          {driveData.driveLink && (
            <a href={driveData.driveLink} target="_blank" rel="noreferrer" className="text-indigo-200 hover:text-white underline text-xs block mt-0.5">
              Mở File Backup Google Drive ↗
            </a>
          )}
        </div>,
        { id: toastId, duration: 6000 }
      );
    } catch (err: any) {
      console.error("Google sync error:", err);
      toast.error(err.message || "Lỗi khi đồng bộ Google", { id: toastId });
    } finally {
      setIsSyncingGoogle(false);
    }
  };

  const handleImportGoogleSheets = async () => {
    const savedSheetId = localStorage.getItem('google_spreadsheet_id');
    if (!savedSheetId) {
      toast.error("Chưa có Google Sheet ID! Vui lòng ấn Đồng bộ Google trước.");
      return;
    }

    setIsImportingGoogle(true);
    const toastId = toast.loading("Đang tải dữ liệu từ sheet Customers_Directory...");
    try {
      let token = await ensureGoogleToken([
        'https://www.googleapis.com/auth/spreadsheets'
      ]);

      let res = await fetch(`/api/sheets/import-customers?spreadsheetId=${encodeURIComponent(savedSheetId)}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (res.status === 401) {
        clearStoredGoogleToken();
        token = await ensureGoogleToken(['https://www.googleapis.com/auth/spreadsheets'], true);
        res = await fetch(`/api/sheets/import-customers?spreadsheetId=${encodeURIComponent(savedSheetId)}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Không thể đọc dữ liệu từ Google Sheets");
      }

      const importedList = data.customers || [];
      if (importedList.length === 0) {
        toast("Không tìm thấy dữ liệu trong sheet 'Customers_Directory'.", { id: toastId });
        return;
      }

      let count = 0;
      for (const item of importedList) {
        const key = String(item.Customer_ID).replace(/[/\\#?%[\]\s.]+/g, '_');
        await setDoc(doc(db, 'customers', key), item, { merge: true });
        count++;
      }

      toast.success(`Đã nhập thành công ${count} khách hàng từ Google Sheets!`, { id: toastId });
    } catch (err: any) {
      console.error("Import sheets error:", err);
      toast.error(err.message || "Lỗi khi nhập từ Google Sheets", { id: toastId });
    } finally {
      setIsImportingGoogle(false);
    }
  };

  const [formData, setFormData] = useState({
    "Customer_ID": "",
    "Tên đầy đủ": "",
    "Phân loại": "",
    "Tình trạng": "Đang mua",
    "Địa chỉ": "",
    "Nhà máy": "",
    "Số điện thoại": "",
    "Mã số thuế": "",
    "logoUrl": "",
    "Liên hệ liên kết": "",
    "logoFit": "contain"
  });

  const handleOpenModal = (customer: any = null) => {
    if (customer) {
      setEditingCustomer(customer);
      const existingLogo = getCustomerLogo(customer);
      setFormData({
        "Customer_ID": customer["Customer_ID"] || customer.id || "",
        "Tên đầy đủ": customer["Tên đầy đủ"] || customer.name || "",
        "Phân loại": customer["Phân loại"] || customer.category || "",
        "Tình trạng": customer["Tình trạng"] || customer.status || "Đang mua",
        "Địa chỉ": customer["Địa chỉ"] || customer.address || "",
        "Nhà máy": customer["Nhà máy"] || customer.factory || "",
        "Số điện thoại": customer["Số điện thoại"] || customer.phone || "",
        "Mã số thuế": customer["Mã số thuế"] || customer.taxCode || "",
        "logoUrl": existingLogo,
        "Liên hệ liên kết": customer["Liên hệ liên kết"] || "",
        "logoFit": customer["logoFit"] || "contain"
      });
      setLogoPreview(existingLogo || null);
    } else {
      setEditingCustomer(null);
      setFormData({
        "Customer_ID": "",
        "Tên đầy đủ": "",
        "Phân loại": "",
        "Tình trạng": "Đang mua",
        "Địa chỉ": "",
        "Nhà máy": "",
        "Số điện thoại": "",
        "Mã số thuế": "",
        "logoUrl": "",
        "Liên hệ liên kết": "",
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
    if (!formData["Customer_ID"] || !formData["Tên đầy đủ"]) {
      toast.error("Vui lòng điền đủ Mã khách hàng và Tên đầy đủ!");
      return;
    }

    const code = formData["Customer_ID"].trim();
    const isDuplicate = customers.some(c => 
      (c["Customer_ID"]?.trim().toLowerCase() === code.toLowerCase() || c.id?.trim().toLowerCase() === code.toLowerCase()) && 
      (!editingCustomer || (c.id !== editingCustomer.id && c["Customer_ID"] !== editingCustomer["Customer_ID"]))
    );
    if (isDuplicate && !editingCustomer) {
      toast.error(`Mã khách hàng "${code}" đã tồn tại trên hệ thống! Vui lòng chọn mã khác.`);
      return;
    }
    
    const loadingToast = toast.loading(editingCustomer ? "Đang cập nhật khách hàng..." : "Đang thêm khách hàng mới...");
    
    try {
      let logoUrl = formData.logoUrl || getCustomerLogo(editingCustomer) || "";

      if (logoFile) {
        try {
          const sanitizedCode = code.replace(/[/\\#?%[\]\s.]+/g, '_');
          const storageRef = ref(storage, `logos/${sanitizedCode}`);
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
        "Customer_ID": code,
        logoUrl,
        LogoUrl: logoUrl,
        Logo: logoUrl,
        updatedAt: new Date().toISOString()
      };

      const rawDocId = editingCustomer?.id || getItemKey(editingCustomer || payload, 'customers') || code;
      const docId = String(rawDocId).replace(/[/\\#?%[\]\s.]+/g, '_');

      await setDoc(doc(db, 'customers', docId), payload, { merge: true });

      // Persist to local database API
      try {
        await fetch('/api/data/customers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: code,
            name: formData["Tên đầy đủ"],
            address: formData["Địa chỉ"],
            phone: formData["Số điện thoại"]
          })
        });
      } catch (apiErr) {
        console.warn("Backend API save warning:", apiErr);
      }

      toast.success(editingCustomer ? "Cập nhật thông tin khách hàng thành công!" : "Thêm khách hàng mới thành công!", { id: loadingToast });
      setIsModalOpen(false);

      // Auto background sync to Google Sheets if configured
      const savedToken = localStorage.getItem('google_access_token');
      const savedSheetId = localStorage.getItem('google_spreadsheet_id');
      if (savedToken && savedSheetId) {
        fetch('/api/sheets/sync', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${savedToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            spreadsheetId: savedSheetId,
            customers: [...customers.filter(c => (c["Customer_ID"] || c.id) !== code), payload]
          })
        }).catch(err => console.warn('Background auto sync to sheets warning:', err));
      }
    } catch (error) {
      console.error("Update customer error:", error);
      toast.error("Đã xảy ra lỗi khi lưu thông tin!", { id: loadingToast });
      handleFirestoreError(error, OperationType.WRITE, 'customers');
    }
  };

  const handleDelete = async (id: string, customerId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const loadingToast = toast.loading("Đang xoá khách hàng...");
    try {
      const targetId = id || getItemKey({ Customer_ID: customerId }, 'customers') || customerId;
      const docId = String(targetId).replace(/[/\\#?%[\]\s.]+/g, '_');
      await setDoc(doc(db, 'customers', docId), { isDeleted: true }, { merge: true });

      try {
        await fetch(`/api/data/customers/${encodeURIComponent(customerId || targetId)}`, {
          method: 'DELETE'
        });
      } catch (apiErr) {
        console.warn("Backend API delete warning:", apiErr);
      }

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

  // Extract unique categories for filtering
  const uniqueCategories = useMemo(() => {
    const set = new Set<string>();
    customers.forEach(c => {
      if (c["Phân loại"]) set.add(c["Phân loại"]);
    });
    return Array.from(set);
  }, [customers]);

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
      XLSX.writeFile(wb, `Danh_Ba_Khach_Hang_TSG_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success("Đã xuất danh bạ khách hàng ra file Excel thành công!");
    } catch (err: any) {
      toast.error("Lỗi xuất Excel: " + (err?.message || err));
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/70 min-h-screen">
      <div className="p-3 sm:p-5 lg:p-8 max-w-[1600px] mx-auto space-y-5 sm:space-y-6 pb-24 lg:pb-8">
        
        {/* Hero Header with Decorative Gradient Banner */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 p-5 sm:p-8 text-white shadow-xl shadow-indigo-950/20 border border-slate-800">
          <div className="absolute right-0 top-0 -mt-10 -mr-10 w-96 h-96 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
          <div className="absolute left-1/3 bottom-0 w-80 h-80 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5 sm:gap-6">
            <div className="space-y-1.5 sm:space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-semibold backdrop-blur-md">
                <Sparkles size={14} className="text-blue-400 animate-pulse" />
                <span>Hệ Thống Quản Lý Đối Tác Khách Hàng Doanh Nghiệp</span>
              </div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2.5 sm:gap-3">
                <Building2 className="text-blue-400 shrink-0" size={30} />
                Danh Mục Khách Hàng TSG
              </h1>
              <p className="text-slate-300 text-xs sm:text-sm max-w-2xl leading-relaxed">
                Tra cứu hồ sơ pháp lý, địa chỉ trụ sở/nhà máy, lịch sử hợp tác và mạng lưới nhân sự liên kết với trải nghiệm trực quan.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">
              <button
                onClick={handleExportToExcel}
                className="inline-flex items-center justify-center gap-2 bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3.5 py-2.5 sm:py-3 rounded-2xl font-bold text-xs sm:text-sm transition-all duration-300 shadow-md hover:-translate-y-0.5"
                title="Xuất toàn bộ danh bạ khách hàng ra Excel"
              >
                <FileSpreadsheet size={16} className="text-emerald-400" />
                <span>Xuất Excel</span>
              </button>

              <button
                onClick={openGoogleAuthTab}
                className="inline-flex items-center justify-center gap-2 bg-indigo-600/80 hover:bg-indigo-600 text-white px-3.5 py-2.5 sm:py-3 rounded-2xl font-semibold text-xs transition-all duration-300 shadow-md hover:-translate-y-0.5 border border-indigo-400/40"
                title="Mở ứng dụng ở Tab mới để đăng nhập Google OAuth mà không bị chặn popup"
              >
                <ExternalLink size={16} />
                <span className="hidden sm:inline">Mở Tab Xác Thực Google</span>
              </button>

              <button
                onClick={handleSyncGoogle}
                disabled={isSyncingGoogle}
                className="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-2xl font-semibold text-xs sm:text-sm transition-all duration-300 shadow-lg shadow-emerald-900/30 hover:shadow-emerald-600/40 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 border border-emerald-400/40"
                title="Đồng bộ 2 chiều danh sách khách hàng tới Google Sheets và tạo Backup Google Drive"
              >
                <Cloud size={16} className={isSyncingGoogle ? "animate-spin" : ""} />
                <span>{isSyncingGoogle ? "Đang đồng bộ..." : "Đồng bộ Sheets"}</span>
              </button>

              <button 
                onClick={() => handleOpenModal()}
                className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-2xl font-bold text-xs sm:text-sm transition-all duration-300 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5 active:translate-y-0 border border-blue-400/30"
              >
                <PlusCircle size={18} />
                <span>Thêm Khách Hàng</span>
              </button>
            </div>

          </div>

          {/* Quick Filter Tabs inside Hero */}
          <div className="flex flex-wrap gap-2 mt-5 pt-5 border-t border-slate-800/80">
            {[
              { key: 'all', label: `Tất cả (${stats.total})` },
              { key: 'Đang mua', label: `Đang mua hàng (${stats.active})` },
              { key: 'Đang đàm phán', label: `Đang đàm phán (${stats.negotiating})` },
              { key: 'Ngừng mua', label: `Tạm dừng (${stats.stopped})` },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                  statusFilter === tab.key
                    ? "bg-blue-600 border-blue-400 text-white shadow-md shadow-blue-600/30"
                    : "bg-slate-800/60 border-slate-700/60 text-slate-300 hover:text-white hover:bg-slate-800"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Dashboard Quick Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          
          {/* Card 1: Total */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tổng Khách Hàng</span>
              <div className="h-9 w-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Users size={18} />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2">{stats.total}</p>
            <p className="text-[11px] text-slate-400 mt-1">Doanh nghiệp đã lưu hồ sơ</p>
          </div>

          {/* Card 2: Active */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all group border-l-4 border-l-emerald-500">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Đang Mua Hàng</span>
              <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <CheckCircle2 size={18} />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-emerald-600 mt-2">{stats.active}</p>
            <p className="text-[11px] text-emerald-700/70 font-medium mt-1">Đối tác tạo doanh thu thường xuyên</p>
          </div>

          {/* Card 3: Negotiating */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all group border-l-4 border-l-amber-500">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Đang Đàm Phán</span>
              <div className="h-9 w-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Clock size={18} />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-amber-600 mt-2">{stats.negotiating}</p>
            <p className="text-[11px] text-amber-700/70 font-medium mt-1">Hồ sơ báo giá & mẫu thử</p>
          </div>

          {/* Card 4: Stopped */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all group border-l-4 border-l-slate-400">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tạm Dừng Mua</span>
              <div className="h-9 w-9 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                <AlertCircle size={18} />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-slate-600 mt-2">{stats.stopped}</p>
            <p className="text-[11px] text-slate-400 mt-1">Cần chăm sóc lại</p>
          </div>

          {/* Card 5: Contacts */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all group col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Mạng Lưới Nhân Sự</span>
              <div className="h-9 w-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Briefcase size={18} />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-indigo-600 mt-2">{stats.totalContacts}</p>
            <p className="text-[11px] text-slate-400 mt-1">Liên hệ trong danh bạ</p>
          </div>

        </div>

        {/* Filter and View Control Bar */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm space-y-4">
          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
            
            {/* Search Box */}
            <div className="relative w-full lg:max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Tìm theo mã KH, tên doanh nghiệp, địa chỉ, MST, SĐT..."
                className="w-full pl-11 pr-10 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm transition-all placeholder:text-slate-400"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')} 
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200/60"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Filter Tabs & View Modes */}
            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-between lg:justify-end">
              
              {/* Category Filter Dropdown */}
              {uniqueCategories.length > 0 && (
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="all">Tất cả phân loại ({customers.length})</option>
                  {uniqueCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              )}

              {/* Status Segmented Filter */}
              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/50">
                <button 
                  onClick={() => setStatusFilter('all')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${statusFilter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  Tất cả ({stats.total})
                </button>
                <button 
                  onClick={() => setStatusFilter('Đang mua')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${statusFilter === 'Đang mua' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  Đang mua ({stats.active})
                </button>
                <button 
                  onClick={() => setStatusFilter('Đang đàm phán')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${statusFilter === 'Đang đàm phán' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  Đàm phán ({stats.negotiating})
                </button>
                <button 
                  onClick={() => setStatusFilter('Ngừng mua')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${statusFilter === 'Ngừng mua' ? 'bg-slate-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  Tạm dừng ({stats.stopped})
                </button>
              </div>

              {/* 3 View Mode Switchers */}
              <div className="flex bg-slate-100 p-1 rounded-xl gap-0.5 border border-slate-200/50">
                <button 
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-lg transition-all flex items-center gap-1.5 text-xs font-bold ${viewMode === 'grid' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  title="Dạng Thẻ Doanh Nghiệp"
                >
                  <LayoutGrid size={16} />
                  <span className="hidden sm:inline">Thẻ</span>
                </button>
                <button 
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-lg transition-all flex items-center gap-1.5 text-xs font-bold ${viewMode === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  title="Dạng Bảng Chi Tiết"
                >
                  <List size={16} />
                  <span className="hidden sm:inline">Bảng</span>
                </button>
                <button 
                  onClick={() => setViewMode('compact')}
                  className={`p-2 rounded-lg transition-all flex items-center gap-1.5 text-xs font-bold ${viewMode === 'compact' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  title="Dạng Ma Trận Rút Gọn"
                >
                  <Columns size={16} />
                  <span className="hidden sm:inline">Ma trận</span>
                </button>
              </div>

            </div>
          </div>
        </div>

        {/* Display Content Area */}
        {filteredCustomers.length > 0 ? (
          
          /* MODE 1: MODERN CARDS GRID */
          viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">
              {filteredCustomers.map((customer, idx) => {
                const cleanName = cleanCompanyName(customer["Tên đầy đủ"] || "");
                const cardStatus = customer["Tình trạng"] || "Đang mua";
                const linkedContacts = getLinkedContacts(customer);
                const customerKey = customer.id || customer.Customer_ID || `cust-grid-${idx}`;
                
                return (
                  <div 
                    key={customerKey} 
                    className="bg-white rounded-3xl border border-slate-200/80 shadow-sm hover:shadow-xl hover:border-blue-300 transition-all duration-300 p-5 flex flex-col justify-between group relative overflow-hidden"
                  >
                    {/* Top Status Accent Bar */}
                    <div className={`absolute top-0 left-0 right-0 h-1.5 ${
                      cardStatus === "Đang mua" ? "bg-gradient-to-r from-emerald-500 to-teal-400" :
                      cardStatus === "Đang đàm phán" ? "bg-gradient-to-r from-amber-500 to-orange-400" :
                      "bg-slate-300"
                    }`} />

                    <div>
                      {/* Header Row: Logo, ID & Quick Actions */}
                      <div className="flex justify-between items-start gap-3 pt-1">
                        <div className="flex items-start gap-3.5 min-w-0 flex-1">
                          <CompanyLogo 
                            name={customer["Tên đầy đủ"] || cleanName} 
                            size="md" 
                            className="mt-0.5 shrink-0 shadow-sm border border-slate-100 rounded-2xl" 
                            logoUrl={getCustomerLogo(customer)} 
                            logoFit={customer.logoFit} 
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="inline-block text-[10px] font-mono font-extrabold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md tracking-wider uppercase">
                                {customer["Customer_ID"]}
                              </span>
                              {customer["Phân loại"] && (
                                <span className="font-bold text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-md text-[10px] uppercase">
                                  {customer["Phân loại"]}
                                </span>
                              )}
                            </div>
                            <h3 
                              className="font-extrabold text-slate-900 text-base mt-1.5 group-hover:text-blue-600 transition-colors line-clamp-1 cursor-pointer" 
                              title={cleanName}
                              onClick={() => setSelectedCustomerDetail(customer)}
                            >
                              {cleanName}
                            </h3>
                            {!isNameRepetitive(cleanName, customer["Tên đầy đủ"]) && (
                              <p className="text-xs text-slate-400 line-clamp-1 mt-0.5 font-medium" title={customer["Tên đầy đủ"]}>
                                {customer["Tên đầy đủ"]}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Quick Action Buttons */}
                        <div className="flex items-center gap-1 opacity-90 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => setSelectedCustomerDetail(customer)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all border border-slate-100 bg-white shadow-xs"
                            title="Xem chi tiết"
                          >
                            <Eye size={15} />
                          </button>
                          <button 
                            onClick={() => handleOpenModal(customer)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all border border-slate-100 bg-white shadow-xs"
                            title="Chỉnh sửa hồ sơ"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button 
                            onClick={(e) => handleDelete(customer.id, customer.Customer_ID, e)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all border border-slate-100 bg-white shadow-xs"
                            title="Xoá khách hàng"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>

                      {/* Locations Info */}
                      <div className="mt-4 space-y-1.5 text-xs border-t border-slate-100 pt-3.5">
                        {customer["Địa chỉ"] ? (
                          <div className="flex items-start gap-2 text-slate-600">
                            <MapPin size={14} className="text-rose-500 shrink-0 mt-0.5" />
                            <span className="line-clamp-2 leading-tight" title={customer["Địa chỉ"]}>
                              <strong className="text-slate-700">Trụ sở:</strong> {customer["Địa chỉ"]}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-slate-400 text-xs italic">
                            <MapPin size={14} className="text-slate-300 shrink-0" />
                            <span>Chưa cập nhật địa chỉ trụ sở</span>
                          </div>
                        )}

                        {customer["Nhà máy"] && (
                          <div className="flex items-start gap-2 text-slate-600">
                            <Factory size={14} className="text-indigo-500 shrink-0 mt-0.5" />
                            <span className="line-clamp-1 leading-tight" title={customer["Nhà máy"]}>
                              <strong className="text-slate-700">Nhà máy:</strong> {customer["Nhà máy"]}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Quick Meta: Tax Code & Phone */}
                      <div className="grid grid-cols-2 gap-2 mt-3.5 p-2.5 bg-slate-50/80 rounded-2xl border border-slate-100 text-xs font-mono">
                        <div className="min-w-0">
                          <span className="text-slate-400 block text-[9px] uppercase font-sans font-bold tracking-wider">Mã số thuế</span>
                          {customer["Mã số thuế"] ? (
                            <button 
                              onClick={(e) => copyToClipboard(customer["Mã số thuế"], "Mã số thuế", e)}
                              className="text-slate-800 font-bold hover:text-blue-600 flex items-center gap-1 mt-0.5 truncate transition-colors"
                              title="Click để sao chép"
                            >
                              <span className="truncate">{customer["Mã số thuế"]}</span>
                              <Copy size={11} className="text-slate-400 shrink-0" />
                            </button>
                          ) : (
                            <span className="text-slate-300 block mt-0.5 font-sans">-</span>
                          )}
                        </div>

                        <div className="min-w-0">
                          <span className="text-slate-400 block text-[9px] uppercase font-sans font-bold tracking-wider">Số điện thoại</span>
                          {customer["Số điện thoại"] ? (
                            <a 
                              href={`tel:${customer["Số điện thoại"]}`}
                              className="text-slate-800 font-bold hover:text-blue-600 flex items-center gap-1 mt-0.5 truncate transition-colors"
                            >
                              <Phone size={11} className="text-emerald-500 shrink-0" />
                              <span className="truncate">{customer["Số điện thoại"]}</span>
                            </a>
                          ) : (
                            <span className="text-slate-300 block mt-0.5 font-sans">-</span>
                          )}
                        </div>
                      </div>

                      {/* Linked Personnel Section */}
                      {linkedContacts.length > 0 && (
                        <div className="mt-3.5 pt-3 border-t border-dashed border-slate-200">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                              Nhân sự liên kết ({linkedContacts.length})
                            </span>
                          </div>
                          <div className="space-y-1.5 max-h-[100px] overflow-y-auto pr-1">
                            {linkedContacts.map((contact: any, cidx: number) => (
                              <div 
                                key={contact.id || contact.ID || `contact-grid-${customerKey}-${cidx}`}
                                className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-50 hover:bg-blue-50/50 border border-slate-100 transition-colors"
                              >
                                <div className="min-w-0 flex-1">
                                  <span className="font-bold text-slate-800 text-xs block truncate">{contact["Tên"]}</span>
                                  {contact["Chức vụ"] && (
                                    <span className="text-[10px] text-slate-400 block truncate">{contact["Chức vụ"]}</span>
                                  )}
                                </div>
                                {contact["Điện thoại"] && (
                                  <a 
                                    href={`tel:${contact["Điện thoại"]}`} 
                                    className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-[10px] font-mono font-bold flex items-center gap-1 shrink-0 transition-colors"
                                  >
                                    <Phone size={10} />
                                    {contact["Điện thoại"]}
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Bottom Status & View Details Link */}
                    <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between shrink-0">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                        cardStatus === "Đang mua" ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60" :
                        cardStatus === "Đang đàm phán" ? "bg-amber-50 text-amber-700 border border-amber-200/60" :
                        "bg-slate-100 text-slate-600 border border-slate-200"
                      }`}>
                        <span className={`h-2 w-2 rounded-full ${
                          cardStatus === "Đang mua" ? "bg-emerald-500 animate-pulse" :
                          cardStatus === "Đang đàm phán" ? "bg-amber-500" :
                          "bg-slate-400"
                        }`} />
                        {cardStatus}
                      </span>

                      <button 
                        onClick={() => setSelectedCustomerDetail(customer)}
                        className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 hover:translate-x-0.5 transition-all"
                      >
                        <span>Hồ sơ chi tiết</span>
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : viewMode === 'list' ? (
            
            /* MODE 2: DETAILED CORPORATE TABLE */
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-900 text-slate-300 text-xs font-bold uppercase tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="px-6 py-4">Mã Khách Hàng</th>
                      <th className="px-6 py-4">Doanh Nghiệp / Đối Tác</th>
                      <th className="px-6 py-4">Phân Loại</th>
                      <th className="px-6 py-4">Địa Chỉ Trụ Sở & Nhà Máy</th>
                      <th className="px-6 py-4">Mã Số Thuế & SĐT</th>
                      <th className="px-6 py-4">Nhân Sự Liên Kết</th>
                      <th className="px-6 py-4">Trạng Thái</th>
                      <th className="px-6 py-4 text-right">Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredCustomers.map((customer, idx) => {
                      const cleanName = cleanCompanyName(customer["Tên đầy đủ"] || "");
                      const displayName = cleanName || customer["Customer_ID"];
                      const cardStatus = customer["Tình trạng"] || "Đang mua";
                      const linkedContacts = getLinkedContacts(customer);
                      const customerKey = customer.id || customer.Customer_ID || `cust-table-${idx}`;

                      return (
                        <tr 
                          key={customerKey}
                          className="hover:bg-blue-50/40 transition-colors group cursor-pointer"
                          onClick={() => setSelectedCustomerDetail(customer)}
                        >
                          <td className="px-6 py-4 font-mono font-extrabold text-blue-600">
                            {customer["Customer_ID"]}
                          </td>
                          
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <CompanyLogo 
                                name={customer["Tên đầy đủ"] || displayName} 
                                size="sm" 
                                logoUrl={getCustomerLogo(customer)} 
                                logoFit={customer.logoFit} 
                              />
                              <div className="flex flex-col min-w-0">
                                <span className="font-extrabold text-slate-900 text-sm group-hover:text-blue-600 transition-colors leading-snug">
                                  {displayName}
                                </span>
                                {!isNameRepetitive(displayName, customer["Tên đầy đủ"]) && (
                                  <span className="text-[11px] text-slate-400 font-medium truncate max-w-[260px]" title={customer["Tên đầy đủ"]}>
                                    {customer["Tên đầy đủ"]}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="px-6 py-4">
                            {customer["Phân loại"] ? (
                              <span className="inline-flex items-center gap-1 text-slate-700 bg-slate-100 px-2.5 py-1 rounded-xl text-xs font-bold border border-slate-200/60">
                                <Tag size={12} className="text-blue-500" />
                                {customer["Phân loại"]}
                              </span>
                            ) : (
                              <span className="text-slate-300 font-mono">-</span>
                            )}
                          </td>

                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-1 text-xs text-slate-600 max-w-[280px]">
                              {customer["Địa chỉ"] && (
                                <div className="flex items-center gap-1.5 truncate" title={`Trụ sở: ${customer["Địa chỉ"]}`}>
                                  <MapPin size={13} className="text-rose-500 shrink-0" />
                                  <span className="truncate"><strong>TS:</strong> {customer["Địa chỉ"]}</span>
                                </div>
                              )}
                              {customer["Nhà máy"] && (
                                <div className="flex items-center gap-1.5 truncate text-slate-500" title={`Nhà máy: ${customer["Nhà máy"]}`}>
                                  <Factory size={13} className="text-indigo-500 shrink-0" />
                                  <span className="truncate"><strong>NM:</strong> {customer["Nhà máy"]}</span>
                                </div>
                              )}
                              {!customer["Địa chỉ"] && !customer["Nhà máy"] && <span className="text-slate-300 font-mono">-</span>}
                            </div>
                          </td>

                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-1 font-mono text-xs">
                              {customer["Mã số thuế"] && (
                                <button 
                                  onClick={(e) => copyToClipboard(customer["Mã số thuế"], "Mã số thuế", e)}
                                  className="flex items-center gap-1 text-slate-700 font-bold hover:text-blue-600 text-left"
                                >
                                  <span className="text-slate-400 font-sans text-[10px]">MST:</span>
                                  <span>{customer["Mã số thuế"]}</span>
                                  <Copy size={10} className="text-slate-400" />
                                </button>
                              )}
                              {customer["Số điện thoại"] && (
                                <a 
                                  href={`tel:${customer["Số điện thoại"]}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="flex items-center gap-1 text-slate-700 font-bold hover:text-blue-600"
                                >
                                  <span className="text-slate-400 font-sans text-[10px]">SĐT:</span>
                                  <span>{customer["Số điện thoại"]}</span>
                                </a>
                              )}
                              {!customer["Mã số thuế"] && !customer["Số điện thoại"] && <span className="text-slate-300 font-mono">-</span>}
                            </div>
                          </td>

                          <td className="px-6 py-4">
                            {linkedContacts.length > 0 ? (
                              <div className="flex flex-col gap-1 max-w-[200px]">
                                {linkedContacts.slice(0, 2).map((c: any, cidx: number) => (
                                  <div key={c.id || c.ID || `contact-table-${customerKey}-${cidx}`} className="text-xs">
                                    <span className="font-bold text-slate-800">{c["Tên"]}</span>
                                    {c["Chức vụ"] && <span className="text-slate-400 text-[10px] ml-1">({c["Chức vụ"]})</span>}
                                  </div>
                                ))}
                                {linkedContacts.length > 2 && (
                                  <span className="text-[10px] text-blue-600 font-bold">
                                    + {linkedContacts.length - 2} nhân sự khác
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-300 font-mono">-</span>
                            )}
                          </td>

                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                              cardStatus === "Đang mua" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                              cardStatus === "Đang đàm phán" ? "bg-amber-50 text-amber-700 border border-amber-200" :
                              "bg-slate-100 text-slate-600 border border-slate-200"
                            }`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${
                                cardStatus === "Đang mua" ? "bg-emerald-500" :
                                cardStatus === "Đang đàm phán" ? "bg-amber-500" :
                                "bg-slate-400"
                              }`} />
                              {cardStatus}
                            </span>
                          </td>

                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                              <button 
                                onClick={() => handleOpenModal(customer)}
                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Sửa"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button 
                                onClick={(e) => handleDelete(customer.id, customer.Customer_ID, e)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Xoá"
                              >
                                <Trash2 size={16} />
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

            /* MODE 3: COMPACT EXECUTIVE MATRIX VIEW */
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredCustomers.map((customer, idx) => {
                const cleanName = cleanCompanyName(customer["Tên đầy đủ"] || "");
                const cardStatus = customer["Tình trạng"] || "Đang mua";
                const customerKey = customer.id || customer.Customer_ID || `cust-compact-${idx}`;

                return (
                  <div
                    key={customerKey}
                    onClick={() => setSelectedCustomerDetail(customer)}
                    className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md hover:border-blue-300 transition-all cursor-pointer flex items-center gap-3.5 group"
                  >
                    <CompanyLogo 
                      name={customer["Tên đầy đủ"] || cleanName} 
                      size="sm" 
                      logoUrl={getCustomerLogo(customer)} 
                      logoFit={customer.logoFit} 
                      className="shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-mono text-[10px] font-bold text-slate-400">{customer["Customer_ID"]}</span>
                        <span className={`inline-block h-2 w-2 rounded-full ${
                          cardStatus === "Đang mua" ? "bg-emerald-500" :
                          cardStatus === "Đang đàm phán" ? "bg-amber-500" :
                          "bg-slate-300"
                        }`} title={cardStatus} />
                      </div>
                      <h4 className="font-bold text-slate-900 text-xs truncate group-hover:text-blue-600 transition-colors mt-0.5">
                        {cleanName}
                      </h4>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        {customer["Địa chỉ"] || customer["Phân loại"] || "Chưa có địa chỉ"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )

        ) : (

          /* Empty State */
          <div className="bg-white border border-slate-200/80 rounded-3xl p-16 flex flex-col items-center justify-center text-center shadow-sm">
            <div className="h-20 w-20 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mb-4 border border-blue-100 shadow-sm">
              <Users size={36} />
            </div>
            <h3 className="text-xl font-bold text-slate-900">Không tìm thấy dữ liệu khách hàng</h3>
            <p className="text-slate-500 text-sm max-w-md mt-1.5 leading-relaxed">
              {searchTerm || statusFilter !== 'all' || categoryFilter !== 'all'
                ? 'Không có khách hàng nào phù hợp với bộ lọc tìm kiếm hiện tại. Thử xóa hoặc thay đổi điều kiện lọc.'
                : 'Hệ thống chưa có hồ sơ đối tác khách hàng nào. Hãy thêm khách hàng mới ngay bây giờ.'}
            </p>
            {(searchTerm || statusFilter !== 'all' || categoryFilter !== 'all') && (
              <button 
                onClick={() => { setSearchTerm(''); setStatusFilter('all'); setCategoryFilter('all'); }}
                className="mt-5 text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-xl transition-all"
              >
                Xóa tất cả bộ lọc
              </button>
            )}
          </div>
        )}

      </div>

      {/* CUSTOMER DETAIL QUICK DRAWER / INSPECTOR MODAL */}
      {selectedCustomerDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-end p-0 sm:p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-xl h-full sm:h-auto sm:max-h-[92vh] sm:rounded-3xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden animate-in slide-in-from-right duration-300">
            
            {/* Drawer Header */}
            <div className="bg-gradient-to-r from-slate-900 to-indigo-950 p-6 text-white relative">
              <button 
                onClick={() => setSelectedCustomerDetail(null)}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-all"
              >
                <X size={20} />
              </button>

              <div className="flex items-start gap-4">
                <CompanyLogo 
                  name={selectedCustomerDetail["Tên đầy đủ"] || cleanCompanyName(selectedCustomerDetail["Tên đầy đủ"] || "")}
                  size="lg"
                  logoUrl={getCustomerLogo(selectedCustomerDetail)}
                  logoFit={selectedCustomerDetail.logoFit}
                  className="border-2 border-white/20 shadow-md shrink-0 bg-white"
                />
                <div className="min-w-0 flex-1 pr-6">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="bg-blue-500/30 text-blue-300 border border-blue-400/30 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase">
                      {selectedCustomerDetail["Customer_ID"]}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      selectedCustomerDetail["Tình trạng"] === "Đang mua" ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/30" :
                      selectedCustomerDetail["Tình trạng"] === "Đang đàm phán" ? "bg-amber-500/20 text-amber-300 border border-amber-400/30" :
                      "bg-slate-700 text-slate-300"
                    }`}>
                      {selectedCustomerDetail["Tình trạng"] || "Đang mua"}
                    </span>
                  </div>

                  <h2 className="text-xl font-extrabold text-white mt-2 leading-tight">
                    {cleanCompanyName(selectedCustomerDetail["Tên đầy đủ"] || "")}
                  </h2>
                  <p className="text-xs text-slate-300 mt-1 font-medium">
                    {selectedCustomerDetail["Tên đầy đủ"]}
                  </p>
                </div>
              </div>
            </div>

            {/* Drawer Body Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm">
              
              {/* Classification & Category */}
              {selectedCustomerDetail["Phân loại"] && (
                <div className="flex items-center justify-between p-3.5 bg-blue-50/60 rounded-2xl border border-blue-100">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Phân loại đối tác</span>
                  <span className="font-extrabold text-blue-700 text-xs bg-white px-3 py-1 rounded-xl shadow-xs border border-blue-100">
                    {selectedCustomerDetail["Phân loại"]}
                  </span>
                </div>
              )}

              {/* Legal & Contact Info Box */}
              <div className="space-y-4">
                <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Thông Tin Pháp Lý & Liên Hệ</h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Mã số thuế</span>
                    {selectedCustomerDetail["Mã số thuế"] ? (
                      <button 
                        onClick={() => copyToClipboard(selectedCustomerDetail["Mã số thuế"], "Mã số thuế")}
                        className="font-mono font-extrabold text-slate-900 text-sm hover:text-blue-600 flex items-center gap-1.5"
                      >
                        <span>{selectedCustomerDetail["Mã số thuế"]}</span>
                        <Copy size={13} className="text-slate-400" />
                      </button>
                    ) : (
                      <span className="text-slate-400 italic text-xs">Chưa có mã số thuế</span>
                    )}
                  </div>

                  <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Số điện thoại liên hệ</span>
                    {selectedCustomerDetail["Số điện thoại"] ? (
                      <a 
                        href={`tel:${selectedCustomerDetail["Số điện thoại"]}`}
                        className="font-mono font-extrabold text-slate-900 text-sm hover:text-blue-600 flex items-center gap-1.5"
                      >
                        <Phone size={13} className="text-emerald-500" />
                        <span>{selectedCustomerDetail["Số điện thoại"]}</span>
                      </a>
                    ) : (
                      <span className="text-slate-400 italic text-xs">Chưa có SĐT</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Addresses Section */}
              <div className="space-y-3">
                <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Địa Điểm Trụ Sở & Cơ Sở Sản Xuất</h4>

                <div className="space-y-2.5">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-3">
                    <MapPin size={18} className="text-rose-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-extrabold text-slate-800 text-xs block">Trụ sở chính:</span>
                      <p className="text-slate-600 text-xs mt-0.5 leading-relaxed">
                        {selectedCustomerDetail["Địa chỉ"] || "Chưa đăng ký địa chỉ trụ sở chính."}
                      </p>
                    </div>
                  </div>

                  {selectedCustomerDetail["Nhà máy"] && (
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-3">
                      <Factory size={18} className="text-indigo-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-extrabold text-slate-800 text-xs block">Nhà máy / Kho nhận hàng:</span>
                        <p className="text-slate-600 text-xs mt-0.5 leading-relaxed">
                          {selectedCustomerDetail["Nhà máy"]}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Linked Contacts */}
              <div className="space-y-3">
                <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
                  Mạng Lưới Nhân Sự Liên Kết ({getLinkedContacts(selectedCustomerDetail).length})
                </h4>

                {getLinkedContacts(selectedCustomerDetail).length > 0 ? (
                  <div className="space-y-2">
                    {getLinkedContacts(selectedCustomerDetail).map((contact: any, cidx: number) => (
                      <div 
                        key={contact.id || contact.ID || `drawer-contact-${cidx}`}
                        className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <span className="font-extrabold text-slate-900 text-xs block truncate">{contact["Tên"]}</span>
                          {contact["Chức vụ"] && (
                            <span className="text-[11px] text-slate-500 font-medium block truncate">{contact["Chức vụ"]}</span>
                          )}
                        </div>

                        {contact["Điện thoại"] && (
                          <a 
                            href={`tel:${contact["Điện thoại"]}`}
                            className="px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-mono font-bold rounded-xl flex items-center gap-1.5 transition-colors shrink-0"
                          >
                            <Phone size={12} />
                            <span>{contact["Điện thoại"]}</span>
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    Chưa có nhân sự nào được liên kết với đối tác này.
                  </p>
                )}
              </div>

            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3 shrink-0">
              <button 
                onClick={() => {
                  const cust = selectedCustomerDetail;
                  setSelectedCustomerDetail(null);
                  handleOpenModal(cust);
                }}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-sm"
              >
                <Edit2 size={15} />
                <span>Chỉnh sửa hồ sơ</span>
              </button>

              <button 
                onClick={() => setSelectedCustomerDetail(null)}
                className="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl text-xs hover:bg-slate-100 transition-all"
              >
                Đóng
              </button>
            </div>

          </div>
        </div>
      )}

      {/* FORM MODAL (ADD / EDIT CUSTOMER) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-slate-900 to-indigo-950 text-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-500/20 border border-blue-400/30 text-blue-300 flex items-center justify-center shrink-0">
                  <Briefcase size={20} />
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-lg">
                    {editingCustomer ? 'Chỉnh Sửa Hồ Sơ Khách Hàng' : 'Thêm Khách Hàng Mới'}
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">Nhập các thông tin cơ bản của doanh nghiệp đối tác.</p>
                </div>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-all"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Form Content */}
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-5">
              
              {/* ID and Name */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-1">
                  <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">
                    Mã Khách Hàng <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="text" 
                    required
                    placeholder="KH-..."
                    disabled={!!editingCustomer}
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm bg-slate-50 disabled:bg-slate-100/80 disabled:cursor-not-allowed text-slate-700 font-mono font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" 
                    value={formData["Customer_ID"]}
                    onChange={e => setFormData({...formData, "Customer_ID": e.target.value.toUpperCase()})}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">
                    Tên Đầy Đủ Doanh Nghiệp <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="text" 
                    required
                    placeholder="Công ty TNHH..."
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" 
                    value={formData["Tên đầy đủ"]}
                    onChange={e => setFormData({...formData, "Tên đầy đủ": e.target.value})}
                  />
                </div>
              </div>

              {/* Classification and Status */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">Phân Loại Đối Tác</label>
                  <input 
                    type="text" 
                    placeholder="Nhóm / Ngành nghề..."
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" 
                    value={formData["Phân loại"]}
                    onChange={e => setFormData({...formData, "Phân loại": e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">Trạng Thái Hợp Tác</label>
                  <select 
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm bg-white font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    value={formData["Tình trạng"]}
                    onChange={e => setFormData({...formData, "Tình trạng": e.target.value})}
                  >
                    <option value="Đang mua">Đang mua</option>
                    <option value="Đang đàm phán">Đang đàm phán</option>
                    <option value="Ngừng mua">Ngừng mua</option>
                  </select>
                </div>
              </div>

              {/* Address (Trụ sở) & Factory (Nhà máy) */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">Địa Chỉ Trụ Sở Chính</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-rose-500" size={16} />
                    <input 
                      type="text" 
                      placeholder="Số nhà, Tên đường, Quận/Huyện, Tỉnh/TP..."
                      className="w-full pl-10 pr-3.5 py-2 text-sm border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" 
                      value={formData["Địa chỉ"]}
                      onChange={e => setFormData({...formData, "Địa chỉ": e.target.value})}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">Địa Chỉ Nhà Máy / Kho Hàng</label>
                  <div className="relative">
                    <Factory className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-500" size={16} />
                    <input 
                      type="text" 
                      placeholder="Khu công nghiệp, Cụm công nghiệp, Tỉnh thành..."
                      className="w-full pl-10 pr-3.5 py-2 text-sm border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" 
                      value={formData["Nhà máy"]}
                      onChange={e => setFormData({...formData, "Nhà máy": e.target.value})}
                    />
                  </div>
                </div>
              </div>

              {/* Tax Code and Phone Number */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">Mã Số Thuế</label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                      type="text" 
                      placeholder="Mã số thuế doanh nghiệp..."
                      className="w-full pl-10 pr-3.5 py-2 text-sm border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono font-bold" 
                      value={formData["Mã số thuế"] || ""}
                      onChange={e => setFormData({...formData, "Mã số thuế": e.target.value})}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">Số Điện Thoại</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500" size={16} />
                    <input 
                      type="text" 
                      placeholder="Số điện thoại bàn/di động..."
                      className="w-full pl-10 pr-3.5 py-2 text-sm border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono font-bold" 
                      value={formData["Số điện thoại"] || ""}
                      onChange={e => setFormData({...formData, "Số điện thoại": e.target.value})}
                    />
                  </div>
                </div>
              </div>

              {/* Logo Upload & URL Box */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider">Logo Doanh Nghiệp</label>
                <div className="flex items-center gap-4">
                  {logoPreview ? (
                    <img 
                      src={logoPreview} 
                      alt="Logo preview" 
                      className={`w-14 h-14 rounded-2xl border border-slate-200 bg-white shadow-xs ${formData.logoFit === 'contain' ? 'object-contain p-1' : 'object-cover'}`} 
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-2xl bg-slate-200/60 border border-dashed border-slate-300 flex items-center justify-center text-slate-400 text-[10px] text-center p-1 font-bold select-none">
                      Chưa có Logo
                    </div>
                  )}
                  
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <input 
                        type="file" 
                        id="customer-logo-upload"
                        accept="image/*"
                        className="hidden" 
                        onChange={handleFileChange}
                      />
                      <label 
                        htmlFor="customer-logo-upload"
                        className="px-3.5 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer hover:bg-slate-100 transition-all shadow-xs inline-flex items-center gap-1.5"
                      >
                        <Upload size={14} />
                        <span>Tải tệp logo lên</span>
                      </label>
                      {logoFile && <span className="text-[10px] text-slate-500 font-mono truncate max-w-[120px]">{logoFile.name}</span>}
                    </div>

                    <div className="relative">
                      <Globe className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                      <input 
                        type="text" 
                        placeholder="Hoặc dán URL hình ảnh logo..."
                        className="w-full pl-8 pr-2.5 py-1.5 text-xs border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white transition-all" 
                        value={formData["logoUrl"] || ""}
                        onChange={e => {
                          setFormData({...formData, "logoUrl": e.target.value});
                          setLogoPreview(e.target.value || null);
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Linked Contacts Box */}
              <div className="space-y-2">
                <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wider">
                  Gắn Với Nhân Sự Trong Danh Bạ
                </label>
                {contacts.length > 0 ? (
                  <div className="border border-slate-200 rounded-2xl p-3 bg-white max-h-[140px] overflow-y-auto space-y-2">
                    {contacts.map((c: any, cidx: number) => {
                      const contactId = c.id || c.ID || `contact-opt-${cidx}`;
                      const explicitIds = String(formData["Liên hệ liên kết"] || "").split(',').map((id: string) => id.trim());
                      const isChecked = explicitIds.includes(contactId);
                      return (
                        <label key={contactId} className="flex items-start gap-2.5 p-1.5 hover:bg-blue-50/50 rounded-xl cursor-pointer transition-colors text-xs select-none">
                          <input 
                            type="checkbox"
                            className="rounded text-blue-600 focus:ring-blue-500 mt-0.5"
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
                            <span className="font-bold text-slate-900">{c["Tên"]}</span>
                            {c["Chức vụ"] && <span className="text-slate-500 text-[11px] ml-1">({c["Chức vụ"]})</span>}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">Không có liên hệ nào trong danh bạ hiện có.</p>
                )}
              </div>
              
              {/* Actions Footer */}
              <div className="pt-5 border-t border-slate-100 flex items-center justify-between shrink-0">
                {editingCustomer ? (
                  <button 
                    type="button" 
                    onClick={(e) => handleDelete(editingCustomer.id, editingCustomer.Customer_ID, e)}
                    className="flex items-center gap-1.5 px-3.5 py-2 text-red-600 hover:bg-red-50 rounded-xl text-xs font-bold transition-all border border-transparent hover:border-red-100"
                  >
                    <Trash2 size={15} />
                    <span>Xoá khách hàng này</span>
                  </button>
                ) : <div />}

                <div className="flex items-center gap-3">
                  <button 
                    type="button" 
                    onClick={() => setIsModalOpen(false)}
                    className="px-4.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
                  >
                    Huỷ
                  </button>
                  <button 
                    type="submit" 
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition-all active:scale-98"
                  >
                    {editingCustomer ? 'Lưu cập nhật' : 'Thêm mới'}
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
