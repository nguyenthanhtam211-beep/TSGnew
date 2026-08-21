import React, { useState, useMemo } from "react";
import { motion } from "motion/react";
import { 
  ShoppingCart, FileText, Calendar, Truck, CheckSquare, BarChart3, 
  ArrowRight, Plus, CheckCircle, AlertTriangle, AlertCircle, 
  TrendingUp, DollarSign, Download, Users, Package, RefreshCw, ChevronRight, Calculator, Check, FileSpreadsheet,
  Camera, Upload, Sparkles, ShieldCheck, Eye, Layers, Loader2, Award, Info, Trash2, Search, CheckCheck, CalendarDays, CalendarRange, Clock, ExternalLink, ChevronLeft, Share2
} from "lucide-react";
import { db } from "../firebase";
import { collection, addDoc, doc, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { toast } from "react-hot-toast";
import * as XLSX from "xlsx";
import { PriceReconciliationPanel } from "./PriceReconciliationPanel";
import { DualPODocumentModal } from "./DualPODocumentModal";
import { findPriceRecord, parseNumber, getSupplierShortCode, getDefaultSpecs } from "../lib/business-logic";
import { exportGenericTableToPDF, formatVND } from "../lib/pdf-exporter";
import { processDocumentOCR } from "../lib/gemini";

interface WorkflowViewProps {
  pricingData: any[];
  poHeaderData: any[];
  poLinesData: any[];
  deliveryData: any[];
  customerData: any[];
  supplierData: any[];
  productData: any[];
  deliveryPlanData: any[];
}

export default function WorkflowView({
  pricingData,
  poHeaderData,
  poLinesData,
  deliveryData,
  customerData,
  supplierData,
  productData,
  deliveryPlanData
}: WorkflowViewProps) {
  const [activeStep, setActiveStep] = useState<number>(1);

  // States for Step 1 (Sourcing Calculator)
  const [calcCustomer, setCalcCustomer] = useState("");
  const [calcProduct, setCalcProduct] = useState("");
  const [calcQty, setCalcQty] = useState<number>(100);

  // States for Step 2 (PO Creation & Smart OCR & Dual PO)
  const [creationMode, setCreationMode] = useState<"ocr" | "manual">("ocr");
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [isPOApproved, setIsPOApproved] = useState(true);
  const [showDualPOModal, setShowDualPOModal] = useState(false);

  const [newPoNumber, setNewPoNumber] = useState("");
  const [poCustomer, setPoCustomer] = useState("");
  const [poType, setPoType] = useState("Đơn hàng thường xuyên");
  const [poDate, setPoDate] = useState(new Date().toISOString().split("T")[0]);
  const [poLines, setPoLines] = useState<any[]>([]);
  // Individual line states
  const [selectedProductCode, setSelectedProductCode] = useState("");
  const [lineQty, setLineQty] = useState<number>(100);

  // Optimistic tracking states for fast UI transitions
  const [createdPoHeaders, setCreatedPoHeaders] = useState<any[]>([]);
  const [createdPoLines, setCreatedPoLines] = useState<any[]>([]);
  const [createdPlans, setCreatedPlans] = useState<any[]>([]);
  const [createdDeliveries, setCreatedDeliveries] = useState<any[]>([]);

  // Clean object helper to ensure Firestore never receives `undefined`
  const cleanObject = (obj: any) => {
    const cleaned: any = {};
    if (!obj || typeof obj !== "object") return cleaned;
    Object.keys(obj).forEach(key => {
      cleaned[key] = obj[key] !== undefined ? obj[key] : "";
    });
    return cleaned;
  };

  // Combined Data combining real-time Firestore props + optimistic local updates
  const combinedPoLinesData = useMemo(() => {
    const map = new Map();
    (poLinesData || []).forEach(item => {
      const key = item["STT"] || item.id;
      if (key) map.set(key, item);
    });
    createdPoLines.forEach(item => {
      const key = item["STT"] || item.id;
      if (key) map.set(key, item);
    });
    return Array.from(map.values());
  }, [poLinesData, createdPoLines]);

  const combinedDeliveryPlanData = useMemo(() => {
    const map = new Map();
    (deliveryPlanData || []).forEach(item => {
      const key = item["Kế hoạch ID"] || item.id;
      if (key) map.set(key, item);
    });
    createdPlans.forEach(item => {
      const key = item["Kế hoạch ID"] || item.id;
      if (key) map.set(key, item);
    });
    return Array.from(map.values());
  }, [deliveryPlanData, createdPlans]);

  const combinedDeliveryData = useMemo(() => {
    const map = new Map();
    (deliveryData || []).forEach(item => {
      const key = item.id || item["STT"];
      if (key) map.set(key, item);
    });
    createdDeliveries.forEach(item => {
      const key = item.id || item["STT"];
      if (key) map.set(key, item);
    });
    return Array.from(map.values());
  }, [deliveryData, createdDeliveries]);

  // Combined PO Headers for Step 2 Approval: Prioritize new created orders at top
  const combinedPoHeadersData = useMemo(() => {
    const map = new Map();
    // 1. Newly created headers first
    createdPoHeaders.forEach(item => {
      const key = String(item.id || item["Đơn hàng"] || "").trim();
      if (key) map.set(key, item);
    });
    // 2. Existing headers from props
    (poHeaderData || []).forEach(item => {
      const key = String(item.id || item["Đơn hàng"] || "").trim();
      if (key && !map.has(key)) map.set(key, item);
    });
    return Array.from(map.values());
  }, [poHeaderData, createdPoHeaders]);

  // States for Step 2 (Phê duyệt & Khóa đơn)
  const [selectedPoForApproval, setSelectedPoForApproval] = useState<string>("");
  const [approvalFilter, setApprovalFilter] = useState<"pending" | "approved" | "all">("pending");
  const [approvalSearch, setApprovalSearch] = useState("");

  const currentPoForApproval = useMemo(() => {
    if (selectedPoForApproval) {
      const selNorm = String(selectedPoForApproval).trim().toLowerCase().replace(/\//g, "-");
      const found = combinedPoHeadersData.find(h => {
        const hId = String(h.id || "").trim().toLowerCase().replace(/\//g, "-");
        const hPo = String(h["Đơn hàng"] || "").trim().toLowerCase().replace(/\//g, "-");
        return hId === selNorm || hPo === selNorm;
      });
      if (found) return found;
    }
    // Default to the first pending / newest order
    const pending = combinedPoHeadersData.find(h => !h["Trạng Thái"]?.includes("Đã phê duyệt") && !h["Trạng Thái"]?.includes("Đang sản xuất") && !h["Trạng Thái"]?.includes("Hoàn thành"));
    return pending || combinedPoHeadersData[0] || null;
  }, [combinedPoHeadersData, selectedPoForApproval]);

  const currentPoLinesForApproval = useMemo(() => {
    if (!currentPoForApproval) return [];
    const poNum = String(currentPoForApproval["Đơn hàng"] || currentPoForApproval.id || "").trim().toLowerCase();
    const poNumNorm = poNum.replace(/\//g, "-");

    const matched = combinedPoLinesData.filter(l => !l.isDeleted && (
      String(l["Số đơn hàng"] || l["Đơn hàng"] || "").trim().toLowerCase() === poNum ||
      String(l["Số đơn hàng"] || l["Đơn hàng"] || "").trim().toLowerCase().replace(/\//g, "-") === poNumNorm ||
      String(l["STT"] || l.id || "").toLowerCase().includes(poNumNorm)
    ));

    // Fallback: If no lines matched directly by PO number, search by product associations
    if (matched.length === 0 && currentPoForApproval["Chi tiết đơn hàng"]) {
      const detailsList = String(currentPoForApproval["Chi tiết đơn hàng"]).split(",").map(s => s.trim().toLowerCase());
      return combinedPoLinesData.filter(l => detailsList.includes(String(l["STT"] || l.id || "").toLowerCase()));
    }

    return matched;
  }, [combinedPoLinesData, currentPoForApproval]);

  const [planningPoLine, setPlanningPoLine] = useState<any | null>(null);
  const [plannedQty, setPlannedQty] = useState<number>(0);
  const [plannedDate, setPlannedDate] = useState(new Date().toISOString().split("T")[0]);
  const [planNotes, setPlanNotes] = useState("");
  const [step3ViewMode, setStep3ViewMode] = useState<"weekly" | "list">("weekly");
  const [selectedWeekOffset, setSelectedWeekOffset] = useState<number>(0);

  // States for Step 4 (Giao hàng & BBBG)
  const [selectedPlan, setSelectedPlan] = useState<any | null>(null);
  const [pxkNumber, setPxkNumber] = useState("");
  const [bbbgNumber, setBbbgNumber] = useState("");
  const [receiverSigner, setReceiverSigner] = useState("");
  const [deliveredQty, setDeliveredQty] = useState<number>(0);
  const [actualDate, setActualDate] = useState(new Date().toISOString().split("T")[0]);
  const [carrier, setCarrier] = useState("");
  const [hasIncident, setHasIncident] = useState(false);
  const [incidentDetail, setIncidentDetail] = useState("");

  // Filter for Step 5 & Step 6
  const [reconcileFilter, setReconcileFilter] = useState("all");
  const [accountingFilter, setAccountingFilter] = useState("all");
  const [vatRate, setVatRate] = useState<number>(8); // Default VAT 8%

  const formatCurrency = (value: any) => {
    const num = parseNumber(value);
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(isNaN(num) ? 0 : num);
  };

  // Customer matching helper for Sourcing & Pricing catalog
  const matchCustomerWithPricing = (customerVal: string, pricingList: any[]): any[] => {
    if (!customerVal) return pricingList;
    const custNorm = customerVal.toLowerCase().trim();

    // 1. Exact match
    let matched = pricingList.filter(p => {
      const rCust = (p["RP_Khách hàng"] || "").toLowerCase().trim();
      const gCust = (p["Giao đến"] || "").toLowerCase().trim();
      const kCust = (p["Khách hàng"] || "").toLowerCase().trim();
      return rCust === custNorm || gCust === custNorm || kCust === custNorm;
    });
    if (matched.length > 0) return matched;

    // 2. Keyword check for well-known customers
    const keyAliases: Record<string, string[]> = {
      "thăng long": ["thăng long", "thang long", "tltl"],
      "thanh hóa": ["thanh hóa", "thanh hoá", "thanh hoa", "tlth"],
      "bắc sơn": ["bắc sơn", "bac son", "tlbs"],
      "sài gòn": ["sài gòn", "sai gon", "tlsg"],
      "bến tre": ["bến tre", "ben tre"],
      "ngân sơn": ["ngân sơn", "ngan son"],
      "viện thuốc lá": ["viện thuốc lá", "vien thuoc la"],
      "diageo": ["diageo"],
      "tân á": ["tân á", "tan a"]
    };

    for (const [_, aliases] of Object.entries(keyAliases)) {
      const matchCust = aliases.some(alias => custNorm.includes(alias));
      if (matchCust) {
        matched = pricingList.filter(p => {
          const rCust = (p["RP_Khách hàng"] || "").toLowerCase().trim();
          const gCust = (p["Giao đến"] || "").toLowerCase().trim();
          const kCust = (p["Khách hàng"] || "").toLowerCase().trim();
          return aliases.some(alias => rCust.includes(alias) || gCust.includes(alias) || kCust.includes(alias));
        });
        if (matched.length > 0) return matched;
      }
    }

    // 3. Substring match
    matched = pricingList.filter(p => {
      const rCust = (p["RP_Khách hàng"] || "").toLowerCase().trim();
      const gCust = (p["Giao đến"] || "").toLowerCase().trim();
      return (rCust && (custNorm.includes(rCust) || rCust.includes(custNorm))) ||
             (gCust && (custNorm.includes(gCust) || gCust.includes(custNorm)));
    });

    return matched.length > 0 ? matched : pricingList;
  };

  // Filtered pricing catalog for selected customer
  const customerPricingOptions = useMemo(() => {
    if (!poCustomer) return [];
    return matchCustomerWithPricing(poCustomer, pricingData);
  }, [pricingData, poCustomer]);

  // Filtered PO Headers list for Step 2
  const filteredPoHeadersForApproval = useMemo(() => {
    let list = combinedPoHeadersData;

    // Filter by tab
    if (approvalFilter === "pending") {
      list = list.filter(h => !h["Trạng Thái"]?.includes("Đã phê duyệt") && !h["Trạng Thái"]?.includes("Đang sản xuất") && !h["Trạng Thái"]?.includes("Hoàn thành"));
    } else if (approvalFilter === "approved") {
      list = list.filter(h => h["Trạng Thái"]?.includes("Đã phê duyệt") || h["Trạng Thái"]?.includes("Đang sản xuất") || h["Trạng Thái"]?.includes("Hoàn thành"));
    }

    // Filter by search query
    if (approvalSearch.trim()) {
      const q = approvalSearch.toLowerCase().trim();
      list = list.filter(h => 
        String(h["Đơn hàng"] || "").toLowerCase().includes(q) ||
        String(h["Khách hàng"] || "").toLowerCase().includes(q) ||
        String(h.id || "").toLowerCase().includes(q)
      );
    }

    return list;
  }, [combinedPoHeadersData, approvalFilter, approvalSearch]);

  const pendingApprovalCount = useMemo(() => {
    return combinedPoHeadersData.filter(h => !h["Trạng Thái"]?.includes("Đã phê duyệt") && !h["Trạng Thái"]?.includes("Đang sản xuất") && !h["Trạng Thái"]?.includes("Hoàn thành")).length;
  }, [combinedPoHeadersData]);

  const approvedCount = useMemo(() => {
    return combinedPoHeadersData.filter(h => h["Trạng Thái"]?.includes("Đã phê duyệt") || h["Trạng Thái"]?.includes("Đang sản xuất") || h["Trạng Thái"]?.includes("Hoàn thành")).length;
  }, [combinedPoHeadersData]);

  const handleLoadSamplePO = (sampleType: 'ThangLong' | 'ThanhHoa' | 'BacSon') => {
    if (sampleType === 'ThangLong') {
      const cust = "Thăng Long";
      setPoCustomer(cust);
      setNewPoNumber("26/KHVT/0615");
      setPoDate(new Date().toISOString().split("T")[0]);

      const rawItems = [
        { code: "TH130/07", name: "Thùng carton Vỏ bao Thăng Long", unit: "Thùng", quantity: 50000, poPrice: 0, deliveryDate: "15/08/2026" },
        { code: "TH25/07", name: "Thùng carton Bao cứng Thăng Long", unit: "Thùng", quantity: 30000, poPrice: 2500, deliveryDate: "20/08/2026" },
        { code: "TH211/05", name: "Vỏ hộp Thuốc lá Thăng Long 20", unit: "Hộp", quantity: 100000, poPrice: 1800, deliveryDate: "25/08/2026" },
      ];

      const lines = rawItems.map(item => {
        const priceRecord = findPriceRecord(pricingData, { sku: item.code || item.name, customer: cust });
        const masterSell = priceRecord ? (parseNumber(priceRecord['Giá bán']) || parseNumber(priceRecord['Đơn giá bán']) || parseNumber(priceRecord['Đơn giá bán mới'])) : 2700;
        const masterBuy = priceRecord ? (parseNumber(priceRecord['Giá nhập']) || parseNumber(priceRecord['Đơn giá mua'])) : 2100;
        const effSell = item.poPrice > 0 ? item.poPrice : masterSell;

        return {
          id: `ocr-${Date.now()}-${Math.random()}`,
          code: item.code,
          "Mã sản phẩm": item.code,
          "Tên sản phẩm": item.name,
          "ĐVT": item.unit,
          "Số lượng": item.quantity,
          deliveryDate: item.deliveryDate,
          poPrice: item.poPrice,
          effectivePrice: effSell,
          buyPrice: masterBuy,
          "Đơn giá bán": effSell,
          "Đơn giá nhập": masterBuy,
          priceCode: priceRecord ? (priceRecord['Mã giá'] || priceRecord['Mã giá bán']) : "Gsp_082",
          masterProductCode: priceRecord ? priceRecord['Mã sản phẩm'] : item.code,
          masterProductName: priceRecord ? priceRecord['Tên sản phẩm'] : item.name,
          supplier: priceRecord ? (priceRecord['RP_Nhà cung cấp'] || priceRecord['Nhà cung cấp']) : "Tâm Sen",
          "Thành tiền dòng": effSell * item.quantity
        };
      });

      setPoLines(lines);
      toast.success("Đã tải mẫu PO Thuốc lá Thăng Long! Dữ liệu sẵn sàng để gắn giá Bảng giá 2026.");
    } else if (sampleType === 'ThanhHoa') {
      const cust = "Thanh Hoá";
      setPoCustomer(cust);
      setNewPoNumber("05/TS/26");
      setPoDate(new Date().toISOString().split("T")[0]);

      const rawItems = [
        { code: "LGTTS-002-95", name: "Nhãn bao Thuốc lá Thanh Hóa", unit: "Tờ", quantity: 120000, poPrice: 0, deliveryDate: "18/08/2026" },
        { code: "TH25/07", name: "Thùng carton Thanh Hóa", unit: "Thùng", quantity: 25000, poPrice: 2700, deliveryDate: "22/08/2026" },
      ];

      const lines = rawItems.map(item => {
        const priceRecord = findPriceRecord(pricingData, { sku: item.code || item.name, customer: cust });
        const masterSell = priceRecord ? (parseNumber(priceRecord['Giá bán']) || parseNumber(priceRecord['Đơn giá bán']) || parseNumber(priceRecord['Đơn giá bán mới'])) : 2700;
        const masterBuy = priceRecord ? (parseNumber(priceRecord['Giá nhập']) || parseNumber(priceRecord['Đơn giá mua'])) : 2100;
        const effSell = item.poPrice > 0 ? item.poPrice : masterSell;

        return {
          id: `ocr-${Date.now()}-${Math.random()}`,
          code: item.code,
          "Mã sản phẩm": item.code,
          "Tên sản phẩm": item.name,
          "ĐVT": item.unit,
          "Số lượng": item.quantity,
          deliveryDate: item.deliveryDate,
          poPrice: item.poPrice,
          effectivePrice: effSell,
          buyPrice: masterBuy,
          "Đơn giá bán": effSell,
          "Đơn giá nhập": masterBuy,
          priceCode: priceRecord ? (priceRecord['Mã giá'] || priceRecord['Mã giá bán']) : "Gsp_123",
          masterProductCode: priceRecord ? priceRecord['Mã sản phẩm'] : item.code,
          masterProductName: priceRecord ? priceRecord['Tên sản phẩm'] : item.name,
          supplier: priceRecord ? (priceRecord['RP_Nhà cung cấp'] || priceRecord['Nhà cung cấp']) : "Tâm Sen",
          "Thành tiền dòng": effSell * item.quantity
        };
      });

      setPoLines(lines);
      toast.success("Đã tải mẫu PO Thuốc lá Thanh Hóa! Vui lòng chọn sản phẩm trong Bảng giá 2026.");
    } else if (sampleType === 'BacSon') {
      const cust = "Bắc Sơn";
      setPoCustomer(cust);
      setNewPoNumber("151a/TLBS");
      setPoDate(new Date().toISOString().split("T")[0]);

      const rawItems = [
        { code: "TSBS-0011-00", name: "Bao bì Cây Thuốc Bắc Sơn", unit: "Cái", quantity: 40000, poPrice: 3200, deliveryDate: "16/08/2026" },
        { code: "C5-15", name: "Thùng Carton Bắc Sơn C5", unit: "Thùng", quantity: 15000, poPrice: 0, deliveryDate: "28/08/2026" },
      ];

      const lines = rawItems.map(item => {
        const priceRecord = findPriceRecord(pricingData, { sku: item.code || item.name, customer: cust });
        const masterSell = priceRecord ? (parseNumber(priceRecord['Giá bán']) || parseNumber(priceRecord['Đơn giá bán']) || parseNumber(priceRecord['Đơn giá bán mới'])) : 3200;
        const masterBuy = priceRecord ? (parseNumber(priceRecord['Giá nhập']) || parseNumber(priceRecord['Đơn giá mua'])) : 2500;
        const effSell = item.poPrice > 0 ? item.poPrice : masterSell;

        return {
          id: `ocr-${Date.now()}-${Math.random()}`,
          code: item.code,
          "Mã sản phẩm": item.code,
          "Tên sản phẩm": item.name,
          "ĐVT": item.unit,
          "Số lượng": item.quantity,
          deliveryDate: item.deliveryDate,
          poPrice: item.poPrice,
          effectivePrice: effSell,
          buyPrice: masterBuy,
          "Đơn giá bán": effSell,
          "Đơn giá nhập": masterBuy,
          priceCode: priceRecord ? (priceRecord['Mã giá'] || priceRecord['Mã giá bán']) : "Gsp_085",
          masterProductCode: priceRecord ? priceRecord['Mã sản phẩm'] : item.code,
          masterProductName: priceRecord ? priceRecord['Tên sản phẩm'] : item.name,
          supplier: priceRecord ? (priceRecord['RP_Nhà cung cấp'] || priceRecord['Nhà cung cấp']) : "Tâm Sen",
          "Thành tiền dòng": effSell * item.quantity
        };
      });

      setPoLines(lines);
      toast.success("Đã tải mẫu PO Thuốc lá Bắc Sơn! Vui lòng chọn sản phẩm trong Bảng giá 2026.");
    }
  };

  const handleOCRUploadInWorkflow = async (file: File) => {
    setIsOcrProcessing(true);
    const toastId = toast.loading("Gemini AI đang bóc tách chi tiết PO...");
    try {
      const ocrData = await processDocumentOCR(file);

      let cust = "Thăng Long";
      const lowerBuyer = (ocrData.buyerName || "").toLowerCase();
      if (lowerBuyer.includes("thanh hóa") || lowerBuyer.includes("thanh hoá")) cust = "Thanh Hoá";
      else if (lowerBuyer.includes("bắc sơn")) cust = "Bắc Sơn";
      else if (lowerBuyer.includes("ngân sơn")) cust = "Ngân Sơn";
      else if (lowerBuyer.includes("sài gòn")) cust = "Sài Gòn";
      else if (lowerBuyer.includes("bến tre")) cust = "Bến Tre";
      else if (lowerBuyer.includes("thăng long")) cust = "Thăng Long";

      setPoCustomer(cust);
      setNewPoNumber(ocrData.documentNumber || `PO-${Date.now()}`);
      if (ocrData.documentDate) {
        setPoDate(ocrData.documentDate);
      }

      const lines = (ocrData.items || []).map((item: any) => {
        const priceRecord = findPriceRecord(pricingData, { sku: item.code, name: item.name, customer: cust });
        const masterSell = priceRecord ? (parseNumber(priceRecord['Giá bán']) || parseNumber(priceRecord['Đơn giá bán']) || parseNumber(priceRecord['Đơn giá bán mới'])) : 0;
        const masterBuy = priceRecord ? (parseNumber(priceRecord['Giá nhập']) || parseNumber(priceRecord['Đơn giá mua'])) : 0;
        const poPrice = item.price || 0;
        const effSell = poPrice > 0 ? poPrice : masterSell;

        return {
          id: `ocr-${Date.now()}-${Math.random()}`,
          code: item.code || (priceRecord ? priceRecord['Mã sản phẩm'] : ""),
          name: item.name || (priceRecord ? priceRecord['Tên sản phẩm'] : ""),
          "Mã sản phẩm": item.code || (priceRecord ? priceRecord['Mã sản phẩm'] : ""),
          "Tên sản phẩm": item.name || (priceRecord ? priceRecord['Tên sản phẩm'] : ""),
          "ĐVT": item.unit || (priceRecord ? priceRecord['ĐVT'] : "Cái"),
          "Số lượng": item.quantity || 1,
          deliveryDate: item.deliveryDate || ocrData.deliveryDate || poDate.split("-").reverse().join("/"),
          poPrice: poPrice,
          effectivePrice: effSell,
          buyPrice: masterBuy,
          "Đơn giá bán": effSell,
          "Đơn giá nhập": masterBuy,
          priceCode: priceRecord ? (priceRecord['Mã giá'] || priceRecord['Mã giá bán']) : "Gsp_N/A",
          masterProductCode: priceRecord ? priceRecord['Mã sản phẩm'] : "",
          masterProductName: priceRecord ? priceRecord['Tên sản phẩm'] : "",
          supplier: priceRecord ? (priceRecord['RP_Nhà cung cấp'] || priceRecord['Nhà cung cấp']) : "Tâm Sen",
          "Thành tiền dòng": effSell * (item.quantity || 1)
        };
      });

      setPoLines(lines);
      toast.success("Đã trích xuất thành công " + lines.length + " mặt hàng từ PO! Vui lòng chọn gắn Bảng Giá 2026.", { id: toastId });
    } catch (err: any) {
      console.error(err);
      let msg = err?.message;
      if (!msg || msg.includes("Failed to fetch") || err?.name === "TypeError") {
        msg = "Không thể kết nối đến máy chủ OCR. Vui lòng kiểm tra lại mạng hoặc thử mở ứng dụng trong tab mới.";
      }
      toast.error(msg, { id: toastId });
    } finally {
      setIsOcrProcessing(false);
    }
  };

  const handleItemChangeInReconciliation = (index: number, updatedItem: any) => {
    const newLines = poLines.map((line, i) => {
      if (i === index) {
        const qty = updatedItem.quantity !== undefined ? parseNumber(updatedItem.quantity) : parseNumber(line["Số lượng"] || line.quantity || 1);
        const sell = updatedItem.effectivePrice !== undefined ? parseNumber(updatedItem.effectivePrice) : (parseNumber(updatedItem["Đơn giá bán"]) || parseNumber(line.effectivePrice || 0));
        const buy = updatedItem.buyPrice !== undefined ? parseNumber(updatedItem.buyPrice) : (parseNumber(updatedItem["Đơn giá nhập"]) || parseNumber(line.buyPrice || 0));
        const code = updatedItem.masterProductCode || updatedItem.code || line.code || line["Mã sản phẩm"];
        const name = updatedItem.masterProductName || updatedItem.name || line.name || line["Tên sản phẩm"];
        const unit = updatedItem.unit || line.unit || line["ĐVT"] || "Cái";

        return {
          ...line,
          ...updatedItem,
          code: code,
          name: name,
          unit: unit,
          quantity: qty,
          effectivePrice: sell,
          buyPrice: buy,
          "Mã sản phẩm": code,
          "Tên sản phẩm": name,
          "ĐVT": unit,
          "Số lượng": qty,
          "Đơn giá bán": sell,
          "Đơn giá nhập": buy,
          "Thành tiền dòng": sell * qty
        };
      }
      return line;
    });
    setPoLines(newLines);
  };

  const handleApplyAllMasterPrices = () => {
    const newLines = poLines.map(line => {
      const priceRecord = findPriceRecord(pricingData, { 
        sku: line.code || line["Mã sản phẩm"], 
        name: line.name || line["Tên sản phẩm"], 
        customer: poCustomer 
      });
      const masterSell = priceRecord ? (parseNumber(priceRecord['Giá bán']) || parseNumber(priceRecord['Đơn giá bán']) || parseNumber(priceRecord['Đơn giá bán mới'])) : (line.effectivePrice || 0);
      const masterBuy = priceRecord ? (parseNumber(priceRecord['Giá nhập']) || parseNumber(priceRecord['Đơn giá mua'])) : (line.buyPrice || 0);
      const prodCode = priceRecord ? priceRecord['Mã sản phẩm'] : (line.masterProductCode || line.code);
      const prodName = priceRecord ? priceRecord['Tên sản phẩm'] : (line.masterProductName || line.name);
      const qty = parseNumber(line["Số lượng"] || line.quantity || 1);

      const specs = line.specs || priceRecord?.['Quy cách'] || priceRecord?.['Quy cách kỹ thuật'] || getDefaultSpecs(prodName, prodCode, line["ĐVT"] || "Cái");

      return {
        ...line,
        code: prodCode,
        name: prodName,
        specs: specs,
        "Quy cách": specs,
        "Quy cách kỹ thuật": specs,
        effectivePrice: masterSell,
        buyPrice: masterBuy,
        "Mã sản phẩm": prodCode,
        "Tên sản phẩm": prodName,
        "Đơn giá bán": masterSell,
        "Đơn giá nhập": masterBuy,
        masterProductCode: prodCode,
        masterProductName: prodName,
        priceCode: priceRecord ? (priceRecord['Mã giá'] || priceRecord['Mã giá bán']) : line.priceCode,
        supplier: priceRecord ? (priceRecord['RP_Nhà cung cấp'] || priceRecord['Nhà cung cấp']) : (line.supplier || "Tâm Sen"),
        "Thành tiền dòng": masterSell * qty
      };
    });
    setPoLines(newLines);
    toast.success("Đã tự động áp dụng Đơn giá bán từ Bảng giá 2026 cho toàn bộ sản phẩm!");
  };

  const handleAddPOLine = () => {
    if (!selectedProductCode) {
      toast.error("Vui lòng chọn sản phẩm!");
      return;
    }
    const priceRec = pricingData.find(p => p["Mã sản phẩm"] === selectedProductCode && (!poCustomer || p["RP_Khách hàng"] === poCustomer)) 
      || pricingData.find(p => p["Mã sản phẩm"] === selectedProductCode);
    if (!priceRec) {
      toast.error("Không tìm thấy giá cho sản phẩm đã chọn!");
      return;
    }
    const sellPrice = parseNumber(priceRec["Đơn giá bán"] || priceRec["Đơn giá bán mới"] || priceRec["Giá bán"]);
    const buyPrice = parseNumber(priceRec["Đơn giá mua"] || priceRec["Giá nhập"] || priceRec["Giá vốn"]);
    const qty = Math.max(1, parseNumber(lineQty) || 1);
    const lineTotal = sellPrice * qty;
    const prodName = priceRec["Tên sản phẩm"] || selectedProductCode;
    const prodCode = priceRec["Mã sản phẩm"] || selectedProductCode;
    const prodUnit = priceRec["ĐVT"] || "Cái";
    const pCode = priceRec["Mã giá bán"] || priceRec["Mã giá"] || "Gsp_082";
    const supplier = priceRec["RP_Nhà cung cấp"] || priceRec["Nhà cung cấp"] || "Tâm Sen";

    const rawSpecs = priceRec["Quy cách"] || priceRec["Quy cách kỹ thuật"] || priceRec["Thông số kỹ thuật"] || getDefaultSpecs(prodName, prodCode, prodUnit);

    const newLine = {
      id: `manual-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      code: prodCode,
      name: prodName,
      unit: prodUnit,
      specs: rawSpecs,
      quantity: qty,
      poPrice: sellPrice,
      effectivePrice: sellPrice,
      buyPrice: buyPrice,
      priceCode: pCode,
      masterProductCode: prodCode,
      masterProductName: prodName,
      supplier: supplier,
      deliveryDate: poDate ? poDate.split("-").reverse().join("/") : new Date().toLocaleDateString("vi-VN"),
      // Vietnamese keys for backward compatibility
      "Mã sản phẩm": prodCode,
      "Tên sản phẩm": prodName,
      "ĐVT": prodUnit,
      "Quy cách": rawSpecs,
      "Quy cách kỹ thuật": rawSpecs,
      "Số lượng": qty,
      "Đơn giá bán": sellPrice,
      "Đơn giá nhập": buyPrice,
      "Thành tiền dòng": lineTotal
    };

    setPoLines(prev => [...prev, newLine]);
    setSelectedProductCode("");
    toast.success(`Đã thêm ${qty.toLocaleString('vi-VN')} ${prodUnit} [${prodCode}] ${prodName} vào đơn!`);
  };

  const handleRemovePOLine = (lineId: string) => {
    setPoLines(poLines.filter(l => l.id !== lineId));
  };

  const totalPoValue = useMemo(() => {
    return poLines.reduce((sum, line) => {
      const eff = line.effectivePrice !== undefined ? line.effectivePrice : parseNumber(line["Đơn giá bán"]);
      const qty = parseNumber(line["Số lượng"]);
      return sum + (eff * qty);
    }, 0);
  }, [poLines]);

  const handleSavePO = async () => {
    if (!newPoNumber.trim()) {
      toast.error("Vui lòng điền Số đơn hàng (PO)!");
      return;
    }
    if (!poCustomer) {
      toast.error("Vui lòng chọn khách hàng!");
      return;
    }
    if (poLines.length === 0) {
      toast.error("Vui lòng thêm ít nhất một dòng sản phẩm!");
      return;
    }

    const loadToast = toast.loading("Đang lưu Đơn hàng (PO)...");
    try {
      const headerId = newPoNumber.replace(/\//g, "-").trim();
      const formattedDate = poDate ? poDate.split("-").reverse().join("/") : new Date().toLocaleDateString("vi-VN");
      
      const poHeaderPayload = {
        "id": headerId,
        "Đơn hàng": newPoNumber.trim(),
        "Ngày đặt hàng": formattedDate,
        "Khách hàng": poCustomer,
        "Phân loại": poType || "Đơn hàng thường xuyên",
        "Trạng Thái": "Mới nhận",
        "Chi tiết đơn hàng": poLines.map((_, i) => `D_${headerId}_${i + 1}`).join(","),
        "Tổng giá trị đơn hàng": (totalPoValue || 0).toLocaleString("vi-VN"),
        "createdAt": new Date().toISOString()
      };

      const newLines: any[] = [];
      const batch = writeBatch(db);

      // 1. Save PO Header
      const poHeaderRef = doc(db, "po_headers", headerId);
      batch.set(poHeaderRef, cleanObject(poHeaderPayload));

      // 2. Save PO Lines
      for (let i = 0; i < poLines.length; i++) {
        const line = poLines[i];
        const lineId = `D_${headerId}_${i + 1}`;
        const sellPrice = line.effectivePrice !== undefined ? line.effectivePrice : parseNumber(line["Đơn giá bán"]);
        const buyPrice = line.buyPrice !== undefined ? line.buyPrice : parseNumber(line["Đơn giá nhập"]);
        const qty = parseNumber(line["Số lượng"]) || 1;
        const lineRev = sellPrice * qty;
        const lineProfit = (sellPrice - buyPrice) * qty;

        const linePayload = {
          "id": lineId,
          "STT": lineId,
          "Số đơn hàng": newPoNumber.trim(),
          "Đơn hàng": newPoNumber.trim(),
          "Mã giá bán": line.priceCode || line["Mã giá bán"] || "Gsp_082",
          "Tên sản phẩm": line["Tên sản phẩm"] || line.masterProductName || line.name || "Sản phẩm PO",
          "Mã sản phẩm": line["Mã sản phẩm"] || line.code || line.masterProductCode || "",
          "Mã của khách": line["Mã của khách"] || line["Mã sản phẩm"] || line.code || "",
          "ĐVT": line["ĐVT"] || line.unit || "Cái",
          "Số lượng": qty,
          "quantity": qty,
          "Ngày đặt hàng": formattedDate,
          "Ngày giao": line.deliveryDate || formattedDate,
          "Khách hàng": poCustomer,
          "Đơn vị nhận hàng": poCustomer,
          "Nhóm hàng": line["Nhóm hàng"] || "Nguyên liệu",
          "Đơn giá nhập": buyPrice,
          "Đơn giá bán": sellPrice,
          "effectivePrice": sellPrice,
          "buyPrice": buyPrice,
          "supplier": line.supplier || line["RP_Nhà cung cấp"] || "Tâm Sen",
          "contractNo": line.contractNo || line["Số hợp đồng"] || "177/HĐ-TLTL",
          "priceCode": line.priceCode || line["Mã giá bán"] || "Gsp_082",
          "Thành tiền dòng": lineRev,
          "Lợi nhuận": lineProfit,
          "Hoàn thành": 0,
          "createdAt": new Date().toISOString()
        };

        newLines.push(linePayload);
        const lineRef = doc(db, "po_lines", lineId);
        batch.set(lineRef, cleanObject(linePayload));
      }

      // Optimistic update local states so next step has the data immediately
      setCreatedPoHeaders(prev => [poHeaderPayload, ...prev]);
      setCreatedPoLines(prev => [...newLines, ...prev]);

      // Fire Firestore commit with fallback timeout so UI never hangs
      Promise.race([
        batch.commit(),
        new Promise(resolve => setTimeout(resolve, 600))
      ]).catch(err => console.warn("Background commit notice:", err));

      toast.success(`Đã lưu Đơn hàng ${newPoNumber}! Chuyển sang Bước 2 để Thẩm định giá & Phê duyệt.`, { id: loadToast });
      setSelectedPoForApproval(newPoNumber.trim());
      setApprovalFilter("pending");
      setNewPoNumber("");
      setPoLines([]);
      setActiveStep(2); // Move to Step 2: Phê duyệt & Khóa đơn
    } catch (err: any) {
      console.error(err);
      toast.error(`Lỗi khi lưu đơn hàng: ${err.message || 'Chưa thể lưu'}`, { id: loadToast });
    }
  };

  const handleApprovePOFromStep2 = async (poHeader: any) => {
    if (!poHeader) return;
    const headerId = poHeader.id || poHeader["Đơn hàng"];
    const loadToast = toast.loading(`Đang phê duyệt & khóa đơn hàng ${poHeader["Đơn hàng"] || headerId}...`);
    try {
      const updatedPayload = {
        ...poHeader,
        "Trạng Thái": "Đã phê duyệt / Đang sản xuất",
        "approvedAt": new Date().toISOString()
      };
      
      setCreatedPoHeaders(prev => prev.map(h => ((h.id || h["Đơn hàng"]) === headerId ? updatedPayload : h)));

      Promise.race([
        updateDoc(doc(db, "po_headers", headerId), {
          "Trạng Thái": "Đã phê duyệt / Đang sản xuất",
          "approvedAt": new Date().toISOString()
        }),
        new Promise(resolve => setTimeout(resolve, 600))
      ]).catch(err => console.warn("Background header approve update:", err));

      toast.success(`Đã phê duyệt & Khóa đơn hàng ${poHeader["Đơn hàng"]}! Phát lệnh sản xuất xưởng NCC.`, { id: loadToast });
      setActiveStep(3); // Move to Step 3: Kế hoạch giao
    } catch (err: any) {
      console.error(err);
      toast.error(`Lỗi khi phê duyệt: ${err.message || 'Chưa thể lưu'}`, { id: loadToast });
    }
  };

  const handleExportStep2Excel = () => {
    if (!currentPoForApproval || !currentPoLinesForApproval || currentPoLinesForApproval.length === 0) {
      toast.error("Không có dữ liệu chi tiết sản phẩm để xuất Excel!");
      return;
    }
    try {
      const dataRows = currentPoLinesForApproval.map((line: any, idx: number) => {
        const soPrice = parseNumber(line["Giá bán (Chưa VAT)"] || line.unitPrice || 0);
        const poPrice = parseNumber(line["Giá mua (Chưa VAT)"] || line.costPrice || 0);
        const qty = parseNumber(line["Số lượng"] || line.quantity || 0);
        const revenue = parseNumber(line["Thành tiền bán"] || line.totalRevenue || (soPrice * qty));
        const cost = parseNumber(line["Thành tiền mua"] || line.totalCost || (poPrice * qty));
        const profit = parseNumber(line["Lợi nhuận gộp"] || line.grossProfit || (revenue - cost));
        const margin = parseNumber(line["Tỷ suất lợi nhuận (%)"] || line.marginPercent || (revenue > 0 ? (profit / revenue) * 100 : 0));
        const specs = line["Quy cách"] || getDefaultSpecs(line["Mã sản phẩm"] || line.productCode || "", line["Tên sản phẩm"] || line.productName || "");

        return {
          "STT": idx + 1,
          "Mã Sản Phẩm": line["Mã sản phẩm"] || line.productCode || "",
          "Tên Mặt Hàng": line["Tên sản phẩm"] || line.productName || "",
          "ĐVT": line["Đơn vị tính"] || line.unit || "Thùng",
          "Quy Cách Kỹ Thuật": specs,
          "Số Lượng": qty,
          "Đơn Giá Bán SO (VND)": soPrice,
          "Doanh Thu SO (VND)": revenue,
          "Nhà Cung Cấp": line["Nhà cung cấp"] || line.supplier || "TSG",
          "Đơn Giá Mua PO (VND)": poPrice,
          "Giá Vốn PO (VND)": cost,
          "Lợi Nhuận Gộp (VND)": profit,
          "Biên LN (%)": `${margin.toFixed(1)}%`
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(dataRows);
      worksheet['!cols'] = [
        { wch: 6 },
        { wch: 16 },
        { wch: 38 },
        { wch: 8 },
        { wch: 45 },
        { wch: 12 },
        { wch: 18 },
        { wch: 20 },
        { wch: 14 },
        { wch: 18 },
        { wch: 20 },
        { wch: 20 },
        { wch: 14 }
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "DoiSoat_BOD");
      const poNum = currentPoForApproval["Đơn hàng"] || "PO";
      const fileName = `DoiSoat_BOD_${poNum.replace(/[\/\\]/g, "_")}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      toast.success(`Đã xuất bảng đối soát Excel thành công: ${fileName}`);
    } catch (err: any) {
      console.error("Excel export error:", err);
      toast.error("Lỗi xuất Excel: " + (err?.message || ""));
    }
  };

  // --------------------------------------------------
  // STEP 3 calculations
  // --------------------------------------------------
  const activePOLinesNeedPlan = useMemo(() => {
    // Return lines that don't have enough plans scheduled
    return combinedPoLinesData.filter(line => !line.isDeleted).map(line => {
      const lineStt = String(line["STT"] || line.id || "").trim();
      const poNum = String(line["Số đơn hàng"] || line["Đơn hàng"] || "").trim();
      const prodName = String(line["Tên sản phẩm"] || "").trim();

      // Planned delivery quantities
      const existingPlans = combinedDeliveryPlanData.filter(p => 
        !p.isDeleted && (
          (p["Chi tiết đơn hàng"] && String(p["Chi tiết đơn hàng"]).trim() === lineStt) ||
          (p["Đơn hàng"] && String(p["Đơn hàng"]).trim() === poNum && p["Sản phẩm"] && String(p["Sản phẩm"]).trim() === prodName)
        )
      );
      const plannedSum = existingPlans.reduce((sum, p) => sum + parseNumber(p["Số lượng kế hoạch"] || p["Số lượng cần giao"] || p["Số lượng"]), 0);

      // Actual delivered quantities from PXK
      const existingDeliveries = combinedDeliveryData.filter(d =>
        !d.isDeleted && (
          (d["Chi tiết đơn hàng"] && String(d["Chi tiết đơn hàng"]).trim() === lineStt) ||
          (d["Đơn hàng"] && String(d["Đơn hàng"]).trim() === poNum && (d["Tên sản phẩm"] || d["Sản phẩm"]) && String(d["Tên sản phẩm"] || d["Sản phẩm"]).trim() === prodName)
        )
      );
      const deliveredSum = existingDeliveries.reduce((sum, d) => sum + parseNumber(d["Số lượng giao"] || d["Số lượng thực nhận"] || d["Đã giao"] || d["Số lượng"]), 0);

      const totalQty = parseNumber(line["Số lượng"]);
      const remainingToDeliver = Math.max(0, totalQty - deliveredSum);
      const deliveryProgress = totalQty > 0 ? Math.min(100, Math.round((deliveredSum / totalQty) * 100)) : 0;

      return {
        ...line,
        plannedQtySum: plannedSum,
        qtyNeeded: Math.max(0, totalQty - plannedSum),
        deliveredSum,
        remainingToDeliver,
        deliveryProgress
      };
    });
  }, [combinedPoLinesData, combinedDeliveryPlanData, combinedDeliveryData]);

  const currentWeekDays = useMemo(() => {
    const now = new Date();
    const currentDay = now.getDay();
    const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
    const monday = new Date(now);
    monday.setDate(now.getDate() + distanceToMonday + (selectedWeekOffset * 7));

    const days = [];
    const dayNames = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ Nhật"];

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const dateFormattedSlash = `${dd}/${mm}/${yyyy}`;
      const dateFormattedIso = `${yyyy}-${mm}-${dd}`;
      const isToday = new Date().toDateString() === d.toDateString();

      days.push({
        dayIndex: i,
        dayName: dayNames[i],
        dateSlash: dateFormattedSlash,
        dateIso: dateFormattedIso,
        dateObj: d,
        isToday
      });
    }
    return days;
  }, [selectedWeekOffset]);

  const generateGoogleCalendarUrl = (plan: any) => {
    const qty = parseNumber(plan["Số lượng kế hoạch"] || plan["Số lượng"]).toLocaleString("vi-VN");
    const title = `[Giao Hàng TSG] ${plan["Khách hàng"]} - PO ${plan["Đơn hàng"]} (${qty} ${plan["ĐVT"] || "sp"})`;
    const rawDate = String(plan["Ngày giao kế hoạch"] || "");
    let startIso = "";
    let endIso = "";
    if (rawDate.includes("/")) {
      const parts = rawDate.split("/");
      if (parts.length === 3) {
        const d = parts[0].padStart(2, "0");
        const m = parts[1].padStart(2, "0");
        const y = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
        startIso = `${y}${m}${d}T073000`;
        endIso = `${y}${m}${d}T150000`;
      }
    } else if (rawDate.includes("-")) {
      const parts = rawDate.split("-");
      if (parts.length === 3) {
        const y = parts[0];
        const m = parts[1].padStart(2, "0");
        const d = parts[2].padStart(2, "0");
        startIso = `${y}${m}${d}T073000`;
        endIso = `${y}${m}${d}T150000`;
      }
    }

    if (!startIso) {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, "0");
      const d = String(now.getDate()).padStart(2, "0");
      startIso = `${y}${m}${d}T073000`;
      endIso = `${y}${m}${d}T150000`;
    }

    const details = `THÔNG TIN LỊCH GIAO HÀNG (ERP TÂM SEN):\n` +
      `• Số đơn hàng PO: ${plan["Đơn hàng"]}\n` +
      `• Khách hàng: ${plan["Khách hàng"]}\n` +
      `• Mặt hàng sản phẩm: ${plan["Sản phẩm"]}\n` +
      `• Sản lượng kế hoạch: ${qty}\n` +
      `• Kế hoạch ID: ${plan["Kế hoạch ID"] || plan.id}\n` +
      `• Ghi chú điều phối xe: ${plan["Ghi chú"] || "Giao giờ hành chính 07h30 - 15h00, hạ pallet kho nhà máy"}`;
    const location = plan["Khách hàng"] ? `Kho tiếp nhận nhà máy ${plan["Khách hàng"]}` : "Kho khách hàng chỉ định";
    
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${startIso}/${endIso}&details=${encodeURIComponent(details)}&location=${encodeURIComponent(location)}`;
  };

  const handleSelectPlanningLine = (line: any) => {
    setPlanningPoLine(line);
    const needed = line.qtyNeeded > 0 ? line.qtyNeeded : parseNumber(line["Số lượng"]);
    setPlannedQty(needed > 0 ? needed : 100);

    // Auto smooth scroll to planning form so user does not need to scroll manually
    setTimeout(() => {
      const formEl = document.getElementById("delivery-planning-form-card");
      if (formEl) {
        formEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }, 60);
  };

  const handleSaveDeliveryPlan = async () => {
    if (!planningPoLine) return;
    if (plannedQty <= 0) {
      toast.error("Số lượng lập kế hoạch phải lớn hơn 0!");
      return;
    }

    const loadToast = toast.loading("Đang lưu kế hoạch giao hàng...");
    try {
      const rawLineId = String(planningPoLine["STT"] || planningPoLine.id || "LINE").replace(/\//g, "-").trim();
      const planId = `PLAN-${rawLineId}-${Math.floor(100 + Math.random() * 900)}`;
      const formattedDate = plannedDate.includes("-") ? plannedDate.split("-").reverse().join("/") : plannedDate;

      const payload = {
        "Kế hoạch ID": planId,
        "id": planId,
        "Chi tiết đơn hàng": planningPoLine["STT"] || planningPoLine.id || rawLineId,
        "Đơn hàng": planningPoLine["Số đơn hàng"] || planningPoLine["Đơn hàng"] || "",
        "Sản phẩm": planningPoLine["Tên sản phẩm"] || "",
        "Khách hàng": planningPoLine["Khách hàng"] || "",
        "Số lượng kế hoạch": plannedQty,
        "Số lượng cần giao": plannedQty,
        "Số lượng": plannedQty, // Compatibility
        "Ngày giao kế hoạch": formattedDate,
        "Trạng thái": "Chờ giao hàng",
        "Ghi chú": planNotes || "",
        "createdAt": new Date().toISOString()
      };

      const cleanP = cleanObject(payload);
      setCreatedPlans(prev => [cleanP, ...prev]);

      Promise.race([
        setDoc(doc(db, "delivery_plans", planId), cleanP),
        new Promise(resolve => setTimeout(resolve, 600))
      ]).catch(err => console.warn("Background plan save:", err));

      toast.success("Lập kế hoạch giao hàng thành công!", { id: loadToast });
      setPlanningPoLine(null);
      setPlanNotes("");
    } catch (err: any) {
      console.error(err);
      toast.error(`Lỗi khi tạo kế hoạch: ${err?.message || 'Chưa thể lưu'}`, { id: loadToast });
    }
  };

  // --------------------------------------------------
  // STEP 4 calculations
  // --------------------------------------------------
  const activeDeliveryPlans = useMemo(() => {
    return combinedDeliveryPlanData.filter(p => !p.isDeleted && p["Trạng thái"] !== "Đã giao");
  }, [combinedDeliveryPlanData]);

  const handleSelectPlanForDelivery = (plan: any) => {
    setSelectedPlan(plan);
    setDeliveredQty(parseNumber(plan["Số lượng kế hoạch"] || plan["Số lượng"]));
    setPxkNumber(`26/PXK/${Math.floor(10 + Math.random() * 899)}`);
    setBbbgNumber(`BBBG-${Math.floor(1000 + Math.random() * 9000)}`);
    setReceiverSigner(plan["Khách hàng"] ? `Thủ kho ${plan["Khách hàng"]}` : "");
    const defaultCarrier = supplierData.find(s => s["Nhóm hàng"] === "Vận chuyển")?.["Tên Nhà Cung Cấp"] || "Song Dũng";
    setCarrier(defaultCarrier);
  };

  const handleSaveDeliveryRecord = async () => {
    if (!selectedPlan) return;
    if (!pxkNumber.trim()) {
      toast.error("Vui lòng điền Số PXK (Phiếu xuất kho)!");
      return;
    }
    if (deliveredQty <= 0) {
      toast.error("Số lượng thực giao phải lớn hơn 0!");
      return;
    }

    const loadToast = toast.loading("Đang xử lý xuất kho & lưu BBBG...");
    try {
      // Find original PO line to pull financial info
      const poLine = combinedPoLinesData.find(l => l["STT"] === selectedPlan["Chi tiết đơn hàng"]);
      const buyPrice = poLine ? (parseNumber(poLine["Đơn giá nhập"]) || parseNumber(poLine.buyPrice)) : 0;
      const sellPrice = poLine ? (parseNumber(poLine["Đơn giá bán"]) || parseNumber(poLine.effectivePrice)) : 0;
      const revenue = sellPrice * deliveredQty;
      const profit = (sellPrice - buyPrice) * deliveredQty;

      const deliveryId = `DEL-${Date.now()}`;
      const formattedActualDate = actualDate.includes("-") ? actualDate.split("-").reverse().join("/") : actualDate;
      const payload = {
        "STT": combinedDeliveryData.length + 1,
        "id": deliveryId,
        "Chi tiết đơn hàng": selectedPlan["Chi tiết đơn hàng"],
        "Ngày giao": formattedActualDate,
        "Đơn hàng": selectedPlan["Đơn hàng"],
        "Mã sản phẩm": poLine ? poLine["Mã của khách"] : selectedPlan["Sản phẩm"],
        "Tên sản phẩm": selectedPlan["Sản phẩm"],
        "ĐVT": poLine ? poLine["ĐVT"] : "Cái",
        "Số lượng giao": deliveredQty,
        "Số lượng đặt": poLine ? parseNumber(poLine["Số lượng"]) : deliveredQty,
        "Số lượng thực nhận": deliveredQty,
        "Đã giao": deliveredQty,
        "Còn lại": poLine ? Math.max(0, parseNumber(poLine["Số lượng"]) - deliveredQty) : 0,
        "Tiến độ giao": poLine ? `${Math.round((deliveredQty / parseNumber(poLine["Số lượng"])) * 100)}%` : "100%",
        "Status": "Hoàn thành",
        "Số PXK": pxkNumber,
        "Số BBBG": bbbgNumber || `BBBG-${pxkNumber}`,
        "Người ký nhận": receiverSigner || "Thủ kho khách hàng",
        "Khách hàng": selectedPlan["Khách hàng"],
        "Sự cố": hasIncident ? "1" : "0",
        "Chi tiết sự cố": hasIncident ? incidentDetail : "",
        "Nhà cung cấp": carrier,
        "Nhóm hàng": poLine ? poLine["Nhóm hàng"] : "Nguyên liệu",
        "Đơn giá nhập": (buyPrice || 0).toLocaleString("vi-VN"),
        "Đơn giá bán": (sellPrice || 0).toLocaleString("vi-VN"),
        "Doanh thu": (revenue || 0).toLocaleString("vi-VN"),
        "Lợi nhuận gộp": (profit || 0).toLocaleString("vi-VN"),
        "% Lợi nhuận": poLine && sellPrice > 0 ? `${((sellPrice - buyPrice) / sellPrice * 100).toFixed(2)}%` : "0%",
        "AccountingStatus": "Chưa thu tiền",
        "InvoiceStatus": "Chưa xuất",
        "Tháng": parseInt(actualDate.split("-")[1]) || 7,
        "createdAt": new Date().toISOString()
      };

      const cleanDeliv = cleanObject(payload);
      setCreatedDeliveries(prev => [cleanDeliv, ...prev]);

      const batch = writeBatch(db);

      // 1. Create delivery record
      const deliveryRef = doc(db, "deliveries", deliveryId);
      batch.set(deliveryRef, cleanDeliv);

      // 2. Update status of the delivery plan
      const planRef = doc(db, "delivery_plans", selectedPlan["Kế hoạch ID"] || selectedPlan.id);
      batch.update(planRef, { "Trạng thái": "Đã giao" });

      // 3. Update PO Line complete flag if fully met
      if (poLine) {
        const totalDeliveredForLine = combinedDeliveryData
          .filter(d => !d.isDeleted && d["Chi tiết đơn hàng"] === poLine["STT"])
          .reduce((sum, d) => sum + parseNumber(d["Số lượng giao"]), 0) + deliveredQty;
        
        const ordered = parseNumber(poLine["Số lượng"]);
        if (totalDeliveredForLine >= ordered) {
          const poLineRef = doc(db, "po_lines", poLine.id || poLine["STT"]);
          batch.update(poLineRef, { "Hoàn thành": 1 });
        }
      }

      Promise.race([
        batch.commit(),
        new Promise(resolve => setTimeout(resolve, 600))
      ]).catch(err => console.warn("Background delivery save:", err));

      toast.success(`Đã xác nhận giao hàng qua phiếu ${pxkNumber}!`, { id: loadToast });
      setSelectedPlan(null);
      setIncidentDetail("");
      setHasIncident(false);
      setActiveStep(5); // Move to Reconciliation
    } catch (err) {
      console.error(err);
      toast.error("Không thể xử lý giao hàng!", { id: loadToast });
    }
  };

  // --------------------------------------------------
  // STEP 5: Đối soát dữ liệu (Reconciliation)
  // --------------------------------------------------
  const reconciliationData = useMemo(() => {
    return combinedPoLinesData.filter(line => !line.isDeleted).map(line => {
      const associatedDeliveries = combinedDeliveryData.filter(d => !d.isDeleted && d["Chi tiết đơn hàng"] === line["STT"]);
      const associatedPlans = combinedDeliveryPlanData.filter(p => !p.isDeleted && p["Chi tiết đơn hàng"] === line["STT"]);
      
      const totalDelivered = associatedDeliveries.reduce((sum, d) => sum + parseNumber(d["Số lượng giao"]), 0);
      const totalPlanned = associatedPlans.reduce((sum, p) => sum + parseNumber(p["Số lượng kế hoạch"] || p["Số lượng"]), 0);
      const ordered = parseNumber(line["Số lượng"]);
      
      const diffVsOrder = totalDelivered - ordered;
      const diffVsPlan = totalDelivered - totalPlanned;

      let status = "Chưa giao";
      let statusColor = "text-gray-500 bg-gray-50";
      if (totalDelivered === 0) {
        status = "Chưa giao";
        statusColor = "text-yellow-600 bg-yellow-50";
      } else if (totalDelivered === ordered) {
        status = "Khớp 100%";
        statusColor = "text-green-600 bg-green-50";
      } else if (totalDelivered < ordered) {
        status = "Giao thiếu";
        statusColor = "text-orange-600 bg-orange-50";
      } else {
        status = "Giao thừa";
        statusColor = "text-purple-600 bg-purple-50";
      }

      const incidents = associatedDeliveries.filter(d => d["Sự cố"] === "1" || d["Sự cố"] === 1);

      return {
        line,
        ordered,
        totalPlanned,
        totalDelivered,
        diffVsOrder,
        diffVsPlan,
        status,
        statusColor,
        deliveries: associatedDeliveries,
        plans: associatedPlans,
        incidents
      };
    });
  }, [combinedPoLinesData, combinedDeliveryData, combinedDeliveryPlanData]);

  const filteredReconciliation = useMemo(() => {
    if (reconcileFilter === "all") return reconciliationData;
    if (reconcileFilter === "incident") return reconciliationData.filter(r => r.incidents.length > 0);
    return reconciliationData.filter(r => r.status === reconcileFilter);
  }, [reconciliationData, reconcileFilter]);

  const reconcileStats = useMemo(() => {
    const totalLines = reconciliationData.length;
    const matched = reconciliationData.filter(r => r.status === "Khớp 100%").length;
    const short = reconciliationData.filter(r => r.status === "Giao thiếu").length;
    const over = reconciliationData.filter(r => r.status === "Giao thừa").length;
    const unserved = reconciliationData.filter(r => r.status === "Chưa giao").length;
    const incidents = reconciliationData.reduce((sum, r) => sum + r.incidents.length, 0);

    return { totalLines, matched, short, over, unserved, incidents };
  }, [reconciliationData]);


  // --------------------------------------------------
  // STEP 6: Accounting & Financial Reports
  // --------------------------------------------------
    const financialSummary = useMemo(() => {
    let revenueSum = 0;
    let cogsSum = 0;
    combinedDeliveryData.filter(d => !d.isDeleted).forEach(d => {
      const qty = parseNumber(d["Số lượng giao"]);
      const buyPrice = parseNumber(d["Đơn giá nhập"]);
      const sellPrice = parseNumber(d["Đơn giá bán"]);
      revenueSum += sellPrice * qty;
      cogsSum += buyPrice * qty;
    });

    const profitSum = revenueSum - cogsSum;
    const marginAvg = revenueSum > 0 ? (profitSum / revenueSum) * 100 : 0;

    return { revenueSum, cogsSum, profitSum, marginAvg };
  }, [combinedDeliveryData]);

  const receivablesByCustomer = useMemo(() => {
    const map = new Map<string, number>();
    combinedDeliveryData.filter(d => !d.isDeleted && d["AccountingStatus"] !== "Đã thu tiền").forEach(d => {
      const rev = parseNumber(d["Doanh thu"] || (parseNumber(d["Đơn giá bán"]) * parseNumber(d["Số lượng giao"])));
      const cust = d["Khách hàng"] || "Khác";
      map.set(cust, (map.get(cust) || 0) + rev);
    });
    return Array.from(map.entries()).map(([name, val]) => ({ name, val }));
  }, [combinedDeliveryData]);

  const payablesBySupplier = useMemo(() => {
    const map = new Map<string, number>();
    combinedDeliveryData.filter(d => !d.isDeleted && d["AccountingStatus"] !== "Đã chi tiền").forEach(d => {
      const cost = parseNumber(d["Đơn giá nhập"]) * parseNumber(d["Số lượng giao"]);
      const supp = d["Nhà cung cấp"] || "Khác";
      map.set(supp, (map.get(supp) || 0) + cost);
    });
    return Array.from(map.entries()).map(([name, val]) => ({ name, val }));
  }, [combinedDeliveryData]);

  const handleUpdateAccountingStatus = async (deliveryId: string, statusType: "AccountingStatus" | "InvoiceStatus", value: string) => {
    const loadToast = toast.loading("Đang cập nhật chứng từ...");
    try {
      await updateDoc(doc(db, "deliveries", deliveryId), {
        [statusType]: value
      });
      toast.success("Đã cập nhật trạng thái kế toán thành công!", { id: loadToast });
    } catch (err) {
      console.error(err);
      toast.error("Không thể cập nhật trạng thái!", { id: loadToast });
    }
  };

  const handleExportAccountantExcel = () => {
    try {
      const wb = XLSX.utils.book_new();
      const activeDeliveries = combinedDeliveryData.filter(d => !d.isDeleted);
      
      let totalRev = 0;
      let totalCost = 0;
      let totalProfit = 0;

      const customerPnl: Record<string, { rev: number, cost: number, prof: number }> = {};
      const productPnl: Record<string, { rev: number, cost: number, prof: number }> = {};

      const deliveryRows = activeDeliveries.map((d, index) => {
        const qty = parseNumber(d["Số lượng giao"]);
        const buyPrice = parseNumber(d["Đơn giá nhập"]);
        const sellPrice = parseNumber(d["Đơn giá bán"]);
        const rev = sellPrice * qty;
        const cost = buyPrice * qty;
        const prof = rev - cost;

        totalRev += rev;
        totalCost += cost;
        totalProfit += prof;

        const cust = d["Khách hàng"] || "Chưa xác định";
        if (!customerPnl[cust]) customerPnl[cust] = { rev: 0, cost: 0, prof: 0 };
        customerPnl[cust].rev += rev;
        customerPnl[cust].cost += cost;
        customerPnl[cust].prof += prof;

        const prod = d["Tên sản phẩm"] || "Chưa xác định";
        if (!productPnl[prod]) productPnl[prod] = { rev: 0, cost: 0, prof: 0 };
        productPnl[prod].rev += rev;
        productPnl[prod].cost += cost;
        productPnl[prod].prof += prof;

        return {
          "STT": index + 1,
          "Mã PXK": d["Số PXK"] || "",
          "Mã Đơn hàng PO": d["Đơn hàng"] || "",
          "Khách hàng": cust,
          "Nhà cung cấp/Vận chuyển": d["Nhà cung cấp"] || "",
          "Sản phẩm": prod,
          "Số lượng": qty,
          "Đơn vị tính": d["ĐVT"] || "",
          "Đơn giá mua": buyPrice,
          "Đơn giá bán": sellPrice,
          "Doanh thu (VND)": rev,
          "Giá vốn mua (VND)": cost,
          "Lợi nhuận gộp (VND)": prof,
          "Ngày giao hàng": d["Ngày giao"] || "",
          "Trạng thái đối soát": d["AccountingStatus"] || "Đang xử lý",
          "Trạng thái hóa đơn": d["InvoiceStatus"] || "Chưa xuất"
        };
      });

      const pnlData = [
        ["BÁO CÁO KẾT QUẢ KINH DOANH"],
        [`Ngày xuất báo cáo: ${new Date().toLocaleDateString('vi-VN')}`],
        [],
        ["I. KẾT QUẢ TỔNG HỢP", "", "GIÁ TRỊ (VNĐ)"],
        ["1. Tổng doanh thu bán hàng", "", totalRev],
        ["2. Tổng giá vốn hàng bán", "", totalCost],
        ["3. Lợi nhuận gộp", "", totalProfit],
        ["4. Tỷ suất lợi nhuận / Doanh thu", "", totalRev > 0 ? `${((totalProfit / totalRev) * 100).toFixed(2)}%` : "0%"],
        [],
        ["II. CHI TIẾT THEO KHÁCH HÀNG", "DOANH THU", "GIÁ VỐN", "LỢI NHUẬN GỘP", "TỶ SUẤT LN"],
      ];

      Object.entries(customerPnl).sort((a, b) => b[1].prof - a[1].prof).forEach(([cName, cData]) => {
        pnlData.push([
          cName, 
          cData.rev, 
          cData.cost, 
          cData.prof,
          cData.rev > 0 ? `${((cData.prof / cData.rev) * 100).toFixed(2)}%` : "0%"
        ]);
      });

      pnlData.push([]);
      pnlData.push(["III. CHI TIẾT THEO SẢN PHẨM", "DOANH THU", "GIÁ VỐN", "LỢI NHUẬN GỘP", "TỶ SUẤT LN"]);

      Object.entries(productPnl).sort((a, b) => b[1].prof - a[1].prof).forEach(([pName, pData]) => {
        pnlData.push([
          pName, 
          pData.rev, 
          pData.cost, 
          pData.prof,
          pData.rev > 0 ? `${((pData.prof / pData.rev) * 100).toFixed(2)}%` : "0%"
        ]);
      });

      const wsPnL = XLSX.utils.aoa_to_sheet(pnlData);
      
      wsPnL['!cols'] = [
        { wch: 40 },
        { wch: 20 },
        { wch: 20 },
        { wch: 20 },
        { wch: 15 }
      ];

      XLSX.utils.book_append_sheet(wb, wsPnL, "KQ Kinh Doanh");

      const wsDeliveries = XLSX.utils.json_to_sheet(deliveryRows);
      XLSX.utils.book_append_sheet(wb, wsDeliveries, "Data Giao Hàng");

      const customerRows = receivablesByCustomer.map((c, idx) => ({
        "STT": idx + 1,
        "Tên Khách Hàng": c.name,
        "Công nợ phải thu (VND)": c.val
      }));
      const wsCustomers = XLSX.utils.json_to_sheet(customerRows);
      XLSX.utils.book_append_sheet(wb, wsCustomers, "Công nợ Phải Thu");

      const supplierRows = payablesBySupplier.map((s, idx) => ({
        "STT": idx + 1,
        "Nhà Cung Cấp / Vận Chuyển": s.name,
        "Công nợ phải trả (VND)": s.val
      }));
      const wsSuppliers = XLSX.utils.json_to_sheet(supplierRows);
      XLSX.utils.book_append_sheet(wb, wsSuppliers, "Công nợ Phải Trả");

      XLSX.writeFile(wb, `Bao_Cao_KQKD_TSG_${new Date().toISOString().split("T")[0]}.xlsx`);
      toast.success("Đã xuất báo cáo Excel thành công!");
    } catch (err) {
      console.error(err);
      toast.error("Gặp sự cố khi xuất tệp Excel!");
    }
  };

  const handleExportAccountantPDF = () => {
    try {
      const activeDeliveries = combinedDeliveryData.filter(d => !d.isDeleted);

      let totalRev = 0;
      let totalCost = 0;
      let totalProfit = 0;

      const pdfRows = activeDeliveries.map((d) => {
        const qty = parseNumber(d["Số lượng giao"]);
        const buyPrice = parseNumber(d["Đơn giá nhập"]);
        const sellPrice = parseNumber(d["Đơn giá bán"]);
        const rev = sellPrice * qty;
        const cost = buyPrice * qty;
        const prof = rev - cost;

        totalRev += rev;
        totalCost += cost;
        totalProfit += prof;

        return {
          "Số PXK": d["Số PXK"] || "",
          "Số PO": d["Đơn hàng"] || "",
          "Khách hàng": d["Khách hàng"] || "",
          "Sản phẩm": d["Tên sản phẩm"] || "",
          "Số lượng": qty,
          "Đơn giá bán": sellPrice,
          "Doanh thu": rev,
          "Lợi nhuận": prof,
          "Ngày giao": d["Ngày giao"] || ""
        };
      });

      exportGenericTableToPDF({
        title: "BÁO CÁO KẾ TOÁN VÀ DOANH THU LUỒNG NGHIỆP VỤ",
        subtitle: `Số lượng giao hàng: ${activeDeliveries.length} phiếu | Xuất lúc: ${new Date().toLocaleDateString('vi-VN')}`,
        filename: `Bao_Cao_Ke_Toan_${new Date().toISOString().slice(0, 10)}.pdf`,
        columns: ["Số PXK", "Số PO", "Khách hàng", "Sản phẩm", "Số lượng", "Đơn giá bán", "Doanh thu", "Lợi nhuận", "Ngày giao"],
        data: pdfRows,
        summaryStats: [
          { label: "Tong Doanh Thu", value: formatVND(totalRev), color: [59, 130, 246] },
          { label: "Tong Gia Von", value: formatVND(totalCost), color: [239, 68, 68] },
          { label: "Tong Loi Nhuan", value: formatVND(totalProfit), color: [16, 185, 129] },
          { label: "Luot Giao Hang", value: `${activeDeliveries.length} luot`, color: [139, 92, 246] }
        ],
        orientation: "landscape"
      });
      toast.success("Đã xuất Báo cáo PDF Kế toán thành công!");
    } catch (err: any) {
      console.error(err);
      toast.error("Lỗi xuất PDF: " + (err?.message || err));
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#F5F5F7] text-[#1D1D1F]">
      {/* Top Workflow Wizard Header */}
      <div className="bg-white/90 backdrop-blur-xl border-b border-black/[0.06] px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xs">
        <div>
          <h2 className="text-xl font-bold text-[#1D1D1F] tracking-tight flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-600 shadow-sm shadow-blue-500/20">
              <TrendingUp size={20} className="text-white" />
            </div>
            <span className="text-[#1D1D1F]">
              Quản trị Luồng Nghiệp Vụ Liên Kết
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Quy trình phối hợp khép kín từ đặt hàng, giao vận, đối soát và báo cáo kế toán
          </p>
        </div>
        <div className="flex items-center gap-3">
          {activeStep === 6 && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportAccountantPDF}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98]"
              >
                <FileText size={16} />
                Xuất PDF Kế Toán
              </button>
              <button
                onClick={handleExportAccountantExcel}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm shadow-emerald-500/20 hover:scale-[1.02] active:scale-[0.98]"
              >
                <FileSpreadsheet size={16} />
                Xuất Excel Kế Toán
              </button>
            </div>
          )}
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
            </span>
            Bước {activeStep} / 6: {
              activeStep === 1 ? "Báo giá & Đơn hàng kép" :
              activeStep === 2 ? "Phê duyệt & Khóa đơn" :
              activeStep === 3 ? "Kế hoạch giao hàng" :
              activeStep === 4 ? "Xuất kho & BBBG" :
              activeStep === 5 ? "Đối soát 3 bên" :
              "Hóa đơn, Công nợ & Tài chính"
            }
          </div>
        </div>
      </div>

      {/* Progress Tracker Bar */}
      <div className="bg-white/60 backdrop-blur-md border-b border-black/[0.06] p-4 overflow-x-auto">
        <div className="flex items-center justify-between min-w-[850px] max-w-[1720px] mx-auto px-4 gap-2">
          {[
            { step: 1, label: "1. Báo giá & Đơn hàng kép", icon: <ShoppingCart size={16} /> },
            { step: 2, label: "2. Phê duyệt & Khóa đơn", icon: <ShieldCheck size={16} /> },
            { step: 3, label: "3. Kế hoạch giao", icon: <Calendar size={16} /> },
            { step: 4, label: "4. Xuất kho & BBBG", icon: <Truck size={16} /> },
            { step: 5, label: "5. Đối soát 3 bên", icon: <CheckSquare size={16} /> },
            { step: 6, label: "6. Hóa đơn & Tài chính", icon: <BarChart3 size={16} /> }
          ].map((item, index) => {
            const isActive = activeStep === item.step;
            const isDone = activeStep > item.step;
            return (
              <React.Fragment key={item.step}>
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setActiveStep(item.step)}
                  className={`relative flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl transition-all duration-200 text-xs font-semibold ${
                    isActive
                      ? "text-white shadow-sm shadow-blue-500/20 bg-[#007AFF]"
                      : isDone
                      ? "bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
                      : "bg-white text-slate-600 border border-slate-200 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  <span className={`p-1.5 rounded-lg flex items-center justify-center transition-colors ${
                    isActive 
                      ? "bg-white/20 text-white" 
                      : isDone 
                      ? "bg-blue-100 text-blue-700" 
                      : "bg-slate-100 text-slate-500"
                  }`}>
                    {item.icon}
                  </span>
                  <span className="whitespace-nowrap font-medium">{item.label}</span>
                </motion.button>
                {index < 5 && (
                  <div className={`h-[2px] flex-1 min-w-[20px] rounded-full transition-colors ${
                    activeStep > index + 1 ? "bg-blue-500" : "bg-slate-200"
                  }`} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Active Wizard Content Panel */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        <div className="max-w-[1720px] mx-auto space-y-6">

          {/* ================================================== */}
          {/* STEP 1: BÁO GIÁ & TIẾP NHẬN ĐƠN HÀNG KÉP (DUAL PO INTAKE) */}
          {/* ================================================== */}
          {activeStep === 1 && (
            <div className="space-y-6">
              {/* 1. KHỐI TIẾP NHẬN: CHỌN KHÁCH HÀNG & THÔNG TIN ĐƠN HÀNG */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                      <ShoppingCart size={22} />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 text-lg">1. Tiếp Nhận Đơn Hàng & Chọn Khách Hàng</h3>
                      <p className="text-xs text-slate-500">Bắt đầu bằng việc chọn Khách hàng để hệ thống tự động bóc tách và lọc danh mục sản phẩm từ Bảng Giá 2026 & Hợp Đồng Gốc</p>
                    </div>
                  </div>

                  {/* Mode Selector Tabs & Quick Samples */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-bold text-slate-500">Mẫu PO thử:</span>
                    <button
                      type="button"
                      onClick={() => handleLoadSamplePO('ThangLong')}
                      className="px-2.5 py-1 bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold transition shadow-xs"
                    >
                      📄 PO Thăng Long
                    </button>
                    <button
                      type="button"
                      onClick={() => handleLoadSamplePO('ThanhHoa')}
                      className="px-2.5 py-1 bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold transition shadow-xs"
                    >
                      📄 PO Thanh Hóa
                    </button>
                    <button
                      type="button"
                      onClick={() => handleLoadSamplePO('BacSon')}
                      className="px-2.5 py-1 bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold transition shadow-xs"
                    >
                      📄 PO Bắc Sơn
                    </button>
                  </div>
                </div>

                {/* Drag & drop upload area for OCR */}
                <div className="border border-slate-200 bg-slate-50/60 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100/70 text-blue-700 rounded-lg">
                      <Camera size={18} />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-800">Quét OCR Chứng từ PO (PDF / Ảnh)</span>
                      <p className="text-[11px] text-slate-500">Hệ thống AI Gemini sẽ tự động bóc tách Số PO, Mặt hàng & Số lượng từ ảnh chụp</p>
                    </div>
                  </div>

                  <div className="relative">
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleOCRUploadInWorkflow(file);
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      disabled={isOcrProcessing}
                    />
                    <button
                      type="button"
                      disabled={isOcrProcessing}
                      className="bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-bold px-3.5 py-2 rounded-lg text-xs flex items-center gap-1.5 transition shadow-xs"
                    >
                      {isOcrProcessing ? (
                        <>
                          <Loader2 size={14} className="animate-spin text-blue-600" />
                          <span>Đang xử lý OCR...</span>
                        </>
                      ) : (
                        <>
                          <Upload size={14} className="text-blue-600" />
                          <span>Tải tệp chứng từ PO lên</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Header Form */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div>
                    <label className="block text-xs font-bold text-blue-900 mb-1">
                      Khách hàng <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={poCustomer}
                      onChange={(e) => {
                        setPoCustomer(e.target.value);
                        setSelectedProductCode("");
                      }}
                      className="w-full text-sm border border-blue-300 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-900 shadow-xs"
                    >
                      <option value="">-- Chọn khách hàng --</option>
                      {customerData.filter(c => !c.isDeleted).map((c, i) => {
                        const custName = c["Tên đầy đủ"] || c.Customer_ID;
                        return (
                          <option key={i} value={custName}>
                            {custName}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Số đơn hàng Khách hàng (PO)</label>
                    <input
                      type="text"
                      placeholder="VD: 26/KHVT/0899"
                      value={newPoNumber}
                      onChange={(e) => setNewPoNumber(e.target.value)}
                      className="w-full text-sm border border-slate-200 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Phân loại đơn hàng</label>
                    <select
                      value={poType}
                      onChange={(e) => setPoType(e.target.value)}
                      className="w-full text-sm border border-slate-200 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="Đơn hàng thường xuyên">Đơn hàng thường xuyên</option>
                      <option value="Đơn hàng khẩn cấp">Đơn hàng khẩn cấp</option>
                      <option value="Đơn hàng dự án">Đơn hàng dự án</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Ngày đặt hàng</label>
                    <input
                      type="date"
                      value={poDate}
                      onChange={(e) => setPoDate(e.target.value)}
                      className="w-full text-sm border border-slate-200 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* 2. KHỐI GỢI Ý & THÊM SẢN PHẨM CỦA KHÁCH HÀNG (SOURCING CATALOG) */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-amber-50 text-amber-600 rounded-lg font-bold text-xs">
                      <Sparkles size={16} />
                    </span>
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm">
                        2. Danh Mục Sản Phẩm Thuộc {poCustomer ? `"${poCustomer}"` : "Khách Hàng"} ({customerPricingOptions.length} mặt hàng trong Bảng giá 2026)
                      </h4>
                      <p className="text-xs text-slate-500">Hệ thống đã tự động lọc các sản phẩm và số hợp đồng kinh tế tương ứng của khách hàng này</p>
                    </div>
                  </div>
                </div>

                {!poCustomer ? (
                  <div className="bg-amber-50/70 border border-dashed border-amber-200 rounded-xl p-8 text-center text-amber-800">
                    <Info size={28} className="mx-auto text-amber-500 mb-2" />
                    <p className="font-bold text-sm">Vui lòng chọn Khách hàng ở khối số 1</p>
                    <p className="text-xs text-amber-600 mt-0.5">Hệ thống sẽ ngay lập tức tải bảng giá và danh mục sản phẩm riêng của khách hàng đó</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Product selector & quantity input */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <div className="md:col-span-8">
                        <label className="block text-xs font-bold text-slate-700 mb-1">Chọn sản phẩm cần đặt</label>
                        <select
                          value={selectedProductCode}
                          onChange={(e) => setSelectedProductCode(e.target.value)}
                          className="w-full text-sm border border-slate-200 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-blue-500 outline-none font-semibold text-slate-800"
                        >
                          <option value="">-- Chọn sản phẩm trong Bảng giá 2026 của {poCustomer} --</option>
                          {customerPricingOptions.map((p, i) => {
                            const sell = parseNumber(p["Đơn giá bán"] || p["Đơn giá bán mới"] || p["Giá bán"]);
                            const buy = parseNumber(p["Đơn giá mua"] || p["Giá nhập"] || p["Giá vốn"]);
                            const margin = sell > 0 ? (((sell - buy) / sell) * 100).toFixed(0) : 0;
                            return (
                              <option key={i} value={p["Mã sản phẩm"]}>
                                [{p["Mã sản phẩm"]}] {p["Tên sản phẩm"]} - ĐVT: {p["ĐVT"] || "Cái"} | Giá bán: {formatCurrency(sell)} | HĐ: {p["Số hợp đồng"] || "HĐ 2026"} (Lãi: {margin}%)
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-slate-700 mb-1">Số lượng</label>
                        <input
                          type="number"
                          value={lineQty}
                          onChange={(e) => setLineQty(Math.max(1, parseInt(e.target.value) || 0))}
                          className="w-full text-sm border border-slate-200 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-blue-500 outline-none font-mono font-bold text-slate-800"
                          min="1"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <button
                          type="button"
                          onClick={handleAddPOLine}
                          disabled={!selectedProductCode}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-lg text-sm flex items-center justify-center gap-1.5 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
                        >
                          <Plus size={16} />
                          + Thêm Vào Đơn
                        </button>
                      </div>
                    </div>

                    {/* Quick Click Chips for Products */}
                    {customerPricingOptions.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Gợi ý sản phẩm nổi bật của {poCustomer} (Bấm chọn nhanh):</span>
                        <div className="flex flex-wrap gap-2">
                          {customerPricingOptions.slice(0, 8).map((p, idx) => {
                            const sell = parseNumber(p["Đơn giá bán"] || p["Đơn giá bán mới"] || p["Giá bán"]);
                            const isCurrent = selectedProductCode === p["Mã sản phẩm"];
                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => setSelectedProductCode(p["Mã sản phẩm"])}
                                className={`text-xs px-3 py-1.5 rounded-lg border font-medium flex items-center gap-1.5 transition ${
                                  isCurrent
                                    ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                                    : "bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border-slate-200"
                                }`}
                              >
                                <span className="font-mono font-bold">[{p["Mã sản phẩm"]}]</span>
                                <span className="truncate max-w-[150px]">{p["Tên sản phẩm"]}</span>
                                <span className="font-bold text-[11px] opacity-80">({formatCurrency(sell)})</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 3. KHỐI ĐỐI SOÁT BẢNG GIÁ 2026 & HỢP ĐỒNG GỐC (DUAL PO TABLE) */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg font-bold text-xs">
                      <FileText size={16} />
                    </span>
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm">
                        3. Bảng Đối Chiếu Giá Bán (SO) ↔ Giá Mua Xưởng (PO) ({poLines.length} mặt hàng)
                      </h4>
                      <p className="text-xs text-slate-500">Đối chiếu đồng bộ: Đơn giá bán cho Khách hàng (SO) ↔ Đơn giá mua từ Xưởng sản xuất (PO)</p>
                    </div>
                  </div>

                  {poLines.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setPoLines([])}
                      className="text-xs text-red-600 hover:text-red-700 font-semibold flex items-center gap-1 px-2.5 py-1 rounded hover:bg-red-50 transition"
                    >
                      <Trash2 size={13} />
                      Xóa trắng danh sách
                    </button>
                  )}
                </div>

                {poLines.length === 0 ? (
                  <div className="border-2 border-dashed border-slate-200 rounded-xl p-12 text-center text-slate-400 space-y-2">
                    <ShoppingCart size={36} className="mx-auto text-slate-300" />
                    <p className="font-bold text-sm text-slate-600">Chưa có sản phẩm nào trong đơn hàng</p>
                    <p className="text-xs text-slate-400">Chọn sản phẩm ở khối số 2 hoặc bấm vào một trong các Mẫu PO ở trên để nạp nhanh</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-2xs">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        {/* Tier 1 Header: Functional Groups */}
                        <tr className="bg-slate-100 text-[11px] font-extrabold text-slate-700 border-b border-slate-200">
                          <th className="px-3.5 py-2.5 text-center w-12 border-r border-slate-200" rowSpan={2}>#</th>
                          <th className="px-4 py-2.5 border-r border-slate-200" colSpan={3}>
                            📦 THÔNG TIN MẶT HÀNG & HỢP ĐỒNG
                          </th>
                          <th className="px-4 py-2.5 text-center bg-blue-100/70 text-blue-900 border-r border-blue-200 font-black" colSpan={2}>
                            🛒 ĐƠN BÁN KHÁCH HÀNG (SO)
                          </th>
                          <th className="px-4 py-2.5 text-center bg-purple-100/70 text-purple-900 border-r border-purple-200 font-black" colSpan={2}>
                            🏭 ĐƠN MUA XƯỞNG SẢN XUẤT (PO)
                          </th>
                          <th className="px-4 py-2.5 text-center bg-emerald-100/70 text-emerald-900 border-r border-slate-200 font-black" colSpan={2}>
                            📈 HIỆU QUẢ KINH DOANH
                          </th>
                          <th className="px-3 py-2.5 text-center w-12" rowSpan={2}>Xóa</th>
                        </tr>
                        {/* Tier 2 Header: Detail Columns */}
                        <tr className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-500">
                          <th className="px-4 py-2.5 border-r border-slate-200">Tên Mặt Hàng & Quy Cách</th>
                          <th className="px-3.5 py-2.5 border-r border-slate-200 w-28">HĐ Gốc / Mã Giá</th>
                          <th className="px-3.5 py-2.5 text-center border-r border-slate-200 w-28">Số Lượng Đặt</th>
                          <th className="px-3.5 py-2.5 text-right bg-blue-50/60 text-blue-800 border-r border-slate-200 w-28">Đơn Giá Bán</th>
                          <th className="px-4 py-2.5 text-right bg-blue-50/60 text-blue-900 font-black border-r border-blue-200 w-36">Doanh Thu (SO)</th>
                          <th className="px-3.5 py-2.5 text-right bg-purple-50/60 text-purple-800 border-r border-slate-200 w-32">NCC / Giá Mua</th>
                          <th className="px-4 py-2.5 text-right bg-purple-50/60 text-purple-900 font-black border-r border-purple-200 w-36">Giá Vốn (PO)</th>
                          <th className="px-4 py-2.5 text-right bg-emerald-50/60 text-emerald-900 font-black border-r border-slate-200 w-36">Lãi Gộp</th>
                          <th className="px-3 py-2.5 text-center bg-emerald-50/60 text-emerald-800 border-r border-slate-200 w-24">Biên LN (%)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
                        {poLines.map((line, idx) => {
                          const qty = parseNumber(line["Số lượng"] || line.quantity || 1);
                          const sell = parseNumber(line["Đơn giá bán"] || line.effectivePrice || line.poPrice);
                          const buy = parseNumber(line["Đơn giá nhập"] || line.buyPrice);
                          const lineRev = sell * qty;
                          const lineCost = buy * qty;
                          const lineProfit = lineRev - lineCost;
                          const lineMargin = lineRev > 0 ? (lineProfit / lineRev) * 100 : 0;
                          const prodCode = line["Mã sản phẩm"] || line.code || "-";
                          const prodName = line["Tên sản phẩm"] || line.name || "Sản phẩm";
                          const unit = line["ĐVT"] || line.unit || "Cái";
                          const contractNo = line.contractNo || line["Số hợp đồng"] || "177/HĐ-TLTL";
                          const priceCode = line.priceCode || line["Mã giá bán"] || "Gsp_082";
                          const supplier = line.supplier || line["RP_Nhà cung cấp"] || "Tâm Sen";
                          const suppShort = getSupplierShortCode(supplier);

                          return (
                            <tr key={idx} className="hover:bg-slate-50/90 transition-colors">
                              <td className="px-3.5 py-3.5 text-center font-mono text-slate-400 font-bold border-r border-slate-100">{idx + 1}</td>
                              <td className="px-4 py-3.5 border-r border-slate-100">
                                <div className="font-bold text-slate-900 text-xs">{prodName}</div>
                                <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1.5 mt-1">
                                  <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-bold">{prodCode}</span>
                                  <span className="text-slate-400">•</span>
                                  <span>ĐVT: <strong className="text-slate-700">{unit}</strong></span>
                                </div>
                                <div className="mt-1.5">
                                  <input
                                    type="text"
                                    value={line.specs || line["Quy cách"] || getDefaultSpecs(prodName, prodCode, unit)}
                                    onChange={(e) => {
                                      const updated = [...poLines];
                                      updated[idx] = {
                                        ...updated[idx],
                                        specs: e.target.value,
                                        "Quy cách": e.target.value,
                                        "Quy cách kỹ thuật": e.target.value
                                      };
                                      setPoLines(updated);
                                    }}
                                    placeholder="Quy cách kỹ thuật (in, sóng, chất liệu...)"
                                    className="w-full text-[10px] text-slate-600 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-blue-400 rounded px-1.5 py-0.5 focus:ring-1 focus:ring-blue-500 outline-none transition"
                                    title="Chỉnh sửa quy cách kỹ thuật cho mặt hàng này"
                                  />
                                </div>
                              </td>
                              <td className="px-3.5 py-3.5 border-r border-slate-100">
                                <div className="font-bold text-blue-700 font-mono text-xs">{contractNo}</div>
                                <div className="text-[10px] text-slate-400 font-mono mt-0.5">{priceCode}</div>
                              </td>
                              <td className="px-3.5 py-3.5 text-center border-r border-slate-100 bg-slate-50/30">
                                <div className="inline-flex items-center justify-center">
                                  <input
                                    type="number"
                                    min="1"
                                    value={qty}
                                    onChange={(e) => {
                                      const newQty = Math.max(1, parseInt(e.target.value) || 0);
                                      const updated = [...poLines];
                                      updated[idx] = {
                                        ...updated[idx],
                                        "Số lượng": newQty,
                                        quantity: newQty,
                                        "Thành tiền dòng": sell * newQty
                                      };
                                      setPoLines(updated);
                                    }}
                                    className="w-24 text-center font-mono font-bold text-slate-900 border border-slate-300 rounded-lg py-1 px-1.5 focus:ring-2 focus:ring-blue-500 outline-none bg-white text-xs shadow-2xs"
                                  />
                                </div>
                              </td>
                              <td className="px-3.5 py-3.5 text-right font-mono font-bold text-blue-700 border-r border-slate-100">
                                {formatCurrency(sell)}
                              </td>
                              <td className="px-4 py-3.5 text-right font-mono font-extrabold text-blue-900 bg-blue-50/40 border-r border-blue-100">
                                {formatCurrency(lineRev)}
                              </td>
                              <td className="px-3.5 py-3.5 text-right border-r border-slate-100">
                                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 mb-0.5">
                                  {suppShort}
                                </span>
                                <div className="font-mono text-slate-500 text-[11px] mt-0.5">{formatCurrency(buy)}</div>
                              </td>
                              <td className="px-4 py-3.5 text-right font-mono font-bold text-purple-900 bg-purple-50/40 border-r border-purple-100">
                                {formatCurrency(lineCost)}
                              </td>
                              <td className="px-4 py-3.5 text-right font-mono font-black text-emerald-700 bg-emerald-50/40 border-r border-slate-100">
                                {formatCurrency(lineProfit)}
                              </td>
                              <td className="px-3 py-3.5 text-center border-r border-slate-100">
                                <span className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold inline-flex items-center gap-0.5 ${
                                  lineMargin >= 20 ? "bg-emerald-100 text-emerald-800 border border-emerald-300" : "bg-amber-100 text-amber-800 border border-amber-300"
                                }`}>
                                  {lineMargin.toFixed(1)}%
                                </span>
                              </td>
                              <td className="px-2 py-3.5 text-center">
                                <button
                                  type="button"
                                  onClick={() => setPoLines(poLines.filter((_, i) => i !== idx))}
                                  className="text-slate-300 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition"
                                  title="Xóa dòng sản phẩm này"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      {/* Summary Total Row */}
                      {poLines.length > 0 && (() => {
                        let totalQty = 0;
                        let totalRev = 0;
                        let totalCost = 0;
                        poLines.forEach(l => {
                          const q = parseNumber(l["Số lượng"] || l.quantity || 1);
                          const s = parseNumber(l["Đơn giá bán"] || l.effectivePrice || l.poPrice);
                          const b = parseNumber(l["Đơn giá nhập"] || l.buyPrice);
                          totalQty += q;
                          totalRev += s * q;
                          totalCost += b * q;
                        });
                        const totalProfit = totalRev - totalCost;
                        const avgMargin = totalRev > 0 ? (totalProfit / totalRev) * 100 : 0;

                        return (
                          <tfoot>
                            <tr className="bg-slate-100/90 font-bold border-t-2 border-slate-300 text-slate-800 text-xs">
                              <td colSpan={3} className="px-4 py-3.5 text-right uppercase tracking-wider text-[11px] text-slate-600 border-r border-slate-200">
                                Tổng Cộng ({poLines.length} mặt hàng):
                              </td>
                              <td className="px-3.5 py-3.5 text-center font-mono font-black text-slate-900 border-r border-slate-200">
                                {totalQty.toLocaleString("vi-VN")}
                              </td>
                              <td className="px-3.5 py-3.5 border-r border-slate-200"></td>
                              <td className="px-4 py-3.5 text-right font-mono font-black text-blue-900 bg-blue-100/50 border-r border-blue-200 text-sm">
                                {formatCurrency(totalRev)}
                              </td>
                              <td className="px-3.5 py-3.5 border-r border-slate-200"></td>
                              <td className="px-4 py-3.5 text-right font-mono font-bold text-purple-900 bg-purple-100/50 border-r border-purple-200">
                                {formatCurrency(totalCost)}
                              </td>
                              <td className="px-4 py-3.5 text-right font-mono font-black text-emerald-800 bg-emerald-100/50 border-r border-slate-200 text-sm">
                                {formatCurrency(totalProfit)}
                              </td>
                              <td className="px-3 py-3.5 text-center border-r border-slate-200">
                                <span className={`px-2.5 py-1 rounded-full text-[11px] font-black ${
                                  avgMargin >= 20 ? "bg-emerald-600 text-white" : "bg-amber-500 text-white"
                                }`}>
                                  {avgMargin.toFixed(1)}%
                                </span>
                              </td>
                              <td className="px-2 py-3.5"></td>
                            </tr>
                          </tfoot>
                        );
                      })()}
                    </table>
                  </div>
                )}
              </div>

              {/* 4. KHỐI TỔNG HỢP TÀI CHÍNH, THUẾ VAT & HÀNH ĐỘNG DUAL PO */}
              {poLines.length > 0 && (() => {
                let subtotalSO = 0;
                let subtotalPO = 0;
                poLines.forEach(line => {
                  const qty = parseNumber(line["Số lượng"] || line.quantity || 1);
                  const sell = parseNumber(line["Đơn giá bán"] || line.effectivePrice || line.poPrice);
                  const buy = parseNumber(line["Đơn giá nhập"] || line.buyPrice);
                  subtotalSO += sell * qty;
                  subtotalPO += buy * qty;
                });
                const vatAmount = subtotalSO * (vatRate / 100);
                const totalSOWithVat = subtotalSO + vatAmount;
                const grossProfit = subtotalSO - subtotalPO;
                const margin = subtotalSO > 0 ? (grossProfit / subtotalSO) * 100 : 0;

                return (
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                      <div>
                        <h4 className="font-bold text-slate-800 text-sm">4. Tính Toán Quyết Toán Tài Chính & Thuế VAT</h4>
                        <p className="text-xs text-slate-500">Dự toán doanh thu bán hàng, thuế GTGT, tổng thanh toán và biên lợi nhuận đơn hàng kép</p>
                      </div>

                      {/* VAT Rate Selector */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-600">Thuế suất VAT:</span>
                        <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-bold">
                          {[8, 10, 0].map((rate) => (
                            <button
                              key={rate}
                              type="button"
                              onClick={() => setVatRate(rate)}
                              className={`px-2.5 py-1 rounded-md transition ${
                                vatRate === rate ? "bg-blue-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                              }`}
                            >
                              {rate}%
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* 4 Financial KPI Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                        <span className="text-[11px] text-blue-700 font-semibold block">1. Tiền hàng trước thuế (SO)</span>
                        <span className="text-base font-extrabold text-blue-900 mt-1 block">{formatCurrency(subtotalSO)}</span>
                      </div>

                      <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-100">
                        <span className="text-[11px] text-amber-700 font-semibold block">2. Thuế GTGT VAT ({vatRate}%)</span>
                        <span className="text-base font-extrabold text-amber-900 mt-1 block">{formatCurrency(vatAmount)}</span>
                      </div>

                      <div className="bg-blue-600 text-white p-4 rounded-xl shadow-sm">
                        <span className="text-[11px] text-blue-100 font-semibold block">3. Tổng TT Khách (Đã VAT)</span>
                        <span className="text-base font-extrabold text-white mt-1 block">{formatCurrency(totalSOWithVat)}</span>
                      </div>

                      <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100">
                        <span className="text-[11px] text-emerald-700 font-semibold block">4. Lãi gộp (Biên: {margin.toFixed(1)}%)</span>
                        <span className="text-base font-extrabold text-emerald-700 mt-1 block">{formatCurrency(grossProfit)}</span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-slate-100">
                      <div className="text-xs text-slate-500">
                        Tổng giá vốn Mua xưởng (PO): <strong className="text-purple-700 font-bold">{formatCurrency(subtotalPO)}</strong>
                      </div>

                      <div className="flex gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => { setPoLines([]); setNewPoNumber(""); }}
                          className="border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold px-3.5 py-2.5 rounded-lg text-xs transition"
                        >
                          Xóa trắng
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowDualPOModal(true)}
                          className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 transition shadow-sm hover:scale-[1.02] active:scale-[0.98]"
                        >
                          <Layers size={16} />
                          📄 Xem & In Cặp Văn Bản Dual PO
                        </button>

                        <button
                          type="button"
                          onClick={handleSavePO}
                          className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs flex items-center gap-2 transition shadow-sm shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98]"
                        >
                          <span>Lưu Đơn & Chuyển Sang Bước 2: Phê Duyệt ➔</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ================================================== */}
          {/* STEP 2: PHÊ DUYỆT & KHÓA TIẾN ĐỘ SẢN XUẤT (PO APPROVAL & DISPATCH) */}
          {/* ================================================== */}
          {activeStep === 2 && (
            <div className="space-y-6">
              {/* Header - Apple HIG Style */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.03)] p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shrink-0">
                    <ShieldCheck size={22} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base sm:text-lg tracking-tight">2. Bàn Làm Việc Thẩm Định & Phê Duyệt Đơn Hàng (BOD Approval)</h3>
                    <p className="text-xs text-slate-400 font-normal">Kiểm toán an toàn biên lợi nhuận, đối soát Hợp đồng gốc và phê duyệt phát lệnh sản xuất cho xưởng NCC</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <span className="bg-[#F5F5F7] text-slate-700 font-medium px-3 py-1 rounded-full text-xs border border-slate-200/60">
                    Tổng đơn: <strong className="text-slate-900 font-semibold">{combinedPoHeadersData.length}</strong>
                  </span>
                  {pendingApprovalCount > 0 && (
                    <span className="bg-amber-50 text-amber-700 border border-amber-200/60 font-semibold px-3 py-1 rounded-full text-xs flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                      {pendingApprovalCount} đơn chờ duyệt
                    </span>
                  )}
                </div>
              </div>

              {/* Master - Detail Workspace */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Column: PO Headers List with Smart Tabs & Search (3 cols) - Apple HIG Sidebar */}
                <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.03)] p-4 space-y-3 flex flex-col">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h4 className="font-bold text-xs text-slate-900 tracking-tight">Đơn Hàng Cần Duyệt</h4>
                    <button
                      onClick={() => setActiveStep(1)}
                      className="text-xs text-[#007AFF] hover:text-[#0066D6] font-semibold flex items-center gap-1 transition"
                    >
                      <Plus size={13} />
                      Tạo thêm
                    </button>
                  </div>

                  {/* Filter Tabs - Apple Segmented Control */}
                  <div className="flex bg-[#F5F5F7] p-1 rounded-xl text-xs font-medium gap-1">
                    <button
                      type="button"
                      onClick={() => setApprovalFilter("pending")}
                      className={`flex-1 py-1.5 px-1.5 rounded-lg transition text-center text-[11px] font-semibold ${
                        approvalFilter === "pending"
                          ? "bg-white text-slate-900 shadow-xs"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      Chờ duyệt ({pendingApprovalCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setApprovalFilter("approved")}
                      className={`flex-1 py-1.5 px-1.5 rounded-lg transition text-center text-[11px] font-semibold ${
                        approvalFilter === "approved"
                          ? "bg-white text-slate-900 shadow-xs"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      Đã duyệt ({approvedCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setApprovalFilter("all")}
                      className={`py-1.5 px-2.5 rounded-lg transition text-center text-[11px] font-semibold ${
                        approvalFilter === "all"
                          ? "bg-white text-slate-900 shadow-xs"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      Tất cả
                    </button>
                  </div>

                  {/* Search Box - Apple Spotlight Style */}
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Tìm số PO, khách hàng..."
                      value={approvalSearch}
                      onChange={(e) => setApprovalSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200/80 rounded-xl bg-[#F5F5F7] focus:bg-white focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] outline-none transition"
                    />
                  </div>

                  {/* PO Cards List */}
                  <div className="space-y-2 max-h-[620px] overflow-y-auto pr-1 flex-1">
                    {filteredPoHeadersForApproval.length === 0 ? (
                      <div className="text-center py-12 text-slate-400 text-xs italic bg-[#FBFBFD] rounded-xl border border-dashed border-slate-200 p-4">
                        Không có đơn hàng nào phù hợp với bộ lọc!
                      </div>
                    ) : (
                      filteredPoHeadersForApproval.map((header, idx) => {
                        const headerId = header.id || header["Đơn hàng"];
                        const poNum = header["Đơn hàng"] || headerId;
                        const isSelected = (currentPoForApproval?.id || currentPoForApproval?.["Đơn hàng"]) === headerId ||
                                           (currentPoForApproval?.["Đơn hàng"] === poNum);
                        const isApproved = header["Trạng Thái"]?.includes("Đã phê duyệt") || header["Trạng Thái"]?.includes("Đang sản xuất");

                        return (
                          <div
                            key={idx}
                            onClick={() => setSelectedPoForApproval(poNum)}
                            className={`p-3.5 rounded-xl border transition-all cursor-pointer space-y-2 relative ${
                              isSelected
                                ? "bg-blue-50/70 border-blue-300 ring-2 ring-blue-500/15 shadow-sm"
                                : "bg-white hover:bg-[#FBFBFD] border-slate-200/70 shadow-2xs"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-bold text-xs text-slate-900">{poNum}</span>
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                                isApproved
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200/60"
                                  : "bg-amber-50 text-amber-700 border-amber-200/60"
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${isApproved ? "bg-emerald-500" : "bg-amber-500"}`}></span>
                                {isApproved ? "Đã duyệt" : "Chờ duyệt"}
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-xs">
                              <span className="font-medium text-slate-700 truncate max-w-[140px]">{header["Khách hàng"]}</span>
                              <span className="text-[11px] text-slate-400">{header["Ngày đặt hàng"]}</span>
                            </div>

                            <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-xs">
                              <span className="text-[10.5px] text-slate-400">Giá trị đơn:</span>
                              <strong className="text-slate-900 font-mono font-bold">{formatCurrency(header["Tổng giá trị đơn hàng"])}</strong>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Right Column: Executive Inspection Dashboard & PO Detail (9 cols) */}
                <div className="lg:col-span-9 space-y-6">
                  {currentPoForApproval ? (
                    <>
                      {/* Margin Guard AI Audit & Financial Summary - Executive Presentation */}
                      {(() => {
                        let totalRev = 0;
                        let totalCost = 0;
                        let totalQuantity = 0;
                        currentPoLinesForApproval.forEach(l => {
                          const qty = parseNumber(l["Số lượng"] || l.quantity || 1);
                          const sell = parseNumber(l["Đơn giá bán"] || l.effectivePrice || l.poPrice);
                          const buy = parseNumber(l["Đơn giá nhập"] || l.buyPrice);
                          totalQuantity += qty;
                          totalRev += sell * qty;
                          totalCost += buy * qty;
                        });
                        const profit = totalRev - totalCost;
                        const margin = totalRev > 0 ? (profit / totalRev) * 100 : 0;
                        const isSafe = margin >= 20;
                        const isApproved = currentPoForApproval["Trạng Thái"]?.includes("Đã phê duyệt") || currentPoForApproval["Trạng Thái"]?.includes("Đang sản xuất");

                        return (
                          <div className="space-y-6">
                            {/* Executive Order Header & Ref-Strip (Inspired by open-design Ref-Strip Architecture) */}
                            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.03)] overflow-hidden">
                              <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-widest">Hồ sơ thẩm định BOD</span>
                                    <span className="text-slate-300">•</span>
                                    <span className="text-[11px] font-medium text-slate-500">{currentPoLinesForApproval.length} mặt hàng</span>
                                  </div>
                                  <h3 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-3">
                                    <span className="text-[#007AFF] font-mono font-bold bg-[#007AFF]/10 px-3 py-1 rounded-xl text-lg">
                                      {currentPoForApproval["Đơn hàng"]}
                                    </span>
                                    <span className="text-slate-900 tracking-tight">{currentPoForApproval["Khách hàng"]}</span>
                                  </h3>
                                </div>

                                <div className="flex items-center gap-2.5 flex-wrap">
                                  <span className={`px-3 py-1.5 rounded-full text-xs font-semibold border flex items-center gap-1.5 ${
                                    isSafe
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-200/60"
                                      : "bg-amber-50 text-amber-700 border-amber-200/60"
                                  }`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${isSafe ? "bg-emerald-500" : "bg-amber-500"}`}></span>
                                    {isSafe ? "Biên Lợi Nhuận Đạt Chuẩn" : "Cảnh Báo Biên Lãi Thấp"}
                                  </span>
                                  <span className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                                    isApproved
                                      ? "bg-slate-900 text-white border-slate-900"
                                      : "bg-[#F5F5F7] text-slate-700 border-slate-200/80"
                                  }`}>
                                    {isApproved ? "✅ Đã Phê Duyệt" : "⚡ Chờ Ký Duyệt BOD"}
                                  </span>
                                </div>
                              </div>

                              {/* Ref-Strip Metadata Grid */}
                              <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-slate-100 bg-[#FBFBFD] text-xs">
                                <div className="p-4 space-y-1">
                                  <span className="text-[10.5px] font-medium text-slate-400 uppercase tracking-wider block">Ngày Đặt Hàng</span>
                                  <div className="font-semibold text-slate-800">{currentPoForApproval["Ngày đặt hàng"] || "Hôm nay"}</div>
                                </div>
                                <div className="p-4 space-y-1">
                                  <span className="text-[10.5px] font-medium text-slate-400 uppercase tracking-wider block">Tổng Sản Lượng</span>
                                  <div className="font-bold text-slate-900 tabular-nums">{totalQuantity.toLocaleString("vi-VN")} sản phẩm</div>
                                </div>
                                <div className="p-4 space-y-1">
                                  <span className="text-[10.5px] font-medium text-slate-400 uppercase tracking-wider block">Đơn Vị Đặt Hàng</span>
                                  <div className="font-semibold text-slate-800">Tập Đoàn Tâm Sen</div>
                                </div>
                                <div className="p-4 space-y-1">
                                  <span className="text-[10.5px] font-medium text-slate-400 uppercase tracking-wider block">Đơn Vị Phân Phối</span>
                                  <div className="font-semibold text-slate-800">An Việt Phát Group</div>
                                </div>
                              </div>
                            </div>

                            {/* 4 Financial KPIs Cards - Executive Bento Ledger Grid */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                              {/* 1. Doanh thu bán */}
                              <div className="bg-white hover:bg-[#FBFBFD] p-5 rounded-2xl border border-slate-200/80 shadow-[0_2px_10px_rgba(0,0,0,0.02)] transition-all space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                                    Doanh Thu (SO)
                                  </span>
                                  <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">Bán Khách</span>
                                </div>
                                <div className="text-xl sm:text-2xl font-bold text-slate-900 font-sans tabular-nums tracking-tight">
                                  {formatCurrency(totalRev)}
                                </div>
                                <div className="text-[11px] text-slate-400 font-normal">Chưa gồm VAT 8%</div>
                              </div>

                              {/* 2. Giá vốn xưởng */}
                              <div className="bg-white hover:bg-[#FBFBFD] p-5 rounded-2xl border border-slate-200/80 shadow-[0_2px_10px_rgba(0,0,0,0.02)] transition-all space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                                    Giá Vốn (PO)
                                  </span>
                                  <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-md">Mua Xưởng</span>
                                </div>
                                <div className="text-xl sm:text-2xl font-bold text-slate-900 font-sans tabular-nums tracking-tight">
                                  {formatCurrency(totalCost)}
                                </div>
                                <div className="text-[11px] text-slate-400 font-normal">Định mức mua NCC</div>
                              </div>

                              {/* 3. Lợi nhuận gộp */}
                              <div className="bg-white hover:bg-[#FBFBFD] p-5 rounded-2xl border border-slate-200/80 shadow-[0_2px_10px_rgba(0,0,0,0.02)] transition-all space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                                    Lợi Nhuận Gộp
                                  </span>
                                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">Thực Thu</span>
                                </div>
                                <div className="text-xl sm:text-2xl font-bold text-emerald-600 font-sans tabular-nums tracking-tight">
                                  {formatCurrency(profit)}
                                </div>
                                <div className="text-[11px] text-slate-400 font-normal">Chênh lệch SO - PO</div>
                              </div>

                              {/* 4. Tỷ suất Margin */}
                              <div className={`p-5 rounded-2xl border shadow-[0_2px_10px_rgba(0,0,0,0.02)] transition-all space-y-2 ${
                                isSafe ? "bg-white border-emerald-200/80" : "bg-white border-amber-200/80"
                              }`}>
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                                    Tỷ Suất Margin
                                  </span>
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                    isSafe ? "text-emerald-700 bg-emerald-50" : "text-amber-700 bg-amber-50"
                                  }`}>
                                    {isSafe ? "≥ 20% Chuẩn" : "< 20% Thấp"}
                                  </span>
                                </div>
                                <div className={`text-xl sm:text-2xl font-bold font-sans tabular-nums tracking-tight ${
                                  isSafe ? "text-emerald-600" : "text-amber-600"
                                }`}>
                                  {margin.toFixed(1)}%
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full ${isSafe ? "bg-emerald-500" : "bg-amber-500"}`} 
                                    style={{ width: `${Math.min(margin * 2.5, 100)}%` }}
                                  />
                                </div>
                              </div>
                            </div>

                            {/* AI Notice Card */}
                            <div className="p-4 rounded-2xl bg-[#F5F5F7] border border-slate-200/60 flex items-start gap-3 text-xs text-slate-600">
                              <span className="text-base mt-0.5">✨</span>
                              <div className="leading-relaxed">
                                <strong className="font-bold text-slate-900">Đánh giá kiểm toán tự động: </strong>
                                {isSafe ? (
                                  <span>Đơn hàng đạt biên độ lợi nhuận an toàn ({margin.toFixed(1)}% ≥ 20%). Giá bán SO và giá mua PO khớp khung hợp đồng gốc. Đủ điều kiện phê duyệt & khóa đơn.</span>
                                ) : (
                                  <span>Đơn hàng có tỷ suất lợi nhuận gộp ({margin.toFixed(1)}% &lt; 20%). Ban điều hành cần lưu ý kiểm tra lại bảng giá mua từ nhà cung cấp trước khi khóa đơn.</span>
                                )}
                              </div>
                            </div>

                            {/* Detail Products Table Box - Matrix Reconciliation Presentation */}
                            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.03)] p-6 space-y-4">
                              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                                <div>
                                  <h4 className="font-bold text-slate-900 text-sm">
                                    Chi Tiết Sản Phẩm & Định Mức Giá ({currentPoLinesForApproval.length} mặt hàng)
                                  </h4>
                                  <p className="text-xs text-slate-400 font-normal mt-0.5">Bảng đối soát dòng tiền và thông số kỹ thuật sản xuất</p>
                                </div>
                                <span className="text-xs font-medium text-slate-500 bg-[#F5F5F7] px-3 py-1.5 rounded-full border border-slate-200/60">
                                  Khách hàng: <strong className="text-slate-800 font-semibold">{currentPoForApproval["Khách hàng"]}</strong>
                                </span>
                              </div>

                              {/* Matrix Reconciliation Table */}
                              <div className="overflow-x-auto rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
                                <table className="w-full text-left text-xs border-collapse table-fixed min-w-[1050px]">
                                  <thead>
                                    {/* Tier 1 Header */}
                                    <tr className="bg-[#F5F5F7] border-b border-slate-200/80 text-[11px] font-bold text-slate-700">
                                      <th className="py-3 px-2 text-center w-[4%] border-r border-slate-200/60 text-slate-400 font-semibold align-middle" rowSpan={2}>
                                        #
                                      </th>
                                      <th className="py-3 px-4 border-r border-slate-200/60 text-slate-700 tracking-wide text-left align-middle" colSpan={2}>
                                        MẶT HÀNG & HỢP ĐỒNG GỐC
                                      </th>
                                      <th className="py-3 px-4 text-center text-[#007AFF] bg-blue-50/50 border-r border-slate-200/60 tracking-wide align-middle" colSpan={3}>
                                        ĐƠN BÁN KHÁCH HÀNG (SO)
                                      </th>
                                      <th className="py-3 px-4 text-center text-purple-700 bg-purple-50/50 border-r border-slate-200/60 tracking-wide align-middle" colSpan={2}>
                                        ĐƠN MUA XƯỞNG (PO)
                                      </th>
                                      <th className="py-3 px-4 text-center text-emerald-700 bg-emerald-50/50 tracking-wide align-middle" colSpan={2}>
                                        HIỆU QUẢ TÀI CHÍNH
                                      </th>
                                    </tr>

                                    {/* Tier 2 Header */}
                                    <tr className="bg-[#FAFAFC] border-b border-slate-200/80 text-[10px] uppercase font-semibold text-slate-500 tracking-wider">
                                      <th className="py-2.5 px-4 text-left border-r border-slate-200/60 w-[27%]">Tên Mặt Hàng & Quy Cách</th>
                                      <th className="py-2.5 px-3 text-center border-r border-slate-200/60 w-[10%]">HĐ Gốc / Mã Giá</th>
                                      <th className="py-2.5 px-3 text-right border-r border-slate-200/60 w-[9%]">Số Lượng</th>
                                      <th className="py-2.5 px-3 text-right border-r border-slate-200/60 w-[9%]">Đơn Giá Bán</th>
                                      <th className="py-2.5 px-4 text-right border-r border-slate-200/60 w-[12%] text-blue-900 font-bold">Doanh Thu (SO)</th>
                                      <th className="py-2.5 px-3 text-right border-r border-slate-200/60 w-[10%]">NCC / Giá Mua</th>
                                      <th className="py-2.5 px-4 text-right border-r border-slate-200/60 w-[12%] text-purple-900 font-bold">Giá Vốn (PO)</th>
                                      <th className="py-2.5 px-4 text-right border-r border-slate-200/60 w-[11%] text-emerald-800 font-bold">Lãi Gộp</th>
                                      <th className="py-2.5 px-2 text-center w-[8%]">Biên LN</th>
                                    </tr>
                                  </thead>

                                  <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
                                    {currentPoLinesForApproval.length === 0 ? (
                                      <tr>
                                        <td colSpan={10} className="text-center py-12 text-slate-400 font-normal">
                                          Không có dữ liệu dòng sản phẩm của đơn hàng này
                                        </td>
                                      </tr>
                                    ) : (
                                      currentPoLinesForApproval.map((line, lIdx) => {
                                        const qty = parseNumber(line["Số lượng"] || line.quantity || 1);
                                        const sell = parseNumber(line["Đơn giá bán"] || line.effectivePrice || line.poPrice);
                                        const buy = parseNumber(line["Đơn giá nhập"] || line.buyPrice);
                                        const lineRev = sell * qty;
                                        const lineCost = buy * qty;
                                        const prof = lineRev - lineCost;
                                        const lineMargin = lineRev > 0 ? (prof / lineRev) * 100 : 0;
                                        const prodCode = line["Mã sản phẩm"] || line.code || "-";
                                        const prodName = line["Tên sản phẩm"] || line.name || "Sản phẩm";
                                        const unit = line["ĐVT"] || line.unit || "Cái";
                                        const contractNo = line.contractNo || line["Số hợp đồng"] || "177/HĐ-TLTL";
                                        const priceCode = line.priceCode || line["Mã giá bán"] || "Gsp_082";
                                        const supplier = line.supplier || line["RP_Nhà cung cấp"] || "Tâm Sen";
                                        const suppShort = getSupplierShortCode(supplier);
                                        const specs = line.specs || line["Quy cách"] || getDefaultSpecs(prodName, prodCode, unit);

                                        return (
                                          <tr key={lIdx} className="hover:bg-[#FBFBFD] transition-colors">
                                            {/* STT */}
                                            <td className="px-2 py-3.5 text-center font-medium text-slate-400 border-r border-slate-100 align-middle">
                                              {lIdx + 1}
                                            </td>
                                            
                                            {/* Product Name & Specs */}
                                            <td className="px-4 py-3.5 border-r border-slate-100 align-middle">
                                              <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-bold text-slate-900 text-sm">
                                                  {prodName}
                                                </span>
                                                <span className="bg-[#F5F5F7] text-slate-600 px-2 py-0.5 rounded-md font-mono text-[10px] font-medium border border-slate-200/60">
                                                  {prodCode}
                                                </span>
                                                <span className="text-[11px] text-slate-500 font-medium">
                                                  • ĐVT: <strong className="text-slate-700 font-semibold">{unit}</strong>
                                                </span>
                                              </div>
                                              <div className="mt-1.5 p-2 rounded-xl bg-[#F5F5F7]/80 text-[11px] text-slate-600 leading-snug font-normal" title={specs}>
                                                <span className="font-semibold text-slate-500">Quy cách:</span> {specs}
                                              </div>
                                            </td>

                                            {/* Contract & Price Code */}
                                            <td className="px-3 py-3.5 text-center border-r border-slate-100 align-middle">
                                              <div className="font-semibold text-[#007AFF] font-mono text-xs">{contractNo}</div>
                                              <div className="text-[10px] text-slate-400 font-mono mt-0.5">{priceCode}</div>
                                            </td>

                                            {/* Quantity */}
                                            <td className="px-3 py-3.5 text-right font-bold text-slate-900 tabular-nums border-r border-slate-100 text-xs sm:text-sm align-middle">
                                              {qty.toLocaleString("vi-VN")}
                                            </td>

                                            {/* SO Unit Price */}
                                            <td className="px-3 py-3.5 text-right font-medium text-slate-700 tabular-nums border-r border-slate-100 text-xs align-middle">
                                              {formatCurrency(sell)}
                                            </td>

                                            {/* SO Revenue */}
                                            <td className="px-4 py-3.5 text-right font-bold text-slate-900 tabular-nums border-r border-slate-100 text-xs sm:text-sm align-middle">
                                              {formatCurrency(lineRev)}
                                            </td>

                                            {/* PO Supplier & Buy Price */}
                                            <td className="px-3 py-3.5 text-right border-r border-slate-100 align-middle">
                                              <span className="inline-block px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200/60 rounded-md font-bold text-[10px]">
                                                {suppShort}
                                              </span>
                                              <div className="text-slate-600 tabular-nums text-[11px] mt-0.5 font-medium">{formatCurrency(buy)}</div>
                                            </td>

                                            {/* PO Cost */}
                                            <td className="px-4 py-3.5 text-right font-medium text-slate-900 tabular-nums border-r border-slate-100 text-xs sm:text-sm align-middle">
                                              {formatCurrency(lineCost)}
                                            </td>

                                            {/* Gross Profit */}
                                            <td className="px-4 py-3.5 text-right font-bold text-emerald-600 tabular-nums border-r border-slate-100 text-xs sm:text-sm align-middle">
                                              {formatCurrency(prof)}
                                            </td>

                                            {/* Margin % - Apple Pill */}
                                            <td className="px-2 py-3.5 text-center align-middle">
                                              <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold inline-flex items-center gap-1 tabular-nums ${
                                                lineMargin >= 20 
                                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60" 
                                                  : "bg-amber-50 text-amber-700 border border-amber-200/60"
                                              }`}>
                                                <span className={`h-1.5 w-1.5 rounded-full ${lineMargin >= 20 ? "bg-emerald-500" : "bg-amber-500"}`}></span>
                                                {lineMargin.toFixed(1)}%
                                              </span>
                                            </td>
                                          </tr>
                                        );
                                      })
                                    )}
                                  </tbody>

                                  {/* Summary Total Row */}
                                  {currentPoLinesForApproval.length > 0 && (() => {
                                    return (
                                      <tfoot>
                                        <tr className="bg-[#F5F5F7] text-slate-900 font-bold border-t-2 border-slate-200/80 text-xs">
                                          <td colSpan={3} className="px-4 py-3.5 text-right uppercase tracking-wider text-[11px] text-slate-500 border-r border-slate-200/60 align-middle">
                                            Tổng Cộng ({currentPoLinesForApproval.length} mặt hàng):
                                          </td>
                                          <td className="px-3 py-3.5 text-right font-bold text-slate-900 tabular-nums border-r border-slate-200/60 text-xs sm:text-sm align-middle">
                                            {totalQuantity.toLocaleString("vi-VN")}
                                          </td>
                                          <td className="px-3 py-3.5 border-r border-slate-200/60 align-middle"></td>
                                          <td className="px-4 py-3.5 text-right font-bold text-blue-700 tabular-nums border-r border-slate-200/60 text-xs sm:text-sm align-middle">
                                            {formatCurrency(totalRev)}
                                          </td>
                                          <td className="px-3 py-3.5 border-r border-slate-200/60 align-middle"></td>
                                          <td className="px-4 py-3.5 text-right font-bold text-purple-700 tabular-nums border-r border-slate-200/60 text-xs sm:text-sm align-middle">
                                            {formatCurrency(totalCost)}
                                          </td>
                                          <td className="px-4 py-3.5 text-right font-bold text-emerald-600 tabular-nums border-r border-slate-200/60 text-xs sm:text-sm align-middle">
                                            {formatCurrency(profit)}
                                          </td>
                                          <td className="px-2 py-3.5 text-center align-middle">
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold tabular-nums ${
                                              margin >= 20 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                                            }`}>
                                              {margin.toFixed(1)}%
                                            </span>
                                          </td>
                                        </tr>
                                      </tfoot>
                                    );
                                  })()}
                                </table>
                              </div>

                              {/* Apple HIG Control Bar */}
                              <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-slate-100">
                                <div className="flex items-center gap-2.5 flex-wrap">
                                  <button
                                    type="button"
                                    onClick={() => setShowDualPOModal(true)}
                                    className="bg-[#007AFF] hover:bg-[#0066D6] text-white font-semibold px-4 py-2.5 rounded-xl text-xs sm:text-sm flex items-center gap-2 transition shadow-sm active:scale-[0.98]"
                                  >
                                    <Layers size={16} />
                                    <span>Xem & In Cặp Văn Bản PO</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={handleExportStep2Excel}
                                    className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold px-4 py-2.5 rounded-xl text-xs sm:text-sm border border-emerald-300 transition flex items-center gap-2 shadow-2xs active:scale-[0.98]"
                                    title="Xuất bảng đối soát ra Excel có công thức"
                                  >
                                    <FileSpreadsheet size={16} className="text-emerald-600" />
                                    <span>Xuất Excel</span>
                                  </button>
                                </div>

                                <div className="flex items-center gap-3">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPoCustomer(currentPoForApproval["Khách hàng"] || "");
                                      setNewPoNumber(currentPoForApproval["Đơn hàng"] || "");
                                      setPoLines(currentPoLinesForApproval);
                                      setActiveStep(1);
                                    }}
                                    className="bg-white hover:bg-[#F5F5F7] text-slate-700 font-medium px-4 py-2.5 rounded-xl text-xs sm:text-sm border border-slate-200 transition"
                                  >
                                    Sửa Đơn Ở Bước 1
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleApprovePOFromStep2(currentPoForApproval)}
                                    className="bg-[#34C759] hover:bg-[#2FB34F] text-white font-semibold px-6 py-2.5 rounded-xl text-xs sm:text-sm flex items-center gap-2 transition shadow-sm active:scale-[0.98]"
                                  >
                                    <CheckCircle size={16} />
                                    <span>Phê Duyệt & Khóa Đơn Sản Xuất</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </>
                  ) : (
                    <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-16 text-center text-slate-400">
                      <ShieldCheck size={40} className="mx-auto text-slate-300 mb-3" />
                      <p className="font-semibold text-sm text-slate-600">Vui lòng chọn một đơn hàng bên trái để thẩm định</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ================================================== */}
          {/* STEP 3: LẬP KẾ HOẠCH GIAO HÀNG (DELIVERY PLANNING) */}
          {/* ================================================== */}
          {activeStep === 3 && (
            <div className="space-y-6">
              {/* Step 3 Top Header Bar - Logistics Weekly Operations */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.03)] p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10.5px] font-bold text-blue-600 uppercase tracking-widest bg-blue-50 px-2.5 py-0.5 rounded-md border border-blue-100">
                      Phòng Kế Hoạch Vật Tư & Vận Tải
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="text-xs text-slate-500 font-medium">
                      {activeDeliveryPlans.length} chuyến xe đang điều phối
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
                    <CalendarDays className="text-[#007AFF]" size={22} />
                    <span>Kế Hoạch Điều Vận & Giao Hàng Theo Tuần</span>
                  </h3>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  {/* View Mode Switcher */}
                  <div className="bg-[#F5F5F7] p-1 rounded-xl flex items-center border border-slate-200/60 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setStep3ViewMode("weekly")}
                      className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                        step3ViewMode === "weekly"
                          ? "bg-white text-[#007AFF] shadow-xs font-bold"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <CalendarRange size={14} />
                      <span>Lịch Tuần Trực Quan</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep3ViewMode("list")}
                      className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                        step3ViewMode === "list"
                          ? "bg-white text-[#007AFF] shadow-xs font-bold"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <FileText size={14} />
                      <span>Danh Sách Đơn Cần Giao</span>
                    </button>
                  </div>

                  {/* Week Navigation */}
                  <div className="flex items-center bg-[#F5F5F7] rounded-xl p-1 border border-slate-200/60 text-xs">
                    <button
                      type="button"
                      onClick={() => setSelectedWeekOffset(prev => prev - 1)}
                      className="p-1.5 hover:bg-white rounded-lg text-slate-600 hover:text-slate-900 transition"
                      title="Tuần trước"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedWeekOffset(0)}
                      className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                        selectedWeekOffset === 0 ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      {selectedWeekOffset === 0 ? "Tuần này" : selectedWeekOffset > 0 ? `+${selectedWeekOffset} tuần` : `${selectedWeekOffset} tuần`}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedWeekOffset(prev => prev + 1)}
                      className="p-1.5 hover:bg-white rounded-lg text-slate-600 hover:text-slate-900 transition"
                      title="Tuần sau"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Main Grid: Content Area + Sticky Planning Panel */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left/Main Column: Weekly Calendar Matrix OR Table List */}
                <div className="lg:col-span-8 space-y-6">
                  {step3ViewMode === "weekly" ? (
                    /* WEEKLY CALENDAR MATRIX VIEW */
                    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.03)] p-5 space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm">
                            Ma Trận Điều Xe Tuần ({currentWeekDays[0].dateSlash} - {currentWeekDays[6].dateSlash})
                          </h4>
                          <p className="text-xs text-slate-400 font-normal mt-0.5">
                            Kế hoạch vận tải đồng bộ tự động với Google Calendar
                          </p>
                        </div>
                        <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
                          ⚡ Tự động phân bổ theo xe tải
                        </span>
                      </div>

                      {/* 7 Days Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
                        {currentWeekDays.map((day, dIdx) => {
                          const dayPlans = combinedDeliveryPlanData.filter(p => {
                            if (p.isDeleted) return false;
                            const pDate = p["Ngày giao kế hoạch"] || "";
                            return pDate === day.dateSlash || pDate === day.dateIso;
                          });

                          const dayTotalQty = dayPlans.reduce((sum, p) => sum + parseNumber(p["Số lượng kế hoạch"] || p["Số lượng"]), 0);

                          return (
                            <div
                              key={dIdx}
                              className={`rounded-2xl border transition-all flex flex-col min-h-[300px] ${
                                day.isToday
                                  ? "bg-blue-50/30 border-[#007AFF] shadow-[0_0_0_1px_#007AFF]"
                                  : "bg-[#FBFBFD] border-slate-200/70 hover:border-slate-300"
                              }`}
                            >
                              {/* Day Column Header */}
                              <div className={`p-3 rounded-t-2xl border-b ${
                                day.isToday
                                  ? "bg-[#007AFF] text-white border-[#007AFF]"
                                  : "bg-white text-slate-800 border-slate-100"
                              }`}>
                                <div className="flex items-center justify-between">
                                  <span className={`text-[11px] font-bold uppercase tracking-wider ${day.isToday ? "text-white" : "text-slate-500"}`}>
                                    {day.dayName}
                                  </span>
                                  {day.isToday && (
                                    <span className="text-[9px] bg-white/20 text-white font-bold px-1.5 py-0.5 rounded">HÔM NAY</span>
                                  )}
                                </div>
                                <div className={`text-sm font-bold mt-0.5 tabular-nums ${day.isToday ? "text-white" : "text-slate-900"}`}>
                                  {day.dateSlash.slice(0, 5)}
                                </div>
                                {dayPlans.length > 0 && (
                                  <div className={`text-[10px] mt-1 font-medium ${day.isToday ? "text-blue-100" : "text-slate-400"}`}>
                                    {dayPlans.length} chuyến ({dayTotalQty.toLocaleString("vi-VN")} sp)
                                  </div>
                                )}
                              </div>

                              {/* Day Events / Delivery Cards */}
                              <div className="p-2 space-y-2 flex-1 overflow-y-auto max-h-[420px]">
                                {dayPlans.length === 0 ? (
                                  <div className="h-full flex flex-col items-center justify-center text-center p-3 text-slate-300 text-[11px]">
                                    <span>Trống lịch</span>
                                  </div>
                                ) : (
                                  dayPlans.map((plan, pIdx) => {
                                    const qty = parseNumber(plan["Số lượng kế hoạch"] || plan["Số lượng"]);
                                    const gCalUrl = generateGoogleCalendarUrl(plan);

                                    return (
                                      <div
                                        key={pIdx}
                                        className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-2xs hover:shadow-sm transition space-y-1.5 text-xs group"
                                      >
                                        <div className="flex items-start justify-between gap-1">
                                          <span className="font-bold text-slate-900 text-[11px] leading-tight line-clamp-1">
                                            {plan["Khách hàng"]}
                                          </span>
                                          <span className="text-[9.5px] font-mono text-[#007AFF] bg-blue-50 px-1.5 py-0.5 rounded font-semibold shrink-0">
                                            {plan["Đơn hàng"]}
                                          </span>
                                        </div>

                                        <div className="text-[10.5px] text-slate-600 font-medium line-clamp-2 leading-snug" title={plan["Sản phẩm"]}>
                                          {plan["Sản phẩm"]}
                                        </div>

                                        <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[11px]">
                                          <span className="font-bold text-slate-900 tabular-nums">
                                            {qty.toLocaleString("vi-VN")} <span className="text-[10px] font-normal text-slate-500">{plan["ĐVT"] || "sp"}</span>
                                          </span>
                                          <span className="text-[9.5px] font-semibold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded">
                                            {qty <= 400 ? "🚚 1.25T" : qty <= 800 ? "🚚 3.5T" : qty <= 1200 ? "🚛 5T" : "🚛 15T"}
                                          </span>
                                        </div>

                                        {/* Action buttons on card */}
                                        <div className="pt-1.5 flex items-center justify-between border-t border-slate-100 text-[10.5px]">
                                          <a
                                            href={gCalUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 hover:underline"
                                            title="Thêm vào Google Calendar cá nhân"
                                          >
                                            <ExternalLink size={11} />
                                            <span>Google Cal</span>
                                          </a>

                                          <button
                                            type="button"
                                            onClick={async () => {
                                              await updateDoc(doc(db, "delivery_plans", plan.id || plan["Kế hoạch ID"]), { isDeleted: true });
                                              toast.success("Đã xóa đợt giao!");
                                            }}
                                            className="text-slate-300 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
                                            title="Xóa đợt này"
                                          >
                                            <Trash2 size={12} />
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {/* PO Lines List (Always visible in List mode, or below calendar) */}
                  <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.03)] p-5 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">
                          Danh Sách Dòng PO Chờ Lên Lịch Giao ({activePOLinesNeedPlan.length} mục)
                        </h4>
                        <p className="text-xs text-slate-400 font-normal mt-0.5">
                          Nhấp "Lập kế hoạch" trên bất kỳ dòng nào để phân bổ xe giao hàng
                        </p>
                      </div>
                      <span className="text-xs text-slate-500 font-medium">
                        Cần điều phối: <strong className="text-blue-600 font-bold">{activePOLinesNeedPlan.filter(l => l.qtyNeeded > 0).length} dòng</strong>
                      </span>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-slate-200/80">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-[#F5F5F7] border-b border-slate-200/80 text-[10.5px] uppercase text-slate-600 font-bold tracking-wider">
                            <th className="px-3 py-3 text-center w-10">#</th>
                            <th className="px-3 py-3">Số PO</th>
                            <th className="px-3 py-3">Khách Hàng</th>
                            <th className="px-4 py-3">Tên Sản Phẩm</th>
                            <th className="px-3 py-3 text-right">Tổng Đặt</th>
                            <th className="px-3 py-3 text-right text-emerald-700 bg-emerald-50/40">Đã Giao Thực Tế</th>
                            <th className="px-3 py-3 text-right text-rose-700 bg-rose-50/40">Còn Lại Phải Giao</th>
                            <th className="px-3 py-3 text-right">Đã Lên Lịch</th>
                            <th className="px-3 py-3 text-right">Chưa Lên Lịch</th>
                            <th className="px-3 py-3 text-center">Hành Động</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                          {activePOLinesNeedPlan.length === 0 ? (
                            <tr>
                              <td colSpan={10} className="text-center py-10 text-slate-400 font-normal">
                                🎉 Tất cả các đơn hàng đã được lên lịch giao đầy đủ!
                              </td>
                            </tr>
                          ) : (
                            activePOLinesNeedPlan.map((line, idx) => {
                              const totalQty = parseNumber(line["Số lượng"]);
                              const isFullyDelivered = line.deliveredSum >= totalQty;
                              const isFullyScheduled = line.plannedQtySum >= totalQty;
                              const isSelected = planningPoLine && (planningPoLine["STT"] === line["STT"] || planningPoLine.id === line.id);

                              return (
                                <tr
                                  key={idx}
                                  className={`hover:bg-[#FBFBFD] transition-colors ${
                                    isSelected ? "bg-blue-50/50" : isFullyDelivered ? "bg-emerald-50/20" : isFullyScheduled ? "opacity-80" : ""
                                  }`}
                                >
                                  {/* # */}
                                  <td className="px-3 py-3 text-center font-mono text-slate-400">{idx + 1}</td>
                                  
                                  {/* Số PO */}
                                  <td className="px-3 py-3 font-mono font-semibold text-slate-900">{line["Số đơn hàng"]}</td>
                                  
                                  {/* Khách hàng */}
                                  <td className="px-3 py-3 text-slate-800 font-medium">{line["Khách hàng"]}</td>
                                  
                                  {/* Tên sản phẩm */}
                                  <td className="px-4 py-3 font-semibold text-slate-900 max-w-[200px] truncate" title={line["Tên sản phẩm"]}>
                                    {line["Tên sản phẩm"]}
                                  </td>
                                  
                                  {/* Tổng đặt */}
                                  <td className="px-3 py-3 text-right font-bold text-slate-900 tabular-nums">
                                    {totalQty.toLocaleString("vi-VN")}
                                  </td>

                                  {/* Đã giao thực tế (PXK) */}
                                  <td className="px-3 py-3 text-right tabular-nums bg-emerald-50/20">
                                    <div className="font-bold text-emerald-700">
                                      {(line.deliveredSum || 0).toLocaleString("vi-VN")}
                                    </div>
                                    <div className="text-[10px] text-emerald-600 font-medium">
                                      {line.deliveryProgress || 0}%
                                    </div>
                                  </td>

                                  {/* Còn lại phải giao */}
                                  <td className="px-3 py-3 text-right tabular-nums bg-rose-50/20">
                                    <span className={`font-bold ${line.remainingToDeliver > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                                      {(line.remainingToDeliver || 0).toLocaleString("vi-VN")}
                                    </span>
                                  </td>
                                  
                                  {/* Đã lên lịch */}
                                  <td className="px-3 py-3 text-right font-bold text-blue-700 tabular-nums">
                                    {(line.plannedQtySum || 0).toLocaleString("vi-VN")}
                                  </td>
                                  
                                  {/* Chưa lên lịch */}
                                  <td className="px-3 py-3 text-right font-bold tabular-nums">
                                    <span className={line.qtyNeeded > 0 ? "text-amber-600" : "text-slate-400"}>
                                      {(line.qtyNeeded || 0).toLocaleString("vi-VN")}
                                    </span>
                                  </td>
                                  
                                  {/* Hành động */}
                                  <td className="px-3 py-3 text-center">
                                    <button
                                      type="button"
                                      onClick={() => handleSelectPlanningLine(line)}
                                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition shadow-2xs active:scale-[0.98] ${
                                        isSelected
                                          ? "bg-slate-900 text-white"
                                          : isFullyDelivered
                                          ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                                          : isFullyScheduled
                                          ? "bg-slate-100 hover:bg-slate-200 text-slate-600"
                                          : "bg-[#007AFF] hover:bg-[#0066D6] text-white"
                                      }`}
                                    >
                                      {isSelected ? "Đang chọn" : isFullyDelivered ? "Đã giao đủ" : isFullyScheduled ? "Lên lịch thêm" : "Lập kế hoạch"}
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

                {/* Right Column: Sticky Delivery Planning Form Card (No more scrolling up required!) */}
                <div className="lg:col-span-4 sticky top-6">
                  <div
                    id="delivery-planning-form-card"
                    className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.06)] p-6 space-y-4"
                  >
                    {planningPoLine ? (
                      <div className="space-y-4">
                        <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                          <div>
                            <h3 className="font-bold text-slate-900 text-base">Lên Kế Hoạch Giao Hàng</h3>
                            <p className="text-xs text-slate-400 font-normal mt-0.5">Phân bổ xe tải theo lịch tuần của khách hàng</p>
                          </div>
                          <span className="text-xs font-mono font-bold bg-blue-50 text-[#007AFF] px-2.5 py-1 rounded-lg border border-blue-100">
                            {planningPoLine["Số đơn hàng"]}
                          </span>
                        </div>

                        {/* Order info summary pill with Delivery Status Progress */}
                        <div className="p-3.5 bg-[#FBFBFD] rounded-xl text-xs space-y-2 border border-slate-200/70">
                          <div className="flex justify-between">
                            <span className="text-slate-500">Khách nhận:</span>
                            <span className="font-bold text-slate-900">{planningPoLine["Khách hàng"]}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Sản phẩm:</span>
                            <span className="font-bold text-slate-900 text-right truncate max-w-[180px]" title={planningPoLine["Tên sản phẩm"]}>
                              {planningPoLine["Tên sản phẩm"]}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Tổng đơn đặt:</span>
                            <span className="font-bold text-slate-900 tabular-nums">
                              {parseNumber(planningPoLine["Số lượng"]).toLocaleString("vi-VN")} {planningPoLine["ĐVT"] || "sp"}
                            </span>
                          </div>

                          {/* Real-time Delivery Status */}
                          <div className="pt-2 border-t border-slate-100 space-y-1.5">
                            <div className="flex justify-between items-center text-[11px]">
                              <span className="text-emerald-700 font-semibold flex items-center gap-1">
                                <span>🚚 Đã giao thực tế:</span>
                              </span>
                              <span className="font-bold text-emerald-700 tabular-nums">
                                {(planningPoLine.deliveredSum || 0).toLocaleString("vi-VN")} {planningPoLine["ĐVT"] || "sp"} ({planningPoLine.deliveryProgress || 0}%)
                              </span>
                            </div>
                            <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                              <div 
                                className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                                style={{ width: `${Math.min(planningPoLine.deliveryProgress || 0, 100)}%` }}
                              />
                            </div>
                            <div className="flex justify-between text-[11px] pt-0.5">
                              <span className="text-slate-600 font-medium">Còn lại phải giao:</span>
                              <span className="font-bold text-rose-600 tabular-nums">
                                {(planningPoLine.remainingToDeliver ?? parseNumber(planningPoLine["Số lượng"])).toLocaleString("vi-VN")} {planningPoLine["ĐVT"] || "sp"}
                              </span>
                            </div>
                          </div>

                          <div className="flex justify-between pt-1.5 border-t border-slate-100">
                            <span className="text-amber-700 font-semibold">Chưa lên lịch xe:</span>
                            <span className="font-bold text-amber-700 tabular-nums">
                              {(planningPoLine.qtyNeeded || 0).toLocaleString("vi-VN")} {planningPoLine["ĐVT"] || "sp"}
                            </span>
                          </div>
                        </div>

                        {/* Form Inputs */}
                        <div className="space-y-4 pt-1">
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                              Số lượng giao đợt này
                            </label>
                            <input
                              type="number"
                              value={plannedQty}
                              onChange={(e) => setPlannedQty(Math.max(1, parseInt(e.target.value) || 0))}
                              className="w-full text-sm font-bold text-blue-700 border border-slate-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500 bg-[#FBFBFD]"
                            />

                            {/* Vehicle Presets (Tải trọng chuẩn logistics) */}
                            <div className="mt-2.5 flex flex-wrap gap-1.5">
                              {[400, 800, 1200, 2000].map(val => (
                                <button
                                  key={val}
                                  type="button"
                                  onClick={() => setPlannedQty(val)}
                                  className="px-2.5 py-1 bg-[#F5F5F7] hover:bg-blue-50 text-slate-700 hover:text-blue-700 text-[10.5px] font-semibold rounded-lg border border-slate-200/80 transition-colors"
                                >
                                  {val} (Xe {val === 400 ? "1.25T" : val === 800 ? "3.5T" : val === 1200 ? "5T" : "15T"})
                                </button>
                              ))}
                              <button
                                type="button"
                                onClick={() => setPlannedQty(planningPoLine.qtyNeeded || parseNumber(planningPoLine["Số lượng"]))}
                                className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 text-[10.5px] font-bold rounded-lg border border-amber-200 transition-colors"
                              >
                                Giao hết ({(planningPoLine.qtyNeeded || 0).toLocaleString("vi-VN")})
                              </button>
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                              Ngày giao kế hoạch
                            </label>
                            <input
                              type="date"
                              value={plannedDate}
                              onChange={(e) => setPlannedDate(e.target.value)}
                              className="w-full text-xs font-semibold text-slate-800 border border-slate-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500 bg-[#FBFBFD]"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                              Ghi chú điều xe / Kế hoạch vật tư
                            </label>
                            <textarea
                              placeholder="VD: Điều xe tải 5 tấn giao ca sáng 8h30..."
                              value={planNotes}
                              onChange={(e) => setPlanNotes(e.target.value)}
                              className="w-full text-xs border border-slate-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500 h-20 resize-none bg-[#FBFBFD]"
                            />
                          </div>
                        </div>

                        {/* Submit Actions */}
                        <div className="pt-2 flex gap-3">
                          <button
                            type="button"
                            onClick={() => setPlanningPoLine(null)}
                            className="w-1/3 border border-slate-200 text-slate-600 text-xs font-semibold py-2.5 rounded-xl hover:bg-slate-50 transition"
                          >
                            Đóng
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveDeliveryPlan}
                            className="w-2/3 bg-[#007AFF] hover:bg-[#0066D6] text-white text-xs font-bold py-2.5 rounded-xl transition shadow-sm active:scale-[0.98] flex items-center justify-center gap-1.5"
                          >
                            <CheckCircle size={15} />
                            <span>Xác Nhận Lưu Đợt Này</span>
                          </button>
                        </div>

                        {/* Existing plans for this line */}
                        {deliveryPlanData.filter(p => !p.isDeleted && p["Chi tiết đơn hàng"] === planningPoLine["STT"]).length > 0 && (
                          <div className="mt-5 pt-4 border-t border-slate-100">
                            <h4 className="text-[10.5px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">
                              Các đợt đã lên lịch ({deliveryPlanData.filter(p => !p.isDeleted && p["Chi tiết đơn hàng"] === planningPoLine["STT"]).length})
                            </h4>
                            <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                              {deliveryPlanData
                                .filter(p => !p.isDeleted && p["Chi tiết đơn hàng"] === planningPoLine["STT"])
                                .map((p, i) => {
                                  const gUrl = generateGoogleCalendarUrl(p);
                                  return (
                                    <div key={i} className="flex items-center justify-between p-2.5 bg-[#FBFBFD] border border-slate-200/80 rounded-xl text-xs">
                                      <div>
                                        <div className="font-bold text-slate-800 tabular-nums">
                                          {parseNumber(p["Số lượng kế hoạch"] || p["Số lượng"]).toLocaleString("vi-VN")} {planningPoLine["ĐVT"] || "sp"}
                                        </div>
                                        <div className="text-[10.5px] text-slate-400">{p["Ngày giao kế hoạch"]}</div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <a
                                          href={gUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-blue-600 hover:text-blue-800 p-1.5 bg-blue-50 rounded-lg hover:bg-blue-100 transition flex items-center gap-1 text-[11px] font-semibold"
                                          title="Đồng bộ vào Google Calendar"
                                        >
                                          <Calendar size={13} />
                                          <span>Google Cal</span>
                                        </a>
                                        <button
                                          type="button"
                                          onClick={async () => {
                                            await updateDoc(doc(db, "delivery_plans", p.id || p["Kế hoạch ID"]), { isDeleted: true });
                                            toast.success("Đã xóa đợt giao!");
                                          }}
                                          className="p-1 text-slate-400 hover:text-rose-600 rounded"
                                          title="Xóa đợt này"
                                        >
                                          <Trash2 size={13} />
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="h-64 flex flex-col items-center justify-center text-center p-4">
                        <Calendar size={40} className="text-slate-200 mb-2.5" />
                        <p className="text-sm text-slate-700 font-bold">Chưa chọn dòng đơn hàng</p>
                        <p className="text-xs text-slate-400 mt-1 max-w-[220px]">
                          Vui lòng chọn nút <strong>Lập kế hoạch</strong> trên bảng bên trái để cấu hình chuyến xe
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: GIAO HÀNG (PXK ENTRY) */}
          {/* ================================================== */}
          {activeStep === 4 && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left side: list of planned delivery jobs */}
              <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
                <div>
                  <h3 className="font-bold text-slate-800 text-base">Danh sách kế hoạch giao hàng đang vận hành</h3>
                  <p className="text-xs text-slate-500">Chọn kế hoạch dưới đây để xác nhận thực giao và tạo Phiếu xuất kho (PXK)</p>
                </div>

                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase text-slate-500 font-bold">
                        <th className="px-3 py-2.5">Kế hoạch ID</th>
                        <th className="px-3 py-2.5">Đơn hàng PO</th>
                        <th className="px-3 py-2.5">Khách hàng</th>
                        <th className="px-3 py-2.5">Sản phẩm</th>
                        <th className="px-3 py-2.5 text-right">SL Kế hoạch</th>
                        <th className="px-3 py-2.5">Ngày dự kiến</th>
                        <th className="px-3 py-2.5 text-center">Hành động</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                      {activeDeliveryPlans.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="text-center py-6 text-slate-400 italic">
                            Hiện không có lịch trình giao hàng chờ xử lý!
                          </td>
                        </tr>
                      ) : (
                        activeDeliveryPlans.map((plan, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="px-3 py-3 font-mono font-bold text-blue-700">{plan["Kế hoạch ID"] || plan.id}</td>
                            <td className="px-3 py-3 font-medium">{plan["Đơn hàng"]}</td>
                            <td className="px-3 py-3">{plan["Khách hàng"]}</td>
                            <td className="px-3 py-3 truncate max-w-[130px]" title={plan["Sản phẩm"]}>{plan["Sản phẩm"]}</td>
                            <td className="px-3 py-3 text-right font-bold">
                              {parseNumber(plan["Số lượng kế hoạch"] || plan["Số lượng"]).toLocaleString("vi-VN")}
                            </td>
                            <td className="px-3 py-3 text-slate-500 font-medium">{plan["Ngày giao kế hoạch"]}</td>
                            <td className="px-3 py-3 text-center">
                              <button
                                onClick={() => handleSelectPlanForDelivery(plan)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-2 py-1 rounded text-[11px] transition shadow-sm"
                              >
                                Xác nhận xuất PXK
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Right side: Delivery Form */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
                {selectedPlan ? (
                  <div className="space-y-4">
                    <div className="border-b border-slate-100 pb-2">
                      <h3 className="font-bold text-slate-800 text-sm">Xác nhận giao hàng thực tế</h3>
                      <p className="text-[11px] text-slate-500">Khai báo số lượng giao thực và ghi nhận sự cố nếu có</p>
                    </div>

                    <div className="p-3 bg-emerald-50 text-emerald-800 text-xs space-y-1.5 rounded-lg border border-emerald-100">
                      <div><strong>Kế hoạch ID:</strong> {selectedPlan["Kế hoạch ID"] || selectedPlan.id}</div>
                      <div><strong>Sản phẩm:</strong> {selectedPlan["Sản phẩm"]}</div>
                      <div><strong>Khách nhận:</strong> {selectedPlan["Khách hàng"]}</div>
                      <div><strong>Kế hoạch giao:</strong> {parseNumber(selectedPlan["Số lượng kế hoạch"] || selectedPlan["Số lượng"]).toLocaleString("vi-VN")}</div>
                    </div>

                    <div className="space-y-3 pt-2">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Số Phiếu Xuất Kho (PXK)</label>
                          <input
                            type="text"
                            value={pxkNumber}
                            onChange={(e) => setPxkNumber(e.target.value)}
                            className="w-full text-xs border border-slate-200 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500 font-mono font-bold text-blue-700"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Số Biên Bản Bàn Giao (BBBG)</label>
                          <input
                            type="text"
                            value={bbbgNumber}
                            onChange={(e) => setBbbgNumber(e.target.value)}
                            className="w-full text-xs border border-slate-200 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500 font-mono font-bold text-emerald-700"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Số lượng thực giao</label>
                          <input
                            type="number"
                            value={deliveredQty}
                            onChange={(e) => setDeliveredQty(Math.max(1, parseInt(e.target.value) || 0))}
                            className="w-full text-xs border border-slate-200 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-800"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Thủ kho / Người nhận ký</label>
                          <input
                            type="text"
                            placeholder="Tên thủ kho nhận hàng"
                            value={receiverSigner}
                            onChange={(e) => setReceiverSigner(e.target.value)}
                            className="w-full text-xs border border-slate-200 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Ngày giao thực tế</label>
                        <input
                          type="date"
                          value={actualDate}
                          onChange={(e) => setActualDate(e.target.value)}
                          className="w-full text-xs border border-slate-200 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Nhà vận tải</label>
                        <select
                          value={carrier}
                          onChange={(e) => setCarrier(e.target.value)}
                          className="w-full text-xs border border-slate-200 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">-- Chọn đơn vị vận chuyển --</option>
                          {supplierData.map((s, i) => (
                            <option key={i} value={s["Tên Nhà Cung Cấp"] || s.id}>{s["Tên Nhà Cung Cấp"]}</option>
                          ))}
                        </select>
                      </div>

                      {/* Incident report gate */}
                      <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={hasIncident}
                            onChange={(e) => setHasIncident(e.target.checked)}
                            className="rounded border-slate-300 text-red-600 focus:ring-red-500 w-4 h-4"
                          />
                          <span className="text-xs font-bold text-red-600 flex items-center gap-1">
                            <AlertTriangle size={14} />
                            Báo cáo sự cố giao hàng
                          </span>
                        </label>

                        {hasIncident && (
                          <div className="mt-2.5">
                            <textarea
                              placeholder="Chi tiết sự cố (VD: Hàng bị ẩm, móp méo, trễ container 2 tiếng...)"
                              value={incidentDetail}
                              onChange={(e) => setIncidentDetail(e.target.value)}
                              className="w-full text-xs border border-slate-200 rounded-lg p-2 outline-none focus:ring-2 focus:ring-red-500 h-16 resize-none"
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-2 flex gap-2">
                      <button
                        onClick={() => setSelectedPlan(null)}
                        className="w-1/2 border border-slate-200 text-slate-600 text-xs font-bold py-2 rounded-lg hover:bg-slate-50 transition"
                      >
                        Hủy
                      </button>
                      <button
                        onClick={handleSaveDeliveryRecord}
                        className="w-1/2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 rounded-lg transition"
                      >
                        Xuất hàng ngay
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="h-64 flex flex-col items-center justify-center text-center p-4">
                    <Truck size={36} className="text-slate-300 mb-2 animate-bounce" />
                    <p className="text-xs text-slate-500 font-medium">Chưa chọn lịch trình nào</p>
                    <p className="text-[10px] text-slate-400 mt-1 max-w-[200px]">Chọn một kế hoạch bên trái để điền số lượng và xuất phiếu PXK thực tế</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================================================== */}
          {/* STEP 5: KIỂM TRA, ĐỐI SOÁT DỮ LIỆU */}
          {/* ================================================== */}
          {activeStep === 5 && (
            <div className="space-y-6">
              {/* Alert Metrics bar */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Tổng số dòng PO</span>
                  <span className="text-2xl font-extrabold text-slate-800 mt-2">{reconcileStats.totalLines}</span>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Khớp giao 100%</span>
                  <span className="text-2xl font-extrabold text-emerald-600 mt-2">{reconcileStats.matched}</span>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Giao thiếu hàng</span>
                  <span className="text-2xl font-extrabold text-amber-600 mt-2">{reconcileStats.short}</span>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Giao thừa hàng</span>
                  <span className="text-2xl font-extrabold text-purple-600 mt-2">{reconcileStats.over}</span>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                  <span className="text-[10px] font-bold text-red-500 uppercase flex items-center gap-1">
                    <AlertCircle size={10} />
                    Sự cố ghi nhận
                  </span>
                  <span className="text-2xl font-extrabold text-red-600 mt-2">{reconcileStats.incidents}</span>
                </div>
              </div>

              {/* Data Table */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-slate-800 text-base">Hệ thống đối soát chéo Đơn đặt (PO) và Thực giao (PXK)</h3>
                    <p className="text-xs text-slate-500">Tự động phát hiện chênh lệch sản lượng, lỗi giao nhận và các lô hàng bị sự cố</p>
                  </div>
                  {/* Status Filters & CTA */}
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex gap-1.5 flex-wrap">
                      {[
                        { key: "all", label: "Tất cả" },
                        { key: "Khớp 100%", label: "Khớp 100%" },
                        { key: "Giao thiếu", label: "Giao thiếu" },
                        { key: "Giao thừa", label: "Giao thừa" },
                        { key: "Chưa giao", label: "Chưa giao" },
                        { key: "incident", label: "Có sự cố" }
                      ].map((btn) => (
                        <button
                          key={btn.key}
                          onClick={() => setReconcileFilter(btn.key)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                            reconcileFilter === btn.key
                              ? "bg-blue-600 text-white shadow-sm"
                              : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200"
                          }`}
                        >
                          {btn.label}
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={() => setActiveStep(6)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition shadow-sm hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <span>Lập Hóa đơn & Quyết toán Kế toán</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase text-slate-500 font-bold">
                        <th className="px-4 py-3">Mã dòng PO</th>
                        <th className="px-4 py-3">Số Đơn Hàng PO</th>
                        <th className="px-4 py-3">Khách hàng</th>
                        <th className="px-4 py-3">Sản phẩm</th>
                        <th className="px-4 py-3 text-right">S.Lượng Đặt</th>
                        <th className="px-4 py-3 text-right">Lên KH</th>
                        <th className="px-4 py-3 text-right">Thực Giao</th>
                        <th className="px-4 py-3 text-right">Hụt PO</th>
                        <th className="px-4 py-3 text-right">Hụt KH</th>
                        <th className="px-4 py-3">Hiện trạng</th>
                        <th className="px-4 py-3 text-center">Sự cố</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                      {filteredReconciliation.length === 0 ? (
                        <tr>
                          <td colSpan={11} className="text-center py-6 text-slate-400 italic">
                            Không có kết quả đối soát khớp với bộ lọc!
                          </td>
                        </tr>
                      ) : (
                        filteredReconciliation.map((rec, index) => {
                          const hasIncidentFlag = rec.incidents.length > 0;
                          return (
                            <tr key={index} className="hover:bg-slate-50">
                              <td className="px-4 py-3 font-mono font-medium text-slate-500">{rec.line["STT"]}</td>
                              <td className="px-4 py-3 font-semibold">{rec.line["Số đơn hàng"]}</td>
                              <td className="px-4 py-3 font-medium">{rec.line["Khách hàng"]}</td>
                              <td className="px-4 py-3 truncate max-w-[150px]" title={rec.line["Tên sản phẩm"]}>{rec.line["Tên sản phẩm"]}</td>
                              <td className="px-4 py-3 text-right font-bold text-slate-600">{(rec.ordered || 0).toLocaleString("vi-VN")}</td>
                              <td className="px-4 py-3 text-right font-bold text-blue-600 bg-blue-50/30">{(rec.totalPlanned || 0).toLocaleString("vi-VN")}</td>
                              <td className="px-4 py-3 text-right font-bold text-slate-800">{(rec.totalDelivered || 0).toLocaleString("vi-VN")}</td>
                              <td className={`px-4 py-3 text-right font-bold ${
                                rec.diffVsOrder === 0 ? "text-slate-500" : rec.diffVsOrder > 0 ? "text-purple-600" : "text-amber-600"
                              }`}>
                                {rec.diffVsOrder > 0 ? `+${rec.diffVsOrder}` : rec.diffVsOrder}
                              </td>
                              <td className={`px-4 py-3 text-right font-bold ${
                                rec.diffVsPlan === 0 ? "text-slate-500" : rec.diffVsPlan > 0 ? "text-purple-600" : "text-amber-600"
                              }`}>
                                {rec.diffVsPlan > 0 ? `+${rec.diffVsPlan}` : rec.diffVsPlan}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-1 rounded text-[10px] font-bold ${rec.statusColor}`}>
                                  {rec.status}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                {hasIncidentFlag ? (
                                  <span className="bg-red-50 text-red-600 text-[10px] font-bold px-2 py-0.5 rounded-full inline-block border border-red-100 animate-pulse" title={rec.incidents.map(i => i["Chi tiết sự cố"]).join("; ")}>
                                    {rec.incidents.length} lỗi
                                  </span>
                                ) : (
                                  <span className="text-slate-400 font-medium">-</span>
                                )}
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
          )}

          {/* ================================================== */}
          {/* STEP 6: HÓA ĐƠN VAT, CÔNG NỢ & BÁO CÁO TÀI CHÍNH */}
          {/* ================================================== */}
          {activeStep === 6 && (
            <div className="space-y-6">
              {/* Financial KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-400 uppercase">Doanh thu bán</span>
                    <TrendingUp size={16} className="text-blue-600" />
                  </div>
                  <div className="text-lg font-extrabold text-slate-900">{formatCurrency(financialSummary.revenueSum)}</div>
                  <span className="text-[10px] text-slate-500 font-medium block">Từ phiếu PXK thực tế</span>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-400 uppercase">Giá vốn đầu vào (COGS)</span>
                    <Package size={16} className="text-slate-400" />
                  </div>
                  <div className="text-lg font-bold text-slate-600">{formatCurrency(financialSummary.cogsSum)}</div>
                  <span className="text-[10px] text-slate-500 font-medium block">Chi phí mua NCC gốc</span>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-emerald-600 uppercase">Lợi nhuận gộp</span>
                    <DollarSign size={16} className="text-emerald-600" />
                  </div>
                  <div className="text-lg font-extrabold text-emerald-600">{formatCurrency(financialSummary.profitSum)}</div>
                  <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-bold inline-block">
                    Biên LN: {financialSummary.marginAvg.toFixed(2)}%
                  </span>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-purple-600 uppercase">Hoa hồng môi giới (3%)</span>
                    <Award size={16} className="text-purple-600" />
                  </div>
                  <div className="text-lg font-extrabold text-purple-700">
                    {formatCurrency(financialSummary.profitSum * 0.03)}
                  </div>
                  <span className="text-[10px] text-purple-600 font-medium block">Trích theo lợi nhuận gộp</span>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-orange-500 uppercase">Công nợ phải thu</span>
                    <Users size={16} className="text-orange-500" />
                  </div>
                  <div className="text-lg font-extrabold text-blue-600">
                    {formatCurrency(receivablesByCustomer.reduce((sum, c) => sum + c.val, 0))}
                  </div>
                  <span className="text-[10px] text-slate-500 font-medium block">Chưa thanh toán</span>
                </div>
              </div>

              {/* Receivables/Payables detailed list */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Receivables */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3">
                  <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                    <Users size={16} className="text-blue-600" />
                    Bảng Công nợ Phải thu (Khách hàng)
                  </h4>
                  <div className="divide-y divide-slate-100 max-h-[160px] overflow-y-auto pr-1">
                    {receivablesByCustomer.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center py-2 text-xs">
                        <span className="font-bold text-slate-700">{item.name}</span>
                        <span className="text-blue-700 font-extrabold">{formatCurrency(item.val)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Payables */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3">
                  <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                    <Users size={16} className="text-red-500" />
                    Bảng Công nợ Phải trả (Nhà cung cấp / Vận chuyển)
                  </h4>
                  <div className="divide-y divide-slate-100 max-h-[160px] overflow-y-auto pr-1">
                    {payablesBySupplier.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center py-2 text-xs">
                        <span className="font-bold text-slate-700">{item.name}</span>
                        <span className="text-red-600 font-bold">{formatCurrency(item.val)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Accounting Audit log */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm">Bảng kê chứng từ xuất Hóa đơn GTGT & Quyết toán công nợ</h4>
                    <p className="text-xs text-slate-500">Khớp số liệu giao nhận thực tế với trạng thái hóa đơn điện tử và dòng tiền</p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {[
                      { key: "all", label: "Tất cả" },
                      { key: "Chưa xuất", label: "Chưa xuất VAT" },
                      { key: "Đã xuất VAT", label: "Đã xuất VAT" },
                      { key: "Chưa thu tiền", label: "Chưa thu nợ" },
                      { key: "Nợ quá hạn", label: "Quá hạn ⚠️" },
                      { key: "Đã thu tiền", label: "Đã tất toán" }
                    ].map((btn) => (
                      <button
                        key={btn.key}
                        onClick={() => setAccountingFilter(btn.key)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                          accountingFilter === btn.key
                            ? "bg-blue-600 text-white shadow-xs"
                            : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200"
                        }`}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase text-slate-500 font-bold">
                        <th className="px-4 py-3">Số PXK / BBBG</th>
                        <th className="px-4 py-3">Đơn hàng PO</th>
                        <th className="px-4 py-3">Khách hàng</th>
                        <th className="px-4 py-3">Sản phẩm</th>
                        <th className="px-4 py-3 text-right">Số lượng giao</th>
                        <th className="px-4 py-3 text-right">Doanh thu</th>
                        <th className="px-4 py-3 text-right">Hoa hồng (3%)</th>
                        <th className="px-4 py-3">Trạng thái Hóa đơn</th>
                        <th className="px-4 py-3">Quyết toán Thu</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                      {deliveryData.filter(d => {
                        if (d.isDeleted) return false;
                        if (accountingFilter === "all") return true;
                        if (accountingFilter === "Chưa xuất" || accountingFilter === "Đã xuất VAT") {
                          return (d["InvoiceStatus"] || "Chưa xuất") === accountingFilter;
                        }
                        if (accountingFilter === "Chưa thu tiền" || accountingFilter === "Nợ quá hạn" || accountingFilter === "Đã thu tiền") {
                          return (d["AccountingStatus"] || "Chưa thu tiền") === accountingFilter;
                        }
                        return true;
                      }).map((d, index) => {
                        const qty = parseNumber(d["Số lượng giao"]);
                        const sellPrice = parseNumber(d["Đơn giá bán"]);
                        const buyPrice = parseNumber(d["Đơn giá nhập"]);
                        const rev = sellPrice * qty;
                        const profit = (sellPrice - buyPrice) * qty;
                        const comm = profit * 0.03;

                        return (
                          <tr key={index} className="hover:bg-slate-50">
                            <td className="px-4 py-3">
                              <span className="font-mono font-bold text-blue-700 block">{d["Số PXK"] || "-"}</span>
                              {d["Số BBBG"] && (
                                <span className="text-[10px] text-slate-400 font-mono block">{d["Số BBBG"]}</span>
                              )}
                            </td>
                            <td className="px-4 py-3 font-medium text-slate-600">{d["Đơn hàng"]}</td>
                            <td className="px-4 py-3 font-semibold">{d["Khách hàng"]}</td>
                            <td className="px-4 py-3 truncate max-w-[130px]">{d["Tên sản phẩm"]}</td>
                            <td className="px-4 py-3 text-right font-bold">{(qty || 0).toLocaleString("vi-VN")}</td>
                            <td className="px-4 py-3 text-right font-extrabold text-blue-700">{formatCurrency(rev)}</td>
                            <td className="px-4 py-3 text-right font-bold text-purple-600">{formatCurrency(comm > 0 ? comm : 0)}</td>
                            <td className="px-4 py-3">
                              <select
                                value={d["InvoiceStatus"] || "Chưa xuất"}
                                onChange={(e) => handleUpdateAccountingStatus(d.id, "InvoiceStatus", e.target.value)}
                                className="bg-slate-50 border border-slate-200 rounded text-[11px] p-1 font-semibold"
                              >
                                <option value="Chưa xuất">Chưa xuất VAT</option>
                                <option value="Đã xuất VAT">Đã xuất VAT</option>
                                <option value="Hủy hóa đơn">Hủy hóa đơn</option>
                              </select>
                            </td>
                            <td className="px-4 py-3">
                              <select
                                value={d["AccountingStatus"] || "Chưa thu tiền"}
                                onChange={(e) => handleUpdateAccountingStatus(d.id, "AccountingStatus", e.target.value)}
                                className={`border rounded text-[11px] p-1 font-semibold ${
                                  d["AccountingStatus"] === "Đã thu tiền"
                                    ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                    : d["AccountingStatus"] === "Nợ quá hạn"
                                    ? "bg-rose-50 border-rose-200 text-rose-700"
                                    : "bg-amber-50 border-amber-200 text-amber-700"
                                }`}
                              >
                                <option value="Chưa thu tiền">Chưa thu tiền</option>
                                <option value="Đã thu tiền">Đã thu tiền (Xong)</option>
                                <option value="Nợ quá hạn">Nợ quá hạn ⚠️</option>
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Dual PO Review and Approval Modal */}
      <DualPODocumentModal
        isOpen={showDualPOModal}
        onClose={() => setShowDualPOModal(false)}
        customerPoNumber={
          activeStep === 2
            ? (currentPoForApproval ? (currentPoForApproval["Đơn hàng"] || currentPoForApproval.id) : newPoNumber)
            : (newPoNumber || "26/KHVT/0744")
        }
        poCustomer={
          activeStep === 2
            ? (currentPoForApproval ? currentPoForApproval["Khách hàng"] : poCustomer)
            : (poCustomer || "Thăng Long")
        }
        poDate={
          activeStep === 2
            ? (currentPoForApproval ? currentPoForApproval["Ngày đặt hàng"] : poDate)
            : poDate
        }
        poLines={
          activeStep === 2
            ? currentPoLinesForApproval
            : poLines
        }
        supplierData={supplierData}
        productData={productData}
        pricingData={pricingData}
        onApproveAndProceed={() => {
          setShowDualPOModal(false);
          if (activeStep === 1) {
            handleSavePO();
          } else if (activeStep === 2 && currentPoForApproval) {
            handleApprovePOFromStep2(currentPoForApproval);
          }
        }}
      />
    </div>
  );
}
