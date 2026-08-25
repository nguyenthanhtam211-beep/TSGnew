import clsx from 'clsx';
import React, { useState, useMemo, useEffect, useRef } from "react";
import { 
  Truck, 
  Users, 
  Layers, 
  FileText, 
  Search, 
  PlusCircle, 
  ArrowUpRight, 
  Package, 
  DollarSign, 
  TrendingUp, 
  ChevronDown, ChevronRight, 
  ChevronUp, 
  CheckCircle, 
  Clock, 
  AlertTriangle,
  Download,
  Filter,
  Eye,
  Info,
  LayoutGrid,
  Trash2,
  Edit2,
  FileSpreadsheet
} from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "react-hot-toast";
import { ProductHoverCard } from "./ProductHoverCard";
import { findPriceRecord, getSellPriceFromRecord, getBuyPriceFromRecord, parseNumber } from "../lib/business-logic";
import GoogleSheetsSyncModal from "./GoogleSheetsSyncModal";
import { generateStructuredPDFReport } from "../lib/pdf-exporter";
import MacTrafficLights from "./MacTrafficLights";

interface DeliveryViewProps {
  deliveryData: any[];
  poLinesData: any[];
  customerData: any[];
  supplierData: any[];
  productData: any[];
  pricingData?: any[];
  onAdd?: (row: any) => Promise<void> | void;
  onEdit?: (row: any) => Promise<void> | void;
  onDelete?: (row: any) => Promise<void> | void;
  onProductClick?: (val: string) => void;
  onPoClick?: (val: string) => void;
  onCreateCalendarEvent?: (eventData: any) => Promise<void>;
}

export default function DeliveryView({
  deliveryData,
  poLinesData,
  customerData,
  supplierData,
  productData,
  pricingData = [],
  onAdd,
  onEdit,
  onDelete,
  onProductClick,
  onPoClick,
  onCreateCalendarEvent
}: DeliveryViewProps) {
  const [activeTab, setActiveTab] = useState<"all" | "customer" | "supplier" | "po">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [monthFilter, setMonthFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  
  // Track collapsed status of grouped sections
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const [editingSlip, setEditingSlip] = useState<any>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isSheetsModalOpen, setIsSheetsModalOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(val);
  };

  const toggleGroup = (groupKey: string) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [groupKey]: !prev[groupKey]
    }));
  };

  // 1. Filtered all deliveries
  const filteredDeliveries = useMemo(() => {
    return deliveryData.filter(d => {
      if (d.isDeleted) return false;

      // Search matching product name, customer, supplier, slip number, PO number
      const s = searchTerm.toLowerCase();
      const matchesSearch = 
        String(d["Số PXK"] || "").toLowerCase().includes(s) ||
        String(d["Đơn hàng"] || "").toLowerCase().includes(s) ||
        String(d["Khách hàng"] || "").toLowerCase().includes(s) ||
        String(d["Nhà cung cấp"] || "").toLowerCase().includes(s) ||
        String(d["Tên sản phẩm"] || "").toLowerCase().includes(s) ||
        String(d["Mã sản phẩm"] || "").toLowerCase().includes(s);

      // Month matching
      let matchesMonth = true;
      if (monthFilter !== "all") {
        matchesMonth = String(d["Tháng"]) === monthFilter;
      }

      // Status matching
      let matchesStatus = true;
      if (statusFilter !== "all") {
        matchesStatus = String(d["Status"] || d["Trạng thái"] || "").trim() === statusFilter;
      }

      return matchesSearch && matchesMonth && matchesStatus;
    });
  }, [deliveryData, searchTerm, monthFilter, statusFilter]);

  // 2. High-level metric calculations
  const metrics = useMemo(() => {
    let totalSlips = 0;
    let totalQty = 0;
    let totalRevenue = 0;
    let totalCost = 0;

    filteredDeliveries.forEach(d => {
      totalSlips++;
      totalQty += parseNumber(d["Số lượng giao"]);
      totalRevenue += parseNumber(d["Doanh thu"]);
      totalCost += parseNumber(d["Đơn giá nhập"]) * parseNumber(d["Số lượng giao"]);
    });

    const totalProfit = totalRevenue - totalCost;
    const margin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
    
    const incidentsCount = filteredDeliveries.filter(d => d["Sự cố"] === "1" || d["Sự cố"] === 1).length;
    const incidentRate = totalSlips > 0 ? (incidentsCount / totalSlips) * 100 : 0;

    return {
      totalSlips,
      totalQty,
      totalRevenue,
      totalProfit,
      margin,
      incidentRate,
      incidentsCount
    };
  }, [filteredDeliveries]);

  // 3. Group by Customer
  const customerGrouped = useMemo(() => {
    const groups: Record<string, {
      customer: string;
      slipsCount: number;
      totalQty: number;
      revenue: number;
      profit: number;
      deliveries: any[];
    }> = {};

    filteredDeliveries.forEach(d => {
      const cust = d["Khách hàng"] || "Khác";
      if (!groups[cust]) {
        groups[cust] = {
          customer: cust,
          slipsCount: 0,
          totalQty: 0,
          revenue: 0,
          profit: 0,
          deliveries: []
        };
      }
      const g = groups[cust];
      g.slipsCount++;
      g.totalQty += parseNumber(d["Số lượng giao"]);
      g.revenue += parseNumber(d["Doanh thu"]);
      g.profit += parseNumber(d["Lợi nhuận gộp"]);
      g.deliveries.push(d);
    });

    return Object.values(groups).sort((a, b) => b.revenue - a.revenue);
  }, [filteredDeliveries]);

  // 4. Group by Supplier
  const supplierGrouped = useMemo(() => {
    const groups: Record<string, {
      supplier: string;
      slipsCount: number;
      totalQty: number;
      cost: number;
      revenue: number;
      deliveries: any[];
    }> = {};

    filteredDeliveries.forEach(d => {
      const supp = d["Nhà cung cấp"] || "Chưa phân loại";
      if (!groups[supp]) {
        groups[supp] = {
          supplier: supp,
          slipsCount: 0,
          totalQty: 0,
          cost: 0,
          revenue: 0,
          deliveries: []
        };
      }
      const g = groups[supp];
      g.slipsCount++;
      const qty = parseNumber(d["Số lượng giao"]);
      const buyPrice = parseNumber(d["Đơn giá nhập"]);
      g.totalQty += qty;
      g.cost += buyPrice * qty;
      g.revenue += parseNumber(d["Doanh thu"]);
      g.deliveries.push(d);
    });

    return Object.values(groups).sort((a, b) => b.cost - a.cost);
  }, [filteredDeliveries]);

  // 5. Group by PO
  const poGrouped = useMemo(() => {
    const groups: Record<string, {
      poNumber: string;
      customer: string;
      totalOrdered: number;
      totalDelivered: number;
      progressPercent: number;
      revenue: number;
      deliveries: any[];
    }> = {};

    filteredDeliveries.forEach(d => {
      const poNum = d["Đơn hàng"] || "Khác";
      if (!groups[poNum]) {
        // Find order detail if possible to extract total ordered
        const relatedLine = poLinesData.find(l => !l.isDeleted && l["Số đơn hàng"] === poNum);
        const customer = d["Khách hàng"] || (relatedLine ? relatedLine["Khách hàng"] : "Khách hàng");
        
        groups[poNum] = {
          poNumber: poNum,
          customer,
          totalOrdered: 0,
          totalDelivered: 0,
          progressPercent: 0,
          revenue: 0,
          deliveries: []
        };
      }
      
      const g = groups[poNum];
      const qtyDelivered = parseNumber(d["Số lượng giao"]);
      g.totalDelivered += qtyDelivered;
      g.revenue += parseNumber(d["Doanh thu"]);
      g.deliveries.push(d);
    });

    // Compute ordered and progress dynamically
    Object.values(groups).forEach(g => {
      // Sum ordered amount from PO lines corresponding to this PO number
      const poLines = poLinesData.filter(l => !l.isDeleted && l["Số đơn hàng"] === g.poNumber);
      g.totalOrdered = poLines.reduce((sum, l) => sum + parseNumber(l["Số lượng"]), 0);
      
      // Fallback if PO lines aren't found
      if (g.totalOrdered === 0 && g.deliveries.length > 0) {
        g.totalOrdered = parseNumber(g.deliveries[0]["Số lượng đặt"]) || g.totalDelivered;
      }
      
      g.progressPercent = g.totalOrdered > 0 ? Math.min(100, Math.round((g.totalDelivered / g.totalOrdered) * 100)) : 100;
    });

    return Object.values(groups).sort((a, b) => b.revenue - a.revenue);
  }, [filteredDeliveries, poLinesData]);

  // Handle Export Excel
  const handleExportExcel = () => {
    try {
      const dataToExport = filteredDeliveries.map(d => ({
        "Số PXK": d["Số PXK"],
        "Đơn hàng": d["Đơn hàng"],
        "Khách hàng": d["Khách hàng"],
        "Nhà cung cấp": d["Nhà cung cấp"],
        "Tên sản phẩm": d["Tên sản phẩm"],
        "Mã sản phẩm": d["Mã sản phẩm"],
        "Số lượng giao": parseNumber(d["Số lượng giao"]),
        "Đơn giá nhập": parseNumber(d["Đơn giá nhập"]),
        "Đơn giá bán": parseNumber(d["Đơn giá bán"]),
        "Doanh thu": parseNumber(d["Doanh thu"]),
        "Lợi nhuận gộp": parseNumber(d["Lợi nhuận gộp"]),
        "Ngày giao": d["Ngày giao"],
        "Trạng thái": d["Status"] || d["Trạng thái"] || "Hoàn thành",
        "Sự cố": d["Sự cố"] === "1" || d["Sự cố"] === 1 ? "Có" : "Không",
        "Chi tiết sự cố": d["Chi tiết sự cố"] || ""
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(dataToExport);
      XLSX.utils.book_append_sheet(wb, ws, "Giao_Hang_PXK");
      XLSX.writeFile(wb, `Báo_cáo_giao_hàng_${Date.now()}.xlsx`);
      toast.success("Xuất báo cáo Excel thành công!");
    } catch (err) {
      toast.error("Lỗi xuất Excel: " + err);
    }
  };

  // Handle Export PDF
  const handleExportPDF = () => {
    try {
      const summaryStats = {
        totalRevenue: filteredDeliveries.reduce((sum, item) => sum + (parseNumber(item['Doanh thu']) || 0), 0),
        totalProfit: filteredDeliveries.reduce((sum, item) => sum + (parseNumber(item['Lợi nhuận gộp']) || 0), 0),
        totalVolume: filteredDeliveries.reduce((sum, item) => sum + (parseNumber(item['Số lượng giao']) || 0), 0),
        totalDeliveries: filteredDeliveries.length
      };

      generateStructuredPDFReport({
        title: 'BÁO CÁO DANH SÁCH GIAO HÀNG (PXK)',
        subtitle: `Số lượng: ${filteredDeliveries.length} phiếu giao hàng`,
        filename: `Bao_Cao_Giao_Hang_${new Date().toISOString().slice(0, 10)}.pdf`,
        deliveryData: filteredDeliveries,
        poLinesData,
        summaryStats
      });
      toast.success("Đã xuất file PDF thành công!");
    } catch (err: any) {
      toast.error("Lỗi xuất PDF: " + (err?.message || err));
    }
  };

  // Add new slip manual form (Simple modal)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const [newSlip, setNewSlip] = useState({
    "Số PXK": "",
    "Đơn hàng": "",
    "Chi tiết đơn hàng": "",
    "Khách hàng": "",
    "Nhà cung cấp": "",
    "Mã sản phẩm": "",
    "Tên sản phẩm": "",
    "ĐVT": "Cái",
    "Số lượng giao": "",
    "Ngày giao": new Date().toISOString().split('T')[0].split('-').reverse().join('/'),
    "Tháng": (new Date().getMonth() + 1).toString(),
    "Sự cố": "0",
    "Chi tiết sự cố": ""
  });

  const allCustomersList = useMemo(() => {
    const set = new Set<string>();

    customerData.forEach(c => {
      if (!c.isDeleted) {
        const name = (c["Customer_ID"] || c["Khách hàng"] || c["Tên đầy đủ"] || "").trim();
        if (name) set.add(name);
      }
    });

    poLinesData.forEach(l => {
      if (!l.isDeleted) {
        const name = (l["Khách hàng"] || "").trim();
        if (name) set.add(name);
      }
    });

    deliveryData.forEach(d => {
      if (!d.isDeleted) {
        const name = (d["Khách hàng"] || "").trim();
        if (name) set.add(name);
      }
    });

    return Array.from(set).sort((a, b) => a.localeCompare(b, "vi"));
  }, [customerData, poLinesData, deliveryData]);

  const allSuppliersList = useMemo(() => {
    const set = new Set<string>();

    supplierData.forEach(s => {
      if (!s.isDeleted) {
        const name = (s["Mã nhà cung cấp"] || s["Tên Nhà Cung Cấp"] || s["Nhà cung cấp"] || "").trim();
        if (name) set.add(name);
      }
    });

    poLinesData.forEach(l => {
      if (!l.isDeleted) {
        const name = (l["Nhà cung cấp"] || "").trim();
        if (name) set.add(name);
      }
    });

    deliveryData.forEach(d => {
      if (!d.isDeleted) {
        const name = (d["Nhà cung cấp"] || "").trim();
        if (name) set.add(name);
      }
    });

    return Array.from(set).sort((a, b) => a.localeCompare(b, "vi"));
  }, [supplierData, poLinesData, deliveryData]);

  const availablePOsForCustomer = useMemo(() => {
    const selectedCust = (newSlip["Khách hàng"] || "").trim().toLowerCase();
    const posMap = new Map<string, string>();

    poLinesData.forEach(l => {
      if (!l.isDeleted && l["Số đơn hàng"]) {
        const poNum = String(l["Số đơn hàng"]).trim();
        const lineCust = String(l["Khách hàng"] || "").trim();
        if (poNum && (!posMap.has(poNum) || !posMap.get(poNum))) {
          posMap.set(poNum, lineCust);
        }
      }
    });

    deliveryData.forEach(d => {
      if (!d.isDeleted && d["Đơn hàng"]) {
        const poNum = String(d["Đơn hàng"]).trim();
        const delCust = String(d["Khách hàng"] || "").trim();
        if (poNum && (!posMap.has(poNum) || !posMap.get(poNum))) {
          posMap.set(poNum, delCust);
        }
      }
    });

    const result: { po: string; customer: string }[] = [];
    posMap.forEach((cust, po) => {
      if (!selectedCust) {
        result.push({ po, customer: cust });
      } else {
        const c1 = cust.toLowerCase();
        if (c1.includes(selectedCust) || selectedCust.includes(c1)) {
          result.push({ po, customer: cust });
        }
      }
    });

    return result.sort((a, b) => a.po.localeCompare(b.po, "vi"));
  }, [poLinesData, deliveryData, newSlip["Khách hàng"]]);

  const poProducts = useMemo(() => {
    if (!newSlip["Đơn hàng"]) return [];
    const selectedPO = String(newSlip["Đơn hàng"]).trim().toLowerCase();

    let lines = poLinesData.filter(l => 
      !l.isDeleted && String(l["Số đơn hàng"] || "").trim().toLowerCase() === selectedPO
    );

    // If no lines found in poLinesData, check deliveryData for existing delivery records of this PO
    if (lines.length === 0) {
      const delLines = deliveryData.filter(d => 
        !d.isDeleted && String(d["Đơn hàng"] || "").trim().toLowerCase() === selectedPO
      );
      if (delLines.length > 0) {
        const map = new Map<string, any>();
        delLines.forEach((d, idx) => {
          const key = d["Tên sản phẩm"] || d["Mã sản phẩm"] || `DEL_${idx}`;
          if (!map.has(key)) {
            const lineKey = String(d["Chi tiết đơn hàng"] || `DEL_${d.STT || idx}`);
            map.set(key, {
              STT: lineKey,
              lineKey: lineKey,
              "Tên sản phẩm": d["Tên sản phẩm"] || "Sản phẩm",
              "Mã sản phẩm": d["Mã sản phẩm"] || "",
              "Mã của khách": d["Mã sản phẩm"] || "",
              "ĐVT": d["ĐVT"] || "Cái",
              "Số lượng": d["Số lượng đặt"] || d["Số lượng giao"] || 0,
              "Còn lại": d["Còn lại"] || d["Số lượng giao"] || 0,
              "Nhà cung cấp": d["Nhà cung cấp"] || ""
            });
          }
        });
        return Array.from(map.values());
      }
    }

    // Enhance lines with supplier if missing
    return lines.map((l, idx) => {
      let supp = l["Nhà cung cấp"] || "";
      if (!supp) {
        const matchDel = deliveryData.find(d => 
          !d.isDeleted && 
          String(d["Đơn hàng"] || "").trim().toLowerCase() === selectedPO &&
          (d["Tên sản phẩm"] === l["Tên sản phẩm"] || d["Chi tiết đơn hàng"] === l["STT"]) &&
          d["Nhà cung cấp"]
        );
        if (matchDel) {
          supp = matchDel["Nhà cung cấp"];
        }
      }
      if (!supp && l["Mã giá bán"] && pricingData) {
        const matchPrice = pricingData.find(p => 
          !p.isDeleted && (p["Mã giá bán"] === l["Mã giá bán"] || p["Mã sản phẩm"] === l["Mã của khách"]) && (p["RP_Nhà cung cấp"] || p["Nhà cung cấp"])
        );
        if (matchPrice) {
          supp = matchPrice["RP_Nhà cung cấp"] || matchPrice["Nhà cung cấp"];
        }
      }

      const lineKey = String(l["STT"] || l.id || `line_${idx}`);

      return {
        ...l,
        STT: lineKey,
        lineKey: lineKey,
        "Nhà cung cấp": supp
      };
    });
  }, [poLinesData, deliveryData, pricingData, newSlip["Đơn hàng"]]);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const numPXK = String(newSlip["Số PXK"] || "").trim();
    const numPO = String(newSlip["Đơn hàng"] || "").trim();
    const prodName = String(newSlip["Tên sản phẩm"] || "").trim();
    const qtyVal = parseNumber(newSlip["Số lượng giao"]);

    if (!numPXK) {
      toast.error("Vui lòng nhập Số phiếu xuất kho!");
      return;
    }
    if (!numPO) {
      toast.error("Vui lòng chọn Số đơn hàng PO!");
      return;
    }
    if (!prodName) {
      toast.error("Vui lòng chọn Sản phẩm cần giao!");
      return;
    }
    if (qtyVal <= 0) {
      toast.error("Vui lòng nhập Số lượng giao hợp lệ lớn hơn 0!");
      return;
    }

    try {
      if (onAdd) {
        const selPO = numPO.toLowerCase();
        const selSTT = String(newSlip["Chi tiết đơn hàng"] || "").trim();
        const poLine = poLinesData.find(l => 
          !l.isDeleted && (
            (selSTT && String(l["STT"] || l.id) === selSTT) ||
            (selPO && String(l["Số đơn hàng"] || "").trim().toLowerCase() === selPO && (l["Tên sản phẩm"] === prodName || !selSTT))
          )
        );
        
        // Find price record from pricingData or poLine
        const priceRec = findPriceRecord(pricingData || [], { 
          sku: poLine ? (poLine["Mã của khách"] || poLine["Mã sản phẩm"] || poLine["Tên sản phẩm"]) : prodName, 
          customer: newSlip["Khách hàng"] || (poLine ? poLine["Khách hàng"] : "")
        });

        const priceRecSell = getSellPriceFromRecord(priceRec);
        const priceRecBuy = getBuyPriceFromRecord(priceRec);

        const sellPrice = priceRecSell > 0 ? priceRecSell : (poLine ? parseNumber(poLine["Đơn giá bán"]) : parseNumber(newSlip["Đơn giá bán"]));
        const buyPrice = priceRecBuy > 0 ? priceRecBuy : (poLine ? parseNumber(poLine["Đơn giá nhập"]) : parseNumber(newSlip["Đơn giá nhập"]));

        // Calculate next numeric STT
        const maxSTT = deliveryData.reduce((max: number, d: any) => {
          const val = parseInt(d["STT"]);
          return !isNaN(val) ? Math.max(max, val) : max;
        }, 0);
        const nextSTT = maxSTT > 0 ? String(maxSTT + 1) : `DEL_${Date.now()}`;

        const customerName = newSlip["Khách hàng"] || (poLine ? poLine["Khách hàng"] : "");
        const supplierName = newSlip["Nhà cung cấp"] || (poLine ? poLine["Nhà cung cấp"] : (priceRec ? priceRec["RP_Nhà cung cấp"] || priceRec["Nhà cung cấp"] : ""));
        const productCode = newSlip["Mã sản phẩm"] || (poLine ? (poLine["Mã của khách"] || poLine["Mã sản phẩm"]) : "");
        const unit = newSlip["ĐVT"] || (poLine ? poLine["ĐVT"] : "Cái");
        const poOrderedQty = poLine ? parseNumber(poLine["Số lượng"]) : qtyVal;

        const payload = {
          ...newSlip,
          "STT": nextSTT,
          "Chi tiết đơn hàng": selSTT || (poLine ? String(poLine["STT"] || poLine.id) : ""),
          "Số PXK": numPXK,
          "Đơn hàng": numPO,
          "Khách hàng": customerName,
          "Nhà cung cấp": supplierName,
          "Mã sản phẩm": productCode,
          "Tên sản phẩm": prodName,
          "ĐVT": unit,
          "Số lượng giao": qtyVal,
          "Số lượng đặt": poOrderedQty,
          "Đơn giá nhập": buyPrice,
          "Đơn giá bán": sellPrice,
          "Doanh thu": sellPrice * qtyVal,
          "Lợi nhuận gộp": (sellPrice - buyPrice) * qtyVal,
          "% Lợi nhuận": sellPrice > 0 ? (((sellPrice - buyPrice) / sellPrice) * 100).toFixed(2) + "%" : "0%",
          "Status": "Hoàn thành",
          "Ngày giao": newSlip["Ngày giao"] || new Date().toLocaleDateString('vi-VN'),
          "Tháng": newSlip["Tháng"] || (new Date().getMonth() + 1).toString(),
          "isDeleted": false,
          "createdAt": new Date().toISOString()
        };

        await onAdd(payload);
        toast.success("Lưu phiếu giao hàng thành công!");
      }

      setIsAddModalOpen(false);
      // Reset form
      setNewSlip({
        "Số PXK": "",
        "Đơn hàng": "",
        "Chi tiết đơn hàng": "",
        "Khách hàng": "",
        "Nhà cung cấp": "",
        "Mã sản phẩm": "",
        "Tên sản phẩm": "",
        "ĐVT": "Cái",
        "Số lượng giao": "",
        "Ngày giao": new Date().toISOString().split('T')[0].split('-').reverse().join('/'),
        "Tháng": (new Date().getMonth() + 1).toString(),
        "Sự cố": "0",
        "Chi tiết sự cố": ""
      });
    } catch (err: any) {
      console.error("Lỗi khi lưu phiếu giao:", err);
      toast.error(`Lỗi khi lưu phiếu giao: ${err?.message || "Vui lòng kiểm tra lại dữ liệu"}`);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-6 md:p-8">
      {/* Title & Header Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-3">
            <Truck className="text-blue-600" size={28} />
            Hệ thống Quản lý Giao hàng (PXK)
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Góc nhìn phân tích đa chiều về phiếu xuất kho, tiến độ và dữ liệu đối chiếu kế toán.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start md:self-auto">
          {/* Unified Export Dropdown */}
          <div className="relative" ref={exportMenuRef}>
            <button
              onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
              className="flex items-center gap-2 px-3.5 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-semibold transition-all shadow-sm"
            >
              <Download size={16} className="text-slate-600" />
              <span>Xuất & Đồng bộ</span>
              <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${isExportMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isExportMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <button
                  onClick={() => {
                    setIsSheetsModalOpen(true);
                    setIsExportMenuOpen(false);
                  }}
                  className="w-full text-left px-3.5 py-2.5 hover:bg-emerald-50/80 flex items-center gap-3 transition-colors group"
                >
                  <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700 group-hover:bg-emerald-200 transition-colors">
                    <FileSpreadsheet size={16} />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      Đồng bộ Google Sheets
                      <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1 py-0.2 rounded font-bold">BI</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">Tự động xuất Looker Studio / BigQuery</p>
                  </div>
                </button>

                <button
                  onClick={() => {
                    handleExportExcel();
                    setIsExportMenuOpen(false);
                  }}
                  className="w-full text-left px-3.5 py-2.5 hover:bg-blue-50/80 flex items-center gap-3 transition-colors group"
                >
                  <div className="p-2 rounded-lg bg-blue-100 text-blue-700 group-hover:bg-blue-200 transition-colors">
                    <Download size={16} />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800">Xuất file Excel</div>
                    <p className="text-[11px] text-slate-500 mt-0.5">Tải danh sách phiếu giao dạng Excel</p>
                  </div>
                </button>

                <button
                  onClick={() => {
                    handleExportPDF();
                    setIsExportMenuOpen(false);
                  }}
                  className="w-full text-left px-3.5 py-2.5 hover:bg-slate-50 flex items-center gap-3 transition-colors group"
                >
                  <div className="p-2 rounded-lg bg-slate-100 text-slate-700 group-hover:bg-slate-200 transition-colors">
                    <FileText size={16} />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800">Xuất file PDF</div>
                    <p className="text-[11px] text-slate-500 mt-0.5">Tải file PDF báo cáo bảng chi tiết giao hàng</p>
                  </div>
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-all shadow-md hover:shadow-lg"
          >
            <PlusCircle size={16} />
            Tạo phiếu giao mới
          </button>
        </div>
      </div>

      {/* Dynamic Key Performance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
        {/* Slips Count Card */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 flex items-center justify-between hover:shadow-md transition-all">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Tổng Phiếu Giao (PXK)</span>
            <h3 className="text-2xl font-bold text-slate-800 mt-1">{metrics.totalSlips}</h3>
            <span className="text-[11px] text-blue-600 font-semibold mt-1 inline-block">Hóa đơn hợp lệ</span>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Truck size={24} />
          </div>
        </div>

        {/* Volume Card */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 flex items-center justify-between hover:shadow-md transition-all">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Sản Lượng Giao</span>
            <h3 className="text-2xl font-bold text-slate-800 mt-1">{metrics.totalQty.toLocaleString("vi-VN")}</h3>
            <span className="text-[11px] text-slate-500 mt-1 inline-block">đơn vị đo lường quy chuẩn</span>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Package size={24} />
          </div>
        </div>

        {/* Revenue Card */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 flex items-center justify-between hover:shadow-md transition-all">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Tổng Doanh Thu</span>
            <h3 className="text-2xl font-bold text-blue-700 mt-1">{formatCurrency(metrics.totalRevenue)}</h3>
            <span className="text-[11px] text-emerald-600 font-semibold mt-1 inline-block">Doanh số thực giao</span>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <DollarSign size={24} />
          </div>
        </div>

        {/* Profit Card */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 flex items-center justify-between hover:shadow-md transition-all">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Lợi Nhuận Gộp</span>
            <h3 className={`text-2xl font-bold mt-1 ${metrics.totalProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {formatCurrency(metrics.totalProfit)}
            </h3>
            <span className="text-[11px] text-slate-500 mt-1 inline-block">
              Tỷ suất: <strong className="text-slate-700">{metrics.margin.toFixed(2)}%</strong>
            </span>
          </div>
          <div className={`p-3 rounded-xl ${metrics.totalProfit >= 0 ? 'bg-teal-50 text-teal-600' : 'bg-rose-50 text-rose-600'}`}>
            <TrendingUp size={24} />
          </div>
        </div>

        {/* Incident Rate Card */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 flex items-center justify-between hover:shadow-md transition-all">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Tỷ lệ Sự cố</span>
            <h3 className={`text-2xl font-bold mt-1 ${metrics.incidentRate > 5 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {metrics.incidentRate.toFixed(1)}%
            </h3>
            <span className="text-[11px] text-slate-500 mt-1 inline-block">
              Số vụ: <strong className="text-slate-700">{metrics.incidentsCount} vụ</strong>
            </span>
          </div>
          <div className={`p-3 rounded-xl ${metrics.incidentRate > 5 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
            <AlertTriangle size={24} />
          </div>
        </div>
      </div>

      {/* Advanced Filter Bar */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 mb-8 flex flex-col lg:flex-row items-center gap-4">
        {/* Search */}
        <div className="relative w-full lg:flex-1">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Tìm theo Số PXK, Đơn hàng, Khách hàng, Sản phẩm..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
          />
        </div>

        {/* Month selector */}
        <div className="flex items-center gap-2 w-full lg:w-auto">
          <span className="text-xs font-bold text-slate-500 whitespace-nowrap uppercase tracking-wider flex items-center gap-1">
            <Filter size={14} /> Tháng giao:
          </span>
          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="w-full lg:w-40 border border-slate-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="all">Tất cả tháng</option>
            {Array.from({ length: 12 }, (_, i) => String(i + 1)).map(m => (
              <option key={m} value={m}>Tháng {m}</option>
            ))}
          </select>
        </div>

        {/* Status selector */}
        <div className="flex items-center gap-2 w-full lg:w-auto">
          <span className="text-xs font-bold text-slate-500 whitespace-nowrap uppercase tracking-wider">Trạng thái:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full lg:w-44 border border-slate-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="Hoàn thành">Hoàn thành</option>
            <option value="Đang tiến hành">Đang tiến hành</option>
            <option value="Chưa giao">Chưa giao</option>
          </select>
        </div>
      </div>

      {/* Multidimensional Tab Selector */}
      <div className="flex border-b border-slate-200 mb-6 bg-white rounded-t-xl px-2 overflow-x-auto scrollbar-hide">
        <button
          onClick={() => setActiveTab("all")}
          className={`flex items-center gap-2 px-6 py-4 border-b-2 font-bold text-sm transition-all whitespace-nowrap ${
            activeTab === "all"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50"
          }`}
        >
          <LayoutGrid size={16} />
          Tổng quan Phiếu giao (PXK)
        </button>
        <button
          onClick={() => setActiveTab("customer")}
          className={`flex items-center gap-2 px-6 py-4 border-b-2 font-bold text-sm transition-all whitespace-nowrap ${
            activeTab === "customer"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50"
          }`}
        >
          <Users size={16} />
          Phân tích theo Khách hàng
        </button>
        <button
          onClick={() => setActiveTab("supplier")}
          className={`flex items-center gap-2 px-6 py-4 border-b-2 font-bold text-sm transition-all whitespace-nowrap ${
            activeTab === "supplier"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50"
          }`}
        >
          <Layers size={16} />
          Phối hợp Nhà cung cấp
        </button>
        <button
          onClick={() => setActiveTab("po")}
          className={`flex items-center gap-2 px-6 py-4 border-b-2 font-bold text-sm transition-all whitespace-nowrap ${
            activeTab === "po"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50"
          }`}
        >
          <FileText size={16} />
          Tiến độ Đơn hàng (PO)
        </button>
      </div>

      {/* Perspective Rendering Content */}
      <div className="space-y-6">
        {/* Tab 1: All Delivery Slips */}
        {activeTab === "all" && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Kết quả lọc: {filteredDeliveries.length} phiếu giao hàng
              </span>
              <span className="text-[11px] text-slate-400 italic">Nhấp vào Mã Đơn Hàng hoặc Mã Sản Phẩm để xem chi tiết</span>
            </div>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold uppercase text-slate-400">
                    <th className="px-4 py-3">Số PXK</th>
                    <th className="px-4 py-3">Ngày giao</th>
                    <th className="px-4 py-3">Đơn hàng PO</th>
                    <th className="px-4 py-3">Khách hàng</th>
                    <th className="px-4 py-3">Nhà cung cấp</th>
                    <th className="px-4 py-3">Tên sản phẩm</th>
                    <th className="px-4 py-3 text-right">Số lượng giao</th>
                    <th className="px-4 py-3 text-right">Doanh thu</th>
                    <th className="px-4 py-3 text-right">Lợi nhuận</th>
                    <th className="px-4 py-3 text-center">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {filteredDeliveries.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-12 text-center text-slate-400">
                        Không tìm thấy dữ liệu giao hàng phù hợp với bộ lọc.
                      </td>
                    </tr>
                  ) : (
                    filteredDeliveries.map((d, i) => {
                      const qty = parseNumber(d["Số lượng giao"]);
                      const rev = parseNumber(d["Doanh thu"]);
                      const profit = parseNumber(d["Lợi nhuận gộp"]);
                      const hasIncident = d["Sự cố"] === "1" || d["Sự cố"] === 1;
                      const deliveryId = d.id || d.ID || `${d["Số PXK"] || ''}-${d["Đơn hàng"] || ''}-${d["Tên sản phẩm"] || ''}-${i}`;

                      return (
                        <tr 
                          key={deliveryId} 
                          onClick={() => {
                            setEditingSlip({...d});
                            setIsEditModalOpen(true);
                            setConfirmDelete(false);
                          }}
                          className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                        >
                          <td className="px-4 py-3 font-mono font-bold text-blue-700">
                            {d["Số PXK"] || <span className="text-slate-300">N/A</span>}
                          </td>
                          <td className="px-4 py-3 text-slate-500">{d["Ngày giao"]}</td>
                          <td className="px-4 py-3">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onPoClick && onPoClick(d["Đơn hàng"]);
                              }}
                              className="font-semibold text-blue-600 hover:underline flex items-center gap-1"
                            >
                              {d["Đơn hàng"]}
                              <ArrowUpRight size={12} className="text-slate-400" />
                            </button>
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-800">{d["Khách hàng"]}</td>
                          <td className="px-4 py-3 font-medium text-slate-600">{d["Nhà cung cấp"]}</td>
                          <td className="px-4 py-3 max-w-[200px] truncate text-slate-600">
                            {d["Tên sản phẩm"]}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-slate-950">
                            {qty.toLocaleString("vi-VN")}
                          </td>
                          <td className="px-4 py-3 text-right font-extrabold text-blue-700">
                            {formatCurrency(rev)}
                          </td>
                          <td className={`px-4 py-3 text-right font-bold ${profit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                            {formatCurrency(profit)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <span className={`px-2 py-1 rounded-full text-[10px] font-semibold ${
                                String(d["Status"] || "").includes("Hoàn thành") 
                                  ? "bg-emerald-50 text-emerald-700" 
                                  : "bg-amber-50 text-amber-700"
                              }`}>
                                {d["Status"] || "Hoàn thành"}
                              </span>
                              {hasIncident && (
                                <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-rose-50 text-rose-700 rounded text-[9px] font-bold" title={d["Chi tiết sự cố"]}>
                                  <AlertTriangle size={8} /> Sự cố
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Apple Inset Cards Feed */}
            <div className="md:hidden space-y-2.5 p-2.5 bg-[#F5F5F7]">
              {filteredDeliveries.length === 0 ? (
                <div className="bg-white rounded-2xl p-8 text-center text-slate-400 border border-black/[0.06] text-xs">
                  Không tìm thấy dữ liệu giao hàng phù hợp với bộ lọc.
                </div>
              ) : (
                filteredDeliveries.map((d, i) => {
                  const qty = parseNumber(d["Số lượng giao"]);
                  const rev = parseNumber(d["Doanh thu"]);
                  const profit = parseNumber(d["Lợi nhuận gộp"]);
                  const hasIncident = d["Sự cố"] === "1" || d["Sự cố"] === 1;
                  const deliveryId = d.id || d.ID || `${d["Số PXK"] || ""}-${d["Đơn hàng"] || ""}-${d["Tên sản phẩm"] || ""}-${i}`;

                  return (
                    <div 
                      key={deliveryId} 
                      onClick={() => {
                        setEditingSlip({...d});
                        setIsEditModalOpen(true);
                        setConfirmDelete(false);
                      }}
                      className="bg-white rounded-2xl p-3.5 border border-black/[0.06] shadow-xs active:scale-[0.98] transition-all cursor-pointer space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono font-bold text-xs sm:text-sm text-blue-700">
                              {d["Số PXK"] || "PXK N/A"}
                            </span>
                            {hasIncident && (
                              <span className="px-1.5 py-0.2 bg-rose-100 text-rose-700 rounded-full text-[9px] font-bold flex items-center gap-0.5">
                                <AlertTriangle size={10} /> Sự cố
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-semibold text-slate-900 truncate mt-0.5">
                            {d["Khách hàng"]}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate">
                            {d["Tên sản phẩm"]}
                          </p>
                        </div>

                        <div className="text-right shrink-0">
                          <span className={clsx(
                            "px-2 py-0.5 rounded-full text-[10px] font-bold inline-block",
                            String(d["Status"] || "").includes("Hoàn thành") 
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200" 
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          )}>
                            {d["Status"] || "Hoàn thành"}
                          </span>
                          <span className="text-[10px] text-slate-400 block mt-0.5 font-mono">
                            {d["Ngày giao"]}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-slate-100 text-center">
                        <div className="bg-slate-50 rounded-xl p-1.5 border border-slate-100">
                          <span className="text-[9.5px] font-medium text-slate-400 block">Số lượng</span>
                          <span className="text-xs font-bold text-slate-900 font-mono">{qty.toLocaleString("vi-VN")}</span>
                        </div>
                        <div className="bg-blue-50/60 rounded-xl p-1.5 border border-blue-100/60">
                          <span className="text-[9.5px] font-medium text-blue-600 block">Doanh thu</span>
                          <span className="text-xs font-bold text-blue-700">{formatCurrency(rev)}</span>
                        </div>
                        <div className="bg-emerald-50/60 rounded-xl p-1.5 border border-emerald-100/60">
                          <span className="text-[9.5px] font-medium text-emerald-600 block">Lợi nhuận</span>
                          <span className={clsx("text-xs font-bold", profit >= 0 ? "text-emerald-700" : "text-rose-600")}>
                            {formatCurrency(profit)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 text-xs font-medium text-slate-500">
                        <div className="flex items-center gap-1 text-[11px]">
                          <span className="text-slate-400">PO:</span>
                          <span className="font-bold text-blue-600 font-mono">{d["Đơn hàng"]}</span>
                        </div>
                        <div className="flex items-center gap-1 text-blue-600 font-bold text-xs">
                          <span>Chi tiết</span>
                          <ChevronRight size={14} />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Group by Customer */}
        {activeTab === "customer" && (
          <div className="space-y-4">
            {customerGrouped.map((grp) => {
              const isCollapsed = collapsedGroups[`cust-${grp.customer}`] || false;
              return (
                <div key={grp.customer} className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                  {/* Collapsible Header */}
                  <div 
                    onClick={() => toggleGroup(`cust-${grp.customer}`)}
                    className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
                        <Users size={20} />
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-slate-800">{grp.customer}</h4>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Số lượng: <strong>{grp.slipsCount} phiếu xuất kho</strong> | Tổng lượng giao: <strong>{grp.totalQty.toLocaleString("vi-VN")}</strong>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 self-end md:self-auto">
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Doanh Thu</span>
                        <span className="text-sm font-extrabold text-blue-700">{formatCurrency(grp.revenue)}</span>
                      </div>
                      <div className="text-right border-l pl-6 border-slate-100">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Lợi Nhuận Gộp</span>
                        <span className={`text-sm font-extrabold ${grp.profit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                          {formatCurrency(grp.profit)}
                        </span>
                      </div>
                      <div className="text-slate-400 pl-2">
                        {isCollapsed ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
                      </div>
                    </div>
                  </div>

                  {/* Collapsed Table View */}
                  {!isCollapsed && (
                    <div className="border-t border-slate-100 overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50/50 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-100">
                            <th className="px-6 py-3">Số PXK</th>
                            <th className="px-4 py-3">Ngày giao</th>
                            <th className="px-4 py-3">Mã đơn PO</th>
                            <th className="px-4 py-3">Nhà cung cấp</th>
                            <th className="px-4 py-3">Sản phẩm</th>
                            <th className="px-4 py-3 text-right">Số lượng giao</th>
                            <th className="px-4 py-3 text-right">Doanh thu</th>
                            <th className="px-4 py-3 text-right">Lợi nhuận</th>
                            <th className="px-4 py-3 text-center">Sự cố</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs text-slate-600">
                          {grp.deliveries.map((d, i) => {
                            const qty = parseNumber(d["Số lượng giao"]);
                            const rev = parseNumber(d["Doanh thu"]);
                            const profit = parseNumber(d["Lợi nhuận gộp"]);
                            const deliveryId = d.id || d.ID || `${d["Số PXK"] || ''}-${d["Đơn hàng"] || ''}-${d["Tên sản phẩm"] || ''}-${i}`;
                            return (
                              <tr 
                                key={deliveryId} 
                                onClick={() => {
                                  setEditingSlip({...d});
                                  setIsEditModalOpen(true);
                                  setConfirmDelete(false);
                                }}
                                className="hover:bg-slate-50/30 cursor-pointer"
                              >
                                <td className="px-6 py-3 font-mono font-bold text-blue-700">{d["Số PXK"]}</td>
                                <td className="px-4 py-3">{d["Ngày giao"]}</td>
                                <td className="px-4 py-3">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onPoClick && onPoClick(d["Đơn hàng"]);
                                    }}
                                    className="font-semibold text-blue-600 hover:underline"
                                  >
                                    {d["Đơn hàng"]}
                                  </button>
                                </td>
                                <td className="px-4 py-3 font-medium">{d["Nhà cung cấp"]}</td>
                                <td className="px-4 py-3 truncate max-w-[200px]">
                                  <ProductHoverCard 
                                    productName={d["Tên sản phẩm"]} 
                                    productCode={d["Mã sản phẩm"]} 
                                    pricingData={pricingData}
                                  >
                                    {d["Tên sản phẩm"]}
                                  </ProductHoverCard>
                                </td>
                                <td className="px-4 py-3 text-right font-bold">{qty.toLocaleString("vi-VN")}</td>
                                <td className="px-4 py-3 text-right font-bold text-slate-900">{formatCurrency(rev)}</td>
                                <td className={`px-4 py-3 text-right font-bold ${profit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                                  {formatCurrency(profit)}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  {d["Sự cố"] === "1" || d["Sự cố"] === 1 ? (
                                    <span className="inline-flex px-1.5 py-0.5 text-[9px] bg-rose-50 text-rose-700 font-bold rounded">Có</span>
                                  ) : (
                                    <span className="text-slate-300">-</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Tab 3: Group by Supplier */}
        {activeTab === "supplier" && (
          <div className="space-y-4">
            {supplierGrouped.map((grp) => {
              const isCollapsed = collapsedGroups[`supp-${grp.supplier}`] || false;
              return (
                <div key={grp.supplier} className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                  {/* Collapsible Header */}
                  <div 
                    onClick={() => toggleGroup(`supp-${grp.supplier}`)}
                    className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg">
                        <Layers size={20} />
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-slate-800">{grp.supplier}</h4>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Số lượng: <strong>{grp.slipsCount} phiếu giao hàng</strong> | Tổng lượng xuất: <strong>{grp.totalQty.toLocaleString("vi-VN")}</strong>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 self-end md:self-auto">
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Trị Giá Giá Vốn (Mua)</span>
                        <span className="text-sm font-extrabold text-slate-700">{formatCurrency(grp.cost)}</span>
                      </div>
                      <div className="text-right border-l pl-6 border-slate-100">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Doanh Thu Giao hàng</span>
                        <span className="text-sm font-extrabold text-blue-700">
                          {formatCurrency(grp.revenue)}
                        </span>
                      </div>
                      <div className="text-slate-400 pl-2">
                        {isCollapsed ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
                      </div>
                    </div>
                  </div>

                  {/* Collapsed Table View */}
                  {!isCollapsed && (
                    <div className="border-t border-slate-100 overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50/50 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-100">
                            <th className="px-6 py-3">Số PXK</th>
                            <th className="px-4 py-3">Ngày giao</th>
                            <th className="px-4 py-3">Mã đơn PO</th>
                            <th className="px-4 py-3">Khách hàng</th>
                            <th className="px-4 py-3">Sản phẩm</th>
                            <th className="px-4 py-3 text-right">Số lượng giao</th>
                            <th className="px-4 py-3 text-right">Đơn giá mua</th>
                            <th className="px-4 py-3 text-right">Giá vốn</th>
                            <th className="px-4 py-3 text-right">Doanh thu</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs text-slate-600">
                          {grp.deliveries.map((d, i) => {
                            const qty = parseNumber(d["Số lượng giao"]);
                            const buyPrice = parseNumber(d["Đơn giá nhập"]);
                            const cost = buyPrice * qty;
                            const rev = parseNumber(d["Doanh thu"]);
                            const deliveryId = d.id || d.ID || `${d["Số PXK"] || ''}-${d["Đơn hàng"] || ''}-${d["Tên sản phẩm"] || ''}-${i}`;
                            return (
                              <tr 
                                key={deliveryId} 
                                onClick={() => {
                                  setEditingSlip({...d});
                                  setIsEditModalOpen(true);
                                  setConfirmDelete(false);
                                }}
                                className="hover:bg-slate-50/30 cursor-pointer"
                              >
                                <td className="px-6 py-3 font-mono font-bold text-amber-700">{d["Số PXK"]}</td>
                                <td className="px-4 py-3">{d["Ngày giao"]}</td>
                                <td className="px-4 py-3">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onPoClick && onPoClick(d["Đơn hàng"]);
                                    }}
                                    className="font-semibold text-blue-600 hover:underline"
                                  >
                                    {d["Đơn hàng"]}
                                  </button>
                                </td>
                                <td className="px-4 py-3 font-medium">{d["Khách hàng"]}</td>
                                <td className="px-4 py-3 truncate max-w-[200px]">{d["Tên sản phẩm"]}</td>
                                <td className="px-4 py-3 text-right font-bold">{qty.toLocaleString("vi-VN")}</td>
                                <td className="px-4 py-3 text-right">{formatCurrency(buyPrice)}</td>
                                <td className="px-4 py-3 text-right font-semibold text-slate-800">{formatCurrency(cost)}</td>
                                <td className="px-4 py-3 text-right font-bold text-blue-700">{formatCurrency(rev)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Tab 4: Group by Purchase Order */}
        {activeTab === "po" && (
          <div className="space-y-4">
            {poGrouped.map((grp) => {
              const isCollapsed = collapsedGroups[`po-${grp.poNumber}`] || false;
              return (
                <div key={grp.poNumber} className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                  {/* Collapsible Header */}
                  <div 
                    onClick={() => toggleGroup(`po-${grp.poNumber}`)}
                    className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
                        <FileText size={20} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-base font-bold text-slate-800">Đơn hàng: {grp.poNumber}</h4>
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-700 rounded">
                            {grp.customer}
                          </span>
                        </div>
                        {/* Progress Bar */}
                        <div className="flex items-center gap-2 mt-2">
                          <div className="w-32 bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${grp.progressPercent >= 100 ? "bg-emerald-500" : "bg-blue-500"}`}
                              style={{ width: `${grp.progressPercent}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-400">
                            Tiến độ: <strong className="text-slate-700">{grp.progressPercent}%</strong> ({grp.totalDelivered.toLocaleString("vi-VN")} / {grp.totalOrdered.toLocaleString("vi-VN")})
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 self-end md:self-auto">
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Doanh Thu Giao</span>
                        <span className="text-sm font-extrabold text-blue-700">{formatCurrency(grp.revenue)}</span>
                      </div>
                      <div className="text-slate-400 pl-2">
                        {isCollapsed ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
                      </div>
                    </div>
                  </div>

                  {/* Collapsed Table View */}
                  {!isCollapsed && (
                    <div className="border-t border-slate-100 overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50/50 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-100">
                            <th className="px-6 py-3">Số PXK</th>
                            <th className="px-4 py-3">Ngày giao</th>
                            <th className="px-4 py-3">Sản phẩm</th>
                            <th className="px-4 py-3">Nhà cung cấp</th>
                            <th className="px-4 py-3 text-right">Lượng đặt</th>
                            <th className="px-4 py-3 text-right">Lượng giao đợt này</th>
                            <th className="px-4 py-3 text-right">Doanh thu</th>
                            <th className="px-4 py-3 text-center">Trạng thái</th>
                            <th className="px-4 py-3 text-right">Thao tác</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs text-slate-600">
                          {grp.deliveries.map((d, i) => {
                            const qtyDelivered = parseNumber(d["Số lượng giao"]);
                            const qtyOrdered = parseNumber(d["Số lượng đặt"]) || grp.totalOrdered;
                            const rev = parseNumber(d["Doanh thu"]);
                            const deliveryId = d.id || d.ID || `${d["Số PXK"] || ''}-${d["Đơn hàng"] || ''}-${d["Tên sản phẩm"] || ''}-${i}`;
                            return (
                              <tr key={deliveryId} className="hover:bg-slate-50/30">
                                <td className="px-6 py-3 font-mono font-bold text-blue-700">{d["Số PXK"]}</td>
                                <td className="px-4 py-3">{d["Ngày giao"]}</td>
                                <td className="px-4 py-3 truncate max-w-[200px]">{d["Tên sản phẩm"]}</td>
                                <td className="px-4 py-3 font-medium">{d["Nhà cung cấp"]}</td>
                                <td className="px-4 py-3 text-right">{qtyOrdered.toLocaleString("vi-VN")}</td>
                                <td className="px-4 py-3 text-right font-bold text-slate-900">{qtyDelivered.toLocaleString("vi-VN")}</td>
                                <td className="px-4 py-3 text-right font-bold text-blue-700">{formatCurrency(rev)}</td>
                                <td className="px-4 py-3 text-center">
                                  <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 font-bold rounded text-[10px]">
                                    {d["Status"] || "Hoàn thành"}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <button 
                                      onClick={() => {
                                        setEditingSlip({...d});
                                        setIsEditModalOpen(true);
                                        setConfirmDelete(false);
                                      }}
                                      className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                    >
                                      <PlusCircle size={14} className="rotate-45" /> 
                                    </button>
                                    <button 
                                      onClick={() => {
                                        setEditingSlip({...d});
                                        setIsEditModalOpen(true);
                                        setConfirmDelete(true);
                                      }}
                                      className="p-1 text-red-600 hover:bg-red-50 rounded"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {isEditModalOpen && editingSlip && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                <Truck className="text-blue-600" />
                Chỉnh sửa phiếu giao: {editingSlip["Số PXK"]}
              </h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-2xl font-light">&times;</button>
            </div>
            
            <form 
              className="p-6 space-y-4" 
              onSubmit={async (e) => {
                e.preventDefault();
                if (onEdit) {
                  await onEdit(editingSlip);
                  setIsEditModalOpen(false);
                  setEditingSlip(null);
                  toast.success("Đã cập nhật phiếu giao hàng");
                }
              }}
            >
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Số PXK</label>
                  <input 
                    type="text" 
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50"
                    value={editingSlip["Số PXK"] || ''}
                    onChange={e => setEditingSlip({...editingSlip, "Số PXK": e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Ngày giao</label>
                  <input 
                    type="text" 
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50"
                    value={editingSlip["Ngày giao"] || ''}
                    onChange={e => setEditingSlip({...editingSlip, "Ngày giao": e.target.value})}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Số lượng giao</label>
                <input 
                  type="number" 
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold bg-gray-50"
                  value={parseNumber(editingSlip["Số lượng giao"])}
                  onChange={e => setEditingSlip({...editingSlip, "Số lượng giao": parseInt(e.target.value)})}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Trạng thái</label>
                <select 
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50"
                  value={editingSlip["Status"] || editingSlip["Trạng thái"] || "Hoàn thành"}
                  onChange={e => setEditingSlip({...editingSlip, "Status": e.target.value, "Trạng thái": e.target.value})}
                >
                  <option value="Hoàn thành">Hoàn thành</option>
                  <option value="Đang tiến hành">Đang tiến hành</option>
                  <option value="Hủy">Hủy / Trả về</option>
                </select>
              </div>

              <div className="pt-4 flex items-center justify-between gap-3 border-t border-gray-100">
                {confirmDelete ? (
                  <div className="flex items-center gap-2 animate-in slide-in-from-left-2 duration-200">
                    <button 
                      type="button"
                      onClick={() => {
                        if (onDelete) {
                          onDelete(editingSlip);
                          setIsEditModalOpen(false);
                          setConfirmDelete(false);
                        }
                      }}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg font-bold text-xs hover:bg-red-700 shadow-sm"
                    >
                      Xác nhận xóa
                    </button>
                    <button 
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg font-bold text-xs hover:bg-slate-200"
                    >
                      Hủy
                    </button>
                  </div>
                ) : (
                  <button 
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="flex items-center gap-1.5 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg font-bold text-sm transition-all group"
                  >
                    <Trash2 size={16} className="group-hover:scale-110 transition-transform" />
                    Xóa phiếu
                  </button>
                )}
                <div className="flex items-center gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg font-bold hover:bg-gray-50 text-sm"
                  >
                    Hủy
                  </button>
                  <button 
                    type="submit"
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 text-sm shadow-sm"
                  >
                    Lưu thay đổi
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual Creation Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-[#F5F5F7] px-6 py-4 text-slate-900 border-b border-black/[0.06] flex items-center justify-between">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Truck size={20} className="text-blue-600" />
                Tạo Phiếu Xuất Kho (PXK) Mới
              </h3>
              <MacTrafficLights onClose={() => setIsAddModalOpen(false)} />
            </div>

            <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
              {/* Row 1: Khách hàng & Nhà cung cấp */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Khách Hàng</label>
                  <select
                    value={newSlip["Khách hàng"]}
                    onChange={(e) => {
                      const newCust = e.target.value;
                      // Validate if current selected PO belongs to new customer
                      let currentPoValid = false;
                      if (newSlip["Đơn hàng"] && newCust) {
                        const poLine = poLinesData.find(l => !l.isDeleted && l["Số đơn hàng"] === newSlip["Đơn hàng"]);
                        if (poLine) {
                          const c1 = (poLine["Khách hàng"] || "").trim().toLowerCase();
                          const c2 = newCust.trim().toLowerCase();
                          if (c1.includes(c2) || c2.includes(c1)) currentPoValid = true;
                        }
                      } else if (!newCust) {
                        currentPoValid = true;
                      }

                      setNewSlip({
                        ...newSlip,
                        "Khách hàng": newCust,
                        "Đơn hàng": currentPoValid ? newSlip["Đơn hàng"] : "",
                        "Chi tiết đơn hàng": currentPoValid ? newSlip["Chi tiết đơn hàng"] : "",
                        "Tên sản phẩm": currentPoValid ? newSlip["Tên sản phẩm"] : "",
                        "Mã sản phẩm": currentPoValid ? newSlip["Mã sản phẩm"] : "",
                        "Số lượng giao": currentPoValid ? newSlip["Số lượng giao"] : ""
                      });
                    }}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">Tất cả khách hàng (Lọc PO)</option>
                    {allCustomersList.map((custName, idx) => (
                      <option key={`cust-${custName}-${idx}`} value={custName}>
                        {custName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nhà Cung Cấp (Bổ Sung / Tự Động Từ PO)</label>
                  <select
                    value={newSlip["Nhà cung cấp"]}
                    onChange={(e) => setNewSlip({ ...newSlip, "Nhà cung cấp": e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">Chọn nhà cung cấp (nếu cần bổ sung)</option>
                    {allSuppliersList.map((suppName, idx) => (
                      <option key={`supp-${suppName}-${idx}`} value={suppName}>
                        {suppName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 2: Số phiếu (Nhập thủ công) & Số đơn hàng PO */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Số Phiếu - Nhập Thủ Công *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 26/PXK/99"
                    value={newSlip["Số PXK"]}
                    onChange={(e) => setNewSlip({ ...newSlip, "Số PXK": e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Số Đơn Hàng PO *</label>
                  <select
                    required
                    value={newSlip["Đơn hàng"]}
                    onChange={(e) => {
                      const poNum = e.target.value;
                      const selPO = poNum.trim().toLowerCase();

                      const matchingLines = poLinesData.filter(l => 
                        !l.isDeleted && String(l["Số đơn hàng"] || "").trim().toLowerCase() === selPO
                      );
                      const firstLine = matchingLines[0];

                      let autoSupplier = firstLine ? (firstLine["Nhà cung cấp"] || "") : "";
                      if (!autoSupplier && selPO) {
                        const matchDel = deliveryData.find(d => 
                          !d.isDeleted && 
                          String(d["Đơn hàng"] || "").trim().toLowerCase() === selPO &&
                          d["Nhà cung cấp"]
                        );
                        if (matchDel) autoSupplier = matchDel["Nhà cung cấp"];
                      }
                      if (!autoSupplier && firstLine && firstLine["Mã giá bán"] && pricingData) {
                        const matchPrice = pricingData.find(p => 
                          !p.isDeleted && (p["Mã giá bán"] === firstLine["Mã giá bán"]) && (p["RP_Nhà cung cấp"] || p["Nhà cung cấp"])
                        );
                        if (matchPrice) autoSupplier = matchPrice["RP_Nhà cung cấp"] || matchPrice["Nhà cung cấp"];
                      }

                      const custName = firstLine ? (firstLine["Khách hàng"] || newSlip["Khách hàng"]) : newSlip["Khách hàng"];
                      const finalSupplier = autoSupplier || newSlip["Nhà cung cấp"];

                      if (matchingLines.length === 1) {
                        const singleLine = matchingLines[0];
                        const qty = singleLine["Còn lại"] ? String(singleLine["Còn lại"]).replace(/,/g, '') : String(singleLine["Số lượng"] || "").replace(/,/g, '');
                        setNewSlip({
                          ...newSlip,
                          "Đơn hàng": poNum,
                          "Khách hàng": custName,
                          "Nhà cung cấp": finalSupplier,
                          "Chi tiết đơn hàng": String(singleLine["STT"] || singleLine.id || ""),
                          "Tên sản phẩm": singleLine["Tên sản phẩm"] || "Sản phẩm",
                          "Mã sản phẩm": singleLine["Mã của khách"] || singleLine["Mã sản phẩm"] || "",
                          "ĐVT": singleLine["ĐVT"] || "Cái",
                          "Số lượng giao": qty
                        });
                      } else {
                        setNewSlip({
                          ...newSlip,
                          "Đơn hàng": poNum,
                          "Khách hàng": custName,
                          "Nhà cung cấp": finalSupplier,
                          "Tên sản phẩm": "",
                          "Chi tiết đơn hàng": "",
                          "Mã sản phẩm": "",
                          "Số lượng giao": ""
                        });
                      }
                    }}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">
                      {newSlip["Khách hàng"] 
                        ? `-- Chọn PO của ${newSlip["Khách hàng"]} (${availablePOsForCustomer.length} đơn) --` 
                        : "-- Chọn đơn hàng PO --"}
                    </option>
                    {availablePOsForCustomer.map((poItem) => (
                      <option key={poItem.po} value={poItem.po}>
                        {poItem.po} {!newSlip["Khách hàng"] && poItem.customer ? `(${poItem.customer})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Sản Phẩm (Dựa theo PO) *</label>
                <select
                  required
                  disabled={!newSlip["Đơn hàng"]}
                  value={newSlip["Chi tiết đơn hàng"]}
                  onChange={(e) => {
                    const lineId = e.target.value;
                    const line = poProducts.find(l => 
                      String(l.lineKey || l.STT || l.id) === String(lineId) ||
                      String(l.STT) === String(lineId)
                    );
                    if (line) {
                      const reqQty = line["Còn lại"] !== undefined && line["Còn lại"] !== null && line["Còn lại"] !== ""
                        ? String(line["Còn lại"]).replace(/,/g, '') 
                        : String(line["Số lượng"] || "").replace(/,/g, '');

                      setNewSlip(prev => ({ 
                        ...prev, 
                        "Chi tiết đơn hàng": lineId,
                        "Tên sản phẩm": line["Tên sản phẩm"] || "Sản phẩm",
                        "Mã sản phẩm": line["Mã của khách"] || line["Mã sản phẩm"] || "",
                        "ĐVT": line["ĐVT"] || "Cái",
                        "Nhà cung cấp": line["Nhà cung cấp"] || prev["Nhà cung cấp"] || "",
                        "Số lượng giao": reqQty
                      }));
                    } else {
                      setNewSlip(prev => ({
                        ...prev,
                        "Chi tiết đơn hàng": lineId,
                        "Tên sản phẩm": "",
                        "Mã sản phẩm": "",
                        "Số lượng giao": ""
                      }));
                    }
                  }}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50"
                >
                  <option value="">
                    {newSlip["Đơn hàng"] 
                      ? (poProducts.length > 0 ? `-- Chọn sản phẩm trong PO (${poProducts.length} sản phẩm) --` : "Không tìm thấy dữ liệu sản phẩm trong PO") 
                      : "Vui lòng chọn PO trước"}
                  </option>
                  {poProducts.map((p, idx) => {
                    const lineKey = String(p.lineKey || p.STT || p.id || `prod-${idx}`);
                    const reqQty = p["Còn lại"] !== undefined && p["Còn lại"] !== null && p["Còn lại"] !== "" ? p["Còn lại"] : (p["Số lượng"] || "");
                    const unitStr = p["ĐVT"] ? ` ${p["ĐVT"]}` : "";
                    return (
                      <option key={`poprod-${lineKey}-${idx}`} value={lineKey}>
                        {p["Tên sản phẩm"]} {reqQty !== "" ? `(Cần giao: ${reqQty}${unitStr})` : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Số lượng giao *</label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 500"
                    value={newSlip["Số lượng giao"]}
                    onChange={(e) => setNewSlip({ ...newSlip, "Số lượng giao": e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Ngày giao</label>
                  <input
                    type="text"
                    placeholder="DD/MM/YYYY"
                    value={newSlip["Ngày giao"]}
                    onChange={(e) => setNewSlip({ ...newSlip, "Ngày giao": e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-50 rounded-lg transition-all"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-md transition-all"
                >
                  Lưu phiếu giao
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <GoogleSheetsSyncModal
        isOpen={isSheetsModalOpen}
        onClose={() => setIsSheetsModalOpen(false)}
        deliveries={deliveryData}
        poLines={poLinesData}
      />
    </div>
  );
}
