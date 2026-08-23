import React, { useState, useMemo, useRef, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import clsx from 'clsx';
import { 
  Upload, FileText, Camera, CheckCircle, AlertCircle, Loader2, Edit3, 
  Trash2, Plus, Sparkles, Save, ArrowRight, Eye, RefreshCw,
  Search, Info, HelpCircle, HardDrive, ExternalLink, ChevronDown,
  Tag, FileSpreadsheet, Building2, Layers, Check, X, ShieldAlert,
  Percent, DollarSign, Package
} from 'lucide-react';
import { 
  findPriceRecord, 
  parseNumber, 
  parseDateToISO, 
  getSellPriceFromRecord, 
  getBuyPriceFromRecord,
  normalizeString
} from '../lib/business-logic';
import { ProductHoverCard } from './ProductHoverCard';
import { processDocumentOCR } from '../lib/gemini';
import MacTrafficLights from './MacTrafficLights';
import { generateSmartDocumentFileName } from '../lib/documentNaming';

export interface OCRItem {
  index: number;
  code: string;
  name: string;
  specs?: string;
  unit: string;
  quantity: number;
  price: number; // Đơn giá bán
  buyPrice: number; // Đơn giá nhập / Giá vốn (COGS)
  priceCode?: string; // Mã giá bán Gsp_XXX
  contractNumber?: string; // Số hợp đồng căn cứ
  supplier?: string; // Nhà cung cấp
  amount: number; // Doanh thu = Số lượng * Giá bán
  profit: number; // Lợi nhuận gộp = (Giá bán - Giá mua) * Số lượng
  marginPct: number; // Biên lợi nhuận %
  notes: string;
}

export interface OCRData {
  documentType: string;
  documentTypeName: string;
  documentNumber: string;
  documentReference?: string; // Số PO liên kết trong PXK
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
  onUploadToDrive?: (file: File, metadata: any) => Promise<any>;
  poHeaders?: any[];
  poLines?: any[];
  deliveryPlans?: any[];
  pricingData?: any[];
  contractsData?: any[];
  productData?: any[];
  onUpdatePOLines?: (rows: any[]) => Promise<void>;
  onUpdateDeliveryPlan?: (rows: any[]) => Promise<void>;
}

export default function OCRView({ 
  onAddPOHeader, 
  onAddPOLines, 
  onAddDelivery, 
  onUploadToDrive,
  poHeaders = [],
  poLines = [],
  deliveryPlans = [],
  pricingData = [],
  contractsData = [],
  productData = [],
  onUpdatePOLines,
  onUpdateDeliveryPlan
}: OCRViewProps) {
  const [file, setFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [ocrResult, setOcrResult] = useState<OCRData | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [customFileName, setCustomFileName] = useState<string>("");
  const [savedDriveInfo, setSavedDriveInfo] = useState<{
    documentNumber: string;
    driveLink?: string;
    folderLink?: string;
    folderPath?: string;
  } | null>(null);

  // Price Selector Dropdown State
  const [activePriceSelectIdx, setActivePriceSelectIdx] = useState<number | null>(null);
  const [priceSearchQuery, setPriceSearchQuery] = useState<string>('');
  const pricePopoverRef = useRef<HTMLDivElement>(null);

  // Drag and drop states
  const [isDragging, setIsDragging] = useState(false);

  // Match buyer name to pre-existing standard customer IDs
  const getMatchedCustomerID = (name: string): string => {
    if (!name) return "Khách hàng mới";
    const lower = name.toLowerCase();
    if (lower.includes("thanh hóa") || lower.includes("thanh hoá")) return "Thanh Hoá";
    if (lower.includes("thăng long")) return "Thăng Long";
    if (lower.includes("bắc sơn")) return "Bắc Sơn";
    if (lower.includes("ngân sơn")) return "Ngân Sơn";
    if (lower.includes("sài gòn")) return "Sài Gòn";
    if (lower.includes("bến tre")) return "Bến Tre";
    return name;
  };

  // Close price popover on outside click
  useEffect(() => {
    const handleClickOutside = (evt: MouseEvent) => {
      if (pricePopoverRef.current && !pricePopoverRef.current.contains(evt.target as Node)) {
        setActivePriceSelectIdx(null);
    setCustomFileName("");
      }
    };
    if (activePriceSelectIdx !== null) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [activePriceSelectIdx]);

  const handleFile = async (selectedFile: File) => {
    setFile(selectedFile);
    setIsSaved(false);
    setErrorMessage("");

    if (selectedFile.type.startsWith("image/")) {
      const url = URL.createObjectURL(selectedFile);
      setImagePreviewUrl(url);
    } else {
      setImagePreviewUrl(null);
    }

    setStatus("uploading");

    try {
      // Process OCR using Gemini Multimodal Engine
      const rawData = await processDocumentOCR(selectedFile);
      
      const buyerCustomer = getMatchedCustomerID(rawData.buyerName || rawData.sellerName || '');

      const rawItems: OCRItem[] = Array.isArray(rawData.items) ? rawData.items.map((it: any, idx: number) => {
        const qty = Number(it.quantity) || 1;
        const initialSellPrice = Number(it.price) || 0;

        // Auto-match against pricingData
        const priceRecord = findPriceRecord(pricingData, { 
          sku: it.code || it.name, 
          name: it.name,
          customer: buyerCustomer 
        });

        const sellPrice = priceRecord ? getSellPriceFromRecord(priceRecord) : initialSellPrice;
        const buyPrice = priceRecord ? getBuyPriceFromRecord(priceRecord) : 0;
        const priceCode = priceRecord ? (priceRecord['Mã giá bán'] || priceRecord['Mã giá'] || priceRecord['Mã sản phẩm'] || '') : '';
        const contractNo = priceRecord ? (priceRecord['Số hợp đồng'] || priceRecord['Hợp đồng căn cứ'] || '') : '';
        const supplier = priceRecord ? (priceRecord['RP_Nhà cung cấp'] || priceRecord['Nhà cung cấp'] || 'Tâm Sen') : 'Tâm Sen';
        const normName = priceRecord ? (priceRecord['Tên sản phẩm'] || it.name) : (it.name || 'Sản phẩm OCR');
        const normCode = priceRecord ? (priceRecord['Mã sản phẩm'] || it.code) : (it.code || '');
        const normUnit = priceRecord ? (priceRecord['ĐVT'] || it.unit) : (it.unit || 'Cái');

        const amount = sellPrice * qty;
        const profit = (sellPrice - buyPrice) * qty;
        const marginPct = sellPrice > 0 ? ((sellPrice - buyPrice) / sellPrice) * 100 : 0;

        return {
          index: it.index || idx + 1,
          code: normCode,
          name: normName,
          specs: it.specs || '',
          unit: normUnit,
          quantity: qty,
          price: sellPrice,
          buyPrice: buyPrice,
          priceCode: priceCode,
          contractNumber: contractNo,
          supplier: supplier,
          amount: amount,
          profit: profit,
          marginPct: marginPct,
          notes: priceCode ? `Khớp bảng giá: ${priceCode} (LN: ${marginPct.toFixed(1)}%)` : 'Chưa liên kết bảng giá'
        };
      }) : [];

      const data: OCRData = {
        documentType: rawData.documentType || 'PXK',
        documentTypeName: rawData.documentTypeName || 'Phiếu xuất kho',
        documentNumber: rawData.documentNumber || '',
        documentReference: rawData.documentReference || '',
        documentDate: rawData.documentDate || '',
        deliveryDate: rawData.deliveryDate || rawData.documentDate || '',
        buyerName: rawData.buyerName || '',
        buyerAddress: rawData.buyerAddress || '',
        sellerName: rawData.sellerName || '',
        sellerAddress: rawData.sellerAddress || '',
        items: rawItems,
        signers: rawData.signers
      };
      
      const autoName = generateSmartDocumentFileName({
        documentType: data.documentType,
        documentNumber: data.documentNumber,
        documentDate: data.documentDate,
        deliveryDate: data.deliveryDate,
        documentReference: data.documentReference,
        buyerName: data.buyerName,
        originalFileName: selectedFile.name
      });
      setCustomFileName(autoName);
      setOcrResult(data);
      setStatus("success");
      toast.success("Trích xuất OCR & Tự động đối chiếu Bảng giá thành công!", { icon: "✨" });
      
    } catch (err: any) {
      console.error("OCR Processing error:", err);
      const msg = err?.message || "Không thể xử lý trích xuất văn bản từ chứng từ.";
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
    const updated = {
      ...ocrResult,
      [field]: value
    };
    setOcrResult(updated);
    setIsSaved(false);
    
    // Auto-update smart filename when metadata changes
    const newName = generateSmartDocumentFileName({
      documentType: updated.documentType,
      documentNumber: updated.documentNumber,
      documentDate: updated.documentDate,
      deliveryDate: updated.deliveryDate,
      documentReference: updated.documentReference,
      buyerName: updated.buyerName,
      originalFileName: file?.name || "document.pdf"
    });
    setCustomFileName(newName);
  };

  const handleItemChange = (index: number, field: keyof OCRItem, value: any) => {
    if (!ocrResult) return;
    const updatedItems = ocrResult.items.map((item, i) => {
      if (i === index) {
        const updatedItem = { ...item, [field]: value };
        
        // Recalculate amount, profit & margin if quantity, price, or buyPrice changes
        if (field === 'quantity' || field === 'price' || field === 'buyPrice') {
          const qty = field === 'quantity' ? Number(value) : item.quantity;
          const sellPr = field === 'price' ? Number(value) : item.price;
          const buyPr = field === 'buyPrice' ? Number(value) : item.buyPrice;

          updatedItem.amount = qty * sellPr;
          updatedItem.profit = (sellPr - buyPr) * qty;
          updatedItem.marginPct = sellPr > 0 ? ((sellPr - buyPr) / sellPr) * 100 : 0;
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

  // Select a specific pricing record for a line
  const handleSelectPricingForLine = (index: number, priceRecord: any) => {
    if (!ocrResult || !priceRecord) return;
    
    const sellPrice = getSellPriceFromRecord(priceRecord);
    const buyPrice = getBuyPriceFromRecord(priceRecord);
    const priceCode = priceRecord['Mã giá bán'] || priceRecord['Mã giá'] || priceRecord['Mã sản phẩm'] || '';
    const contractNo = priceRecord['Số hợp đồng'] || priceRecord['Hợp đồng căn cứ'] || '';
    const supplier = priceRecord['RP_Nhà cung cấp'] || priceRecord['Nhà cung cấp'] || 'Tâm Sen';
    const prodName = priceRecord['Tên sản phẩm'] || '';
    const prodCode = priceRecord['Mã sản phẩm'] || '';
    const unit = priceRecord['ĐVT'] || '';

    const currentQty = ocrResult.items[index]?.quantity || 1;
    const amount = sellPrice * currentQty;
    const profit = (sellPrice - buyPrice) * currentQty;
    const marginPct = sellPrice > 0 ? ((sellPrice - buyPrice) / sellPrice) * 100 : 0;

    const updatedItems = ocrResult.items.map((item, i) => {
      if (i === index) {
        return {
          ...item,
          code: prodCode || item.code,
          name: prodName || item.name,
          unit: unit || item.unit,
          price: sellPrice,
          buyPrice: buyPrice,
          priceCode: priceCode,
          contractNumber: contractNo,
          supplier: supplier,
          amount: amount,
          profit: profit,
          marginPct: marginPct,
          notes: `Đã liên kết [${priceCode}] ${contractNo ? `(HĐ: ${contractNo})` : ''} - LN: ${marginPct.toFixed(1)}%`
        };
      }
      return item;
    });

    setOcrResult({
      ...ocrResult,
      items: updatedItems
    });
    setActivePriceSelectIdx(null);
    setIsSaved(false);
    toast.success(`Đã liên kết mã giá ${priceCode} cho dòng ${index + 1}!`);
  };

  const handleAddItem = () => {
    if (!ocrResult) return;
    const newItem: OCRItem = {
      index: ocrResult.items.length + 1,
      code: "",
      name: "",
      specs: "",
      unit: "Cái",
      quantity: 1,
      price: 0,
      buyPrice: 0,
      priceCode: "",
      contractNumber: "",
      supplier: "Tâm Sen",
      amount: 0,
      profit: 0,
      marginPct: 0,
      notes: "Dòng hàng mới"
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

  // Helper to format currency
  const formatMoney = (amount: number) => {
    if (!amount) return "0";
    return Math.round(amount).toLocaleString("vi-VN");
  };

  // Financial summary of current OCR document
  const documentFinancials = useMemo(() => {
    if (!ocrResult || !ocrResult.items) {
      return { totalRevenue: 0, totalCOGS: 0, totalProfit: 0, avgMargin: 0, totalQty: 0 };
    }
    let totalRevenue = 0;
    let totalCOGS = 0;
    let totalQty = 0;

    ocrResult.items.forEach(it => {
      const q = Number(it.quantity) || 0;
      const sp = Number(it.price) || 0;
      const bp = Number(it.buyPrice) || 0;
      totalQty += q;
      totalRevenue += (sp * q);
      totalCOGS += (bp * q);
    });

    const totalProfit = totalRevenue - totalCOGS;
    const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    return { totalRevenue, totalCOGS, totalProfit, avgMargin, totalQty };
  }, [ocrResult]);

  // Pricing candidates for active line selection
  const filteredPricingOptions = useMemo(() => {
    if (!pricingData || pricingData.length === 0) return [];
    const q = priceSearchQuery.toLowerCase().trim();
    const currentCustomer = ocrResult ? getMatchedCustomerID(ocrResult.buyerName) : '';

    return pricingData.filter(p => {
      const code = (p['Mã giá bán'] || p['Mã giá'] || p['Mã sản phẩm'] || '').toLowerCase();
      const name = (p['Tên sản phẩm'] || '').toLowerCase();
      const cust = (p['RP_Khách hàng'] || p['Khách hàng'] || p['Giao đến'] || '').toLowerCase();
      const contract = (p['Số hợp đồng'] || p['Hợp đồng căn cứ'] || '').toLowerCase();

      if (!q) return true;
      return code.includes(q) || name.includes(q) || cust.includes(q) || contract.includes(q);
    }).sort((a, b) => {
      // Prioritize customer matching
      const aCust = (a['RP_Khách hàng'] || a['Khách hàng'] || '').toLowerCase();
      const bCust = (b['RP_Khách hàng'] || b['Khách hàng'] || '').toLowerCase();
      const cur = currentCustomer.toLowerCase();
      const aMatch = cur && aCust.includes(cur);
      const bMatch = cur && bCust.includes(cur);

      if (aMatch && !bMatch) return -1;
      if (!aMatch && bMatch) return 1;
      return 0;
    });
  }, [pricingData, priceSearchQuery, ocrResult]);

  const handleSaveToSystem = (optionalData?: OCRData | React.MouseEvent) => {
    const isMouseEvent = optionalData && 'nativeEvent' in optionalData;
    
    if (isMouseEvent) {
      setShowConfirmModal(true);
      return;
    }

    executeSaveToSystem(optionalData as OCRData);
  };

  const executeSaveToSystem = async (optionalData?: OCRData) => {
    const dataToSave = optionalData || ocrResult;
    
    if (!dataToSave || isSaving) return;
    
    const matchedCust = getMatchedCustomerID(dataToSave.buyerName);
    
    setIsSaving(true);
    const toastId = toast.loading('Đang lưu và liên kết dữ liệu đa bảng...');

    try {
      // 1. Upload file to Google Drive in background with smart scientific filename
      const finalFileName = customFileName || generateSmartDocumentFileName({
        documentType: dataToSave.documentType,
        documentNumber: dataToSave.documentNumber,
        documentDate: dataToSave.documentDate,
        deliveryDate: dataToSave.deliveryDate,
        documentReference: dataToSave.documentReference,
        buyerName: dataToSave.buyerName,
        originalFileName: file.name
      });

      if (onUploadToDrive && file) {
        onUploadToDrive(file, {
          documentType: dataToSave.documentType,
          documentNumber: dataToSave.documentNumber,
          fileName: finalFileName
        }).then((res: any) => {
          if (res) {
            setSavedDriveInfo({
              documentNumber: dataToSave.documentNumber,
              driveLink: res.driveLink,
              folderLink: res.folderLink,
              folderPath: res.folderPath
            });
          }
        }).catch(err => {
          console.warn("Background upload to Drive skipped/failed:", err);
        });
      }

      const docType = (dataToSave.documentType || "").toUpperCase();
      
      if (docType === "PO" || docType === "ĐƠN ĐẶT HÀNG") {
        // 1. Calculate total order value with real pricing lookup
        const linesToInsert = (dataToSave.items || []).map((item, idx) => {
          const lineId = `D_OCR_${Date.now()}_${idx + 1}`;
          
          const qty = Number(item.quantity) || 1;
          const sellPrice = Number(item.price) || 0;
          const buyPrice = Number(item.buyPrice) || 0;
          const revenue = sellPrice * qty;
          const profit = (sellPrice - buyPrice) * qty;

          return {
            "STT": lineId,
            "Số đơn hàng": dataToSave.documentNumber || `PO-${Date.now()}`,
            "Mã giá bán": item.priceCode || "Gsp_N/A",
            "Tên sản phẩm": item.name || "Sản phẩm OCR",
            "Mã của khách": item.code || "",
            "ĐVT": item.unit || "Cái",
            "Số lượng": qty.toString(),
            "Ngày đặt hàng": parseDateToISO(dataToSave.documentDate) || new Date().toISOString().split('T')[0],
            "Ngày giao": parseDateToISO(dataToSave.deliveryDate || dataToSave.documentDate) || new Date().toISOString().split('T')[0],
            "Thời gian xử lý": "5",
            "Khách hàng": matchedCust,
            "Đơn vị nhận hàng": matchedCust,
            "Nhóm hàng": matchedCust === "Thăng Long" ? "Nguyên liệu" : "Thùng carton",
            "Đơn giá nhập": (buyPrice || 0).toLocaleString("en-US"),
            "Thành tiền dòng": (revenue || 0).toLocaleString("en-US"),
            "Hoàn thành": "0",
            "Đã giao": "0",
            "Còn lại": qty.toString(),
            "Số lượng khách hàng": "4",
            "Đơn giá bán": (sellPrice || 0).toLocaleString("en-US"),
            "Lợi nhuận": (profit || 0).toLocaleString("en-US"),
            "Lợi nhuận dòng": (profit || 0).toLocaleString("en-US"),
            "Các mục mẹ 2": item.contractNumber || "",
            "Tiến độ sản phẩm": "0%"
          };
        });

        const totalOrderVal = linesToInsert.reduce((sum, line) => sum + parseNumber(line["Thành tiền dòng"]), 0);

        await onAddPOHeader({
          "Đơn hàng": dataToSave.documentNumber || `PO-${Date.now()}`,
          "Ngày đặt hàng": parseDateToISO(dataToSave.documentDate) || new Date().toISOString().split('T')[0],
          "Khách hàng": matchedCust,
          "Phân loại": "Đơn hàng thường xuyên",
          "Tệp đơn hàng": file?.name || "document_ocr.pdf",
          "Chi tiết đơn hàng": linesToInsert.map(l => l.STT).join(","),
          "Trạng Thái": "Mới nhận",
          "Tổng giá trị đơn hàng": (totalOrderVal || 0).toLocaleString("en-US")
        });

        await onAddPOLines(linesToInsert);

      } else {
        // DocType: PXK, INVOICE, BIÊN BẢN GIAO HÀNG, PHIẾU XUẤT KHO
        const poNumber = dataToSave.documentReference || "PO-REF";

        const deliveryRows = (dataToSave.items || []).map((item, idx) => {
          const qty = Number(item.quantity) || 1;
          const sellPrice = Number(item.price) || 0;
          const buyPrice = Number(item.buyPrice) || 0;
          const revenue = sellPrice * qty;
          const profit = (sellPrice - buyPrice) * qty;
          const margin = sellPrice > 0 ? (profit / revenue) * 100 : 0;

          return {
            "STT": `${Date.now()}_${idx + 1}`,
            "Chi tiết đơn hàng": `D_OCR_${Date.now()}_${idx + 1}`,
            "Ngày giao": dataToSave.deliveryDate || dataToSave.documentDate || new Date().toLocaleDateString("vi-VN"),
            "Đơn hàng": poNumber,
            "Mã sản phẩm": item.priceCode || item.code || "Gsp_N/A",
            "Tên sản phẩm": item.name || "Sản phẩm OCR",
            "ĐVT": item.unit || "Cái",
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
            "Nhà cung cấp": item.supplier || "Tâm Sen",
            "Nhóm hàng": matchedCust === "Thăng Long" ? "Nguyên liệu" : "Thùng carton",
            "Đơn giá nhập": (buyPrice || 0).toLocaleString("en-US"),
            "Đơn giá bán": (sellPrice || 0).toLocaleString("en-US"),
            "Doanh thu": (revenue || 0).toLocaleString("en-US"),
            "Lợi nhuận gộp": (profit || 0).toLocaleString("en-US"),
            "% Lợi nhuận": `${margin.toFixed(2)}%`,
            "Tháng": new Date().getMonth() + 1
          };
        });

        // 1. Insert into Deliveries Table
        await onAddDelivery(deliveryRows);

        // 2. Relational Auto-Propagation: Update po_lines if matching PO found
        if (onUpdatePOLines && poLines.length > 0 && poNumber && poNumber !== "PO-REF") {
          const poLinesToUpdate: any[] = [];

          deliveryRows.forEach(delRow => {
            const delQty = parseNumber(delRow["Số lượng giao"]);
            const delProd = normalizeString(delRow["Tên sản phẩm"]);
            const delCode = normalizeString(delRow["Mã sản phẩm"]);

            const matchedLine = poLines.find(pl => {
              const poMatch = normalizeString(pl["Số đơn hàng"] || pl["Đơn hàng"]) === normalizeString(poNumber);
              const nameMatch = normalizeString(pl["Tên sản phẩm"]).includes(delProd) || delProd.includes(normalizeString(pl["Tên sản phẩm"]));
              const codeMatch = delCode && (normalizeString(pl["Mã của khách"]) === delCode || normalizeString(pl["Mã giá bán"]) === delCode);
              return poMatch && (nameMatch || codeMatch);
            });

            if (matchedLine) {
              const currentDelivered = parseNumber(matchedLine["Đã giao"] || matchedLine["Hoàn thành"] || 0);
              const newDelivered = currentDelivered + delQty;
              const orderedQty = parseNumber(matchedLine["Số lượng"] || 0);
              const remaining = Math.max(0, orderedQty - newDelivered);
              const progressPct = orderedQty > 0 ? Math.min(100, Math.round((newDelivered / orderedQty) * 100)) : 100;

              poLinesToUpdate.push({
                ...matchedLine,
                "Đã giao": newDelivered.toString(),
                "Hoàn thành": newDelivered.toString(),
                "Còn lại": remaining.toString(),
                "Tiến độ sản phẩm": `${progressPct}%`
              });
            }
          });

          if (poLinesToUpdate.length > 0) {
            await onUpdatePOLines(poLinesToUpdate);
            console.log(`Đã tự động cập nhật ${poLinesToUpdate.length} dòng PO liên quan!`);
          }
        }

        // 3. Relational Auto-Propagation: Update delivery_plans
        if (onUpdateDeliveryPlan && deliveryPlans.length > 0 && poNumber) {
          const plansToUpdate = deliveryPlans.filter(dp => 
            normalizeString(dp["Đơn hàng"] || '') === normalizeString(poNumber) &&
            dp["Trạng thái"] !== "Hoàn thành"
          ).map(dp => ({
            ...dp,
            "Trạng thái": "Hoàn thành"
          }));

          if (plansToUpdate.length > 0) {
            await onUpdateDeliveryPlan(plansToUpdate);
            console.log(`Đã tự động cập nhật ${plansToUpdate.length} kế hoạch giao hàng sang Hoàn thành!`);
          }
        }
      }
      
      setShowConfirmModal(false);
      setIsSaved(true);
      toast.success(`🎉 Đã lưu chứng từ ${dataToSave.documentNumber || ''} & Tự động liên kết các bảng thành công!`, { id: toastId, duration: 5000 });
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
    setSavedDriveInfo(null);
    setActivePriceSelectIdx(null);
  };

  return (
    <div className="space-y-6 w-full max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8 py-4 font-sans">
      {/* Top Header */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10.5px] font-bold text-blue-600 uppercase tracking-widest bg-blue-50 px-2.5 py-0.5 rounded-md border border-blue-100">
                Gemini Vision OCR & Auto-Pricing Engine
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-xs text-slate-500 font-medium">Tự Động Nhận Diện • Liên Kết Bảng Giá & Hợp Đồng • Tính Giá Thành</span>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
              <Sparkles className="text-[#007AFF]" size={26} />
              <span>Quét Chứng Từ & Tự Động Định Giá Đa Bảng</span>
            </h2>
          </div>

          {ocrResult && (
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              <RefreshCw size={14} />
              <span>Quét Chứng Từ Khác</span>
            </button>
          )}
        </div>
      </div>

      {/* Main OCR Content */}
      <div className="space-y-6">
        {/* Upload Zone (Show when status === 'idle' or no result) */}
        {status === "idle" && !ocrResult && (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={clsx(
              "border-2 border-dashed rounded-3xl p-6 sm:p-12 text-center transition-all bg-white shadow-2xs cursor-pointer",
              isDragging ? "border-blue-500 bg-blue-50/50 scale-[1.01]" : "border-slate-300 hover:border-blue-400 hover:bg-slate-50/50"
            )}
          >
            <input
              type="file"
              id="ocr-file-upload"
              className="hidden"
              accept="image/*,application/pdf"
              onChange={handleFileInput}
            />
            <label htmlFor="ocr-file-upload" className="cursor-pointer space-y-4 block">
              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto shadow-2xs border border-blue-100">
                <Upload size={28} />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-slate-900">
                  Kéo thả Biên bản giao hàng, PXK hoặc Đơn hàng PO vào đây
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Hệ thống hỗ trợ tệp ảnh (PNG, JPG) và PDF. Trí tuệ nhân tạo Gemini sẽ tự động bóc tách số liệu, đối chiếu bảng giá 2026 và tính giá thành tức thì.
                </p>
              </div>
              <div className="pt-2">
                <span className="inline-flex items-center gap-2 px-4 py-2 bg-[#007AFF] hover:bg-blue-600 text-white rounded-xl text-xs font-bold shadow-sm transition">
                  <FileText size={14} />
                  <Camera size={15} />
                  <span>Chụp Ảnh / Chọn Tệp Chứng Từ</span>
                </span>
              </div>
            </label>
          </div>
        )}

        {/* Loading State */}
        {status === "uploading" && (
          <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center shadow-2xs space-y-4">
            <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-blue-100 animate-ping opacity-50" />
              <div className="w-14 h-14 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-md">
                <Loader2 size={26} className="animate-spin" />
              </div>
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900">Đang trích xuất văn bản & Đối chiếu Bảng Giá 2026...</h3>
              <p className="text-xs text-slate-500">Đang phân tích bảng biểu, mã sản phẩm và hợp đồng liên kết</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {status === "error" && (
          <div className="bg-rose-50 border border-rose-200 rounded-3xl p-6 text-rose-800 space-y-3 shadow-2xs">
            <div className="flex items-center gap-3">
              <AlertCircle size={24} className="text-rose-600 shrink-0" />
              <div>
                <h4 className="font-bold text-sm">Có lỗi xảy ra trong quá trình quét</h4>
                <p className="text-xs text-rose-700">{errorMessage}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition"
            >
              Thử lại với tệp khác
            </button>
          </div>
        )}

        {/* Results & Verification View */}
        {status === "success" && ocrResult && (
          <div className="space-y-6">
            {/* Drive Link Banner */}
            {savedDriveInfo && (
              <div className="bg-emerald-50/95 border border-emerald-200/90 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                      <CheckCircle size={22} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-emerald-950 flex items-center gap-2">
                        <span>Đã lưu & đồng bộ chứng từ:</span>
                        <span className="font-mono bg-white px-2 py-0.5 rounded border border-emerald-300 text-emerald-800 font-extrabold">{savedDriveInfo.documentNumber}</span>
                      </h4>
                      <p className="text-xs text-emerald-800 flex items-center gap-1.5 mt-1">
                        <span className="font-semibold">📂 Vị trí Google Drive:</span>
                        <code className="font-mono bg-white/80 px-2 py-0.5 rounded border border-emerald-200 text-emerald-900 text-[11px] font-bold">
                          {savedDriveInfo.folderPath || "TSG_Business_Documents / 2026"}
                        </code>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {savedDriveInfo.driveLink && (
                      <a
                        href={savedDriveInfo.driveLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer"
                      >
                        <ExternalLink size={14} />
                        <span>Xem Bản Scan Trên Drive</span>
                      </a>
                    )}
                    {savedDriveInfo.folderLink && (
                      <a
                        href={savedDriveInfo.folderLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer"
                      >
                        <HardDrive size={14} />
                        <span>Mở Thư Mục TSG_Business_Documents</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Document Details Card */}
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs overflow-hidden">
              <div className="bg-[#F5F5F7] px-6 py-4 border-b border-slate-200/80 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <MacTrafficLights />
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Thông Tin Chứng Từ Đã Bóc Tách
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold font-mono uppercase">
                    {ocrResult.documentType}
                  </span>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* 📁 SMART STANDARDIZED FILE NAME FOR GOOGLE DRIVE */}
                <div className="bg-gradient-to-r from-blue-50/80 via-indigo-50/50 to-emerald-50/70 p-4 rounded-2xl border border-blue-200/80 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-2xs shrink-0">
                        <HardDrive size={16} />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-900 tracking-tight flex items-center gap-2">
                          <span>Tên Tệp Lưu Trữ Google Drive (Chuẩn Hóa Khoa Học)</span>
                          <span className="text-[10px] font-mono px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full font-bold">Auto Renamed</span>
                        </span>
                        <span className="text-[11px] text-slate-500 block">
                          Định dạng: <code>[Loại_CT]_[Số_CT]_[Ngày]_[Khách_Hàng]_[Số_PO].[ext]</code>
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (ocrResult) {
                          const regenerated = generateSmartDocumentFileName({
                            documentType: ocrResult.documentType,
                            documentNumber: ocrResult.documentNumber,
                            documentDate: ocrResult.documentDate,
                            deliveryDate: ocrResult.deliveryDate,
                            documentReference: ocrResult.documentReference,
                            buyerName: ocrResult.buyerName,
                            originalFileName: file?.name || "document.pdf"
                          });
                          setCustomFileName(regenerated);
                          toast.success("Đã tạo lại tên file chuẩn hóa!");
                        }
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer self-start sm:self-auto"
                      title="Tạo lại tên file theo thông tin chứng từ hiện tại"
                    >
                      <RefreshCw size={13} />
                      <span>Tạo Lại Tên Chuẩn</span>
                    </button>
                  </div>

                  <div className="relative">
                    <input
                      type="text"
                      value={customFileName}
                      onChange={(e) => setCustomFileName(e.target.value)}
                      placeholder="Tên file chuẩn hóa..."
                      className="w-full pl-3.5 pr-28 py-2 bg-white border border-blue-300 rounded-xl text-xs font-mono font-bold text-blue-900 outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10.5px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      ☁️ Drive Name
                    </span>
                  </div>
                </div>
                {/* Meta Inputs Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-[10.5px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Loại Chứng Từ
                    </label>
                    <select
                      value={ocrResult.documentType}
                      onChange={(e) => handleMetaChange("documentType", e.target.value)}
                      className="w-full px-3 py-2 bg-[#F5F5F7] border border-slate-200/80 rounded-xl text-xs font-bold text-slate-800 outline-none"
                    >
                      <option value="PXK">PXK - Phiếu xuất kho / Biên bản giao hàng</option>
                      <option value="PO">PO - Đơn đặt hàng</option>
                      <option value="HD">Hợp đồng & Phụ lục</option>
                      <option value="INVOICE">Hóa đơn VAT</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10.5px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Số Chứng Từ / Số PXK
                    </label>
                    <input
                      type="text"
                      value={ocrResult.documentNumber || ""}
                      onChange={(e) => handleMetaChange("documentNumber", e.target.value)}
                      placeholder="VD: 26/PXK/16"
                      className="w-full px-3 py-2 bg-[#F5F5F7] border border-slate-200/80 rounded-xl text-xs font-bold font-mono text-slate-900 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10.5px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Số Đơn Hàng Liên Kết (Số PO)
                    </label>
                    <input
                      type="text"
                      value={ocrResult.documentReference || ""}
                      onChange={(e) => handleMetaChange("documentReference", e.target.value)}
                      placeholder="VD: 4/TS/26 hoặc 26/KHVT/0600"
                      className="w-full px-3 py-2 bg-[#F5F5F7] border border-slate-200/80 rounded-xl text-xs font-bold font-mono text-blue-700 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10.5px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Ngày Chứng Từ / Giao Hàng
                    </label>
                    <input
                      type="text"
                      value={ocrResult.deliveryDate || ocrResult.documentDate || ""}
                      onChange={(e) => {
                        handleMetaChange("deliveryDate", e.target.value);
                        handleMetaChange("documentDate", e.target.value);
                      }}
                      placeholder="VD: 28/04/2026"
                      className="w-full px-3 py-2 bg-[#F5F5F7] border border-slate-200/80 rounded-xl text-xs font-bold font-mono text-slate-900 outline-none"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[10.5px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Bên Nhận Hàng (Khách Hàng)
                    </label>
                    <input
                      type="text"
                      value={ocrResult.buyerName || ""}
                      onChange={(e) => handleMetaChange("buyerName", e.target.value)}
                      placeholder="VD: CÔNG TY TNHH MTV THUỐC LÁ THANH HÓA"
                      className="w-full px-3 py-2 bg-[#F5F5F7] border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-900 outline-none"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[10.5px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Bên Giao Hàng (Nhà Cung Cấp / Đại Diện)
                    </label>
                    <input
                      type="text"
                      value={ocrResult.sellerName || ""}
                      onChange={(e) => handleMetaChange("sellerName", e.target.value)}
                      placeholder="VD: CÔNG TY TNHH TM VÀ ĐT TẬP ĐOÀN TÂM SEN"
                      className="w-full px-3 py-2 bg-[#F5F5F7] border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-900 outline-none"
                    />
                  </div>
                </div>

                {/* Items/Goods Table Section */}
                <div className="pt-4 border-t border-slate-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                        <Package size={15} className="text-blue-600" />
                        <span>Danh Sách Hàng Hóa & Bảng Giá Liên Kết</span>
                      </h4>
                      <span className="text-[10.5px] text-slate-400 font-medium">({ocrResult.items.length} dòng hàng)</span>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      <Plus size={13} />
                      <span>Thêm Dòng Hàng</span>
                    </button>
                  </div>

                  {/* Items Table */}
                  <div className="border border-slate-200/80 rounded-2xl overflow-hidden bg-white shadow-2xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-[#F5F5F7] border-b border-slate-200/80 text-[10.5px] uppercase font-bold text-slate-600">
                            <th className="px-3.5 py-3.5 text-center w-12">STT</th>
                            <th className="px-3.5 py-3.5 min-w-[140px]">Mã SP</th>
                            <th className="px-4 py-3.5 min-w-[340px]">Tên Hàng Hóa</th>
                            <th className="px-3.5 py-3.5 min-w-[250px]">Bảng Giá & Hợp Đồng</th>
                            <th className="px-3.5 py-3.5 text-center w-20">ĐVT</th>
                            <th className="px-3.5 py-3.5 text-right w-28">Số Lượng</th>
                            <th className="px-3.5 py-3.5 text-right w-32">Đơn Giá Bán</th>
                            <th className="px-3.5 py-3.5 text-right w-32">Giá Vốn (COGS)</th>
                            <th className="px-4 py-3.5 text-right w-36">Doanh Thu</th>
                            <th className="px-4 py-3.5 text-right w-36">Lợi Nhuận</th>
                            <th className="px-2.5 py-3 text-center w-10"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {ocrResult.items.map((item, idx) => {
                            const isLinked = Boolean(item.priceCode);
                            const profit = (item.price - item.buyPrice) * item.quantity;

                            return (
                              <tr key={idx} className="hover:bg-[#FBFBFD] transition">
                                <td className="px-3 py-3 text-center font-mono text-slate-400">
                                  {idx + 1}
                                </td>

                                <td className="px-3 py-3">
                                  <input
                                    type="text"
                                    value={item.code || ""}
                                    onChange={(e) => handleItemChange(idx, "code", e.target.value)}
                                    placeholder="Mã SKU"
                                    className="w-full bg-[#F5F5F7] px-3 py-2 bg-[#F5F5F7] rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-400"
                                  />
                                </td>

                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="text"
                                      value={item.name || ""}
                                      onChange={(e) => handleItemChange(idx, "name", e.target.value)}
                                      placeholder="Nhập tên sản phẩm..."
                                      className="w-full bg-[#F5F5F7] px-3 py-2 bg-[#F5F5F7] rounded-xl text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-400"
                                    />
                                    <ProductHoverCard productName={item.name} productCode={item.code} pricingData={pricingData}>
                                      <div className="text-slate-300 hover:text-blue-500 transition cursor-pointer shrink-0">
                                        <HelpCircle size={14} />
                                      </div>
                                    </ProductHoverCard>
                                  </div>
                                </td>

                                {/* Smart Price & Contract Selector Button */}
                                <td className="px-3.5 py-3">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPriceSearchQuery(item.name || item.code || "");
                                      setActivePriceSelectIdx(idx);
                                    }}
                                    className={clsx(
                                      "px-3 py-2 rounded-xl text-xs font-bold transition flex items-center justify-between gap-1.5 w-full text-left cursor-pointer border shadow-2xs select-none",
                                      isLinked 
                                        ? "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100" 
                                        : "bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100"
                                    )}
                                    title="Bấm để mở bảng chọn giá và hợp đồng căn cứ"
                                  >
                                    <div className="flex items-center gap-1.5 truncate">
                                      <Tag size={13} className={isLinked ? "text-emerald-600" : "text-amber-600"} />
                                      <span className="font-bold">
                                        {item.priceCode ? item.priceCode : "Chọn Bảng Giá..."}
                                      </span>
                                      {item.contractNumber && (
                                        <span className="text-[11px] text-emerald-700 font-medium truncate">
                                          ({item.contractNumber})
                                        </span>
                                      )}
                                    </div>
                                    <ChevronDown size={14} className="text-slate-400 shrink-0" />
                                  </button>
                                </td>

                                <td className="px-2.5 py-3 text-center">
                                  <input
                                    type="text"
                                    value={item.unit || ""}
                                    onChange={(e) => handleItemChange(idx, "unit", e.target.value)}
                                    placeholder="ĐVT"
                                    className="w-full bg-[#F5F5F7] px-1 py-1 rounded-lg text-xs text-center font-semibold text-slate-700 outline-none"
                                  />
                                </td>

                                <td className="px-3 py-3 text-right">
                                  <input
                                    type="number"
                                    value={item.quantity || 0}
                                    onChange={(e) => handleItemChange(idx, "quantity", parseFloat(e.target.value) || 0)}
                                    className="w-full bg-[#F5F5F7] px-2 py-1 rounded-lg text-xs font-bold font-mono text-slate-900 text-right outline-none"
                                  />
                                </td>

                                <td className="px-3 py-3 text-right">
                                  <input
                                    type="number"
                                    value={item.price || 0}
                                    onChange={(e) => handleItemChange(idx, "price", parseFloat(e.target.value) || 0)}
                                    className="w-full bg-[#F5F5F7] px-2 py-1 rounded-lg text-xs font-bold font-mono text-emerald-700 text-right outline-none"
                                  />
                                </td>

                                <td className="px-3 py-3 text-right">
                                  <input
                                    type="number"
                                    value={item.buyPrice || 0}
                                    onChange={(e) => handleItemChange(idx, "buyPrice", parseFloat(e.target.value) || 0)}
                                    className="w-full bg-[#F5F5F7] px-2 py-1 rounded-lg text-xs font-bold font-mono text-amber-700 text-right outline-none"
                                  />
                                </td>

                                <td className="px-3 py-3 text-right font-mono font-bold text-blue-600 text-xs">
                                  {formatMoney(item.amount || (item.quantity * item.price))} đ
                                </td>

                                <td className="px-3 py-3 text-right font-mono font-bold text-emerald-600 text-xs">
                                  {formatMoney(profit)} đ
                                </td>

                                <td className="px-2.5 py-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveItem(idx)}
                                    className="p-1 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                    title="Xóa dòng này"
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

                  {/* Document Financials Bento Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 pt-2">
                    <div className="p-4 bg-blue-50/70 border border-blue-200/80 rounded-2xl space-y-1">
                      <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider flex items-center gap-1.5">
                        <DollarSign size={13} />
                        <span>Tổng Doanh Thu</span>
                      </span>
                      <div className="text-lg sm:text-xl font-bold font-mono text-blue-900 tabular-nums">
                        {formatMoney(documentFinancials.totalRevenue)} <span className="text-xs font-normal text-blue-600">đ</span>
                      </div>
                      <p className="text-[10px] text-blue-600">Tổng giá trị đơn / PXK</p>
                    </div>

                    <div className="p-4 bg-amber-50/70 border border-amber-200/80 rounded-2xl space-y-1">
                      <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Package size={13} />
                        <span>Tổng Giá Vốn (COGS)</span>
                      </span>
                      <div className="text-lg sm:text-xl font-bold font-mono text-amber-900 tabular-nums">
                        {formatMoney(documentFinancials.totalCOGS)} <span className="text-xs font-normal text-amber-600">đ</span>
                      </div>
                      <p className="text-[10px] text-amber-600">Chi phí nhập từ NCC</p>
                    </div>

                    <div className="p-4 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl space-y-1">
                      <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1.5">
                        <DollarSign size={13} />
                        <span>Lợi Nhuận Gộp</span>
                      </span>
                      <div className="text-lg sm:text-xl font-bold font-mono text-emerald-900 tabular-nums">
                        {formatMoney(documentFinancials.totalProfit)} <span className="text-xs font-normal text-emerald-600">đ</span>
                      </div>
                      <p className="text-[10px] text-emerald-600">Chênh lệch Bán - Mua</p>
                    </div>

                    <div className="p-4 bg-purple-50/70 border border-purple-200/80 rounded-2xl space-y-1">
                      <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Percent size={13} />
                        <span>Biên Lợi Nhuận TB</span>
                      </span>
                      <div className="text-lg sm:text-xl font-bold font-mono text-purple-900 tabular-nums">
                        {documentFinancials.avgMargin.toFixed(1)} <span className="text-xs font-normal text-purple-600">%</span>
                      </div>
                      <p className="text-[10px] text-purple-600">Hiệu suất tài chính</p>
                    </div>
                  </div>
                </div>

                {/* Signers Info */}
                {ocrResult.signers && (
                  <div className="pt-4 border-t border-slate-100 grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="block text-[10.5px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Người Lập Đơn / Chứng Từ
                      </span>
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
                        className="w-full bg-[#F5F5F7] border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 outline-none"
                      />
                    </div>
                    <div>
                      <span className="block text-[10.5px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Người Ký Duyệt / Đại Diện
                      </span>
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
                        className="w-full bg-[#F5F5F7] border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Action Toolbar */}
              <div className="px-6 py-4 border-t border-slate-200/80 bg-[#F5F5F7] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-5 py-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 transition cursor-pointer"
                >
                  Bỏ qua & Quét tệp khác
                </button>
                
                {isSaved ? (
                  <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs bg-emerald-100 border border-emerald-200 px-4 py-2.5 rounded-xl animate-in fade-in zoom-in-95">
                    <CheckCircle size={16} className="text-emerald-700" />
                    <span>Đã lưu thành công dữ liệu vào danh sách {ocrResult.documentType === 'PO' ? 'Đơn hàng' : 'Giao hàng (PXK)'} & Tự động liên kết các bảng!</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleSaveToSystem}
                    disabled={isSaving}
                    className="px-6 py-2.5 bg-[#007AFF] hover:bg-blue-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 size={15} className="animate-spin" />
                        <span>Đang lưu và liên kết dữ liệu...</span>
                      </>
                    ) : (
                      <>
                        <Save size={15} />
                        <span>Lưu Vào Hệ Thống ({ocrResult.documentType})</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && ocrResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <CheckCircle className="text-blue-600" size={20} />
                <span>Xác Nhận Nhập Dữ Liệu Đa Bảng</span>
              </h3>
              <button
                onClick={() => setShowConfirmModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-700">
              <p className="leading-relaxed">
                Hệ thống sẽ lưu dữ liệu bóc tách và tự động đồng bộ sang các bảng liên quan:
              </p>

              <div className="bg-[#F5F5F7] p-3.5 rounded-2xl space-y-2 border border-slate-200/60 font-medium">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Loại chứng từ:</span>
                  <span className="font-bold text-slate-900 uppercase">{ocrResult.documentType}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Số chứng từ:</span>
                  <span className="font-mono font-bold text-blue-700">{ocrResult.documentNumber || "Chưa có"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Số PO liên kết:</span>
                  <span className="font-mono font-bold text-slate-800">{ocrResult.documentReference || "Không có"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Số dòng hàng hóa:</span>
                  <span className="font-bold text-slate-900">{ocrResult.items.length} dòng</span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-200 pt-1.5">
                  <span className="text-slate-600 font-bold">Tổng doanh thu:</span>
                  <span className="font-mono font-bold text-emerald-700">{formatMoney(documentFinancials.totalRevenue)} đ</span>
                </div>
              </div>

              <div className="p-3 bg-blue-50 rounded-xl border border-blue-200/80 text-[11px] text-blue-800 space-y-1">
                <p className="font-bold">🔄 Tự động đồng bộ đa bảng:</p>
                <ul className="list-disc list-inside space-y-0.5 text-blue-700">
                  <li>Ghi nhận vào sổ Giao hàng / Đơn hàng</li>
                  <li>Cập nhật tiến độ giao và số lượng còn lại trong Chi tiết Đơn hàng (PO Lines)</li>
                  <li>Cập nhật trạng thái Kế hoạch giao hàng (Delivery Plans)</li>
                  <li>Lưu tệp chứng từ scan vào Thư mục Google Drive `TSG_Business_Documents`</li>
                </ul>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Kiểm tra lại
              </button>
              <button
                type="button"
                onClick={() => executeSaveToSystem()}
                className="px-5 py-2.5 bg-[#007AFF] hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition shadow-sm active:scale-95 cursor-pointer"
              >
                Xác Nhận & Lưu Toàn Bộ
              </button>
            </div>
          </div>
        </div>
      )}
    
      {/* 🌟 DEDICATED PRICE & CONTRACT SELECTOR MODAL */}
      {activePriceSelectIdx !== null && ocrResult && ocrResult.items[activePriceSelectIdx] && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div 
            ref={pricePopoverRef}
            className="bg-white rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150"
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Tag size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 tracking-tight">
                    Chọn Bảng Giá & Hợp Đồng Căn Cứ (2026)
                  </h3>
                  <p className="text-xs text-slate-500 truncate max-w-md">
                    Áp dụng cho dòng #{activePriceSelectIdx + 1}: <strong className="text-slate-800">{ocrResult.items[activePriceSelectIdx]?.name || ocrResult.items[activePriceSelectIdx]?.code || "Sản phẩm"}</strong>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActivePriceSelectIdx(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Search Input */}
            <div className="p-4 border-b border-slate-100 bg-slate-50/50">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  value={priceSearchQuery}
                  onChange={(e) => setPriceSearchQuery(e.target.value)}
                  placeholder="Tìm theo mã giá (Gsp_...), tên sản phẩm, khách hàng, số hợp đồng..."
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs outline-none focus:ring-2 focus:ring-blue-500 font-medium shadow-2xs"
                  autoFocus
                />
              </div>
            </div>

            {/* Pricing List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5 custom-scrollbar min-h-[300px] max-h-[55vh]">
              {filteredPricingOptions.length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <Tag size={32} className="mx-auto text-slate-300 stroke-[1.5]" />
                  <p className="text-xs">Không tìm thấy mức giá nào phù hợp với từ khóa tìm kiếm.</p>
                </div>
              ) : (
                filteredPricingOptions.slice(0, 50).map((p, pIdx) => {
                  const pCode = p['Mã giá bán'] || p['Mã giá'] || p['Mã sản phẩm'];
                  const pName = p['Tên sản phẩm'] || '';
                  const pCust = p['RP_Khách hàng'] || p['Khách hàng'] || 'Chung';
                  const pContract = p['Số hợp đồng'] || p['Hợp đồng căn cứ'] || '';
                  const sp = getSellPriceFromRecord(p);
                  const bp = getBuyPriceFromRecord(p);
                  const mg = sp > 0 ? (((sp - bp)/sp)*100).toFixed(1) : '0';
                  const isSelected = ocrResult.items[activePriceSelectIdx]?.priceCode === pCode;

                  return (
                    <div
                      key={pIdx}
                      onClick={() => {
                        handleSelectPricingForLine(activePriceSelectIdx, p);
                        setActivePriceSelectIdx(null);
                      }}
                      className={clsx(
                        "p-3.5 rounded-2xl border transition-all cursor-pointer space-y-2 hover:shadow-md select-none",
                        isSelected
                          ? "bg-blue-50/70 border-blue-300 ring-2 ring-blue-500/20"
                          : "bg-white border-slate-200/80 hover:border-blue-200 hover:bg-slate-50/60"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                            {pCode}
                          </span>
                          <span className="text-xs font-bold text-slate-900 truncate max-w-sm">
                            {pName}
                          </span>
                        </div>
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100 shrink-0">
                          Biên LN: {mg}%
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-slate-100 text-xs text-slate-600">
                        <div>
                          <span className="text-[10px] text-slate-400 block">Khách Hàng</span>
                          <strong className="text-slate-800 truncate block">{pCust}</strong>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">Hợp Đồng Căn Cứ</span>
                          <span className="text-slate-700 font-medium truncate block">{pContract || "---"}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">Đơn Giá Bán</span>
                          <strong className="text-blue-700">{sp.toLocaleString("vi-VN")} đ</strong>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">Giá Vốn (COGS)</span>
                          <strong className="text-amber-700">{bp.toLocaleString("vi-VN")} đ</strong>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
              <span>Tìm thấy <strong>{filteredPricingOptions.length}</strong> kết quả bảng giá 2026</span>
              <button
                type="button"
                onClick={() => setActivePriceSelectIdx(null)}
                className="px-4 py-1.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 hover:bg-slate-100 transition shadow-2xs"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
