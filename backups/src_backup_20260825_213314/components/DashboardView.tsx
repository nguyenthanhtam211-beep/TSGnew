import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Package, Truck, FileText, CheckCircle, Clock, AlertTriangle, ArrowUpRight, TrendingUp, DollarSign, ShieldAlert, BarChart3, Activity, Filter, PieChart as PieChartIcon, ShoppingCart, Users, Briefcase, Star, TrendingDown, Download, RefreshCw, Printer, Sparkles, Presentation, FileSpreadsheet, ChevronDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, ComposedChart, Area, AreaChart } from 'recharts';
import { parseNumber } from '../lib/business-logic';
import * as XLSX from 'xlsx';
import { toast } from 'react-hot-toast';
import { auth, storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import html2canvas from "html2canvas";
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import GoogleSheetsSyncModal from './GoogleSheetsSyncModal';
import PDFExportModal from './PDFExportModal';
import { sanitizeDocColorsForCanvas } from '../lib/pdf-exporter';
import { CustomChartTooltip } from './CustomChartTooltip';
import { RECHARTS_PALETTE } from '../lib/design-tokens';

export default function DashboardView({ 
  poData, 
  deliveryData, 
  poLinesData, 
  customersData = [],
  commissionData = []
}: { 
  poData: any[], 
  deliveryData: any[], 
  poLinesData: any[], 
  customersData?: any[],
  commissionData?: any[]
}) {
  const [timeFilter, setTimeFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isExportingSlides, setIsExportingSlides] = useState(false);
  const [isSheetsModalOpen, setIsSheetsModalOpen] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const dashboardRef = useRef<HTMLDivElement>(null);
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

  const formatter = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });
  const numFormatter = new Intl.NumberFormat('vi-VN');

  const handleExportSlides = async () => {
    setIsExportingSlides(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/presentations');
      
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const token = credential?.accessToken;
      
      if (!token) throw new Error("No access token");

      toast.loading("Đang chụp ảnh các biểu đồ...", { id: "export-slides" });
      await new Promise(r => setTimeout(r, 200));

      // Capture charts
      const elementsToExport = [
         ...Array.from(document.querySelectorAll('.recharts-responsive-container')),
         ...Array.from(document.querySelectorAll('table'))
      ].map(node => node.closest('.bg-white')).filter(Boolean);
      
      const uniqueChartNodes = Array.from(new Set(elementsToExport)) as HTMLElement[];
      const imageUrls: string[] = [];

      for (let i = 0; i < uniqueChartNodes.length; i++) {
        const node = uniqueChartNodes[i];
        if (!node) continue;
        
        await new Promise(r => setTimeout(r, 100));

        // save original styles
        const origMaxHeight = node.style.maxHeight;
        const origOverflow = node.style.overflow;
        node.style.maxHeight = 'none';
        node.style.overflow = 'visible';

        const canvas = await html2canvas(node, { 
          scale: 1, 
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          windowWidth: 1200,
          onclone: (clonedDoc) => {
            sanitizeDocColorsForCanvas(clonedDoc);
          }
        });
        
        // restore styles
        node.style.maxHeight = origMaxHeight;
        node.style.overflow = origOverflow;

        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
        if (!blob) continue;

        toast.loading(`Đang tải ảnh ${i + 1}/${uniqueChartNodes.length} lên Cloud...`, { id: "export-slides" });
        const imageRef = ref(storage, `slides_exports/chart_${Date.now()}_${i}.png`);
        await uploadBytes(imageRef, blob);
        const url = await getDownloadURL(imageRef);
        imageUrls.push(url);
      }

      toast.loading("Đang tạo Google Slides...", { id: "export-slides" });

      const dateStr = new Date().toLocaleDateString('vi-VN');
      const timeFilterLabel = timeFilter === 'all' ? 'Tất cả' : timeFilter.toUpperCase();
      const title = `Báo cáo Tổng quát Dashboard - ${dateStr}`;

      const createRes = await fetch('https://slides.googleapis.com/v1/presentations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: title
        })
      });
      
      const resText = await createRes.text();
      if (!createRes.ok) {
        console.error(resText);
        if (resText.includes('<!doctype') || resText.includes('<html')) {
          throw new Error("Kết nối Google Slides bị chặn trong iframe. Vui lòng Mở ứng dụng trong Tab mới.");
        }
        throw new Error("Failed to create presentation: " + resText.substring(0, 150));
      }
      
      let presentation: any = {};
      try {
        presentation = JSON.parse(resText);
      } catch (e) {
        throw new Error("Phản hồi từ Google Slides không phải dữ liệu JSON hợp lệ.");
      }
      const presentationId = presentation.presentationId;
      
      const titleSlide = presentation.slides?.[0];
      let titleId = '';
      let subtitleId = '';
      
      if (titleSlide?.pageElements) {
        titleSlide.pageElements.forEach((el: any) => {
          if (el.shape?.placeholder?.type === 'CENTERED_TITLE' || el.shape?.placeholder?.type === 'TITLE') {
            titleId = el.objectId;
          }
          if (el.shape?.placeholder?.type === 'SUBTITLE') {
            subtitleId = el.objectId;
          }
        });
      }

      const textToInsert = `Tổng quan hoạt động (${timeFilterLabel})\n\n- Số đơn hàng: ${numFormatter.format(totalOrders)}\n- Số đơn đã hoàn thành: ${numFormatter.format(overallPoLifecycle.completed)}\n- Tổng doanh thu: ${formatter.format(totalRevenue)}\n- Tổng lợi nhuận gộp: ${formatter.format(totalProfit)}\n- Biên lợi nhuận trung bình: ${totalRevenue > 0 ? (totalProfit / totalRevenue * 100).toFixed(1) : 0}%`;
      
      const requests: any[] = [];
      if (titleId) {
        requests.push({
          insertText: {
            objectId: titleId,
            text: title
          }
        });
      }
      if (subtitleId) {
        requests.push({
          insertText: {
            objectId: subtitleId,
            text: textToInsert
          }
        });
      }

      // Add slides for each image
      for (let i = 0; i < imageUrls.length; i++) {
        const slideId = `slide_chart_${i}_${Date.now()}`;
        const imageId = `image_chart_${i}_${Date.now()}`;
        
        requests.push({
          createSlide: {
            objectId: slideId,
            slideLayoutReference: { predefinedLayout: 'BLANK' }
          }
        });
        
        requests.push({
          createImage: {
            objectId: imageId,
            url: imageUrls[i],
            elementProperties: {
              pageObjectId: slideId,
              size: {
                width: { magnitude: 650, unit: 'PT' }, // Standard slide width is 720PT
                height: { magnitude: 380, unit: 'PT' } // Standard slide height is 405PT
              },
              transform: {
                scaleX: 1, scaleY: 1, translateX: 35, translateY: 12, unit: 'PT'
              }
            }
          }
        });
      }
      
      if (requests.length > 0) {
        await fetch(`https://slides.googleapis.com/v1/presentations/${presentationId}:batchUpdate`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ requests })
        });
      }

      window.open(`https://docs.google.com/presentation/d/${presentationId}/edit`, '_blank');
      toast.success("Đã tạo Google Slides thành công!", { id: "export-slides" });
    } catch (error) {
      console.error(error);
      toast.error("Lỗi khi xuất Google Slides.", { id: "export-slides" });
    } finally {
      setIsExportingSlides(false);
    }
  };

  // Function to export comprehensive report
  const handleExportReport = () => {
    try {
      setIsExporting(true);
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      if (filteredDelivery.length === 0) {
        toast.error("Không có dữ liệu giao dịch để xuất báo cáo!");
        setIsExporting(false);
        return;
      }

      const wb = XLSX.utils.book_new();

      // 1. Sheet: Tổng quan KPIs
      const summaryKPIs = [
        { "Chỉ tiêu kinh doanh": "Tổng Doanh thu", "Giá trị": totalRevenue, "Đơn vị": "VND" },
        { "Chỉ tiêu kinh doanh": "Tổng Lợi nhuận gộp", "Giá trị": totalProfit, "Đơn vị": "VND" },
        { "Chỉ tiêu kinh doanh": "Biên lợi nhuận trung bình", "Giá trị": totalRevenue > 0 ? `${((totalProfit / totalRevenue) * 100).toFixed(2)}%` : "0%", "Đơn vị": "%" },
        { "Chỉ tiêu kinh doanh": "Tổng số đơn hàng (PO)", "Giá trị": totalOrders, "Đơn vị": "Đơn" },
        { "Chỉ tiêu kinh doanh": "Số lượt giao hàng thực hiện", "Giá trị": filteredDelivery.length, "Đơn vị": "Lượt" },
        { "Chỉ tiêu kinh doanh": "Doanh thu dự kiến (PO chưa giao)", "Giá trị": executiveInsights.projectedRev, "Đơn vị": "VND" },
        { "Chỉ tiêu kinh doanh": "Số đơn hàng chậm tiến độ", "Giá trị": executiveInsights.delayedPOs, "Đơn vị": "PO Line" },
        { "Chỉ tiêu kinh doanh": "Mục biên lợi nhuận thấp (<15%)", "Giá trị": executiveInsights.lowMarginItems, "Đơn vị": "SKU" }
      ];
      const wsKPI = XLSX.utils.json_to_sheet(summaryKPIs);
      wsKPI['!cols'] = [{ wch: 38 }, { wch: 22 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(wb, wsKPI, "Tong_Quan");

      // 2. Sheet: Phân tích theo Tháng
      const monthDataExport = monthlyTrendData.map(m => {
        const cost = m.revenue - m.profit;
        const margin = m.revenue > 0 ? ((m.profit / m.revenue) * 100).toFixed(2) + "%" : "0%";
        return {
          "Tháng": m.month,
          "Doanh thu (VND)": m.revenue,
          "Giá vốn (VND)": cost,
          "Lợi nhuận (VND)": m.profit,
          "Biên lợi nhuận (%)": margin
        };
      });
      const wsMonth = XLSX.utils.json_to_sheet(monthDataExport);
      wsMonth['!cols'] = [{ wch: 15 }, { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 20 }];
      XLSX.utils.book_append_sheet(wb, wsMonth, "Theo_Thang");

      // 3. Sheet: Phân tích theo Quý
      const quarterDataExport = quarterlyTrendData.map(q => {
        const cost = q.revenue - q.profit;
        const margin = q.revenue > 0 ? ((q.profit / q.revenue) * 100).toFixed(2) + "%" : "0%";
        return {
          "Quý": q.name,
          "Doanh thu (VND)": q.revenue,
          "Giá vốn (VND)": cost,
          "Lợi nhuận (VND)": q.profit,
          "Biên lợi nhuận (%)": margin,
          "Sản lượng giao": q.volume,
          "Số lượt giao": q.orders
        };
      });
      const wsQuarter = XLSX.utils.json_to_sheet(quarterDataExport);
      wsQuarter['!cols'] = [{ wch: 20 }, { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 20 }, { wch: 18 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(wb, wsQuarter, "Theo_Quy");

      // 4. Sheet: Phân tích theo Nhóm hàng
      const categoryDataExport = categoryStatsAll.map(c => {
        const cost = c.revenue - c.profit;
        const margin = c.revenue > 0 ? ((c.profit / c.revenue) * 100).toFixed(2) + "%" : "0%";
        const revShare = totalRevenue > 0 ? ((c.revenue / totalRevenue) * 100).toFixed(2) + "%" : "0%";
        return {
          "Nhóm hàng": c.name,
          "Doanh thu (VND)": c.revenue,
          "Giá vốn (VND)": cost,
          "Lợi nhuận (VND)": c.profit,
          "Biên lợi nhuận (%)": margin,
          "Tỷ trọng doanh thu (%)": revShare,
          "Sản lượng giao": c.volume
        };
      });
      const wsCategory = XLSX.utils.json_to_sheet(categoryDataExport);
      wsCategory['!cols'] = [{ wch: 28 }, { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 20 }, { wch: 22 }, { wch: 18 }];
      XLSX.utils.book_append_sheet(wb, wsCategory, "Theo_Nhom_Hang");

      // 5. Sheet: Phân tích theo Nhà cung cấp
      const supplierDataExport = supplierStatsAll.map(s => {
        const cost = s.revenue - s.profit;
        const margin = s.revenue > 0 ? ((s.profit / s.revenue) * 100).toFixed(2) + "%" : "0%";
        return {
          "Nhà cung cấp": s.name,
          "Doanh thu bán hàng (VND)": s.revenue,
          "Giá vốn / Giá mua (VND)": cost,
          "Lợi nhuận mang lại (VND)": s.profit,
          "Biên lợi nhuận (%)": margin,
          "Sản lượng giao": s.volume,
          "Số vụ sự cố": s.incidents || 0
        };
      });
      const wsSupplier = XLSX.utils.json_to_sheet(supplierDataExport);
      wsSupplier['!cols'] = [{ wch: 32 }, { wch: 24 }, { wch: 24 }, { wch: 24 }, { wch: 20 }, { wch: 18 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(wb, wsSupplier, "Theo_Nha_Cung_Cap");

      // 6. Sheet: Phân tích theo Khách hàng
      const customerDataExport = customerStatsAll.map(cust => {
        const cost = cust.revenue - cust.profit;
        const margin = cust.revenue > 0 ? ((cust.profit / cust.revenue) * 100).toFixed(2) + "%" : "0%";
        const revShare = totalRevenue > 0 ? ((cust.revenue / totalRevenue) * 100).toFixed(2) + "%" : "0%";
        return {
          "Khách hàng": cust.name,
          "Doanh thu (VND)": cust.revenue,
          "Giá vốn (VND)": cost,
          "Lợi nhuận (VND)": cust.profit,
          "Biên lợi nhuận (%)": margin,
          "Tỷ trọng doanh thu (%)": revShare,
          "Sản lượng giao": cust.volume
        };
      });
      const wsCustomer = XLSX.utils.json_to_sheet(customerDataExport);
      wsCustomer['!cols'] = [{ wch: 32 }, { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 20 }, { wch: 22 }, { wch: 18 }];
      XLSX.utils.book_append_sheet(wb, wsCustomer, "Theo_Khach_Hang");

      // 7. Sheet: Chi tiết Giao dịch
      const exportDetail = filteredDelivery.map(d => ({
        "Ngày giao": d["Ngày giao"] || "",
        "Số PXK": d["Số PXK"] || "",
        "Đơn hàng": d["Đơn hàng"] || "",
        "Tháng": d["Tháng"] || "",
        "Khách hàng": d["Khách hàng"] || "",
        "Nhà cung cấp": d["Nhà cung cấp"] || "",
        "Nhóm hàng": d["Nhóm hàng"] || d["Danh mục"] || "",
        "Tên sản phẩm": d["Tên sản phẩm"] || "",
        "ĐVT": d["ĐVT"] || "",
        "Số lượng giao": parseNumber(d["Số lượng giao"]),
        "Đơn giá bán": parseNumber(d["Đơn giá bán"]),
        "Doanh thu": parseNumber(d["Doanh thu"]),
        "Lợi nhuận gộp": parseNumber(d["Lợi nhuận gộp"] || d["Lợi nhuận dòng"]),
        "Biên LN (%)": d["% Lợi nhuận"] || "",
        "Trạng thái": d["Status"] || ""
      }));
      const wsDetail = XLSX.utils.json_to_sheet(exportDetail);
      wsDetail['!cols'] = [
        { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 10 }, { wch: 30 }, 
        { wch: 30 }, { wch: 20 }, { wch: 35 }, { wch: 10 }, { wch: 15 }, 
        { wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 12 }, { wch: 15 }
      ];
      XLSX.utils.book_append_sheet(wb, wsDetail, "Chi_Tiet_Giao_Dich");

      // Write workbook file
      const fileName = `Bao_Cao_Tong_Hop_Kinh_Doanh_${dateStr}.xlsx`;
      XLSX.writeFile(wb, fileName);
      
      toast.success(`Đã xuất Báo cáo Excel Tổng hợp (${filteredDelivery.length} giao dịch) thành công!`);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Lỗi khi xuất báo cáo!");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPDF = () => {
    toast.success("Đang mở hộp thoại in. Vui lòng chọn 'Lưu dưới dạng PDF' (Save as PDF) với Layout là 'Landscape' (Hướng ngang).", { id: "pdf-export", duration: 6000 });
    setTimeout(() => {
      window.print();
    }, 800);
  };

  // Trích xuất danh sách Nhóm hàng duy nhất
  const categories = useMemo(() => {
    const set = new Set<string>();
    deliveryData.forEach(d => {
      const cat = d["Nhóm hàng"] || d["Danh mục"];
      if (cat) {
        set.add(String(cat).trim());
      }
    });
    return Array.from(set).filter(Boolean).sort();
  }, [deliveryData]);

  // Lọc dữ liệu theo thời gian & Nhóm hàng
  const filteredDelivery = useMemo(() => {
    return deliveryData.filter(d => {
      let matchesTime = true;
      if (timeFilter !== "all") {
        const month = parseInt(d["Tháng"]);
        if (!isNaN(month)) {
          if (timeFilter === "q1") matchesTime = month >= 1 && month <= 3;
          else if (timeFilter === "q2") matchesTime = month >= 4 && month <= 6;
          else if (timeFilter === "q3") matchesTime = month >= 7 && month <= 9;
          else if (timeFilter === "q4") matchesTime = month >= 10 && month <= 12;
          else if (timeFilter.startsWith("m")) matchesTime = month === parseInt(timeFilter.replace("m", ""));
        }
      }

      let matchesCategory = true;
      if (categoryFilter !== "all") {
        const cat = d["Nhóm hàng"] || d["Danh mục"] || "Khác";
        matchesCategory = String(cat).trim() === categoryFilter;
      }

      return matchesTime && matchesCategory;
    });
  }, [deliveryData, timeFilter, categoryFilter]);

  // Lọc PO Headers theo Nhóm hàng được chọn nếu có
  const filteredPoData = useMemo(() => {
    if (categoryFilter === "all") return poData;
    const matchingPoNumbers = new Set(
      poLinesData
        .filter(line => {
          const cat = line["Nhóm hàng"] || line["Danh mục"] || "Khác";
          return String(cat).trim() === categoryFilter;
        })
        .map(line => line["Số đơn hàng"])
    );
    return poData.filter(po => matchingPoNumbers.has(po["Số PO"]));
  }, [poData, poLinesData, categoryFilter]);

  // Quick metrics calculations
  const totalOrders = filteredPoData.length;
  
  const totalRevenue = useMemo(() => {
    return filteredDelivery.reduce((acc, curr) => acc + parseNumber(curr["Doanh thu"]), 0);
  }, [filteredDelivery]);

  const totalProfit = useMemo(() => {
    return filteredDelivery.reduce((acc, curr) => {
      const val = parseNumber(curr["Lợi nhuận gộp"] || curr["Lợi nhuận dòng"]);
      return acc + val;
    }, 0);
  }, [filteredDelivery]);

  const executiveInsights = useMemo(() => {
    // 1. Projected Revenue from remaining quantities in PO Lines
    const projectedRev = poLinesData.reduce((acc, line) => {
      if (line.isDeleted) return acc;
      const qtyOrdered = parseNumber(line['Số lượng']);
      const associatedDeliveries = deliveryData.filter(d => !d.isDeleted && d['Chi tiết đơn hàng'] === line['STT']);
      const totalDelivered = associatedDeliveries.reduce((sum, d) => sum + parseNumber(d['Số lượng giao']), 0);
      const remaining = Math.max(0, qtyOrdered - totalDelivered);
      const sellPrice = parseNumber(line['Đơn giá bán']);
      return acc + (remaining * sellPrice);
    }, 0);

    // 2. Critical Delays (Past due date and not fully delivered)
    const today = new Date();
    const delayedPOs = poLinesData.filter(line => {
      if (line.isDeleted) return false;
      const dueDateStr = line['Thời hạn giao hàng'] || line['Ngày giao hàng'];
      if (!dueDateStr) return false;
      
      const dueDate = new Date(dueDateStr);
      if (isNaN(dueDate.getTime())) return false;
      
      const qtyOrdered = parseNumber(line['Số lượng']);
      const associatedDeliveries = deliveryData.filter(d => !d.isDeleted && d['Chi tiết đơn hàng'] === line['STT']);
      const totalDelivered = associatedDeliveries.reduce((sum, d) => sum + parseNumber(d['Số lượng giao']), 0);
      
      return dueDate < today && totalDelivered < qtyOrdered;
    }).length;

    // 3. Margin Risk Analysis
    const lowMarginItems = filteredDelivery.filter(d => {
      const rev = parseNumber(d["Doanh thu"]);
      const prof = parseNumber(d["Lợi nhuận gộp"]);
      return rev > 0 && (prof / rev) < 0.15; // Under 15%
    }).length;

    return {
      projectedRev,
      delayedPOs,
      lowMarginItems
    };
  }, [poLinesData, deliveryData, filteredDelivery]);

  // --- STATS BY CUSTOMER (ALL & TOP) ---
  const customerStatsAll = useMemo(() => {
    const map = new Map<string, {name: string, revenue: number, profit: number, volume: number}>();
    filteredDelivery.forEach(d => {
       const customer = d["Khách hàng"] || "Khác";
       const rev = parseNumber(d["Doanh thu"]);
       const prof = parseNumber(d["Lợi nhuận gộp"] || d["Lợi nhuận dòng"]);
       const vol = parseNumber(d["Số lượng giao"]);
       
       if (!map.has(customer)) map.set(customer, { name: customer, revenue: 0, profit: 0, volume: 0 });
       const item = map.get(customer)!;
       item.revenue += rev;
       item.profit += prof;
       item.volume += vol;
    });
    return Array.from(map.values()).sort((a,b) => b.revenue - a.revenue);
  }, [filteredDelivery]);

  const customerStats = useMemo(() => {
    return customerStatsAll.slice(0, 5);
  }, [customerStatsAll]);

  // --- BUSINESS ANALYSIS METRICS ---
  const businessMetrics = useMemo(() => {
    // 1. Customer Concentration (Revenue of top customer / Total Revenue)
    const topCustomerRevenue = customerStatsAll.length > 0 ? customerStatsAll[0].revenue : 0;
    const concentrationIndex = totalRevenue > 0 ? (topCustomerRevenue / totalRevenue) * 100 : 0;

    // 2. Average Order Value (AOV)
    const aov = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // 3. Supplier Incident Rate
    const supplierIncidents = new Map<string, number>();
    deliveryData.forEach(d => {
      if (!d.isDeleted && (d["Sự cố"] === "1" || d["Sự cố"] === 1 || (d["Chi tiết sự cố"] && String(d["Chi tiết sự cố"]).trim() !== "" && String(d["Chi tiết sự cố"]).trim() !== "0"))) {
        const s = d["Nhà cung cấp"] || "Khác";
        supplierIncidents.set(s, (supplierIncidents.get(s) || 0) + 1);
      }
    });

    const mostUnreliableSupplier = Array.from(supplierIncidents.entries())
      .sort((a,b) => b[1] - a[1])[0];

    return {
      concentrationIndex,
      aov,
      mostUnreliableSupplier
    };
  }, [customerStatsAll, totalRevenue, totalOrders, deliveryData]);

  const completedDeliveries = useMemo(() => {
    return filteredDelivery.filter(d => d["Status"] === "Hoàn thành").length;
  }, [filteredDelivery]);

  const inProgressDeliveries = useMemo(() => {
    return filteredDelivery.filter(d => d["Status"] !== "Hoàn thành").length;
  }, [filteredDelivery]);

  // --- OVERALL ORDER LIFECYCLE ---
  const overallPoLifecycle = useMemo(() => {
    let newPos = 0;
    let processing = 0;
    let delivering = 0;
    let completed = 0;

    filteredPoData.forEach(po => {
      if (po.isDeleted) return;
      const poNum = po['Số PO'] || po['Đơn hàng'];
      if (!poNum) return;

      const relatedLines = poLinesData.filter(l => !l.isDeleted && (l['Số đơn hàng'] === poNum || l['Đơn hàng'] === poNum));
      const relatedDeliveries = deliveryData.filter(d => !d.isDeleted && (d['Đơn hàng'] === poNum || d['Số PXK'] === poNum));

      let totalOrderedQty = 0;
      let totalDeliveredQty = 0;

      relatedLines.forEach(l => {
         totalOrderedQty += parseNumber(l['Số lượng'] || 0);
      });

      relatedDeliveries.forEach(d => {
         totalDeliveredQty += parseNumber(d['Số lượng giao'] || 0);
      });

      if (po['Trạng Thái'] === 'Hoàn thành' || po['Status'] === 'Hoàn thành' || (totalOrderedQty > 0 && totalDeliveredQty >= totalOrderedQty)) {
        completed++;
      } else if (totalDeliveredQty > 0) {
        delivering++;
      } else if (relatedLines.length > 0) {
        processing++;
      } else {
        newPos++;
      }
    });

    return { newPos, processing, delivering, completed, total: newPos + processing + delivering + completed };
  }, [filteredPoData, poLinesData, deliveryData]);

  // --- STATS BY CATEGORY ---
  const categoryStatsAll = useMemo(() => {
    const map = new Map<string, {name: string, revenue: number, profit: number, volume: number}>();
    filteredDelivery.forEach(d => {
       const category = d["Nhóm hàng"] || d["Danh mục"] || "Khác";
       const rev = parseNumber(d["Doanh thu"]);
       const prof = parseNumber(d["Lợi nhuận gộp"] || d["Lợi nhuận dòng"]);
       const vol = parseNumber(d["Số lượng giao"]);
       
       if (!map.has(category)) map.set(category, { name: category, revenue: 0, profit: 0, volume: 0 });
       const item = map.get(category)!;
       item.revenue += rev;
       item.profit += prof;
       item.volume += vol;
    });
    return Array.from(map.values()).sort((a,b) => b.revenue - a.revenue);
  }, [filteredDelivery]);

  const categoryStats = useMemo(() => categoryStatsAll, [categoryStatsAll]);

  // --- STATS BY SUPPLIER (ALL & TOP) ---
  const supplierStatsAll = useMemo(() => {
    const map = new Map<string, {name: string, revenue: number, profit: number, volume: number, incidents: number}>();
    filteredDelivery.forEach(d => {
       const supplier = d["Nhà cung cấp"] || "Khác";
       const rev = parseNumber(d["Doanh thu"]);
       const prof = parseNumber(d["Lợi nhuận gộp"] || d["Lợi nhuận dòng"]);
       const vol = parseNumber(d["Số lượng giao"]);
       const hasIncident = d["Sự cố"] === "1" || d["Sự cố"] === 1 || (d["Chi tiết sự cố"] && String(d["Chi tiết sự cố"]).trim() !== "" && String(d["Chi tiết sự cố"]).trim() !== "0");
       
       if (!map.has(supplier)) map.set(supplier, { name: supplier, revenue: 0, profit: 0, volume: 0, incidents: 0 });
       const item = map.get(supplier)!;
       item.revenue += rev;
       item.profit += prof;
       item.volume += vol;
       if (hasIncident) item.incidents += 1;
    });
    return Array.from(map.values()).sort((a,b) => b.revenue - a.revenue);
  }, [filteredDelivery]);

  const supplierStats = useMemo(() => {
    return supplierStatsAll.slice(0, 5);
  }, [supplierStatsAll]);

  // Helper function for safe month extraction
  const safeExtractMonth = (d: any): number => {
    if (d["Tháng"]) {
      const m = parseInt(String(d["Tháng"]));
      if (!isNaN(m) && m >= 1 && m <= 12) return m;
    }
    const dateStr = d["Ngày giao"] || d["Ngày xuất kho"] || d["Ngày"] || d["Date"] || d["paymentDate"] || d["period"] || "";
    if (dateStr) {
      const str = String(dateStr).trim();
      if (/^\d{4}-\d{2}/.test(str)) {
        const m = parseInt(str.substring(5, 7));
        if (!isNaN(m) && m >= 1 && m <= 12) return m;
      }
      const parts = str.split(/[-/]/);
      if (parts.length >= 2) {
        if (parts[0].length === 4) {
          const m = parseInt(parts[1]);
          if (!isNaN(m) && m >= 1 && m <= 12) return m;
        } else {
          const m = parseInt(parts[1]);
          if (!isNaN(m) && m >= 1 && m <= 12) return m;
        }
      }
    }
    return 1;
  };

  // Commission Totals & Monthly Map
  const totalCommission = useMemo(() => {
    return (commissionData || []).reduce((acc: number, curr: any) => acc + parseNumber(curr.commissionAmount || 0), 0);
  }, [commissionData]);

  const totalNetProfit = useMemo(() => {
    return totalProfit - totalCommission;
  }, [totalProfit, totalCommission]);

  const monthlyCommissionMap = useMemo(() => {
    const map = new Map<number, number>();
    (commissionData || []).forEach((c: any) => {
      let m = 1;
      if (c.period) {
        const parts = String(c.period).split(/[-/]/);
        m = parseInt(parts[parts.length - 1]) || 1;
      } else if (c.paymentDate) {
        m = safeExtractMonth({ paymentDate: c.paymentDate });
      }
      const amt = parseNumber(c.commissionAmount || 0);
      map.set(m, (map.get(m) || 0) + amt);
    });
    return map;
  }, [commissionData]);

  const commissionCustomerStats = useMemo(() => {
    const map = new Map<string, { name: string, commission: number, count: number }>();
    (commissionData || []).forEach((c: any) => {
      const cust = c.customerName || 'Khác';
      const amt = parseNumber(c.commissionAmount || 0);
      if (!map.has(cust)) map.set(cust, { name: cust, commission: 0, count: 0 });
      const item = map.get(cust)!;
      item.commission += amt;
      item.count += 1;
    });
    return Array.from(map.values()).sort((a,b) => b.commission - a.commission);
  }, [commissionData]);

  // --- STATS BY QUARTER (QUÝ 1 -> QUÝ 4) ---
  const quarterlyTrendData = useMemo(() => {
    const quarters = [
      { quarter: 'Quý 1', name: 'Quý 1 (T1 - T3)', revenue: 0, profit: 0, volume: 0, orders: 0 },
      { quarter: 'Quý 2', name: 'Quý 2 (T4 - T6)', revenue: 0, profit: 0, volume: 0, orders: 0 },
      { quarter: 'Quý 3', name: 'Quý 3 (T7 - T9)', revenue: 0, profit: 0, volume: 0, orders: 0 },
      { quarter: 'Quý 4', name: 'Quý 4 (T10 - T12)', revenue: 0, profit: 0, volume: 0, orders: 0 },
    ];

    filteredDelivery.forEach(d => {
      const month = safeExtractMonth(d);
      const qIndex = Math.floor((month - 1) / 3);
      if (qIndex >= 0 && qIndex < 4) {
        const rev = parseNumber(d["Doanh thu"]);
        const prof = parseNumber(d["Lợi nhuận gộp"] || d["Lợi nhuận dòng"]);
        const vol = parseNumber(d["Số lượng giao"]);

        quarters[qIndex].revenue += rev;
        quarters[qIndex].profit += prof;
        quarters[qIndex].volume += vol;
        quarters[qIndex].orders += 1;
      }
    });

    return quarters;
  }, [filteredDelivery]);

  // --- STATS BY PRODUCT (TOP ITEMS) ---
  const productStats = useMemo(() => {
    const map = new Map<string, {name: string, category: string, revenue: number, profit: number, volume: number}>();
    filteredDelivery.forEach(d => {
       const product = d["Tên sản phẩm"] || "Khác";
       const category = d["Nhóm hàng"] || d["Danh mục"] || "Khác";
       const rev = parseNumber(d["Doanh thu"]);
       const prof = parseNumber(d["Lợi nhuận gộp"] || d["Lợi nhuận dòng"]);
       const vol = parseNumber(d["Số lượng giao"]);
       
       if (!map.has(product)) map.set(product, { name: product, category, revenue: 0, profit: 0, volume: 0 });
       const item = map.get(product)!;
       item.revenue += rev;
       item.profit += prof;
       item.volume += vol;
    });
    return Array.from(map.values()).sort((a,b) => b.revenue - a.revenue).slice(0, 10);
  }, [filteredDelivery]);

  // Chart 2: Revenue, Gross Profit, Commission & Net Profit Trend by Month
  const monthlyTrendData = useMemo(() => {
    const map = new Map<number, {month: string, revenue: number, grossProfit: number, profit: number, commission: number, netProfit: number}>();
    filteredDelivery.forEach(d => {
       const month = safeExtractMonth(d);
       const rev = parseNumber(d["Doanh thu"]);
       const prof = parseNumber(d["Lợi nhuận gộp"] || d["Lợi nhuận dòng"]);
       const comm = monthlyCommissionMap.get(month) || 0;
       if (!map.has(month)) {
         map.set(month, { 
           month: `Tháng ${month}`, 
           revenue: 0, 
           grossProfit: 0,
           profit: 0, 
           commission: comm,
           netProfit: 0 
         });
       }
       const item = map.get(month)!;
       item.revenue += rev;
       item.grossProfit += prof;
       item.profit += prof;
       item.netProfit = item.grossProfit - item.commission;
    });

    // Ensure months with commissions are also included
    monthlyCommissionMap.forEach((comm, month) => {
      if (!map.has(month)) {
        map.set(month, {
          month: `Tháng ${month}`,
          revenue: 0,
          grossProfit: 0,
          profit: 0,
          commission: comm,
          netProfit: -comm
        });
      }
    });

    return Array.from(map.entries()).sort((a,b) => a[0] - b[0]).map(e => e[1]);
  }, [filteredDelivery, monthlyCommissionMap]);

  // Chart 2b: Completed Orders Revenue & Profit Trend by Month
  const completedMonthlyTrendData = useMemo(() => {
    const completedPoNumbers = new Set(
      poData
        .filter(po => {
          const st = (po["Trạng Thái"] || po["Trạng thái"] || po["Status"] || "").toLowerCase();
          return st.includes("hoàn thành") || st.includes("đã giao") || st.includes("đã duyệt") || st === "completed";
        })
        .map(po => (po["Đơn hàng"] || po["Số PO"] || "").toString().trim())
    );

    const map = new Map<number, {month: string, revenue: number, profit: number, commission: number, netProfit: number}>();
    deliveryData
      .filter(d => {
         const poNumber = (d["Đơn hàng"] || "").toString().trim();
         return completedPoNumbers.size === 0 || completedPoNumbers.has(poNumber) || d["Status"] === "Hoàn thành";
      })
      .forEach(d => {
         const month = safeExtractMonth(d);
         const rev = parseNumber(d["Doanh thu"]);
         const prof = parseNumber(d["Lợi nhuận gộp"] || d["Lợi nhuận dòng"]);
         const comm = monthlyCommissionMap.get(month) || 0;
         if (!map.has(month)) {
           map.set(month, { 
             month: `Tháng ${month}`, 
             revenue: 0, 
             profit: 0, 
             commission: comm,
             netProfit: 0 
           });
         }
         const item = map.get(month)!;
         item.revenue += rev;
         item.profit += prof;
         item.netProfit = item.profit - item.commission;
    });
    return Array.from(map.entries()).sort((a,b) => a[0] - b[0]).map(e => e[1]);
  }, [deliveryData, poData, monthlyCommissionMap]);

  // Chart 4: Delivery Status Breakdown
  const deliveryStatusData = useMemo(() => {
    const completed = filteredDelivery.filter(d => d["Status"] === "Hoàn thành").length;
    const inProgress = filteredDelivery.filter(d => d["Status"] === "Đang tiến hành").length;
    
    return [
      { name: 'Hoàn thành', value: completed, color: '#10b981' },
      { name: 'Đang xử lý', value: inProgress, color: '#3b82f6' },
      { name: 'Khác', value: filteredDelivery.length - completed - inProgress, color: '#f59e0b' }
    ].filter(d => d.value > 0);
  }, [filteredDelivery]);

  // --- WATERFALL DATA: PROFIT BRIDGE WITH COMMISSION ---
  const waterfallData = useMemo(() => {
    const totalRev = totalRevenue;
    const totalProf = totalProfit;
    const totalCost = Math.max(0, totalRev - totalProf);
    const totalComm = totalCommission;
    const netProf = totalProf - totalComm;

    return [
      { 
        name: 'Doanh thu (+)', 
        range: [0, totalRev], 
        display: totalRev,
        color: '#3b82f6' 
      },
      { 
        name: 'Giá vốn (-)', 
        range: [totalRev, Math.max(0, totalRev - totalCost)], 
        display: -totalCost,
        color: '#ef4444' 
      },
      { 
        name: 'LN Gộp (=)', 
        range: [0, totalProf], 
        display: totalProf,
        color: '#10b981' 
      },
      { 
        name: 'Hoa hồng (-)', 
        range: [totalProf, Math.max(0, totalProf - totalComm)], 
        display: -totalComm,
        color: '#a855f7' 
      },
      { 
        name: 'LN Ròng (=)', 
        range: [0, Math.max(0, netProf)], 
        display: netProf,
        color: '#059669' 
      },
    ];
  }, [totalRevenue, totalProfit, totalCommission]);

  // --- ADVANCED REVENUE TREND DATA ---
  const revenueGrowthData = useMemo(() => {
    let runningTotal = 0;
    return monthlyTrendData.map((d, i) => {
      runningTotal += d.revenue;
      const prevRevenue = i > 0 ? monthlyTrendData[i-1].revenue : 0;
      const growth = prevRevenue > 0 ? ((d.revenue - prevRevenue) / prevRevenue) * 100 : 0;
      return {
        ...d,
        cumulative: runningTotal,
        growth: parseFloat(growth.toFixed(1))
      };
    });
  }, [monthlyTrendData]);

  // --- DATA INSIGHTS ---
  const InsightBox = ({ title = "Phân tích dữ liệu", content }: { title?: string, content: React.ReactNode }) => (
    <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-3 print:break-inside-avoid">
      <div className="p-2 bg-white border border-slate-200 rounded-lg text-slate-600 shrink-0 shadow-sm">
        <TrendingUp size={16} />
      </div>
      <div>
        <h4 className="text-[13px] font-bold text-slate-800 mb-1 uppercase tracking-wide">{title}</h4>
        <p className="text-[13px] text-slate-600 leading-relaxed">{content}</p>
      </div>
    </div>
  );

  const completedTrendInsight = useMemo(() => {
    if (!completedMonthlyTrendData || completedMonthlyTrendData.length === 0) return "Chưa có đủ dữ liệu để phân tích.";
    const maxMonth = [...completedMonthlyTrendData].sort((a,b) => b.revenue - a.revenue)[0];
    const maxProfitMonth = [...completedMonthlyTrendData].sort((a,b) => b.profit - a.profit)[0];
    return (
      <>Tháng có doanh thu từ các đơn hàng hoàn thành cao nhất là <strong>{maxMonth.month}</strong> đạt <strong>{formatter.format(maxMonth.revenue)}</strong>. Lợi nhuận cao nhất rơi vào <strong>{maxProfitMonth.month}</strong> với <strong>{formatter.format(maxProfitMonth.profit)}</strong>. Cần duy trì hiệu suất giao hàng để đẩy nhanh tốc độ ghi nhận doanh thu.</>
    );
  }, [completedMonthlyTrendData]);

  const netProfitInsight = useMemo(() => {
    if (!monthlyTrendData || monthlyTrendData.length === 0) return "Chưa có đủ dữ liệu để phân tích.";
    const maxProfitMonth = [...monthlyTrendData].sort((a,b) => b.profit - a.profit)[0];
    const total = monthlyTrendData.reduce((acc, d) => acc + d.profit, 0);
    const monthsWithData = monthlyTrendData.filter(d => d.profit !== 0).length || 1;
    const avg = total / monthsWithData;
    return (
      <>Lợi nhuận ròng cao nhất vào <strong>{maxProfitMonth.month}</strong> ({formatter.format(maxProfitMonth.profit)}), trung bình đạt <strong>{formatter.format(avg)}</strong> mỗi tháng. Đồ thị cho thấy mức độ ổn định của lợi nhuận, cần theo dõi biến động chi phí đầu vào.</>
    );
  }, [monthlyTrendData]);

  const quarterlyInsight = useMemo(() => {
    if (!quarterlyTrendData || quarterlyTrendData.length === 0) return "Chưa có đủ dữ liệu.";
    const bestQ = [...quarterlyTrendData].sort((a,b) => b.revenue - a.revenue)[0];
    const totalQRev = quarterlyTrendData.reduce((acc, q) => acc + q.revenue, 0);
    const percent = totalQRev > 0 ? ((bestQ.revenue / totalQRev) * 100).toFixed(1) : 0;
    return (
      <>Quý đạt doanh thu cao nhất là <strong>{bestQ.name}</strong> đạt <strong>{formatter.format(bestQ.revenue)}</strong> (chiếm <strong>{percent}%</strong> tổng doanh thu). Lợi nhuận gộp trong quý đạt <strong>{formatter.format(bestQ.profit)}</strong> với <strong>{bestQ.orders}</strong> lượt giao hàng.</>
    );
  }, [quarterlyTrendData]);

  const categoryInsight = useMemo(() => {
    if (!categoryStats || categoryStats.length === 0) return "Chưa có đủ dữ liệu.";
    const topCat = categoryStats[0];
    return (
      <>Nhóm hàng <strong>{topCat.name}</strong> đang dẫn đầu, chiếm tỷ trọng cao nhất hệ thống. Đẩy mạnh các chính sách bán hàng cho nhóm này để tối ưu hóa biên lợi nhuận tổng thể.</>
    );
  }, [categoryStats]);
  
  const customerInsight = useMemo(() => {
    if (!customerStats || customerStats.length === 0) return "Chưa có đủ dữ liệu.";
    const topCust = customerStats[0];
    return (
      <>Khách hàng <strong>{topCust.name}</strong> mang lại doanh thu cao nhất ({formatter.format(topCust.revenue)}). Có thể áp dụng chương trình chiết khấu hoặc ưu đãi đặc biệt để giữ chân nhóm khách VIP.</>
    );
  }, [customerStats]);

  const supplierInsight = useMemo(() => {
    if (!supplierStats || supplierStats.length === 0) return "Chưa có đủ dữ liệu.";
    const topSup = supplierStats[0];
    return (
      <>Nhà cung cấp <strong>{topSup.name}</strong> đang chiếm tỷ trọng mua hàng lớn nhất. Cần thương lượng lại chính sách giá hoặc điều khoản thanh toán để cải thiện dòng tiền.</>
    );
  }, [supplierStats]);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  return (
    <div id="dashboard-content" className="flex-1 overflow-auto bg-gray-50/50 print:overflow-visible print:bg-white print:block">
      <div ref={dashboardRef} className="p-3 sm:p-5 lg:p-8 max-w-[1400px] mx-auto print:max-w-none print:p-0">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4 mb-5 sm:mb-8 bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm print:hidden">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Tổng quan Hoạt động</h2>
            <p className="text-xs text-slate-500 mt-0.5 sm:mt-1">Phân tích chuyên sâu sản lượng, doanh thu, lợi nhuận và tiến độ giao hàng</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Bộ lọc thời gian */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Filter size={14} />
              </div>
              <select 
                className="pl-8 pr-7 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 focus:ring-2 focus:ring-blue-500 outline-none appearance-none cursor-pointer transition-colors shadow-sm"
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value)}
              >
                <option value="all">Tất cả thời gian</option>
                <option value="q1">Quý 1</option>
                <option value="q2">Quý 2</option>
                <option value="q3">Quý 3</option>
                <option value="q4">Quý 4</option>
                <option value="m1">Tháng 1</option>
                <option value="m2">Tháng 2</option>
                <option value="m3">Tháng 3</option>
                <option value="m4">Tháng 4</option>
                <option value="m5">Tháng 5</option>
                <option value="m6">Tháng 6</option>
                <option value="m7">Tháng 7</option>
              </select>
            </div>

            {/* Bộ lọc Nhóm hàng */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Package size={14} />
              </div>
              <select 
                className="pl-8 pr-7 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 focus:ring-2 focus:ring-blue-500 outline-none appearance-none cursor-pointer transition-colors shadow-sm"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="all">Tất cả Nhóm hàng</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Dynamic Export & Report Dropdown Menu */}
            <div className="relative" ref={exportMenuRef}>
              <button
                onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all"
              >
                <Download size={15} />
                <span>Xuất dữ liệu & Báo cáo</span>
                <ChevronDown size={14} className={`transition-transform duration-200 ${isExportMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {isExportMenuOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200/80 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Tùy chọn xuất & Tự động hóa
                  </div>

                  <button
                    onClick={() => {
                      setIsSheetsModalOpen(true);
                      setIsExportMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2.5 hover:bg-emerald-50/80 flex items-start gap-3 transition-colors group"
                  >
                    <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700 group-hover:bg-emerald-200 transition-colors mt-0.5 shrink-0">
                      <FileSpreadsheet size={16} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        Đồng bộ Google Sheets
                        <span className="text-[9px] font-mono bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-bold">BI / Looker</span>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-tight mt-0.5">Xuất dữ liệu phẳng tự động cho Looker Studio & BigQuery</p>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      handleExportReport();
                      setIsExportMenuOpen(false);
                    }}
                    disabled={isExporting}
                    className="w-full text-left px-3 py-2.5 hover:bg-blue-50/80 flex items-start gap-3 transition-colors group disabled:opacity-50"
                  >
                    <div className="p-2 rounded-lg bg-blue-100 text-blue-700 group-hover:bg-blue-200 transition-colors mt-0.5 shrink-0">
                      {isExporting ? <RefreshCw size={16} className="animate-spin" /> : <Download size={16} />}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800">Xuất báo cáo Excel</div>
                      <p className="text-[11px] text-slate-500 leading-tight mt-0.5">Báo cáo tổng hợp doanh thu & lợi nhuận định dạng Excel</p>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      handleExportSlides();
                      setIsExportMenuOpen(false);
                    }}
                    disabled={isExportingSlides}
                    className="w-full text-left px-3 py-2.5 hover:bg-amber-50/80 flex items-start gap-3 transition-colors group disabled:opacity-50"
                  >
                    <div className="p-2 rounded-lg bg-amber-100 text-amber-700 group-hover:bg-amber-200 transition-colors mt-0.5 shrink-0">
                      {isExportingSlides ? <RefreshCw size={16} className="animate-spin" /> : <Presentation size={16} />}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800">Xuất Google Slides</div>
                      <p className="text-[11px] text-slate-500 leading-tight mt-0.5">Tự động tạo bài trình chiếu thuyết trình với biểu đồ</p>
                    </div>
                  </button>

                  <div className="my-1 border-t border-slate-100"></div>

                  <button
                    onClick={() => {
                      setIsPdfModalOpen(true);
                      setIsExportMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2.5 hover:bg-slate-50 flex items-start gap-3 transition-colors group"
                  >
                    <div className="p-2 rounded-lg bg-slate-100 text-slate-700 group-hover:bg-slate-200 transition-colors mt-0.5 shrink-0">
                      <Printer size={16} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800">Xuất Báo Cáo PDF</div>
                      <p className="text-[11px] text-slate-500 leading-tight mt-0.5">Xuất file PDF đồ họa chất lượng cao hoặc bảng biểu chi tiết</p>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bento Grid Executive Insights & KPI Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 sm:gap-5 mb-5 sm:mb-8">
          <div className="bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0F172A] rounded-2xl p-5 sm:p-6 text-white shadow-xl shadow-blue-500/10 backdrop-blur-md border border-blue-500/30 relative overflow-hidden group cockpit-card-hover">
            <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-blue-500/15 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500 pointer-events-none" />
            <div className="flex justify-between items-start mb-3 sm:mb-4 relative z-10">
              <div className="p-2.5 bg-blue-500/20 backdrop-blur-md rounded-xl border border-blue-400/30 text-blue-400">
                <TrendingUp size={20} />
              </div>
              <span className="text-[10px] font-mono font-bold bg-blue-500/20 text-blue-300 backdrop-blur-md px-2.5 py-0.5 rounded-full border border-blue-400/30 tracking-wider">
                DỰ BÁO DÒNG TIỀN
              </span>
            </div>
            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1 relative z-10 font-display">
              Doanh thu dự kiến (PO còn lại)
            </h3>
            <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-1.5 relative z-10 font-mono tabular-nums">
              {formatter.format(executiveInsights.projectedRev)}
            </div>
            <p className="text-[11px] text-slate-300/80 leading-relaxed relative z-10">
              Dựa trên khối lượng hàng chưa xuất kho trong các PO hiện hành
            </p>
          </div>

          <div className="bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0F172A] rounded-2xl p-5 sm:p-6 text-white shadow-xl shadow-amber-500/10 backdrop-blur-md border border-amber-500/30 relative overflow-hidden group cockpit-card-hover">
            <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-amber-500/15 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500 pointer-events-none" />
            <div className="flex justify-between items-start mb-3 sm:mb-4 relative z-10">
              <div className="p-2.5 bg-amber-500/20 backdrop-blur-md rounded-xl border border-amber-400/30 text-amber-400">
                <Clock size={20} />
              </div>
              <span className="text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 backdrop-blur-md px-2.5 py-0.5 rounded-full border border-amber-400/30 tracking-wider">
                TIẾN ĐỘ & UY TÍN
              </span>
            </div>
            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1 relative z-10 font-display">
              Đơn hàng chậm tiến độ
            </h3>
            <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-amber-400 mb-1.5 relative z-10 font-mono tabular-nums">
              {executiveInsights.delayedPOs} <span className="text-sm font-semibold text-slate-400">PO Line</span>
            </div>
            <p className="text-[11px] text-slate-300/80 leading-relaxed relative z-10">
              {executiveInsights.delayedPOs > 0 ? "Cảnh báo: Đã quá hạn giao nhưng chưa xuất kho đủ 100%" : "Tuyệt vời: Không có PO line nào bị quá hạn giao"}
            </p>
          </div>

          <div className="bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0F172A] rounded-2xl p-5 sm:p-6 text-white shadow-xl shadow-rose-500/10 backdrop-blur-md border border-rose-500/30 relative overflow-hidden group cockpit-card-hover sm:col-span-2 md:col-span-1">
            <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-rose-500/15 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500 pointer-events-none" />
            <div className="flex justify-between items-start mb-3 sm:mb-4 relative z-10">
              <div className="p-2.5 bg-rose-500/20 backdrop-blur-md rounded-xl border border-rose-400/30 text-rose-400">
                <ShieldAlert size={20} />
              </div>
              <span className="text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 backdrop-blur-md px-2.5 py-0.5 rounded-full border border-rose-400/30 tracking-wider">
                RỦI RO TÀI CHÍNH
              </span>
            </div>
            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1 relative z-10 font-display">
              Biên lợi nhuận thấp (&lt;15%)
            </h3>
            <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-rose-400 mb-1.5 relative z-10 font-mono tabular-nums">
              {executiveInsights.lowMarginItems} <span className="text-sm font-semibold text-slate-400">SKU</span>
            </div>
            <p className="text-[11px] text-slate-300/80 leading-relaxed relative z-10">
              {executiveInsights.lowMarginItems > 0 ? "Cần rà soát lại bảng giá NCC hoặc chính sách giá bán KH" : "Biên lợi nhuận tất cả sản phẩm đều đạt &gt; 15%"}
            </p>
          </div>
        </div>

        {/* 4-Phase PO Lifecycle Pipeline */}
        <div className="bg-white/90 backdrop-blur-md p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs mb-5 sm:mb-8 hover:border-blue-400/40 transition-all duration-300">
          <div className="flex items-center justify-between mb-5 sm:mb-7">
            <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2 font-display">
              <Activity className="text-emerald-500" size={18} /> Phân bổ Vòng đời Đơn hàng PO (Toàn hệ thống)
            </h3>
            <span className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full border border-slate-200">
              {overallPoLifecycle.total} Tổng PO
            </span>
          </div>

          <div className="relative overflow-x-auto mobile-scroll-x py-2">
            <div className="relative flex items-center justify-between min-w-[520px] px-4 md:px-12">
            {(() => {
              const steps = [
                { label: '1. Mới tạo', desc: 'Chờ xử lý', count: overallPoLifecycle.newPos, color: 'bg-slate-600', ring: 'ring-slate-100', dotColor: 'bg-slate-400' },
                { label: '2. Đang xử lý', desc: 'Đã lập KH', count: overallPoLifecycle.processing, color: 'bg-[#007AFF]', ring: 'ring-blue-100', dotColor: 'bg-blue-400' },
                { label: '3. Đang giao', desc: 'Giao theo đợt', count: overallPoLifecycle.delivering, color: 'bg-[#F59E0B]', ring: 'ring-amber-100', dotColor: 'bg-amber-400' },
                { label: '4. Hoàn thành', desc: 'Khớp 100%', count: overallPoLifecycle.completed, color: 'bg-[#10B981]', ring: 'ring-emerald-100', dotColor: 'bg-emerald-400' }
              ];
              const total = overallPoLifecycle.total || 1;

              return (
                <>
                  <div className="absolute left-[10%] right-[10%] top-5 h-1.5 bg-slate-100 rounded-full z-0"></div>
                  
                  {steps.map((step, idx) => {
                    const percent = Math.round((step.count / total) * 100);
                    return (
                      <div key={step.label} className="relative z-10 flex flex-col items-center gap-2.5 w-1/4 group cursor-pointer">
                        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-extrabold text-sm text-white ring-8 shadow-md transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg ${step.color} ${step.ring}`}>
                          {idx + 1}
                        </div>
                        <div className="text-center">
                          <div className="text-xs font-bold text-slate-800">{step.label}</div>
                          <div className="text-xl font-extrabold text-slate-900 font-mono tabular-nums mt-0.5">
                            {step.count} <span className="text-xs font-medium text-slate-500">đơn</span>
                          </div>
                          <div className="text-[10.5px] font-bold font-mono text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full inline-block mt-1 border border-slate-200">
                            {percent}%
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </>
              );
            })()}
            </div>
          </div>
        </div>

        {/* Bento Grid Top 4 Executive KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-5 mb-5 sm:mb-8">
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs relative overflow-hidden group cockpit-card-hover">
             <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 group-hover:scale-110 transition-all duration-300 pointer-events-none">
                <DollarSign size={72} className="text-blue-600" />
             </div>
             <div className="flex items-center gap-3 mb-3 relative z-10">
               <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shadow-2xs">
                 <TrendingUp size={20} />
               </div>
               <div>
                 <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider font-display">Tổng Doanh Thu</h3>
                 <span className="text-[10.5px] text-blue-600 font-medium">Xuất kho thực tế</span>
               </div>
             </div>
             <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-1 relative z-10 tracking-tight font-mono tabular-nums">
               {formatter.format(totalRevenue)}
             </p>
             <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 relative z-10">
                <Activity size={13} /> <span>Tăng trưởng dương • {filteredDelivery.length} chuyến</span>
             </div>
          </div>
          
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs relative overflow-hidden group cockpit-card-hover">
             <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 group-hover:scale-110 transition-all duration-300 pointer-events-none">
                <Activity size={72} className="text-emerald-600" />
             </div>
             <div className="flex items-center gap-3 mb-3 relative z-10">
               <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shadow-2xs">
                 <DollarSign size={20} />
               </div>
               <div>
                 <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider font-display">Tổng Lợi Nhuận Gộp</h3>
                 <span className="text-[10.5px] text-emerald-700 font-bold font-mono">
                   Biên LN: {totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : 0}%
                 </span>
               </div>
             </div>
             <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-1 relative z-10 tracking-tight font-mono tabular-nums">
               {formatter.format(totalProfit)}
             </p>
             
             {/* Commission Annotation Breakdown */}
             {(() => {
               const totalComm = (commissionData || []).reduce((acc: number, c: any) => acc + (parseFloat(String(c.commissionAmount || 0)) || 0), 0);
               const netProfit = totalProfit - totalComm;
               return (
                 <div className="mt-2.5 pt-2 border-t border-slate-100 relative z-10 space-y-1">
                   <div className="flex items-center justify-between text-[11px] text-purple-700 font-semibold bg-purple-50/80 px-2 py-0.5 rounded">
                     <span>Hoa hồng đã chi:</span>
                     <span className="font-mono font-bold">-{formatter.format(totalComm)}</span>
                   </div>
                   <div className="flex items-center justify-between text-[11px] text-emerald-800 font-bold bg-emerald-50/90 px-2 py-0.5 rounded">
                     <span>LN ròng thực nhận:</span>
                     <span className="font-mono font-bold">{formatter.format(netProfit)}</span>
                   </div>
                 </div>
               );
             })()}
          </div>

          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs relative overflow-hidden group cockpit-card-hover">
             <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 group-hover:scale-110 transition-all duration-300 pointer-events-none">
                <FileText size={72} className="text-amber-500" />
             </div>
             <div className="flex items-center gap-3 mb-3 relative z-10">
               <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center shadow-2xs">
                 <Package size={20} />
               </div>
               <div>
                 <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider font-display">Tổng Đơn Hàng PO</h3>
                 <span className="text-[10.5px] text-amber-700 font-medium">{poLinesData.length} dòng sản phẩm</span>
               </div>
             </div>
             <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-1 relative z-10 tracking-tight font-mono tabular-nums">
               {numFormatter.format(totalOrders)} <span className="text-base font-semibold text-slate-500">đơn</span>
             </p>
             <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 relative z-10">
                <span>Hệ thống PO Tâm Sen & AVP</span>
             </div>
          </div>

          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs relative overflow-hidden group cockpit-card-hover">
             <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 group-hover:scale-110 transition-all duration-300 pointer-events-none">
                <Truck size={72} className="text-purple-500" />
             </div>
             <div className="flex items-center gap-3 mb-3 relative z-10">
               <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center shadow-2xs">
                 <CheckCircle size={20} />
               </div>
               <div>
                 <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider font-display">Tỷ Lệ Hoàn Thành</h3>
                 <span className="text-[10.5px] text-purple-700 font-medium">{completedDeliveries} chuyến hoàn tất</span>
               </div>
             </div>
             <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-1 relative z-10 tracking-tight font-mono tabular-nums">
               {filteredDelivery.length > 0 ? ((completedDeliveries / filteredDelivery.length) * 100).toFixed(1) : 0}%
             </p>
             <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 relative z-10">
                <span>Đúng hạn & đạt chuẩn QC</span>
             </div>
          </div>
        </div>

        {/* 🌟 EXECUTIVE OPERATIONAL COCKPIT: ACTIVITY FEED & DELIVERY ALERTS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Recent Delivery Activity Feed (2 Cols) */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-slate-900 flex items-center gap-2 text-sm font-display">
                  <Truck size={18} className="text-blue-600" /> Nhật Ký & Tiến Độ Giao Hàng Gần Nhất
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Theo dõi thời gian thực các phiếu xuất kho PXK và tiến độ hoàn thành</p>
              </div>
              <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                {filteredDelivery.length} PXK
              </span>
            </div>
            <div className="p-0 overflow-auto flex-1 max-h-[380px] mobile-scroll-x print:max-h-none">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#F8F9FA] text-slate-600 sticky top-0 border-b border-slate-200/80 font-bold uppercase tracking-wider text-[10.5px]">
                  <tr>
                    <th className="px-4 py-3">Mã Đơn / PXK</th>
                    <th className="px-4 py-3">Sản phẩm & Khách hàng</th>
                    <th className="px-4 py-3 min-w-[160px]">Tiến độ (Giao / Đặt)</th>
                    <th className="px-4 py-3 text-right">Doanh thu</th>
                    <th className="px-4 py-3 text-center">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredDelivery.slice(0, 15).map((d, i) => {
                    const currentDelivery = parseFloat(String(d["Số lượng giao"] || "0").replace(/,/g, '')) || 0;
                    const prevDelivered = parseFloat(String(d["Đã giao"] || "0").replace(/,/g, '')) || 0;
                    const orderTotal = parseFloat(String(d["Số lượng đặt"] || "0").replace(/,/g, '')) || 0;
                    const totalDelivered = currentDelivery + prevDelivered;
                    
                    const calculatedProgress = orderTotal > 0 ? (totalDelivered / orderTotal) * 100 : 0;
                    const isCompleted = d["Status"] === 'Hoàn thành' || calculatedProgress >= 100;
                    const deliveryId = d.id || d.ID || `${d["Số PXK"] || ''}-${d["Đơn hàng"] || ''}-${i}`;
                    
                    return (
                    <tr key={deliveryId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 font-mono">
                        <div className="font-bold text-slate-900">{d["Đơn hàng"]}</div>
                        <div className="text-[11px] text-slate-500">{d["Số PXK"] || "Chưa có PXK"}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-slate-900 font-semibold truncate max-w-[200px]" title={d["Tên sản phẩm"]}>
                          {d["Tên sản phẩm"]}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate max-w-[180px]">
                          KH: {d["Khách hàng"]}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                         <div className="flex flex-col gap-1">
                            <div className="flex justify-between text-[11px] font-mono">
                               <span className={isCompleted ? 'text-emerald-700 font-bold' : 'text-blue-600 font-bold'}>
                                 {calculatedProgress.toFixed(0)}%
                               </span>
                               <span className="text-slate-500 tabular-nums">
                                 {numFormatter.format(totalDelivered)} / {numFormatter.format(orderTotal)} {d["ĐVT"] || "sp"}
                                </span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all duration-300 ${isCompleted ? 'bg-emerald-500' : 'bg-blue-500'}`} 
                                style={{ width: `${Math.min(calculatedProgress, 100)}%` }}
                              />
                            </div>
                         </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold tabular-nums text-slate-900">
                        {formatter.format(parseNumber(d["Doanh thu"]))}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center justify-center px-2.5 py-0.5 text-[10px] font-extrabold rounded-full ${
                          isCompleted 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}>
                          {isCompleted ? 'Hoàn thành' : d["Status"] || 'Đang giao'}
                        </span>
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
          </div>

          {/* Operational Alerts & QC Section (1 Col) */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <h3 className="font-extrabold text-slate-900 flex items-center gap-2 text-sm font-display">
                <AlertTriangle size={18} className="text-amber-500" /> Cảnh Báo Điều Độ & Sự Cố QC
              </h3>
              <span className="text-xs font-bold text-slate-500">Live</span>
            </div>
            <div className="p-4 flex-1 flex flex-col gap-3 overflow-y-auto max-h-[380px]">
               {/* Delayed POs Alert */}
               {executiveInsights.delayedPOs > 0 && (
                 <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3.5 flex items-start gap-3">
                   <Clock className="text-amber-600 shrink-0 mt-0.5" size={18} />
                   <div className="text-xs">
                     <div className="font-bold text-amber-900">Có {executiveInsights.delayedPOs} PO Line quá hạn giao</div>
                     <p className="text-amber-700 mt-0.5 leading-snug">Chưa hoàn tất 100% sản lượng đặt hàng. Cần đôn đốc NCC và sắp xếp lịch giao bù.</p>
                   </div>
                 </div>
               )}

               {/* Low Margin Items Alert */}
               {executiveInsights.lowMarginItems > 0 && (
                 <div className="bg-rose-50/80 border border-rose-200 rounded-xl p-3.5 flex items-start gap-3">
                   <ShieldAlert className="text-rose-600 shrink-0 mt-0.5" size={18} />
                   <div className="text-xs">
                     <div className="font-bold text-rose-900">{executiveInsights.lowMarginItems} SKU có biên lãi &lt; 15%</div>
                     <p className="text-rose-700 mt-0.5 leading-snug">Cần kiểm tra đối chiếu lại đơn giá mua NCC An Việt Phát hoặc điều chỉnh giá bán.</p>
                   </div>
                 </div>
               )}

               {/* QC Incidents */}
               {filteredDelivery.filter(d => d["Sự cố"] && d["Sự cố"] !== "0" && String(d["Sự cố"]).trim() !== "").map((incident, idx) => (
                 <div key={idx} className="bg-red-50/80 border border-red-200 rounded-xl p-3.5 flex items-start gap-3">
                   <AlertTriangle className="text-red-600 shrink-0 mt-0.5" size={18} />
                   <div className="text-xs">
                     <div className="font-bold text-red-900">Sự cố PXK: {incident["Số PXK"] || incident["Đơn hàng"]}</div>
                     <p className="text-red-700 mt-0.5 leading-snug">{incident["Chi tiết sự cố"] || "Lỗi giao nhận phát sinh"}</p>
                     <div className="mt-2 text-[11px] text-red-800 font-medium">KH: {incident["Khách hàng"]}</div>
                   </div>
                 </div>
               ))}

               {executiveInsights.delayedPOs === 0 && executiveInsights.lowMarginItems === 0 && (
                 <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 flex flex-col items-center justify-center text-center h-full">
                   <CheckCircle size={36} className="text-emerald-500 mb-2" />
                   <h4 className="font-bold text-emerald-900 text-xs">Vận hành tối ưu 100%</h4>
                   <p className="text-[11px] text-emerald-700 mt-0.5">Không có cảnh báo trễ hạn hay sự cố chất lượng nào.</p>
                 </div>
               )}
            </div>
          </div>
        </div>

        {/* 11 STANDARDIZED RECHARTS CHARTS */}

        {/* Chart 1: Completed Orders Revenue & Profit Chart */}
        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
           <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
              <div>
                <h3 className="font-bold text-slate-900 flex items-center gap-2 text-sm sm:text-base font-display">
                  <BarChart3 size={18} className="text-blue-600 shrink-0" /> 1. Doanh thu, Lợi nhuận & Hoa hồng (Đơn hàng Hoàn thành)
                </h3>
                <p className="text-xs text-slate-500 mt-1">Tổng hợp doanh thu, lợi nhuận gộp, chi phí hoa hồng và LN ròng theo tháng</p>
              </div>
              <div className="text-xs font-mono font-bold px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg shrink-0 self-start sm:self-auto border border-blue-200/60">
                 COMPLETED ORDERS
              </div>
           </div>
           <div className="h-[280px] sm:h-[350px] w-full min-w-0">
             <ResponsiveContainer width="100%" height="100%" minHeight={250}>
               <ComposedChart data={completedMonthlyTrendData} margin={{ top: 10, right: 15, left: 15, bottom: 0 }}>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(226, 232, 240, 0.6)" />
                 <XAxis 
                    dataKey="month" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 11, fill: '#64748b' }} 
                    dy={10} 
                 />
                 <YAxis 
                    yAxisId="left"
                    width={45}
                    tickFormatter={(value) => `${(value / 1000000).toFixed(0)}M`} 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 11, fill: '#64748b' }}
                 />
                 <Tooltip 
                    content={<CustomChartTooltip isCurrency={true} />}
                    cursor={{ fill: 'rgba(241, 245, 249, 0.6)' }}
                 />
                 <Legend wrapperStyle={{ paddingTop: '15px', fontSize: '12px' }} />
                 <Bar yAxisId="left" dataKey="revenue" name="Doanh thu" fill={RECHARTS_PALETTE.blue} radius={[6, 6, 0, 0]} maxBarSize={45} />
                 <Bar yAxisId="left" dataKey="profit" name="Lợi nhuận gộp" fill={RECHARTS_PALETTE.emerald} radius={[6, 6, 0, 0]} maxBarSize={45} />
                 <Bar yAxisId="left" dataKey="commission" name="Chi phí hoa hồng" fill={RECHARTS_PALETTE.purple} radius={[6, 6, 0, 0]} maxBarSize={45} />
                 <Line yAxisId="left" type="monotone" dataKey="netProfit" name="LN ròng sau hoa hồng" stroke={RECHARTS_PALETTE.amber} strokeWidth={3} dot={{ r: 4, fill: '#fff', strokeWidth: 2 }} />
               </ComposedChart>
             </ResponsiveContainer>
           </div>
           <InsightBox content={completedTrendInsight} />
        </div>

        {/* Chart 2: Monthly Profit Analysis Bar Chart */}
        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
           <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
              <div>
                <h3 className="font-bold text-slate-900 flex items-center gap-2 text-sm sm:text-base font-display">
                  <BarChart3 size={18} className="text-emerald-600 shrink-0" /> 2. Phân tích Lợi Nhuận Gộp vs Hoa Hồng & LN Ròng Hàng Tháng
                </h3>
                <p className="text-xs text-slate-500 mt-1">So sánh lợi nhuận gộp, chi phí hoa hồng chiết khấu và lợi nhuận ròng thực nhận</p>
              </div>
              <div className="text-xs font-mono font-bold px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg shrink-0 self-start sm:self-auto border border-emerald-200/60">
                 NET PROFIT & COMMISSION
              </div>
           </div>
           <div className="h-[280px] sm:h-[350px] w-full min-w-0">
             <ResponsiveContainer width="100%" height="100%" minHeight={250}>
               <BarChart data={monthlyTrendData} margin={{ top: 10, right: 15, left: 15, bottom: 0 }}>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(226, 232, 240, 0.6)" />
                 <XAxis 
                    dataKey="month" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 11, fill: '#64748b', fontWeight: 500 }} 
                    dy={12} 
                 />
                 <YAxis 
                    width={45}
                    tickFormatter={(value) => `${(value / 1000000).toFixed(0)}M`} 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 11, fill: '#64748b' }}
                 />
                 <Tooltip 
                    content={<CustomChartTooltip isCurrency={true} />}
                    cursor={{ fill: 'rgba(241, 245, 249, 0.6)' }}
                 />
                 <Legend wrapperStyle={{ paddingTop: '15px', fontSize: '12px' }} />
                 <Bar 
                    dataKey="grossProfit" 
                    name="Lợi nhuận gộp" 
                    fill={RECHARTS_PALETTE.emerald} 
                    radius={[6, 6, 0, 0]} 
                    maxBarSize={45}
                 />
                 <Bar 
                    dataKey="commission" 
                    name="Chi phí hoa hồng" 
                    fill={RECHARTS_PALETTE.purple} 
                    radius={[6, 6, 0, 0]} 
                    maxBarSize={45}
                 />
                 <Bar 
                    dataKey="netProfit" 
                    name="Lợi nhuận ròng thực nhận" 
                    fill="#059669" 
                    radius={[6, 6, 0, 0]} 
                    maxBarSize={45}
                 />
               </BarChart>
             </ResponsiveContainer>
           </div>
           <InsightBox content={netProfitInsight} />
        </div>

        {/* Chart 3: PHÂN TÍCH TÌNH HÌNH KINH DOANH THEO QUÝ */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700 print:break-inside-avoid">
           <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-bold text-slate-900 flex items-center gap-2 font-display">
                  <BarChart3 size={18} className="text-purple-600" /> 3. Phân tích Tình hình Kinh doanh theo Quý (Quý 1 - Quý 4)
                </h3>
                <p className="text-xs text-slate-500 mt-1">So sánh doanh thu, lợi nhuận gộp và sản lượng giữa các quý trong năm</p>
              </div>
              <div className="text-xs font-mono font-bold px-3 py-1 bg-purple-50 text-purple-700 rounded-full border border-purple-200/60">
                 QUARTERLY ANALYSIS
              </div>
           </div>

           <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              <div className="lg:col-span-7 h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={quarterlyTrendData} margin={{ top: 10, right: 20, left: 20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(226, 232, 240, 0.6)" />
                    <XAxis 
                       dataKey="quarter" 
                       axisLine={false} 
                       tickLine={false} 
                       tick={{ fontSize: 12, fill: '#475569', fontWeight: 600 }} 
                       dy={8} 
                    />
                    <YAxis 
                       width={50}
                       tickFormatter={(value) => `${(value / 1000000).toFixed(0)}M`} 
                       axisLine={false} 
                       tickLine={false} 
                       tick={{ fontSize: 11, fill: '#64748b' }}
                    />
                    <Tooltip 
                       content={<CustomChartTooltip isCurrency={true} />}
                       cursor={{ fill: 'rgba(241, 245, 249, 0.6)' }}
                    />
                    <Legend wrapperStyle={{ paddingTop: '16px' }} />
                    <Bar dataKey="revenue" name="Doanh thu" fill={RECHARTS_PALETTE.indigo} radius={[6, 6, 0, 0]} maxBarSize={50} />
                    <Bar dataKey="profit" name="Lợi nhuận gộp" fill={RECHARTS_PALETTE.emerald} radius={[6, 6, 0, 0]} maxBarSize={50} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="lg:col-span-5 overflow-x-auto">
                <table className="w-full text-xs text-left border border-slate-100 rounded-xl overflow-hidden shadow-2xs">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-100 font-bold uppercase tracking-wider text-[10.5px]">
                    <tr>
                      <th className="px-3 py-2.5">Quý</th>
                      <th className="px-3 py-2.5 text-right">Doanh thu</th>
                      <th className="px-3 py-2.5 text-right">Lợi nhuận</th>
                      <th className="px-3 py-2.5 text-right">Biên LN</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {quarterlyTrendData.map((q) => {
                      const marginPct = q.revenue > 0 ? ((q.profit / q.revenue) * 100).toFixed(1) : '0';
                      return (
                        <tr key={q.quarter} className="hover:bg-purple-50/20 transition-colors">
                          <td className="px-3 py-2.5 font-bold text-slate-800">{q.name}</td>
                          <td className="px-3 py-2.5 text-right font-mono font-medium text-slate-700 tabular-nums">{formatter.format(q.revenue)}</td>
                          <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-600 tabular-nums">{formatter.format(q.profit)}</td>
                          <td className="px-3 py-2.5 text-right font-mono font-bold text-purple-600 tabular-nums">{marginPct}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
           </div>

           <InsightBox title="Phân tích tình hình kinh doanh theo Quý" content={quarterlyInsight} />
        </div>

        {/* Section 4: MẶT HÀNG BEST SELLER */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs mb-8 overflow-hidden print:overflow-visible">
           <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <h3 className="font-extrabold text-slate-900 flex items-center gap-2 font-display">
                <Star size={18} className="text-amber-500" /> 4. Top 10 Mặt hàng mang lại Doanh thu & Sản lượng tốt nhất
              </h3>
              <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                BEST SELLERS
              </span>
           </div>
           <div className="overflow-x-auto print:overflow-visible">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#F8F9FA] text-slate-600 border-b border-slate-200/80 font-bold uppercase tracking-wider text-[10.5px]">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Tên sản phẩm</th>
                    <th className="px-5 py-3 font-semibold">Nhóm hàng</th>
                    <th className="px-5 py-3 font-semibold text-right">Sản lượng (đã giao)</th>
                    <th className="px-5 py-3 font-semibold text-right">Doanh thu</th>
                    <th className="px-5 py-3 font-semibold text-right">Lợi nhuận</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {productStats.map((p, i) => (
                    <tr key={p.name} className="hover:bg-amber-50/30 transition-colors">
                       <td className="px-5 py-3.5 font-medium text-slate-900">
                          <div className="flex items-center gap-3">
                             <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold font-mono ${
                               i === 0 ? 'bg-amber-100 text-amber-800 ring-2 ring-amber-300' :
                               i === 1 ? 'bg-slate-200 text-slate-700 ring-2 ring-slate-300' :
                               i === 2 ? 'bg-orange-100 text-orange-800 ring-2 ring-orange-300' :
                               'bg-slate-100 text-slate-600'
                             }`}>
                               {i + 1}
                             </span>
                             <span className="font-semibold text-slate-900">{p.name}</span>
                          </div>
                       </td>
                       <td className="px-5 py-3.5 text-slate-600">
                         <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium">
                           {p.category}
                         </span>
                       </td>
                       <td className="px-5 py-3.5 text-right font-mono font-medium text-slate-900 tabular-nums">{numFormatter.format(p.volume)}</td>
                       <td className="px-5 py-3.5 text-right font-mono font-bold text-blue-600 tabular-nums">{formatter.format(p.revenue)}</td>
                       <td className="px-5 py-3.5 text-right font-mono font-bold text-emerald-600 tabular-nums">{formatter.format(p.profit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
           </div>
        </div>

        {/* Charts Row 1: Trend & Category (Charts 5 & 6) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
           {/* Chart 5: Trend Lines */}
           <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden print:break-inside-avoid">
             <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
                <div>
                  <h3 className="font-bold text-slate-900 flex items-center gap-2 text-sm sm:text-base font-display">
                    <TrendingUp size={18} className="text-blue-600 shrink-0" /> 5. Xu hướng Doanh thu, Lợi nhuận & Hoa hồng
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">Theo dõi 4 chỉ số tài chính chủ chốt qua từng tháng</p>
                </div>
             </div>
             <div className="h-[280px] sm:h-[350px] w-full min-w-0">
               <ResponsiveContainer width="100%" height="100%" minHeight={250}>
                 <LineChart data={monthlyTrendData} margin={{ top: 10, right: 15, left: 15, bottom: 0 }}>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(226, 232, 240, 0.6)" />
                   <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} dy={10} />
                   <YAxis 
                      yAxisId="left"
                      width={45}
                      tickFormatter={(value) => `${(value / 1000000).toFixed(0)}M`} 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 11, fill: '#64748b' }}
                   />
                   <Tooltip content={<CustomChartTooltip isCurrency={true} />} />
                   <Legend wrapperStyle={{ paddingTop: '15px', fontSize: '12px' }} />
                   <Line yAxisId="left" type="monotone" dataKey="revenue" name="Doanh thu" stroke={RECHARTS_PALETTE.blue} strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6 }} />
                   <Line yAxisId="left" type="monotone" dataKey="grossProfit" name="LN Gộp" stroke={RECHARTS_PALETTE.emerald} strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6 }} />
                   <Line yAxisId="left" type="monotone" dataKey="commission" name="Hoa hồng" stroke={RECHARTS_PALETTE.purple} strokeWidth={2} strokeDasharray="4 4" dot={{ r: 3 }} />
                   <Line yAxisId="left" type="monotone" dataKey="netProfit" name="LN Ròng" stroke={RECHARTS_PALETTE.amber} strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6 }} />
                 </LineChart>
               </ResponsiveContainer>
             </div>
           </div>

           {/* Chart 6: Category Breakdown Donut */}
           <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden print:break-inside-avoid">
             <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-slate-900 flex items-center gap-2 text-sm sm:text-base font-display">
                  <PieChartIcon size={18} className="text-blue-600 shrink-0" /> 6. Cơ cấu Doanh thu theo Nhóm hàng
                </h3>
             </div>
             <div className="h-[280px] sm:h-[350px] w-full min-w-0">
               <ResponsiveContainer width="100%" height="100%" minHeight={250}>
                 <PieChart>
                   <Pie
                     data={categoryStats}
                     cx="50%"
                     cy="50%"
                     innerRadius={65}
                     outerRadius={95}
                     paddingAngle={4}
                     dataKey="revenue"
                     label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                     labelLine={false}
                   >
                     {categoryStats.map((entry, index) => (
                       <Cell key={`cell-${index}`} fill={RECHARTS_PALETTE.colors[index % RECHARTS_PALETTE.colors.length]} />
                     ))}
                   </Pie>
                   <Tooltip content={<CustomChartTooltip isCurrency={true} />} />
                   <Legend wrapperStyle={{ paddingTop: '15px', fontSize: '12px' }} />
                 </PieChart>
               </ResponsiveContainer>
             </div>
             <InsightBox content={categoryInsight} />
           </div>
        </div>

        {/* Charts Row 2: Customer & Supplier (Charts 7 & 8) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
           {/* Chart 7: Top Customers */}
           <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden print:break-inside-avoid">
             <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-slate-900 flex items-center gap-2 text-sm sm:text-base font-display">
                  <Users size={18} className="text-blue-600 shrink-0" /> 7. Top Khách hàng theo Doanh thu & Lợi nhuận
                </h3>
             </div>
             <div className="h-[280px] sm:h-[350px] w-full min-w-0">
               <ResponsiveContainer width="100%" height="100%" minHeight={250}>
                 <BarChart data={customerStats} margin={{ top: 10, right: 15, left: 15, bottom: 0 }}>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(226, 232, 240, 0.6)" />
                   <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dy={10} interval={0} />
                   <YAxis 
                      yAxisId="left"
                      width={45}
                      tickFormatter={(value) => `${(value / 1000000).toFixed(0)}M`} 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 11, fill: '#64748b' }}
                   />
                   <Tooltip 
                      content={<CustomChartTooltip isCurrency={true} />}
                      cursor={{ fill: 'rgba(241, 245, 249, 0.6)' }}
                   />
                   <Legend wrapperStyle={{ paddingTop: '15px', fontSize: '12px' }} />
                   <Bar yAxisId="left" dataKey="revenue" name="Doanh thu" fill={RECHARTS_PALETTE.blue} radius={[6, 6, 0, 0]} maxBarSize={45} />
                   <Bar yAxisId="left" dataKey="profit" name="Lợi nhuận gộp" fill={RECHARTS_PALETTE.emerald} radius={[6, 6, 0, 0]} maxBarSize={45} />
                 </BarChart>
               </ResponsiveContainer>
             </div>
             <InsightBox content={customerInsight} />
           </div>

           {/* Chart 8: Top Suppliers */}
           <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden print:break-inside-avoid">
             <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-slate-900 flex items-center gap-2 text-sm sm:text-base font-display">
                  <Briefcase size={18} className="text-indigo-600 shrink-0" /> 8. Top Nhà cung cấp (Giá vốn & Mua hàng)
                </h3>
             </div>
             <div className="h-[280px] sm:h-[350px] w-full min-w-0">
               <ResponsiveContainer width="100%" height="100%" minHeight={250}>
                 <BarChart data={supplierStats} margin={{ top: 10, right: 15, left: 15, bottom: 0 }}>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(226, 232, 240, 0.6)" />
                   <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dy={10} interval={0} />
                   <YAxis 
                      yAxisId="left"
                      width={45}
                      tickFormatter={(value) => `${(value / 1000000).toFixed(0)}M`} 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 11, fill: '#64748b' }}
                   />
                   <Tooltip 
                      content={<CustomChartTooltip isCurrency={true} />}
                      cursor={{ fill: 'rgba(241, 245, 249, 0.6)' }}
                   />
                   <Legend wrapperStyle={{ paddingTop: '15px', fontSize: '12px' }} />
                   <Bar yAxisId="left" dataKey="revenue" name="Doanh thu" fill={RECHARTS_PALETTE.indigo} radius={[6, 6, 0, 0]} maxBarSize={45} />
                   <Bar yAxisId="left" dataKey="profit" name="Lợi nhuận" fill="#06B6D4" radius={[6, 6, 0, 0]} maxBarSize={45} />
                 </BarChart>
               </ResponsiveContainer>
             </div>
             <InsightBox content={supplierInsight} />
           </div>
        </div>

        {/* Chart 9: Dedicated Commission Distribution by Customer */}
        {commissionCustomerStats.length > 0 && (
          <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
             <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
                <div>
                  <h3 className="font-bold text-slate-900 flex items-center gap-2 text-sm sm:text-base font-display">
                    <DollarSign size={18} className="text-purple-600 shrink-0" /> 9. Cơ cấu & Phân bổ Chi phí Hoa hồng theo Khách hàng
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">Thống kê chi tiết các khoản chiết khấu/hoa hồng theo từng đối tác và người thụ hưởng</p>
                </div>
                <div className="text-xs font-mono font-bold px-2.5 py-1 bg-purple-50 text-purple-700 rounded-lg shrink-0 self-start sm:self-auto border border-purple-200/60">
                   COMMISSION BREAKDOWN
                </div>
             </div>
             <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                <div className="lg:col-span-7 h-[260px] sm:h-[300px] w-full min-w-0">
                  <ResponsiveContainer width="100%" height="100%" minHeight={240}>
                    <BarChart data={commissionCustomerStats.slice(0, 6)} margin={{ top: 10, right: 15, left: 15, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(226, 232, 240, 0.6)" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dy={10} interval={0} />
                      <YAxis 
                         width={45}
                         tickFormatter={(value) => `${(value / 1000000).toFixed(0)}M`} 
                         axisLine={false} 
                         tickLine={false} 
                         tick={{ fontSize: 11, fill: '#64748b' }}
                      />
                      <Tooltip 
                         content={<CustomChartTooltip isCurrency={true} unit="Hoa hồng" />}
                         cursor={{ fill: 'rgba(241, 245, 249, 0.6)' }}
                      />
                      <Bar dataKey="commission" name="Tổng chi hoa hồng" fill={RECHARTS_PALETTE.purple} radius={[6, 6, 0, 0]} maxBarSize={45} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="lg:col-span-5 flex flex-col gap-3">
                   <div className="bg-purple-50/60 p-4 rounded-xl border border-purple-100">
                      <div className="text-xs font-bold text-purple-700 uppercase tracking-wider font-display">Tổng tiền hoa hồng đã cam kết</div>
                      <div className="text-2xl font-extrabold text-purple-900 mt-1 font-mono tabular-nums">{formatter.format(totalCommission)}</div>
                      <div className="text-[11px] text-purple-600 mt-1">
                        Chiếm {totalProfit > 0 ? ((totalCommission / totalProfit) * 100).toFixed(1) : 0}% trên tổng lợi nhuận gộp hệ thống
                      </div>
                   </div>
                   <div className="space-y-2">
                     {commissionCustomerStats.slice(0, 3).map((item, idx) => (
                       <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-xs">
                          <span className="font-semibold text-slate-800 truncate max-w-[180px]">{item.name}</span>
                          <span className="font-mono font-bold text-purple-700 tabular-nums">{formatter.format(item.commission)}</span>
                       </div>
                     ))}
                   </div>
                </div>
             </div>
          </div>
        )}

        {/* Charts Row 3: Growth & Financial Bridge (Charts 10 & 11) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
           {/* Chart 10: Cumulative Revenue Growth */}
           <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden print:break-inside-avoid">
             <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-bold text-slate-900 flex items-center gap-2 text-sm sm:text-base font-display">
                    <Activity size={18} className="text-blue-600 shrink-0" /> 10. Phân tích Tăng trưởng Doanh thu & Tích Lũy
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">Theo dõi doanh thu tích lũy và tỷ lệ tăng trưởng hàng tháng</p>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono font-bold px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg border border-blue-200/60">
                   <TrendingUp size={14} /> GROWTH
                </div>
             </div>
             <div className="h-[280px] sm:h-[350px] w-full min-w-0">
               <ResponsiveContainer width="100%" height="100%" minHeight={250}>
                 <ComposedChart data={revenueGrowthData} margin={{ top: 10, right: 15, left: 15, bottom: 0 }}>
                   <defs>
                     <linearGradient id="colorCumulative" x1="0" y1="0" x2="0" y2="1">
                       <stop offset="5%" stopColor={RECHARTS_PALETTE.blue} stopOpacity={0.25}/>
                       <stop offset="95%" stopColor={RECHARTS_PALETTE.blue} stopOpacity={0.0}/>
                     </linearGradient>
                   </defs>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(226, 232, 240, 0.6)" />
                   <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} dy={10} />
                   <YAxis 
                      yAxisId="left"
                      width={45}
                      tickFormatter={(value) => `${(value / 1000000).toFixed(0)}M`} 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 11, fill: '#64748b' }}
                   />
                   <YAxis 
                      yAxisId="right"
                      orientation="right"
                      width={35}
                      tickFormatter={(value) => `${value}%`} 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 11, fill: '#64748b' }}
                   />
                   <Tooltip 
                      content={<CustomChartTooltip formatter={(value, name) => name === 'Tăng trưởng' ? [`${value}%`, name] : [formatter.format(value), name]} />}
                   />
                   <Legend wrapperStyle={{ paddingTop: '15px', fontSize: '12px' }} />
                   <Area yAxisId="left" type="monotone" dataKey="cumulative" name="Doanh thu tích lũy" fill="url(#colorCumulative)" stroke={RECHARTS_PALETTE.blue} strokeWidth={2.5} />
                   <Bar yAxisId="left" dataKey="revenue" name="Doanh thu tháng" fill={RECHARTS_PALETTE.blue} opacity={0.35} radius={[6, 6, 0, 0]} maxBarSize={35} />
                   <Line yAxisId="right" type="stepAfter" dataKey="growth" name="Tăng trưởng" stroke={RECHARTS_PALETTE.amber} strokeWidth={2.5} dot={{ r: 3, fill: RECHARTS_PALETTE.amber }} />
                 </ComposedChart>
               </ResponsiveContainer>
             </div>
           </div>

           {/* Chart 11: Waterfall Chart (Profit Bridge) */}
           <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden print:break-inside-avoid">
             <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-bold text-slate-900 flex items-center gap-2 text-sm sm:text-base font-display">
                    <BarChart3 size={18} className="text-emerald-600 shrink-0" /> 11. Biểu đồ Thác nước: Điểm hòa vốn & LN Ròng
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">Phân tách từ doanh thu tổng qua giá vốn, lợi nhuận gộp và hoa hồng đến LN ròng</p>
                </div>
             </div>
             <div className="h-[280px] sm:h-[350px] w-full min-w-0">
               <ResponsiveContainer width="100%" height="100%" minHeight={250}>
                 <BarChart data={waterfallData} margin={{ top: 20, right: 15, left: 15, bottom: 5 }}>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(226, 232, 240, 0.6)" />
                   <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                   <YAxis 
                      width={45}
                      tickFormatter={(value) => `${(value / 1000000).toFixed(0)}M`} 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 11, fill: '#64748b' }}
                   />
                   <Tooltip 
                      content={<CustomChartTooltip formatter={(value, name, item) => [formatter.format(Math.abs(item.payload.display)), item.payload.name]} />}
                      cursor={{ fill: 'transparent' }}
                   />
                   <Bar dataKey="range" radius={[6, 6, 6, 6]}>
                      {waterfallData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                   </Bar>
                 </BarChart>
               </ResponsiveContainer>
             </div>
             <div className="mt-4 flex flex-wrap justify-center gap-3 sm:gap-5">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
                  <span className="text-[11px] text-slate-600 font-medium font-mono">Doanh thu (+)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                  <span className="text-[11px] text-slate-600 font-medium font-mono">Giá vốn (-)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
                  <span className="text-[11px] text-slate-600 font-medium font-mono">LN Gộp (=)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-purple-500"></div>
                  <span className="text-[11px] text-slate-600 font-medium font-mono">Hoa hồng (-)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-700"></div>
                  <span className="text-[11px] text-slate-600 font-medium font-mono">LN Ròng (=)</span>
                </div>
             </div>
           </div>
        </div>
      </div>

      <GoogleSheetsSyncModal
        isOpen={isSheetsModalOpen}
        onClose={() => setIsSheetsModalOpen(false)}
        deliveries={deliveryData}
        poLines={poLinesData}
        poHeaders={poData}
        customers={customersData}
      />

      <PDFExportModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        dashboardRef={dashboardRef}
        deliveryData={deliveryData}
        poLinesData={poLinesData}
        summaryStats={{
          totalRevenue,
          totalProfit,
          totalVolume: filteredDelivery.reduce((sum, item) => sum + (parseNumber(item['Số lượng giao']) || 0), 0),
          totalDeliveries: filteredDelivery.length
        }}
        timeFilterLabel={timeFilter === 'all' ? 'Tất cả thời gian' : `Lọc thời gian (${timeFilter.toUpperCase()})`}
        categoryFilterLabel={categoryFilter === 'all' ? 'Tất cả Nhóm hàng' : `Nhóm: ${categoryFilter}`}
      />
    </div>
  );
}
