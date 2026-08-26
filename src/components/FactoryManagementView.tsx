import React, { useState, useMemo } from "react";
import { 
  Factory, 
  Package, 
  Layers, 
  FileText, 
  Truck, 
  TrendingUp, 
  TrendingDown, 
  Search, 
  Filter, 
  Download, 
  Printer, 
  Plus, 
  Sparkles, 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  ChevronDown, 
  ChevronRight, 
  Calendar, 
  Boxes, 
  Scale, 
  ShieldCheck, 
  BarChart3, 
  PieChart as PieChartIcon, 
  ArrowUpRight, 
  RefreshCw,
  Sliders,
  Maximize2
} from "lucide-react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, Legend 
} from "recharts";
import * as XLSX from "xlsx";
import { toast } from "react-hot-toast";
import clsx from "clsx";
import factoryDataRaw from "../data/factory_imported.json";

interface FactoryManagementViewProps {
  selectedRegion?: "north" | "all" | "south";
  onNavigateTab?: (tab: string) => void;
}

export default function FactoryManagementView({ 
  selectedRegion = "all",
  onNavigateTab 
}: FactoryManagementViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<"overview" | "nksx" | "finished" | "materials" | "standards">("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCustomer, setFilterCustomer] = useState<string>("all");
  const [filterGsm, setFilterGsm] = useState<string>("all");

  const numFormatter = new Intl.NumberFormat("vi-VN");

  // Raw data from imported factory sheets
  const catalog = factoryDataRaw.products_catalog || [];
  const finishedGoods = factoryDataRaw.finished_goods_inventory || [];
  const productionLogs = factoryDataRaw.production_logs || [];
  const materials = factoryDataRaw.materials_inventory || [];
  const lossRates = factoryDataRaw.loss_rates || [];
  const coreWeights = factoryDataRaw.core_pipe_weights || [];

  // Filtered Production Logs (NKSX)
  const filteredLogs = useMemo(() => {
    return productionLogs.filter(item => {
      // Search
      const matchSearch = searchQuery === "" || 
        String(item.order_no || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(item.lsx || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(item.customer || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(item.tp_code || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(item.nvl_code || "").toLowerCase().includes(searchQuery.toLowerCase());

      // Filter customer
      const matchCust = filterCustomer === "all" || item.customer === filterCustomer;
      
      // Filter gsm
      const matchGsm = filterGsm === "all" || String(item.gsm) === filterGsm;

      return matchSearch && matchCust && matchGsm;
    });
  }, [productionLogs, searchQuery, filterCustomer, filterGsm]);

  // Overall Statistics
  const stats = useMemo(() => {
    const totalCutKg = productionLogs.reduce((acc, cur) => acc + (Number(cur.weight_kg) || 0), 0);
    const totalFinishedRolls = finishedGoods.reduce((acc, cur) => acc + (Number(cur.in_qty) || 0), 0);
    const totalCurrentStockRolls = finishedGoods.reduce((acc, cur) => acc + (Number(cur.closing_stock) || 0), 0);
    const totalExportRolls = finishedGoods.reduce((acc, cur) => acc + (Number(cur.out_qty) || 0), 0);
    const totalSuppliesItems = materials.length;

    // By Customer Distribution
    const custMap: Record<string, number> = {};
    productionLogs.forEach(log => {
      const c = log.customer || "Khác";
      custMap[c] = (custMap[c] || 0) + (Number(log.weight_kg) || 0);
    });

    const custChartData = Object.entries(custMap).map(([name, value]) => ({
      name: name === "BBMN" ? "Bao Bì Miền Nam (Bến Tre/SG)" : name,
      value
    })).sort((a, b) => b.value - a.value);

    // By TP Code Top Output
    const tpMap: Record<string, number> = {};
    productionLogs.forEach(log => {
      const tp = log.tp_code || "Khác";
      tpMap[tp] = (tpMap[tp] || 0) + (Number(log.weight_kg) || 0);
    });

    const tpChartData = Object.entries(tpMap).map(([name, value]) => ({
      name,
      value
    })).sort((a, b) => b.value - a.value).slice(0, 6);

    return {
      totalCutKg,
      totalFinishedRolls,
      totalCurrentStockRolls,
      totalExportRolls,
      totalSuppliesItems,
      custChartData,
      tpChartData
    };
  }, [productionLogs, finishedGoods, materials]);

  const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899", "#06B6D4", "#64748B"];

  // Export to Excel
  const handleExportExcel = () => {
    try {
      const wb = XLSX.utils.book_new();
      
      // Sheet 1: NKSX
      const wsNKSX = XLSX.utils.json_to_sheet(filteredLogs);
      XLSX.utils.book_append_sheet(wb, wsNKSX, "NKSX_Cat_Cuon");

      // Sheet 2: Thanh pham
      const wsTP = XLSX.utils.json_to_sheet(finishedGoods);
      XLSX.utils.book_append_sheet(wb, wsTP, "Ton_Kho_LGT");

      // Sheet 3: Vat tu
      const wsVT = XLSX.utils.json_to_sheet(materials);
      XLSX.utils.book_append_sheet(wb, wsVT, "Vat_Tu_Nha_May");

      XLSX.writeFile(wb, `Bao_Cao_Nha_May_Tam_Sen_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success("Đã xuất báo cáo nhà máy ra file Excel!");
    } catch (e) {
      console.error(e);
      toast.error("Lỗi khi xuất file Excel!");
    }
  };

  return (
    <div className="space-y-6 max-w-[1750px] mx-auto p-3 sm:p-6 lg:p-8 font-sans animate-in fade-in duration-200 text-slate-800 dark:text-slate-100">
      
      {/* 🌟 HERO HEADER */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[#1E293B] via-[#0F172A] to-[#1E293B] rounded-3xl p-6 sm:p-8 text-white shadow-2xl border border-slate-700/60">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-96 h-96 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 -mb-10 w-80 h-80 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-300 text-[11px] font-extrabold uppercase tracking-wider backdrop-blur-md">
                <Factory size={13} className="text-amber-400" />
                Nhà Máy Sản Xuất Tâm Sen (Miền Bắc)
              </span>
              <span className="text-slate-500">•</span>
              <div className="flex items-center gap-1.5 text-xs text-slate-300 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                <span>Cung ứng Lưỡi Gà Trắng Toàn Quốc (Bắc - Nam)</span>
              </div>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
              <span>Quản Lý Sản Xuất & Kho Nhà Máy Lưỡi Gà Trắng</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-3xl leading-relaxed">
              Theo dõi toàn diện quá trình cắt cuộn từ Giấy mẹ NVL, Quản lý lệnh sản xuất (LSX/PO), Tồn kho thành phẩm Lưỡi gà trắng (LGT) và Định mức hao hụt xuất xưởng cấp cho Miền Bắc & Miền Nam.
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={handleExportExcel}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs font-bold shadow-lg shadow-emerald-600/20 transition flex items-center gap-2 cursor-pointer"
            >
              <Download size={15} />
              <span>Xuất Sổ Nhà Máy (Excel)</span>
            </button>

            <button
              onClick={() => onNavigateTab && onNavigateTab("logistics")}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 border border-white/15 text-white rounded-2xl text-xs font-semibold backdrop-blur-md transition flex items-center gap-2 cursor-pointer"
            >
              <Truck size={15} className="text-amber-300" />
              <span>Liên Kết Điều Độ Logistics</span>
            </button>
          </div>
        </div>
      </div>

      {/* 📊 5 CORE STATS KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Tổng Sản Lượng Cắt</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center">
              <Scale size={16} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
            {numFormatter.format(Math.round(stats.totalCutKg))} <span className="text-xs font-bold text-slate-400">Kg</span>
          </div>
          <div className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
            <TrendingUp size={13} />
            <span>123+ Lô lệnh sản xuất (LSX)</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Thành Phẩm Nhập Cắt</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
              <Package size={16} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
            {numFormatter.format(stats.totalFinishedRolls)} <span className="text-xs font-bold text-slate-400">Cuộn</span>
          </div>
          <div className="text-[11px] text-slate-500 font-medium">
            Quy cách chuẩn 800m/cuộn
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Đã Xuất Giao Khách</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 flex items-center justify-center">
              <Truck size={16} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
            {numFormatter.format(stats.totalExportRolls)} <span className="text-xs font-bold text-slate-400">Cuộn</span>
          </div>
          <div className="text-[11px] text-indigo-600 font-bold">
            Cấp cả Miền Bắc & Nam
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Tồn Kho Cuối Ngày</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center">
              <Boxes size={16} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
            {numFormatter.format(stats.totalCurrentStockRolls)} <span className="text-xs font-bold text-slate-400">Cuộn</span>
          </div>
          <div className="text-[11px] text-amber-600 font-bold">
            Sẵn sàng xuất xưởng
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Vật Tư & Nòng Ống</span>
            <div className="w-8 h-8 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 flex items-center justify-center">
              <Layers size={16} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
            {stats.totalSuppliesItems} <span className="text-xs font-bold text-slate-400">Danh mục</span>
          </div>
          <div className="text-[11px] text-teal-600 font-medium">
            Pallet gỗ, Nẹp, Lõi phi 120
          </div>
        </div>
      </div>

      {/* 🧭 SUB-NAVIGATION TABS */}
      <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 pb-3 gap-3 overflow-x-auto">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={() => setActiveSubTab("overview")}
            className={clsx(
              "px-3.5 sm:px-4 py-2 rounded-2xl text-xs font-extrabold transition flex items-center gap-2 cursor-pointer shrink-0",
              activeSubTab === "overview"
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            )}
          >
            <BarChart3 size={15} />
            <span>1. Báo Cáo & Phân Bổ Bắc - Nam</span>
          </button>

          <button
            onClick={() => setActiveSubTab("nksx")}
            className={clsx(
              "px-3.5 sm:px-4 py-2 rounded-2xl text-xs font-extrabold transition flex items-center gap-2 cursor-pointer shrink-0",
              activeSubTab === "nksx"
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            )}
          >
            <FileText size={15} />
            <span>2. Nhật Ký Sản Xuất (NKSX)</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
              {productionLogs.length}
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab("finished")}
            className={clsx(
              "px-3.5 sm:px-4 py-2 rounded-2xl text-xs font-extrabold transition flex items-center gap-2 cursor-pointer shrink-0",
              activeSubTab === "finished"
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            )}
          >
            <Package size={15} />
            <span>3. Tồn Kho Thành Phẩm LGT</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
              {finishedGoods.length}
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab("materials")}
            className={clsx(
              "px-3.5 sm:px-4 py-2 rounded-2xl text-xs font-extrabold transition flex items-center gap-2 cursor-pointer shrink-0",
              activeSubTab === "materials"
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            )}
          >
            <Boxes size={15} />
            <span>4. Kho Vật Tư & Phụ Trợ</span>
          </button>

          <button
            onClick={() => setActiveSubTab("standards")}
            className={clsx(
              "px-3.5 sm:px-4 py-2 rounded-2xl text-xs font-extrabold transition flex items-center gap-2 cursor-pointer shrink-0",
              activeSubTab === "standards"
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            )}
          >
            <ShieldCheck size={15} />
            <span>5. Định Mức & Lõi Nòng Ống</span>
          </button>
        </div>
      </div>

      {/* ================= TAB 1: OVERVIEW & CHARTS ================= */}
      {activeSubTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Chart 1: Customer Allocation (Bắc vs Nam) */}
            <div className="lg:col-span-6 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                    <PieChartIcon className="text-blue-600" size={17} />
                    <span>Cơ Cấu Sản Lượng Cấp Hàng Bắc - Nam (Kg)</span>
                  </h3>
                  <p className="text-xs text-slate-500">Phân bổ theo đối tác đặt hàng sản xuất</p>
                </div>
              </div>

              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.custChartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      innerRadius={45}
                      paddingAngle={3}
                      label={({ name, percent }) => `${name.slice(0, 10)}...: ${(percent * 100).toFixed(0)}%`}
                    >
                      {stats.custChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val: any) => [`${numFormatter.format(val)} Kg`, "Khối lượng"]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                {stats.custChartData.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                      <span className="font-bold text-slate-700 dark:text-slate-300 truncate">{item.name}</span>
                    </div>
                    <span className="font-mono font-bold text-slate-900 dark:text-white shrink-0">
                      {numFormatter.format(Math.round(item.value))} Kg
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Chart 2: Top LGT Product Codes */}
            <div className="lg:col-span-6 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                    <BarChart3 className="text-emerald-600" size={17} />
                    <span>Top Mã Sản Phẩm Lưỡi Gà Trắng Cắt Nhiều Nhất</span>
                  </h3>
                  <p className="text-xs text-slate-500">Khối lượng sản xuất theo mã thành phẩm</p>
                </div>
              </div>

              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.tpChartData} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                    <XAxis dataKey="name" angle={-15} textAnchor="end" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(val: any) => [`${numFormatter.format(val)} Kg`, "Sản lượng"]} />
                    <Bar dataKey="value" fill="#10B981" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="p-3 bg-emerald-50/70 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200/70 dark:border-emerald-800/60 text-xs text-emerald-900 dark:text-emerald-200 leading-relaxed">
                💡 <strong>Nhận định:</strong> Các mã <em>LGT250/90-TS, LGT210/71-TS, LGT230/79-TS</em> chiếm trên 70% tổng khối lượng cắt tại nhà máy phục vụ cho đơn hàng miền Bắc và chuyển miền Nam.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 2: NKSX LOGS ================= */}
      {activeSubTab === "nksx" && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-4">
          
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[240px] max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm theo Số ĐH, LSX, Khách hàng, Mã TP, Mã NVL..."
                className="w-full pl-9 pr-4 py-2 bg-slate-100 dark:bg-slate-800/80 rounded-2xl text-xs outline-none border border-transparent focus:border-blue-500 text-slate-900 dark:text-white placeholder:text-slate-400"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={filterCustomer}
                onChange={(e) => setFilterCustomer(e.target.value)}
                className="px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 outline-none border border-slate-200/60 dark:border-slate-700 cursor-pointer"
              >
                <option value="all">Tất cả Khách hàng</option>
                <option value="BBMN">Bao Bì Miền Nam (BBMN)</option>
                <option value="Thăng Long">Thuốc lá Thăng Long</option>
                <option value="Bắc Sơn">Thuốc lá Bắc Sơn</option>
                <option value="Thanh Hóa">Thuốc lá Thanh Hóa</option>
              </select>

              <select
                value={filterGsm}
                onChange={(e) => setFilterGsm(e.target.value)}
                className="px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 outline-none border border-slate-200/60 dark:border-slate-700 cursor-pointer"
              >
                <option value="all">Tất cả Định lượng</option>
                <option value="210">210 GSM</option>
                <option value="230">230 GSM</option>
                <option value="250">250 GSM</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200/70 dark:border-slate-800">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 font-extrabold uppercase text-[10.5px] tracking-wider border-b border-slate-200/70 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-3.5">Ngày Cắt</th>
                  <th className="py-3 px-3.5">Số ĐH / PO</th>
                  <th className="py-3 px-3.5">Lệnh SX (LSX)</th>
                  <th className="py-3 px-3.5">Khách Hàng</th>
                  <th className="py-3 px-3.5">Mã NVL Giấy Mẹ</th>
                  <th className="py-3 px-3.5">Loại Giấy</th>
                  <th className="py-3 px-3.5 text-center">ĐL (Gsm)</th>
                  <th className="py-3 px-3.5 text-center">Khổ (cm)</th>
                  <th className="py-3 px-3.5 text-right">Trọng Lượng (Kg)</th>
                  <th className="py-3 px-3.5">Mã TP Cắt Ra</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {filteredLogs.slice(0, 100).map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                    <td className="py-2.5 px-3.5 font-mono text-slate-500">{row.date || "—"}</td>
                    <td className="py-2.5 px-3.5 font-bold text-blue-600 dark:text-blue-400">{row.order_no || "—"}</td>
                    <td className="py-2.5 px-3.5 font-mono text-slate-700 dark:text-slate-300">{row.lsx || "—"}</td>
                    <td className="py-2.5 px-3.5">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-bold text-[11px]">
                        {row.customer || "Chung"}
                      </span>
                    </td>
                    <td className="py-2.5 px-3.5 font-mono text-indigo-600 dark:text-indigo-400 font-bold">{row.nvl_code || "—"}</td>
                    <td className="py-2.5 px-3.5 text-slate-700 dark:text-slate-300">{row.paper_type || "—"}</td>
                    <td className="py-2.5 px-3.5 text-center font-bold">{row.gsm || "—"}</td>
                    <td className="py-2.5 px-3.5 text-center font-mono">{row.width_cm || "—"}</td>
                    <td className="py-2.5 px-3.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                      {row.weight_kg ? numFormatter.format(row.weight_kg) : "—"}
                    </td>
                    <td className="py-2.5 px-3.5">
                      <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-mono font-bold text-[11px]">
                        {row.tp_code || "—"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= TAB 3: FINISHED GOODS ================= */}
      {activeSubTab === "finished" && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                Bảng Cân Đối Xuất Nhập Tồn Thành Phẩm Lưỡi Gà Trắng (LGT)
              </h3>
              <p className="text-xs text-slate-500">Đơn vị tính: Cuộn (800 mét / cuộn)</p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200/70 dark:border-slate-800">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 font-extrabold uppercase text-[10.5px] tracking-wider border-b border-slate-200/70 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-3.5">Mã TP</th>
                  <th className="py-3 px-3.5">Tên Sản Phẩm Lưỡi Gà</th>
                  <th className="py-3 px-3.5 text-center">ĐL (Gsm)</th>
                  <th className="py-3 px-3.5 text-center">Khổ (mm)</th>
                  <th className="py-3 px-3.5 text-center">Dài (m)</th>
                  <th className="py-3 px-3.5 text-right">Tồn Đầu Kỳ</th>
                  <th className="py-3 px-3.5 text-right text-emerald-600">Nhập Cắt</th>
                  <th className="py-3 px-3.5 text-right text-purple-600">Xuất Giao</th>
                  <th className="py-3 px-3.5 text-right text-amber-600 font-bold">Tồn Cuối Kỳ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {finishedGoods.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                    <td className="py-3 px-3.5 font-mono font-bold text-blue-600 dark:text-blue-400">{item.code}</td>
                    <td className="py-3 px-3.5 font-bold text-slate-800 dark:text-slate-200">{item.name}</td>
                    <td className="py-3 px-3.5 text-center">{item.gsm}</td>
                    <td className="py-3 px-3.5 text-center font-mono">{item.width_mm}</td>
                    <td className="py-3 px-3.5 text-center font-mono">{item.length_m}</td>
                    <td className="py-3 px-3.5 text-right font-mono">{numFormatter.format(item.opening_stock)}</td>
                    <td className="py-3 px-3.5 text-right font-mono font-bold text-emerald-600">{numFormatter.format(item.in_qty)}</td>
                    <td className="py-3 px-3.5 text-right font-mono font-bold text-purple-600">{numFormatter.format(item.out_qty)}</td>
                    <td className="py-3 px-3.5 text-right font-mono font-bold text-amber-600 text-sm">{numFormatter.format(item.closing_stock)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= TAB 4: MATERIALS & SUPPLIES ================= */}
      {activeSubTab === "materials" && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                Kho Vật Tư Phụ Trợ Sản Xuất & Đóng Gói
              </h3>
              <p className="text-xs text-slate-500">Pallet gỗ, Nẹp thùng, Ống lõi giấy nòng cuộn</p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200/70 dark:border-slate-800">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 font-extrabold uppercase text-[10.5px] tracking-wider border-b border-slate-200/70 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-3.5">Mã Hàng</th>
                  <th className="py-3 px-3.5">Tên Vật Tư</th>
                  <th className="py-3 px-3.5 text-center">ĐVT</th>
                  <th className="py-3 px-3.5 text-right">Tồn Đầu</th>
                  <th className="py-3 px-3.5 text-right text-emerald-600">Nhập</th>
                  <th className="py-3 px-3.5 text-right text-purple-600">Xuất Dùng</th>
                  <th className="py-3 px-3.5 text-right text-amber-600 font-bold">Tồn Cuối</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {materials.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                    <td className="py-3 px-3.5 font-mono font-bold text-teal-600">{item.code}</td>
                    <td className="py-3 px-3.5 font-bold text-slate-800 dark:text-slate-200">{item.name}</td>
                    <td className="py-3 px-3.5 text-center font-medium text-slate-500">{item.unit}</td>
                    <td className="py-3 px-3.5 text-right font-mono">{numFormatter.format(item.opening_stock)}</td>
                    <td className="py-3 px-3.5 text-right font-mono font-bold text-emerald-600">{numFormatter.format(item.in_qty)}</td>
                    <td className="py-3 px-3.5 text-right font-mono font-bold text-purple-600">{numFormatter.format(item.out_qty)}</td>
                    <td className="py-3 px-3.5 text-right font-mono font-bold text-amber-600">{numFormatter.format(item.closing_stock)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= TAB 5: STANDARDS & CORE LOSS ================= */}
      {activeSubTab === "standards" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Loss Rates Table */}
          <div className="lg:col-span-6 bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-4">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="text-purple-600" size={18} />
              <span>Bảng Định Mức Hao Hụt Cắt Cuộn Giấy</span>
            </h3>

            <div className="overflow-x-auto rounded-2xl border border-slate-200/70 dark:border-slate-800">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 font-extrabold uppercase text-[10.5px] tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3">Loại Giấy</th>
                    <th className="py-2.5 px-3">Hiệu Giấy / Xuất Xứ</th>
                    <th className="py-2.5 px-3 text-right">Định Mức Hao Hụt (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {lossRates.slice(0, 15).map((r, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60 transition">
                      <td className="py-2 px-3 font-bold text-slate-800 dark:text-slate-200">{r.paper_type}</td>
                      <td className="py-2 px-3 text-slate-600 dark:text-slate-400">{r.brand}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-purple-600">{r.loss_rate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Core Pipe Weights Table */}
          <div className="lg:col-span-6 bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-4">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Scale className="text-teal-600" size={18} />
              <span>Bảng Trừ Khối Lượng Nòng Ống Lõi Giấy</span>
            </h3>

            <div className="overflow-x-auto rounded-2xl border border-slate-200/70 dark:border-slate-800">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 font-extrabold uppercase text-[10.5px] tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3">Loại Giấy</th>
                    <th className="py-2.5 px-3">Tên Giấy</th>
                    <th className="py-2.5 px-3 text-center">Khổ (cm)</th>
                    <th className="py-2.5 px-3 text-right">KL Nòng (Kg)</th>
                    <th className="py-2.5 px-3 text-right text-teal-600 font-bold">KL TB / 1cm</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {coreWeights.map((r, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60 transition">
                      <td className="py-2 px-3 font-bold text-slate-800 dark:text-slate-200">{r.paper_type}</td>
                      <td className="py-2 px-3 text-slate-600 dark:text-slate-400">{r.name}</td>
                      <td className="py-2 px-3 text-center font-mono">{r.width_cm || "—"}</td>
                      <td className="py-2 px-3 text-right font-mono">{r.weight_kg || "—"}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-teal-600">{r.avg_per_cm || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
