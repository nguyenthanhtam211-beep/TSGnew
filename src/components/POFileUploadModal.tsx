import React, { useState, useRef } from 'react';
import { 
  X, UploadCloud, FileText, Image as ImageIcon, ExternalLink, 
  Share2, Copy, CheckCircle2, Loader2, RefreshCw, Download, 
  Eye, AlertCircle, Sparkles, Check, FileCheck, FolderOpen
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { uploadFileDirectToGoogleDrive } from '../lib/driveSync';
import MacTrafficLights from './MacTrafficLights';

interface POFileUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  poHeader: any;
  allPOHeaders?: any[];
  onSelectPO?: (po: any) => void;
  onUpdatePOHeader: (updatedHeader: any) => Promise<void> | void;
  onUploadSuccess?: (driveData: any) => void;
}

export function POFileUploadModal({
  isOpen,
  onClose,
  poHeader,
  allPOHeaders = [],
  onSelectPO,
  onUpdatePOHeader,
  onUploadSuccess
}: POFileUploadModalProps) {
  const [selectedPO, setSelectedPO] = useState<any>(poHeader || null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    fileName: string;
    driveLink: string;
    driveFileId?: string;
    downloadLink?: string;
    folderPath?: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync prop changes
  React.useEffect(() => {
    if (poHeader) {
      setSelectedPO(poHeader);
    }
  }, [poHeader]);

  if (!isOpen) return null;

  const poNumber = selectedPO?.['Đơn hàng'] || selectedPO?.['Số đơn hàng'] || '';
  const customerName = selectedPO?.['Khách hàng'] || selectedPO?.['RP_Khách hàng'] || '';
  const existingFile = selectedPO?.['Tệp đơn hàng'] || selectedPO?.['Tệp đính kèm'] || '';
  const existingDriveUrl = selectedPO?.['Drive_File_Url'] || selectedPO?.['File_Link'] || '';

  const handleFileChange = (file: File) => {
    const validExtensions = ['.pdf', '.png', '.jpg', '.jpeg', '.webp'];
    const lowerName = file.name.toLowerCase();
    const isValid = validExtensions.some(ext => lowerName.endsWith(ext));

    if (!isValid) {
      toast.error('Vui lòng chọn tệp định dạng PDF hoặc Hình ảnh (JPG, PNG, WEBP)!');
      return;
    }

    // Check max size: 25MB
    if (file.size > 25 * 1024 * 1024) {
      toast.error('Dung lượng tệp quá lớn! Vui lòng chọn tệp dưới 25MB.');
      return;
    }

    setSelectedFile(file);
    setUploadResult(null);

    // If image, create preview
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setImagePreviewUrl(url);
    } else {
      setImagePreviewUrl(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleUploadAndSave = async () => {
    if (!selectedFile) {
      toast.error('Vui lòng chọn tệp PDF hoặc Hình ảnh cần cập nhật!');
      return;
    }

    if (!poNumber) {
      toast.error('Không xác định được mã đơn hàng PO!');
      return;
    }

    setIsUploading(true);
    setUploadProgress('Đang chuẩn bị tệp và xác thực Google Drive...');

    try {
      const now = new Date();
      const year = now.getFullYear().toString();
      const month = (now.getMonth() + 1).toString().padStart(2, '0');

      // Tự động chuẩn hóa tên tệp theo quy chuẩn TSG ERP
      const fileExt = selectedFile.name.substring(selectedFile.name.lastIndexOf('.'));
      const safePoCode = poNumber.replace(/[/\\#?%[\]\s.]+/g, '_');
      const safeCust = customerName.replace(/[/\\#?%[\]\s.]+/g, '_');
      const standardizedName = `PO_${safePoCode}_${safeCust}${fileExt}`;

      setUploadProgress('Đang tải tệp lên Google Drive...');

      const uploadRes = await uploadFileDirectToGoogleDrive({
        file: selectedFile,
        fileName: standardizedName,
        documentType: 'Don_Hang_PO',
        documentNumber: poNumber,
        year,
        month
      });

      setUploadProgress('Đang kích hoạt quyền chia sẻ công khai & lưu trữ...');

      const driveLink = uploadRes.shareLink || uploadRes.driveLink;

      // Cập nhật PO Header record
      const updatedPO = {
        ...selectedPO,
        'Tệp đơn hàng': standardizedName,
        'Drive_File_Url': driveLink,
        'File_Link': driveLink,
        'Drive_File_Id': uploadRes.driveFileId,
        'File_Type': selectedFile.type,
        'File_Size': selectedFile.size,
        'File_Updated_At': now.toISOString()
      };

      await onUpdatePOHeader(updatedPO);
      setSelectedPO(updatedPO);

      const result = {
        fileName: standardizedName,
        driveLink,
        driveFileId: uploadRes.driveFileId,
        downloadLink: uploadRes.downloadLink,
        folderPath: uploadRes.folderPath
      };

      setUploadResult(result);
      if (onUploadSuccess) {
        onUploadSuccess(result);
      }

      // Tự động sao chép link chia sẻ vào clipboard
      try {
        await navigator.clipboard.writeText(driveLink);
        setCopiedLink(true);
        toast.success('🎉 Đã tải lên Google Drive & sao chép link chia sẻ vào bộ nhớ tạm!');
      } catch {
        toast.success('🎉 Đã tải lên Google Drive thành công!');
      }

    } catch (err: any) {
      console.error('Lỗi khi tải file lên Drive:', err);
      toast.error(err.message || 'Lỗi khi tải tệp lên Google Drive!');
    } finally {
      setIsUploading(false);
      setUploadProgress('');
    }
  };

  const handleCopyShareLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      toast.success('Đã sao chép link chia sẻ Google Drive!');
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      toast.error('Không thể tự động sao chép link');
    }
  };

  const isPdf = (name: string) => name.toLowerCase().endsWith('.pdf');
  const isImg = (name: string) => /\.(jpg|jpeg|png|webp|gif)$/i.test(name);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto animate-fadeIn">
      <div 
        className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto transition-all"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-4 bg-white border-b border-black/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <UploadCloud size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 font-space-grotesk">
                Cập Nhật PO Đơn Hàng Bằng File PDF / Ảnh
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                  Google Drive Ready
                </span>
              </h3>
              <p className="text-[11px] text-slate-500">
                Lưu trữ đám mây Google Drive an toàn & tự động tạo đường link chia sẻ
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-5">
          {/* Target PO Selection / Card */}
          <div className="bg-blue-50/70 p-4 rounded-xl border border-blue-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600/10 text-blue-700 flex items-center justify-center font-black text-xs shrink-0 border border-blue-200">
                PO
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-blue-950 font-mono tracking-tight">
                    {poNumber || 'Chưa chọn đơn hàng'}
                  </span>
                  {selectedPO?.['Phân loại'] && (
                    <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-bold">
                      {selectedPO['Phân loại']}
                    </span>
                  )}
                </div>
                <p className="text-xs font-medium text-blue-800 mt-0.5">
                  Khách hàng: <strong>{customerName || 'Chưa có thông tin'}</strong>
                </p>
              </div>
            </div>

            {/* If allPOHeaders is provided and user wants to switch PO */}
            {allPOHeaders.length > 0 && onSelectPO && (
              <div className="sm:max-w-xs w-full">
                <label className="text-[10px] font-bold text-blue-700 uppercase tracking-wide block mb-1">
                  Đổi sang đơn hàng khác
                </label>
                <select
                  value={poNumber}
                  onChange={(e) => {
                    const found = allPOHeaders.find(p => (p['Đơn hàng'] || p['Số đơn hàng']) === e.target.value);
                    if (found) {
                      setSelectedPO(found);
                      onSelectPO(found);
                      setUploadResult(null);
                    }
                  }}
                  className="w-full text-xs font-bold font-mono px-2.5 py-1.5 bg-white border border-blue-200 rounded-lg focus:outline-none focus:border-blue-500"
                >
                  {allPOHeaders.map((p, idx) => {
                    const code = p['Đơn hàng'] || p['Số đơn hàng'];
                    const cust = p['Khách hàng'] || '';
                    return (
                      <option key={idx} value={code}>
                        {code} - {cust}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}
          </div>

          {/* Current Attached File Status */}
          {(existingFile || existingDriveUrl) && !uploadResult && (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div className="w-8 h-8 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center shrink-0">
                  {isPdf(existingFile) ? <FileText size={16} className="text-rose-600" /> : <ImageIcon size={16} className="text-blue-600" />}
                </div>
                <div className="overflow-hidden">
                  <p className="text-xs font-bold text-slate-800 truncate" title={existingFile}>
                    Tệp hiện tại: {existingFile || 'Chứng từ PO đã đính kèm'}
                  </p>
                  <span className="text-[10px] text-slate-500 flex items-center gap-1">
                    {existingDriveUrl ? 'Đã liên kết Google Drive' : 'Lưu cục bộ'} • Chọn tệp mới bên dưới để thay thế
                  </span>
                </div>
              </div>

              {existingDriveUrl && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleCopyShareLink(existingDriveUrl)}
                    className="p-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-600 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                    title="Sao chép link chia sẻ"
                  >
                    <Share2 size={13} />
                    <span className="hidden sm:inline">Chia sẻ</span>
                  </button>
                  <a
                    href={existingDriveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg text-blue-700 text-xs font-bold transition-all flex items-center gap-1"
                    title="Xem trên Google Drive"
                  >
                    <ExternalLink size={13} />
                    <span className="hidden sm:inline">Mở file</span>
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Drag & Drop File Upload Area */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-2xl p-6 sm:p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-blue-500 bg-blue-50/50 scale-[0.99]'
                : selectedFile
                ? 'border-emerald-400 bg-emerald-50/30'
                : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50/60'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileChange(e.target.files[0]);
                }
              }}
            />

            {selectedFile ? (
              <div className="space-y-3 w-full max-w-md">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md">
                  {selectedFile.type.startsWith('image/') ? (
                    <ImageIcon size={24} />
                  ) : (
                    <FileText size={24} />
                  )}
                </div>

                <div>
                  <p className="text-sm font-bold text-slate-900 truncate" title={selectedFile.name}>
                    {selectedFile.name}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • {selectedFile.type || 'Chứng từ'}
                  </p>
                </div>

                {imagePreviewUrl && (
                  <div className="max-h-44 overflow-hidden rounded-xl border border-emerald-200 bg-white shadow-xs p-1">
                    <img 
                      src={imagePreviewUrl} 
                      alt="Xem trước ảnh PO" 
                      className="w-full h-full object-contain max-h-40 mx-auto rounded-lg"
                    />
                  </div>
                )}

                <div className="flex items-center justify-center gap-2 pt-1">
                  <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold flex items-center gap-1">
                    <CheckCircle2 size={13} /> Sẵn sàng tải lên Google Drive
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFile(null);
                      setImagePreviewUrl(null);
                    }}
                    className="text-xs text-slate-400 hover:text-rose-600 font-semibold underline ml-2 cursor-pointer"
                  >
                    Chọn lại
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/20">
                  <UploadCloud size={28} />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">
                    Kéo thả file PDF hoặc Hình ảnh vào đây
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Hoặc bấm để duyệt tệp từ máy tính của bạn (hỗ trợ .pdf, .jpg, .png, .webp tối đa 25MB)
                  </p>
                </div>
                <div className="flex items-center justify-center gap-3 pt-2">
                  <span className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 text-[11px] font-bold border border-rose-200 flex items-center gap-1">
                    <FileText size={12} /> File PDF (Scan/Hợp đồng)
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 text-[11px] font-bold border border-blue-200 flex items-center gap-1">
                    <ImageIcon size={12} /> Hình ảnh (Chụp/Scan)
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Success Box after Upload */}
          {uploadResult && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <Check size={16} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-emerald-950">
                      Đã tải lên Google Drive & Kích hoạt link chia sẻ thành công!
                    </h4>
                    <p className="text-[11px] text-emerald-700">
                      Tệp: <strong>{uploadResult.fileName}</strong>
                    </p>
                  </div>
                </div>
              </div>

              {/* Shareable Link Box */}
              <div className="flex items-center gap-2 bg-white p-2.5 rounded-lg border border-emerald-200">
                <input
                  type="text"
                  readOnly
                  value={uploadResult.driveLink}
                  className="w-full text-xs font-mono text-slate-700 bg-transparent outline-none truncate select-all"
                />
                <button
                  type="button"
                  onClick={() => handleCopyShareLink(uploadResult.driveLink)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 shrink-0 cursor-pointer ${
                    copiedLink
                      ? 'bg-emerald-600 text-white'
                      : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800'
                  }`}
                >
                  {copiedLink ? <Check size={13} /> : <Copy size={13} />}
                  <span>{copiedLink ? 'Đã chép' : 'Sao chép link'}</span>
                </button>
                <a
                  href={uploadResult.driveLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 shrink-0"
                >
                  <ExternalLink size={13} />
                  <span>Mở Google Drive</span>
                </a>
              </div>
            </div>
          )}

          {/* Progress Indicator */}
          {isUploading && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-3">
              <Loader2 size={20} className="text-blue-600 animate-spin shrink-0" />
              <div>
                <p className="text-xs font-bold text-blue-900">{uploadProgress}</p>
                <p className="text-[11px] text-blue-600">Vui lòng chờ trong giây lát...</p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-4 bg-[#F9FAFB] border-t border-slate-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <FolderOpen size={14} className="text-slate-400" />
            <span>Thư mục Drive: <strong>TSG_Business_Documents / Don_Hang_PO</strong></span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition-all shadow-2xs cursor-pointer"
            >
              {uploadResult ? 'Hoàn tất' : 'Hủy bỏ'}
            </button>

            {!uploadResult && (
              <button
                type="button"
                disabled={!selectedFile || isUploading}
                onClick={handleUploadAndSave}
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-sm shadow-blue-500/20 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                {isUploading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Đang tải lên Drive...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud size={14} />
                    <span>⚡ Tải Lên Drive & Cập Nhật PO</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
