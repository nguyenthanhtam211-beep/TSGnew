import React, { useState, useRef, useEffect } from 'react';
import { 
  X, UploadCloud, FileText, Image as ImageIcon, ExternalLink, 
  Share2, Copy, CheckCircle2, Loader2, RefreshCw, Download, 
  Eye, AlertCircle, Sparkles, Check, FileCheck, FolderOpen,
  Layers, Package, CheckSquare, Edit3, Plus, Trash2, Calendar,
  Building2, Hash, Tag, ArrowRight, Truck, ShieldCheck, AlertTriangle,
  UserCheck, Camera
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { uploadFileDirectToGoogleDrive } from '../lib/driveSync';
import { processDeliveryOrderOCR } from '../lib/gemini';
import { generateSmartDocumentFileName } from '../lib/documentNaming';
import { matchPODItemsWithPOLines, parseNumber, parseDateToISO, formatVND } from '../lib/business-logic';
import { Modal, Button } from './ui';
import { PODItemRow, PODOCRResult } from '../types';

interface DeliveryFileUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  allPOHeaders?: any[];
  allPOLines?: any[];
  allDeliveryPlans?: any[];
  defaultPONumber?: string;
  defaultPlanId?: string;
  onSaveDeliveryBatch: (deliveryData: {
    pxkNumber: string;
    bbbgNumber?: string;
    poNumber: string;
    customer: string;
    deliveryDate: string;
    carrier: string;
    receiverSigner: string;
    licensePlate?: string;
    hasReceiverSignature: boolean;
    hasBuyerStamp: boolean;
    handwrittenNotes?: string;
    driveFileUrl?: string;
    driveFileId?: string;
    items: {
      poLineStt: string;
      productName: string;
      productCode?: string;
      unit: string;
      dispatchedQty: number;
      receivedQty: number;
      notes?: string;
    }[];
  }) => Promise<void> | void;
}

export function DeliveryFileUploadModal({
  isOpen,
  onClose,
  allPOHeaders = [],
  allPOLines = [],
  allDeliveryPlans = [],
  defaultPONumber,
  defaultPlanId,
  onSaveDeliveryBatch
}: DeliveryFileUploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // OCR Processing state
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);

  // Delivery Document Header Info
  const [docNumber, setDocNumber] = useState<string>(''); // Số PXK / BBGH
  const [docReference, setDocReference] = useState<string>(defaultPONumber || ''); // Mã PO
  const [docCustomer, setDocCustomer] = useState<string>('');
  const [docDate, setDocDate] = useState<string>('');
  const [receiverName, setReceiverName] = useState<string>('');
  const [carrierName, setCarrierName] = useState<string>('');
  const [licensePlate, setLicensePlate] = useState<string>('');
  const [hasReceiverSignature, setHasReceiverSignature] = useState<boolean>(true);
  const [hasBuyerStamp, setHasBuyerStamp] = useState<boolean>(false);
  const [handwrittenNotes, setHandwrittenNotes] = useState<string>('');

  // Items table
  const [items, setItems] = useState<PODItemRow[]>([]);

  // Drive upload result
  const [uploadResult, setUploadResult] = useState<{
    fileName: string;
    driveLink: string;
    driveFileId?: string;
    downloadLink?: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Filter PO lines for currently selected PO
  const currentPOLines = React.useMemo(() => {
    if (!docReference) return allPOLines.filter(l => !l.isDeleted);
    const cleanRef = docReference.trim().toLowerCase();
    return allPOLines.filter(l => {
      if (l.isDeleted) return false;
      const pNum = String(l["Số đơn hàng"] || l["Đơn hàng"] || "").trim().toLowerCase();
      return pNum === cleanRef || pNum.includes(cleanRef) || cleanRef.includes(pNum);
    });
  }, [allPOLines, docReference]);

  // Update customer when PO changes
  useEffect(() => {
    if (docReference && !docCustomer) {
      const matchedHeader = allPOHeaders.find(h => {
        const pNum = String(h["Số đơn hàng"] || h["Đơn hàng"] || h.poNumber || "").trim().toLowerCase();
        return pNum === docReference.trim().toLowerCase();
      });
      if (matchedHeader) {
        setDocCustomer(matchedHeader["Khách hàng"] || matchedHeader.customer || "");
      }
    }
  }, [docReference, allPOHeaders, docCustomer]);

  // Handle file selection
  const handleFileChange = (file: File) => {
    setSelectedFile(file);
    setUploadResult(null);

    // Create preview for image
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreviewUrl(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setImagePreviewUrl(null);
    }

    // Auto trigger OCR extraction
    runOCRExtraction(file);
  };

  // OCR Extraction function
  const runOCRExtraction = async (file: File) => {
    setIsOcrProcessing(true);
    const toastId = toast.loading('🔍 Đang phân tích Biên bản giao hàng & kiểm chứng chữ ký, dấu mộc...');

    try {
      const ocrRes: PODOCRResult = await processDeliveryOrderOCR(file);

      // 1. Số PXK / BBGH
      if (ocrRes.documentNumber) {
        setDocNumber(ocrRes.documentNumber);
      } else {
        setDocNumber(`PXK-${new Date().getFullYear().toString().slice(-2)}${Math.floor(1000 + Math.random() * 9000)}`);
      }

      // 2. PO Reference
      if (ocrRes.documentReference) {
        setDocReference(ocrRes.documentReference);
      }

      // 3. Khách hàng
      if (ocrRes.buyerName) {
        setDocCustomer(ocrRes.buyerName);
      }

      // 4. Ngày giao
      if (ocrRes.deliveryDate || ocrRes.documentDate) {
        setDocDate(parseDateToISO(ocrRes.deliveryDate || ocrRes.documentDate));
      } else {
        setDocDate(new Date().toISOString().split('T')[0]);
      }

      // 5. Tính pháp lý POD
      setReceiverName(ocrRes.receiverName || '');
      setHasReceiverSignature(ocrRes.hasReceiverSignature ?? true);
      setHasBuyerStamp(ocrRes.hasBuyerStamp ?? false);
      setCarrierName(ocrRes.carrierName || '');
      setLicensePlate(ocrRes.licensePlate || '');
      setHandwrittenNotes(ocrRes.handwrittenNotes || '');

      // 6. Bảng kê sản phẩm & Tự động khớp dòng PO
      if (ocrRes.items && Array.isArray(ocrRes.items) && ocrRes.items.length > 0) {
        const matched = matchPODItemsWithPOLines(ocrRes.items, currentPOLines);
        setItems(matched);
        toast.success(`✨ Đã nhận diện ${matched.length} sản phẩm và đối soát chữ ký/mộc đỏ thành công!`, { id: toastId });
      } else {
        toast.success('Đã hoàn tất bóc tách thông tin biên bản giao hàng.', { id: toastId });
      }
    } catch (err: any) {
      console.warn('Lỗi OCR Biên bản giao hàng:', err);
      toast.error('Không thể tự động bóc tách toàn bộ biên bản. Bạn có thể kiểm tra và nhập nhanh bên dưới.', { id: toastId });
    } finally {
      setIsOcrProcessing(false);
    }
  };

  // Re-match when PO Reference changes
  const handlePOReferenceChange = (newRef: string) => {
    setDocReference(newRef);
    const cleanRef = newRef.trim().toLowerCase();
    const poLinesForRef = allPOLines.filter(l => {
      if (l.isDeleted) return false;
      const pNum = String(l["Số đơn hàng"] || l["Đơn hàng"] || "").trim().toLowerCase();
      return pNum === cleanRef || pNum.includes(cleanRef) || cleanRef.includes(pNum);
    });

    if (items.length > 0) {
      const reMatched = matchPODItemsWithPOLines(items, poLinesForRef);
      setItems(reMatched);
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

  const updateItem = (index: number, field: keyof PODItemRow, val: any) => {
    const next = [...items];
    const row = { ...next[index], [field]: val };

    if (field === 'dispatchedQty' || field === 'receivedQty') {
      const d = Number(row.dispatchedQty || 0);
      const r = Number(row.receivedQty || 0);
      row.discrepancyQty = d - r;
    }

    if (field === 'matchedPoLineStt') {
      const targetLine = currentPOLines.find(l => String(l["STT"] || l.id) === String(val));
      if (targetLine) {
        row.matchedPoLine = targetLine;
        row.matchedPoLineName = targetLine["Tên sản phẩm"] || targetLine["Sản phẩm"];
        row.matchConfidence = 100;
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
        name: '',
        unit: 'Cái',
        dispatchedQty: 1,
        receivedQty: 1,
        discrepancyQty: 0
      }
    ]);
  };

  // Upload to Drive & Save Deliveries
  const handleUploadAndSave = async () => {
    if (!docNumber.trim()) {
      toast.error('Vui lòng nhập Số Phiếu xuất kho / BBGH!');
      return;
    }

    if (!docReference.trim()) {
      toast.error('Vui lòng chọn hoặc nhập Mã đơn hàng PO liên kết!');
      return;
    }

    if (items.length === 0) {
      toast.error('Biên bản phải có ít nhất 1 sản phẩm giao nhận!');
      return;
    }

    setIsUploading(true);
    setUploadProgress('Đang tải file scan lên Google Drive và tạo phiếu xuất kho...');

    try {
      let driveUrl = '';
      let driveId = '';

      if (selectedFile) {
        // Tên file chuẩn hóa theo quy chuẩn TSG ERP: PXK_[Số]_[Ngày]_[Khách]_[PO].ext
        const standardizedName = generateSmartDocumentFileName({
          documentType: 'PXK',
          documentNumber: docNumber.trim(),
          documentDate: docDate,
          documentReference: docReference.trim(),
          buyerName: docCustomer.trim() || 'KhachHang',
          originalFileName: selectedFile.name
        });

        const uploadRes = await uploadFileDirectToGoogleDrive({
          file: selectedFile,
          fileName: standardizedName,
          documentType: 'Phieu_Xuat_Kho_Giao_Hang_PXK'
        });

        if (uploadRes && uploadRes.driveFileId) {
          driveUrl = uploadRes.driveLink || uploadRes.downloadLink || '';
          driveId = uploadRes.driveFileId || '';
          setUploadResult({
            fileName: uploadRes.fileName || standardizedName,
            driveLink: uploadRes.driveLink || '',
            driveFileId: uploadRes.driveFileId,
            downloadLink: uploadRes.downloadLink
          });
        }
      }

      // Chuẩn hóa danh sách sản phẩm để lưu
      const deliveryItems = items.map((it, idx) => {
        // Tìm STT dòng PO
        let poLineStt = it.matchedPoLineStt;
        if (!poLineStt && currentPOLines[idx]) {
          poLineStt = String(currentPOLines[idx]["STT"] || currentPOLines[idx].id);
        }

        return {
          poLineStt: poLineStt || `LINE-${idx + 1}`,
          productName: it.name || (it.matchedPoLine ? it.matchedPoLine["Tên sản phẩm"] : `Sản phẩm ${idx + 1}`),
          productCode: it.code || '',
          unit: it.unit || 'Cái',
          dispatchedQty: Number(it.dispatchedQty || 0),
          receivedQty: Number(it.receivedQty !== undefined ? it.receivedQty : it.dispatchedQty),
          notes: it.notes || ''
        };
      });

      // Lưu đợt giao hàng
      await onSaveDeliveryBatch({
        pxkNumber: docNumber.trim(),
        bbbgNumber: `BBBG-${docNumber.trim()}`,
        poNumber: docReference.trim(),
        customer: docCustomer.trim(),
        deliveryDate: docDate,
        carrier: carrierName.trim() || 'Đội xe TSG Logistics',
        receiverSigner: receiverName.trim() || 'Thủ kho khách hàng',
        licensePlate: licensePlate.trim(),
        hasReceiverSignature,
        hasBuyerStamp,
        handwrittenNotes,
        driveFileUrl: driveUrl,
        driveFileId: driveId,
        items: deliveryItems
      });

      toast.success(`🎉 Đã xuất thành công ${deliveryItems.length} mặt hàng qua PXK ${docNumber.trim()}!`);
      onClose();
    } catch (err: any) {
      console.error('Lỗi lưu giao hàng:', err);
      toast.error(`Lỗi: ${err.message || 'Không thể lưu bản ghi giao hàng'}`);
    } finally {
      setIsUploading(false);
      setUploadProgress('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* MODAL HEADER */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-emerald-900 via-slate-900 to-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300">
              <Truck size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  Quét OCR & Xác Nhận Biên Bản Giao Hàng (BBGH / PXK)
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1">
                  <Sparkles size={11} /> Gemini 2.5 POD Engine
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Tự động bóc tách bảng kê đa sản phẩm, kiểm chứng chữ ký sống & con dấu mộc đỏ pháp lý
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-white/10 transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* 1. UPLOAD & CAMERA CAPTURE ZONE */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div 
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`md:col-span-2 border-2 border-dashed rounded-xl p-5 text-center transition-all cursor-pointer flex flex-col items-center justify-center min-h-[160px] ${
                isDragging 
                  ? 'border-emerald-500 bg-emerald-50/50 scale-[0.99]' 
                  : selectedFile 
                    ? 'border-emerald-300 bg-emerald-50/20' 
                    : 'border-slate-300 hover:border-emerald-400 bg-slate-50/50 hover:bg-emerald-50/10'
              }`}
              onClick={() => fileInputRef.current?.click()}
            >
              <input 
                ref={fileInputRef}
                type="file"
                accept="application/pdf,image/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileChange(e.target.files[0]);
                  }
                }}
              />
              <input 
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileChange(e.target.files[0]);
                  }
                }}
              />

              {isOcrProcessing ? (
                <div className="space-y-3 py-2">
                  <Loader2 size={36} className="animate-spin text-emerald-600 mx-auto" />
                  <div>
                    <p className="text-xs font-bold text-slate-700">Gemini AI đang phân tích Biên bản giao hàng...</p>
                    <p className="text-[11px] text-slate-500 mt-1">Đang bóc tách chữ ký, dấu mộc, biển số xe & bảng kê hàng hóa</p>
                  </div>
                </div>
              ) : selectedFile ? (
                <div className="space-y-2 py-1">
                  <div className="flex items-center justify-center gap-2 text-emerald-700">
                    <FileCheck size={28} />
                    <span className="text-xs font-bold max-w-md truncate">{selectedFile.name}</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB • Nhấp để chọn tệp khác hoặc thả file mới
                  </p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      runOCRExtraction(selectedFile);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 shadow-xs transition"
                  >
                    <RefreshCw size={13} /> Quét lại OCR bằng AI
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                    <UploadCloud size={24} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-700">
                      Kéo thả bản scan BBGH / Phiếu xuất kho vào đây
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Hỗ trợ tệp PDF hoặc ảnh chụp (JPG, PNG). Tự động nhận diện chữ ký & con dấu đỏ
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Mobile Camera Capture & Preview */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-2">
                  Chụp nhanh từ di động
                </span>
                <p className="text-xs text-slate-500 mb-3 leading-relaxed">
                  Lái xe hoặc thủ kho có thể chụp trực tiếp giấy giao nhận có chữ ký tươi tại công trường:
                </p>
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-3 bg-white border border-slate-300 hover:border-emerald-500 text-slate-700 hover:text-emerald-700 font-bold text-xs rounded-xl shadow-2xs transition"
                >
                  <Camera size={16} className="text-emerald-600" />
                  Mở Camera chụp ngay
                </button>
              </div>

              {imagePreviewUrl && (
                <div className="mt-3 pt-3 border-t border-slate-200">
                  <p className="text-[10px] font-semibold text-slate-500 mb-1">Ảnh xem trước:</p>
                  <div className="h-16 rounded-lg overflow-hidden border border-slate-200 bg-white">
                    <img src={imagePreviewUrl} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 2. COMPLIANCE & LEGAL BADGES (PROOF OF DELIVERY STATUS) */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <ShieldCheck size={16} className="text-emerald-600" />
                Kiểm chứng tính pháp lý chứng từ (Proof of Delivery - POD)
              </span>
              <span className="text-[11px] text-slate-500 italic">
                *Cần có chữ ký nhận & con dấu để đủ điều kiện quyết toán
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Receiver signature */}
              <label className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                hasReceiverSignature 
                  ? 'bg-emerald-50/80 border-emerald-300 text-emerald-900' 
                  : 'bg-rose-50 border-rose-300 text-rose-900'
              }`}>
                <div className="flex items-center gap-2.5">
                  <input 
                    type="checkbox" 
                    checked={hasReceiverSignature}
                    onChange={(e) => setHasReceiverSignature(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                  />
                  <div>
                    <p className="text-xs font-bold">Chữ ký người nhận hàng</p>
                    <p className="text-[10px] opacity-75">
                      {hasReceiverSignature ? '✓ Đã có chữ ký sống' : '✗ Thiếu chữ ký người nhận'}
                    </p>
                  </div>
                </div>
                {hasReceiverSignature ? (
                  <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle size={18} className="text-rose-600 shrink-0" />
                )}
              </label>

              {/* Red Stamp */}
              <label className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                hasBuyerStamp 
                  ? 'bg-rose-50 border-rose-400 text-rose-900' 
                  : 'bg-amber-50/60 border-amber-300 text-amber-900'
              }`}>
                <div className="flex items-center gap-2.5">
                  <input 
                    type="checkbox" 
                    checked={hasBuyerStamp}
                    onChange={(e) => setHasBuyerStamp(e.target.checked)}
                    className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-slate-300"
                  />
                  <div>
                    <p className="text-xs font-bold">Dấu mộc đỏ bên mua</p>
                    <p className="text-[10px] opacity-75">
                      {hasBuyerStamp ? '✓ Đã đóng dấu mộc công ty' : '⚠ Chưa có mộc tròn công ty'}
                    </p>
                  </div>
                </div>
                {hasBuyerStamp ? (
                  <CheckCircle2 size={18} className="text-rose-600 shrink-0" />
                ) : (
                  <AlertTriangle size={18} className="text-amber-600 shrink-0" />
                )}
              </label>

              {/* Vehicle / License Plate */}
              <div className="p-3 rounded-xl border border-slate-200 bg-white flex items-center gap-2.5">
                <Truck size={18} className="text-slate-500 shrink-0" />
                <div className="flex-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase block">Biển số xe / Lái xe</label>
                  <input 
                    type="text"
                    placeholder="VD: 29C-123.45 / Anh Tuấn"
                    value={licensePlate}
                    onChange={(e) => setLicensePlate(e.target.value)}
                    className="w-full text-xs font-semibold text-slate-800 outline-none bg-transparent placeholder-slate-400"
                  />
                </div>
              </div>
            </div>

            {/* Handwritten exception note if detected */}
            {handwrittenNotes && (
              <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
                <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-bold">Bút phê / Ghi chú viết tay phát hiện:</strong>{' '}
                  <span className="italic">{handwrittenNotes}</span>
                </div>
              </div>
            )}
          </div>

          {/* 3. DOCUMENT METADATA FIELDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Số Phiếu Xuất Kho (PXK) *
              </label>
              <input 
                type="text"
                placeholder="VD: PXK-26/012"
                value={docNumber}
                onChange={(e) => setDocNumber(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-emerald-500 font-mono font-bold text-emerald-700"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Căn cứ theo Đơn hàng PO *
              </label>
              <div className="relative">
                <input 
                  type="text"
                  placeholder="Gõ hoặc chọn mã PO..."
                  value={docReference}
                  onChange={(e) => handlePOReferenceChange(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-emerald-500 font-semibold text-blue-700"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Khách hàng nhận
              </label>
              <input 
                type="text"
                placeholder="Tên khách hàng"
                value={docCustomer}
                onChange={(e) => setDocCustomer(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Ngày thực giao
              </label>
              <input 
                type="date"
                value={docDate}
                onChange={(e) => setDocDate(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Người nhận / Thủ kho ký nhận
              </label>
              <input 
                type="text"
                placeholder="Họ tên thủ kho bên nhận..."
                value={receiverName}
                onChange={(e) => setReceiverName(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Đơn vị vận tải / Tài xế
              </label>
              <input 
                type="text"
                placeholder="Đội xe TSG / Nhà xe giao..."
                value={carrierName}
                onChange={(e) => setCarrierName(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* 4. MULTI-ITEM GRID TABLE */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package size={16} className="text-emerald-600" />
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  Bảng kê hàng hóa bàn giao ({items.length} mặt hàng)
                </h3>
              </div>
              <button 
                type="button"
                onClick={addNewItem}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition"
              >
                <Plus size={13} /> Thêm dòng
              </button>
            </div>

            <div className="overflow-x-auto max-h-72">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100/80 border-b border-slate-200 text-[10px] uppercase text-slate-600 font-bold">
                    <th className="px-3 py-2 w-12 text-center">STT</th>
                    <th className="px-3 py-2 min-w-[200px]">Tên sản phẩm</th>
                    <th className="px-3 py-2 w-20">ĐVT</th>
                    <th className="px-3 py-2 w-28 text-right">SL Lệnh xuất</th>
                    <th className="px-3 py-2 w-28 text-right">SL Thực nhận</th>
                    <th className="px-3 py-2 w-24 text-center">Chênh lệch</th>
                    <th className="px-3 py-2 min-w-[180px]">Khớp dòng PO</th>
                    <th className="px-3 py-2 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-slate-400 italic">
                        Chưa có sản phẩm nào. Hãy tải file scan BBGH hoặc bấm "Thêm dòng" để khai báo.
                      </td>
                    </tr>
                  ) : (
                    items.map((row, idx) => {
                      const diff = (Number(row.dispatchedQty || 0)) - (Number(row.receivedQty || 0));
                      return (
                        <tr key={idx} className="hover:bg-slate-50/80">
                          <td className="px-3 py-2 text-center text-slate-400 font-mono text-[11px]">
                            {idx + 1}
                          </td>
                          <td className="px-3 py-2">
                            <input 
                              type="text"
                              value={row.name}
                              onChange={(e) => updateItem(idx, 'name', e.target.value)}
                              className="w-full text-xs border border-transparent hover:border-slate-300 focus:border-emerald-500 rounded p-1 font-medium text-slate-800"
                            />
                            {row.code && (
                              <span className="text-[10px] text-slate-400 font-mono block">Mã: {row.code}</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <input 
                              type="text"
                              value={row.unit}
                              onChange={(e) => updateItem(idx, 'unit', e.target.value)}
                              className="w-16 text-xs border border-transparent hover:border-slate-300 focus:border-emerald-500 rounded p-1 text-center"
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <input 
                              type="number"
                              value={row.dispatchedQty}
                              onChange={(e) => updateItem(idx, 'dispatchedQty', parseNumber(e.target.value))}
                              className="w-24 text-right text-xs font-semibold border border-transparent hover:border-slate-300 focus:border-emerald-500 rounded p-1"
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <input 
                              type="number"
                              value={row.receivedQty}
                              onChange={(e) => updateItem(idx, 'receivedQty', parseNumber(e.target.value))}
                              className="w-24 text-right text-xs font-bold text-emerald-700 border border-emerald-200 focus:border-emerald-500 rounded p-1 bg-emerald-50/30"
                            />
                          </td>
                          <td className="px-3 py-2 text-center">
                            {diff === 0 ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                Đủ 100%
                              </span>
                            ) : diff > 0 ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                                Thiếu {diff.toLocaleString('vi-VN')}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">
                                Thừa {Math.abs(diff).toLocaleString('vi-VN')}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <select
                              value={row.matchedPoLineStt || ''}
                              onChange={(e) => updateItem(idx, 'matchedPoLineStt', e.target.value)}
                              className="w-full text-[11px] border border-slate-200 rounded p-1 outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
                            >
                              <option value="">-- Chọn dòng PO --</option>
                              {currentPOLines.map((line, lIdx) => (
                                <option key={lIdx} value={line["STT"] || line.id}>
                                  Dòng {line["STT"] || lIdx + 1}: {line["Tên sản phẩm"] || line["Sản phẩm"]} (Đặt: {parseNumber(line["Số lượng"]).toLocaleString('vi-VN')})
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => removeItem(idx)}
                              className="text-slate-300 hover:text-rose-600 transition p-1"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* MODAL FOOTER */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <FolderOpen size={15} className="text-emerald-600" />
            <span>Tệp scan sẽ được tự động lưu vào Google Drive: <strong>04_Phieu_Xuat_Kho_Giao_Hang_PXK</strong></span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isUploading}
              className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              onClick={handleUploadAndSave}
              disabled={isUploading}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition disabled:opacity-50"
            >
              {isUploading ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  {uploadProgress || 'Đang xử lý...'}
                </>
              ) : (
                <>
                  <Check size={16} />
                  Xác Nhận Xuất Kho & Lưu BBGH
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
