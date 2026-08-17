import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import clsx from 'clsx';
import { 
  Upload, FileText, CheckCircle, AlertCircle, Loader2, Edit3, 
  Trash2, Plus, Sparkles, Save, ArrowRight, Eye, RefreshCw,
  Search, Info, HelpCircle
} from 'lucide-react';
import { findPriceRecord, parseNumber } from '../lib/business-logic';
import { ProductHoverCard } from './ProductHoverCard';
import { processDocumentOCR } from '../lib/gemini';
import MacTrafficLights from './MacTrafficLights';

interface OCRItem {
  index: number;
  code: string;
  name: string;
  specs: string;
  unit: string;
  quantity: number;
  price: number;
  amount: number;
  notes: string;
}

interface OCRData {
  documentType: string;
  documentTypeName: string;
  documentNumber: string;
  documentReference?: string; // New field for PO number in PXK
  documentDate: string;
  deliveryDate: string;
  buyerName: string;
  buyerAddress: string;
  sellerName: string;
  sellerAddress: string;
  items: OCRItem[];
  signers?: {
    creator?: string;
    approver?: string;
  };
}

interface OCRViewProps {
  onAddPOHeader: (row: any) => Promise<void>;
  onAddPOLines: (rows: any[]) => Promise<void>;
  onAddDelivery: (rows: any[]) => Promise<void>;
  onUploadToDrive?: (file: File, metadata: any) => Promise<void>;
  poHeaders: any[];
  pricingData: any[];
}

export default function OCRView({ 
  onAddPOHeader, 
  onAddPOLines, 
  onAddDelivery, 
  onUploadToDrive,
  poHeaders,
  pricingData
}: OCRViewProps) {
  const [file, setFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [ocrResult, setOcrResult] = useState<OCRData | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Drag and drop states
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = async (selectedFile: File) => {
    setFile(selectedFile);
    setIsSaved(false);
    setErrorMessage("");

    // Create a local object URL for preview if it's an image
    if (selectedFile.type.startsWith("image/")) {
      const url = URL.createObjectURL(selectedFile);
      setImagePreviewUrl(url);
    } else {
      setImagePreviewUrl(null);
    }

    setStatus("uploading");

    try {
      // Process OCR using Dual-Engine (Direct Gemini REST + Serverless API)
      const rawData = await processDocumentOCR(selectedFile);
      
      let data: OCRData = {
        documentType: rawData.documentType || 'Unknown',
        documentTypeName: rawData.documentTypeName || 'Chứng từ',
        documentNumber: rawData.documentNumber || '',
        documentReference: rawData.documentReference || '',
        documentDate: rawData.documentDate || '',
        deliveryDate: rawData.deliveryDate || '',
        buyerName: rawData.buyerName || '',
        buyerAddress: rawData.buyerAddress || '',
        sellerName: rawData.sellerName || '',
        sellerAddress: rawData.sellerAddress || '',
        items: Array.isArray(rawData.items) ? rawData.items.map((it: any, idx: number) => ({
          index: it.index || idx + 1,
          code: it.code || '',
          name: it.name || '',
          specs: it.specs || '',
          unit: it.unit || 'Cái',
          quantity: Number(it.quantity) || 0,
          price: Number(it.price) || 0,
          amount: Number(it.amount) || ((Number(it.quantity) || 0) * (Number(it.price) || 0)),
          notes: it.notes || ''
        })) : []
      };

      // Enrich with internal pricing data immediately
      const matchedCust = getMatchedCustomerID(data.buyerName);
      data.items = data.items.map(item => {
        // Robust matching: Try code first, then name
        const priceRecord = findPriceRecord(pricingData, { 
          sku: item.code || item.name, 
          customer: matchedCust 
        });
        
        if (priceRecord) {
          const sellPrice = parseNumber(priceRecord['Giá bán']);
          const buyPrice = parseNumber(priceRecord['Giá nhập']) || parseNumber(priceRecord['Đơn giá mua']);
          return {
            ...item,
            code: priceRecord['Mã sản phẩm'] || item.code,
            name: priceRecord['Tên sản phẩm'] || item.name, // Normalize name from DB
            price: sellPrice || item.price,
            amount: (sellPrice || item.price) * item.quantity,
            notes: `Gsp_Matched: ${priceRecord['Mã giá']} | Margin: ${sellPrice > 0 ? (((sellPrice - buyPrice)/sellPrice)*100).toFixed(1) : 0}%`
          };
        }
        return item;
      });
      
      setOcrResult(data);
      setStatus("success");
      toast.success("Trích xuất OCR thành công!", { icon: "✨" });
      
    } catch (err: any) {
      console.error("OCR Processing error:", err);
      let msg = err?.message || "Không thể xử lý trích xuất văn bản từ chứng từ.";
      setErrorMessage(msg);
      setStatus("error");
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  // Editing handlers for OCR details
  const handleMetaChange = (field: keyof OCRData, value: string) => {
    if (!ocrResult) return;
    setOcrResult({
      ...ocrResult,
      [field]: value
    });
    setIsSaved(false);
  };

  const handleItemChange = (index: number, field: keyof OCRItem, value: any) => {
    if (!ocrResult) return;
    const updatedItems = ocrResult.items.map((item, i) => {
      if (i === index) {
        const updatedItem = { ...item, [field]: value };
        // Recalculate amount if quantity or price changes
        if (field === 'quantity' || field === 'price') {
          const qty = field === 'quantity' ? Number(value) : item.quantity;
          const prc = field === 'price' ? Number(value) : item.price;
          updatedItem.amount = qty * prc;
        }
        return updatedItem;
      }
      return item;
    });

    setOcrResult({
      ...ocrResult,
      items: updatedItems
    });
    setIsSaved(false);
  };

  const handleAddItem = () => {
    if (!ocrResult) return;
    const newItem: OCRItem = {
      index: ocrResult.items.length + 1,
      code: "",
      name: "",
      specs: "",
      unit: "",
      quantity: 0,
      price: 0,
      amount: 0,
      notes: ""
    };
    setOcrResult({
      ...ocrResult,
      items: [...ocrResult.items, newItem]
    });
    setIsSaved(false);
  };

  const handleRemoveItem = (index: number) => {
    if (!ocrResult) return;
    
    if (!window.confirm("Bạn có chắc chắn muốn xóa dòng hàng này?")) {
      return;
    }
    
    setOcrResult({
      ...ocrResult,
      items: ocrResult.items.filter((_, i) => i !== index)
    });
    setIsSaved(false);
  };

  // Match buyer name to pre-existing standard customer IDs
  const getMatchedCustomerID = (name: string): string => {
    const lower = name.toLowerCase();
    if (lower.includes("thanh hóa") || lower.includes("thanh hoá")) return "Thanh Hoá";
    if (lower.includes("thăng long")) return "Thăng Long";
    if (lower.includes("bắc sơn")) return "Bắc Sơn";
    if (lower.includes("ngân sơn")) return "Ngân Sơn";
    if (lower.includes("sài gòn")) return "Sài Gòn";
    if (lower.includes("bến tre")) return "Bến Tre";
    return name || "Khách hàng mới";
  };

  // Helper to format currency
  const formatMoney = (amount: number) => {
    if (!amount) return "0.00";
    return amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleSaveToSystem = (optionalData?: OCRData | React.MouseEvent) => {
    // If it's a mouse event from onClick, we show the confirmation modal
    const isMouseEvent = optionalData && 'nativeEvent' in optionalData;
    
    if (isMouseEvent) {
      setShowConfirmModal(true);
      return;
    }

    // This part is now called by the confirmation modal's "Confirm" action
    executeSaveToSystem(optionalData as OCRData);
  };

  const executeSaveToSystem = async (optionalData?: OCRData) => {
    const dataToSave = optionalData || ocrResult;
    
    if (!dataToSave || isSaving) return;
    
    const matchedCust = getMatchedCustomerID(dataToSave.buyerName);
    
    setIsSaving(true);
    const toastId = toast.loading('Đang lưu vào hệ thống database...');

    try {
      // 1. Upload file to Google Drive in background (non-blocking)
      if (onUploadToDrive && file) {
        onUploadToDrive(file, {
          documentType: dataToSave.documentType,
          documentNumber: dataToSave.documentNumber,
          fileName: file.name
        }).catch(err => {
          console.warn("Background upload to Drive skipped/failed:", err);
        });
      }

      const docType = (dataToSave.documentType || "").toUpperCase();
      
      if (docType === "PO" || docType === "ĐƠN ĐẶT HÀNG") {
        // 1. Calculate total order value with real pricing lookup
        const linesToInsert = (dataToSave.items || []).map((item, idx) => {
          const lineId = `D_OCR_${Date.now()}_${idx + 1}`;
          
          const priceRecord = findPriceRecord(pricingData, { 
            sku: item.code, 
            name: item.name,
            customer: matchedCust 
          });

          const qty = Number(item.quantity) || 1;
          const sellPrice = Number(item.price) || (priceRecord ? parseNumber(priceRecord['Giá bán']) : 0);
          const buyPrice = priceRecord ? (parseNumber(priceRecord['Giá nhập']) || parseNumber(priceRecord['Đơn giá mua'])) : 0;
          const revenue = sellPrice * qty;
          const profit = (sellPrice - buyPrice) * qty;

          return {
            "STT": lineId,
            "Số đơn hàng": dataToSave.documentNumber || `PO-${Date.now()}`,
            "Mã giá bán": priceRecord ? (priceRecord['Mã giá'] || "Gsp_N/A") : "Gsp_N/A",
            "Tên sản phẩm": item.name || (priceRecord ? priceRecord['Tên sản phẩm'] : "Sản phẩm OCR"),
            "Mã của khách": item.code || (priceRecord ? priceRecord['Mã sản phẩm'] : "") || "",
            "ĐVT": item.unit || (priceRecord ? priceRecord['ĐVT'] : "Cái") || "Cái",
            "Số lượng": qty.toString(),
            "Ngày đặt hàng": dataToSave.documentDate || new Date().toLocaleDateString("vi-VN"),
            "Ngày giao": dataToSave.deliveryDate || dataToSave.documentDate || new Date().toLocaleDateString("vi-VN"),
            "Thời gian xử lý": "5",
            "Khách hàng": matchedCust,
            "Đơn vị nhận hàng": matchedCust,
            "Nhóm hàng": matchedCust === "Thăng Long" ? "Nguyên liệu" : "Thùng carton",
            "Đơn giá nhập": (buyPrice || 0).toLocaleString("en-US"),
            "Thành tiền dòng": (revenue || 0).toLocaleString("en-US"),
            "Hoàn thành": "0",
            "Số lượng khách hàng": "4",
            "Đơn giá bán": (sellPrice || 0).toLocaleString("en-US"),
            "Lợi nhuận": (profit || 0).toLocaleString("en-US"),
            "Lợi nhuận dòng": (profit || 0).toLocaleString("en-US"),
            "Các mục mẹ 2": "",
            "Tiến độ sản phẩm": "0%"
          };
        });

        const totalOrderVal = linesToInsert.reduce((sum, line) => sum + parseNumber(line["Thành tiền dòng"]), 0);

        // Await all database operations
        await onAddPOHeader({
          "Đơn hàng": dataToSave.documentNumber || `PO-${Date.now()}`,
          "Ngày đặt hàng": dataToSave.documentDate || new Date().toLocaleDateString("vi-VN"),
          "Khách hàng": matchedCust,
          "Phân loại": "Đơn hàng thường xuyên",
          "Tệp đơn hàng": file?.name || "document_ocr.pdf",
          "Chi tiết đơn hàng": linesToInsert.map(l => l.STT).join(","),
          "Trạng Thái": "Mới nhận",
          "Tổng giá trị đơn hàng": (totalOrderVal || 0).toLocaleString("en-US")
        });

        await onAddPOLines(linesToInsert);

      } else if (docType === "PXK" || docType === "INVOICE" || docType === "BIÊN BẢN GIAO HÀNG" || docType === "PHIẾU XUẤT KHO") {
        const deliveryRows = (dataToSave.items || []).map((item, idx) => {
          const priceRecord = findPriceRecord(pricingData, { 
            sku: item.code || item.name, 
            customer: matchedCust 
          });

          const qty = Number(item.quantity) || 1;
          const sellPrice = Number(item.price) || (priceRecord ? parseNumber(priceRecord['Giá bán']) : 0);
          const buyPrice = priceRecord ? (parseNumber(priceRecord['Giá nhập']) || parseNumber(priceRecord['Đơn giá mua'])) : 0;
          const revenue = sellPrice * qty;
          const profit = (sellPrice - buyPrice) * qty;
          const margin = sellPrice > 0 ? (profit / revenue) * 100 : 0;

          const poNumber = dataToSave.documentReference || "PO-REF";

          return {
            "STT": `${Date.now()}_${idx + 1}`,
            "Chi tiết đơn hàng": `D_OCR_${Date.now()}_${idx + 1}`,
            "Ngày giao": dataToSave.deliveryDate || dataToSave.documentDate || new Date().toLocaleDateString("vi-VN"),
            "Đơn hàng": poNumber,
            "Mã sản phẩm": priceRecord ? (priceRecord['Mã giá'] || "Gsp_N/A") : (item.code || "Gsp_N/A"),
            "Tên sản phẩm": item.name || (priceRecord ? priceRecord['Tên sản phẩm'] : "Sản phẩm OCR"),
            "ĐVT": item.unit || (priceRecord ? priceRecord['ĐVT'] : "Cái") || "Cái",
            "Số lượng giao": qty.toString(),
            "Số lượng đặt": qty.toString(),
            "Đã giao": qty.toString(),
            "Còn lại": "0",
            "Tiến độ giao": "100%",
            "Status": "Hoàn thành",
            "Số PXK": dataToSave.documentNumber || `PXK-${Date.now()}`,
            "Khách hàng": matchedCust,
            "Sự cố": "",
            "Chi tiết sự cố": "",
            "Nhà cung cấp": priceRecord ? (priceRecord['Tên nhà cung cấp'] || "Tâm Sen") : "Tâm Sen",
            "Nhóm hàng": matchedCust === "Thăng Long" ? "Nguyên liệu" : "Thùng carton",
            "Đơn giá nhập": (buyPrice || 0).toLocaleString("en-US"),
            "Đơn giá bán": (sellPrice || 0).toLocaleString("en-US"),
            "Doanh thu": (revenue || 0).toLocaleString("en-US"),
            "Lợi nhuận gộp": (profit || 0).toLocaleString("en-US"),
            "% Lợi nhuận": `${margin.toFixed(2)}%`,
            "Tháng": new Date().getMonth() + 1
          };
        });

        await onAddDelivery(deliveryRows);
      } else {
        const deliveryRows = (dataToSave.items || []).map((item, idx) => ({
          "STT": `${Date.now()}_${idx + 1}`,
          "Chi tiết đơn hàng": `D_GENERIC_${idx + 1}`,
          "Ngày giao": dataToSave.documentDate || new Date().toLocaleDateString("vi-VN"),
          "Đơn hàng": dataToSave.documentNumber || "REF-OCR",
          "Mã sản phẩm": item.code || "GENERIC",
          "Tên sản phẩm": item.name || "Sản phẩm OCR",
          "ĐVT": item.unit || "Cái",
          "Số lượng giao": (item.quantity || 1).toString(),
          "Số lượng đặt": (item.quantity || 1).toString(),
          "Đã giao": "0",
          "Còn lại": "0",
          "Tiến độ giao": "100%",
          "Status": "Hoàn thành",
          "Số PXK": dataToSave.documentNumber || `PXK-${Date.now()}`,
          "Khách hàng": matchedCust,
          "Sự cố": "",
          "Chi tiết sự cố": "",
          "Nhà cung cấp": "Tâm Sen",
          "Nhóm hàng": "Nguyên liệu",
          "Đơn giá nhập": "0.00",
          "Đơn giá bán": "0.00",
          "Doanh thu": "0.00",
          "Lợi nhuận gộp": "0.00",
          "% Lợi nhuận": "0.00%",
          "Tháng": new Date().getMonth() + 1
        }));
        await onAddDelivery(deliveryRows);
      }
      
      setShowConfirmModal(false);
      setIsSaved(true);
      toast.success(`🎉 Đã lưu thành công chứng từ ${dataToSave.documentNumber || ''} vào hệ thống!`, { id: toastId, duration: 5000 });
    } catch (err: any) {
       console.error("Save to system error:", err);
       toast.error(`Lỗi khi lưu dữ liệu: ${err.message || err}`, { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setImagePreviewUrl(null);
    setStatus("idle");
    setOcrResult(null);
    setIsSaved(false);
    setShowConfirmModal(false);
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 relative overflow-hidden">
      {/* Top Banner / Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Quét OCR Chứng từ & Nhập liệu Tự động</h2>
            <p className="text-sm text-gray-500 mt-1">
              Tải lên hình ảnh hoặc PDF của Đơn hàng (PO), Phiếu xuất kho (PXK) để AI tự động trích xuất dữ liệu thực tế
            </p>
          </div>
          {status !== "idle" && (
            <button 
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors shadow-sm"
            >
              <RefreshCw size={16} />
              Quét tài liệu khác
            </button>
          )}
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 overflow-hidden p-6">
        {/* Confirmation Modal - Apple macOS Window Style */}
        {showConfirmModal && ocrResult && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 border border-black/[0.08]">
              {/* Apple macOS Window Header */}
              <div className="px-6 py-4 border-b border-black/[0.06] flex items-center justify-between bg-[#F5F5F7]">
                <div className="flex items-center gap-3">
                  <MacTrafficLights onClose={() => setShowConfirmModal(false)} />
                  <div className="h-4 w-px bg-black/[0.08]" />
                  <h3 className="text-sm font-bold text-[#1D1D1F] flex items-center gap-2">
                    <Save size={16} className="text-blue-600" />
                    Xác nhận Lưu Dữ liệu vào Hệ thống
                  </h3>
                </div>
              </div>
              
              <div className="p-6">
                <div className="flex items-start gap-3.5 mb-5 bg-blue-50/70 border border-blue-100 p-4 rounded-2xl">
                  <AlertCircle className="text-blue-600 shrink-0 mt-0.5" size={18} />
                  <div>
                    <p className="text-xs font-bold text-blue-900">Kiểm tra thông tin trước khi ghi vào Database</p>
                    <p className="text-[11px] text-blue-700/90 mt-0.5">
                      Dữ liệu sẽ được tạo thành Đơn hàng PO / Phiếu xuất kho chính thức trong hệ thống ERP.
                    </p>
                  </div>
                </div>

                <div className="space-y-3 bg-slate-50/80 p-4 rounded-2xl border border-slate-100 text-xs sm:text-sm">
                  <div className="flex justify-between items-center py-1.5 border-b border-slate-200/60">
                    <span className="text-slate-500">Loại tài liệu:</span>
                    <span className="font-bold text-slate-900">{ocrResult.documentTypeName}</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b border-slate-200/60">
                    <span className="text-slate-500">Số hiệu chứng từ:</span>
                    <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">{ocrResult.documentNumber}</span>
                  </div>
                  {ocrResult.documentReference && (
                    <div className="flex justify-between items-center py-1.5 border-b border-slate-200/60">
                      <span className="text-slate-500">Số PO tham chiếu:</span>
                      <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">{ocrResult.documentReference}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center py-1.5 border-b border-slate-200/60">
                    <span className="text-slate-500">Khách hàng:</span>
                    <span className="font-bold text-slate-900 text-right max-w-[220px] truncate">{ocrResult.buyerName}</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b border-slate-200/60">
                    <span className="text-slate-500">Số mặt hàng trích xuất:</span>
                    <span className="font-bold text-slate-900">{ocrResult.items.length} mặt hàng</span>
                  </div>
                  <div className="flex justify-between items-center py-2 bg-blue-50/60 -mx-4 -mb-4 px-4 rounded-b-2xl border-t border-blue-100">
                    <span className="font-bold text-slate-700">Tổng doanh thu dự kiến:</span>
                    <span className="font-bold text-blue-600 text-base">
                      {((ocrResult?.items || []).reduce((sum, item) => sum + ((item.quantity || 0) * (item.price || 0)), 0) || 0).toLocaleString("vi-VN")} đ
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-6">
                  <button
                    onClick={() => setShowConfirmModal(false)}
                    className="px-4 py-2.5 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    Hủy, kiểm tra lại
                  </button>
                  <button
                    onClick={() => executeSaveToSystem()}
                    disabled={isSaving}
                    className={clsx(
                      "px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2",
                      isSaving 
                        ? "bg-slate-300 cursor-not-allowed text-slate-500" 
                        : "bg-[#007AFF] hover:bg-[#0062CC] text-white shadow-blue-500/20"
                    )}
                  >
                    {isSaving && <Loader2 size={18} className="animate-spin" />}
                    {isSaving ? "Đang xử lý..." : "Xác nhận Lưu ngay"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {status === "idle" && (
          <div className="max-w-4xl mx-auto h-full flex flex-col justify-center py-10">
            <div 
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`bg-white border-2 border-dashed rounded-2xl p-16 flex flex-col items-center justify-center text-center transition-all cursor-pointer relative ${
                isDragging 
                  ? "border-blue-500 bg-blue-50/40 ring-4 ring-blue-50" 
                  : "border-gray-300 hover:border-blue-400 hover:bg-gray-50/50"
              }`}
            >
              <input 
                type="file" 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                accept="image/*,application/pdf"
                onChange={handleFileInput}
                title="Tải lên hoặc Kéo thả file vào đây"
              />
              <div className="bg-blue-50 w-20 h-20 rounded-full flex items-center justify-center mb-6 text-blue-600 shadow-sm">
                <Upload size={36} />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Kéo thả file vào đây hoặc click để chọn</h3>
              <p className="text-gray-500 text-sm max-w-md leading-relaxed">
                Hỗ trợ các định dạng hình ảnh (PNG, JPG, JPEG) hoặc PDF tài liệu. AI sẽ đọc văn bản, phân tích cấu trúc bảng và chuyển thành dữ liệu hệ thống.
              </p>
              
              <div className="mt-8 flex items-center justify-center gap-6 text-xs text-gray-400 font-medium">
                <span className="flex items-center gap-1">
                  <Sparkles size={14} className="text-amber-500 animate-pulse" />
                  Xử lý bởi Gemini 3.5 AI
                </span>
                <span className="w-1.5 h-1.5 bg-gray-300 rounded-full"></span>
                <span>Tự động khớp dữ liệu</span>
                <span className="w-1.5 h-1.5 bg-gray-300 rounded-full"></span>
                <span>Chỉnh sửa trước khi lưu</span>
              </div>
            </div>
          </div>
        )}

        {status === "uploading" && (
          <div className="max-w-md mx-auto h-full flex flex-col justify-center items-center text-center py-12">
            <div className="bg-white border border-gray-200 rounded-2xl p-10 shadow-sm flex flex-col items-center">
              <Loader2 size={44} className="text-blue-600 animate-spin mb-6" />
              <h3 className="text-lg font-bold text-gray-900 mb-1">Đang đọc tài liệu bằng AI...</h3>
              <p className="text-sm text-gray-500 mb-3">Tải lên: {file?.name}</p>
              <div className="w-full bg-gray-100 rounded-full h-1.5 max-w-xs overflow-hidden">
                <div className="bg-blue-600 h-1.5 rounded-full animate-pulse" style={{ width: "80%" }}></div>
              </div>
              <p className="text-xs text-gray-400 mt-4 leading-relaxed">
                Gemini đang thực hiện OCR nhận diện chữ viết tay, chữ in, trích xuất bảng biểu và thông tin đối tác...
              </p>
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="max-w-lg mx-auto h-full flex flex-col justify-center items-center text-center py-12">
            <div className="bg-white border border-red-100 rounded-3xl p-8 sm:p-10 shadow-lg shadow-red-500/5 flex flex-col items-center">
              <div className="bg-red-50 w-16 h-16 rounded-2xl flex items-center justify-center mb-5 text-red-500 shadow-xs">
                <AlertCircle size={32} />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Đã xảy ra sự cố khi quét OCR</h3>
              <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs text-slate-600 leading-relaxed mb-6 max-w-sm text-left">
                <span className="font-semibold text-slate-700 block mb-1">Chi tiết thông báo:</span>
                {errorMessage}
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5 w-full">
                <button 
                  onClick={handleReset}
                  className="flex-1 px-5 py-2.5 bg-[#007AFF] hover:bg-[#0062CC] text-white rounded-xl text-xs sm:text-sm font-semibold transition-colors shadow-sm shadow-blue-500/20"
                >
                  Thử quét lại file khác
                </button>
              </div>
            </div>
          </div>
        )}

        {status === "success" && ocrResult && (
          <div className="h-full flex gap-6 overflow-hidden">
            {/* Left Column: Visual Preview */}
            <div className="w-1/3 bg-white border border-gray-200 rounded-2xl flex flex-col overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <div className="flex items-center gap-2">
                  <Eye size={16} className="text-gray-500" />
                  <span className="font-semibold text-gray-700 text-sm">Xem trước Tài liệu Gốc</span>
                </div>
                <span className="text-xs text-gray-500 bg-white border border-gray-200 px-2.5 py-1 rounded-md font-mono truncate max-w-[150px]">
                  {file?.name}
                </span>
              </div>
              <div className="flex-1 bg-gray-100 flex items-center justify-center p-6 overflow-auto">
                {imagePreviewUrl ? (
                  <img 
                    src={imagePreviewUrl} 
                    alt="Original Document Preview" 
                    className="max-h-full max-w-full rounded-lg shadow-md object-contain border border-gray-200 bg-white" 
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="text-center p-8 text-gray-400">
                    <FileText size={48} className="mx-auto mb-3 opacity-50" />
                    <p className="text-sm">Xem trước hình ảnh không khả dụng (Đang xem file PDF/Khác)</p>
                    <p className="text-xs mt-1 text-gray-400">AI vẫn phân tích chính xác toàn bộ nội dung</p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: OCR Editor and Saver */}
            <div className="flex-1 bg-white border border-gray-200 rounded-2xl flex flex-col overflow-hidden shadow-sm">
              {/* Review status bar */}
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-green-50/40 border-t-4 border-t-green-500">
                <div className="flex items-center gap-3">
                  <div className="bg-green-100 text-green-700 p-1.5 rounded-lg">
                    <CheckCircle size={18} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm">Kết quả Đọc OCR Thực tế thành công</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Vui lòng đối chiếu với ảnh gốc bên trái, chỉnh sửa nếu cần và chọn "Lưu vào Hệ thống"
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold px-2.5 py-1 bg-blue-100 text-blue-700 rounded-md">
                    Khớp loại: {ocrResult.documentTypeName} ({ocrResult.documentType})
                  </span>
                </div>
              </div>

              {/* Form Workspace */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Meta Fields Section */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Loại chứng từ</label>
                    <select
                      value={ocrResult.documentType}
                      onChange={(e) => {
                        const val = e.target.value;
                        const nameMap: Record<string, string> = {
                          "PO": "Đơn đặt hàng (PO)",
                          "PXK": "Phiếu xuất kho (PXK)",
                          "Invoice": "Hóa đơn đỏ (Invoice)",
                          "Unknown": "Khác / Chưa phân loại"
                        };
                        setOcrResult({
                          ...ocrResult,
                          documentType: val,
                          documentTypeName: nameMap[val] || "Khác"
                        });
                      }}
                      className="w-full bg-gray-50 border border-gray-200 focus:border-blue-500 focus:bg-white rounded-lg px-3.5 py-2 text-sm outline-none transition-colors"
                    >
                      <option value="PO">Đơn đặt hàng (PO)</option>
                      <option value="PXK">Phiếu xuất kho (PXK)</option>
                      <option value="Invoice">Hóa đơn (Invoice)</option>
                      <option value="Unknown">Khác / Chưa rõ</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Số chứng từ</label>
                    <input
                      type="text"
                      value={ocrResult.documentNumber || ""}
                      onChange={(e) => handleMetaChange("documentNumber", e.target.value)}
                      placeholder="Số PO / Số PXK..."
                      className="w-full bg-gray-50 border border-gray-200 focus:border-blue-500 focus:bg-white rounded-lg px-3.5 py-2 text-sm outline-none transition-colors font-medium text-gray-900"
                    />
                  </div>

                  {ocrResult.documentType === "PXK" && (
                    <div className="bg-blue-50/50 p-2 rounded-lg border border-blue-100">
                      <label className="block text-xs font-bold text-blue-700 uppercase tracking-wider mb-1.5">Số Đơn hàng (PO)</label>
                      <input
                        type="text"
                        value={ocrResult.documentReference || ""}
                        onChange={(e) => handleMetaChange("documentReference", e.target.value)}
                        placeholder="Số PO tham chiếu..."
                        className="w-full bg-white border border-blue-200 focus:border-blue-500 rounded-lg px-3.5 py-2 text-sm outline-none transition-colors font-bold text-blue-800"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Ngày lập</label>
                    <input
                      type="text"
                      value={ocrResult.documentDate || ""}
                      onChange={(e) => handleMetaChange("documentDate", e.target.value)}
                      placeholder="Ngày lập (Ví dụ: 09/01/2026)"
                      className="w-full bg-gray-50 border border-gray-200 focus:border-blue-500 focus:bg-white rounded-lg px-3.5 py-2 text-sm outline-none transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Thời hạn/Ngày giao</label>
                    <input
                      type="text"
                      value={ocrResult.deliveryDate || ""}
                      onChange={(e) => handleMetaChange("deliveryDate", e.target.value)}
                      placeholder="Ngày giao nhận hàng..."
                      className="w-full bg-gray-50 border border-gray-200 focus:border-blue-500 focus:bg-white rounded-lg px-3.5 py-2 text-sm outline-none transition-colors"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Bên mua / Bên nhận hàng</label>
                    <input
                      type="text"
                      value={ocrResult.buyerName || ""}
                      onChange={(e) => handleMetaChange("buyerName", e.target.value)}
                      placeholder="Khách hàng mua hàng..."
                      className="w-full bg-gray-50 border border-gray-200 focus:border-blue-500 focus:bg-white rounded-lg px-3.5 py-2 text-sm font-semibold text-gray-800 outline-none transition-colors"
                    />
                  </div>
                </div>

                {/* Seller/Buyer Addresses details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-3 border-t border-gray-100">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Địa chỉ Bên nhận</label>
                    <textarea
                      value={ocrResult.buyerAddress || ""}
                      onChange={(e) => handleMetaChange("buyerAddress", e.target.value)}
                      rows={2}
                      placeholder="Địa chỉ giao hàng..."
                      className="w-full bg-gray-50 border border-gray-200 focus:border-blue-500 focus:bg-white rounded-lg px-3.5 py-2 text-sm outline-none transition-colors resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Bên bán / Bên cung cấp</label>
                    <input
                      type="text"
                      value={ocrResult.sellerName || ""}
                      onChange={(e) => handleMetaChange("sellerName", e.target.value)}
                      placeholder="Tên nhà cung cấp..."
                      className="w-full bg-gray-50 border border-gray-200 focus:border-blue-500 focus:bg-white rounded-lg px-3.5 py-2 text-sm outline-none transition-colors mb-2"
                    />
                    <input
                      type="text"
                      value={ocrResult.sellerAddress || ""}
                      onChange={(e) => handleMetaChange("sellerAddress", e.target.value)}
                      placeholder="Địa chỉ bên bán..."
                      className="w-full bg-gray-50 border border-gray-200 focus:border-blue-500 focus:bg-white rounded-lg px-3.5 py-2 text-xs outline-none transition-colors"
                    />
                  </div>
                </div>

                {/* Items/Goods Table Section */}
                <div className="pt-4 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Danh sách Chi tiết Hàng hóa</h4>
                    <button
                      onClick={handleAddItem}
                      className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800"
                    >
                      <Plus size={14} /> Thêm dòng hàng
                    </button>
                  </div>

                  <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-200 text-xs">
                        <tr>
                          <th className="px-3 py-3 w-10 text-center">STT</th>
                          <th className="px-3 py-3 w-32">Mã SP</th>
                          <th className="px-4 py-3">Tên sản phẩm/hàng hóa</th>
                          <th className="px-3 py-3 w-28">Đối chiếu giá</th>
                          <th className="px-3 py-3 w-16 text-center">ĐVT</th>
                          <th className="px-3 py-3 w-24 text-right">Số lượng</th>
                          <th className="px-3 py-3 w-28 text-right">Đơn giá bán</th>
                          <th className="px-3 py-3 w-28 text-right">Doanh thu</th>
                          <th className="px-3 py-3 w-12 text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {ocrResult.items.map((item, idx) => {
                          const isMatched = item.notes?.includes('Matched');
                          return (
                          <tr key={idx} className="hover:bg-gray-50 transition-colors">
                            <td className="px-3 py-2.5 text-center font-mono text-xs text-gray-400">
                              {idx + 1}
                            </td>
                            <td className="px-3 py-2.5">
                              <input
                                type="text"
                                value={item.code || ""}
                                onChange={(e) => handleItemChange(idx, "code", e.target.value)}
                                className={`w-full bg-transparent border-0 border-b border-transparent hover:border-gray-200 focus:border-blue-500 focus:ring-0 px-1 py-0.5 text-xs outline-none ${isMatched ? 'text-blue-600 font-bold' : ''}`}
                                placeholder="Auto"
                              />
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={item.name || ""}
                                  onChange={(e) => handleItemChange(idx, "name", e.target.value)}
                                  className="flex-1 bg-transparent border-0 border-b border-transparent hover:border-gray-200 focus:border-blue-500 focus:ring-0 px-1 py-0.5 text-sm font-semibold text-gray-900 outline-none"
                                  placeholder="Nhập tên hàng hóa"
                                />
                                <ProductHoverCard productName={item.name} productCode={item.code} pricingData={pricingData}>
                                  <div className="text-gray-300 hover:text-blue-500 transition-colors">
                                    <HelpCircle size={14} />
                                  </div>
                                </ProductHoverCard>
                              </div>
                            </td>
                            <td className="px-3 py-2.5">
                              {isMatched ? (
                                <div className="flex items-center gap-1.5 text-[10px] bg-blue-50 text-blue-700 px-2 py-1 rounded border border-blue-100 font-medium whitespace-nowrap overflow-hidden">
                                  <CheckCircle size={10} className="shrink-0" />
                                  <span className="truncate">{item.notes?.split('|')[0].replace('Matched: ', '')}</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 text-[10px] bg-amber-50 text-amber-700 px-2 py-1 rounded border border-amber-100 font-medium">
                                  <AlertCircle size={10} className="shrink-0" />
                                  Chưa khớp giá
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <input
                                type="text"
                                value={item.unit || ""}
                                onChange={(e) => handleItemChange(idx, "unit", e.target.value)}
                                className="w-full text-center bg-transparent border-0 border-b border-transparent hover:border-gray-200 focus:border-blue-500 focus:ring-0 px-1 py-0.5 text-xs outline-none"
                                placeholder="Đvt"
                              />
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <input
                                type="number"
                                value={item.quantity || 0}
                                onChange={(e) => handleItemChange(idx, "quantity", parseInt(e.target.value) || 0)}
                                className="w-full text-right bg-transparent border-0 border-b border-transparent hover:border-gray-200 focus:border-blue-500 focus:ring-0 px-1 py-0.5 text-sm font-mono font-bold text-gray-900 outline-none"
                              />
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <input
                                type="number"
                                value={item.price || 0}
                                onChange={(e) => handleItemChange(idx, "price", parseFloat(e.target.value) || 0)}
                                className="w-full text-right bg-transparent border-0 border-b border-transparent hover:border-gray-200 focus:border-blue-500 focus:ring-0 px-1 py-0.5 text-sm font-mono outline-none"
                              />
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono text-sm font-bold text-blue-600">
                              {(Number(item.amount) || ((item.quantity || 0) * (item.price || 0)) || 0).toLocaleString("vi-VN")}
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <button
                                onClick={() => handleRemoveItem(idx)}
                                className="text-red-500 hover:text-red-700 p-1 rounded-md hover:bg-red-50"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Signers Info */}
                {ocrResult.signers && (
                  <div className="pt-4 border-t border-gray-100 grid grid-cols-2 gap-5 text-sm">
                    <div>
                      <span className="block text-xs font-semibold text-gray-400 uppercase mb-1">Người lập đơn/Chứng từ</span>
                      <input
                        type="text"
                        value={ocrResult.signers.creator || ""}
                        onChange={(e) => {
                          setOcrResult({
                            ...ocrResult,
                            signers: {
                              ...ocrResult.signers,
                              creator: e.target.value
                            }
                          });
                        }}
                        className="w-full bg-gray-50 border border-gray-200 focus:border-blue-500 focus:bg-white rounded-lg px-3.5 py-1.5 text-xs outline-none font-medium"
                      />
                    </div>
                    <div>
                      <span className="block text-xs font-semibold text-gray-400 uppercase mb-1">Người ký duyệt / Đại diện</span>
                      <input
                        type="text"
                        value={ocrResult.signers.approver || ""}
                        onChange={(e) => {
                          setOcrResult({
                            ...ocrResult,
                            signers: {
                              ...ocrResult.signers,
                              approver: e.target.value
                            }
                          });
                        }}
                        className="w-full bg-gray-50 border border-gray-200 focus:border-blue-500 focus:bg-white rounded-lg px-3.5 py-1.5 text-xs outline-none font-medium"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Action Bar */}
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
                <button
                  onClick={handleReset}
                  className="px-5 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                >
                  Bỏ qua & Quét lại
                </button>
                
                {isSaved ? (
                  <div className="flex items-center gap-2 text-green-700 font-bold text-sm bg-green-100 px-4 py-2.5 rounded-lg animate-in fade-in zoom-in-95 duration-150">
                    <CheckCircle size={18} />
                    <span>Đã lưu thành công dữ liệu thực tế vào danh sách {ocrResult.documentType === 'PO' ? 'Đơn hàng' : 'Giao hàng (PXK)'}!</span>
                  </div>
                ) : (
                  <button
                    onClick={handleSaveToSystem}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold flex items-center gap-2 transition-all shadow-md hover:shadow-lg active:scale-95"
                  >
                    <Save size={18} />
                    Lưu vào Hệ thống ({ocrResult.documentType})
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
