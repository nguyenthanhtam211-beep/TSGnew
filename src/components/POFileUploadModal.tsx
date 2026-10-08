import React, { useState, useRef } from 'react';
import { 
  X, UploadCloud, FileText, Image as ImageIcon, ExternalLink, 
  Share2, Copy, CheckCircle2, Loader2, RefreshCw, Download, 
  Eye, AlertCircle, Sparkles, Check, FileCheck, FolderOpen,
  Layers, Package, CheckSquare
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { uploadFileDirectToGoogleDrive } from '../lib/driveSync';
import { processDocumentOCR } from '../lib/gemini';
import { generateSmartDocumentFileName } from '../lib/documentNaming';
import { findPriceRecord, parseNumber, parseDateToISO, getDefaultSpecs } from '../lib/business-logic';
import { Modal, Button } from './ui';

interface POFileUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  poHeader: any;
  allPOHeaders?: any[];
  pricingData?: any[];
  products?: any[];
  onSelectPO?: (po: any) => void;
  onUpdatePOHeader: (updatedHeader: any) => Promise<void> | void;
  onAddPOLines?: (newLines: any[]) => Promise<void> | void;
  onUploadSuccess?: (driveData: any) => void;
}

export function POFileUploadModal({
  isOpen,
  onClose,
  poHeader,
  allPOHeaders = [],
  pricingData = [],
  products = [],
  onSelectPO,
  onUpdatePOHeader,
  onAddPOLines,
  onUploadSuccess
}: POFileUploadModalProps) {
  const [selectedPO, setSelectedPO] = useState<any>(poHeader || null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  
  // OCR states
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [extractedOcrData, setExtractedOcrData] = useState<any | null>(null);
  const [autoOcrEnabled, setAutoOcrEnabled] = useState(true);

  const [uploadResult, setUploadResult] = useState<{
    fileName: string;
    driveLink: string;
    driveFileId?: string;
    downloadLink?: string;
    folderPath?: string;
    ocrExtractedCount?: number;
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

  const handleFileChange = async (file: File) => {
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
    setExtractedOcrData(null);

    // If image, create preview
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setImagePreviewUrl(url);
    } else {
      setImagePreviewUrl(null);
    }

    // Trigger OCR in background if enabled
    if (autoOcrEnabled) {
      runOcrOnSelectedFile(file);
    }
  };

  const runOcrOnSelectedFile = async (fileToScan: File) => {
    setIsOcrProcessing(true);
    const toastId = toast.loading('Gemini AI Vision đang tự động quét bóc tách nội dung PO...');
    try {
      const ocrRes = await processDocumentOCR(fileToScan);
      setExtractedOcrData(ocrRes);

      const itemsCount = (ocrRes.items || []).length;
      if (itemsCount > 0) {
        toast.success(`✨ Đã nhận dạng được ${itemsCount} sản phẩm từ file chứng từ!`, { id: toastId });
      } else {
        toast.success('Đã hoàn tất phân tích văn bản chứng từ.', { id: toastId });
      }
    } catch (err: any) {
      console.warn('Lỗi quét OCR:', err);
      toast.dismiss(toastId);
    } finally {
      setIsOcrProcessing(false);
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

      // Tự động chuẩn hóa tên tệp theo quy chuẩn thông minh TSG ERP
      const fileExt = selectedFile.name.substring(selectedFile.name.lastIndexOf('.'));
      const standardizedName = generateSmartDocumentFileName({
        documentType: 'PO',
        documentNumber: poNumber,
        documentDate: selectedPO?.['Ngày đặt hàng'] || selectedPO?.['Ngày đặt'] || now.toISOString().split('T')[0],
        buyerName: customerName,
        originalFileName: selectedFile.name
      });

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

      // Nếu có kết quả OCR trích xuất được sản phẩm, tạo tự động PO Lines tương ứng
      let importedLinesCount = 0;
      if (extractedOcrData && extractedOcrData.items && extractedOcrData.items.length > 0 && onAddPOLines) {
        setUploadProgress('Đang đồng bộ dòng sản phẩm từ OCR vào Chi tiết đơn hàng...');
        const newLinesToSave: any[] = [];
        const headerId = String(poNumber).replace(/\//g, '-').trim();

        extractedOcrData.items.forEach((item: any, idx: number) => {
          const priceRecord = findPriceRecord(pricingData, { 
            sku: item.code || item.name, 
            name: item.name, 
            customer: customerName 
          });

          const masterSell = priceRecord ? (parseNumber(priceRecord['Giá bán']) || parseNumber(priceRecord['Đơn giá bán']) || parseNumber(priceRecord['Đơn giá bán mới'])) : (item.price || 0);
          const masterBuy = priceRecord ? (parseNumber(priceRecord['Giá nhập']) || parseNumber(priceRecord['Đơn giá mua'])) : 0;
          const effSell = item.price > 0 ? item.price : masterSell;
          const qty = parseNumber(item.quantity) || 1;
          const lineId = `D_${headerId}_${idx + 1}`;
          const prodName = item.name || (priceRecord ? priceRecord['Tên sản phẩm'] : 'Sản phẩm PO');
          const prodCode = item.code || (priceRecord ? priceRecord['Mã sản phẩm'] : '');
          const unit = item.unit || (priceRecord ? priceRecord['ĐVT'] : 'Cái');
          const specs = item.specs || (priceRecord ? priceRecord['Quy cách'] : getDefaultSpecs(prodName, prodCode, unit));

          newLinesToSave.push({
            'id': lineId,
            'STT': lineId,
            'Số đơn hàng': poNumber,
            'Đơn hàng': poNumber,
            'Mã giá bán': priceRecord ? (priceRecord['Mã giá'] || priceRecord['Mã giá bán']) : 'Gsp_N/A',
            'Tên sản phẩm': prodName,
            'Mã sản phẩm': prodCode,
            'Mã của khách': prodCode,
            'ĐVT': unit,
            'Số lượng': qty,
            'quantity': qty,
            'Quy cách': specs,
            'Ngày đặt hàng': selectedPO?.['Ngày đặt hàng'] || now.toISOString().split('T')[0],
            'Khách hàng': customerName,
            'Đơn vị nhận hàng': customerName,
            'Đơn giá bán': effSell,
            'Đơn giá nhập': masterBuy,
            'Thành tiền dòng': effSell * qty,
            'Lợi nhuận': (effSell - masterBuy) * qty,
            'Hoàn thành': 0,
            'createdAt': now.toISOString()
          });
        });

        if (newLinesToSave.length > 0) {
          await onAddPOLines(newLinesToSave);
          importedLinesCount = newLinesToSave.length;
        }
      }

      const result = {
        fileName: standardizedName,
        driveLink,
        driveFileId: uploadRes.driveFileId,
        downloadLink: uploadRes.downloadLink,
        folderPath: uploadRes.folderPath,
        ocrExtractedCount: importedLinesCount
      };

      setUploadResult(result);
      if (onUploadSuccess) {
        onUploadSuccess(result);
      }

      // Tự động sao chép link chia sẻ vào clipboard
      try {
        await navigator.clipboard.writeText(driveLink);
        setCopiedLink(true);
        toast.success(
          importedLinesCount > 0 
            ? `🎉 Đã đổi tên chuẩn [${standardizedName}], tải lên Drive và tự động tạo ${importedLinesCount} dòng PO Lines!` 
            : `🎉 Đã đổi tên chuẩn [${standardizedName}] và tải lên Google Drive thành công!`
        );
      } catch {
        toast.success(`🎉 Đã tải lên Google Drive với tên chuẩn: ${standardizedName}`);
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
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Cập Nhật PO Đơn Hàng Bằng File PDF / Ảnh"
      subtitle="Lưu trữ đám mây Google Drive an toàn & tự động tạo đường link chia sẻ"
      size="xl"
      footer={
        <div className="flex items-center justify-between gap-3 w-full">
          <div className="flex items-center gap-2 text-[11px] text-ink-muted">
            <FolderOpen size={14} className="text-slate-400" />
            <span>Thư mục Drive: <strong>TSG_Business_Documents / Don_Hang_PO</strong></span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={onClose}
            >
              {uploadResult ? 'Hoàn tất' : 'Hủy bỏ'}
            </Button>

            {!uploadResult && (
              <Button
                variant="primary"
                disabled={!selectedFile || isUploading}
                onClick={handleUploadAndSave}
                loading={isUploading}
                icon={!isUploading ? <UploadCloud size={14} /> : undefined}
              >
                ⚡ Tải Lên Drive & Cập Nhật PO
              </Button>
            )}
          </div>
        </div>
      }
    >
      {/* Modal Body */}
      <div className="space-y-5">
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

          {/* OCR Processing & Recognition Status Banner */}
          {isOcrProcessing && (
            <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center gap-3 animate-pulse">
              <Loader2 size={20} className="text-indigo-600 animate-spin shrink-0" />
              <div>
                <p className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                  <Sparkles size={14} className="text-indigo-600" />
                  Gemini AI Vision đang đọc và bóc tách dữ liệu từ file...
                </p>
                <p className="text-[11px] text-indigo-700 mt-0.5">
                  Tự động nhận diện Mã đơn hàng, Tên sản phẩm, ĐVT, Số lượng và khớp với Bảng Giá 2026.
                </p>
              </div>
            </div>
          )}

          {/* OCR Result Preview Card */}
          {extractedOcrData && extractedOcrData.items && extractedOcrData.items.length > 0 && !uploadResult && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xs font-bold shadow-xs">
                    <CheckSquare size={14} />
                  </span>
                  <div>
                    <h5 className="text-xs font-bold text-slate-900">
                      Tự động trích xuất: {extractedOcrData.items.length} mặt hàng từ chứng từ
                    </h5>
                    <p className="text-[10.5px] text-slate-500">
                      Số PO: <strong>{extractedOcrData.documentNumber || poNumber}</strong> • Ngày đặt: {extractedOcrData.documentDate || 'N/A'}
                    </p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-200">
                  ✨ Sẵn sàng tạo PO Lines
                </span>
              </div>

              <div className="max-h-36 overflow-y-auto rounded-lg border border-slate-200 bg-white">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="py-1.5 px-3">Tên sản phẩm</th>
                      <th className="py-1.5 px-2 text-center">ĐVT</th>
                      <th className="py-1.5 px-3 text-right">Số lượng</th>
                      <th className="py-1.5 px-3 text-right">Đơn giá bán</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {extractedOcrData.items.map((it: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50/80">
                        <td className="py-1.5 px-3 font-medium text-slate-800 truncate max-w-[200px]" title={it.name}>
                          {it.name || it.code}
                        </td>
                        <td className="py-1.5 px-2 text-center text-slate-500">{it.unit || 'Cái'}</td>
                        <td className="py-1.5 px-3 text-right font-bold text-slate-900">{Number(it.quantity || 0).toLocaleString('vi-VN')}</td>
                        <td className="py-1.5 px-3 text-right text-blue-600 font-mono font-semibold">
                          {it.price ? `${Number(it.price).toLocaleString('vi-VN')}đ` : 'Theo giá 2026'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

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
    </Modal>
  );
}
