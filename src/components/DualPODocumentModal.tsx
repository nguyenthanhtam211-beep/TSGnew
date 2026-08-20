import React, { useState, useMemo, useRef } from "react";
import { 
  X, Download, Mail, CheckCircle, FileText, ArrowRight, ShieldCheck, 
  Eye, RefreshCw, Layers, Printer, Send, Sparkles, AlertCircle, Copy, FileCheck
} from "lucide-react";
import { toast } from "react-hot-toast";
import { exportElementToPDF } from "../lib/pdf-exporter";
import { TamSenGroupHeaderLogo, AnVietPhatGroupHeaderLogo } from "./CompanyLogo";
import MacTrafficLights from "./MacTrafficLights";
import { parseNumber } from "../lib/business-logic";

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

  // 1. Identify Supplier Code (e.g. THP, YFY, TB) & Details
  const supplierCode = useMemo(() => {
    for (const line of poLines) {
      const supp = line.supplier || line["RP_Nhà cung cấp"] || line["Nhà cung cấp"] || "";
      if (supp && supp !== "Tâm Sen") return supp.toUpperCase();
      const code = line.code || line["Mã sản phẩm"] || "";
      if (code.includes("PS-15") || code.includes("C48") || code.includes("THP")) return "THP";
      if (code.includes("YFY")) return "YFY";
      if (code.includes("TB")) return "TB";
    }
    return "THP";
  }, [poLines]);

  // Supplier Full Info
  const supplierInfo = useMemo(() => {
    const found = supplierData.find(s => 
      (s["Mã nhà cung cấp"] || s["Tên ngắn"] || s.id || "").toUpperCase() === supplierCode ||
      (s["Tên Nhà Cung Cấp"] || "").toUpperCase().includes(supplierCode)
    );

    if (found) {
      return {
        name: found["Tên Nhà Cung Cấp"] || "CÔNG TY CỔ PHẦN BAO BÌ THUẬN HOÀ PHÁT",
        address: found["Địa chỉ"] || "Xã Chỉ Đạo, Huyện Văn Lâm, Tỉnh Hưng Yên",
        email: found["Email"] || "kinhdoanh@thuanhoaphat.com.vn",
        phone: found["Điện thoại"] || "0989 646 663"
      };
    }

    if (supplierCode === "THP") {
      return {
        name: "CÔNG TY CỔ PHẦN BAO BÌ THUẬN HOÀ PHÁT",
        address: "Xã Chỉ Đạo, Huyện Văn Lâm, Tỉnh Hưng Yên",
        email: "kinhdoanh@thuanhoaphat.com.vn",
        phone: "0989 646 663"
      };
    }

    return {
      name: `CÔNG TY CỔ PHẦN BAO BÌ ${supplierCode}`,
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

      const rawSpecs = line.specs || line["Quy cách"] || "Thùng carton sóng theo tiêu chuẩn kỹ thuật đã duyệt.";
      
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
        code: line.code || line["Mã sản phẩm"] || line.masterProductCode || "-",
        name: line["Tên sản phẩm"] || line.name || line.masterProductName || "Sản phẩm",
        unit: line["ĐVT"] || line.unit || "Cái",
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

      const rawSpecs = line.specs || line["Quy cách"] || "Thùng carton sóng theo tiêu chuẩn kỹ thuật đã duyệt.";

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
        code: line.code || line["Mã sản phẩm"] || line.masterProductCode || "-",
        name: line["Tên sản phẩm"] || line.name || line.masterProductName || "Sản phẩm",
        unit: line["ĐVT"] || line.unit || "Cái",
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

  const handleSendEmailSubmit = () => {
    const toastId = toast.loading("Đang gửi email đơn đặt hàng đến nhà cung cấp...");
    setTimeout(() => {
      toast.success(`Đã gửi mail thành công đến ${emailRecipient}!`, { id: toastId });
      setShowEmailModal(false);
    }, 1200);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-2 sm:p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white w-full max-w-6xl rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[95vh] overflow-hidden">
        
        {/* Header Modal Bar */}
        <div className="px-6 py-4 bg-white text-slate-900 flex items-center justify-between border-b border-black/[0.06]">
          <div className="flex items-center gap-3">
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

          <div className="flex items-center gap-2">
            <MacTrafficLights onClose={onClose} />
          </div>
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
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
              title="Tải bộ đôi cả 2 file PDF PO"
            >
              <Download className="w-3.5 h-3.5" />
              Tải Cả 2 PO
            </button>

            <button
              onClick={handleOpenEmailDialog}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
            >
              <Mail className="w-3.5 h-3.5" />
              Gửi Mail PO
            </button>
          </div>
        </div>

        {/* Modal Main Content Container */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-100">
          
          {/* TAB 1: COMPARISON & RECONCILIATION VIEW */}
          {activeTab === "comparison" && (
            <div className="space-y-6">
              {/* Validation Summary Banner */}
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3">
                <div className="p-2 bg-emerald-500 text-white rounded-xl shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-emerald-900 flex items-center gap-2">
                    Xác Nhận Trùng Khớp 100% Dữ Liệu Sản Phẩm & Quy Cách Với PO Khách Hàng ({poNumberCustomer})
                  </h4>
                  <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
                    Hệ thống đã đối chiếu và tự động phân tách PO thành 2 hợp đồng thành phần theo mô hình Công ty Mẹ (An Việt Phát) - Công ty Con (Tâm Sen). Mã sản phẩm, số lượng đặt hàng, quy cách thùng và ngày giao hàng đã hoàn toàn khớp.
                  </p>
                </div>
              </div>

              {/* 3-Column Side-by-Side Comparison */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* Column 1: Customer Original PO */}
                <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                    <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-[11px] font-bold uppercase tracking-wider">
                      PO Gốc Khách Hàng
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-800">{poNumberCustomer}</span>
                  </div>

                  <div className="space-y-2 text-xs mb-4 text-slate-600">
                    <div><span className="font-semibold text-slate-800">Khách hàng:</span> {poCustomer}</div>
                    <div><span className="font-semibold text-slate-800">Ngày đặt hàng:</span> {formattedPoDate}</div>
                    <div><span className="font-semibold text-slate-800">Nơi giao hàng:</span> CÔNG TY TNHH MTV THUỐC LÁ THĂNG LONG</div>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden text-xs flex-1">
                    <div className="bg-slate-50 px-3 py-2 font-bold text-slate-700 border-b border-slate-200 flex justify-between">
                      <span>Sản phẩm & Quy cách</span>
                      <span>Số lượng</span>
                    </div>
                    {tableDataTamSen.map((item, i) => (
                      <div key={i} className="p-3 border-b border-slate-100 last:border-b-0 space-y-1">
                        <div className="font-bold text-slate-900">{item.name} ({item.code})</div>
                        <div className="text-[11px] text-slate-500 whitespace-pre-line bg-slate-50 p-2 rounded border border-slate-100">
                          {item.specs}
                        </div>
                        <div className="flex justify-between items-center pt-1 font-semibold text-slate-700">
                          <span>Ngày giao: {item.deliveryDate}</span>
                          <span className="text-blue-600 font-bold">{item.qty.toLocaleString("vi-VN")} {item.unit}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 text-right">
                    <span className="text-xs text-slate-500 block">Trạng thái PO KH:</span>
                    <span className="text-xs font-bold text-emerald-600">Đã Phê Duyệt & Khớp Khối Lượng</span>
                  </div>
                </div>

                {/* Column 2: PO 1 (Tâm Sen đặt An Việt Phát) */}
                <div className="bg-gradient-to-b from-amber-50/50 to-white rounded-2xl p-4 border border-amber-200 shadow-sm flex flex-col ring-2 ring-amber-400/30">
                  <div className="flex items-center justify-between pb-3 border-b border-amber-200/60 mb-3">
                    <span className="px-2.5 py-1 bg-amber-500 text-white rounded-lg text-[11px] font-bold uppercase tracking-wider">
                      PO 1: Tâm Sen → An Việt Phát
                    </span>
                    <span className="text-xs font-mono font-bold text-amber-900">{poNumberTamSen}</span>
                  </div>

                  <div className="space-y-2 text-xs mb-4 text-slate-600">
                    <div><span className="font-semibold text-slate-800">Đơn vị nhận hàng:</span> TÂM SEN GROUP</div>
                    <div><span className="font-semibold text-slate-800">Đơn vị sản xuất:</span> AN VIỆT PHÁT GROUP</div>
                    <div><span className="font-semibold text-slate-800">Căn cứ PO KH:</span> {poNumberCustomer}</div>
                  </div>

                  <div className="border border-amber-200 rounded-xl overflow-hidden text-xs flex-1 bg-white">
                    <div className="bg-amber-100/70 px-3 py-2 font-bold text-amber-900 border-b border-amber-200 flex justify-between">
                      <span>Chi tiết Đơn giá & Thành tiền</span>
                      <span>Thành tiền</span>
                    </div>
                    {tableDataTamSen.map((item, i) => (
                      <div key={i} className="p-3 border-b border-amber-100 last:border-b-0 space-y-1.5">
                        <div className="font-bold text-amber-950">{item.name}</div>
                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-500">Đơn giá bán:</span>
                          <span className="font-bold text-slate-800">{item.unitPrice.toLocaleString("vi-VN")} đ</span>
                        </div>
                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-500">Số lượng:</span>
                          <span className="font-bold text-slate-800">{item.qty.toLocaleString("vi-VN")} {item.unit}</span>
                        </div>
                        <div className="flex justify-between text-xs pt-1 border-t border-dashed border-amber-200 font-bold text-amber-900">
                          <span>Cộng tiền:</span>
                          <span>{item.amount.toLocaleString("vi-VN")} đ</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 pt-3 border-t border-amber-200/80 space-y-1 text-right">
                    <div className="text-xs text-slate-600 flex justify-between">
                      <span>Thuế GTGT (8%):</span>
                      <span>{vatTamSen.toLocaleString("vi-VN")} đ</span>
                    </div>
                    <div className="text-sm font-bold text-amber-900 flex justify-between">
                      <span>Tổng Tiền (Tâm Sen):</span>
                      <span className="text-amber-600">{grandTotalTamSen.toLocaleString("vi-VN")} đ</span>
                    </div>
                  </div>
                </div>

                {/* Column 3: PO 2 (An Việt Phát đặt Nhà Cung Cấp) */}
                <div className="bg-gradient-to-b from-sky-50/50 to-white rounded-2xl p-4 border border-sky-200 shadow-sm flex flex-col ring-2 ring-sky-400/30">
                  <div className="flex items-center justify-between pb-3 border-b border-sky-200/60 mb-3">
                    <span className="px-2.5 py-1 bg-sky-600 text-white rounded-lg text-[11px] font-bold uppercase tracking-wider">
                      PO 2: An Việt Phát → {supplierCode}
                    </span>
                    <span className="text-xs font-mono font-bold text-sky-900">{poNumberAVP}</span>
                  </div>

                  <div className="space-y-2 text-xs mb-4 text-slate-600">
                    <div><span className="font-semibold text-slate-800">Đơn vị nhận hàng:</span> AN VIỆT PHÁT GROUP</div>
                    <div><span className="font-semibold text-slate-800">Đơn vị sản xuất:</span> {supplierInfo.name}</div>
                    <div><span className="font-semibold text-slate-800">Căn cứ PO KH:</span> {poNumberCustomer}</div>
                  </div>

                  <div className="border border-sky-200 rounded-xl overflow-hidden text-xs flex-1 bg-white">
                    <div className="bg-sky-100/70 px-3 py-2 font-bold text-sky-900 border-b border-sky-200 flex justify-between">
                      <span>Đơn giá Nhập & Chi phí</span>
                      <span>Thành tiền</span>
                    </div>
                    {tableDataAVP.map((item, i) => (
                      <div key={i} className="p-3 border-b border-sky-100 last:border-b-0 space-y-1.5">
                        <div className="font-bold text-sky-950">{item.name}</div>
                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-500">Đơn giá nhập từ NCC:</span>
                          <span className="font-bold text-slate-800">{item.unitPrice.toLocaleString("vi-VN")} đ</span>
                        </div>
                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-500">Số lượng:</span>
                          <span className="font-bold text-slate-800">{item.qty.toLocaleString("vi-VN")} {item.unit}</span>
                        </div>
                        <div className="flex justify-between text-xs pt-1 border-t border-dashed border-sky-200 font-bold text-sky-900">
                          <span>Cộng tiền mua:</span>
                          <span>{item.amount.toLocaleString("vi-VN")} đ</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 pt-3 border-t border-sky-200/80 space-y-1 text-right">
                    <div className="text-xs text-slate-600 flex justify-between">
                      <span>Thuế GTGT (8%):</span>
                      <span>{vatAVP.toLocaleString("vi-VN")} đ</span>
                    </div>
                    <div className="text-sm font-bold text-sky-900 flex justify-between">
                      <span>Tổng Tiền Thanh Toán NCC:</span>
                      <span className="text-sky-600">{grandTotalAVP.toLocaleString("vi-VN")} đ</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Action Prompt */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-4 shadow-sm">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Sẵn sàng chuyển giao sang Kế Hoạch Giao Hàng (Step 3)?</h4>
                  <p className="text-xs text-slate-500 mt-0.5">Xác nhận duyệt bộ 2 PO này sẽ ghi nhận chính thức vào dòng tiền và chuyển đơn hàng sang lập Lịch giao hàng.</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setActiveTab("po_tamsen")}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
                  >
                    Xem PDF Mẫu Tâm Sen
                  </button>
                  <button
                    onClick={() => setActiveTab("po_anvietphat")}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
                  >
                    Xem PDF Mẫu An Việt Phát
                  </button>
                  {onApproveAndProceed && (
                    <button
                      onClick={onApproveAndProceed}
                      className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2"
                    >
                      Phê Duyệt & Chuyển Lập Kế Hoạch
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

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
                <div className="mb-4 bg-slate-50/50 p-2 rounded-lg border border-slate-200/80">
                  <h4 className="text-[10px] font-bold text-slate-900 uppercase tracking-wider mb-1">QUY CÁCH GIAO HÀNG & BẢO QUẢN</h4>
                  <ul className="text-[10px] text-slate-700 space-y-0.5 list-disc pl-3.5 leading-tight">
                    <li>Sản xuất theo đúng thiết kế và tiêu chuẩn kỹ thuật đã duyệt. Không tính tồn kho phát sinh.</li>
                    <li>Đóng gói thùng âm dương lồng cặp, xếp cố định trên Pallet gỗ tiêu chuẩn tại kho nhà máy.</li>
                    <li>Thời gian tiếp nhận giao hàng: từ 07h30' đến trước 15h00' các ngày trong tuần.</li>
                  </ul>
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
                <div className="mb-4 bg-slate-50/50 p-2 rounded-lg border border-slate-200/80">
                  <h4 className="text-[10px] font-bold text-slate-900 uppercase tracking-wider mb-1">QUY CÁCH GIAO HÀNG & CHẤT LƯỢNG</h4>
                  <ul className="text-[10px] text-slate-700 space-y-0.5 list-disc pl-3.5 leading-tight">
                    <li>Hàng đóng theo quy cách thùng âm dương lồng cặp, sản xuất theo đúng TCKT đã ký duyệt.</li>
                    <li>Thời gian tiếp nhận giao hàng: từ 07h30' đến trước 15h00' các ngày làm việc trong tuần.</li>
                    <li>Giao hàng trực tiếp trên phương tiện vận chuyển và hạ Pallet tại kho nhà máy chỉ định.</li>
                  </ul>
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
                  rows={8}
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-emerald-500 outline-none font-sans"
                />
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-[11px] text-slate-600">
                <span className="flex items-center gap-1.5 font-semibold">
                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                  Đính kèm: {poNumberAVP}.pdf ({grandTotalAVP.toLocaleString("vi-VN")} đ)
                </span>
                <span className="text-emerald-600 font-bold">Auto-attached</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowEmailModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
              >
                Hủy
              </button>
              <button
                onClick={handleSendEmailSubmit}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm"
              >
                <Send className="w-3.5 h-3.5" />
                Gửi Mail Ngay
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
