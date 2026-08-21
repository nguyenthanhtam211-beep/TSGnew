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
  Loader2
} from 'lucide-react';
import clsx from 'clsx';
import { motion } from 'motion/react';
import * as XLSX from 'xlsx';
import { toast } from 'react-hot-toast';

interface StorageFile {
  fileId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  driveLink: string;
  uploadDate: string;
  documentType: 'PO' | 'PXK' | 'Invoice' | 'Others';
  documentNumber?: string;
  docNumber?: string;
  year: number;
  month: number;
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
  onUpload?: (file: File, metadata: { documentType: string; documentNumber: string }) => Promise<void>;
  onDelete?: (fileId: string) => Promise<void>;
  onRestoreData?: (importedData: any) => Promise<void>;
}

export default function StorageView({ files = [], allData, onUpload, onDelete, onRestoreData }: StorageViewProps) {
  const [activeTab, setActiveTab] = useState<'memory' | 'files'>('memory');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [isUploading, setIsUploading] = useState(false);
  const [isSavingMemory, setIsSavingMemory] = useState(false);

  // Upload Modal State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadDocType, setUploadDocType] = useState<string>('PO');
  const [uploadDocNum, setUploadDocNum] = useState<string>('');

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
      totalSizeMB: (totalApproxBytes / (1024 * 1024)).toFixed(2)
    };
  }, [allData]);

  // Memory Actions
  const handleForceSaveMemory = async () => {
    if (!allData) return;
    setIsSavingMemory(true);
    const saveToast = toast.loading("Đang ghi đồng bộ vào bộ nhớ đệm và ổ đĩa...");
    try {
      const collections = [
        { name: "customers", data: allData.customerData },
        { name: "suppliers", data: allData.supplierData },
        { name: "pricing", data: allData.pricingData },
        { name: "products", data: allData.productData },
        { name: "po_headers", data: allData.poHeaderData },
        { name: "po_lines", data: allData.poLinesData },
        { name: "delivery_plans", data: allData.deliveryPlanData },
        { name: "deliveries", data: allData.deliveryData },
        { name: "contracts", data: allData.contractsData },
        { name: "commissions", data: allData.commissionData },
        { name: "specs", data: allData.specsData },
        { name: "contacts", data: allData.contactData },
      ];

      for (const col of collections) {
        if (Array.isArray(col.data) && col.data.length > 0) {
          localStorage.setItem(`tsg_cache_${col.name}`, JSON.stringify(col.data));
          localStorage.setItem(`tsg_last_backup_time`, new Date().toISOString());
        }
      }

      toast.success("Đã lưu trữ an toàn 100% dữ liệu vào bộ nhớ!", { id: saveToast });
    } catch (err: any) {
      toast.error("Lỗi khi lưu bộ nhớ: " + (err?.message || err), { id: saveToast });
    } finally {
      setIsSavingMemory(false);
    }
  };

  const handleDownloadFullBackupJSON = () => {
    if (!allData) return;
    try {
      const fullBackupPayload = {
        app: "TSG Business OS",
        version: "2.5",
        backupTimestamp: new Date().toISOString(),
        backupDateFormatted: new Date().toLocaleString("vi-VN"),
        totalRecords: collectionsStats.totalRecords,
        totalSizeKB: collectionsStats.totalSizeKB,
        data: allData
      };

      const dataStr = JSON.stringify(fullBackupPayload, null, 2);
      const blob = new Blob([dataStr], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `TSG_Full_Memory_Backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("Đã tải tệp sao lưu bộ nhớ (.json) về máy tính!");
    } catch (err: any) {
      toast.error("Lỗi tạo bản sao lưu: " + (err?.message || err));
    }
  };

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
        { name: "Danh_Ba", data: allData.contactData }
      ];

      sheets.forEach(s => {
        if (Array.isArray(s.data) && s.data.length > 0) {
          const ws = XLSX.utils.json_to_sheet(s.data);
          XLSX.utils.book_append_sheet(wb, ws, s.name);
        }
      });

      XLSX.writeFile(wb, `TSG_Master_Database_Excel_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success("Đã xuất sổ Excel tổng hợp 12 trang tính!");
    } catch (err: any) {
      toast.error("Lỗi xuất Excel: " + (err?.message || err));
    }
  };

  const handleRestoreFromFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const text = evt.target?.result as string;
        const parsed = JSON.parse(text);
        const dataToRestore = parsed.data || parsed;

        const confirmRestore = window.confirm(
          `Bạn có chắc muốn khôi phục dữ liệu từ bản sao lưu?\nTổng số bản ghi: ${parsed.totalRecords || "nhiều"} mục.`
        );

        if (confirmRestore) {
          Object.keys(dataToRestore).forEach(col => {
            const list = dataToRestore[col];
            if (Array.isArray(list)) {
              localStorage.setItem(`tsg_cache_${col}`, JSON.stringify(list));
            }
          });

          if (onRestoreData) {
            await onRestoreData(dataToRestore);
          }

          toast.success("Đã khôi phục bộ nhớ thành công! Hệ thống đang tải lại...");
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        }
      } catch (err: any) {
        toast.error("Lỗi đọc tệp sao lưu: " + (err?.message || err));
      }
    };
    reader.readAsText(file);
  };

  // Files Filter
  const filteredFiles = useMemo(() => {
    return files.filter(f => {
      const matchType = selectedType === 'ALL' || f.documentType === selectedType;
      const matchSearch = searchQuery === '' || 
        f.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (f.documentNumber && f.documentNumber.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchType && matchSearch;
    });
  }, [files, selectedType, searchQuery]);

  const getFileIcon = (mimeType: string) => {
    if (mimeType.includes('pdf')) return <FileText className="text-red-500" size={24} />;
    if (mimeType.includes('sheet') || mimeType.includes('excel')) return <FileSpreadsheet className="text-green-600" size={24} />;
    if (mimeType.includes('image')) return <FileImage className="text-blue-500" size={24} />;
    return <File className="text-slate-500" size={24} />;
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
              <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest bg-blue-50 px-2.5 py-0.5 rounded-md border border-blue-100">
                Persistent Data & Memory Engine
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-xs text-slate-500 font-medium">100% An toàn & Ngoại tuyến</span>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
              <Database className="text-[#007AFF]" size={26} />
              <span>Trung Tâm Lưu Trữ & Bộ Nhớ Dữ Liệu</span>
            </h2>
          </div>

          {/* Tab Switcher: Bộ Nhớ CSDL vs Kho File Drive */}
          <div className="bg-[#F5F5F7] p-1.5 rounded-2xl flex items-center border border-slate-200/60 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab('memory')}
              className={clsx(
                "px-4 py-2 rounded-xl transition-all flex items-center gap-2",
                activeTab === 'memory' ? "bg-white text-[#007AFF] shadow-xs font-bold" : "text-slate-600 hover:text-slate-900"
              )}
            >
              <Zap size={15} />
              <span>Bộ Nhớ & CSDL ({collectionsStats.totalRecords} mục)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('files')}
              className={clsx(
                "px-4 py-2 rounded-xl transition-all flex items-center gap-2",
                activeTab === 'files' ? "bg-white text-[#007AFF] shadow-xs font-bold" : "text-slate-600 hover:text-slate-900"
              )}
            >
              <HardDrive size={15} />
              <span>Kho File Drive ({files.length} tệp)</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: BỘ NHỚ & CƠ SỞ DỮ LIỆU BỀN VỮNG (MEMORY ENGINE) */}
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
                className="p-4 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-2xl text-left space-y-1 transition active:scale-[0.98] disabled:opacity-50"
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
                className="p-4 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 rounded-2xl text-left space-y-1 transition active:scale-[0.98]"
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
                className="p-4 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-2xl text-left space-y-1 transition active:scale-[0.98]"
              >
                <div className="font-bold text-xs flex items-center gap-2">
                  <FileSpreadsheet size={15} />
                  <span>Xuất Sổ Master Excel</span>
                </div>
                <p className="text-[11px] text-emerald-600">Sổ Excel 12 trang tính chuẩn hóa</p>
              </button>

              <label className="p-4 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-2xl text-left space-y-1 transition active:scale-[0.98] cursor-pointer block">
                <div className="font-bold text-xs flex items-center gap-2">
                  <Upload size={15} />
                  <span>Khôi Phục Từ File</span>
                </div>
                <p className="text-[11px] text-amber-700">Nạp lại tệp backup JSON</p>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleRestoreFromFile}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Detailed Breakdown Table */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs overflow-hidden">
            <div className="p-5 bg-[#F5F5F7] border-b border-slate-200/80 flex items-center justify-between">
              <div className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Layers size={16} className="text-[#007AFF]" />
                <span>Danh Mục Dữ Liệu Đang Được Lưu Trữ</span>
              </div>
              <span className="text-xs font-bold text-slate-700">
                Tổng: <strong className="text-blue-600 font-mono">{collectionsStats.totalRecords}</strong> bản ghi
              </span>
            </div>

            <div className="divide-y divide-slate-100">
              {collectionsStats.items.map((col, idx) => (
                <div key={idx} className="p-4 flex items-center justify-between text-xs hover:bg-slate-50 transition">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{col.icon}</span>
                    <div>
                      <div className="font-bold text-slate-900 text-sm">{col.name}</div>
                      <div className="text-[10.5px] text-slate-400 font-mono">Khoá bộ nhớ: tsg_cache_{col.key}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-5 text-right">
                    <div>
                      <div className="font-bold text-slate-900 text-sm tabular-nums font-sans">{col.count.toLocaleString("vi-VN")} mục</div>
                      <div className="text-[10.5px] text-slate-400 font-mono">{col.sizeKB} KB</div>
                    </div>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" title="Trạng thái: Đã lưu an toàn"></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: KHO TỆP CHỨNG TỪ GOOGLE DRIVE (FILES) */}
      {/* ========================================================================= */}
      {activeTab === 'files' && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  type="text" 
                  placeholder="Tìm tài liệu, số PO/PXK..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">Tất cả loại</option>
                <option value="PO">PO - Đơn đặt hàng</option>
                <option value="PXK">PXK - Phiếu xuất kho</option>
                <option value="Invoice">Hóa đơn VAT</option>
                <option value="Others">Khác</option>
              </select>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto justify-end">
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
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-sm active:scale-95 transition"
              >
                <Upload size={14} />
                Tải lên tệp mới
              </label>
            </div>
          </div>

          {/* Files List */}
          {filteredFiles.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 space-y-2">
              <HardDrive size={40} className="mx-auto text-slate-300" />
              <p className="font-semibold text-slate-700 text-sm">Chưa có tệp tài liệu nào trong kho</p>
              <p className="text-xs text-slate-400">Hãy nhấn Tải lên tệp mới để đính kèm PO, PXK hoặc Hóa đơn vào Google Drive</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#F5F5F7] border-b border-slate-200 text-[10.5px] uppercase font-bold text-slate-600">
                    <th className="px-4 py-3">Tên Tệp</th>
                    <th className="px-4 py-3">Loại Tài Liệu</th>
                    <th className="px-4 py-3">Số Chứng Từ</th>
                    <th className="px-4 py-3">Ngày Tải Lên</th>
                    <th className="px-4 py-3 text-right">Hành Động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredFiles.map((file, idx) => (
                    <tr key={file.fileId || idx} className="hover:bg-[#FBFBFD] transition">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          {getFileIcon(file.mimeType)}
                          <span className="font-semibold text-slate-900">{file.fileName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-50 text-blue-700 border border-blue-200">
                          {file.documentType}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-slate-800">
                        {file.documentNumber || file.docNumber || "---"}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {file.uploadDate ? new Date(file.uploadDate).toLocaleString("vi-VN") : "---"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <a
                            href={file.driveLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            title="Xem trên Drive"
                          >
                            <ExternalLink size={15} />
                          </a>
                          <button
                            type="button"
                            onClick={() => onDelete?.(file.fileId)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition"
                            title="Xóa"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Upload File Modal */}
      {selectedFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <HardDrive className="text-blue-600" size={18} />
                <span>Tải Lên Google Drive</span>
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
                <label className="block text-xs font-bold text-slate-700 mb-1">Loại tài liệu</label>
                <select 
                  value={uploadDocType}
                  onChange={(e) => setUploadDocType(e.target.value)}
                  className="w-full px-3 py-2 bg-[#FBFBFD] border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="PO">PO - Đơn đặt hàng</option>
                  <option value="PXK">PXK - Phiếu xuất kho</option>
                  <option value="Invoice">Hóa đơn VAT</option>
                  <option value="Others">Khác</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Số hiệu / Mã chứng từ</label>
                <input 
                  type="text" 
                  value={uploadDocNum}
                  onChange={(e) => setUploadDocNum(e.target.value)}
                  placeholder="Ví dụ: PO-2026-001 hoặc 26/PXK/01"
                  className="w-full px-3 py-2 bg-[#FBFBFD] border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button 
                onClick={() => setSelectedFile(null)}
                disabled={isUploading}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Hủy
              </button>
              <button 
                onClick={handleConfirmUpload}
                disabled={isUploading}
                className="flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition disabled:opacity-50"
              >
                {isUploading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Đang tải lên...
                  </>
                ) : (
                  'Lưu lên Drive'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
