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

export default function DashboardView({ poData, deliveryData, poLinesData, customersData = [] }: { poData: any[], deliveryData: any[], poLinesData: any[], customersData?: any[] }) {
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

  // --- STATS BY QUARTER (QUÝ 1 -> QUÝ 4) ---
  const quarterlyTrendData = useMemo(() => {
    const quarters = [
      { quarter: 'Quý 1', name: 'Quý 1 (T1 - T3)', revenue: 0, profit: 0, volume: 0, orders: 0 },
      { quarter: 'Quý 2', name: 'Quý 2 (T4 - T6)', revenue: 0, profit: 0, volume: 0, orders: 0 },
      { quarter: 'Quý 3', name: 'Quý 3 (T7 - T9)', revenue: 0, profit: 0, volume: 0, orders: 0 },
      { quarter: 'Quý 4', name: 'Quý 4 (T10 - T12)', revenue: 0, profit: 0, volume: 0, orders: 0 },
    ];

    filteredDelivery.forEach(d => {
      const month = parseInt(d["Tháng"]);
      if (isNaN(month) || month < 1 || month > 12) return;
      const qIndex = Math.floor((month - 1) / 3);
      const rev = parseNumber(d["Doanh thu"]);
      const prof = parseNumber(d["Lợi nhuận gộp"] || d["Lợi nhuận dòng"]);
      const vol = parseNumber(d["Số lượng giao"]);

      quarters[qIndex].revenue += rev;
      quarters[qIndex].profit += prof;
      quarters[qIndex].volume += vol;
      quarters[qIndex].orders += 1;
    });

    return quarters;
  }, [filteredDelivery]);

  // --- STATS BY PRODUCT (TOP ITEMS) ---
  const productStats = useMemo(() => {
    const map = new Map<string, {name: string, category: string, revenue: number, profit: number, volume: number}>();
    filteredDelivery.forEach(d => {
       const product = d["Tên sản phẩm"] || "Khác";
       const category = d["Nhóm hàng"] || d["Danh mục"] || "Khác";
       const rev = parseFloat(String(d["Doanh thu"] || "0").replace(/,/g, '')) || 0;
       const prof = parseFloat(String(d["Lợi nhuận gộp"] || d["Lợi nhuận dòng"] || "0").replace(/,/g, '')) || 0;
       const vol = parseFloat(String(d["Số lượng giao"] || "0").replace(/,/g, '')) || 0;
       
       if (!map.has(product)) map.set(product, { name: product, category, revenue: 0, profit: 0, volume: 0 });
       const item = map.get(product)!;
       item.revenue += rev;
       item.profit += prof;
       item.volume += vol;
    });
    return Array.from(map.values()).sort((a,b) => b.revenue - a.revenue).slice(0, 10);
  }, [filteredDelivery]);

  // Chart 2: Revenue & Profit Trend by Month
  const monthlyTrendData = useMemo(() => {
    const map = new Map<number, {month: string, revenue: number, profit: number}>();
    filteredDelivery.forEach(d => {
       const month = parseInt(d["Tháng"]);
       if (isNaN(month)) return;
       const rev = parseFloat(String(d["Doanh thu"] || "0").replace(/,/g, '')) || 0;
       const prof = parseFloat(String(d["Lợi nhuận gộp"] || d["Lợi nhuận dòng"] || "0").replace(/,/g, '')) || 0;
       if (!map.has(month)) map.set(month, { month: `Tháng ${month}`, revenue: 0, profit: 0 });
       const item = map.get(month)!;
       item.revenue += rev;
       item.profit += prof;
    });
    return Array.from(map.entries()).sort((a,b) => a[0] - b[0]).map(e => e[1]);
  }, [filteredDelivery]);

  // Chart 2b: Completed Orders Revenue & Profit Trend by Month
  const completedMonthlyTrendData = useMemo(() => {
    const completedPoNumbers = new Set(
      poData
        .filter(po => po["Trạng Thái"] === "Hoàn thành" || po["Trạng thái"] === "Hoàn thành" || po["Status"] === "Hoàn thành")
        .map(po => (po["Đơn hàng"] || po["Số PO"] || "").toString().trim())
    );

    const map = new Map<number, {month: string, revenue: number, profit: number}>();
    deliveryData
      .filter(d => {
         const poNumber = (d["Đơn hàng"] || "").toString().trim();
         return completedPoNumbers.has(poNumber);
      })
      .forEach(d => {
         const month = parseInt(d["Tháng"]);
         if (isNaN(month)) return;
         const rev = parseFloat(String(d["Doanh thu"] || "0").replace(/,/g, '')) || 0;
         const prof = parseFloat(String(d["Lợi nhuận gộp"] || d["Lợi nhuận dòng"] || "0").replace(/,/g, '')) || 0;
         if (!map.has(month)) map.set(month, { month: `Tháng ${month}`, revenue: 0, profit: 0 });
         const item = map.get(month)!;
         item.revenue += rev;
         item.profit += prof;
    });
    return Array.from(map.entries()).sort((a,b) => a[0] - b[0]).map(e => e[1]);
  }, [deliveryData, poData]);

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

  // --- WATERFALL DATA: PROFIT BRIDGE ---
  const waterfallData = useMemo(() => {
    const totalRev = totalRevenue;
    const totalProf = totalProfit;
    const totalCost = totalRev - totalProf;

    return [
      { 
        name: 'Doanh thu', 
        range: [0, totalRev], 
        display: totalRev,
        color: '#3b82f6' 
      },
      { 
        name: 'Giá vốn (NCC)', 
        range: [totalRev, totalRev - totalCost], 
        display: -totalCost,
        color: '#ef4444' 
      },
      { 
        name: 'Lợi nhuận gộp', 
        range: [0, totalProf], 
        display: totalProf,
        color: '#10b981' 
      },
    ];
  }, [totalRevenue, totalProfit]);

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
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-5 mb-5 sm:mb-8">
          <div className="bg-gradient-to-br from-blue-600/90 via-blue-700 to-indigo-800 rounded-2xl p-4 sm:p-6 text-white shadow-xl shadow-blue-500/15 backdrop-blur-md border border-blue-400/30 relative overflow-hidden group hover:scale-[1.01] transition-all duration-300">
            <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500 pointer-events-none" />
            <div className="flex justify-between items-start mb-3 sm:mb-4 relative z-10">
              <div className="p-2.5 sm:p-3 bg-white/15 backdrop-blur-md rounded-xl shadow-inner border border-white/20">
                <TrendingUp size={22} className="text-blue-100" />
              </div>
              <span className="text-[10px] sm:text-[11px] font-bold bg-white/20 backdrop-blur-md px-2.5 py-0.5 rounded-full border border-white/20 tracking-wider">DỰ BÁO DÒNG TIỀN</span>
            </div>
            <h3 className="text-[11px] sm:text-xs font-semibold text-blue-100 uppercase tracking-wide mb-1 relative z-10">Doanh thu dự kiến (PO còn lại)</h3>
            <div className="text-xl sm:text-2xl font-black tracking-tight text-white mb-1 relative z-10">{executiveInsights.projectedRev.toLocaleString('vi-VN')} đ</div>
            <p className="text-[11px] sm:text-xs text-blue-100/80 leading-relaxed relative z-10">Dựa trên khối lượng hàng chưa giao trong các PO hiện hành</p>
          </div>

          <div className="bg-gradient-to-br from-amber-500/90 via-amber-600 to-orange-700 rounded-2xl p-4 sm:p-6 text-white shadow-xl shadow-amber-500/15 backdrop-blur-md border border-amber-400/30 relative overflow-hidden group hover:scale-[1.01] transition-all duration-300">
            <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500 pointer-events-none" />
            <div className="flex justify-between items-start mb-3 sm:mb-4 relative z-10">
              <div className="p-2.5 sm:p-3 bg-white/15 backdrop-blur-md rounded-xl shadow-inner border border-white/20">
                <Clock size={22} className="text-amber-100" />
              </div>
              <span className="text-[10px] sm:text-[11px] font-bold bg-white/20 backdrop-blur-md px-2.5 py-0.5 rounded-full border border-white/20 tracking-wider">TIẾN ĐỘ & UY TÍN</span>
            </div>
            <h3 className="text-[11px] sm:text-xs font-semibold text-amber-100 uppercase tracking-wide mb-1 relative z-10">Đơn hàng chậm tiến độ</h3>
            <div className="text-xl sm:text-2xl font-black tracking-tight text-white mb-1 relative z-10">{executiveInsights.delayedPOs} PO Line</div>
            <p className="text-[11px] sm:text-xs text-amber-100/80 leading-relaxed relative z-10">Cảnh báo: Đã quá hạn giao hàng nhưng chưa hoàn tất 100%</p>
          </div>

          <div className="bg-gradient-to-br from-rose-500/90 via-rose-600 to-red-700 rounded-2xl p-4 sm:p-6 text-white shadow-xl shadow-rose-500/15 backdrop-blur-md border border-rose-400/30 relative overflow-hidden group hover:scale-[1.01] transition-all duration-300 sm:col-span-2 md:col-span-1">
            <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500 pointer-events-none" />
            <div className="flex justify-between items-start mb-3 sm:mb-4 relative z-10">
              <div className="p-2.5 sm:p-3 bg-white/15 backdrop-blur-md rounded-xl shadow-inner border border-white/20">
                <ShieldAlert size={22} className="text-rose-100" />
              </div>
              <span className="text-[10px] sm:text-[11px] font-bold bg-white/20 backdrop-blur-md px-2.5 py-0.5 rounded-full border border-white/20 tracking-wider">RỦI RO TÀI CHÍNH</span>
            </div>
            <h3 className="text-[11px] sm:text-xs font-semibold text-rose-100 uppercase tracking-wide mb-1 relative z-10">Mục biên lợi nhuận thấp (&lt;15%)</h3>
            <div className="text-xl sm:text-2xl font-black tracking-tight text-white mb-1 relative z-10">{executiveInsights.lowMarginItems} SKU</div>
            <p className="text-[11px] sm:text-xs text-rose-100/80 leading-relaxed relative z-10">Cần rà soát lại giá NCC hoặc giá bán cho Khách hàng</p>
          </div>
        </div>

        {/* Overall Order Lifecycle Pipeline */}
        <div className="bg-white/80 backdrop-blur-md p-4 sm:p-6 rounded-2xl border border-slate-200/80 shadow-lg shadow-slate-200/50 mb-5 sm:mb-8 hover:border-blue-400/40 transition-all duration-300">
          <h3 className="text-xs sm:text-sm font-extrabold text-slate-800 uppercase tracking-wider mb-5 sm:mb-8 flex items-center gap-2">
            <Activity className="text-emerald-500" size={18} /> Phân bổ Vòng đời Đơn hàng (Toàn hệ thống)
          </h3>
          <div className="relative overflow-x-auto mobile-scroll-x py-2">
            <div className="relative flex items-center justify-between min-w-[500px] px-4 md:px-12">
            {(() => {
              const steps = [
                { label: 'Mới tạo', count: overallPoLifecycle.newPos, color: 'bg-slate-500', ring: 'ring-slate-100' },
                { label: 'Đang xử lý', count: overallPoLifecycle.processing, color: 'bg-blue-600', ring: 'ring-blue-100' },
                { label: 'Đang giao', count: overallPoLifecycle.delivering, color: 'bg-amber-500', ring: 'ring-amber-100' },
                { label: 'Hoàn thành', count: overallPoLifecycle.completed, color: 'bg-emerald-600', ring: 'ring-emerald-100' }
              ];
              const total = overallPoLifecycle.total || 1;

              return (
                <>
                  <div className="absolute left-[8%] right-[8%] top-5 h-1.5 bg-slate-100 rounded-full z-0"></div>
                  
                  {steps.map((step, idx) => {
                    const percent = Math.round((step.count / total) * 100);
                    return (
                      <div key={step.label} className="relative z-10 flex flex-col items-center gap-3 w-1/4 group cursor-pointer">
                        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-sm text-white ring-8 shadow-md transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg ${step.color} ${step.ring}`}>
                          {idx + 1}
                        </div>
                        <div className="text-center mt-2">
                          <div className="text-sm font-bold text-slate-800 mb-0.5">{step.label}</div>
                          <div className="text-2xl font-black text-slate-900">{step.count} <span className="text-xs font-medium text-slate-500">đơn</span></div>
                          <div className="text-[11px] font-bold text-slate-600 bg-slate-100 px-3 py-0.5 rounded-full inline-block mt-1.5 border border-slate-200">
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

        {/* Bento Grid Top KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 mb-5 sm:mb-8">
          <div className="bg-white/80 backdrop-blur-md p-6 rounded-2xl border border-slate-200/80 shadow-lg shadow-slate-200/40 relative overflow-hidden group hover:border-blue-500/50 hover:shadow-[0_10px_30px_rgba(59,130,246,0.15)] transition-all duration-300">
             <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-15 group-hover:scale-110 transition-all duration-300">
                <DollarSign size={80} className="text-blue-600" />
             </div>
             <div className="flex items-center gap-3 mb-3 relative z-10">
               <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shadow-xs">
                 <TrendingUp size={20} />
               </div>
               <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tổng Doanh thu</h3>
             </div>
             <p className="text-2xl font-black text-slate-900 mb-1 relative z-10 tracking-tight">{formatter.format(totalRevenue)}</p>
             <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 relative z-10">
                <Activity size={14} /> <span>Tăng trưởng dương</span>
             </div>
          </div>
          
          <div className="bg-white/80 backdrop-blur-md p-6 rounded-2xl border border-slate-200/80 shadow-lg shadow-slate-200/40 relative overflow-hidden group hover:border-emerald-500/50 hover:shadow-[0_10px_30px_rgba(16,185,129,0.15)] transition-all duration-300">
             <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-15 group-hover:scale-110 transition-all duration-300">
                <Activity size={80} className="text-emerald-600" />
             </div>
             <div className="flex items-center gap-3 mb-3 relative z-10">
               <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shadow-xs">
                 <DollarSign size={20} />
               </div>
               <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tổng Lợi nhuận</h3>
             </div>
             <p className="text-2xl font-black text-slate-900 mb-1 relative z-10 tracking-tight">{formatter.format(totalProfit)}</p>
             <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 relative z-10">
                <span>Biên LN: {totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : 0}%</span>
             </div>
          </div>

          <div className="bg-white/80 backdrop-blur-md p-6 rounded-2xl border border-slate-200/80 shadow-lg shadow-slate-200/40 relative overflow-hidden group hover:border-amber-500/50 hover:shadow-[0_10px_30px_rgba(245,158,11,0.15)] transition-all duration-300">
             <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-15 group-hover:scale-110 transition-all duration-300">
                <FileText size={80} className="text-amber-500" />
             </div>
             <div className="flex items-center gap-3 mb-3 relative z-10">
               <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center shadow-xs">
                 <Package size={20} />
               </div>
               <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tổng Số Đơn Hàng</h3>
             </div>
             <p className="text-2xl font-black text-slate-900 mb-1 relative z-10 tracking-tight">{numFormatter.format(totalOrders)} <span className="text-base font-semibold text-slate-500">đơn</span></p>
             <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 relative z-10">
                <span>Từ hệ thống PO</span>
             </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm relative overflow-hidden group">
             <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Truck size={64} className="text-purple-500" />
             </div>
             <div className="flex items-center gap-3 mb-3 relative z-10">
               <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                 <CheckCircle size={20} className="text-purple-600" />
               </div>
               <h3 className="text-sm font-semibold text-gray-600">Tỷ lệ Hoàn thành</h3>
             </div>
             <p className="text-2xl font-bold text-gray-900 mb-1 relative z-10">
               {filteredDelivery.length > 0 ? ((completedDeliveries / filteredDelivery.length) * 100).toFixed(1) : 0}%
             </p>
             <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 relative z-10">
                <span>{completedDeliveries} chuyến hoàn thành</span>
             </div>
          </div>
        </div>

        {/* Completed Orders Revenue & Profit Chart */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
           <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  <BarChart3 size={18} className="text-blue-600" /> Doanh thu & Lợi nhuận (Đơn hàng Hoàn thành)
                </h3>
                <p className="text-xs text-gray-500 mt-1">Biểu đồ tổng doanh thu và lợi nhuận gộp theo từng tháng (chỉ tính đơn hàng đã Hoàn thành)</p>
              </div>
              <div className="text-xs font-bold px-2 py-1 bg-blue-50 text-blue-600 rounded">
                 COMPLETED ORDERS
              </div>
           </div>
           <div className="h-[350px] w-full">
             <ResponsiveContainer width="100%" height="100%">
               <ComposedChart data={completedMonthlyTrendData} margin={{ top: 10, right: 30, left: 40, bottom: 0 }}>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                 <XAxis 
                    dataKey="month" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 12, fill: '#6b7280' }} 
                    dy={10} 
                 />
                 <YAxis 
                    yAxisId="left"
                    width={50}
                    tickFormatter={(value) => `${(value / 1000000).toFixed(0)}M`} 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 12, fill: '#6b7280' }}
                 />
                 <Tooltip 
                    formatter={(value: number) => numFormatter.format(value) + " đ"}
                    cursor={{fill: '#f1f5f9'}}
                    contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.92)', backdropFilter: 'blur(12px)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.15)', color: '#f8fafc', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)' }}
                    itemStyle={{ color: '#e2e8f0' }}
                    labelStyle={{ fontWeight: 'bold', color: '#60a5fa', marginBottom: '4px' }}
                 />
                 <Legend wrapperStyle={{ paddingTop: '20px' }} />
                 <Bar yAxisId="left" dataKey="revenue" name="Doanh thu" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={60} />
                 <Bar yAxisId="left" dataKey="profit" name="Lợi nhuận gộp" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={60} />
               </ComposedChart>
             </ResponsiveContainer>
           </div>
           <InsightBox content={completedTrendInsight} />
        </div>

        {/* Monthly Profit Analysis Bar Chart */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
           <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  <BarChart3 size={18} className="text-emerald-600" /> Phân tích Lợi nhuận ròng Hàng tháng
                </h3>
                <p className="text-xs text-gray-500 mt-1">Biểu đồ so sánh hiệu quả kinh doanh qua các tháng trong năm 2026</p>
              </div>
              <div className="text-xs font-bold px-2 py-1 bg-emerald-50 text-emerald-600 rounded">
                 NET PROFIT
              </div>
           </div>
           <div className="h-[350px] w-full">
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={monthlyTrendData} margin={{ top: 10, right: 30, left: 40, bottom: 0 }}>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                 <XAxis 
                    dataKey="month" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 12, fill: '#6b7280', fontWeight: 500 }} 
                    dy={12} 
                 />
                 <YAxis 
                    width={50}
                    tickFormatter={(value) => `${(value / 1000000).toFixed(0)}M`} 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 12, fill: '#6b7280' }}
                 />
                 <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    formatter={(value: number) => [formatter.format(value), "Lợi nhuận ròng"]}
                    contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.92)', backdropFilter: 'blur(12px)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.15)', color: '#f8fafc', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)' }}
                    itemStyle={{ color: '#e2e8f0' }}
                    labelStyle={{ fontWeight: 'bold', color: '#34d399', marginBottom: '4px' }}
                 />
                 <Bar 
                    dataKey="profit" 
                    name="Lợi nhuận ròng" 
                    fill="#10b981" 
                    radius={[6, 6, 0, 0]} 
                    maxBarSize={80}
                    animationDuration={1500}
                 />
               </BarChart>
             </ResponsiveContainer>
           </div>
           <InsightBox content={netProfitInsight} />
        </div>

        {/* PHÂN TÍCH TÌNH HÌNH KINH DOANH THEO QUÝ */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700 print:break-inside-avoid">
           <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  <BarChart3 size={18} className="text-purple-600" /> Phân tích Tình hình Kinh doanh theo Quý (Quý 1 - Quý 4)
                </h3>
                <p className="text-xs text-gray-500 mt-1">So sánh doanh thu, lợi nhuận gộp và sản lượng giữa các quý trong năm</p>
              </div>
              <div className="text-xs font-bold px-3 py-1 bg-purple-50 text-purple-700 rounded-full border border-purple-200/60">
                 QUARTERLY ANALYSIS
              </div>
           </div>

           <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              <div className="lg:col-span-7 h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={quarterlyTrendData} margin={{ top: 10, right: 20, left: 40, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
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
                       cursor={{ fill: '#f8fafc' }}
                       formatter={(value: number, name: string) => [formatter.format(value), name]}
                       contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.92)', backdropFilter: 'blur(12px)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.15)', color: '#f8fafc', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)' }}
                       itemStyle={{ color: '#e2e8f0' }}
                       labelStyle={{ fontWeight: 'bold', color: '#c084fc', marginBottom: '4px' }}
                    />
                    <Legend wrapperStyle={{ paddingTop: '16px' }} />
                    <Bar dataKey="revenue" name="Doanh thu" fill="#8b5cf6" radius={[6, 6, 0, 0]} maxBarSize={50} />
                    <Bar dataKey="profit" name="Lợi nhuận gộp" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={50} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="lg:col-span-5 overflow-x-auto">
                <table className="w-full text-xs text-left border border-slate-100 rounded-xl overflow-hidden shadow-2xs">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-100 font-bold uppercase tracking-wider">
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
                          <td className="px-3 py-2.5 text-right font-medium text-slate-700">{formatter.format(q.revenue)}</td>
                          <td className="px-3 py-2.5 text-right font-bold text-emerald-600">{formatter.format(q.profit)}</td>
                          <td className="px-3 py-2.5 text-right font-bold text-purple-600">{marginPct}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
           </div>

           <InsightBox title="Phân tích tình hình kinh doanh theo Quý" content={quarterlyInsight} />
        </div>

        {/* MẶT HÀNG BEST SELLER */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-8 overflow-hidden print:overflow-visible">
           <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Star size={18} className="text-amber-500" /> Top 10 Mặt hàng mang lại Doanh thu & Sản lượng tốt nhất
              </h3>
           </div>
           <div className="overflow-x-auto print:overflow-visible">
              <table className="w-full text-sm text-left">
                <thead className="bg-white text-gray-500 shadow-[0_1px_0_0_#f3f4f6]">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Tên sản phẩm</th>
                    <th className="px-5 py-3 font-semibold">Nhóm hàng</th>
                    <th className="px-5 py-3 font-semibold text-right">Sản lượng (đã giao)</th>
                    <th className="px-5 py-3 font-semibold text-right">Doanh thu</th>
                    <th className="px-5 py-3 font-semibold text-right">Lợi nhuận</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {productStats.map((p, i) => (
                    <tr key={p.name} className="hover:bg-amber-50/30 transition-colors">
                       <td className="px-5 py-4 font-medium text-gray-900">
                          <div className="flex items-center gap-3">
                             <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${i < 3 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>{i + 1}</span>
                             {p.name}
                          </div>
                       </td>
                       <td className="px-5 py-4 text-gray-600">{p.category}</td>
                       <td className="px-5 py-4 text-right font-medium text-gray-900">{numFormatter.format(p.volume)}</td>
                       <td className="px-5 py-4 text-right font-bold text-blue-600">{formatter.format(p.revenue)}</td>
                       <td className="px-5 py-4 text-right font-bold text-green-600">{formatter.format(p.profit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
           </div>
        </div>

        {/* Charts Row 1: Trend & Category */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
           <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm overflow-hidden print:break-inside-avoid">
             <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  <TrendingUp size={18} className="text-blue-600" /> Xu hướng Doanh thu & Lợi nhuận
                </h3>
             </div>
             <ResponsiveContainer width="100%" height={300}>
               <LineChart data={monthlyTrendData} margin={{ top: 10, right: 15, left: 45, bottom: 0 }}>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                 <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dy={10} />
                 <YAxis 
                    yAxisId="left"
                    width={50}
                    tickFormatter={(value) => `${(value / 1000000).toFixed(0)}M`} 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 12, fill: '#6b7280' }}
                 />
                 <Tooltip 
                    formatter={(value: number) => formatter.format(value)}
                    contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.92)', backdropFilter: 'blur(12px)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.15)', color: '#f8fafc', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)' }}
                    itemStyle={{ color: '#e2e8f0' }}
                    labelStyle={{ fontWeight: 'bold', color: '#60a5fa', marginBottom: '4px' }}
                 />
                 <Legend wrapperStyle={{ paddingTop: '20px' }} />
                 <Line yAxisId="left" type="monotone" dataKey="revenue" name="Doanh thu" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                 <Line yAxisId="left" type="monotone" dataKey="profit" name="Lợi nhuận" stroke="#10b981" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
               </LineChart>
             </ResponsiveContainer>
           </div>

           <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm overflow-hidden print:break-inside-avoid">
             <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  <PieChartIcon size={18} className="text-blue-600" /> Cơ cấu Doanh thu theo Nhóm hàng
                </h3>
             </div>
             <ResponsiveContainer width="100%" height={300}>
               <PieChart>
                 <Pie
                   data={categoryStats}
                   cx="50%"
                   cy="50%"
                   innerRadius={70}
                   outerRadius={100}
                   paddingAngle={5}
                   dataKey="revenue"
                   label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                   labelLine={false}
                 >
                   {categoryStats.map((entry, index) => (
                     <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                   ))}
                 </Pie>
                 <Tooltip 
                    formatter={(value: number) => formatter.format(value)}
                    contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.92)', backdropFilter: 'blur(12px)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.15)', color: '#f8fafc', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)' }}
                    itemStyle={{ color: '#e2e8f0' }}
                    labelStyle={{ fontWeight: 'bold', color: '#60a5fa', marginBottom: '4px' }}
                 />
                 <Legend wrapperStyle={{ paddingTop: '20px' }} />
               </PieChart>
             </ResponsiveContainer>
             <InsightBox content={categoryInsight} />
           </div>
        </div>

        {/* Charts Row 2: Customer & Supplier */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
           <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm overflow-hidden print:break-inside-avoid">
             <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  <Users size={18} className="text-blue-600" /> Top Khách hàng theo Doanh thu
                </h3>
             </div>
             <ResponsiveContainer width="100%" height={300}>
               <BarChart data={customerStats} margin={{ top: 10, right: 15, left: 45, bottom: 0 }}>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                 <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b7280' }} dy={10} interval={0} />
                 <YAxis 
                    yAxisId="left"
                    width={50}
                    tickFormatter={(value) => `${(value / 1000000).toFixed(0)}M`} 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 11, fill: '#6b7280' }}
                 />
                 <Tooltip 
                    formatter={(value: number) => formatter.format(value)}
                    contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.92)', backdropFilter: 'blur(12px)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.15)', color: '#f8fafc', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)' }}
                    itemStyle={{ color: '#e2e8f0' }}
                    labelStyle={{ fontWeight: 'bold', color: '#60a5fa', marginBottom: '4px' }}
                 />
                 <Legend wrapperStyle={{ paddingTop: '20px' }} />
                 <Bar yAxisId="left" dataKey="revenue" name="Doanh thu" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={50} />
                 <Bar yAxisId="left" dataKey="profit" name="Lợi nhuận" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={50} />
               </BarChart>
             </ResponsiveContainer>
             <InsightBox content={customerInsight} />
           </div>

           <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm overflow-hidden print:break-inside-avoid">
             <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  <Briefcase size={18} className="text-indigo-600" /> Top Nhà cung cấp
                </h3>
             </div>
             <ResponsiveContainer width="100%" height={300}>
               <BarChart data={supplierStats} margin={{ top: 10, right: 15, left: 45, bottom: 0 }}>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                 <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b7280' }} dy={10} interval={0} />
                 <YAxis 
                    yAxisId="left"
                    width={50}
                    tickFormatter={(value) => `${(value / 1000000).toFixed(0)}M`} 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 11, fill: '#6b7280' }}
                 />
                 <Tooltip 
                    formatter={(value: number) => formatter.format(value)}
                    contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.92)', backdropFilter: 'blur(12px)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.15)', color: '#f8fafc', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)' }}
                    itemStyle={{ color: '#e2e8f0' }}
                    labelStyle={{ fontWeight: 'bold', color: '#818cf8', marginBottom: '4px' }}
                 />
                 <Legend wrapperStyle={{ paddingTop: '20px' }} />
                 <Bar yAxisId="left" dataKey="revenue" name="Doanh thu" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={50} />
                 <Bar yAxisId="left" dataKey="profit" name="Lợi nhuận" fill="#14b8a6" radius={[4, 4, 0, 0]} maxBarSize={50} />
               </BarChart>
             </ResponsiveContainer>
             <InsightBox content={supplierInsight} />
           </div>
        </div>

        {/* Charts Row 3: Growth & Financial Bridge */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
           <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm overflow-hidden print:break-inside-avoid">
             <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-bold text-gray-900 flex items-center gap-2">
                    <Activity size={18} className="text-blue-600" /> Phân tích Tăng trưởng Doanh thu
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">Theo dõi doanh thu tích lũy và tỷ lệ tăng trưởng hàng tháng</p>
                </div>
                <div className="flex items-center gap-2 text-xs font-bold px-2 py-1 bg-blue-50 text-blue-600 rounded">
                   <TrendingUp size={14} /> GROWTH
                </div>
             </div>
             <div className="h-[320px] w-full">
               <ResponsiveContainer width="100%" height="100%">
                 <ComposedChart data={revenueGrowthData} margin={{ top: 10, right: 15, left: 45, bottom: 0 }}>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                   <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b7280' }} dy={10} />
                   <YAxis 
                      yAxisId="left"
                      width={50}
                      tickFormatter={(value) => `${(value / 1000000).toFixed(0)}M`} 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 11, fill: '#6b7280' }}
                   />
                   <YAxis 
                      yAxisId="right"
                      orientation="right"
                      width={40}
                      tickFormatter={(value) => `${value}%`} 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 11, fill: '#6b7280' }}
                   />
                   <Tooltip 
                      formatter={(value: any, name: string) => {
                        if (name === 'Tăng trưởng') return [`${value}%`, name];
                        return [formatter.format(value), name];
                      }}
                      contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.92)', backdropFilter: 'blur(12px)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.15)', color: '#f8fafc', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)' }}
                      itemStyle={{ color: '#e2e8f0' }}
                      labelStyle={{ fontWeight: 'bold', color: '#fbbf24', marginBottom: '4px' }}
                   />
                   <Legend wrapperStyle={{ paddingTop: '20px' }} />
                   <Area yAxisId="left" type="monotone" dataKey="cumulative" name="Doanh thu tích lũy" fill="#eff6ff" stroke="#3b82f6" strokeWidth={2} />
                   <Bar yAxisId="left" dataKey="revenue" name="Doanh thu tháng" fill="#3b82f6" opacity={0.3} radius={[4, 4, 0, 0]} maxBarSize={40} />
                   <Line yAxisId="right" type="stepAfter" dataKey="growth" name="Tăng trưởng" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                 </ComposedChart>
               </ResponsiveContainer>
             </div>
           </div>

           <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm overflow-hidden print:break-inside-avoid">
             <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-bold text-gray-900 flex items-center gap-2">
                    <BarChart3 size={18} className="text-emerald-600" /> Biểu đồ Thác nước: Điểm hòa vốn & Lợi nhuận
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">Phân tách từ doanh thu tổng đến lợi nhuận gộp sau khi trừ giá vốn</p>
                </div>
             </div>
             <div className="h-[320px] w-full">
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={waterfallData} margin={{ top: 20, right: 30, left: 45, bottom: 5 }}>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                   <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b7280' }} />
                   <YAxis 
                      width={50}
                      tickFormatter={(value) => `${(value / 1000000).toFixed(0)}M`} 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 11, fill: '#6b7280' }}
                   />
                   <Tooltip 
                      formatter={(value: any) => formatter.format(Math.abs(value))}
                      labelStyle={{ fontWeight: 'bold' }}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                      cursor={{ fill: 'transparent' }}
                   />
                   <Bar dataKey="range" radius={[4, 4, 4, 4]}>
                      {waterfallData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                   </Bar>
                 </BarChart>
               </ResponsiveContainer>
             </div>
             <div className="mt-4 flex justify-center gap-6">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <span className="text-xs text-gray-600 font-medium">Doanh thu (+)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <span className="text-xs text-gray-600 font-medium">Giá vốn (-)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                  <span className="text-xs text-gray-600 font-medium">Lợi nhuận (=)</span>
                </div>
             </div>
           </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Lô hàng (Tiến độ) - 2 cols */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 rounded-t-xl">
              <div>
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  <Truck size={18} className="text-blue-600" /> Cập nhật Tiến độ Giao hàng
                </h3>
                <p className="text-xs text-gray-500 mt-1">Tính toán chính xác dựa trên Số lượng đặt & Số lượng đã giao thực tế.</p>
              </div>
            </div>
            <div className="p-0 overflow-auto flex-1 max-h-[400px] print:max-h-none print:overflow-visible">
              <table className="w-full text-sm text-left">
                <thead className="bg-white text-gray-500 sticky top-0 shadow-[0_1px_0_0_#f3f4f6]">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Mã Đơn / PXK</th>
                    <th className="px-5 py-3 font-semibold">Sản phẩm</th>
                    <th className="px-5 py-3 font-semibold w-56">Tiến độ (Đã giao / Tổng)</th>
                    <th className="px-5 py-3 font-semibold text-right">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredDelivery.map((d, i) => {
                    const currentDelivery = parseFloat(String(d["Số lượng giao"] || "0").replace(/,/g, '')) || 0;
                    const prevDelivered = parseFloat(String(d["Đã giao"] || "0").replace(/,/g, '')) || 0;
                    const orderTotal = parseFloat(String(d["Số lượng đặt"] || "0").replace(/,/g, '')) || 0;
                    const totalDelivered = currentDelivery + prevDelivered;
                    
                    const calculatedProgress = orderTotal > 0 ? (totalDelivered / orderTotal) * 100 : 0;
                    const isCompleted = d["Status"] === 'Hoàn thành' || calculatedProgress >= 100;
                    const deliveryId = d.id || d.ID || `${d["Số PXK"] || ''}-${d["Đơn hàng"] || ''}-${d["Tên sản phẩm"] || ''}-${i}`;
                    
                    return (
                    <tr key={deliveryId} className="hover:bg-blue-50/30 transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-medium text-gray-900">{d["Đơn hàng"]}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{d["Số PXK"] || "Chưa có PXK"}</div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-gray-800 font-medium truncate max-w-[200px]">{d["Tên sản phẩm"]}</div>
                        <div className="text-xs text-gray-500 mt-0.5">Khách hàng: {d["Khách hàng"]}</div>
                      </td>
                      <td className="px-5 py-4">
                         <div className="flex flex-col gap-1.5">
                            <div className="flex justify-between text-xs font-medium">
                               <span className={isCompleted ? 'text-green-600' : 'text-blue-600'}>{calculatedProgress.toFixed(1)}%</span>
                               <span className="text-gray-500">{numFormatter.format(totalDelivered)} / {numFormatter.format(orderTotal)} {d["ĐVT"]}</span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                              <div className={`h-2 rounded-full ${isCompleted ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(calculatedProgress, 100)}%` }}></div>
                            </div>
                         </div>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <span className={`inline-flex items-center justify-center px-2.5 py-1 text-[11px] font-bold rounded-md uppercase tracking-wider ${isCompleted ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-blue-100 text-blue-700 border border-blue-200'}`}>
                          {isCompleted ? 'Hoàn thành' : d["Status"]}
                        </span>
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
          </div>

          {/* QC & Incidents - 1 col */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 rounded-t-xl">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <AlertTriangle size={18} className="text-red-500" /> Báo cáo QC & Sự cố
              </h3>
            </div>
            <div className="p-5 flex-1 flex flex-col gap-4 overflow-y-auto max-h-[400px] print:max-h-none print:overflow-visible">
               {filteredDelivery.filter(d => d["Sự cố"] && d["Sự cố"] !== "0" && String(d["Sự cố"]).trim() !== "").length > 0 ? (
                 filteredDelivery.filter(d => d["Sự cố"] && d["Sự cố"] !== "0" && String(d["Sự cố"]).trim() !== "").map((incident, idx) => {
                    const incidentId = incident.id || incident.ID || `${incident["Số PXK"] || incident["Đơn hàng"]}-${idx}`;
                    return (
                    <div key={incidentId} className="bg-red-50/80 border border-red-100 rounded-xl p-4 flex gap-3 hover:shadow-md transition-shadow">
                        <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={20} />
                        <div>
                          <h4 className="font-semibold text-red-900 text-sm">Sự cố PXK: {incident["Số PXK"] || incident["Đơn hàng"]}</h4>
                          <p className="text-sm text-red-700 mt-1.5 leading-relaxed">{incident["Chi tiết sự cố"] || "Lỗi không xác định"}</p>
                          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-red-800 bg-red-100/50 p-2 rounded-lg">
                            <div><span className="font-semibold">Khách:</span> {incident["Khách hàng"]}</div>
                            <div><span className="font-semibold">Sản phẩm:</span> {incident["Tên sản phẩm"]}</div>
                          </div>
                          <div className="mt-3 flex gap-2">
                            <button className="bg-red-600 text-white text-xs font-medium px-4 py-2 rounded-lg hover:bg-red-700 transition shadow-sm">Điều tra</button>
                          </div>
                        </div>
                    </div>
                    );
                  })
               ) : (
                  <div className="bg-green-50 border border-green-100 rounded-xl p-6 flex flex-col items-center justify-center text-center h-full">
                     <CheckCircle size={40} className="text-green-500 mb-3" />
                     <h4 className="font-semibold text-green-900">Không có sự cố nào</h4>
                     <p className="text-sm text-green-700 mt-1">Tất cả các lô hàng đang đạt chuẩn chất lượng QC.</p>
                  </div>
               )}
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
