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

  const filteredFiles = useMemo(() => {
    return files.filter(f => {
      const matchesSearch = f.fileName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            f.documentNumber?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = selectedType === "All" || f.documentType === selectedType;
      const matchesYear = selectedYear === "All" || f.year === selectedYear;
      return matchesSearch && matchesType && matchesYear;
    });
  }, [files, searchTerm, selectedType, selectedYear]);

  const years = useMemo(() => {
    const y = new Set(files.map(f => f.year));
    return Array.from(y).sort((a, b) => b - a);
  }, [files]);

  const documentTypes = ["All", "PO", "PXK", "Invoice", "Others"];

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
              Lưu trữ Tài liệu Kinh doanh
            </h2>
            <p className="text-sm text-slate-500 mt-1">Được liên kết khoa học với Google Drive của TSG</p>
          </div>
          
          <div className="flex items-center gap-3">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileSelect} 
              className="hidden" 
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg shadow-blue-100 transition-all active:scale-95"
            >
              <Plus size={18} />
              Tải lên tài liệu
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4 mt-6">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Tìm kiếm tên tệp, số đơn hàng..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            />
          </div>

          <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-lg border border-slate-200">
            {documentTypes.map(type => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={clsx(
                  "px-3 py-1 rounded-md text-xs font-bold transition-all",
                  selectedType === type 
                    ? "bg-white text-blue-600 shadow-sm" 
                    : "text-slate-500 hover:text-slate-700"
                )}
              >
                {type === "All" ? "Tất cả" : type}
              </button>
            ))}
          </div>

          <select 
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value === "All" ? "All" : parseInt(e.target.value))}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="All">Tất cả năm</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            <button 
              onClick={() => setViewMode("list")}
              className={clsx("p-1.5 rounded", viewMode === "list" ? "bg-white shadow-sm text-blue-600" : "text-slate-400")}
            >
              <MoreVertical size={16} className="rotate-90" />
            </button>
            <button 
              onClick={() => setViewMode("grid")}
              className={clsx("p-1.5 rounded", viewMode === "grid" ? "bg-white shadow-sm text-blue-600" : "text-slate-400")}
            >
              <Folder size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto p-6">
        {filteredFiles.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-white rounded-2xl border-2 border-dashed border-slate-200">
            <HardDrive size={64} strokeWidth={1} className="mb-4 opacity-50" />
            <p className="text-lg font-medium">Chưa có tài liệu nào được lưu trữ</p>
            <p className="text-sm">Tải lên tài liệu đầu tiên hoặc sử dụng OCR để tự động lưu trữ</p>
          </div>
        ) : viewMode === "list" ? (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Tên tệp</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Loại / Số hiệu</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Thời gian tải</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredFiles.map((file, idx) => (
                  <tr key={file.fileId || idx} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="bg-slate-100 p-2 rounded-lg group-hover:bg-white transition-colors">
                          {getFileIcon(file.mimeType)}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800 line-clamp-1">{file.fileName}</p>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">{file.mimeType}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={clsx(
                          "px-2 py-0.5 rounded text-[10px] font-bold",
                          file.documentType === "PO" ? "bg-blue-100 text-blue-700" :
                          file.documentType === "PXK" ? "bg-green-100 text-green-700" :
                          "bg-slate-100 text-slate-600"
                        )}>
                          {file.documentType}
                        </span>
                        <span className="text-xs font-mono font-medium text-slate-500">{file.documentNumber}</span>
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
