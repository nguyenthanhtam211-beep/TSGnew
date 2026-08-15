import React, { useState, useMemo } from "react";
import { motion } from "motion/react";
import { 
  ShoppingCart, FileText, Calendar, Truck, CheckSquare, BarChart3, 
  ArrowRight, Plus, CheckCircle, AlertTriangle, AlertCircle, 
  TrendingUp, DollarSign, Download, Users, Package, RefreshCw, ChevronRight, Calculator, Check, FileSpreadsheet,
  Camera, Upload, Sparkles, ShieldCheck, Eye, Layers, Loader2
} from "lucide-react";
import { db } from "../firebase";
import { collection, addDoc, doc, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { toast } from "react-hot-toast";
import * as XLSX from "xlsx";
import { PriceReconciliationPanel } from "./PriceReconciliationPanel";
import { DualPODocumentModal } from "./DualPODocumentModal";
import { findPriceRecord } from "../lib/business-logic";
import { exportGenericTableToPDF, formatVND } from "../lib/pdf-exporter";

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
  const [planningPoLine, setPlanningPoLine] = useState<any | null>(null);
  const [plannedQty, setPlannedQty] = useState<number>(0);
  const [plannedDate, setPlannedDate] = useState(new Date().toISOString().split("T")[0]);
  const [planNotes, setPlanNotes] = useState("");

  // States for Step 4 (Giao hàng)
  const [selectedPlan, setSelectedPlan] = useState<any | null>(null);
  const [pxkNumber, setPxkNumber] = useState("");
  const [deliveredQty, setDeliveredQty] = useState<number>(0);
  const [actualDate, setActualDate] = useState(new Date().toISOString().split("T")[0]);
  const [carrier, setCarrier] = useState("");
  const [hasIncident, setHasIncident] = useState(false);
  const [incidentDetail, setIncidentDetail] = useState("");

  // Filter for Step 5 (Đối soát)
  const [reconcileFilter, setReconcileFilter] = useState("all");

  const formatCurrency = (value: any) => {
    const num = parseFloat(String(value || "0").replace(/,/g, ''));
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(isNaN(num) ? 0 : num);
  };

  const parseNumber = (val: any) => {
    const parsed = parseFloat(String(val || "0").replace(/,/g, ''));
    return isNaN(parsed) ? 0 : parsed;
  };

  // --------------------------------------------------
  // STEP 1 calculations
  // --------------------------------------------------
  const activePricingOptions = useMemo(() => {
    if (!calcCustomer) return pricingData;
    return pricingData.filter(p => p["RP_Khách hàng"] === calcCustomer || p["Giao đến"] === calcCustomer);
  }, [pricingData, calcCustomer]);

  const selectedPriceRecord = useMemo(() => {
    if (!calcProduct) return null;
    return pricingData.find(p => p["Mã sản phẩm"] === calcProduct && (!calcCustomer || p["RP_Khách hàng"] === calcCustomer));
  }, [pricingData, calcProduct, calcCustomer]);

  const step1Calculation = useMemo(() => {
    if (!selectedPriceRecord) return null;
    const buyPrice = parseNumber(selectedPriceRecord["Đơn giá mua"]);
    const sellPrice = parseNumber(selectedPriceRecord["Đơn giá bán"] || selectedPriceRecord["Đơn giá bán mới"]);
    const revenue = sellPrice * calcQty;
    const cogs = buyPrice * calcQty;
    const profit = revenue - cogs;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

    return { buyPrice, sellPrice, revenue, cogs, profit, margin };
  }, [selectedPriceRecord, calcQty]);

  const handleApplyCalcToPO = () => {
    if (!selectedPriceRecord || !step1Calculation) return;
    setPoCustomer(calcCustomer);
    setNewPoNumber(`PO-${calcCustomer.toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`);
    setPoLines([
      {
        id: `temp-${Date.now()}`,
        "Mã sản phẩm": selectedPriceRecord["Mã sản phẩm"],
        "Tên sản phẩm": selectedPriceRecord["Tên sản phẩm"],
        "ĐVT": selectedPriceRecord["ĐVT"] || "Cái",
        "Số lượng": calcQty,
        "Đơn giá bán": step1Calculation.sellPrice,
        "Đơn giá nhập": step1Calculation.buyPrice,
        "Mã giá bán": selectedPriceRecord["Mã giá bán"],
        "Thành tiền dòng": step1Calculation.revenue
      }
    ]);
    setActiveStep(2);
    toast.success("Đã chuyển cấu hình báo giá vào giỏ hàng Đơn hàng (PO)!");
  };

  // --------------------------------------------------
  // STEP 2 calculations & OCR Handlers
  // --------------------------------------------------
  const customerPricingOptions = useMemo(() => {
    if (!poCustomer) return pricingData;
    return pricingData.filter(p => p["RP_Khách hàng"] === poCustomer || p["Giao đến"] === poCustomer);
  }, [pricingData, poCustomer]);

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
    const toastId = toast.loading("Gemini đang bóc tách chi tiết PO...");
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/ocr", {
        method: "POST",
        body: formData,
      });

      const textRes = await response.text();
      if (textRes.trim().toLowerCase().startsWith("<!doctype html") || textRes.includes("<html")) {
        if (response.status === 504 || response.status === 502) {
          throw new Error("Xử lý OCR quá thời gian cho phép của máy chủ. Vui lòng chọn file PDF/ảnh có dung lượng nhỏ hơn (dưới 5MB).");
        }
        throw new Error("Máy chủ phản hồi trang HTML thay vì JSON. Vui lòng thử tải lại trang hoặc mở ứng dụng trong Tab mới.");
      }

      if (!response.ok) {
        let errorMsg = `Lỗi máy chủ (${response.status})`;
        try {
          const errorData = JSON.parse(textRes);
          if (errorData && errorData.error) errorMsg = errorData.error;
        } catch (_) {}
        throw new Error(errorMsg);
      }

      const ocrData = JSON.parse(textRes);

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
        return {
          ...line,
          ...updatedItem,
          "Đơn giá bán": updatedItem.effectivePrice,
          "Đơn giá nhập": updatedItem.buyPrice,
          "Thành tiền dòng": updatedItem.effectivePrice * updatedItem.quantity
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

      return {
        ...line,
        effectivePrice: masterSell,
        buyPrice: masterBuy,
        "Đơn giá bán": masterSell,
        "Đơn giá nhập": masterBuy,
        masterProductCode: priceRecord ? priceRecord['Mã sản phẩm'] : (line.masterProductCode || line.code),
        masterProductName: priceRecord ? priceRecord['Tên sản phẩm'] : (line.masterProductName || line.name),
        priceCode: priceRecord ? (priceRecord['Mã giá'] || priceRecord['Mã giá bán']) : line.priceCode,
        supplier: priceRecord ? (priceRecord['RP_Nhà cung cấp'] || priceRecord['Nhà cung cấp']) : (line.supplier || "Tâm Sen"),
        "Thành tiền dòng": masterSell * line["Số lượng"]
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
    const priceRec = pricingData.find(p => p["Mã sản phẩm"] === selectedProductCode && (!poCustomer || p["RP_Khách hàng"] === poCustomer));
    if (!priceRec) {
      toast.error("Không tìm thấy giá cho sản phẩm đã chọn!");
      return;
    }
    const sellPrice = parseNumber(priceRec["Đơn giá bán"] || priceRec["Đơn giá bán mới"]);
    const buyPrice = parseNumber(priceRec["Đơn giá mua"] || priceRec["Giá nhập"]);
    const lineTotal = sellPrice * lineQty;

    const newLine = {
      id: `temp-${Date.now()}`,
      code: priceRec["Mã sản phẩm"],
      "Mã sản phẩm": priceRec["Mã sản phẩm"],
      "Tên sản phẩm": priceRec["Tên sản phẩm"],
      "ĐVT": priceRec["ĐVT"] || "Cái",
      "Số lượng": lineQty,
      poPrice: sellPrice,
      effectivePrice: sellPrice,
      buyPrice: buyPrice,
      "Đơn giá bán": sellPrice,
      "Đơn giá nhập": buyPrice,
      priceCode: priceRec["Mã giá bán"] || priceRec["Mã giá"],
      "Thành tiền dòng": lineTotal
    };

    setPoLines([...poLines, newLine]);
    setSelectedProductCode("");
    toast.success("Đã thêm dòng sản phẩm vào PO!");
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
          "Mã giá bán": line.priceCode || line["Mã giá bán"] || "Gsp_082",
          "Tên sản phẩm": line["Tên sản phẩm"] || line.masterProductName || line.name || "Sản phẩm PO",
          "Mã sản phẩm": line["Mã sản phẩm"] || line.code || line.masterProductCode || "",
          "Mã của khách": line["Mã của khách"] || line["Mã sản phẩm"] || line.code || "",
          "ĐVT": line["ĐVT"] || "Cái",
          "Số lượng": qty,
          "Ngày đặt hàng": formattedDate,
          "Ngày giao": line.deliveryDate || formattedDate,
          "Khách hàng": poCustomer,
          "Đơn vị nhận hàng": poCustomer,
          "Nhóm hàng": line["Nhóm hàng"] || "Nguyên liệu",
          "Đơn giá nhập": (buyPrice || 0).toLocaleString("vi-VN"),
          "Đơn giá bán": (sellPrice || 0).toLocaleString("vi-VN"),
          "Thành tiền dòng": (lineRev || 0).toLocaleString("vi-VN"),
          "Lợi nhuận": (lineProfit || 0).toLocaleString("vi-VN"),
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

      toast.success(`Đã tạo & phê duyệt thành công đơn hàng ${newPoNumber}!`, { id: loadToast });
      setNewPoNumber("");
      setPoLines([]);
      setActiveStep(3); // Move immediately to Step 3: Kế hoạch giao
    } catch (err: any) {
      console.error(err);
      toast.error(`Lỗi khi lưu đơn hàng: ${err.message || 'Chưa thể lưu'}`, { id: loadToast });
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

      const existingPlans = combinedDeliveryPlanData.filter(p => 
        !p.isDeleted && (
          (p["Chi tiết đơn hàng"] && String(p["Chi tiết đơn hàng"]).trim() === lineStt) ||
          (p["Đơn hàng"] && String(p["Đơn hàng"]).trim() === poNum && p["Sản phẩm"] && String(p["Sản phẩm"]).trim() === prodName)
        )
      );
      const plannedSum = existingPlans.reduce((sum, p) => sum + parseNumber(p["Số lượng kế hoạch"] || p["Số lượng cần giao"] || p["Số lượng"]), 0);
      const totalQty = parseNumber(line["Số lượng"]);
      return {
        ...line,
        plannedQtySum: plannedSum,
        qtyNeeded: Math.max(0, totalQty - plannedSum)
      };
    });
  }, [combinedPoLinesData, combinedDeliveryPlanData]);

  const handleSelectPlanningLine = (line: any) => {
    setPlanningPoLine(line);
    const needed = line.qtyNeeded > 0 ? line.qtyNeeded : parseNumber(line["Số lượng"]);
    setPlannedQty(needed > 0 ? needed : 100);
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

    const loadToast = toast.loading("Đang xử lý xuất kho...");
    try {
      // Find original PO line to pull financial info
      const poLine = combinedPoLinesData.find(l => l["STT"] === selectedPlan["Chi tiết đơn hàng"]);
      const buyPrice = poLine ? parseNumber(poLine["Đơn giá bán"]) : 0;
      const sellPrice = poLine ? parseNumber(poLine["Đơn giá nhập"]) : 0;
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
        "Đã giao": deliveredQty,
        "Còn lại": poLine ? Math.max(0, parseNumber(poLine["Số lượng"]) - deliveredQty) : 0,
        "Tiến độ giao": poLine ? `${Math.round((deliveredQty / parseNumber(poLine["Số lượng"])) * 100)}%` : "100%",
        "Status": "Hoàn thành",
        "Số PXK": pxkNumber,
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
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-900 text-slate-100">
      {/* Top Workflow Wizard Header */}
      <div className="bg-slate-900/90 backdrop-blur-xl border-b border-slate-800/80 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
        <div>
          <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-md shadow-blue-500/20">
              <TrendingUp size={20} className="text-white" />
            </div>
            <span className="bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
              Quản trị Luồng Nghiệp Vụ Liên Kết
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Quy trình phối hợp khép kín từ đặt hàng, giao vận, đối soát và báo cáo kế toán
          </p>
        </div>
        <div className="flex items-center gap-3">
          {activeStep === 6 && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportAccountantPDF}
                className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-lg shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98]"
              >
                <FileText size={16} />
                Xuất PDF Kế Toán
              </button>
              <button
                onClick={handleExportAccountantExcel}
                className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-lg shadow-emerald-500/20 hover:scale-[1.02] active:scale-[0.98]"
              >
                <FileSpreadsheet size={16} />
                Xuất Excel Kế Toán
              </button>
            </div>
          )}
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs font-semibold backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            Bước {activeStep} / 6: {
              activeStep === 1 ? "Đặt hàng (Sourcing)" :
              activeStep === 2 ? "Lên đơn hàng (PO)" :
              activeStep === 3 ? "Lập kế hoạch giao" :
              activeStep === 4 ? "Giao hàng (PXK)" :
              activeStep === 5 ? "Kiểm tra, đối soát" :
              "Báo cáo kế toán"
            }
          </div>
        </div>
      </div>

      {/* Progress Tracker Bar */}
      <div className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800/80 p-4 overflow-x-auto">
        <div className="flex items-center justify-between min-w-[850px] max-w-6xl mx-auto px-4 gap-2">
          {[
            { step: 1, label: "1. Đặt hàng", icon: <ShoppingCart size={16} /> },
            { step: 2, label: "2. Lên đơn hàng", icon: <FileText size={16} /> },
            { step: 3, label: "3. Kế hoạch giao", icon: <Calendar size={16} /> },
            { step: 4, label: "4. Giao hàng", icon: <Truck size={16} /> },
            { step: 5, label: "5. Đối soát", icon: <CheckSquare size={16} /> },
            { step: 6, label: "6. Báo cáo kế toán", icon: <BarChart3 size={16} /> }
          ].map((item, index) => {
            const isActive = activeStep === item.step;
            const isDone = activeStep > item.step;
            return (
              <React.Fragment key={item.step}>
                <motion.button
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setActiveStep(item.step)}
                  className={`relative flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl transition-all duration-300 text-xs font-semibold ${
                    isActive
                      ? "text-white shadow-lg shadow-blue-500/25 border border-blue-400/40"
                      : isDone
                      ? "bg-slate-800/90 text-blue-300 border border-slate-700/80 hover:bg-slate-800"
                      : "bg-slate-800/40 text-slate-400 border border-slate-800 hover:text-slate-200 hover:bg-slate-800/60"
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeStepIndicator"
                      className="absolute inset-0 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 rounded-xl"
                      transition={{ type: "spring", stiffness: 350, damping: 30 }}
                    />
                  )}
                  <span className={`relative z-10 p-1.5 rounded-lg flex items-center justify-center transition-colors ${
                    isActive 
                      ? "bg-white/20 text-white shadow-inner" 
                      : isDone 
                      ? "bg-blue-500/20 text-blue-400" 
                      : "bg-slate-800 text-slate-400"
                  }`}>
                    {item.icon}
                  </span>
                  <span className="relative z-10 whitespace-nowrap">{item.label}</span>
                </motion.button>
                {index < 5 && (
                  <div className={`h-[2px] flex-1 min-w-[20px] rounded-full transition-colors ${
                    activeStep > index + 1 ? "bg-gradient-to-r from-blue-500 to-indigo-500" : "bg-slate-800"
                  }`} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Active Wizard Content Panel */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-6xl mx-auto space-y-6">

          {/* ================================================== */}
          {/* STEP 1: ĐẶT HÀNG (SOURCING CALCULATOR) */}
          {/* ================================================== */}
          {activeStep === 1 && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Side: Dynamic Price Calculator */}
              <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                  <Calculator className="text-blue-600" size={20} />
                  <div>
                    <h3 className="font-bold text-slate-800 text-base">Bộ báo giá & Đặt hàng nhanh</h3>
                    <p className="text-xs text-slate-500">Tìm kiếm khung giá bán 2026 và tự động tính toán hiệu quả biên lợi nhuận</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Khách hàng yêu cầu</label>
                    <select
                      value={calcCustomer}
                      onChange={(e) => {
                        setCalcCustomer(e.target.value);
                        setCalcProduct("");
                      }}
                      className="w-full text-sm border border-slate-200 rounded-lg p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 transition outline-none"
                    >
                      <option value="">-- Tất cả khách hàng --</option>
                      {customerData.filter(c => !c.isDeleted).map((c, i) => (
                        <option key={i} value={c.Customer_ID}>{c["Tên đầy đủ"] || c.Customer_ID}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Sản phẩm đối ứng</label>
                    <select
                      value={calcProduct}
                      onChange={(e) => setCalcProduct(e.target.value)}
                      className="w-full text-sm border border-slate-200 rounded-lg p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 transition outline-none"
                    >
                      <option value="">-- Chọn sản phẩm có bảng giá --</option>
                      {activePricingOptions.map((p, i) => (
                        <option key={i} value={p["Mã sản phẩm"]}>
                          [{p["Mã sản phẩm"]}] {p["Tên sản phẩm"]} - {p["RP_Khách hàng"]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Số lượng đặt dự kiến (ĐVT: {selectedPriceRecord ? selectedPriceRecord["ĐVT"] : "Cái"})</label>
                    <input
                      type="number"
                      value={calcQty}
                      onChange={(e) => setCalcQty(Math.max(1, parseInt(e.target.value) || 0))}
                      className="w-full text-sm border border-slate-200 rounded-lg p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 transition outline-none"
                    />
                  </div>
                </div>

                {step1Calculation && selectedPriceRecord && (
                  <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 space-y-4">
                    <h4 className="font-bold text-xs text-slate-700 uppercase tracking-wider">Thông số báo giá dự tính</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-white p-3 rounded-lg border border-slate-100">
                        <span className="block text-[10px] font-medium text-slate-500">Đơn giá bán</span>
                        <span className="text-sm font-bold text-slate-800">{formatCurrency(step1Calculation.sellPrice)}</span>
                      </div>
                      <div className="bg-white p-3 rounded-lg border border-slate-100">
                        <span className="block text-[10px] font-medium text-slate-500">Đơn giá nhập</span>
                        <span className="text-sm font-bold text-slate-800">{formatCurrency(step1Calculation.buyPrice)}</span>
                      </div>
                      <div className="bg-white p-3 rounded-lg border border-slate-100">
                        <span className="block text-[10px] font-medium text-slate-500">Nhà cung cấp</span>
                        <span className="text-sm font-bold text-slate-800 truncate block" title={selectedPriceRecord["RP_Nhà cung cấp"]}>
                          {selectedPriceRecord["RP_Nhà cung cấp"] || "Không rõ"}
                        </span>
                      </div>
                      <div className="bg-white p-3 rounded-lg border border-slate-100">
                        <span className="block text-[10px] font-medium text-slate-500">Hợp đồng gốc</span>
                        <span className="text-sm font-bold text-blue-600 truncate block">{selectedPriceRecord["Số hợp đồng"] || "N/A"}</span>
                      </div>
                    </div>

                    <div className="border-t border-slate-200 pt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <span className="text-xs text-slate-500">Dự toán doanh thu</span>
                        <span className="block text-lg font-extrabold text-slate-900">{formatCurrency(step1Calculation.revenue)}</span>
                      </div>
                      <div>
                        <span className="text-xs text-slate-500">Ước tính giá vốn</span>
                        <span className="block text-lg font-bold text-slate-600">{formatCurrency(step1Calculation.cogs)}</span>
                      </div>
                      <div>
                        <span className="text-xs text-slate-500">Lợi nhuận gộp</span>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-extrabold text-emerald-600">{formatCurrency(step1Calculation.profit)}</span>
                          <span className="bg-emerald-50 text-emerald-700 text-[10px] px-1.5 py-0.5 rounded-md font-bold">
                            {step1Calculation.margin.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 flex justify-end">
                      <button
                        onClick={handleApplyCalcToPO}
                        disabled={!calcCustomer}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm px-4 py-2.5 rounded-lg shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Khởi tạo & Lên đơn PO ngay
                        <ArrowRight size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Side: Price references list */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
                <div className="border-b border-slate-100 pb-2">
                  <h3 className="font-bold text-slate-800 text-sm">Danh sách bảng giá hiện dụng</h3>
                  <p className="text-[11px] text-slate-500">Tra cứu nhanh biểu giá bán lẻ và biên lợi nhuận của Tâm Sen Group</p>
                </div>

                <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                  {pricingData.slice(0, 15).map((price, idx) => (
                    <div key={idx} className="p-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 transition text-xs space-y-1">
                      <div className="flex justify-between font-bold text-slate-700">
                        <span className="truncate max-w-[140px]" title={price["Tên sản phẩm"]}>{price["Tên sản phẩm"]}</span>
                        <span className="text-blue-700">{formatCurrency(price["Đơn giá bán"] || price["Đơn giá bán mới"])}</span>
                      </div>
                      <div className="flex justify-between text-slate-500 text-[10px]">
                        <span>Khách: {price["RP_Khách hàng"]}</span>
                        <span>Biên LN: <strong className="text-emerald-600 font-bold">{price["Biên lợi nhuận"] || "N/A"}</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ================================================== */}
          {/* STEP 2: LÊN ĐƠN HÀNG (PO & PO LINES CREATION + SMART OCR) */}
          {/* ================================================== */}
          {activeStep === 2 && (
            <div className="space-y-6">
              {/* Header & Mode Selector */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                      <FileText size={22} />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 text-lg">Soạn thảo & Đối chiếu Báo giá Đơn hàng PO</h3>
                      <p className="text-xs text-slate-500">Khởi tạo Đơn hàng qua Quét OCR tự động hoặc Nhập thủ công, đối chiếu trực tiếp với Bảng Giá 2026</p>
                    </div>
                  </div>

                  {/* Mode Selector Tabs */}
                  <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setCreationMode("ocr")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition ${
                        creationMode === "ocr" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <Camera size={14} />
                      📸 Quét OCR Chứng từ PO
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreationMode("manual")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition ${
                        creationMode === "manual" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <Plus size={14} />
                      ✍️ Nhập PO Thủ công
                    </button>
                  </div>
                </div>

                {/* Mode 1: OCR File Upload & Quick Samples */}
                {creationMode === "ocr" && (
                  <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-5 space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div>
                        <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                          <Sparkles size={14} className="text-amber-500" />
                          Trích xuất PO thông minh từ Chứng từ
                        </h4>
                        <p className="text-xs text-slate-500">Tải tệp ảnh/PDF chứng từ PO của khách hàng hoặc thử nhanh các mẫu PO thực tế bên dưới:</p>
                      </div>

                      {/* Quick Sample PO Buttons */}
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

                    {/* Drag & drop upload area */}
                    <div className="border-2 border-dashed border-slate-300 hover:border-blue-500 bg-white rounded-xl p-6 text-center cursor-pointer transition relative group">
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
                      {isOcrProcessing ? (
                        <div className="flex flex-col items-center justify-center py-2 space-y-2">
                          <Loader2 size={28} className="animate-spin text-blue-600" />
                          <span className="text-xs font-bold text-blue-700">Trí tuệ nhân tạo Gemini đang OCR trích xuất dữ liệu & đối chiếu giá...</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <div className="p-3 bg-blue-50 text-blue-600 rounded-full group-hover:scale-110 transition-transform">
                            <Upload size={22} />
                          </div>
                          <div>
                            <span className="text-sm font-bold text-slate-800">Kéo thả tệp chứng từ PO (PDF hoặc Ảnh) vào đây</span>
                            <span className="block text-xs text-slate-400 mt-0.5">Hệ thống sẽ tự động bóc tách số PO, tên mặt hàng, số lượng và đối chiếu giá</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Order Header Info */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Số đơn hàng (PO)</label>
                    <input
                      type="text"
                      placeholder="VD: 26/KHVT/0615"
                      value={newPoNumber}
                      onChange={(e) => setNewPoNumber(e.target.value)}
                      className="w-full text-sm border border-slate-200 rounded-lg p-2 bg-white focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Khách hàng</label>
                    <select
                      value={poCustomer}
                      onChange={(e) => setPoCustomer(e.target.value)}
                      className="w-full text-sm border border-slate-200 rounded-lg p-2 bg-white focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-800"
                    >
                      <option value="">-- Chọn khách hàng --</option>
                      {customerData.filter(c => !c.isDeleted).map((c, i) => (
                        <option key={i} value={c.Customer_ID}>{c["Tên đầy đủ"] || c.Customer_ID}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Phân loại đơn hàng</label>
                    <select
                      value={poType}
                      onChange={(e) => setPoType(e.target.value)}
                      className="w-full text-sm border border-slate-200 rounded-lg p-2 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
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
                      className="w-full text-sm border border-slate-200 rounded-lg p-2 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>

                {/* Manual Item Addition when in Manual mode */}
                {creationMode === "manual" && (
                  <div className="space-y-4 border-t border-slate-100 pt-4">
                    <h4 className="font-bold text-sm text-slate-800">Thêm dòng sản phẩm thủ công</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                      <div className="md:col-span-2">
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Chọn sản phẩm (Lọc theo khách hàng)</label>
                        <select
                          value={selectedProductCode}
                          onChange={(e) => setSelectedProductCode(e.target.value)}
                          className="w-full text-sm border border-slate-200 rounded-lg p-2 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                          disabled={!poCustomer}
                        >
                          <option value="">{poCustomer ? "-- Chọn sản phẩm --" : "Vui lòng chọn khách hàng ở trên trước"}</option>
                          {customerPricingOptions.map((p, i) => (
                            <option key={i} value={p["Mã sản phẩm"]}>
                              [{p["Mã sản phẩm"]}] {p["Tên sản phẩm"]} - Đơn giá bán: {formatCurrency(p["Đơn giá bán"] || p["Đơn giá bán mới"])}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Số lượng đặt</label>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            value={lineQty}
                            onChange={(e) => setLineQty(Math.max(1, parseInt(e.target.value) || 0))}
                            className="w-full text-sm border border-slate-200 rounded-lg p-2 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                            min="1"
                          />
                          <button
                            type="button"
                            onClick={handleAddPOLine}
                            disabled={!poCustomer}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg text-sm flex items-center gap-1 transition shadow-sm shrink-0"
                          >
                            <Plus size={16} />
                            Thêm
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Smart Price Reconciliation Panel */}
              {poLines.length > 0 ? (
                <PriceReconciliationPanel
                  customer={poCustomer}
                  items={poLines}
                  pricingData={pricingData}
                  onChangeItem={handleItemChangeInReconciliation}
                  onApplyAllMasterPrices={handleApplyAllMasterPrices}
                  isApproved={isPOApproved}
                  onToggleApproved={setIsPOApproved}
                  onRemoveItem={(idx) => setPoLines(poLines.filter((_, i) => i !== idx))}
                />
              ) : (
                <div className="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center text-slate-400">
                  <FileText size={36} className="mx-auto text-slate-300 mb-2" />
                  <p className="font-semibold text-sm text-slate-600">Đơn hàng chưa có dòng sản phẩm nào</p>
                  <p className="text-xs text-slate-400 mt-1">Vui lòng chọn <strong>Mẫu PO thử</strong> hoặc tải lên <strong>Tệp chứng từ</strong> ở trên để trải nghiệm tính năng đối chiếu giá thông minh</p>
                </div>
              )}

              {/* Action Buttons */}
              {poLines.length > 0 && (
                <div className="flex flex-col md:flex-row md:items-center justify-between bg-white p-5 rounded-xl border border-slate-200 shadow-sm gap-4">
                  <div className="text-slate-600 text-sm">
                    Tổng số lượng: <span className="font-bold text-slate-800">{poLines.length} mặt hàng</span> | Tổng doanh thu dự kiến: <span className="font-extrabold text-blue-700 text-base">{formatCurrency(totalPoValue)}</span>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => { setPoLines([]); setNewPoNumber(""); }}
                      className="border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold px-3.5 py-2.5 rounded-lg text-xs transition"
                    >
                      Xóa trắng đơn
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDualPOModal(true)}
                      className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-4 py-2.5 rounded-lg text-xs flex items-center gap-1.5 transition shadow-sm"
                    >
                      <Layers size={16} />
                      📄 Xem & Duyệt Bộ 2 PO Nhà Cung Cấp (Dual PO)
                    </button>
                    <button
                      type="button"
                      onClick={handleSavePO}
                      disabled={!isPOApproved}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2.5 rounded-lg text-xs flex items-center gap-1.5 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <CheckCircle size={16} />
                      Phê Duyệt & Phát Hành PO
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================================================== */}
          {/* STEP 3: LẬP KẾ HOẠCH GIAO HÀNG (DELIVERY PLANNING) */}
          {/* ================================================== */}
          {activeStep === 3 && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Side: PO lines list requiring planning */}
              <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
                <div>
                  <h3 className="font-bold text-slate-800 text-base">Danh sách dòng PO đang chờ lên lịch</h3>
                  <p className="text-xs text-slate-500">Chọn một dòng đơn hàng dưới đây để lên lịch điều xe và giao nhận hàng</p>
                </div>

                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase text-slate-500 font-bold">
                        <th className="px-3 py-2.5">Mã dòng PO</th>
                        <th className="px-3 py-2.5">Số PO</th>
                        <th className="px-3 py-2.5">Khách hàng</th>
                        <th className="px-3 py-2.5">Sản phẩm</th>
                        <th className="px-3 py-2.5 text-right">Số lượng đặt</th>
                        <th className="px-3 py-2.5 text-right">Lũy kế lập KH</th>
                        <th className="px-3 py-2.5 text-center">Hành động</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {activePOLinesNeedPlan.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="text-center py-6 text-slate-400 italic">
                            Không tìm thấy dòng PO nào cần lập kế hoạch!
                          </td>
                        </tr>
                      ) : (
                        activePOLinesNeedPlan.map((line, idx) => {
                          const isFullyScheduled = line.plannedQtySum >= parseNumber(line["Số lượng"]);
                          return (
                            <tr key={idx} className={`hover:bg-slate-50 ${isFullyScheduled ? "opacity-60 bg-emerald-50/20" : ""}`}>
                              <td className="px-3 py-3 font-mono text-slate-500">{line["STT"]}</td>
                              <td className="px-3 py-3 font-medium text-slate-800">{line["Số đơn hàng"]}</td>
                              <td className="px-3 py-3 text-slate-600 font-medium truncate max-w-[80px]">{line["Khách hàng"]}</td>
                              <td className="px-3 py-3 font-medium truncate max-w-[150px]" title={line["Tên sản phẩm"]}>{line["Tên sản phẩm"]}</td>
                              <td className="px-3 py-3 text-right font-bold">{parseNumber(line["Số lượng"]).toLocaleString("vi-VN")}</td>
                              <td className="px-3 py-3 text-right">
                                <span className={`font-bold ${isFullyScheduled ? "text-emerald-600" : "text-blue-600"}`}>
                                  {(line.plannedQtySum || 0).toLocaleString("vi-VN")}
                                </span>
                              </td>
                              <td className="px-3 py-3 text-center">
                                <button
                                  onClick={() => handleSelectPlanningLine(line)}
                                  className={`px-2.5 py-1 rounded text-[11px] font-bold transition ${
                                    isFullyScheduled 
                                      ? "bg-slate-100 text-slate-500 hover:bg-slate-200" 
                                      : "bg-blue-600 hover:bg-blue-700 text-white"
                                  }`}
                                >
                                  {isFullyScheduled ? "Lên lịch thêm" : "Lập kế hoạch"}
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

              {/* Right Side: Setup form or existing plan overview */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
                {planningPoLine ? (
                  <div className="space-y-4">
                    <div className="border-b border-slate-100 pb-2">
                      <h3 className="font-bold text-slate-800 text-sm">Lên kế hoạch giao nhận</h3>
                      <p className="text-[11px] text-slate-500">Cấu hình thời gian và sản lượng giao kế hoạch</p>
                    </div>

                    <div className="p-3 bg-blue-50/50 rounded-lg text-xs space-y-1.5 border border-blue-100">
                      <div><strong>Đơn hàng:</strong> {planningPoLine["Số đơn hàng"]}</div>
                      <div><strong>Sản phẩm:</strong> {planningPoLine["Tên sản phẩm"]}</div>
                      <div><strong>Tổng đặt:</strong> {parseNumber(planningPoLine["Số lượng"]).toLocaleString("vi-VN")} {planningPoLine["ĐVT"]}</div>
                      <div><strong>Cần điều phối:</strong> {(planningPoLine.qtyNeeded || 0).toLocaleString("vi-VN")} {planningPoLine["ĐVT"]}</div>
                    </div>

                    <div className="space-y-3 pt-2">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Số lượng giao kế hoạch</label>
                        <div className="space-y-2">
                          <input
                            type="number"
                            value={plannedQty}
                            onChange={(e) => setPlannedQty(Math.max(1, parseInt(e.target.value) || 0))}
                            className="w-full text-xs border border-slate-200 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500 font-bold text-blue-700"
                          />
                          <div className="flex flex-wrap gap-2">
                            {[400, 800, 1200, 2000].map(val => (
                              <button 
                                key={val}
                                onClick={() => setPlannedQty(val)}
                                className="px-2 py-1 bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-700 text-[10px] font-bold rounded border border-slate-200 transition-colors"
                              >
                                {val} (Xe tải)
                              </button>
                            ))}
                            <button 
                              onClick={() => setPlannedQty(planningPoLine.qtyNeeded)}
                              className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 text-[10px] font-bold rounded border border-amber-200 transition-colors"
                            >
                              Giao hết ({(planningPoLine.qtyNeeded || 0).toLocaleString("vi-VN")})
                            </button>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Ngày giao kế hoạch</label>
                        <input
                          type="date"
                          value={plannedDate}
                          onChange={(e) => setPlannedDate(e.target.value)}
                          className="w-full text-xs border border-slate-200 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Ghi chú vận hành / kế hoạch Mrs Thảo</label>
                        <textarea
                          placeholder="VD: Theo kế hoạch Mrs Thảo, điều xe tải 5 tấn..."
                          value={planNotes}
                          onChange={(e) => setPlanNotes(e.target.value)}
                          className="w-full text-xs border border-slate-200 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500 h-16 resize-none"
                        />
                      </div>
                    </div>

                    <div className="pt-2 flex gap-2">
                      <button
                        onClick={() => setPlanningPoLine(null)}
                        className="w-1/2 border border-slate-200 text-slate-600 text-xs font-bold py-2 rounded-lg hover:bg-slate-50 transition"
                      >
                        Hủy
                      </button>
                      <button
                        onClick={handleSaveDeliveryPlan}
                        className="w-1/2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2 rounded-lg transition shadow-md hover:shadow-lg"
                      >
                        Xác nhận lưu đợt này
                      </button>
                    </div>

                    {/* Show existing plans for this line */}
                    {deliveryPlanData.filter(p => !p.isDeleted && p["Chi tiết đơn hàng"] === planningPoLine["STT"]).length > 0 && (
                      <div className="mt-6 pt-4 border-t border-slate-100">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Các đợt đã lên lịch</h4>
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                          {deliveryPlanData
                            .filter(p => !p.isDeleted && p["Chi tiết đơn hàng"] === planningPoLine["STT"])
                            .sort((a, b) => {
                               const dateA = a["Ngày giao kế hoạch"]?.split('/').reverse().join('') || '';
                               const dateB = b["Ngày giao kế hoạch"]?.split('/').reverse().join('') || '';
                               return dateA.localeCompare(dateB);
                            })
                            .map((p, i) => (
                              <div key={i} className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-lg group">
                                <div>
                                  <div className="text-[11px] font-bold text-slate-700">{p["Số lượng kế hoạch"]?.toLocaleString("vi-VN")} {planningPoLine["ĐVT"]}</div>
                                  <div className="text-[10px] text-slate-500">{p["Ngày giao kế hoạch"]}</div>
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                   <button 
                                     onClick={async () => {
                                       if (true) {
                                          await updateDoc(doc(db, "delivery_plans", p.id || p["Kế hoạch ID"]), { isDeleted: true });
                                          toast.success("Đã xóa đợt giao!");
                                       }
                                     }}
                                     className="p-1 text-rose-600 hover:bg-rose-50 rounded"
                                   >
                                     <AlertCircle size={14} />
                                   </button>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-64 flex flex-col items-center justify-center text-center p-4">
                    <Calendar size={36} className="text-slate-300 mb-2 animate-bounce" />
                    <p className="text-xs text-slate-500 font-medium">Chưa chọn dòng hàng nào</p>
                    <p className="text-[10px] text-slate-400 mt-1 max-w-[200px]">Hãy click nút Lập kế hoạch trên dòng đơn bên trái để phân bổ vận tải</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================================================== */}
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
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Số Phiếu Xuất Kho (Số PXK)</label>
                        <input
                          type="text"
                          value={pxkNumber}
                          onChange={(e) => setPxkNumber(e.target.value)}
                          className="w-full text-xs border border-slate-200 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

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
                  {/* Status Filters */}
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
          {/* STEP 6: KẾ TOÁN VÀ DOANH THU */}
          {/* ================================================== */}
          {activeStep === 6 && (
            <div className="space-y-6">
              {/* Financial KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-400 uppercase">Báo cáo Doanh thu</span>
                    <TrendingUp size={16} className="text-blue-600" />
                  </div>
                  <div className="text-xl font-extrabold text-slate-900">{formatCurrency(financialSummary.revenueSum)}</div>
                  <span className="text-[10px] text-slate-500 font-medium">Từ các phiếu xuất kho PXK thực tế</span>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-400 uppercase">Giá vốn đầu vào (COGS)</span>
                    <Package size={16} className="text-slate-400" />
                  </div>
                  <div className="text-xl font-bold text-slate-600">{formatCurrency(financialSummary.cogsSum)}</div>
                  <span className="text-[10px] text-slate-500 font-medium">Chi phí mua nguyên vật liệu gốc</span>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-400 uppercase">Lợi nhuận ròng dự toán</span>
                    <DollarSign size={16} className="text-emerald-600" />
                  </div>
                  <div className="text-xl font-extrabold text-emerald-600">{formatCurrency(financialSummary.profitSum)}</div>
                  <span className="text-[10px] bg-emerald-50 text-emerald-700 text-xs px-1.5 py-0.5 rounded font-bold self-start inline-block">
                    Mức biên: {financialSummary.marginAvg.toFixed(2)}%
                  </span>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-400 uppercase">Tổng Công Nợ</span>
                    <Users size={16} className="text-orange-500" />
                  </div>
                  <div className="text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Phải thu:</span>
                      <strong className="text-blue-600 font-extrabold">
                        {formatCurrency(receivablesByCustomer.reduce((sum, c) => sum + c.val, 0))}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Phải trả:</span>
                      <strong className="text-red-500 font-bold">
                        {formatCurrency(payablesBySupplier.reduce((sum, s) => sum + s.val, 0))}
                      </strong>
                    </div>
                  </div>
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
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h4 className="font-bold text-slate-800 text-sm">Dịch sách hồ sơ giao hàng phục vụ quyết toán kế toán</h4>
                </div>

                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase text-slate-500 font-bold">
                        <th className="px-4 py-3">Số PXK</th>
                        <th className="px-4 py-3">Đơn hàng PO</th>
                        <th className="px-4 py-3">Khách hàng</th>
                        <th className="px-4 py-3">Sản phẩm</th>
                        <th className="px-4 py-3 text-right">Số lượng giao</th>
                        <th className="px-4 py-3 text-right">Doanh thu</th>
                        <th className="px-4 py-3">Trạng thái Hóa đơn</th>
                        <th className="px-4 py-3">Quyết toán Thu</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                      {deliveryData.filter(d => !d.isDeleted).map((d, index) => {
                        const qty = parseNumber(d["Số lượng giao"]);
                        const sellPrice = parseNumber(d["Đơn giá bán"]);
                        const rev = sellPrice * qty;

                        return (
                          <tr key={index} className="hover:bg-slate-50">
                            <td className="px-4 py-3 font-mono font-bold text-blue-700">{d["Số PXK"]}</td>
                            <td className="px-4 py-3 font-medium text-slate-600">{d["Đơn hàng"]}</td>
                            <td className="px-4 py-3 font-semibold">{d["Khách hàng"]}</td>
                            <td className="px-4 py-3 truncate max-w-[130px]">{d["Tên sản phẩm"]}</td>
                            <td className="px-4 py-3 text-right font-bold">{(qty || 0).toLocaleString("vi-VN")}</td>
                            <td className="px-4 py-3 text-right font-extrabold text-blue-700">{formatCurrency(rev)}</td>
                            <td className="px-4 py-3">
                              <select
                                value={d["InvoiceStatus"] || "Chưa xuất"}
                                onChange={(e) => handleUpdateAccountingStatus(d.id, "InvoiceStatus", e.target.value)}
                                className="bg-slate-50 border border-slate-200 rounded text-[11px] p-1 font-semibold"
                              >
                                <option value="Chưa xuất">Chưa xuất</option>
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
        customerPoNumber={newPoNumber || "26/KHVT/0744"}
        poCustomer={poCustomer || "Thăng Long"}
        poDate={poDate}
        poLines={poLines}
        supplierData={supplierData}
        productData={productData}
        pricingData={pricingData}
        onApproveAndProceed={() => {
          setShowDualPOModal(false);
          handleSavePO();
        }}
      />
    </div>
  );
}
