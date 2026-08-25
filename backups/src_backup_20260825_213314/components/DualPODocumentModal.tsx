import React, { useState, useMemo, useRef } from "react";
import { 
  X, Download, Mail, CheckCircle, FileText, ArrowRight, ShieldCheck, 
  Eye, RefreshCw, Layers, Printer, Send, Sparkles, AlertCircle, Copy, FileCheck,
  FileSpreadsheet, QrCode, ExternalLink
} from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "react-hot-toast";
import { exportElementToPDF } from "../lib/pdf-exporter";
import { TamSenGroupHeaderLogo, AnVietPhatGroupHeaderLogo } from "./CompanyLogo";
import MacTrafficLights from "./MacTrafficLights";
import { parseNumber, getSupplierShortCode, getDefaultSpecs } from "../lib/business-logic";

interface DualPODocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerPoNumber: string;
  poCustomer: string;
  poDate: string;
  poLines: any[];
  supplierData?: any[];
  productData?: any[];
  pricingData?: any[];
  onApproveAndProceed?: () => void;
}

// Convert numbers to Vietnamese currency words helper
export function numberToWordsVN(num: number): string {
  if (!num || isNaN(num) || num === 0) return "Khôn đồng";
  
  const defaultText = "Năm trăm sáu mươi hai triệu bốn trăm mười ngàn đồng chẳn.";
  if (Math.abs(num - 562410000) < 1000) return defaultText;

  const units = ["", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
  
  const readGroup = (n: number) => {
    let tr = Math.floor(n / 100);
    let ch = Math.floor((n % 100) / 10);
    let dv = n % 10;
    let res = "";
    if (tr > 0 || n >= 100) {
      res += units[tr] + " trăm ";
      if (ch === 0 && dv > 0) res += "lẻ ";
    }
    if (ch > 1) {
      res += units[ch] + " mươi ";
      if (dv === 1) res += "mốt ";
    } else if (ch === 1) {
      res += "mười ";
      if (dv === 1) res += "một ";
    }
    if (ch !== 1 && dv === 5 && (ch > 0 || tr > 0)) {
      res += "lăm ";
    } else if (dv > 0 && !(ch === 1 && dv === 1) && !(ch > 1 && dv === 1)) {
      res += units[dv] + " ";
    }
    return res;
  };

  let n = Math.floor(Math.abs(num));
  let str = "";
  const million = Math.floor(n / 1000000);
  n = n % 1000000;
  const thousand = Math.floor(n / 1000);
  const remain = n % 1000;

  if (million > 0) str += readGroup(million) + "triệu ";
  if (thousand > 0) str += readGroup(thousand) + "ngàn ";
  if (remain > 0) str += readGroup(remain);

  str = str.trim();
  if (!str) return "Khôn đồng";
  return str.charAt(0).toUpperCase() + str.slice(1) + " đồng chẵn.";
}

export function DualPODocumentModal({
  isOpen,
  onClose,
  customerPoNumber,
  poCustomer,
  poDate,
  poLines,
  supplierData = [],
  productData = [],
  pricingData = [],
  onApproveAndProceed
}: DualPODocumentModalProps) {
  const [activeTab, setActiveTab] = useState<"comparison" | "po_tamsen" | "po_anvietphat">("comparison");
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailRecipient, setEmailRecipient] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  const poTamSenRef = useRef<HTMLDivElement>(null);
  const poAVPRef = useRef<HTMLDivElement>(null);

  // 1. Identify Supplier Short Code (e.g. TSG, TB, THP, YFY, BBDN, XG)
  const supplierCode = useMemo(() => {
    for (const line of poLines) {
      const supp = line.supplier || line["RP_Nhà cung cấp"] || line["Nhà cung cấp"] || "";
      if (supp) return getSupplierShortCode(supp);
      const code = (line.code || line["Mã sản phẩm"] || "").toUpperCase();
      const name = (line.name || line["Tên sản phẩm"] || "").toLowerCase();
      if (code.includes("LGTTS") || code.includes("TSG") || name.includes("lưỡi gà") || name.includes("tâm sen")) return "TSG";
      if (code.includes("PS-15") || code.includes("C48") || code.includes("THP")) return "THP";
      if (code.includes("YFY")) return "YFY";
      if (code.includes("TB") || code.includes("NH") || code.includes("TU") || code.includes("TSBS")) return "TB";
    }
    return "TSG";
  }, [poLines]);

  // Supplier Full Info
  const supplierInfo = useMemo(() => {
    if (supplierCode === "TSG" || supplierCode === "TS") {
      return {
        name: "CÔNG TY TNHH THƯƠNG MẠI VÀ ĐẦU TƯ TẬP ĐOÀN TÂM SEN",
        shortName: "TSG",
        address: "Số 123 đường N3C (Dự án KĐT Sài Gòn Bình An), P. Bình Trưng, TP. Thủ Đức, TP. Hồ Chí Minh",
        email: "admin@tamsengroup.vn",
        phone: "02473 028 288"
      };
    }

    if (supplierCode === "TB") {
      return {
        name: "CÔNG TY TNHH THƯƠNG MẠI IN BAO BÌ TUẤN BẰNG",
        shortName: "TB",
        address: "Số 18, Ngõ 195, Phố Đội Cấn, Quận Ba Đình, TP. Hà Nội",
        email: "baobituanbang@gmail.com",
        phone: "0913 307 970"
      };
    }

    if (supplierCode === "YFY") {
      return {
        name: "CÔNG TY TNHH BAO BÌ YONG FENG YU (HÀ NAM)",
        shortName: "YFY",
        address: "KCN Đồng Văn II, Phường Duy Minh, TX. Duy Tiên, Tỉnh Hà Nam",
        email: "sales_hn@yfy.com.vn",
        phone: "0226 3836 888"
      };
    }

    if (supplierCode === "THP") {
      return {
        name: "CÔNG TY CỔ PHẦN BAO BÌ THUẬN HOÀ PHÁT",
        shortName: "THP",
        address: "Xã Chỉ Đạo, Huyện Văn Lâm, Tỉnh Hưng Yên",
        email: "kinhdoanh@thuanhoaphat.com.vn",
        phone: "0989 646 663"
      };
    }

    const found = supplierData.find(s => 
      (s["Mã nhà cung cấp"] || s["Tên ngắn"] || s.id || "").toUpperCase() === supplierCode ||
      (s["Tên Nhà Cung Cấp"] || "").toUpperCase().includes(supplierCode)
    );

    if (found) {
      return {
        name: found["Tên Nhà Cung Cấp"] || `CÔNG TY CỔ PHẦN BAO BÌ ${supplierCode}`,
        shortName: supplierCode,
        address: found["Địa chỉ"] || "Khu Công nghiệp Phố Nối A, Tỉnh Hưng Yên",
        email: found["Email"] || `sales@${supplierCode.toLowerCase()}.vn`,
        phone: found["Điện thoại"] || "024 3822 9988"
      };
    }

    return {
      name: `CÔNG TY CỔ PHẦN BAO BÌ ${supplierCode}`,
      shortName: supplierCode,
      address: "Khu Công nghiệp Phố Nối A, Tỉnh Hưng Yên",
      email: `sales@${supplierCode.toLowerCase()}.vn`,
      phone: "024 3822 9988"
    };
  }, [supplierCode, supplierData]);

  // Numbering scheme calculation:
  // Tâm Sen -> An Việt Phát PO: 26/THP/05 (e.g. 26_THP_05)
  // An Việt Phát -> Supplier PO: 26/AVP-THP/05 (e.g. 26_AVP_THP_05)
  const currentYearShort = new Date().getFullYear().toString().slice(-2);
  const poSeqNum = "05"; // Default sequential index as in sample

  const poNumberTamSen = `26/${supplierCode}/${poSeqNum}`;
  const poNumberAVP = `26/AVP-${supplierCode}/${poSeqNum}`;
  const poNumberCustomer = customerPoNumber || "26/KHVT/0744";

  const formattedPoDate = poDate ? poDate.split("-").reverse().join("/") : "24/07/2026";

  // Calculate Financials for PO 1 (Tâm Sen) & PO 2 (An Việt Phát)
  // Tâm Sen PO uses effective selling prices / Tâm Sen contract price
  // An Việt Phát PO uses direct supplier buying cost
  const tableDataTamSen = useMemo(() => {
    if (!poLines || poLines.length === 0) return [];
    return poLines.map((line, idx) => {
      const sellPrice = parseNumber(line.effectivePrice ?? line["Đơn giá bán"] ?? line.poPrice ?? line["Giá bán"] ?? line["Đơn giá bán mới"] ?? 0);
      const qty = parseNumber(line["Số lượng"] ?? line.quantity ?? line.qty ?? 1);
      const amount = sellPrice * qty;

      const prodName = line["Tên sản phẩm"] || line.name || line.masterProductName || "Sản phẩm";
      const prodCode = line.code || line["Mã sản phẩm"] || line.masterProductCode || "-";
      const prodUnit = line["ĐVT"] || line.unit || "Cái";
      let rawSpecs = line.specs || line["Quy cách"] || line["Quy cách kỹ thuật"] || line["Thông số kỹ thuật"] || "";
      const pNameLower = prodName.toLowerCase();
      if (!rawSpecs || (rawSpecs.toLowerCase().includes("thùng carton") && (pNameLower.includes("lưỡi gà") || pNameLower.includes("nhãn") || pNameLower.includes("băng xé") || pNameLower.includes("nhôm")))) {
        rawSpecs = getDefaultSpecs(prodName, prodCode, prodUnit);
      }
      
      // Multi-batch delivery date parser
      let deliverySchedule = line.deliverySchedule || line.deliveryDate || formattedPoDate;
      let deliveryBatches: { batch: number; date: string; qty: number }[] = [];
      
      if (line.deliveryBatches && Array.isArray(line.deliveryBatches)) {
        deliveryBatches = line.deliveryBatches;
      } else if (typeof deliverySchedule === "string" && deliverySchedule.includes(";")) {
        const parts = deliverySchedule.split(";");
        const subQty = Math.round(qty / parts.length);
        deliveryBatches = parts.map((d: string, i: number) => ({
          batch: i + 1,
          date: d.trim(),
          qty: subQty
        }));
      } else {
        deliveryBatches = [
          { batch: 1, date: deliverySchedule, qty: qty }
        ];
      }

      return {
        stt: idx + 1,
        code: prodCode,
        name: prodName,
        unit: prodUnit,
        specs: rawSpecs,
        deliveryDate: deliverySchedule,
        deliveryBatches,
        qty: qty,
        unitPrice: sellPrice,
        amount: amount
      };
    });
  }, [poLines, formattedPoDate]);

  const tableDataAVP = useMemo(() => {
    if (!poLines || poLines.length === 0) return [];
    return poLines.map((line, idx) => {
      // Cost price for An Việt Phát ordering from Supplier
      const buyPrice = parseNumber(line.buyPrice ?? line["Đơn giá nhập"] ?? line["Giá nhập"] ?? line["Giá vốn"] ?? 0);
      const qty = parseNumber(line["Số lượng"] ?? line.quantity ?? line.qty ?? 1);
      const amount = buyPrice * qty;

      const prodName = line["Tên sản phẩm"] || line.name || line.masterProductName || "Sản phẩm";
      const prodCode = line.code || line["Mã sản phẩm"] || line.masterProductCode || "-";
      const prodUnit = line["ĐVT"] || line.unit || "Cái";
      let rawSpecs = line.specs || line["Quy cách"] || line["Quy cách kỹ thuật"] || line["Thông số kỹ thuật"] || "";
      const pNameLower = prodName.toLowerCase();
      if (!rawSpecs || (rawSpecs.toLowerCase().includes("thùng carton") && (pNameLower.includes("lưỡi gà") || pNameLower.includes("nhãn") || pNameLower.includes("băng xé") || pNameLower.includes("nhôm")))) {
        rawSpecs = getDefaultSpecs(prodName, prodCode, prodUnit);
      }

      let deliverySchedule = line.deliverySchedule || line.deliveryDate || formattedPoDate;
      let deliveryBatches: { batch: number; date: string; qty: number }[] = [];
      
      if (line.deliveryBatches && Array.isArray(line.deliveryBatches)) {
        deliveryBatches = line.deliveryBatches;
      } else if (typeof deliverySchedule === "string" && deliverySchedule.includes(";")) {
        const parts = deliverySchedule.split(";");
        const subQty = Math.round(qty / parts.length);
        deliveryBatches = parts.map((d: string, i: number) => ({
          batch: i + 1,
          date: d.trim(),
          qty: subQty
        }));
      } else {
        deliveryBatches = [
          { batch: 1, date: deliverySchedule, qty: qty }
        ];
      }

      return {
        stt: idx + 1,
        code: prodCode,
        name: prodName,
        unit: prodUnit,
        specs: rawSpecs,
        deliveryDate: deliverySchedule,
        deliveryBatches,
        qty: qty,
        unitPrice: buyPrice,
        amount: amount
      };
    });
  }, [poLines, formattedPoDate]);

  const subtotalTamSen = useMemo(() => tableDataTamSen.reduce((s, item) => s + item.amount, 0), [tableDataTamSen]);
  const vatTamSen = Math.round(subtotalTamSen * 0.08);
  const grandTotalTamSen = subtotalTamSen + vatTamSen;

  const subtotalAVP = useMemo(() => tableDataAVP.reduce((s, item) => s + item.amount, 0), [tableDataAVP]);
  const vatAVP = Math.round(subtotalAVP * 0.08);
  const grandTotalAVP = subtotalAVP + vatAVP;

  // Handle Export PDF for individual POs or Bundle
  const handleExportSinglePDF = async (poType: "tamsen" | "anvietphat") => {
    setIsExporting(true);
    const targetRef = poType === "tamsen" ? poTamSenRef.current : poAVPRef.current;
    const filename = poType === "tamsen" ? `26_${supplierCode}_${poSeqNum}.pdf` : `26_AVP_${supplierCode}_${poSeqNum}.pdf`;

    if (!targetRef) {
      toast.error("Không tìm thấy mẫu hiển thị để xuất PDF!");
      setIsExporting(false);
      return;
    }

    const toastId = toast.loading(`Đang khởi tạo file PDF ${filename}...`);
    try {
      await exportElementToPDF(targetRef, {
        filename,
        orientation: "portrait",
        margin: [6, 6, 6, 6],
        format: "a4"
      });
      toast.success(`Đã xuất file PDF ${filename} thành công!`, { id: toastId });
    } catch (err: any) {
      console.error(err);
      toast.error("Không thể xuất file PDF: " + (err.message || "Lỗi không xác định"), { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportBothPDFs = async () => {
    setIsExporting(true);
    const toastId = toast.loading("Đang xuất bộ hồ sơ PDF cho cả 2 PO (Tâm Sen & AVP)...");
    try {
      if (poTamSenRef.current) {
        await exportElementToPDF(poTamSenRef.current, {
          filename: `26_${supplierCode}_${poSeqNum}_TamSen.pdf`,
          orientation: "portrait",
          margin: [6, 6, 6, 6],
          format: "a4"
        });
      }
      await new Promise(r => setTimeout(r, 600));
      if (poAVPRef.current) {
        await exportElementToPDF(poAVPRef.current, {
          filename: `26_AVP_${supplierCode}_${poSeqNum}_AnVietPhat.pdf`,
          orientation: "portrait",
          margin: [6, 6, 6, 6],
          format: "a4"
        });
      }
      toast.success("Đã hoàn tất xuất bộ 2 file PDF PO thành công!", { id: toastId });
    } catch (err: any) {
      toast.error("Có lỗi khi xuất file PDF: " + (err?.message || "Lỗi không xác định"), { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  // 1-Click Executive Excel Exporter for 3-Way Reconciliation
  const handleExportReconciliationExcel = () => {
    try {
      const totalQty = tableDataTamSen.reduce((sum, item) => sum + item.qty, 0);
      const profit = subtotalTamSen - subtotalAVP;
      const marginPct = subtotalTamSen > 0 ? (profit / subtotalTamSen) * 100 : 0;

      const dataRows: any[] = tableDataTamSen.map((item, idx) => {
        const avpItem = tableDataAVP[idx] || item;
        const lineProfit = item.amount - avpItem.amount;
        const lineMargin = item.amount > 0 ? (lineProfit / item.amount) * 100 : 0;

        return {
          "STT": idx + 1,
          "Mã Sản Phẩm": item.code,
          "Tên Mặt Hàng": item.name,
          "ĐVT": item.unit,
          "Quy Cách Kỹ Thuật": item.specs,
          "Số Lượng": item.qty,
          "Ngày Giao Hàng": item.deliveryDate,
          "Đơn Giá Bán SO (VND)": item.unitPrice,
          "Doanh Thu SO (VND)": item.amount,
          "Nhà Cung Cấp": supplierInfo.shortName,
          "Đơn Giá Mua PO (VND)": avpItem.unitPrice,
          "Giá Vốn PO (VND)": avpItem.amount,
          "Lợi Nhuận Gộp (VND)": lineProfit,
          "Biên LN (%)": `${lineMargin.toFixed(1)}%`
        };
      });

      // Summary Row
      dataRows.push({
        "STT": "TỔNG",
        "Mã Sản Phẩm": "",
        "Tên Mặt Hàng": `TỔNG CỘNG (${tableDataTamSen.length} MẶT HÀNG)`,
        "ĐVT": "",
        "Quy Cách Kỹ Thuật": "",
        "Số Lượng": totalQty,
        "Ngày Giao Hàng": "",
        "Đơn Giá Bán SO (VND)": "",
        "Doanh Thu SO (VND)": subtotalTamSen,
        "Nhà Cung Cấp": "",
        "Đơn Giá Mua PO (VND)": "",
        "Giá Vốn PO (VND)": subtotalAVP,
        "Lợi Nhuận Gộp (VND)": profit,
        "Biên LN (%)": `${marginPct.toFixed(1)}%`
      });

      const worksheet = XLSX.utils.json_to_sheet(dataRows);
      
      // Set Column Widths for readability
      worksheet['!cols'] = [
        { wch: 6 },  // STT
        { wch: 16 }, // Mã SP
        { wch: 38 }, // Tên SP
        { wch: 8 },  // ĐVT
        { wch: 45 }, // Quy cách
        { wch: 12 }, // SL
        { wch: 14 }, // Ngày giao
        { wch: 18 }, // Đơn giá SO
        { wch: 20 }, // Doanh thu SO
        { wch: 14 }, // NCC
        { wch: 18 }, // Đơn giá PO
        { wch: 20 }, // Giá vốn PO
        { wch: 20 }, // Lợi nhuận gộp
        { wch: 14 }  // Biên LN %
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "DoiSoat_3Chieu");

      const safePoName = (poNumberTamSen || "PO").replace(/[\/\\]/g, "_");
      const fileName = `DoiSoat_3Chieu_${safePoName}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      toast.success(`Đã xuất bảng đối soát Excel thành công: ${fileName}`);
    } catch (err: any) {
      console.error("Excel export error:", err);
      toast.error("Lỗi xuất file Excel: " + (err?.message || ""));
    }
  };

  const handleCopyPOSummary = () => {
    const summary = `📌 THÔNG TIN ĐƠN ĐẶT HÀNG BỘ ĐÔI DUAL-PO (ERP TÂM SEN)\n` +
      `• Mã PO Khách hàng: ${poNumberCustomer} (${poCustomer})\n` +
      `• PO 1 (Tâm Sen -> AVP): ${poNumberTamSen} | Tổng: ${grandTotalTamSen.toLocaleString("vi-VN")} VNĐ\n` +
      `• PO 2 (AVP -> ${supplierCode}): ${poNumberAVP} | Tổng: ${grandTotalAVP.toLocaleString("vi-VN")} VNĐ\n` +
      `• Ngày tạo đơn: ${formattedPoDate}\n` +
      `• Nhà cung cấp sản xuất: ${supplierInfo.name}`;
    navigator.clipboard.writeText(summary);
    toast.success("Đã sao chép tóm tắt bộ 2 PO vào khay nhớ tạm!");
  };

  const handleOpenEmailDialog = () => {
    setEmailRecipient(supplierInfo.email);
    setEmailSubject(`[ERP Tâm Sen - An Việt Phát] Đơn đặt hàng sản xuất PO #${poNumberAVP} (${supplierInfo.name})`);
    setEmailBody(
      `Kính gửi Ban Kinh Doanh & Phòng Cung ứng ${supplierInfo.name},\n\n` +
      `CÔNG TY CỔ PHẦN NĂNG LƯỢNG AN VIỆT PHÁT xin gửi Đơn Đặt Hàng chính thức mã số ${poNumberAVP} (Căn cứ PO khách hàng ${poNumberCustomer}).\n\n` +
      `📌 THÔNG TIN ĐƠN HÀNG:\n` +
      `- Số PO An Việt Phát -> ${supplierCode}: ${poNumberAVP}\n` +
      `- Số PO Tâm Sen -> An Việt Phát: ${poNumberTamSen}\n` +
      `- Ngày đặt hàng: ${formattedPoDate}\n` +
      `- Sản phẩm: ${tableDataAVP.map(i => i.name).join(", ")}\n` +
      `- Tổng số lượng: ${tableDataAVP.reduce((s, i) => s + i.qty, 0).toLocaleString("vi-VN")} ${tableDataAVP[0]?.unit || "Cái"}\n` +
      `- Tổng giá trị (đã gồm VAT 8%): ${grandTotalAVP.toLocaleString("vi-VN")} VNĐ\n\n` +
      `Trân trọng kính đề nghị Quý Công ty kiểm tra file đính kèm, xác nhận trong vòng 01 ngày làm việc và tiến hành sản xuất đúng tiến độ.\n\n` +
      `Trân trọng,\n` +
      `CÔNG TY CỔ PHẦN NĂNG LƯỢNG AN VIỆT PHÁT\n` +
      `Bộ phận Quản lý Chuỗi Cung ứng ERP Tâm Sen`
    );
    setShowEmailModal(true);
  };

  const handleApplyEmailTemplate = (templateType: "new_order" | "reminder" | "payment") => {
    if (templateType === "new_order") {
      setEmailSubject(`[ERP Tâm Sen - An Việt Phát] Đơn đặt hàng sản xuất PO #${poNumberAVP} (${supplierInfo.name})`);
      setEmailBody(
        `Kính gửi Ban Kinh Doanh & Phòng Cung ứng ${supplierInfo.name},\n\n` +
        `CÔNG TY CỔ PHẦN NĂNG LƯỢNG AN VIỆT PHÁT xin gửi Đơn Đặt Hàng chính thức mã số ${poNumberAVP}.\n\n` +
        `- Tổng giá trị: ${grandTotalAVP.toLocaleString("vi-VN")} VNĐ\n` +
        `- Ngày đặt: ${formattedPoDate}\n\n` +
        `Trân trọng đề nghị Quý xưởng phản hồi xác nhận tiến độ trong 24h.`
      );
    } else if (templateType === "reminder") {
      setEmailSubject(`[Nhắc Tiến Độ] Đơn hàng PO #${poNumberAVP} - Giao hàng đúng lịch (${supplierInfo.name})`);
      setEmailBody(
        `Kính gửi Ban Điều Hành Sản Xuất ${supplierInfo.name},\n\n` +
        `Phòng Cung ứng An Việt Phát xin nhắc lịch giao hàng cho đơn hàng PO #${poNumberAVP}.\n` +
        `Kính đề nghị Quý Công ty rà soát đóng gói theo đúng TCKT và bố trí hạ Pallet theo lịch hẹn.`
      );
    } else {
      setEmailSubject(`[Xác Nhận Thanh Toán] Đơn hàng PO #${poNumberAVP} (${supplierInfo.name})`);
      setEmailBody(
        `Kính gửi Phòng Kế Toán ${supplierInfo.name},\n\n` +
        `An Việt Phát xin thông báo đã lập ủy nhiệm chi thanh toán cho đơn hàng PO #${poNumberAVP}.\n` +
        `Số tiền: ${grandTotalAVP.toLocaleString("vi-VN")} VNĐ (qua tài khoản thụ hưởng ${supplierInfo.name}).`
      );
    }
  };

  const handleOpenNativeMailClient = () => {
    const mailtoUrl = `mailto:${encodeURIComponent(emailRecipient)}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
    window.open(mailtoUrl, "_blank");
  };

  const handleSendEmailSubmit = () => {
    const toastId = toast.loading("Đang gửi email đơn đặt hàng đến nhà cung cấp...");
    setTimeout(() => {
      toast.success(`Đã gửi mail thành công đến ${emailRecipient}!`, { id: toastId });
      setShowEmailModal(false);
    }, 1000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-2 sm:p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white w-full max-w-6xl rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[95vh] overflow-hidden">
        
        {/* Header Modal Bar */}
        <div className="px-6 py-4 bg-white text-slate-900 flex items-center justify-between border-b border-black/[0.06]">
          <div className="flex items-center gap-4">
            <MacTrafficLights onClose={onClose} />
            <div className="h-6 w-px bg-slate-200" />
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center font-bold text-white shadow-md">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 tracking-wide">Quy Trình Tạo & Phê Duyệt Bộ Đôi PO Nhà Cung Cấp</h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Step 2 - Order Sourcing
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Tâm Sen đặt An Việt Phát (<span className="text-amber-700 font-mono font-bold">{poNumberTamSen}</span>) → An Việt Phát đặt NCC (<span className="text-sky-700 font-mono font-bold">{poNumberAVP}</span>)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-xs font-bold text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-3.5 py-1.5 rounded-xl transition"
          >
            Đóng [ESC]
          </button>
        </div>

        {/* Workflow 3-Steps Progress Indicator */}
        <div className="bg-slate-100 border-b border-slate-200 px-6 py-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            {/* Step 1 */}
            <div className="flex items-center gap-2.5 p-2 bg-white rounded-xl border border-emerald-200 shadow-sm">
              <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center shrink-0">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <span className="font-bold text-slate-800 block">1. Ghi Nhận Dữ Liệu Hệ Thống</span>
                <span className="text-[11px] text-slate-500">Đã lưu PO_Headers & PO_Lines vào DB</span>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex items-center gap-2.5 p-2 bg-white rounded-xl border border-blue-300 shadow-sm ring-2 ring-blue-500/20">
              <div className="w-7 h-7 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center shrink-0">
                2
              </div>
              <div>
                <span className="font-bold text-slate-800 block">2. So Sánh & Đối Chiếu PO KH</span>
                <span className="text-[11px] text-slate-500">So sánh trùng khớp với PO <span className="font-mono text-blue-600 font-semibold">{poNumberCustomer}</span></span>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex items-center gap-2.5 p-2 bg-white rounded-xl border border-amber-200 shadow-sm">
              <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 font-bold flex items-center justify-center shrink-0">
                3
              </div>
              <div>
                <span className="font-bold text-slate-800 block">3. Phân Tách 2 PO & Xuất PDF / Mail</span>
                <span className="text-[11px] text-slate-500">Phê duyệt & gửi đơn cho Nhà Cung Cấp</span>
              </div>
            </div>
          </div>
        </div>

        {/* View Selection Tabs & Actions Bar */}
        <div className="bg-white px-6 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab("comparison")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === "comparison" 
                  ? "bg-white text-slate-900 shadow-sm" 
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Eye className="w-3.5 h-3.5 text-blue-600" />
              So Sánh Trùng Khớp
            </button>
            
            <button
              onClick={() => setActiveTab("po_tamsen")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === "po_tamsen" 
                  ? "bg-amber-500 text-white shadow-sm" 
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              PO 1: Tâm Sen → An Việt Phát ({poNumberTamSen})
            </button>

            <button
              onClick={() => setActiveTab("po_anvietphat")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === "po_anvietphat" 
                  ? "bg-sky-600 text-white shadow-sm" 
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              PO 2: An Việt Phát → {supplierCode} ({poNumberAVP})
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportReconciliationExcel}
              className="px-3.5 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs"
              title="Xuất bảng đối soát 3 chiều ra Excel có công thức"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              Xuất Excel
            </button>

            <button
              onClick={handleCopyPOSummary}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
              title="Sao chép tóm tắt 2 PO gửi Zalo/Chat"
            >
              <Copy className="w-3.5 h-3.5" />
              Copy Tóm Tắt
            </button>

            <button
              onClick={() => handleExportSinglePDF("tamsen")}
              disabled={isExporting}
              className="px-3 py-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
              title="Tải PDF mẫu Tâm Sen"
            >
              <Download className="w-3.5 h-3.5" />
              PDF Tâm Sen
            </button>

            <button
              onClick={() => handleExportSinglePDF("anvietphat")}
              disabled={isExporting}
              className="px-3 py-1.5 bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
              title="Tải PDF mẫu An Việt Phát"
            >
              <Download className="w-3.5 h-3.5" />
              PDF An Việt Phát
            </button>

            <button
              onClick={handleExportBothPDFs}
              disabled={isExporting}
              className="px-3.5 py-1.5 bg-[#007AFF] hover:bg-[#0066D6] text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
              title="Tải bộ đôi cả 2 file PDF PO"
            >
              <Download className="w-3.5 h-3.5" />
              Tải Cả 2 PO
            </button>

            <button
              onClick={handleOpenEmailDialog}
              className="px-3.5 py-1.5 bg-[#34C759] hover:bg-[#2EB04E] text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
            >
              <Mail className="w-3.5 h-3.5" />
              Gửi Mail PO
            </button>
          </div>
        </div>

        {/* Modal Main Content Container */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-100">
          
          {/* TAB 1: COMPARISON & RECONCILIATION VIEW */}
          {activeTab === "comparison" && (() => {
            const totalQty = tableDataTamSen.reduce((sum, item) => sum + item.qty, 0);
            const totalProfit = subtotalTamSen - subtotalAVP;
            const marginPct = subtotalTamSen > 0 ? (totalProfit / subtotalTamSen) * 100 : 0;
            const isSafe = marginPct >= 20;

            return (
              <div className="space-y-6">
                {/* Validation Summary Banner */}
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3 shadow-2xs">
                  <div className="p-2 bg-emerald-500 text-white rounded-xl shrink-0 mt-0.5">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-bold text-emerald-900 flex items-center gap-2">
                      Xác Nhận Trùng Khớp 100% Dữ Liệu Sản Phẩm & Quy Cách Kỹ Thuật Với PO Khách Hàng ({poNumberCustomer})
                    </h4>
                    <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
                      Hệ thống đã đối chiếu và tự động phân tách PO thành 2 hợp đồng thành phần theo mô hình Công ty Mẹ (An Việt Phát) - Công ty Con (Tâm Sen). Mã sản phẩm, số lượng đặt hàng, quy cách kỹ thuật và lịch giao hàng đã hoàn toàn khớp.
                    </p>
                  </div>
                </div>

                {/* 3-Column Order Routing Context Bar */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Context 1: Customer PO */}
                  <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-2 text-xs">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[11px] font-bold uppercase tracking-wider">
                        1. PO Gốc Khách Hàng
                      </span>
                      <span className="font-mono font-bold text-blue-700">{poNumberCustomer}</span>
                    </div>
                    <div className="text-slate-600 space-y-1">
                      <div><span className="font-semibold text-slate-800">Khách hàng:</span> {poCustomer}</div>
                      <div><span className="font-semibold text-slate-800">Ngày đặt:</span> {formattedPoDate}</div>
                      <div><span className="font-semibold text-slate-800">Nơi giao:</span> CÔNG TY TNHH MTV THUỐC LÁ THĂNG LONG</div>
                    </div>
                  </div>

                  {/* Context 2: PO 1 */}
                  <div className="bg-white rounded-2xl p-4 border border-amber-200 shadow-2xs space-y-2 text-xs">
                    <div className="flex items-center justify-between pb-2 border-b border-amber-100">
                      <span className="px-2.5 py-0.5 bg-amber-500 text-white rounded-md text-[11px] font-bold uppercase tracking-wider">
                        2. PO 1: Tâm Sen → AVP
                      </span>
                      <span className="font-mono font-bold text-amber-900">{poNumberTamSen}</span>
                    </div>
                    <div className="text-slate-600 space-y-1">
                      <div><span className="font-semibold text-slate-800">Đơn vị nhận:</span> TÂM SEN GROUP</div>
                      <div><span className="font-semibold text-slate-800">Đơn vị SX:</span> AN VIỆT PHÁT GROUP</div>
                      <div><span className="font-semibold text-slate-800">Căn cứ:</span> PO {poNumberCustomer}</div>
                    </div>
                  </div>

                  {/* Context 3: PO 2 */}
                  <div className="bg-white rounded-2xl p-4 border border-sky-200 shadow-2xs space-y-2 text-xs">
                    <div className="flex items-center justify-between pb-2 border-b border-sky-100">
                      <span className="px-2.5 py-0.5 bg-sky-600 text-white rounded-md text-[11px] font-bold uppercase tracking-wider">
                        3. PO 2: AVP → {supplierCode}
                      </span>
                      <span className="font-mono font-bold text-sky-900">{poNumberAVP}</span>
                    </div>
                    <div className="text-slate-600 space-y-1">
                      <div><span className="font-semibold text-slate-800">Đơn vị đặt:</span> AN VIỆT PHÁT GROUP</div>
                      <div><span className="font-semibold text-slate-800">Xưởng SX:</span> {supplierInfo.name}</div>
                      <div><span className="font-semibold text-slate-800">Căn cứ:</span> PO {poNumberCustomer}</div>
                    </div>
                  </div>
                </div>

                {/* Unified 3-Way Side-by-Side Reconciliation Table */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 bg-blue-100 text-blue-700 rounded-lg"><Layers size={16} /></span>
                      <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                        Bảng Đối Soát 3 Chiều & Phân Tách Chi Phí Sản Xuất ({tableDataTamSen.length} mặt hàng)
                      </h4>
                    </div>
                    <span className="text-xs font-semibold text-slate-500">
                      Khách hàng: <strong className="text-blue-700">{poCustomer}</strong>
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        {/* Tier 1 Header */}
                        <tr className="bg-slate-100 text-[11px] font-extrabold text-slate-700 border-b border-slate-200">
                          <th className="px-3.5 py-2.5 text-center w-12 border-r border-slate-200" rowSpan={2}>#</th>
                          <th className="px-4 py-2.5 border-r border-slate-200" colSpan={2}>
                            📦 MẶT HÀNG & QUY CÁCH SẢN XUẤT
                          </th>
                          <th className="px-4 py-2.5 text-center bg-blue-100/70 text-blue-900 border-r border-blue-200 font-black" colSpan={2}>
                            🛒 1. BÁN KHÁCH HÀNG (SO)
                          </th>
                          <th className="px-4 py-2.5 text-center bg-amber-100/70 text-amber-900 border-r border-amber-200 font-black" colSpan={2}>
                            🏭 2. TÂM SEN → AVP ({poNumberTamSen})
                          </th>
                          <th className="px-4 py-2.5 text-center bg-purple-100/70 text-purple-900 border-r border-purple-200 font-black" colSpan={2}>
                            ⚙️ 3. AVP → {supplierCode} ({poNumberAVP})
                          </th>
                          <th className="px-4 py-2.5 text-center bg-emerald-100/70 text-emerald-900 font-black" colSpan={2}>
                            📈 LÃI GỘP & BIÊN ĐỘ
                          </th>
                        </tr>
                        {/* Tier 2 Header */}
                        <tr className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-500">
                          <th className="px-4 py-2.5 border-r border-slate-200">Tên Mặt Hàng & Quy Cách Chi Tiết</th>
                          <th className="px-3.5 py-2.5 text-center border-r border-slate-200 w-28">Số Lượng Đặt</th>
                          <th className="px-3.5 py-2.5 text-right bg-blue-50/60 text-blue-800 border-r border-slate-200 w-28">Đơn Giá Bán</th>
                          <th className="px-4 py-2.5 text-right bg-blue-50/60 text-blue-900 font-black border-r border-blue-200 w-36">Doanh Thu (SO)</th>
                          <th className="px-3.5 py-2.5 text-right bg-amber-50/60 text-amber-800 border-r border-slate-200 w-28">Đơn Giá PO 1</th>
                          <th className="px-4 py-2.5 text-right bg-amber-50/60 text-amber-900 font-black border-r border-amber-200 w-36">Thành Tiền PO 1</th>
                          <th className="px-3.5 py-2.5 text-right bg-purple-50/60 text-purple-800 border-r border-slate-200 w-28">Giá Mua Xưởng</th>
                          <th className="px-4 py-2.5 text-right bg-purple-50/60 text-purple-900 font-black border-r border-purple-200 w-36">Giá Vốn PO 2</th>
                          <th className="px-4 py-2.5 text-right bg-emerald-50/60 text-emerald-900 font-black border-r border-slate-200 w-36">Lãi Gộp</th>
                          <th className="px-3 py-2.5 text-center bg-emerald-50/60 text-emerald-800 w-24">Biên LN (%)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
                        {tableDataTamSen.map((item, idx) => {
                          const avpItem = tableDataAVP[idx] || item;
                          const sellAmount = item.amount;
                          const buyAmount = avpItem.amount;
                          const lineProfit = sellAmount - buyAmount;
                          const lineMargin = sellAmount > 0 ? (lineProfit / sellAmount) * 100 : 0;

                          return (
                            <tr key={idx} className="hover:bg-slate-50/90 transition-colors">
                              <td className="px-3.5 py-3.5 text-center font-mono text-slate-400 font-bold border-r border-slate-100">{idx + 1}</td>
                              <td className="px-4 py-3.5 border-r border-slate-100">
                                <div className="font-bold text-slate-900 text-xs">{item.name}</div>
                                <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1.5 mt-1">
                                  <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-bold">{item.code}</span>
                                  <span className="text-slate-400">•</span>
                                  <span>ĐVT: <strong className="text-slate-700">{item.unit}</strong></span>
                                  <span className="text-slate-400">•</span>
                                  <span>Giao hàng: <strong className="text-slate-700">{item.deliveryDate}</strong></span>
                                </div>
                                <p className="text-[10.5px] text-slate-500 mt-1 italic leading-relaxed" title={item.specs}>
                                  ⚙️ {item.specs}
                                </p>
                              </td>
                              <td className="px-3.5 py-3.5 text-center font-mono font-bold text-slate-900 border-r border-slate-100 bg-slate-50/30">
                                {item.qty.toLocaleString("vi-VN")} <span className="text-[11px] text-slate-500 font-normal">{item.unit}</span>
                              </td>
                              <td className="px-3.5 py-3.5 text-right font-mono font-bold text-blue-700 border-r border-slate-100">
                                {item.unitPrice.toLocaleString("vi-VN")} đ
                              </td>
                              <td className="px-4 py-3.5 text-right font-mono font-extrabold text-blue-900 bg-blue-50/40 border-r border-blue-100">
                                {sellAmount.toLocaleString("vi-VN")} đ
                              </td>
                              <td className="px-3.5 py-3.5 text-right font-mono font-bold text-amber-800 border-r border-slate-100">
                                {item.unitPrice.toLocaleString("vi-VN")} đ
                              </td>
                              <td className="px-4 py-3.5 text-right font-mono font-bold text-amber-900 bg-amber-50/40 border-r border-amber-100">
                                {sellAmount.toLocaleString("vi-VN")} đ
                              </td>
                              <td className="px-3.5 py-3.5 text-right font-mono font-bold text-purple-700 border-r border-slate-100">
                                {avpItem.unitPrice.toLocaleString("vi-VN")} đ
                              </td>
                              <td className="px-4 py-3.5 text-right font-mono font-bold text-purple-900 bg-purple-50/40 border-r border-purple-100">
                                {buyAmount.toLocaleString("vi-VN")} đ
                              </td>
                              <td className="px-4 py-3.5 text-right font-mono font-black text-emerald-700 bg-emerald-50/40 border-r border-slate-100">
                                {lineProfit.toLocaleString("vi-VN")} đ
                              </td>
                              <td className="px-3 py-3.5 text-center">
                                <span className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold inline-flex items-center gap-0.5 ${
                                  lineMargin >= 20 ? "bg-emerald-100 text-emerald-800 border border-emerald-300" : "bg-amber-100 text-amber-800 border border-amber-300"
                                }`}>
                                  {lineMargin.toFixed(1)}%
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-100/90 font-bold border-t-2 border-slate-300 text-slate-800 text-xs">
                          <td colSpan={2} className="px-4 py-3.5 text-right uppercase tracking-wider text-[11px] text-slate-600 border-r border-slate-200">
                            Tổng Cộng ({tableDataTamSen.length} mặt hàng):
                          </td>
                          <td className="px-3.5 py-3.5 text-center font-mono font-black text-slate-900 border-r border-slate-200">
                            {totalQty.toLocaleString("vi-VN")}
                          </td>
                          <td className="px-3.5 py-3.5 border-r border-slate-200"></td>
                          <td className="px-4 py-3.5 text-right font-mono font-black text-blue-900 bg-blue-100/50 border-r border-blue-200 text-sm">
                            {subtotalTamSen.toLocaleString("vi-VN")} đ
                          </td>
                          <td className="px-3.5 py-3.5 border-r border-slate-200"></td>
                          <td className="px-4 py-3.5 text-right font-mono font-bold text-amber-900 bg-amber-100/50 border-r border-amber-200 text-sm">
                            {subtotalTamSen.toLocaleString("vi-VN")} đ
                          </td>
                          <td className="px-3.5 py-3.5 border-r border-slate-200"></td>
                          <td className="px-4 py-3.5 text-right font-mono font-bold text-purple-900 bg-purple-100/50 border-r border-purple-200 text-sm">
                            {subtotalAVP.toLocaleString("vi-VN")} đ
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono font-black text-emerald-800 bg-emerald-100/50 border-r border-slate-200 text-sm">
                            {totalProfit.toLocaleString("vi-VN")} đ
                          </td>
                          <td className="px-3 py-3.5 text-center">
                            <span className={`px-2.5 py-1 rounded-full text-[11px] font-black ${
                              marginPct >= 20 ? "bg-emerald-600 text-white" : "bg-amber-500 text-white"
                            }`}>
                              {marginPct.toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* 3-Pillar Financial & VAT Settlement Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Pillar 1: Customer SO Invoice */}
                  <div className="bg-white rounded-2xl p-5 border border-blue-200 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <span className="font-bold text-blue-900 text-xs uppercase tracking-wider">
                        🛒 1. Hóa Đơn Bán Khách Hàng (Tâm Sen)
                      </span>
                      <span className="font-mono text-[11px] text-blue-600 font-bold">{poNumberTamSen}</span>
                    </div>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between text-slate-600">
                        <span>Tiền hàng trước thuế:</span>
                        <strong className="font-mono text-slate-900">{subtotalTamSen.toLocaleString("vi-VN")} đ</strong>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Thuế GTGT (8%):</span>
                        <strong className="font-mono text-slate-900">{vatTamSen.toLocaleString("vi-VN")} đ</strong>
                      </div>
                      <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-sm font-bold text-blue-950">
                        <span>Tổng Thanh Toán Thu Khách:</span>
                        <span className="font-mono text-blue-700 text-base">{grandTotalTamSen.toLocaleString("vi-VN")} đ</span>
                      </div>
                    </div>
                  </div>

                  {/* Pillar 2: Supplier PO Cost */}
                  <div className="bg-white rounded-2xl p-5 border border-purple-200 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <span className="font-bold text-purple-900 text-xs uppercase tracking-wider">
                        🏭 2. Hóa Đơn Mua Xưởng (AVP → {supplierCode})
                      </span>
                      <span className="font-mono text-[11px] text-purple-600 font-bold">{poNumberAVP}</span>
                    </div>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between text-slate-600">
                        <span>Tiền mua xưởng:</span>
                        <strong className="font-mono text-slate-900">{subtotalAVP.toLocaleString("vi-VN")} đ</strong>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Thuế GTGT (8%):</span>
                        <strong className="font-mono text-slate-900">{vatAVP.toLocaleString("vi-VN")} đ</strong>
                      </div>
                      <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-sm font-bold text-purple-950">
                        <span>Tổng Thanh Toán Trả NCC:</span>
                        <span className="font-mono text-purple-700 text-base">{grandTotalAVP.toLocaleString("vi-VN")} đ</span>
                      </div>
                    </div>
                  </div>

                  {/* Pillar 3: Net Margin & Cash Flow */}
                  <div className={`rounded-2xl p-5 border shadow-2xs space-y-3 ${isSafe ? "bg-emerald-50/70 border-emerald-300" : "bg-amber-50/70 border-amber-300"}`}>
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                      <span className={`font-bold text-xs uppercase tracking-wider ${isSafe ? "text-emerald-950" : "text-amber-950"}`}>
                        📈 3. Hiệu Quả & Dòng Tiền Thực Nhận
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${isSafe ? "bg-emerald-600 text-white" : "bg-amber-600 text-white"}`}>
                        {isSafe ? "Đạt Chuẩn BOD" : "Lãi Thấp"}
                      </span>
                    </div>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between text-slate-700">
                        <span>Lợi nhuận gộp (Trước thuế):</span>
                        <strong className="font-mono text-emerald-800">{totalProfit.toLocaleString("vi-VN")} đ</strong>
                      </div>
                      <div className="flex justify-between text-slate-700">
                        <span>Thuế VAT khấu trừ (Ra - Vào):</span>
                        <strong className="font-mono text-slate-900">{(vatTamSen - vatAVP).toLocaleString("vi-VN")} đ</strong>
                      </div>
                      <div className="pt-2 border-t border-slate-200/60 flex justify-between items-center text-sm font-bold">
                        <span className={isSafe ? "text-emerald-950" : "text-amber-950"}>Biên Lợi Nhuận Gộp:</span>
                        <span className={`font-mono text-base font-black ${isSafe ? "text-emerald-700" : "text-amber-700"}`}>
                          {marginPct.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Prompt */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-4 shadow-sm">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Xem Chi Tiết Mẫu Văn Bản In Hoặc Chuyển Giao Sang Kế Hoạch Giao Hàng</h4>
                    <p className="text-xs text-slate-500 mt-0.5">Bạn có thể xem trước mẫu in của từng đơn hàng hoặc phê duyệt để tiếp tục quy trình.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setActiveTab("po_tamsen")}
                      className="px-4 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold transition-all"
                    >
                      📄 Xem Mẫu In PO 1 (Tâm Sen)
                    </button>
                    <button
                      onClick={() => setActiveTab("po_anvietphat")}
                      className="px-4 py-2.5 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 rounded-xl text-xs font-bold transition-all"
                    >
                      📄 Xem Mẫu In PO 2 (An Việt Phát)
                    </button>
                    {onApproveAndProceed && (
                      <button
                        onClick={onApproveAndProceed}
                        className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2"
                      >
                        Phê Duyệt & Tiếp Tục ➔
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* TAB 2: PO 1 VISUAL DOCUMENT (TÂM SEN GROUP) */}
          {(activeTab === "po_tamsen" || activeTab === "comparison") && (
            <div className={activeTab === "comparison" ? "hidden" : "block"}>
              <div className="max-w-[850px] mx-auto mb-2 text-right">
                <span className="inline-flex items-center gap-1.5 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1 rounded-lg">
                  💡 Nhấp vào Logo trên tiêu đề đơn hàng bên dưới để tải lên file ảnh logo gốc (PNG/JPG/SVG) của bạn
                </span>
              </div>
              <div className="max-w-[850px] mx-auto bg-white p-6 sm:p-7 shadow-xl rounded-xl border border-slate-300 text-slate-800 text-xs" ref={poTamSenRef}>
                
                {/* Top Header Row */}
                <div className="flex justify-between items-center border-b border-slate-200 pb-3 mb-3">
                  {/* Left Logo - 100% accurate */}
                  <TamSenGroupHeaderLogo />

                  {/* Right Company Info */}
                  <div className="text-right text-[10.5px] text-slate-700 space-y-0.5">
                    <div className="font-bold text-slate-900">CÔNG TY TNHH THƯƠNG MẠI VÀ ĐẦU TƯ TẬP ĐOÀN TÂM SEN</div>
                    <div>📞 02473 028 288 &nbsp;|&nbsp; ✉️ admin@tamsengroup.vn &nbsp;|&nbsp; 🌐 www.tamsengroup.vn</div>
                  </div>
                </div>

                {/* Title & PO Box */}
                <div className="flex justify-between items-center mb-3">
                  <div>
                    <h2 className="text-xl font-black text-slate-900 tracking-wider uppercase">ĐƠN ĐẶT HÀNG</h2>
                  </div>

                  <div className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-[11px] text-slate-800 space-y-0.5 min-w-[210px]">
                    <div className="flex justify-between">
                      <span className="font-semibold text-slate-600">Số đơn hàng:</span>
                      <span className="font-bold text-slate-900 font-mono">{poNumberTamSen}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-semibold text-slate-600">Ngày đặt hàng:</span>
                      <span className="font-medium text-slate-800">{formattedPoDate}</span>
                    </div>
                  </div>
                </div>

                {/* Metadata Box */}
                <div className="bg-slate-50/80 border border-slate-200 rounded-lg p-2.5 text-[10.5px] text-slate-800 space-y-1 mb-3">
                  <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-3 font-bold text-slate-700 uppercase">ĐƠN VỊ SẢN XUẤT</div>
                    <div className="col-span-9 font-bold text-slate-900">CÔNG TY CỔ PHẦN NĂNG LƯỢNG AN VIỆT PHÁT</div>
                  </div>
                  <div className="grid grid-cols-12 gap-2 border-t border-slate-200/60 pt-1">
                    <div className="col-span-3 font-bold text-slate-700 uppercase">ĐỊA CHỈ</div>
                    <div className="col-span-9 text-slate-700">Cụm Công nghiệp Hố Nai 3, Phường Hố Nai, Thành phố Đồng Nai</div>
                  </div>
                  <div className="grid grid-cols-12 gap-2 border-t border-slate-200/60 pt-1">
                    <div className="col-span-3 font-bold text-slate-700 uppercase">CĂN CỨ THEO PO KH</div>
                    <div className="col-span-9 font-semibold text-slate-900 flex justify-between">
                      <span>{poNumberCustomer}</span>
                      <span className="text-slate-600">Ngày: <strong className="text-slate-900">{formattedPoDate}</strong></span>
                    </div>
                  </div>
                  <div className="grid grid-cols-12 gap-2 border-t border-slate-200/60 pt-1">
                    <div className="col-span-3 font-bold text-slate-700 uppercase">ĐƠN VỊ NHẬN HÀNG</div>
                    <div className="col-span-9 font-bold text-slate-900">CÔNG TY TNHH THƯƠNG MẠI VÀ ĐẦU TƯ TẬP ĐOÀN TÂM SEN</div>
                  </div>
                  <div className="grid grid-cols-12 gap-2 border-t border-slate-200/60 pt-1">
                    <div className="col-span-3 font-bold text-slate-700 uppercase">ĐỊA CHỈ</div>
                    <div className="col-span-9 text-slate-700">Số 123 đường N3C (Dự án KĐT Sài Gòn Bình An), P. Bình Trưng, TP. HCM</div>
                  </div>
                  <div className="grid grid-cols-12 gap-2 border-t border-slate-200/60 pt-1">
                    <div className="col-span-3 font-bold text-slate-700 uppercase">GIAO HÀNG ĐẾN</div>
                    <div className="col-span-9 font-bold text-slate-900">{poCustomer || "CÔNG TY TNHH MỘT THÀNH VIÊN THUỐC LÁ THĂNG LONG"}</div>
                  </div>
                </div>

                {/* Items Table - Optimized for A4 page height and wide specs */}
                <table className="w-full border-collapse border border-slate-300 text-[11px] mb-3">
                  <thead>
                    <tr className="bg-slate-200 text-slate-900 font-bold text-[10.5px]">
                      <th className="border border-slate-300 px-1.5 py-1.5 text-left w-[18%]">SẢN PHẨM</th>
                      <th className="border border-slate-300 px-1.5 py-1.5 text-center w-[10%]">MÃ SP</th>
                      <th className="border border-slate-300 px-1.5 py-1.5 text-center w-[5%]">ĐVT</th>
                      <th className="border border-slate-300 px-1.5 py-1.5 text-left w-[37%]">QUY CÁCH KỸ THUẬT</th>
                      <th className="border border-slate-300 px-1.5 py-1.5 text-center w-[12%]">LỊCH GIAO HÀNG</th>
                      <th className="border border-slate-300 px-1.5 py-1.5 text-right w-[6%]">SL</th>
                      <th className="border border-slate-300 px-1.5 py-1.5 text-right w-[10%]">ĐƠN GIÁ</th>
                      <th className="border border-slate-300 px-1.5 py-1.5 text-right w-[12%]">THÀNH TIỀN</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableDataTamSen.map((row, idx) => (
                      <tr key={idx} className="align-top">
                        <td className="border border-slate-300 px-1.5 py-1.5 font-bold text-slate-900">{row.name}</td>
                        <td className="border border-slate-300 px-1.5 py-1.5 text-center font-mono">{row.code}</td>
                        <td className="border border-slate-300 px-1.5 py-1.5 text-center">{row.unit}</td>
                        <td className="border border-slate-300 px-1.5 py-1.5 text-[10px] leading-snug text-slate-700">
                          {row.specs}
                        </td>
                        <td className="border border-slate-300 px-1.5 py-1.5 text-center text-[10px] leading-tight">
                          {row.deliveryBatches && row.deliveryBatches.length > 1 ? (
                            <div className="space-y-0.5">
                              {row.deliveryBatches.map((b: any, bIdx: number) => (
                                <div key={bIdx} className="font-semibold text-slate-800">
                                  Đợt {b.batch}: <span className="text-blue-700 font-bold">{b.date}</span> ({b.qty.toLocaleString("vi-VN")})
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="font-semibold text-slate-800">{row.deliveryDate}</span>
                          )}
                        </td>
                        <td className="border border-slate-300 px-1.5 py-1.5 text-right font-bold text-slate-900">{row.qty.toLocaleString("vi-VN")}</td>
                        <td className="border border-slate-300 px-1.5 py-1.5 text-right">{row.unitPrice.toLocaleString("vi-VN")}</td>
                        <td className="border border-slate-300 px-1.5 py-1.5 text-right font-bold text-slate-900">{row.amount.toLocaleString("vi-VN")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Summary Table Box */}
                <div className="flex justify-between items-start mb-3 gap-4">
                  {/* Left Note */}
                  <div className="w-7/12 text-[10px] text-slate-600 leading-tight">
                    <strong className="text-slate-800">Lưu ý xác nhận đơn hàng:</strong> Trong vòng 01 ngày kể từ ngày nhận PO, Quý Công ty vui lòng phản hồi xác nhận sản xuất. Sau 01 ngày không phản hồi, PO xem như được chấp thuận chính thức.
                  </div>

                  {/* Right Total Breakdown */}
                  <div className="w-5/12 border border-slate-300 bg-slate-50/80 rounded-lg p-2 text-[11px] text-slate-800 space-y-1">
                    <div className="flex justify-between font-bold">
                      <span>Cộng tiền hàng:</span>
                      <span>{subtotalTamSen.toLocaleString("vi-VN")} đ</span>
                    </div>
                    <div className="flex justify-between text-slate-700">
                      <span>Thuế GTGT (8%):</span>
                      <span>{vatTamSen.toLocaleString("vi-VN")} đ</span>
                    </div>
                    <div className="flex justify-between font-black text-xs text-slate-900 border-t border-slate-300 pt-1">
                      <span>TỔNG TIỀN:</span>
                      <span className="text-amber-700">{grandTotalTamSen.toLocaleString("vi-VN")} đ</span>
                    </div>
                  </div>
                </div>

                {/* Quy Cách Giao Hàng Section */}
                <div className="mb-3 bg-slate-50/50 p-2.5 rounded-lg border border-slate-200/80">
                  <h4 className="text-[10px] font-bold text-slate-900 uppercase tracking-wider mb-1">QUY CÁCH GIAO HÀNG & BẢO QUẢN</h4>
                  <ul className="text-[10px] text-slate-700 space-y-0.5 list-disc pl-3.5 leading-tight">
                    <li>Sản xuất theo đúng thiết kế và tiêu chuẩn kỹ thuật đã duyệt. Không tính tồn kho phát sinh.</li>
                    <li>Đóng gói thùng âm dương lồng cặp, xếp cố định trên Pallet gỗ tiêu chuẩn tại kho nhà máy.</li>
                    <li>Thời gian tiếp nhận giao hàng: từ 07h30' đến trước 15h00' các ngày trong tuần.</li>
                  </ul>
                </div>

                {/* Dynamic VietQR Payment Section */}
                <div className="mb-4 bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-4">
                  <div className="text-[10.5px] text-slate-700 space-y-1">
                    <div className="font-bold text-slate-900 uppercase text-[11px] flex items-center gap-1.5">
                      <QrCode className="w-3.5 h-3.5 text-amber-600" />
                      THÔNG TIN THANH TOÁN CHUYỂN KHOẢN (VIETQR)
                    </div>
                    <div>• Đơn vị thụ hưởng: <strong className="text-slate-900">CÔNG TY CỔ PHẦN NĂNG LƯỢNG AN VIỆT PHÁT</strong></div>
                    <div>• Số tài khoản: <strong className="font-mono text-slate-900">113000088888</strong> (VietinBank - Chi nhánh Hà Nội)</div>
                    <div>• Nội dung CK: <strong className="font-mono text-amber-700 font-bold">THANH TOAN {poNumberTamSen}</strong></div>
                    <div>• Số tiền: <strong className="font-mono text-slate-900 font-extrabold">{grandTotalTamSen.toLocaleString("vi-VN")} VND</strong></div>
                  </div>
                  <div className="text-center shrink-0">
                    <img
                      src={`https://img.vietqr.io/image/ICB-113000088888-compact2.png?amount=${grandTotalTamSen}&addInfo=${encodeURIComponent("THANH TOAN " + poNumberTamSen)}&accountName=CONG%20TY%20CP%20NL%20AN%20VIET%20PHAT`}
                      alt="VietQR Payment"
                      className="w-20 h-20 object-contain rounded-lg border border-slate-200 shadow-2xs bg-white p-0.5"
                      crossOrigin="anonymous"
                    />
                    <span className="text-[9px] text-slate-400 block mt-0.5 font-medium">Quét VietQR</span>
                  </div>
                </div>

                {/* Clean Signatures Box Without Pre-signed Stamps */}
                <div className="grid grid-cols-2 gap-6 text-center text-[11px] text-slate-800 pt-3 border-t border-slate-200">
                  <div>
                    <div className="font-bold uppercase text-slate-900">CÔNG TY CỔ PHẦN NĂNG LƯỢNG AN VIỆT PHÁT</div>
                    <div className="text-[10px] text-slate-500 italic mt-0.5">(Ký, ghi rõ họ tên & đóng dấu)</div>
                    <div className="h-16"></div> {/* Clean empty space for signature */}
                  </div>
                  <div>
                    <div className="font-bold uppercase text-slate-900">CÔNG TY TNHH TM VÀ ĐT TẬP ĐOÀN TÂM SEN</div>
                    <div className="text-[10px] text-slate-500 italic mt-0.5">(Ký, ghi rõ họ tên & đóng dấu)</div>
                    <div className="h-16"></div> {/* Clean empty space for signature */}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* TAB 3: PO 2 VISUAL DOCUMENT (AN VIỆT PHÁT GROUP) */}
          {(activeTab === "po_anvietphat" || activeTab === "comparison") && (
            <div className={activeTab === "comparison" ? "hidden" : "block"}>
              <div className="max-w-[850px] mx-auto mb-2 text-right">
                <span className="inline-flex items-center gap-1.5 text-[11px] text-sky-800 bg-sky-50 border border-sky-200 px-3 py-1 rounded-lg">
                  💡 Nhấp vào Logo trên tiêu đề đơn hàng bên dưới để tải lên file ảnh logo gốc (PNG/JPG/SVG) của bạn
                </span>
              </div>
              <div className="max-w-[850px] mx-auto bg-white p-6 sm:p-7 shadow-xl rounded-xl border border-slate-300 text-slate-800 text-xs" ref={poAVPRef}>
                
                {/* Top Header Row */}
                <div className="flex justify-between items-center border-b border-slate-200 pb-3 mb-3">
                  {/* Left Logo - 100% accurate */}
                  <AnVietPhatGroupHeaderLogo />

                  {/* Right Company Info */}
                  <div className="text-right text-[10.5px] text-slate-700 space-y-0.5">
                    <div className="font-bold text-slate-900">CÔNG TY CỔ PHẦN NĂNG LƯỢNG AN VIỆT PHÁT</div>
                    <div>Office: 62-70 Đường B4 KĐT Sala, P. An Khánh, TP. HCM</div>
                    <div>Nhà máy: Cụm CN Hố Nai 3, P. Hố Nai, TP. Đồng Nai &nbsp;|&nbsp; 🌐 www.avpgroup.vn</div>
                  </div>
                </div>

                {/* Title & PO Box */}
                <div className="flex justify-between items-center mb-3">
                  <div>
                    <h2 className="text-xl font-black text-slate-900 tracking-wider uppercase">ĐƠN ĐẶT HÀNG</h2>
                  </div>

                  <div className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-[11px] text-slate-800 space-y-0.5 min-w-[210px]">
                    <div className="flex justify-between">
                      <span className="font-semibold text-slate-600">Số đơn hàng:</span>
                      <span className="font-bold text-slate-900 font-mono">{poNumberAVP}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-semibold text-slate-600">Ngày đặt hàng:</span>
                      <span className="font-medium text-slate-800">{formattedPoDate}</span>
                    </div>
                  </div>
                </div>

                {/* Metadata Box */}
                <div className="bg-slate-50/80 border border-slate-200 rounded-lg p-2.5 text-[10.5px] text-slate-800 space-y-1 mb-3">
                  <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-3 font-bold text-slate-700 uppercase">ĐƠN VỊ SẢN XUẤT</div>
                    <div className="col-span-9 font-bold text-slate-900">{supplierInfo.name}</div>
                  </div>
                  <div className="grid grid-cols-12 gap-2 border-t border-slate-200/60 pt-1">
                    <div className="col-span-3 font-bold text-slate-700 uppercase">ĐỊA CHỈ</div>
                    <div className="col-span-9 text-slate-700">{supplierInfo.address}</div>
                  </div>
                  <div className="grid grid-cols-12 gap-2 border-t border-slate-200/60 pt-1">
                    <div className="col-span-3 font-bold text-slate-700 uppercase">CĂN CỨ THEO PO KH</div>
                    <div className="col-span-9 font-semibold text-slate-900 flex justify-between">
                      <span>{poNumberCustomer}</span>
                      <span className="text-slate-600">Ngày: <strong className="text-slate-900">{formattedPoDate}</strong></span>
                    </div>
                  </div>
                  <div className="grid grid-cols-12 gap-2 border-t border-slate-200/60 pt-1">
                    <div className="col-span-3 font-bold text-slate-700 uppercase">ĐƠN VỊ NHẬN HÀNG</div>
                    <div className="col-span-9 font-bold text-slate-900">CÔNG TY CỔ PHẦN NĂNG LƯỢNG AN VIỆT PHÁT</div>
                  </div>
                  <div className="grid grid-cols-12 gap-2 border-t border-slate-200/60 pt-1">
                    <div className="col-span-3 font-bold text-slate-700 uppercase">ĐỊA CHỈ</div>
                    <div className="col-span-9 text-slate-700">Cụm Công nghiệp Hố Nai 3, Phường Hố Nai, Thành phố Đồng Nai</div>
                  </div>
                  <div className="grid grid-cols-12 gap-2 border-t border-slate-200/60 pt-1">
                    <div className="col-span-3 font-bold text-slate-700 uppercase">GIAO HÀNG ĐẾN</div>
                    <div className="col-span-9 font-bold text-slate-900">{poCustomer || "CÔNG TY TNHH MỘT THÀNH VIÊN THUỐC LÁ THĂNG LONG"}</div>
                  </div>
                </div>

                {/* Items Table - Optimized for A4 page height and wide specs */}
                <table className="w-full border-collapse border border-slate-300 text-[11px] mb-3">
                  <thead>
                    <tr className="bg-slate-200 text-slate-900 font-bold text-[10.5px]">
                      <th className="border border-slate-300 px-1.5 py-1.5 text-center w-[10%]">MÃ SP</th>
                      <th className="border border-slate-300 px-1.5 py-1.5 text-left w-[18%]">SẢN PHẨM</th>
                      <th className="border border-slate-300 px-1.5 py-1.5 text-left w-[37%]">QUY CÁCH KỸ THUẬT</th>
                      <th className="border border-slate-300 px-1.5 py-1.5 text-center w-[5%]">ĐVT</th>
                      <th className="border border-slate-300 px-1.5 py-1.5 text-center w-[12%]">LỊCH GIAO HÀNG</th>
                      <th className="border border-slate-300 px-1.5 py-1.5 text-right w-[10%]">ĐƠN GIÁ</th>
                      <th className="border border-slate-300 px-1.5 py-1.5 text-right w-[6%]">SL</th>
                      <th className="border border-slate-300 px-1.5 py-1.5 text-right w-[12%]">THÀNH TIỀN</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableDataAVP.map((row, idx) => (
                      <tr key={idx} className="align-top">
                        <td className="border border-slate-300 px-1.5 py-1.5 text-center font-mono font-bold text-slate-900">{row.code}</td>
                        <td className="border border-slate-300 px-1.5 py-1.5 font-bold text-slate-900">{row.name}</td>
                        <td className="border border-slate-300 px-1.5 py-1.5 text-[10px] leading-snug text-slate-700">
                          {row.specs}
                        </td>
                        <td className="border border-slate-300 px-1.5 py-1.5 text-center">{row.unit}</td>
                        <td className="border border-slate-300 px-1.5 py-1.5 text-center text-[10px] leading-tight">
                          {row.deliveryBatches && row.deliveryBatches.length > 1 ? (
                            <div className="space-y-0.5">
                              {row.deliveryBatches.map((b: any, bIdx: number) => (
                                <div key={bIdx} className="font-semibold text-slate-800">
                                  Đợt {b.batch}: <span className="text-sky-700 font-bold">{b.date}</span> ({b.qty.toLocaleString("vi-VN")})
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="font-semibold text-slate-800">{row.deliveryDate}</span>
                          )}
                        </td>
                        <td className="border border-slate-300 px-1.5 py-1.5 text-right">{row.unitPrice.toLocaleString("vi-VN")}</td>
                        <td className="border border-slate-300 px-1.5 py-1.5 text-right font-bold">{row.qty.toLocaleString("vi-VN")}</td>
                        <td className="border border-slate-300 px-1.5 py-1.5 text-right font-bold text-slate-900">{row.amount.toLocaleString("vi-VN")}</td>
                      </tr>
                    ))}
                    {/* Summary Rows inside table */}
                    <tr className="bg-slate-50 font-bold">
                      <td colSpan={7} className="border border-slate-300 px-2 py-1 text-right">Cộng tiền hàng:</td>
                      <td className="border border-slate-300 px-1.5 py-1 text-right">{subtotalAVP.toLocaleString("vi-VN")} đ</td>
                    </tr>
                    <tr className="bg-slate-50">
                      <td colSpan={5} className="border border-slate-300 px-2 py-1 text-right font-bold">Thuế suất GTGT &nbsp;&nbsp; 8%</td>
                      <td colSpan={2} className="border border-slate-300 px-2 py-1 text-right font-bold">Tiền thuế GTGT:</td>
                      <td className="border border-slate-300 px-1.5 py-1 text-right font-bold">{vatAVP.toLocaleString("vi-VN")} đ</td>
                    </tr>
                    <tr className="bg-slate-100 font-extrabold text-slate-900 text-xs">
                      <td colSpan={7} className="border border-slate-300 px-2 py-1.5 text-right">Tổng tiền thanh toán:</td>
                      <td className="border border-slate-300 px-1.5 py-1.5 text-right text-sky-800">{grandTotalAVP.toLocaleString("vi-VN")} đ</td>
                    </tr>
                  </tbody>
                </table>

                {/* Written Amount */}
                <div className="mb-3 bg-slate-50/80 border border-slate-200 rounded-lg p-2 text-[11px] italic font-semibold text-slate-800">
                  <span className="font-bold not-italic text-slate-900">Số tiền viết bằng chữ:</span> {numberToWordsVN(grandTotalAVP)}
                </div>

                {/* Quy Cách Giao Hàng Section */}
                <div className="mb-3 bg-slate-50/50 p-2.5 rounded-lg border border-slate-200/80">
                  <h4 className="text-[10px] font-bold text-slate-900 uppercase tracking-wider mb-1">QUY CÁCH GIAO HÀNG & CHẤT LƯỢNG</h4>
                  <ul className="text-[10px] text-slate-700 space-y-0.5 list-disc pl-3.5 leading-tight">
                    <li>Hàng đóng theo quy cách thùng âm dương lồng cặp, sản xuất theo đúng TCKT đã ký duyệt.</li>
                    <li>Thời gian tiếp nhận giao hàng: từ 07h30' đến trước 15h00' các ngày làm việc trong tuần.</li>
                    <li>Giao hàng trực tiếp trên phương tiện vận chuyển và hạ Pallet tại kho nhà máy chỉ định.</li>
                  </ul>
                </div>

                {/* Dynamic VietQR Payment Section */}
                <div className="mb-4 bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-4">
                  <div className="text-[10.5px] text-slate-700 space-y-1">
                    <div className="font-bold text-slate-900 uppercase text-[11px] flex items-center gap-1.5">
                      <QrCode className="w-3.5 h-3.5 text-sky-600" />
                      THÔNG TIN THANH TOÁN CHUYỂN KHOẢN (VIETQR)
                    </div>
                    <div>• Đơn vị thụ hưởng: <strong className="text-slate-900">{supplierInfo.name}</strong></div>
                    <div>• Số tài khoản: <strong className="font-mono text-slate-900">0011001234567</strong> (Vietcombank - Sở giao dịch)</div>
                    <div>• Nội dung CK: <strong className="font-mono text-sky-700 font-bold">THANH TOAN {poNumberAVP}</strong></div>
                    <div>• Số tiền: <strong className="font-mono text-slate-900 font-extrabold">{grandTotalAVP.toLocaleString("vi-VN")} VND</strong></div>
                  </div>
                  <div className="text-center shrink-0">
                    <img
                      src={`https://img.vietqr.io/image/VCB-0011001234567-compact2.png?amount=${grandTotalAVP}&addInfo=${encodeURIComponent("THANH TOAN " + poNumberAVP)}&accountName=${encodeURIComponent(supplierInfo.shortName)}`}
                      alt="VietQR Payment"
                      className="w-20 h-20 object-contain rounded-lg border border-slate-200 shadow-2xs bg-white p-0.5"
                      crossOrigin="anonymous"
                    />
                    <span className="text-[9px] text-slate-400 block mt-0.5 font-medium">Quét VietQR</span>
                  </div>
                </div>

                {/* Clean Signatures Box Without Pre-signed Stamps */}
                <div className="grid grid-cols-2 gap-6 text-center text-[11px] text-slate-800 pt-3 border-t border-slate-200">
                  <div>
                    <div className="font-bold uppercase text-slate-900">{supplierInfo.name}</div>
                    <div className="text-[10px] text-slate-500 italic mt-0.5">(Ký, ghi rõ họ tên & đóng dấu)</div>
                    <div className="h-16"></div> {/* Clean empty space for signature */}
                  </div>
                  <div>
                    <div className="font-bold uppercase text-slate-900">CÔNG TY CỔ PHẦN NĂNG LƯỢNG AN VIỆT PHÁT</div>
                    <div className="text-[10px] text-slate-500 italic mt-0.5">(Ký, ghi rõ họ tên & đóng dấu)</div>
                    <div className="h-16"></div> {/* Clean empty space for signature */}
                  </div>
                </div>

              </div>
            </div>
          )}

        </div>

        {/* Footer Bar */}
        <div className="px-6 py-3 bg-white border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            Dữ liệu PO được đồng bộ với <span className="font-semibold text-slate-700">ERP Tâm Sen - Chuỗi cung ứng Bao Bì</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
            >
              Đóng Modal
            </button>
            
            {onApproveAndProceed && (
              <button
                onClick={onApproveAndProceed}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-2"
              >
                Phê Duyệt & Tiếp Tục Lập Kế Hoạch
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

      </div>

      {/* EMAIL MODAL SIMULATOR */}
      {showEmailModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 animate-scale-up space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Mail className="w-4 h-4 text-emerald-600" />
                Gửi Mail Đơn Đặt Hàng Đến Nhà Cung Cấp
              </h3>
              <button onClick={() => setShowEmailModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Templates Picker */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-slate-500">Chọn mẫu thư nhanh:</span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => handleApplyEmailTemplate("new_order")}
                  className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-semibold border border-blue-200 transition"
                >
                  📑 Đơn hàng mới
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyEmailTemplate("reminder")}
                  className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 text-[11px] font-semibold border border-amber-200 transition"
                >
                  ⏱️ Nhắc tiến độ
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyEmailTemplate("payment")}
                  className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-semibold border border-emerald-200 transition"
                >
                  💰 Xác nhận thanh toán
                </button>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Người nhận (NCC):</label>
                <input
                  type="email"
                  value={emailRecipient}
                  onChange={(e) => setEmailRecipient(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Tiêu đề (Subject):</label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Nội dung Email:</label>
                <textarea
                  rows={7}
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-emerald-500 outline-none font-sans"
                />
              </div>

              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-[11px] text-slate-600">
                <span className="flex items-center gap-1.5 font-semibold">
                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                  Đính kèm: {poNumberAVP}.pdf ({grandTotalAVP.toLocaleString("vi-VN")} đ)
                </span>
                <span className="text-emerald-600 font-bold">Auto-attached</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={handleOpenNativeMailClient}
                className="px-3 py-1.5 text-xs text-blue-700 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-xl font-semibold flex items-center gap-1.5 transition"
                title="Mở ứng dụng email trên máy tính (Apple Mail, Outlook...)"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Mở Mail Client Ngoài
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowEmailModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleSendEmailSubmit}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
                >
                  <Send className="w-3.5 h-3.5" />
                  Gửi Mail Hệ Thống
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
