import React, { useState, useRef, useEffect } from 'react';
import { 
  X, UploadCloud, FileText, Image as ImageIcon, ExternalLink, 
  Share2, Copy, CheckCircle2, Loader2, RefreshCw, Download, 
  Eye, AlertCircle, Sparkles, Check, FileCheck, FolderOpen,
  Layers, Package, CheckSquare, Edit3, Plus, Trash2, Calendar,
  Building2, Hash, Tag, ArrowRight
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { uploadFileDirectToGoogleDrive } from '../lib/driveSync';
import { processDocumentOCR } from '../lib/gemini';
import { generateSmartDocumentFileName } from '../lib/documentNaming';
import { findPriceRecord, parseNumber, parseDateToISO, getDefaultSpecs, formatVND } from '../lib/business-logic';
import { Modal, Button } from './ui';

export interface POItemRow {
  code: string;
  name: string;
  unit: string;
  quantity: number;
  price: number;
  amount: number;
  specs?: string;
  isMatched2026?: boolean;
}

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
  
  // Normalized editable fields
  const [docNumber, setDocNumber] = useState<string>('');
  const [docCustomer, setDocCustomer] = useState<string>('');
  const [docDate, setDocDate] = useState<string>('');
  const [items, setItems] = useState<POItemRow[]>([]);

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
  useEffect(() => {
    if (poHeader) {
      setSelectedPO(poHeader);
      setDocNumber(poHeader['Đơn hàng'] || poHeader['Số đơn hàng'] || '');
      setDocCustomer(poHeader['Khách hàng'] || poHeader['RP_Khách hàng'] || '');
      setDocDate(poHeader['Ngày đặt hàng'] || poHeader['Ngày đặt'] || new Date().toISOString().split('T')[0]);
    }
  }, [poHeader]);

  if (!isOpen) return null;

  const existingFile = selectedPO?.['Tệp đơn hàng'] || selectedPO?.['Tệp đính kèm'] || '';
  const existingDriveUrl = selectedPO?.['Drive_File_Url'] || selectedPO?.['File_Link'] || '';

  // Calculate totals
  const totalQuantity = items.reduce((sum, it) => sum + (parseNumber(it.quantity) || 0), 0);
  const totalAmount = items.reduce((sum, it) => sum + (parseNumber(it.amount) || (parseNumber(it.quantity) * parseNumber(it.price))), 0);

  const handleFileChange = async (file: File) => {
    const validExtensions = ['.pdf', '.png', '.jpg', '.jpeg', '.webp'];
    const lowerName = file.name.toLowerCase();
    const isValid = validExtensions.some(ext => lowerName.endsWith(ext));

    if (!isValid) {
      toast.error('Vui lòng chọn tệp định dạng PDF hoặc Hình ảnh (JPG, PNG, WEBP)!');
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      toast.error('Dung lượng tệp quá lớn! Vui lòng chọn tệp dưới 25MB.');
      return;
    }

    setSelectedFile(file);
    setUploadResult(null);

    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setImagePreviewUrl(url);
    } else {
      setImagePreviewUrl(null);
    }

    // Trigger OCR automatically
    runOcrOnSelectedFile(file);
  };

  const runOcrOnSelectedFile = async (fileToScan: File) => {
    setIsOcrProcessing(true);
    const toastId = toast.loading('AI Vision đang bóc tách và chuẩn hóa thông tin PO...');
    try {
      const ocrRes = await processDocumentOCR(fileToScan);

      // 1. Chuẩn hóa mã đơn hàng
      if (ocrRes.documentNumber && (!docNumber || docNumber === 'Chưa có' || docNumber.startsWith('PO_MOI_'))) {
        setDocNumber(ocrRes.documentNumber.trim());
      }

      // 2. Chuẩn hóa khách hàng
      if (ocrRes.buyerName && (!docCustomer || docCustomer === 'Khách hàng mới')) {
        const rawBuyer = ocrRes.buyerName.toLowerCase();
        let normalizedCust = ocrRes.buyerName;
        if (rawBuyer.includes('thanh hóa') || rawBuyer.includes('thanh hoá')) {
          normalizedCust = 'Thanh Hoá';
        } else if (rawBuyer.includes('thăng long')) {
          normalizedCust = 'Thăng Long';
        } else if (rawBuyer.includes('bắc sơn')) {
          normalizedCust = 'Bắc Sơn';
        }
        setDocCustomer(normalizedCust);
      }

      // 3. Chuẩn hóa ngày đặt hàng
      if (ocrRes.documentDate) {
        setDocDate(parseDateToISO(ocrRes.documentDate));
      }

      // 4. Chuẩn hóa danh sách sản phẩm theo Bảng Giá 2026
      if (ocrRes.items && Array.isArray(ocrRes.items) && ocrRes.items.length > 0) {
        const targetCust = docCustomer || ocrRes.buyerName || '';
        const parsedItems: POItemRow[] = ocrRes.items.map((it: any) => {
          const rawName = (it.name || '').trim();
          const rawCode = (it.code || '').trim();
          
          // Match với Bảng Giá 2026
          const priceRecord = findPriceRecord(pricingData, {
            sku: rawCode || rawName,
            name: rawName,
            customer: targetCust
          });

          const masterSell = priceRecord 
            ? (parseNumber(priceRecord['Giá bán']) || parseNumber(priceRecord['Đơn giá bán']) || parseNumber(priceRecord['Đơn giá bán mới'])) 
            : 0;
          
          const effSell = parseNumber(it.price) > 0 ? parseNumber(it.price) : (masterSell > 0 ? masterSell : 0);
          const qty = parseNumber(it.quantity) || 1;
          const unit = (it.unit || (priceRecord ? priceRecord['ĐVT'] : 'Cái')).trim();
          const prodName = priceRecord ? (priceRecord['Tên sản phẩm'] || rawName) : rawName;
          const prodCode = priceRecord ? (priceRecord['Mã sản phẩm'] || rawCode) : rawCode;
          const specs = it.specs || (priceRecord ? priceRecord['Quy cách'] : getDefaultSpecs(prodName, prodCode, unit));

          return {
            code: prodCode,
            name: prodName,
            unit,
            quantity: qty,
            price: effSell,
            amount: effSell * qty,
            specs,
            isMatched2026: !!priceRecord
          };
        });

        setItems(parsedItems);
        toast.success(`✨ Đã nhận diện & chuẩn hóa ${parsedItems.length} sản phẩm theo Bảng Giá 2026!`, { id: toastId });
      } else {
        toast.success('Đã hoàn tất phân tích văn bản chứng từ.', { id: toastId });
      }
    } catch (err: any) {
      console.warn('Lỗi quét OCR:', err);
      toast.error('Không thể hoàn tất quét OCR tự động. Vui lòng nhập thông tin thủ công.', { id: toastId });
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

  const updateItem = (index: number, field: keyof POItemRow, val: any) => {
    const next = [...items];
    const row = { ...next[index], [field]: val };
    
    // Auto recalculate amount
    if (field === 'quantity' || field === 'price') {
      const q = field === 'quantity' ? parseNumber(val) : parseNumber(row.quantity);
      const p = field === 'price' ? parseNumber(val) : parseNumber(row.price);
      row.amount = q * p;
    }

    // Auto match SKU if name changes
    if (field === 'name') {
      const matched = pricingData.find(p => 
        (p['Tên sản phẩm'] && p['Tên sản phẩm'].toLowerCase().includes(String(val).toLowerCase())) ||
        (p['Mã sản phẩm'] && p['Mã sản phẩm'].toLowerCase().includes(String(val).toLowerCase()))
      );
      if (matched) {
        row.code = matched['Mã sản phẩm'] || row.code;
        row.unit = matched['ĐVT'] || row.unit;
        if (!row.price || row.price === 0) {
          row.price = parseNumber(matched['Đơn giá bán']) || 0;
          row.amount = row.price * (parseNumber(row.quantity) || 1);
        }
        row.isMatched2026 = true;
      }
    }

    next[index] = row;
    setItems(next);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const addNewItem = () => {
    setItems([
      ...items,
      {
        code: '',
        name: '',
        unit: 'Cái',
        quantity: 1,
        price: 0,
        amount: 0,
        isMatched2026: false
      }
    ]);
  };

  const handleUploadAndSave = async () => {
    if (!selectedFile) {
      toast.error('Vui lòng chọn tệp chứng từ cần tải lên!');
      return;
    }

    const finalPoNum = docNumber.trim() || selectedPO?.['Đơn hàng'] || selectedPO?.['Số đơn hàng'];
    if (!finalPoNum) {
      toast.error('Vui lòng nhập Mã đơn hàng PO!');
      return;
    }

    setIsUploading(true);
    setUploadProgress('Đang chuẩn hóa tên tệp và tải lên Google Drive...');

    try {
      const now = new Date();
      const year = now.getFullYear().toString();
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      const finalCustomer = docCustomer.trim() || selectedPO?.['Khách hàng'] || 'Chưa rõ';
      const finalDate = docDate || selectedPO?.['Ngày đặt hàng'] || now.toISOString().split('T')[0];

      // Đổi tên tệp thông minh theo quy chuẩn TSG ERP: PO_[Số]_[Ngày]_[Khách]
      const standardizedName = generateSmartDocumentFileName({
        documentType: 'PO',
        documentNumber: finalPoNum,
        documentDate: finalDate,
        buyerName: finalCustomer,
        originalFileName: selectedFile.name
      });

      const uploadRes = await uploadFileDirectToGoogleDrive({
        file: selectedFile,
        fileName: standardizedName,
        documentType: 'Don_Hang_PO',
        documentNumber: finalPoNum,
        year,
        month
      });

      setUploadProgress('Đang cập nhật Đơn hàng PO & Dòng sản phẩm...');
      const driveLink = uploadRes.shareLink || uploadRes.driveLink;

      // Cập nhật PO Header
      const updatedPO = {
        ...selectedPO,
        'Đơn hàng': finalPoNum,
        'Số đơn hàng': finalPoNum,
        'Khách hàng': finalCustomer,
        'Ngày đặt hàng': finalDate,
        'Tệp đơn hàng': standardizedName,
        'Drive_File_Url': driveLink,
        'File_Link': driveLink,
        'Drive_File_Id': uploadRes.driveFileId,
        'File_Type': selectedFile.type,
        'File_Size': selectedFile.size,
        'File_Updated_At': now.toISOString()
      };

      if (totalAmount > 0) {
        updatedPO['Tổng tiền'] = totalAmount;
        updatedPO['Doanh thu'] = totalAmount;
      }
      if (totalQuantity > 0) {
        updatedPO['Số lượng'] = totalQuantity;
        updatedPO['Tổng số lượng'] = totalQuantity;
      }

      await onUpdatePOHeader(updatedPO);
      setSelectedPO(updatedPO);

      // Thêm dòng PO Lines nếu có
      let importedLinesCount = 0;
      if (items.length > 0 && onAddPOLines) {
        const headerId = String(finalPoNum).replace(/\//g, '-').trim();
        const newLinesToSave: any[] = [];

        items.forEach((item, idx) => {
          const priceRecord = findPriceRecord(pricingData, { 
            sku: item.code || item.name, 
            name: item.name, 
            customer: finalCustomer 
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
            'Số đơn hàng': finalPoNum,
            'Đơn hàng': finalPoNum,
            'Mã giá bán': priceRecord ? (priceRecord['Mã giá'] || priceRecord['Mã giá bán']) : 'Gsp_N/A',
            'Tên sản phẩm': prodName,
            'Mã sản phẩm': prodCode,
            'Mã của khách': prodCode,
            'ĐVT': unit,
            'Số lượng': qty,
            'quantity': qty,
            'Quy cách': specs,
            'Ngày đặt hàng': finalDate,
            'Khách hàng': finalCustomer,
            'Đơn vị nhận hàng': finalCustomer,
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

      try {
        await navigator.clipboard.writeText(driveLink);
        setCopiedLink(true);
      } catch (_) {}

      toast.success(
        importedLinesCount > 0 
          ? `🎉 Đã lưu ${importedLinesCount} sản phẩm vào PO [${finalPoNum}] & đồng bộ Drive!`
          : `🎉 Đã tải lên Google Drive & lưu PO [${finalPoNum}] thành công!`
      );

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
      toast.success('Đã sao chép link Google Drive!');
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      toast.error('Không thể tự động sao chép');
    }
  };

  const isPdf = (name: string) => name.toLowerCase().endsWith('.pdf');

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Tiếp Nhận & Quét Đơn Hàng PO"
      subtitle="Bóc tách thông tin tự động bằng AI • Khớp Bảng giá 2026 • Lưu trữ Google Drive"
      size="xl"
      footer={
        <div className="flex items-center justify-between gap-3 w-full">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <FolderOpen size={14} className="text-slate-400" />
            <span>Thư mục: <strong>Don_Hang_PO</strong> trên Google Drive</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={onClose}
            >
              {uploadResult ? 'Đóng' : 'Hủy bỏ'}
            </Button>

            {!uploadResult && (
              <Button
                variant="primary"
                disabled={!selectedFile || isUploading || isOcrProcessing}
                onClick={handleUploadAndSave}
                loading={isUploading}
                icon={!isUploading ? <CheckCircle2 size={15} /> : undefined}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              >
                ⚡ Lưu & Ghi Nhận Vào Đơn Hàng PO
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Upload success summary */}
        {uploadResult && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-3 animate-fadeIn">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <Check size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-emerald-950">
                    Đã ghi nhận đơn hàng PO & Lưu trữ Google Drive thành công!
                  </h4>
                  <p className="text-xs text-emerald-700 font-mono mt-0.5">
                    {uploadResult.fileName}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-emerald-200">
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
                <span>Mở Drive</span>
              </a>
            </div>
          </div>
        )}

        {/* Previous File Link (if already exists and no new upload yet) */}
        {!selectedFile && existingDriveUrl && !uploadResult && (
          <div className="p-2.5 px-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 truncate">
              <FileText size={15} className="text-slate-500 shrink-0" />
              <span className="text-slate-600 truncate">
                Tệp hiện tại: <strong className="text-slate-800">{existingFile || 'Chứng từ PO'}</strong>
              </span>
            </div>
            <a
              href={existingDriveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 shrink-0 ml-2"
            >
              <ExternalLink size={13} /> Mở file
            </a>
          </div>
        )}

        {/* File Dropzone: Compact when file selected, normal when empty */}
        {!uploadResult && (
          <div>
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

            {!selectedFile ? (
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-blue-500 bg-blue-50/50'
                    : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50/60'
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-2">
                  <UploadCloud size={22} />
                </div>
                <p className="text-xs font-bold text-slate-800">
                  Kéo thả hoặc bấm để chọn tệp chứng từ PO (.PDF, .PNG, .JPG)
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Gemini AI sẽ tự động đọc mã đơn hàng, đối tác và bóc tách bảng sản phẩm
                </p>
              </div>
            ) : (
              /* Slim file badge bar when file is selected */
              <div className="p-2.5 px-3 bg-blue-50/70 border border-blue-200 rounded-xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    {selectedFile.type.startsWith('image/') ? <ImageIcon size={16} /> : <FileText size={16} />}
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-xs font-bold text-slate-900 truncate" title={selectedFile.name}>
                      {selectedFile.name}
                    </p>
                    <span className="text-[10px] text-slate-500">
                      {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Sẵn sàng tải lên Drive
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => runOcrOnSelectedFile(selectedFile)}
                    disabled={isOcrProcessing}
                    className="p-1 px-2 text-[11px] font-semibold text-blue-700 bg-white hover:bg-blue-100/70 border border-blue-200 rounded-md transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw size={11} className={isOcrProcessing ? 'animate-spin' : ''} />
                    <span>Quét lại</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null);
                      setImagePreviewUrl(null);
                      setItems([]);
                    }}
                    className="text-xs text-slate-400 hover:text-rose-600 font-semibold p-1 cursor-pointer"
                    title="Chọn tệp khác"
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* OCR Processing Indicator */}
        {isOcrProcessing && (
          <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center gap-2.5 animate-pulse">
            <Loader2 size={18} className="text-indigo-600 animate-spin shrink-0" />
            <div>
              <p className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                <Sparkles size={13} className="text-indigo-600" />
                AI đang bóc tách và tự động đối soát Bảng Giá 2026...
              </p>
              <p className="text-[10.5px] text-indigo-700 mt-0.5">
                Đang chuẩn hóa mã SKU, đơn vị tính và số lượng từ văn bản.
              </p>
            </div>
          </div>
        )}

        {/* Uploading progress indicator */}
        {isUploading && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-2.5">
            <Loader2 size={18} className="text-blue-600 animate-spin shrink-0" />
            <div>
              <p className="text-xs font-bold text-blue-900">{uploadProgress}</p>
              <p className="text-[10.5px] text-blue-600">Hệ thống đang đồng bộ với Google Drive...</p>
            </div>
          </div>
        )}

        {/* STREAMLINED REVIEW & APPROVAL CARD */}
        {(selectedFile || items.length > 0) && !uploadResult && (
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden space-y-3">
            {/* 1. Header Information Bar (Compact 3-column) */}
            <div className="p-3 bg-slate-50 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1 mb-1">
                  <Hash size={11} className="text-blue-600" /> Số Đơn Hàng (PO)
                </label>
                <input
                  type="text"
                  value={docNumber}
                  onChange={(e) => setDocNumber(e.target.value)}
                  placeholder="Nhập số PO..."
                  className="w-full text-xs font-bold font-mono px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1 mb-1">
                  <Building2 size={11} className="text-indigo-600" /> Khách Hàng
                </label>
                <input
                  type="text"
                  value={docCustomer}
                  onChange={(e) => setDocCustomer(e.target.value)}
                  placeholder="Khách hàng..."
                  className="w-full text-xs font-bold px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1 mb-1">
                  <Calendar size={11} className="text-emerald-600" /> Ngày Đặt Hàng
                </label>
                <input
                  type="date"
                  value={docDate}
                  onChange={(e) => setDocDate(e.target.value)}
                  className="w-full text-xs font-semibold px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* 2. Streamlined Product Table */}
            <div className="px-3">
              <div className="flex items-center justify-between pb-2">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Package size={13} className="text-blue-600" />
                  Danh mục sản phẩm ({items.length} mặt hàng)
                </span>
                <button
                  type="button"
                  onClick={addNewItem}
                  className="px-2 py-0.5 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-bold border border-blue-200 transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Plus size={12} /> Thêm dòng
                </button>
              </div>

              <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 font-semibold sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-2.5 w-[42%]">Sản phẩm (Khớp Bảng Giá 2026)</th>
                      <th className="py-2 px-1.5 text-center w-16">ĐVT</th>
                      <th className="py-2 px-2 text-right w-20">Số lượng</th>
                      <th className="py-2 px-2 text-right w-24">Đơn giá</th>
                      <th className="py-2 px-2.5 text-right w-28">Thành tiền</th>
                      <th className="py-2 px-1 text-center w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-slate-400 text-xs italic">
                          Chưa có sản phẩm nào. Bấm "Thêm dòng" hoặc tải tệp để AI tự động trích xuất.
                        </td>
                      </tr>
                    ) : (
                      items.map((row, idx) => (
                        <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                          {/* Product name & SKU */}
                          <td className="py-1.5 px-2">
                            <input
                              type="text"
                              value={row.name}
                              placeholder="Tên sản phẩm..."
                              onChange={(e) => updateItem(idx, 'name', e.target.value)}
                              className="w-full px-2 py-1 bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-500 rounded text-xs font-medium text-slate-900 outline-none"
                            />
                            <div className="flex items-center gap-1.5 mt-0.5 text-[10px]">
                              {row.code && (
                                <span className="font-mono text-slate-500">SKU: {row.code}</span>
                              )}
                              {row.isMatched2026 && (
                                <span className="text-emerald-700 font-bold bg-emerald-50 px-1 rounded border border-emerald-200">
                                  ✓ Giá 2026
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Unit */}
                          <td className="py-1.5 px-1 text-center">
                            <input
                              type="text"
                              value={row.unit}
                              onChange={(e) => updateItem(idx, 'unit', e.target.value)}
                              className="w-full text-center px-1 py-1 bg-slate-50 focus:bg-white border border-slate-200 rounded text-xs font-medium text-slate-700 outline-none"
                            />
                          </td>

                          {/* Quantity */}
                          <td className="py-1.5 px-1.5 text-right">
                            <input
                              type="number"
                              min="1"
                              value={row.quantity}
                              onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                              className="w-full text-right px-1.5 py-1 bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-500 rounded text-xs font-bold font-mono text-slate-900 outline-none"
                            />
                          </td>

                          {/* Price */}
                          <td className="py-1.5 px-1.5 text-right">
                            <input
                              type="number"
                              min="0"
                              value={row.price}
                              onChange={(e) => updateItem(idx, 'price', e.target.value)}
                              className="w-full text-right px-1.5 py-1 bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-500 rounded text-xs font-bold font-mono text-slate-900 outline-none"
                            />
                          </td>

                          {/* Amount */}
                          <td className="py-1.5 px-2 text-right">
                            <span className="text-xs font-bold font-mono text-emerald-700 block truncate">
                              {formatVND(row.amount || (row.quantity * row.price))}
                            </span>
                          </td>

                          {/* Remove */}
                          <td className="py-1.5 px-1 text-center">
                            <button
                              type="button"
                              onClick={() => removeItem(idx)}
                              className="p-1 text-slate-300 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Xóa dòng"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* 3. Summary row */}
              {items.length > 0 && (
                <div className="py-2.5 px-3 mt-2 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between text-xs font-medium">
                  <span className="text-slate-600">
                    Tổng sản phẩm: <strong className="text-slate-900">{items.length}</strong> • Tổng sản lượng: <strong className="text-slate-900">{totalQuantity.toLocaleString('vi-VN')}</strong>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500">Tổng doanh thu PO:</span>
                    <strong className="text-sm font-black text-emerald-700 font-mono">
                      {formatVND(totalAmount)}
                    </strong>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
