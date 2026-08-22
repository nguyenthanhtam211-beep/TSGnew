import React, { useState, useMemo } from 'react';
import { 
  HardDrive, 
  Upload, 
  Search, 
  FileText, 
  Trash2, 
  ExternalLink, 
  FileSpreadsheet, 
  FileImage, 
  File, 
  Calendar, 
  Tag, 
  Clock, 
  CheckCircle,
  Database,
  Download,
  RefreshCw,
  Layers,
  ShieldCheck,
  Zap,
  Server,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FolderOpen,
  Filter,
  Check,
  Eye,
  Building2,
  MessageSquare
} from 'lucide-react';
import clsx from 'clsx';
import { motion } from 'motion/react';
import * as XLSX from 'xlsx';
import { toast } from 'react-hot-toast';

export interface StorageFile {
  id?: string;
  fileId: string;
  fileName: string;
  fileSize?: number | string;
  mimeType?: string;
  driveLink?: string;
  folderLink?: string;
  folderPath?: string;
  uploadDate?: string;
  documentType: string;
  documentNumber?: string;
  docNumber?: string;
  customer?: string;
  partnerName?: string;
  doubleCheckStatus?: 'verified' | 'pending' | 'discrepancy';
  checkedBy?: string;
  checkedAt?: string;
  checkNote?: string;
  syncedToDrive?: boolean;
  year?: number | string;
  month?: number | string;
}

interface StorageViewProps {
  files: StorageFile[];
  allData?: {
    pricingData: any[];
    poHeaderData: any[];
    poLinesData: any[];
    deliveryData: any[];
    customerData: any[];
    supplierData: any[];
    contactData: any[];
    productData: any[];
    deliveryPlanData: any[];
    specsData: any[];
    contractsData: any[];
    commissionData: any[];
    fileStorageData: any[];
  };
  onUpload?: (file: File, metadata: { documentType: string; documentNumber: string }) => Promise<any>;
  onDelete?: (fileId: string) => Promise<void>;
  onUpdateFile?: (file: any) => Promise<void>;
  onRestoreData?: (importedData: any) => Promise<void>;
  onPoClick?: (poNumber: string) => void;
  onProductClick?: (productName: string) => void;
}

export default function StorageView({ 
  files = [], 
  allData, 
  onUpload, 
  onDelete, 
  onUpdateFile,
  onRestoreData,
  onPoClick,
  onProductClick 
}: StorageViewProps) {
  const [activeTab, setActiveTab] = useState<'memory' | 'files'>('files');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedCheckStatus, setSelectedCheckStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isSavingMemory, setIsSavingMemory] = useState(false);

  // Upload Modal State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadDocType, setUploadDocType] = useState<string>('PXK');
  const [uploadDocNum, setUploadDocNum] = useState<string>('');
  const [uploadPartner, setUploadPartner] = useState<string>('');
  const [uploadNote, setUploadNote] = useState<string>('');

  // Editing Note State
  const [editingNoteFileId, setEditingNoteFileId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState<string>('');

  // Double Check Stats
  const checkStats = useMemo(() => {
    const total = files.length;
    const verified = files.filter(f => f.doubleCheckStatus === 'verified').length;
    const pending = files.filter(f => !f.doubleCheckStatus || f.doubleCheckStatus === 'pending').length;
    const discrepancy = files.filter(f => f.doubleCheckStatus === 'discrepancy').length;
    return { total, verified, pending, discrepancy };
  }, [files]);

  // Collections Stats Calculation
  const collectionsStats = useMemo(() => {
    if (!allData) {
      return { items: [], totalRecords: 0, totalSizeKB: '0', totalSizeMB: '0' };
    }

    const list = [
      { name: "Khách hàng (Customers)", key: "customers", data: allData.customerData, icon: "🏢" },
      { name: "Nhà cung cấp (Suppliers)", key: "suppliers", data: allData.supplierData, icon: "🏭" },
      { name: "Bảng giá 2026 (Pricing)", key: "pricing", data: allData.pricingData, icon: "🏷️" },
      { name: "Sản phẩm & Quy cách (Products)", key: "products", data: allData.productData, icon: "📦" },
      { name: "Đơn đặt hàng (PO Headers)", key: "po_headers", data: allData.poHeaderData, icon: "📑" },
      { name: "Chi tiết đơn hàng (PO Lines)", key: "po_lines", data: allData.poLinesData, icon: "📝" },
      { name: "Kế hoạch giao hàng (Delivery Plans)", key: "delivery_plans", data: allData.deliveryPlanData, icon: "📅" },
      { name: "Phiếu xuất kho (Deliveries PXK)", key: "deliveries", data: allData.deliveryData, icon: "🚚" },
      { name: "Hợp đồng & Phụ lục (Contracts)", key: "contracts", data: allData.contractsData, icon: "📜" },
      { name: "Hoa hồng & Chiết khấu (Commissions)", key: "commissions", data: allData.commissionData, icon: "💰" },
      { name: "Tiêu chuẩn kỹ thuật (Specs)", key: "specs", data: allData.specsData, icon: "🛡️" },
      { name: "Danh bạ liên hệ (Contacts)", key: "contacts", data: allData.contactData, icon: "👥" },
      { name: "Kho tài liệu đính kèm (Files)", key: "file_storage", data: allData.fileStorageData, icon: "📂" },
    ];

    let totalRecords = 0;
    let totalApproxBytes = 0;

    const mapped = list.map(item => {
      const count = (item.data || []).length;
      totalRecords += count;
      const jsonStr = JSON.stringify(item.data || []);
      const bytes = new Blob([jsonStr]).size;
      totalApproxBytes += bytes;

      return {
        ...item,
        count,
        sizeKB: (bytes / 1024).toFixed(1)
      };
    });

    return {
      items: mapped,
      totalRecords,
      totalSizeKB: (totalApproxBytes / 1024).toFixed(1),
      totalSizeMB: (totalApproxBytes / 1024 / 1024).toFixed(2)
    };
  }, [allData]);

  // Force Save to Local Storage
  const handleForceSaveMemory = () => {
    setIsSavingMemory(true);
    try {
      if (allData) {
        Object.entries(allData).forEach(([key, val]) => {
          if (Array.isArray(val)) {
            const storageKey = `tsg_cache_${key.replace('Data', '').toLowerCase()}`;
            localStorage.setItem(storageKey, JSON.stringify(val));
          }
        });
      }
      toast.success("Đã ghi ép buộc toàn bộ trạng thái vào bộ nhớ máy tính!");
    } catch (e: any) {
      toast.error("Lỗi khi lưu bộ nhớ: " + (e?.message || e));
    } finally {
      setIsSavingMemory(false);
    }
  };

  // Download Full JSON Backup
  const handleDownloadFullBackupJSON = () => {
    try {
      const backupPayload = {
        app: "TSG Business OS",
        version: "2026.1",
        exportedAt: new Date().toISOString(),
        totalRecords: collectionsStats.totalRecords,
        data: allData
      };

      const blob = new Blob([JSON.stringify(backupPayload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `TSG_Business_Backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Đã tải tệp sao lưu JSON về máy tính!");
    } catch (e: any) {
      toast.error("Lỗi tạo bản sao lưu: " + (e?.message || e));
    }
  };

  // Export Master Excel
  const handleExportMasterExcel = () => {
    if (!allData) return;
    try {
      const wb = XLSX.utils.book_new();

      const sheets = [
        { name: "Khach_Hang", data: allData.customerData },
        { name: "Nha_Cung_Cap", data: allData.supplierData },
        { name: "Bang_Gia_2026", data: allData.pricingData },
        { name: "San_Pham", data: allData.productData },
        { name: "Don_Hang_PO", data: allData.poHeaderData },
        { name: "Chi_Tiet_Don", data: allData.poLinesData },
        { name: "Ke_Hoach_Giao", data: allData.deliveryPlanData },
        { name: "Giao_Hang_PXK", data: allData.deliveryData },
        { name: "Hop_Dong", data: allData.contractsData },
        { name: "Hoa_Hong", data: allData.commissionData },
        { name: "Specs_Ky_Thuat", data: allData.specsData },
        { name: "Danh_Ba", data: allData.contactData },
        { name: "So_Doi_Soat_File", data: files }
      ];

      sheets.forEach(s => {
        if (Array.isArray(s.data) && s.data.length > 0) {
          const ws = XLSX.utils.json_to_sheet(s.data);
          XLSX.utils.book_append_sheet(wb, ws, s.name);
        }
      });

      XLSX.writeFile(wb, `TSG_Master_Database_Excel_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success("Đã xuất sổ Excel tổng hợp 13 trang tính!");
    } catch (err: any) {
      toast.error("Lỗi xuất Excel: " + (err?.message || err));
    }
  };

  // Files Filter
  const filteredFiles = useMemo(() => {
    return files.filter(f => {
      const docType = (f.documentType || '').toUpperCase();
      const matchType = selectedType === 'ALL' || docType.includes(selectedType);
      
      const status = f.doubleCheckStatus || 'pending';
      const matchStatus = selectedCheckStatus === 'ALL' || status === selectedCheckStatus;

      const q = searchQuery.toLowerCase().trim();
      const matchSearch = q === '' || 
        (f.fileName && f.fileName.toLowerCase().includes(q)) ||
        (f.documentNumber && f.documentNumber.toLowerCase().includes(q)) ||
        (f.docNumber && f.docNumber.toLowerCase().includes(q)) ||
        (f.customer && f.customer.toLowerCase().includes(q)) ||
        (f.partnerName && f.partnerName.toLowerCase().includes(q)) ||
        (f.checkNote && f.checkNote.toLowerCase().includes(q)) ||
        (f.folderPath && f.folderPath.toLowerCase().includes(q));

      return matchType && matchStatus && matchSearch;
    });
  }, [files, selectedType, selectedCheckStatus, searchQuery]);

  const getFileIcon = (mimeType?: string) => {
    const m = (mimeType || '').toLowerCase();
    if (m.includes('pdf')) return <FileText className="text-red-500" size={20} />;
    if (m.includes('sheet') || m.includes('excel')) return <FileSpreadsheet className="text-emerald-600" size={20} />;
    if (m.includes('image')) return <FileImage className="text-blue-500" size={20} />;
    return <File className="text-slate-500" size={20} />;
  };

  const handleToggleCheckStatus = async (file: StorageFile) => {
    const nextStatus: 'verified' | 'pending' | 'discrepancy' = 
      file.doubleCheckStatus === 'verified' ? 'discrepancy' :
      file.doubleCheckStatus === 'discrepancy' ? 'pending' : 'verified';

    const updated = {
      ...file,
      doubleCheckStatus: nextStatus,
      checkedBy: 'Ban Giám Đốc / Kế Toán TSG',
      checkedAt: new Date().toISOString()
    };

    if (onUpdateFile) {
      await onUpdateFile(updated);
    } else {
      localStorage.setItem(`tsg_cache_file_${file.fileId}`, JSON.stringify(updated));
    }

    const label = nextStatus === 'verified' ? '🟢 Khớp 100%' : nextStatus === 'discrepancy' ? '🔴 Lệch số liệu' : '🟡 Chờ rà soát';
    toast.success(`Đã cập nhật đối soát ${file.documentNumber || file.fileName}: ${label}`);
  };

  const handleSaveNote = async (file: StorageFile) => {
    const updated = {
      ...file,
      checkNote: editingNoteText
    };

    if (onUpdateFile) {
      await onUpdateFile(updated);
    }
    setEditingNoteFileId(null);
    toast.success("Đã cập nhật ghi chú đối soát!");
  };

  const handleConfirmUpload = async () => {
    if (!selectedFile || !onUpload) return;
    try {
      setIsUploading(true);
      await onUpload(selectedFile, {
        documentType: uploadDocType,
        documentNumber: uploadDocNum
      });
      setSelectedFile(null);
      setUploadDocNum('');
      setUploadPartner('');
      setUploadNote('');
    } catch (err) {
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10.5px] font-bold text-blue-600 uppercase tracking-widest bg-blue-50 px-2.5 py-0.5 rounded-md border border-blue-100">
                TSG Master Storage & Double-Check Register
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-xs text-slate-500 font-medium">Sổ Kiểm Soát & Đối Soát Chứng Từ 2 Bên</span>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
              <Database className="text-[#007AFF]" size={26} />
              <span>Kho Lưu Trữ & Sổ Đối Soát Chứng Từ</span>
            </h2>
          </div>

          {/* Tab Switcher */}
          <div className="bg-[#F5F5F7] p-1.5 rounded-2xl flex items-center border border-slate-200/60 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab('files')}
              className={clsx(
                "px-4 py-2 rounded-xl transition-all flex items-center gap-2 cursor-pointer",
                activeTab === 'files' ? "bg-white text-[#007AFF] shadow-xs font-bold" : "text-slate-600 hover:text-slate-900"
              )}
            >
              <HardDrive size={15} />
              <span>Sổ Chứng Từ Scan ({files.length} tệp)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('memory')}
              className={clsx(
                "px-4 py-2 rounded-xl transition-all flex items-center gap-2 cursor-pointer",
                activeTab === 'memory' ? "bg-white text-[#007AFF] shadow-xs font-bold" : "text-slate-600 hover:text-slate-900"
              )}
            >
              <Zap size={15} />
              <span>Bộ Nhớ & CSDL ({collectionsStats.totalRecords} mục)</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: SỔ KIỂM SOÁT & ĐỐI SOÁT CHỨNG TỪ SCAN (DOUBLE-CHECK REGISTER) */}
      {/* ========================================================================= */}
      {activeTab === 'files' && (
        <div className="space-y-6">
          {/* 4 Bento KPI Metric Counters */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <button
              type="button"
              onClick={() => setSelectedCheckStatus('ALL')}
              className={clsx(
                "p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between",
                selectedCheckStatus === 'ALL'
                  ? "bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-slate-900"
                  : "bg-white text-slate-800 border-slate-200/80 hover:border-slate-300 hover:shadow-2xs"
              )}
            >
              <span className={clsx("text-[10.5px] font-bold uppercase tracking-wider", selectedCheckStatus === 'ALL' ? "text-slate-300" : "text-slate-400")}>
                Tổng Chứng Từ Scan
              </span>
              <div className="text-2xl font-bold font-sans tabular-nums mt-2">
                {checkStats.total}
              </div>
              <span className={clsx("text-[10px] mt-1", selectedCheckStatus === 'ALL' ? "text-slate-300" : "text-slate-400")}>
                Toàn bộ PO, PXK & HĐ
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedCheckStatus('verified')}
              className={clsx(
                "p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between",
                selectedCheckStatus === 'verified'
                  ? "bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-500"
                  : "bg-white text-slate-800 border-slate-200/80 hover:border-emerald-300 hover:shadow-2xs"
              )}
            >
              <span className={clsx("text-[10.5px] font-bold uppercase tracking-wider", selectedCheckStatus === 'verified' ? "text-emerald-100" : "text-slate-400")}>
                Đã Khớp 100%
              </span>
              <div className={clsx("text-2xl font-bold font-sans tabular-nums mt-2", selectedCheckStatus === 'verified' ? "text-white" : "text-emerald-600")}>
                {checkStats.verified}
              </div>
              <span className={clsx("text-[10px] mt-1", selectedCheckStatus === 'verified' ? "text-emerald-100" : "text-slate-400")}>
                Đã double check kế toán
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedCheckStatus('pending')}
              className={clsx(
                "p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between",
                selectedCheckStatus === 'pending'
                  ? "bg-amber-500 text-white border-amber-500 shadow-md ring-2 ring-amber-400"
                  : "bg-white text-slate-800 border-slate-200/80 hover:border-amber-300 hover:shadow-2xs"
              )}
            >
              <span className={clsx("text-[10.5px] font-bold uppercase tracking-wider", selectedCheckStatus === 'pending' ? "text-amber-100" : "text-slate-400")}>
                Chờ Rà Soát
              </span>
              <div className={clsx("text-2xl font-bold font-sans tabular-nums mt-2", selectedCheckStatus === 'pending' ? "text-white" : "text-amber-600")}>
                {checkStats.pending}
              </div>
              <span className={clsx("text-[10px] mt-1", selectedCheckStatus === 'pending' ? "text-amber-100" : "text-slate-400")}>
                Cần đối chiếu thêm
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedCheckStatus('discrepancy')}
              className={clsx(
                "p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between",
                selectedCheckStatus === 'discrepancy'
                  ? "bg-rose-600 text-white border-rose-600 shadow-md ring-2 ring-rose-500"
                  : "bg-white text-slate-800 border-slate-200/80 hover:border-rose-300 hover:shadow-2xs"
              )}
            >
              <span className={clsx("text-[10.5px] font-bold uppercase tracking-wider", selectedCheckStatus === 'discrepancy' ? "text-rose-100" : "text-slate-400")}>
                Lệch Số Liệu / Sự Cố
              </span>
              <div className={clsx("text-2xl font-bold font-sans tabular-nums mt-2", selectedCheckStatus === 'discrepancy' ? "text-white" : "text-rose-600")}>
                {checkStats.discrepancy}
              </div>
              <span className={clsx("text-[10px] mt-1", selectedCheckStatus === 'discrepancy' ? "text-rose-100" : "text-slate-400")}>
                Cần kiểm tra kỹ
              </span>
            </button>
          </div>

          {/* Quick Actions & Master Drive Navigation Bar */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-2xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-wrap">
              <a
                href="https://drive.google.com/drive/search?q=TSG_Business_Documents"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer"
                title="Mở thư mục gốc TSG_Business_Documents trên Google Drive"
              >
                <FolderOpen size={16} className="text-blue-600" />
                <span>Mở Thư Mục TSG_Business_Documents (Drive)</span>
                <ExternalLink size={12} className="text-blue-400" />
              </a>

              <button
                type="button"
                onClick={handleExportMasterExcel}
                className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer"
                title="Tải sổ đối soát chứng từ dạng bảng Excel"
              >
                <FileSpreadsheet size={15} className="text-emerald-600" />
                <span>Xuất Sổ Đối Soát (.xlsx)</span>
              </button>
            </div>

            <div className="flex items-center gap-3">
              <input 
                type="file" 
                id="file-upload-input" 
                className="hidden" 
                onChange={(e) => {
                  if (e.target.files?.[0]) setSelectedFile(e.target.files[0]);
                }} 
              />
              <label 
                htmlFor="file-upload-input"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#007AFF] hover:bg-blue-600 text-white rounded-xl text-xs font-bold cursor-pointer shadow-sm active:scale-98 transition"
              >
                <Upload size={14} />
                <span>Đính Kèm Chứng Từ Mới</span>
              </label>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative flex-1 w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input 
                type="text" 
                placeholder="Tìm theo số PO, số PXK, đối tác, tên tệp..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-[#F5F5F7] border border-slate-200/60 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto flex-wrap justify-end">
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="px-3 py-2 bg-[#F5F5F7] border border-slate-200/60 rounded-xl text-xs font-semibold text-slate-700 outline-none cursor-pointer"
              >
                <option value="ALL">Tất cả loại chứng từ</option>
                <option value="PXK">Phiếu xuất kho (PXK)</option>
                <option value="PO">Đơn đặt hàng (PO)</option>
                <option value="HD">Hợp đồng & Phụ lục</option>
                <option value="INVOICE">Hóa đơn VAT</option>
                <option value="SPEC">Tiêu chuẩn Specs</option>
              </select>

              <select
                value={selectedCheckStatus}
                onChange={(e) => setSelectedCheckStatus(e.target.value)}
                className="px-3 py-2 bg-[#F5F5F7] border border-slate-200/60 rounded-xl text-xs font-semibold text-slate-700 outline-none cursor-pointer"
              >
                <option value="ALL">Tất cả trạng thái đối soát</option>
                <option value="verified">🟢 Đã khớp 100%</option>
                <option value="pending">🟡 Chờ rà soát</option>
                <option value="discrepancy">🔴 Lệch số liệu</option>
              </select>
            </div>
          </div>

          {/* Double-Check Table */}
          {filteredFiles.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center text-slate-400 space-y-3 shadow-2xs">
              <HardDrive size={44} className="mx-auto text-slate-300" />
              <p className="font-bold text-slate-700 text-sm">Chưa có chứng từ nào khớp với bộ lọc</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Hãy quét chứng từ qua OCR hoặc bấm Đính Kèm Chứng Từ Mới để lưu bản scan và đối soát chéo cùng kế toán.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.03)] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#F5F5F7] border-b border-slate-200/80 text-[10.5px] uppercase font-bold text-slate-600 tracking-wider">
                      <th className="px-3.5 py-3.5 text-center w-12">STT</th>
                      <th className="px-3.5 py-3.5">Loại & Tên File Scan</th>
                      <th className="px-3.5 py-3.5 text-center">Số Chứng Từ & PO</th>
                      <th className="px-3.5 py-3.5">Thư Mục Trên Google Drive</th>
                      <th className="px-3.5 py-3.5 text-center">Ngày Lưu</th>
                      <th className="px-3.5 py-3.5 text-center">Trạng Thái Đối Soát</th>
                      <th className="px-3.5 py-3.5">Ghi Chú Kế Toán / Giám Đốc</th>
                      <th className="px-3.5 py-3.5 text-right">Hành Động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
                    {filteredFiles.map((file, idx) => {
                      const status = file.doubleCheckStatus || 'pending';
                      const isVerified = status === 'verified';
                      const isDiscrepancy = status === 'discrepancy';

                      return (
                        <tr key={file.fileId || file.id || idx} className="hover:bg-[#FBFBFD] transition">
                          <td className="px-3.5 py-3.5 text-center font-mono text-slate-400">
                            {idx + 1}
                          </td>
                          <td className="px-3.5 py-3.5">
                            <div className="flex items-center gap-2.5 max-w-[220px]">
                              {getFileIcon(file.mimeType)}
                              <div className="truncate">
                                <p className="font-semibold text-slate-900 truncate" title={file.fileName}>
                                  {file.fileName}
                                </p>
                                <span className="inline-block px-1.5 py-0.2 rounded text-[9.5px] font-bold uppercase bg-blue-50 text-blue-700 border border-blue-100">
                                  {file.documentType || "PXK"}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-3.5 py-3.5 text-center">
                            <div className="space-y-0.5">
                              <span className="font-mono font-bold text-slate-900 block">
                                {file.documentNumber || file.docNumber || "---"}
                              </span>
                              {file.customer && (
                                <span className="text-[10.5px] text-slate-500 font-medium block truncate max-w-[130px] mx-auto">
                                  {file.customer}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3.5 py-3.5">
                            <div className="space-y-1 max-w-[220px]">
                              <code className="text-[10px] font-mono text-slate-600 bg-[#F5F5F7] px-2 py-0.5 rounded border border-slate-200 block truncate" title={file.folderPath || "TSG_Business_Documents"}>
                                {file.folderPath || "TSG_Business_Documents"}
                              </code>
                              {file.folderLink && (
                                <a
                                  href={file.folderLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10.5px] text-blue-600 hover:text-blue-800 flex items-center gap-1 font-semibold"
                                >
                                  <FolderOpen size={12} />
                                  <span>Mở thư mục này</span>
                                </a>
                              )}
                            </div>
                          </td>
                          <td className="px-3.5 py-3.5 text-center text-slate-500 text-[11px] font-mono">
                            {file.uploadDate ? new Date(file.uploadDate).toLocaleDateString("vi-VN") : "---"}
                          </td>
                          <td className="px-3.5 py-3.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleCheckStatus(file)}
                              className={clsx(
                                "px-2.5 py-1 rounded-xl text-[10.5px] font-bold inline-flex items-center gap-1.5 transition cursor-pointer active:scale-95",
                                isVerified && "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100",
                                isDiscrepancy && "bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100",
                                !isVerified && !isDiscrepancy && "bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100"
                              )}
                              title="Bấm để chuyển đổi trạng thái đối soát"
                            >
                              {isVerified && <CheckCircle size={12} className="text-emerald-600" />}
                              {isDiscrepancy && <AlertCircle size={12} className="text-rose-600" />}
                              {!isVerified && !isDiscrepancy && <Clock size={12} className="text-amber-600" />}
                              <span>
                                {isVerified ? "Đã Khớp 100%" : isDiscrepancy ? "Lệch Số Liệu" : "Chờ Rà Soát"}
                              </span>
                            </button>
                          </td>
                          <td className="px-3.5 py-3.5">
                            {editingNoteFileId === (file.fileId || file.id) ? (
                              <div className="flex items-center gap-1.5 min-w-[180px]">
                                <input
                                  type="text"
                                  value={editingNoteText}
                                  onChange={(e) => setEditingNoteText(e.target.value)}
                                  placeholder="Nhập ghi chú đối soát..."
                                  className="w-full px-2 py-1 bg-white border border-blue-400 rounded-lg text-xs outline-none"
                                  autoFocus
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSaveNote(file)}
                                  className="p-1 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                                >
                                  <Check size={12} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingNoteFileId(null)}
                                  className="p-1 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            ) : (
                              <div 
                                onClick={() => {
                                  setEditingNoteFileId(file.fileId || file.id || '');
                                  setEditingNoteText(file.checkNote || '');
                                }}
                                className="cursor-pointer hover:bg-slate-100 px-2 py-1 rounded-lg text-slate-600 text-[11px] truncate max-w-[200px]"
                                title="Bấm để sửa ghi chú đối soát"
                              >
                                {file.checkNote ? (
                                  <span>{file.checkNote}</span>
                                ) : (
                                  <span className="text-slate-300 italic">+ Thêm ghi chú...</span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-3.5 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {file.driveLink && (
                                <a
                                  href={file.driveLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition"
                                  title="Xem tệp trên Google Drive"
                                >
                                  <ExternalLink size={14} />
                                </a>
                              )}
                              <button
                                type="button"
                                onClick={() => onDelete?.(file.fileId || file.id || '')}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
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
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: BỘ NHỚ CƠ SỞ DỮ LIỆU BỀN VỮNG (MEMORY ENGINE) */}
      {/* ========================================================================= */}
      {activeTab === 'memory' && (
        <div className="space-y-6">
          {/* Architecture 3 Tiers Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Zap size={16} className="text-amber-500" />
                  <span>Bộ nhớ đệm RAM</span>
                </span>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  Phản hồi 0ms
                </span>
              </div>
              <div className="text-2xl font-bold text-slate-900 tabular-nums">
                {collectionsStats.totalRecords.toLocaleString("vi-VN")} <span className="text-sm font-normal text-slate-400">bản ghi</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Đọc/ghi tức thì không giật lag. Mọi thay đổi phản chiếu ngay lên màn hình.
              </p>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <HardDrive size={16} className="text-blue-500" />
                  <span>Ổ Đĩa Cục Bộ (Local)</span>
                </span>
                <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                  Bền Vững 100%
                </span>
              </div>
              <div className="text-2xl font-bold text-slate-900 tabular-nums">
                {collectionsStats.totalSizeKB} <span className="text-sm font-normal text-slate-400">KB ({collectionsStats.totalSizeMB} MB)</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Tự động lưu vào bộ nhớ máy tính. Tắt tab hoặc mất mạng vẫn còn nguyên vẹn.
              </p>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Server size={16} className="text-purple-500" />
                  <span>Đồng Bộ Cloud</span>
                </span>
                <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                  Firebase Cloud
                </span>
              </div>
              <div className="text-2xl font-bold text-slate-900 tabular-nums">
                13 <span className="text-sm font-normal text-slate-400">Collections</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Tự động sao lưu và đồng bộ đa thiết bị theo thời gian thực.
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-2xs space-y-4">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <ShieldCheck size={18} className="text-blue-600" />
              <span>Công Cụ Quản Trị & Sao Lưu Bộ Nhớ</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <button
                type="button"
                onClick={handleForceSaveMemory}
                disabled={isSavingMemory}
                className="p-4 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-2xl text-left space-y-1 transition active:scale-[0.98] disabled:opacity-50 cursor-pointer"
              >
                <div className="font-bold text-xs flex items-center gap-2">
                  <RefreshCw size={15} className={isSavingMemory ? "animate-spin" : ""} />
                  <span>Lưu Vào Bộ Nhớ Ngay</span>
                </div>
                <p className="text-[11px] text-blue-600">Ghi ép buộc vào Cache & Ổ đĩa máy</p>
              </button>

              <button
                type="button"
                onClick={handleDownloadFullBackupJSON}
                className="p-4 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 rounded-2xl text-left space-y-1 transition active:scale-[0.98] cursor-pointer"
              >
                <div className="font-bold text-xs flex items-center gap-2">
                  <Download size={15} />
                  <span>Tải Bản Sao Lưu (.json)</span>
                </div>
                <p className="text-[11px] text-purple-600">Tải về toàn bộ cơ sở dữ liệu</p>
              </button>

              <button
                type="button"
                onClick={handleExportMasterExcel}
                className="p-4 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-2xl text-left space-y-1 transition active:scale-[0.98] cursor-pointer"
              >
                <div className="font-bold text-xs flex items-center gap-2">
                  <FileSpreadsheet size={15} />
                  <span>Xuất Sổ Master Excel</span>
                </div>
                <p className="text-[11px] text-emerald-600">Tổng hợp 13 trang tính CSDL</p>
              </button>

              <label className="p-4 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-2xl text-left space-y-1 transition active:scale-[0.98] cursor-pointer block">
                <div className="font-bold text-xs flex items-center gap-2">
                  <Database size={15} />
                  <span>Khôi Phục Từ File</span>
                </div>
                <p className="text-[11px] text-amber-700">Nạp lại file JSON đã lưu</p>
                <input 
                  type="file" 
                  accept=".json" 
                  className="hidden" 
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file && onRestoreData) {
                      const reader = new FileReader();
                      reader.onload = async (evt) => {
                        try {
                          const parsed = JSON.parse(evt.target?.result as string);
                          await onRestoreData(parsed.data || parsed);
                          toast.success("Khôi phục thành công!");
                        } catch (err: any) {
                          toast.error("Lỗi đọc file: " + (err.message || err));
                        }
                      };
                      reader.readAsText(file);
                    }
                  }} 
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Upload File Modal */}
      {selectedFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <HardDrive className="text-blue-600" size={18} />
                <span>Đính Kèm Chứng Từ Vào Google Drive</span>
              </h3>
              <button 
                onClick={() => setSelectedFile(null)} 
                disabled={isUploading}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="bg-[#FBFBFD] p-3 rounded-2xl border border-slate-200 text-xs space-y-1">
                <p className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Tệp Đã Chọn</p>
                <p className="font-bold text-slate-900 truncate">{selectedFile.name}</p>
                <p className="text-slate-400 font-mono text-[11px]">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Loại Chứng Từ</label>
                <select
                  value={uploadDocType}
                  onChange={(e) => setUploadDocType(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none"
                >
                  <option value="PXK">Phiếu xuất kho / Biên bản giao hàng</option>
                  <option value="PO">Đơn đặt hàng (PO)</option>
                  <option value="HD">Hợp đồng & Phụ lục</option>
                  <option value="INVOICE">Hóa đơn VAT</option>
                  <option value="SPEC">Tiêu chuẩn kỹ thuật Specs</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Số Chứng Từ / Số PO</label>
                <input 
                  type="text" 
                  placeholder="VD: 26/PXK/16 hoặc 26/KHVT/0600"
                  value={uploadDocNum}
                  onChange={(e) => setUploadDocNum(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none"
                />
              </div>

              <div className="p-3 bg-blue-50/60 rounded-2xl border border-blue-100 text-[11px] text-blue-700 space-y-1">
                <p className="font-bold">📁 Cây Thư Mục Lưu Trữ Tự Động:</p>
                <p className="font-mono text-[10.5px]">TSG_Business_Documents / 2026 / {uploadDocType} / Thang_04</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedFile(null)}
                disabled={isUploading}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmUpload}
                disabled={isUploading}
                className="px-4 py-2 bg-[#007AFF] hover:bg-blue-600 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-sm active:scale-95 disabled:opacity-50"
              >
                {isUploading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Đang tải lên Drive...</span>
                  </>
                ) : (
                  <>
                    <Upload size={14} />
                    <span>Tải Lên & Lưu Trữ</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
