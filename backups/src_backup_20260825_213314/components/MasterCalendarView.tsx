import React, { useState, useMemo } from "react";
import { 
  Calendar as CalendarIcon, 
  CalendarDays, 
  CalendarRange, 
  Clock, 
  Truck, 
  Package, 
  Users, 
  FileText, 
  ChevronLeft, 
  ChevronRight, 
  Search, 
  ExternalLink, 
  Download, 
  CheckCircle, 
  AlertCircle, 
  TrendingUp, 
  BarChart3, 
  ArrowUpRight, 
  FileSpreadsheet,
  Layers,
  Sparkles,
  Filter
} from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "react-hot-toast";
import { parseNumber } from "../lib/business-logic";

interface MasterCalendarViewProps {
  deliveryPlans: any[];
  deliveries: any[];
  poLines?: any[];
  poHeaders?: any[];
  customers?: any[];
  products?: any[];
  onPoClick?: (poNumber: string) => void;
  onProductClick?: (productId: string) => void;
}

export default function MasterCalendarView({
  deliveryPlans = [],
  deliveries = [],
  poLines = [],
  poHeaders = [],
  customers = [],
  products = [],
  onPoClick,
  onProductClick
}: MasterCalendarViewProps) {
  // Navigation & Scale States
  const [viewScale, setViewScale] = useState<"day" | "week" | "month" | "year">("month");
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  
  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all"); // all, delivered, pending

  // Selected Day Detail Modal
  const [selectedDayDetail, setSelectedDayDetail] = useState<{ dateSlash: string; dateObj: Date; plans: any[] } | null>(null);

  // Unify all delivery schedule items (Combines Delivery Plans + Executed Deliveries)
  const allEvents = useMemo(() => {
    const events: any[] = [];
    const seenPlanIds = new Set<string>();

    // 1. From Delivery Plans (Scheduled)
    deliveryPlans.filter(p => !p.isDeleted).forEach(plan => {
      const planId = String(plan["Kế hoạch ID"] || plan.id || "");
      if (planId) seenPlanIds.add(planId);

      const rawDate = String(plan["Ngày giao kế hoạch"] || plan["Ngày giao"] || "");
      let dateSlash = "";
      let dateIso = "";
      if (rawDate.includes("/")) {
        const parts = rawDate.split("/");
        if (parts.length === 3) {
          const d = parts[0].padStart(2, "0");
          const m = parts[1].padStart(2, "0");
          const y = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
          dateSlash = `${d}/${m}/${y}`;
          dateIso = `${y}-${m}-${d}`;
        }
      } else if (rawDate.includes("-")) {
        const parts = rawDate.split("-");
        if (parts.length === 3) {
          const y = parts[0];
          const m = parts[1].padStart(2, "0");
          const d = parts[2].padStart(2, "0");
          dateSlash = `${d}/${m}/${y}`;
          dateIso = `${y}-${m}-${d}`;
        }
      }

      // Check if actual delivered
      const isDelivered = plan["Trạng thái"] === "Đã giao" || deliveries.some(d => !d.isDeleted && d["Chi tiết đơn hàng"] === plan["Chi tiết đơn hàng"]);

      events.push({
        id: planId || `EVT-PLAN-${Math.random()}`,
        type: "plan",
        poNumber: plan["Đơn hàng"] || "",
        customer: plan["Khách hàng"] || "",
        product: plan["Sản phẩm"] || "",
        quantity: parseNumber(plan["Số lượng kế hoạch"] || plan["Số lượng"]),
        unit: plan["ĐVT"] || "sp",
        dateSlash,
        dateIso,
        status: isDelivered ? "Đã giao" : "Chờ giao",
        notes: plan["Ghi chú"] || "",
        source: plan
      });
    });

    // 2. From Executed Deliveries (PXK) that might not be in plans
    deliveries.filter(d => !d.isDeleted).forEach(del => {
      const rawDate = String(del["Ngày giao"] || del["Ngày xuất kho"] || "");
      let dateSlash = "";
      let dateIso = "";
      if (rawDate.includes("/")) {
        const parts = rawDate.split("/");
        if (parts.length === 3) {
          const d = parts[0].padStart(2, "0");
          const m = parts[1].padStart(2, "0");
          const y = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
          dateSlash = `${d}/${m}/${y}`;
          dateIso = `${y}-${m}-${d}`;
        }
      } else if (rawDate.includes("-")) {
        const parts = rawDate.split("-");
        if (parts.length === 3) {
          const y = parts[0];
          const m = parts[1].padStart(2, "0");
          const d = parts[2].padStart(2, "0");
          dateSlash = `${d}/${m}/${y}`;
          dateIso = `${y}-${m}-${d}`;
        }
      }

      events.push({
        id: del.id || `EVT-DEL-${Math.random()}`,
        type: "delivery",
        poNumber: del["Đơn hàng"] || "",
        customer: del["Khách hàng"] || "",
        product: del["Tên sản phẩm"] || del["Sản phẩm"] || "",
        quantity: parseNumber(del["Số lượng thực nhận"] || del["Số lượng giao"] || del["Đã giao"] || del["Số lượng"]),
        unit: del["ĐVT"] || "sp",
        dateSlash,
        dateIso,
        status: "Đã giao",
        pxkNumber: del["Số PXK"] || "",
        notes: del["Chi tiết sự cố"] || del["Ghi chú"] || "",
        source: del
      });
    });

    return events;
  }, [deliveryPlans, deliveries]);

  // Filtered Events
  const filteredEvents = useMemo(() => {
    return allEvents.filter(ev => {
      if (selectedCustomer !== "all" && ev.customer !== selectedCustomer) return false;
      if (statusFilter === "delivered" && ev.status !== "Đã giao") return false;
      if (statusFilter === "pending" && ev.status === "Đã giao") return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const po = ev.poNumber.toLowerCase();
        const cus = ev.customer.toLowerCase();
        const prd = ev.product.toLowerCase();
        return po.includes(q) || cus.includes(q) || prd.includes(q);
      }
      return true;
    });
  }, [allEvents, selectedCustomer, statusFilter, searchQuery]);

  // Distinct Customer List
  const customerList = useMemo(() => {
    const set = new Set<string>();
    allEvents.forEach(e => { if (e.customer) set.add(e.customer); });
    return Array.from(set).sort();
  }, [allEvents]);

  // Helper to generate Google Calendar Link
  const getGoogleCalendarUrl = (item: any) => {
    const qty = parseNumber(item.quantity).toLocaleString("vi-VN");
    const title = `[Giao Hàng TSG] ${item.customer} - PO ${item.poNumber} (${qty} ${item.unit})`;
    let startIso = "";
    let endIso = "";
    if (item.dateSlash) {
      const parts = item.dateSlash.split("/");
      if (parts.length === 3) {
        startIso = `${parts[2]}${parts[1]}${parts[0]}T073000`;
        endIso = `${parts[2]}${parts[1]}${parts[0]}T150000`;
      }
    }
    if (!startIso) {
      const now = new Date();
      startIso = `${now.getFullYear()}0101T073000`;
      endIso = `${now.getFullYear()}0101T150000`;
    }

    const details = `LỊCH GIAO HÀNG ERP TÂM SEN:\n` +
      `• Đơn hàng PO: ${item.poNumber}\n` +
      `• Khách hàng nhận: ${item.customer}\n` +
      `• Sản phẩm: ${item.product}\n` +
      `• Số lượng: ${qty} ${item.unit}\n` +
      `• Trạng thái: ${item.status}\n` +
      `• Ghi chú: ${item.notes || "Giao giờ hành chính 07h30 - 15h00, pallet chuẩn"}`;
    const location = item.customer ? `Kho nhà máy ${item.customer}` : "Kho khách hàng";

    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${startIso}/${endIso}&details=${encodeURIComponent(details)}&location=${encodeURIComponent(location)}`;
  };

  // Helper to export iCalendar (.ics) file
  const handleExportICS = () => {
    if (filteredEvents.length === 0) {
      toast.error("Không có lịch giao nào để xuất!");
      return;
    }

    let icsContent = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//TSG ERP//Delivery Calendar//VI\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\n";

    filteredEvents.forEach(item => {
      if (!item.dateIso) return;
      const cleanDate = item.dateIso.replace(/-/g, "");
      const dtStart = `${cleanDate}T073000Z`;
      const dtEnd = `${cleanDate}T150000Z`;
      const summary = `[TSG] Giao ${item.customer} - ${parseNumber(item.quantity).toLocaleString("vi-VN")} ${item.unit}`;
      const desc = `PO: ${item.poNumber}\\nSản phẩm: ${item.product}\\nSL: ${parseNumber(item.quantity).toLocaleString("vi-VN")} ${item.unit}\\nTrạng thái: ${item.status}\\nGhi chú: ${item.notes || ""}`;

      icsContent += "BEGIN:VEVENT\r\n";
      icsContent += `UID:TSG-${item.id}@tamsengroup.vn\r\n`;
      icsContent += `DTSTAMP:${cleanDate}T000000Z\r\n`;
      icsContent += `DTSTART:${dtStart}\r\n`;
      icsContent += `DTEND:${dtEnd}\r\n`;
      icsContent += `SUMMARY:${summary}\r\n`;
      icsContent += `DESCRIPTION:${desc}\r\n`;
      icsContent += `LOCATION:Kho ${item.customer}\r\n`;
      icsContent += `STATUS:CONFIRMED\r\n`;
      icsContent += "END:VEVENT\r\n";
    });

    icsContent += "END:VCALENDAR\r\n";

    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Lich_Giao_Hang_TSG_${new Date().toISOString().slice(0, 10)}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Đã tải file lịch .ics! Bạn có thể import vào Google/Apple Calendar.");
  };

  // Helper to export Excel
  const handleExportExcel = () => {
    if (filteredEvents.length === 0) {
      toast.error("Không có dữ liệu lịch giao để xuất!");
      return;
    }

    const rows = filteredEvents.map((ev, idx) => ({
      "STT": idx + 1,
      "Ngày Giao": ev.dateSlash || ev.dateIso,
      "Số PO": ev.poNumber,
      "Khách Hàng": ev.customer,
      "Sản Phẩm": ev.product,
      "Số Lượng": ev.quantity,
      "ĐVT": ev.unit,
      "Trạng Thái": ev.status,
      "Ghi Chú": ev.notes
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Lich_Giao_Hang");
    XLSX.writeFile(wb, `Lich_Giao_Hang_TSG_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Đã xuất file Excel lịch giao hàng!");
  };

  // ----------------------------------------------------
  // DATE CALCULATION HELPERS
  // ----------------------------------------------------
  // Navigation Handlers
  const handlePrev = () => {
    const d = new Date(currentDate);
    if (viewScale === "day") d.setDate(d.getDate() - 1);
    else if (viewScale === "week") d.setDate(d.getDate() - 7);
    else if (viewScale === "month") d.setMonth(d.getMonth() - 1);
    else if (viewScale === "year") d.setFullYear(d.getFullYear() - 1);
    setCurrentDate(d);
  };

  const handleNext = () => {
    const d = new Date(currentDate);
    if (viewScale === "day") d.setDate(d.getDate() + 1);
    else if (viewScale === "week") d.setDate(d.getDate() + 7);
    else if (viewScale === "month") d.setMonth(d.getMonth() + 1);
    else if (viewScale === "year") d.setFullYear(d.getFullYear() + 1);
    setCurrentDate(d);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // 1. Day View Data
  const dayViewDateSlash = useMemo(() => {
    const d = currentDate;
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }, [currentDate]);

  const dayEvents = useMemo(() => {
    return filteredEvents.filter(ev => ev.dateSlash === dayViewDateSlash);
  }, [filteredEvents, dayViewDateSlash]);

  // 2. Week View Data (Monday to Sunday)
  const weekDays = useMemo(() => {
    const curr = new Date(currentDate);
    const day = curr.getDay();
    const distanceToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(curr);
    monday.setDate(curr.getDate() + distanceToMonday);

    const days = [];
    const dayNames = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ Nhật"];

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yyyy = d.getFullYear();
      const dateSlash = `${dd}/${mm}/${yyyy}`;
      const dateIso = `${yyyy}-${mm}-${dd}`;
      const isToday = new Date().toDateString() === d.toDateString();

      const events = filteredEvents.filter(e => e.dateSlash === dateSlash || e.dateIso === dateIso);
      const totalQty = events.reduce((sum, e) => sum + parseNumber(e.quantity), 0);

      days.push({
        dayName: dayNames[i],
        dateSlash,
        dateIso,
        dateObj: d,
        isToday,
        events,
        totalQty
      });
    }
    return days;
  }, [currentDate, filteredEvents]);

  // 3. Month View Data (Full calendar grid 35 or 42 cells)
  const monthGridDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth(); // 0-indexed

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    const startingDayOfWeek = (firstDayOfMonth.getDay() + 6) % 7; // Monday = 0, Sunday = 6
    const daysInMonth = lastDayOfMonth.getDate();

    const cells = [];

    // Previous month filler days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const dayNum = prevMonthLastDay - i;
      const d = new Date(year, month - 1, dayNum);
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yyyy = d.getFullYear();
      const dateSlash = `${dd}/${mm}/${yyyy}`;
      const dateIso = `${yyyy}-${mm}-${dd}`;
      const events = filteredEvents.filter(e => e.dateSlash === dateSlash || e.dateIso === dateIso);

      cells.push({
        dayNumber: dayNum,
        dateSlash,
        dateIso,
        dateObj: d,
        isCurrentMonth: false,
        isToday: new Date().toDateString() === d.toDateString(),
        events,
        totalQty: events.reduce((sum, e) => sum + parseNumber(e.quantity), 0)
      });
    }

    // Current month days
    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
      const d = new Date(year, month, dayNum);
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yyyy = d.getFullYear();
      const dateSlash = `${dd}/${mm}/${yyyy}`;
      const dateIso = `${yyyy}-${mm}-${dd}`;
      const events = filteredEvents.filter(e => e.dateSlash === dateSlash || e.dateIso === dateIso);

      cells.push({
        dayNumber: dayNum,
        dateSlash,
        dateIso,
        dateObj: d,
        isCurrentMonth: true,
        isToday: new Date().toDateString() === d.toDateString(),
        events,
        totalQty: events.reduce((sum, e) => sum + parseNumber(e.quantity), 0)
      });
    }

    // Next month filler days to complete 35 or 42 grid
    const totalCells = cells.length <= 35 ? 35 : 42;
    const remaining = totalCells - cells.length;
    for (let dayNum = 1; dayNum <= remaining; dayNum++) {
      const d = new Date(year, month + 1, dayNum);
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yyyy = d.getFullYear();
      const dateSlash = `${dd}/${mm}/${yyyy}`;
      const dateIso = `${yyyy}-${mm}-${dd}`;
      const events = filteredEvents.filter(e => e.dateSlash === dateSlash || e.dateIso === dateIso);

      cells.push({
        dayNumber: dayNum,
        dateSlash,
        dateIso,
        dateObj: d,
        isCurrentMonth: false,
        isToday: new Date().toDateString() === d.toDateString(),
        events,
        totalQty: events.reduce((sum, e) => sum + parseNumber(e.quantity), 0)
      });
    }

    return cells;
  }, [currentDate, filteredEvents]);

  // 4. Year View Data (12 Months Summary + Heatmap)
  const yearMonthsData = useMemo(() => {
    const year = currentDate.getFullYear();
    const months = [];
    const monthNames = [
      "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6",
      "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"
    ];

    for (let m = 0; m < 12; m++) {
      const mmStr = String(m + 1).padStart(2, "0");
      const monthEvents = filteredEvents.filter(e => {
        if (e.dateSlash) {
          const parts = e.dateSlash.split("/");
          return parts[1] === mmStr && parts[2] === String(year);
        }
        return false;
      });

      const totalQty = monthEvents.reduce((sum, e) => sum + parseNumber(e.quantity), 0);
      const deliveredQty = monthEvents.filter(e => e.status === "Đã giao").reduce((sum, e) => sum + parseNumber(e.quantity), 0);
      const completionRate = totalQty > 0 ? Math.round((deliveredQty / totalQty) * 100) : 0;

      months.push({
        monthIndex: m,
        monthName: monthNames[m],
        year,
        eventsCount: monthEvents.length,
        totalQty,
        deliveredQty,
        completionRate,
        events: monthEvents
      });
    }
    return months;
  }, [currentDate, filteredEvents]);

  // Total Year KPIs
  const yearKPIs = useMemo(() => {
    const totalQty = yearMonthsData.reduce((sum, m) => sum + m.totalQty, 0);
    const deliveredQty = yearMonthsData.reduce((sum, m) => sum + m.deliveredQty, 0);
    const totalTrips = yearMonthsData.reduce((sum, m) => sum + m.eventsCount, 0);
    const avgRate = totalQty > 0 ? Math.round((deliveredQty / totalQty) * 100) : 0;
    return { totalQty, deliveredQty, totalTrips, avgRate };
  }, [yearMonthsData]);

  // Title Header text based on current scale
  const headerTitle = useMemo(() => {
    const y = currentDate.getFullYear();
    const m = currentDate.getMonth() + 1;
    if (viewScale === "day") {
      return `Ngày ${dayViewDateSlash}`;
    } else if (viewScale === "week") {
      return `Tuần (${weekDays[0].dateSlash.slice(0, 5)} - ${weekDays[6].dateSlash})`;
    } else if (viewScale === "month") {
      return `Tháng ${m} / ${y}`;
    } else {
      return `Năm ${y}`;
    }
  }, [viewScale, currentDate, dayViewDateSlash, weekDays]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Header & View Scale Switcher */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.03)] p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10.5px] font-bold text-blue-600 uppercase tracking-widest bg-blue-50 px-2.5 py-0.5 rounded-md border border-blue-100">
                Logistics & Supply Schedule Master
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-xs text-slate-500 font-medium">{filteredEvents.length} chuyến giao nhận</span>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
              <CalendarIcon className="text-[#007AFF]" size={26} />
              <span>Bảng Lịch Giao Nhận Tổng Thể</span>
            </h2>
          </div>

          {/* Quick Actions (Sync Google Calendar / Export ICS / Excel) */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={handleExportICS}
              className="bg-[#007AFF] hover:bg-[#0066D6] text-white text-xs font-semibold px-3.5 py-2 rounded-xl transition shadow-sm flex items-center gap-1.5 active:scale-[0.98]"
              title="Tải file .ics để đồng bộ hàng loạt vào Apple Calendar hoặc Google Calendar"
            >
              <CalendarDays size={15} />
              <span>Đồng Bộ File Lịch (.ics)</span>
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 text-xs font-semibold px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 shadow-2xs active:scale-[0.98]"
              title="Xuất bảng đối chiếu lịch trình ra file Excel"
            >
              <FileSpreadsheet size={15} className="text-emerald-600" />
              <span>Xuất Excel</span>
            </button>
          </div>
        </div>

        {/* Scale Switcher Tabs & Navigator Bar */}
        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* 4 Scale Buttons: Ngày, Tuần, Tháng, Năm */}
          <div className="bg-[#F5F5F7] p-1 rounded-xl flex items-center border border-slate-200/60 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setViewScale("day")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                viewScale === "day" ? "bg-white text-[#007AFF] shadow-xs font-bold" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Ngày
            </button>
            <button
              type="button"
              onClick={() => setViewScale("week")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                viewScale === "week" ? "bg-white text-[#007AFF] shadow-xs font-bold" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Tuần
            </button>
            <button
              type="button"
              onClick={() => setViewScale("month")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                viewScale === "month" ? "bg-white text-[#007AFF] shadow-xs font-bold" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Tháng
            </button>
            <button
              type="button"
              onClick={() => setViewScale("year")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                viewScale === "year" ? "bg-white text-[#007AFF] shadow-xs font-bold" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Năm
            </button>
          </div>

          {/* Date Navigator */}
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-[#F5F5F7] rounded-xl p-1 border border-slate-200/60 text-xs">
              <button
                type="button"
                onClick={handlePrev}
                className="p-1.5 hover:bg-white rounded-lg text-slate-600 hover:text-slate-900 transition"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                onClick={handleToday}
                className="px-3 py-1 rounded-lg font-semibold text-slate-700 hover:bg-white transition"
              >
                Hôm nay
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="p-1.5 hover:bg-white rounded-lg text-slate-600 hover:text-slate-900 transition"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <div className="text-sm font-bold text-slate-900 font-mono tracking-tight bg-[#FBFBFD] px-3.5 py-1.5 rounded-xl border border-slate-200/60">
              {headerTitle}
            </div>
          </div>
        </div>

        {/* Global Filters Toolbar */}
        <div className="pt-2 flex flex-col sm:flex-row items-center gap-3 text-xs">
          {/* Search Box */}
          <div className="relative flex-1 w-full">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo mã PO, khách hàng, tên mặt hàng..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-[#FBFBFD] border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-xs"
            />
          </div>

          {/* Customer Filter */}
          <select
            value={selectedCustomer}
            onChange={(e) => setSelectedCustomer(e.target.value)}
            className="px-3 py-2 bg-[#FBFBFD] border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-xs font-medium text-slate-700 w-full sm:w-auto"
          >
            <option value="all">Tất cả khách hàng ({customerList.length})</option>
            {customerList.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-[#FBFBFD] border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-xs font-medium text-slate-700 w-full sm:w-auto"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="delivered">✅ Đã giao thực tế</option>
            <option value="pending">⏳ Chờ xuất kho</option>
          </select>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. SCALE: NGÀY (DAY VIEW) */}
      {/* ========================================================================= */}
      {viewScale === "day" && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.03)] p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                Lịch Trình Chi Tiết Ngày: {dayViewDateSlash}
              </h3>
              <p className="text-xs text-slate-400 font-normal mt-0.5">
                Danh sách các chuyến xe tải và đơn vị nhận hàng trong ngày
              </p>
            </div>
            <div className="text-xs font-bold text-slate-800 bg-[#F5F5F7] px-3 py-1.5 rounded-full border border-slate-200/60">
              Tổng sản lượng: <span className="text-[#007AFF] tabular-nums font-mono">{dayEvents.reduce((s, e) => s + e.quantity, 0).toLocaleString("vi-VN")} sp</span>
            </div>
          </div>

          {dayEvents.length === 0 ? (
            <div className="py-16 text-center text-slate-400 space-y-2">
              <CalendarDays size={40} className="mx-auto text-slate-300" />
              <p className="font-semibold text-sm text-slate-600">Không có chuyến giao nào trong ngày {dayViewDateSlash}</p>
              <p className="text-xs text-slate-400">Bạn có thể chọn ngày khác hoặc chuyển sang chế độ Tuần / Tháng</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {dayEvents.map((item, idx) => {
                const gCalUrl = getGoogleCalendarUrl(item);
                const isDelivered = item.status === "Đã giao";

                return (
                  <div
                    key={idx}
                    className="bg-[#FBFBFD] hover:bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs hover:shadow-md transition-all space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => onPoClick?.(item.poNumber)}
                        className="font-mono text-xs font-bold text-[#007AFF] bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-md border border-blue-100 transition cursor-pointer"
                        title="Xem hồ sơ đơn hàng PO"
                      >
                        {item.poNumber}
                      </button>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                        isDelivered ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isDelivered ? "bg-emerald-500" : "bg-amber-500"}`}></span>
                        {item.status}
                      </span>
                    </div>

                    <div>
                      <div className="text-xs font-medium text-slate-400">Khách nhận:</div>
                      <div className="text-sm font-bold text-slate-900">{item.customer}</div>
                    </div>

                    <div>
                      <div className="text-xs font-medium text-slate-400">Mặt hàng:</div>
                      <button
                        type="button"
                        onClick={() => onProductClick?.(item.product)}
                        className="text-xs font-semibold text-slate-800 hover:text-blue-600 text-left line-clamp-2 transition hover:underline cursor-pointer"
                        title="Xem chi tiết 360° sản phẩm"
                      >
                        {item.product}
                      </button>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                      <div>
                        <span className="text-[10.5px] text-slate-400 block">Số lượng giao:</span>
                        <span className="text-base font-bold text-slate-900 font-sans tabular-nums">
                          {item.quantity.toLocaleString("vi-VN")} <span className="text-xs font-normal text-slate-500">{item.unit}</span>
                        </span>
                      </div>
                      <span className="text-[10.5px] font-semibold text-purple-700 bg-purple-50 px-2 py-1 rounded-md border border-purple-200/60">
                        {item.quantity <= 400 ? "🚚 Xe 1.25T" : item.quantity <= 800 ? "🚚 Xe 3.5T" : item.quantity <= 1200 ? "🚛 Xe 5T" : "🚛 Xe 15T"}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs">
                      <a
                        href={gCalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 hover:underline text-[11px]"
                      >
                        <ExternalLink size={12} />
                        <span>Google Calendar</span>
                      </a>

                      {item.notes && (
                        <span className="text-[10px] text-slate-400 truncate max-w-[140px]" title={item.notes}>
                          {item.notes}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. SCALE: TUẦN (WEEK VIEW) */}
      {/* ========================================================================= */}
      {viewScale === "week" && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.03)] p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                Ma Trận Điều Phối Tuần ({weekDays[0].dateSlash} - {weekDays[6].dateSlash})
              </h3>
              <p className="text-xs text-slate-400 font-normal mt-0.5">
                Kế hoạch phân bổ chuyến xe tải 7 ngày trong tuần
              </p>
            </div>
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
              Tổng tuần: <strong className="font-mono tabular-nums">{weekDays.reduce((s, d) => s + d.totalQty, 0).toLocaleString("vi-VN")} sp</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
            {weekDays.map((day, idx) => (
              <div
                key={idx}
                className={`rounded-2xl border transition-all flex flex-col min-h-[320px] ${
                  day.isToday ? "bg-blue-50/30 border-[#007AFF] shadow-[0_0_0_1px_#007AFF]" : "bg-[#FBFBFD] border-slate-200/70"
                }`}
              >
                {/* Column Header */}
                <div className={`p-3 rounded-t-2xl border-b ${
                  day.isToday ? "bg-[#007AFF] text-white border-[#007AFF]" : "bg-white text-slate-800 border-slate-100"
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
                  {day.events.length > 0 && (
                    <div className={`text-[10px] mt-1 font-medium ${day.isToday ? "text-blue-100" : "text-slate-400"}`}>
                      {day.events.length} chuyến ({day.totalQty.toLocaleString("vi-VN")} sp)
                    </div>
                  )}
                </div>

                {/* Day Cards */}
                <div className="p-2 space-y-2 flex-1 overflow-y-auto max-h-[460px]">
                  {day.events.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-3 text-slate-300 text-[11px]">
                      <span>Trống lịch</span>
                    </div>
                  ) : (
                    day.events.map((ev, eIdx) => {
                      const gUrl = getGoogleCalendarUrl(ev);
                      return (
                        <div
                          key={eIdx}
                          className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-2xs hover:shadow-sm transition space-y-1.5 text-xs group"
                        >
                          <div className="flex items-start justify-between gap-1">
                            <span className="font-bold text-slate-900 text-[11px] line-clamp-1">{ev.customer}</span>
                            <span className="text-[9.5px] font-mono text-[#007AFF] bg-blue-50 px-1.5 py-0.5 rounded font-semibold shrink-0">
                              {ev.poNumber}
                            </span>
                          </div>

                          <div className="text-[10.5px] text-slate-600 font-medium line-clamp-2 leading-snug" title={ev.product}>
                            {ev.product}
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[11px]">
                            <span className="font-bold text-slate-900 tabular-nums">
                              {ev.quantity.toLocaleString("vi-VN")} <span className="text-[10px] font-normal text-slate-500">{ev.unit}</span>
                            </span>
                            <span className="text-[9.5px] font-semibold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded">
                              {ev.quantity <= 400 ? "🚚 1.25T" : ev.quantity <= 800 ? "🚚 3.5T" : ev.quantity <= 1200 ? "🚛 5T" : "🚛 15T"}
                            </span>
                          </div>

                          <div className="pt-1 border-t border-slate-100 flex items-center justify-between text-[10.5px]">
                            <a
                              href={gUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 hover:underline"
                            >
                              <ExternalLink size={10} />
                              <span>Google Cal</span>
                            </a>
                            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${
                              ev.status === "Đã giao" ? "text-emerald-700 bg-emerald-50" : "text-amber-700 bg-amber-50"
                            }`}>
                              {ev.status}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. SCALE: THÁNG (MONTH VIEW - APPLE / GOOGLE CALENDAR GRID) */}
      {/* ========================================================================= */}
      {viewScale === "month" && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.03)] p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                Lịch Toàn Cảnh Tháng {currentDate.getMonth() + 1} / {currentDate.getFullYear()}
              </h3>
              <p className="text-xs text-slate-400 font-normal mt-0.5">
                Nhấp vào bất kỳ ô ngày nào để xem chi tiết danh sách chuyến xe giao hàng
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="flex items-center gap-1.5 text-slate-500 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Đã giao
              </span>
              <span className="flex items-center gap-1.5 text-slate-500 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Chờ xuất
              </span>
            </div>
          </div>

          {/* Month Calendar Grid */}
          <div className="rounded-2xl border border-slate-200/80 overflow-hidden">
            {/* Days of Week Header */}
            <div className="grid grid-cols-7 bg-[#F5F5F7] border-b border-slate-200 text-center text-[11px] font-bold text-slate-600 py-2.5">
              <div>Thứ 2</div>
              <div>Thứ 3</div>
              <div>Thứ 4</div>
              <div>Thứ 5</div>
              <div>Thứ 6</div>
              <div>Thứ 7</div>
              <div>Chủ Nhật</div>
            </div>

            {/* Grid Cells */}
            <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 bg-white">
              {monthGridDays.map((cell, idx) => (
                <div
                  key={idx}
                  onClick={() => cell.events.length > 0 && setSelectedDayDetail({ dateSlash: cell.dateSlash, dateObj: cell.dateObj, plans: cell.events })}
                  className={`min-h-[105px] sm:min-h-[120px] p-2 transition-all flex flex-col justify-between ${
                    cell.isCurrentMonth ? "bg-white text-slate-800" : "bg-slate-50/50 text-slate-400"
                  } ${cell.isToday ? "ring-2 ring-inset ring-[#007AFF] bg-blue-50/20" : ""} ${
                    cell.events.length > 0 ? "cursor-pointer hover:bg-blue-50/40" : ""
                  }`}
                >
                  {/* Date Number Header */}
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold tabular-nums w-6 h-6 rounded-full flex items-center justify-center ${
                      cell.isToday ? "bg-[#007AFF] text-white" : cell.isCurrentMonth ? "text-slate-900" : "text-slate-400"
                    }`}>
                      {cell.dayNumber}
                    </span>
                    {cell.events.length > 0 && (
                      <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-md">
                        {cell.events.length} chuyến
                      </span>
                    )}
                  </div>

                  {/* Cell Events Preview */}
                  <div className="space-y-1 my-1 flex-1 overflow-hidden">
                    {cell.events.slice(0, 2).map((ev, eIdx) => (
                      <div
                        key={eIdx}
                        className={`text-[10px] px-1.5 py-0.5 rounded font-medium truncate leading-tight ${
                          ev.status === "Đã giao"
                            ? "bg-emerald-50 text-emerald-800 border border-emerald-200/60"
                            : "bg-amber-50 text-amber-800 border border-amber-200/60"
                        }`}
                        title={`${ev.customer} - ${ev.product} (${ev.quantity.toLocaleString('vi-VN')} ${ev.unit})`}
                      >
                        <strong>{ev.customer}:</strong> {ev.quantity.toLocaleString("vi-VN")}
                      </div>
                    ))}
                    {cell.events.length > 2 && (
                      <div className="text-[9.5px] font-semibold text-slate-400 pl-1">
                        +{cell.events.length - 2} đơn khác...
                      </div>
                    )}
                  </div>

                  {/* Bottom Qty Sum */}
                  {cell.totalQty > 0 && (
                    <div className="text-[10px] font-bold text-slate-700 text-right tabular-nums pt-1 border-t border-slate-100">
                      {cell.totalQty.toLocaleString("vi-VN")} sp
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. SCALE: NĂM (YEAR VIEW & HEATMAP SUMMARY) */}
      {/* ========================================================================= */}
      {viewScale === "year" && (
        <div className="space-y-6">
          {/* Year Top 4 Financial & Volume KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-[0_2px_10px_rgba(0,0,0,0.02)] space-y-2">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Tổng Sản Lượng Kế Hoạch Năm
              </span>
              <div className="text-2xl font-bold text-slate-900 font-sans tabular-nums tracking-tight">
                {yearKPIs.totalQty.toLocaleString("vi-VN")} <span className="text-xs font-normal text-slate-400">sản phẩm</span>
              </div>
              <div className="text-[11px] text-slate-400 font-normal">Toàn bộ 12 tháng năm {currentDate.getFullYear()}</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-[0_2px_10px_rgba(0,0,0,0.02)] space-y-2">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Đã Thực Giao (PXK)
              </span>
              <div className="text-2xl font-bold text-emerald-600 font-sans tabular-nums tracking-tight">
                {yearKPIs.deliveredQty.toLocaleString("vi-VN")} <span className="text-xs font-normal text-slate-400">sản phẩm</span>
              </div>
              <div className="text-[11px] text-slate-400 font-normal">Biên bản bàn giao ký nhận</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-[0_2px_10px_rgba(0,0,0,0.02)] space-y-2">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Tổng Chuyến Xe Điều Phối
              </span>
              <div className="text-2xl font-bold text-[#007AFF] font-sans tabular-nums tracking-tight">
                {yearKPIs.totalTrips.toLocaleString("vi-VN")} <span className="text-xs font-normal text-slate-400">chuyến</span>
              </div>
              <div className="text-[11px] text-slate-400 font-normal">Vận chuyển liên tỉnh & kho</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-[0_2px_10px_rgba(0,0,0,0.02)] space-y-2">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Tỷ Lệ Hoàn Thành Năm
              </span>
              <div className="text-2xl font-bold text-slate-900 font-sans tabular-nums tracking-tight">
                {yearKPIs.avgRate}%
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${Math.min(yearKPIs.avgRate, 100)}%` }} />
              </div>
            </div>
          </div>

          {/* 12 Months Bento Grid */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.03)] p-6 space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">
                Phân Bổ Sản Lượng 12 Tháng Năm {currentDate.getFullYear()}
              </h3>
              <p className="text-xs text-slate-400 font-normal mt-0.5">
                Bảng theo dõi kế hoạch giao hàng định kỳ qua từng tháng
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {yearMonthsData.map((m, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    const d = new Date(currentDate);
                    d.setMonth(m.monthIndex);
                    setCurrentDate(d);
                    setViewScale("month");
                  }}
                  className="bg-[#FBFBFD] hover:bg-blue-50/40 rounded-2xl border border-slate-200/80 p-4 space-y-3 cursor-pointer transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-sm group-hover:text-[#007AFF] transition">
                      {m.monthName}
                    </span>
                    <span className="text-[10px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                      {m.eventsCount} chuyến
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Kế hoạch:</span>
                      <span className="font-bold text-slate-900 tabular-nums">{m.totalQty.toLocaleString("vi-VN")} sp</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Đã giao:</span>
                      <span className="font-bold text-emerald-600 tabular-nums">{m.deliveredQty.toLocaleString("vi-VN")} sp</span>
                    </div>
                  </div>

                  <div className="space-y-1 pt-1 border-t border-slate-200/60">
                    <div className="flex justify-between text-[10.5px]">
                      <span className="text-slate-500">Hoàn thành:</span>
                      <span className="font-bold text-slate-800">{m.completionRate}%</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-[#007AFF] h-full rounded-full" style={{ width: `${Math.min(m.completionRate, 100)}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DAY DETAIL POPUP MODAL (When clicking on a cell in Month Grid) */}
      {/* ========================================================================= */}
      {selectedDayDetail && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <CalendarDays className="text-[#007AFF]" size={20} />
                  <span>Chi Tiết Giao Hàng Ngày {selectedDayDetail.dateSlash}</span>
                </h3>
                <p className="text-xs text-slate-400">
                  {selectedDayDetail.plans.length} chuyến xe điều phối
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDayDetail(null)}
                className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-700 transition"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {selectedDayDetail.plans.map((item, idx) => {
                const gCal = getGoogleCalendarUrl(item);
                return (
                  <div key={idx} className="p-3.5 bg-[#FBFBFD] rounded-xl border border-slate-200/80 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 text-sm">{item.customer}</span>
                      <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                        {item.poNumber}
                      </span>
                    </div>

                    <div className="text-slate-600 font-medium">{item.product}</div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                      <div>
                        <span className="text-slate-400 mr-1">Số lượng:</span>
                        <strong className="text-slate-900 tabular-nums">{item.quantity.toLocaleString("vi-VN")} {item.unit}</strong>
                      </div>
                      <span className={`px-2 py-0.5 rounded font-semibold text-[10px] ${
                        item.status === "Đã giao" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                      }`}>
                        {item.status}
                      </span>
                    </div>

                    <div className="pt-1.5 flex items-center justify-between border-t border-slate-100">
                      <a
                        href={gCal}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 hover:underline text-[11px]"
                      >
                        <ExternalLink size={11} />
                        <span>Thêm vào Google Calendar</span>
                      </a>
                      {item.notes && <span className="text-slate-400 italic text-[11px]">{item.notes}</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedDayDetail(null)}
                className="px-5 py-2 bg-slate-900 text-white font-semibold rounded-xl text-xs hover:bg-slate-800 transition"
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
