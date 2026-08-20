import React, { useState, useMemo, useRef } from "react";
import { 
  Search, 
  File, 
  Folder, 
  ExternalLink, 
  Download, 
  Plus, 
  Filter, 
  HardDrive, 
  Clock, 
  FileText, 
  Image as ImageIcon, 
  Calendar,
  ChevronRight,
  MoreVertical,
  Trash2,
  Share2,
  Database,
  Loader2,
  X
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import clsx from "clsx";

interface FileStorage {
  fileId: string;
  driveFileId: string;
  fileName: string;
  mimeType: string;
  documentType: string;
  documentNumber: string;
  uploadDate: string;
  year: number;
  month: number;
  driveLink: string;
  uploader?: string;
}

interface StorageViewProps {
  files: any[];
  onUpload?: (file: File, metadata: any) => Promise<void>;
  onDelete?: (id: string) => void;
}

export default function StorageView({ files = [], onUpload, onDelete }: StorageViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState<string>("All");
  const [selectedYear, setSelectedYear] = useState<number | "All">("All");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  // Upload modal state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadDocType, setUploadDocType] = useState<string>("PO");
  const [uploadDocNum, setUploadDocNum] = useState<string>("");
  const [isUploading, setIsUploading] = useState<boolean>(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setUploadDocNum(file.name.replace(/\.[^/.]+$/, ""));
    }
  };

  const handleConfirmUpload = async () => {
    if (!selectedFile || !onUpload) return;
    setIsUploading(true);
    try {
      await onUpload(selectedFile, {
        documentType: uploadDocType,
        documentNumber: uploadDocNum || "DOC-" + Date.now().toString().slice(-4),
        fileName: selectedFile.name
      });
      setSelectedFile(null);
      setUploadDocNum("");
    } catch (error) {
      console.error("Manual upload failed:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const [selectedMonth, setSelectedMonth] = useState<number | "All">("All");
  const [selectedCategoryFolder, setSelectedCategoryFolder] = useState<string>("All");

  const months = [
    { num: 1, label: "Tháng 01" },
    { num: 2, label: "Tháng 02" },
    { num: 3, label: "Tháng 03" },
    { num: 4, label: "Tháng 04" },
    { num: 5, label: "Tháng 05" },
    { num: 6, label: "Tháng 06" },
    { num: 7, label: "Tháng 07" },
    { num: 8, label: "Tháng 08" },
    { num: 9, label: "Tháng 09" },
    { num: 10, label: "Tháng 10" },
    { num: 11, label: "Tháng 11" },
    { num: 12, label: "Tháng 12" },
  ];

  const categoryFolders = [
    { key: "All", name: "Tất cả thư mục", icon: HardDrive },
    { key: "01_CONTRACTS", name: "01_Hop_Dong_Goc_Va_Phu_Luc_PDF", icon: FileText },
    { key: "02_PRICING", name: "02_Bang_Gia_Va_Chinh_Sach_2026", icon: Database },
    { key: "03_PO_ORDERS", name: "03_Don_Hang_PO_Va_Ban_Scan_OCR", icon: FileText },
    { key: "04_DELIVERIES", name: "04_Phieu_Xuat_Kho_Giao_Hang_PXK", icon: File },
    { key: "05_SPECS", name: "05_Tieu_Chuan_Ky_Thuat_Specs", icon: FileText },
    { key: "06_MASTER_SHEETS", name: "06_Master_Data_Google_Sheets_BI", icon: Database },
    { key: "07_COMMISSIONS", name: "07_Chinh_Sach_Hoa_Hong_Commission", icon: FileText },
    { key: "08_REPORTS", name: "08_Bao_Cao_Tai_Chinh_Va_Slide_PDF", icon: FileText },
  ];

  const filteredFiles = useMemo(() => {
    return files.filter(f => {
      const matchesSearch = f.fileName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            f.documentNumber?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = selectedType === "All" || f.documentType === selectedType;
      const matchesYear = selectedYear === "All" || f.year === selectedYear;
      const matchesMonth = selectedMonth === "All" || f.month === selectedMonth;
      const matchesCat = selectedCategoryFolder === "All" || 
                         (f.folderPath && f.folderPath.includes(selectedCategoryFolder)) ||
                         (f.category && f.category.includes(selectedCategoryFolder));
      return matchesSearch && matchesType && matchesYear && matchesMonth && matchesCat;
    });
  }, [files, searchTerm, selectedType, selectedYear, selectedMonth, selectedCategoryFolder]);

  const years = useMemo(() => {
    const y = new Set(files.map(f => f.year));
    y.add(2026);
    return Array.from(y).sort((a, b) => b - a);
  }, [files]);

  const documentTypes = ["All", "PO", "PXK", "HD", "Invoice", "Others"];

  const getFileIcon = (mimeType: string) => {
    if (mimeType?.includes("image")) return <ImageIcon className="text-purple-500" size={18} />;
    if (mimeType?.includes("pdf")) return <FileText className="text-red-500" size={18} />;
    if (mimeType?.includes("sheet") || mimeType?.includes("excel")) return <Database className="text-green-600" size={18} />;
    return <File className="text-blue-500" size={18} />;
  };

  return (
    <div className="flex flex-col h-full bg-[#f8fafc]">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <HardDrive className="text-blue-600" size={24} />
              Lưu trữ Tài liệu Google Drive TSG
            </h2>
            <p className="text-xs text-slate-500 mt-1">Cấu trúc cây thư mục phân cấp Năm $\rightarrow$ Tháng $\rightarrow$ Loại Chứng Từ</p>
          </div>
          
          <div className="flex items-center gap-3">
            <a 
              href="https://drive.google.com/drive/search?q=TSG%20Business%20ERP"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all"
            >
              <ExternalLink size={15} />
              Mở Google Drive
            </a>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileSelect} 
              className="hidden" 
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-sm transition-all active:scale-95"
            >
              <Plus size={16} />
              Tải lên tài liệu
            </button>
          </div>
        </div>

        {/* Year & Month Picker Tabs */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
            <span className="text-[11px] font-bold text-slate-500 px-2 flex items-center gap-1">
              <Calendar size={13} /> Năm:
            </span>
            {years.map(y => (
              <button
                key={y}
                onClick={() => setSelectedYear(y)}
                className={clsx(
                  "px-3 py-1 rounded-lg text-xs font-bold transition-all",
                  selectedYear === y ? "bg-blue-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                )}
              >
                Năm {y}
              </button>
            ))}
          </div>

          {/* 12 Months Selector */}
          <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200/80 overflow-x-auto max-w-full">
            <button
              onClick={() => setSelectedMonth("All")}
              className={clsx(
                "px-2.5 py-1 rounded-md text-[11px] font-bold transition-all whitespace-nowrap",
                selectedMonth === "All" ? "bg-white text-blue-700 shadow-2xs border border-slate-200" : "text-slate-500 hover:text-slate-800"
              )}
            >
              Cả năm
            </button>
            {months.map(m => (
              <button
                key={m.num}
                onClick={() => setSelectedMonth(m.num)}
                className={clsx(
                  "px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all whitespace-nowrap",
                  selectedMonth === m.num ? "bg-blue-600 text-white font-bold shadow-2xs" : "text-slate-600 hover:text-slate-900"
                )}
              >
                T{m.num < 10 ? `0${m.num}` : m.num}
              </button>
            ))}
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-wrap items-center gap-3 mt-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Tìm kiếm tên tệp, số hợp đồng, mã PO..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-lg border border-slate-200">
            {documentTypes.map(type => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={clsx(
                  "px-2.5 py-1 rounded text-xs font-bold transition-all",
                  selectedType === type 
                    ? "bg-white text-blue-600 shadow-2xs border border-slate-200/60" 
                    : "text-slate-500 hover:text-slate-700"
                )}
              >
                {type === "All" ? "Tất cả" : type}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            <button 
              onClick={() => setViewMode("list")}
              className={clsx("p-1.5 rounded", viewMode === "list" ? "bg-white shadow-sm text-blue-600" : "text-slate-400")}
              title="Dạng danh sách"
            >
              <MoreVertical size={15} className="rotate-90" />
            </button>
            <button 
              onClick={() => setViewMode("grid")}
              className={clsx("p-1.5 rounded", viewMode === "grid" ? "bg-white shadow-sm text-blue-600" : "text-slate-400")}
              title="Dạng thư mục"
            >
              <Folder size={15} />
            </button>
          </div>
        </div>

        {/* Tree Path Breadcrumb */}
        <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-slate-100 text-xs text-slate-500 overflow-x-auto">
          <span className="font-semibold text-slate-700 flex items-center gap-1 shrink-0">
            <Folder size={14} className="text-amber-500" />
            TSG Business ERP - Master Storage
          </span>
          <ChevronRight size={13} className="text-slate-400 shrink-0" />
          <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded shrink-0">
            {selectedYear === 'All' ? 'Năm 2026' : `Năm ${selectedYear}`}
          </span>
          <ChevronRight size={13} className="text-slate-400 shrink-0" />
          <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded shrink-0">
            {selectedMonth === 'All' ? 'Tất cả 12 tháng' : `Tháng ${selectedMonth < 10 ? `0${selectedMonth}` : selectedMonth}`}
          </span>
        </div>

        {/* Category Folders Navigator */}
        <div className="flex items-center gap-1.5 mt-3 pt-2.5 border-t border-slate-100 overflow-x-auto pb-1">
          {categoryFolders.map(cat => {
            const Icon = cat.icon;
            const isSelected = selectedCategoryFolder === cat.key;
            return (
              <button
                key={cat.key}
                onClick={() => setSelectedCategoryFolder(cat.key)}
                className={clsx(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border",
                  isSelected
                    ? "bg-blue-600 text-white border-blue-600 shadow-2xs font-bold"
                    : "bg-white text-slate-600 hover:text-slate-900 border-slate-200/80 hover:bg-slate-50"
                )}
              >
                <Icon size={13} className={isSelected ? "text-white" : "text-slate-400"} />
                <span>{cat.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto p-6">
        {filteredFiles.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-white rounded-2xl border-2 border-dashed border-slate-200 p-12">
            <HardDrive size={64} strokeWidth={1} className="mb-4 opacity-50 text-blue-500" />
            <p className="text-lg font-bold text-slate-700">Chưa có tài liệu nào trong thư mục này</p>
            <p className="text-xs text-slate-400 mt-1 max-w-md text-center">
              Các file PDF hợp đồng, ảnh scan PO, và phiếu xuất kho tải lên hoặc do hệ thống sinh ra sẽ tự động lưu vào đây theo phân cấp Năm & Tháng.
            </p>
          </div>
        ) : viewMode === "list" ? (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Tên tệp & Đường dẫn Drive</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Loại / Số hiệu</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Thời gian</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredFiles.map((file, idx) => (
                  <tr key={file.fileId || file.id || idx} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="bg-slate-100 p-2 rounded-lg group-hover:bg-white transition-colors shrink-0">
                          {getFileIcon(file.mimeType)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-800 truncate" title={file.fileName}>{file.fileName}</p>
                          <p className="text-[10px] text-slate-500 font-mono mt-0.5 truncate flex items-center gap-1">
                            <Folder size={11} className="text-amber-500 shrink-0" />
                            <span>{file.folderPath || `TSG Business ERP / ${file.year || 2026} / Tháng ${String(file.month || 1).padStart(2, '0')} / ${file.category || file.documentType || '01_Hop_Dong_Goc_Va_Phu_Luc_PDF'}`}</span>
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={clsx(
                          "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                          file.documentType === "PO" || file.category?.includes('PO') ? "bg-blue-100 text-blue-700" :
                          file.documentType === "PXK" || file.category?.includes('PXK') ? "bg-green-100 text-green-700" :
                          file.documentType === "HD" || file.category?.includes('Hop_Dong') ? "bg-rose-100 text-rose-700" :
                          "bg-slate-100 text-slate-600"
                        )}>
                          {file.documentType || (file.category?.includes('Hop_Dong') ? 'HĐ' : 'DOC')}
                        </span>
                        <span className="text-xs font-mono font-medium text-slate-600">{file.documentNumber || file.docNumber}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-slate-500">
                        <Clock size={14} />
                        <span className="text-xs">{file.uploadDate ? new Date(file.uploadDate).toLocaleString("vi-VN") : "---"}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <a 
                          href={file.driveLink} 
                          target="_blank" 
                          rel="noreferrer"
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Xem trên Drive"
                        >
                          <ExternalLink size={16} />
                        </a>
                        <button 
                          onClick={() => onDelete?.(file.fileId)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Xóa"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredFiles.map((file, idx) => (
              <motion.div 
                layout
                key={file.fileId || idx}
                className="bg-white rounded-2xl border border-slate-200 p-4 hover:shadow-xl hover:shadow-slate-200/50 transition-all group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="bg-slate-50 p-3 rounded-xl group-hover:bg-blue-50 transition-colors">
                    {getFileIcon(file.mimeType)}
                  </div>
                  <div className="flex items-center gap-1">
                    <a 
                      href={file.driveLink} 
                      target="_blank" 
                      rel="noreferrer"
                      className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-all"
                    >
                      <ExternalLink size={16} />
                    </a>
                  </div>
                </div>
                
                <h4 className="text-sm font-bold text-slate-800 line-clamp-2 mb-1 group-hover:text-blue-600 transition-colors">
                  {file.fileName}
                </h4>
                
                <div className="flex items-center gap-2 mb-4">
                  <span className={clsx(
                    "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                    file.documentType === "PO" ? "bg-blue-100 text-blue-700" :
                    file.documentType === "PXK" ? "bg-green-100 text-green-700" :
                    "bg-slate-100 text-slate-600"
                  )}>
                    {file.documentType}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">{file.documentNumber}</span>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <Calendar size={12} />
                    <span className="text-[10px]">{file.uploadDate ? new Date(file.uploadDate).toLocaleDateString("vi-VN") : "---"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-600">{file.year}/{file.month.toString().padStart(2, '0')}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {selectedFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                <HardDrive className="text-blue-600" size={20} />
                Tải lên Google Drive
              </h3>
              <button 
                onClick={() => setSelectedFile(null)} 
                disabled={isUploading}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 my-5">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Tệp đã chọn</p>
                <p className="text-sm font-bold text-slate-700 truncate">{selectedFile.name}</p>
                <p className="text-xs text-slate-400 font-mono">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Loại tài liệu</label>
                <select 
                  value={uploadDocType}
                  onChange={(e) => setUploadDocType(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="PO">PO - Đơn đặt hàng</option>
                  <option value="PXK">PXK - Phiếu xuất kho</option>
                  <option value="Invoice">Invoice - Hóa đơn</option>
                  <option value="Others">Khác</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Số hiệu / Mã chứng từ</label>
                <input 
                  type="text" 
                  value={uploadDocNum}
                  onChange={(e) => setUploadDocNum(e.target.value)}
                  placeholder="Ví dụ: PO-2026-001"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button 
                onClick={() => setSelectedFile(null)}
                disabled={isUploading}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Hủy
              </button>
              <button 
                onClick={handleConfirmUpload}
                disabled={isUploading}
                className="flex items-center gap-2 px-5 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-lg shadow-blue-200 transition-all disabled:opacity-50"
              >
                {isUploading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
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
