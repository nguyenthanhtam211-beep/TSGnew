const fs = require('fs');

const code = `import React, { useMemo, useState } from 'react';
import { Package, Truck, FileText, CheckCircle, Clock, AlertTriangle, ArrowUpRight, TrendingUp, DollarSign, ShieldAlert, BarChart3, Activity, Filter, PieChart as PieChartIcon, ShoppingCart, Users, Briefcase, Star } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';

export default function DashboardView({ poData, deliveryData, poLinesData }: { poData: any[], deliveryData: any[], poLinesData: any[] }) {
  const [timeFilter, setTimeFilter] = useState("all");

  const formatter = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });
  const numFormatter = new Intl.NumberFormat('vi-VN');

  // Lọc dữ liệu theo thời gian
  const filteredDelivery = useMemo(() => {
    return deliveryData.filter(d => {
      if (timeFilter === "all") return true;
      const month = parseInt(d["Tháng"]);
      if (isNaN(month)) return true;
      if (timeFilter === "q1") return month >= 1 && month <= 3;
      if (timeFilter === "q2") return month >= 4 && month <= 6;
      if (timeFilter === "q3") return month >= 7 && month <= 9;
      if (timeFilter === "q4") return month >= 10 && month <= 12;
      
      if (timeFilter.startsWith("m")) {
        return month === parseInt(timeFilter.replace("m", ""));
      }
      return true;
    });
  }, [deliveryData, timeFilter]);

  // Quick metrics calculations
  const totalOrders = poData.length;
  
  const totalRevenue = useMemo(() => {
    return filteredDelivery.reduce((acc, curr) => {
      const val = parseFloat(String(curr["Doanh thu"] || "0").replace(/,/g, ''));
      return acc + (isNaN(val) ? 0 : val);
    }, 0);
  }, [filteredDelivery]);

  const totalProfit = useMemo(() => {
    return filteredDelivery.reduce((acc, curr) => {
      const val = parseFloat(String(curr["Lợi nhuận gộp"] || curr["Lợi nhuận dòng"] || "0").replace(/,/g, ''));
      return acc + (isNaN(val) ? 0 : val);
    }, 0);
  }, [filteredDelivery]);

  const completedDeliveries = useMemo(() => {
    return filteredDelivery.filter(d => d["Status"] === "Hoàn thành").length;
  }, [filteredDelivery]);

  const inProgressDeliveries = useMemo(() => {
    return filteredDelivery.filter(d => d["Status"] !== "Hoàn thành").length;
  }, [filteredDelivery]);

  // --- STATS BY CUSTOMER ---
  const customerStats = useMemo(() => {
    const map = new Map<string, {name: string, revenue: number, profit: number, volume: number}>();
    filteredDelivery.forEach(d => {
       const customer = d["Khách hàng"] || "Khác";
       const rev = parseFloat(String(d["Doanh thu"] || "0").replace(/,/g, '')) || 0;
       const prof = parseFloat(String(d["Lợi nhuận gộp"] || d["Lợi nhuận dòng"] || "0").replace(/,/g, '')) || 0;
       const vol = parseFloat(String(d["Số lượng giao"] || "0").replace(/,/g, '')) || 0;
       
       if (!map.has(customer)) map.set(customer, { name: customer, revenue: 0, profit: 0, volume: 0 });
       const item = map.get(customer)!;
       item.revenue += rev;
       item.profit += prof;
       item.volume += vol;
    });
    return Array.from(map.values()).sort((a,b) => b.revenue - a.revenue).slice(0, 5);
  }, [filteredDelivery]);

  // --- STATS BY CATEGORY ---
  const categoryStats = useMemo(() => {
    const map = new Map<string, {name: string, revenue: number, profit: number, volume: number}>();
    filteredDelivery.forEach(d => {
       const category = d["Nhóm hàng"] || d["Danh mục"] || "Khác";
       const rev = parseFloat(String(d["Doanh thu"] || "0").replace(/,/g, '')) || 0;
       const prof = parseFloat(String(d["Lợi nhuận gộp"] || d["Lợi nhuận dòng"] || "0").replace(/,/g, '')) || 0;
       const vol = parseFloat(String(d["Số lượng giao"] || "0").replace(/,/g, '')) || 0;
       
       if (!map.has(category)) map.set(category, { name: category, revenue: 0, profit: 0, volume: 0 });
       const item = map.get(category)!;
       item.revenue += rev;
       item.profit += prof;
       item.volume += vol;
    });
    return Array.from(map.values()).sort((a,b) => b.revenue - a.revenue);
  }, [filteredDelivery]);

  // --- STATS BY SUPPLIER ---
  const supplierStats = useMemo(() => {
    const map = new Map<string, {name: string, revenue: number, profit: number, volume: number}>();
    filteredDelivery.forEach(d => {
       const supplier = d["Nhà cung cấp"] || "Khác";
       const rev = parseFloat(String(d["Doanh thu"] || "0").replace(/,/g, '')) || 0;
       const prof = parseFloat(String(d["Lợi nhuận gộp"] || d["Lợi nhuận dòng"] || "0").replace(/,/g, '')) || 0;
       const vol = parseFloat(String(d["Số lượng giao"] || "0").replace(/,/g, '')) || 0;
       
       if (!map.has(supplier)) map.set(supplier, { name: supplier, revenue: 0, profit: 0, volume: 0 });
       const item = map.get(supplier)!;
       item.revenue += rev;
       item.profit += prof;
       item.volume += vol;
    });
    return Array.from(map.values()).sort((a,b) => b.revenue - a.revenue).slice(0, 5);
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
       if (!map.has(month)) map.set(month, { month: \`Tháng \${month}\`, revenue: 0, profit: 0 });
       const item = map.get(month)!;
       item.revenue += rev;
       item.profit += prof;
    });
    return Array.from(map.entries()).sort((a,b) => a[0] - b[0]).map(e => e[1]);
  }, [filteredDelivery]);

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

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  return (
    <div className="flex-1 overflow-auto bg-gray-50/50">
      <div className="p-8 max-w-[1400px] mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Tổng quan Hoạt động</h2>
            <p className="text-sm text-gray-500 mt-1">Phân tích chuyên sâu sản lượng, doanh thu, lợi nhuận và tiến độ giao hàng</p>
          </div>
          <div className="flex items-center gap-3">
             <div className="relative">
               <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Filter size={16} className="text-gray-400" />
               </div>
               <select 
                 className="pl-9 pr-8 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none appearance-none font-medium shadow-sm"
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
             <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm">
               Xuất báo cáo
             </button>
          </div>
        </div>

        {/* Top KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm relative overflow-hidden group">
             <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <DollarSign size={64} className="text-blue-600" />
             </div>
             <div className="flex items-center gap-3 mb-3 relative z-10">
               <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                 <TrendingUp size={20} className="text-blue-600" />
               </div>
               <h3 className="text-sm font-semibold text-gray-600">Tổng Doanh thu</h3>
             </div>
             <p className="text-2xl font-bold text-gray-900 mb-1 relative z-10">{formatter.format(totalRevenue)}</p>
             <div className="flex items-center gap-1.5 text-xs font-medium text-green-600 relative z-10">
                <Activity size={14} /> <span>Tăng trưởng dương</span>
             </div>
          </div>
          
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm relative overflow-hidden group">
             <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Activity size={64} className="text-green-600" />
             </div>
             <div className="flex items-center gap-3 mb-3 relative z-10">
               <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                 <DollarSign size={20} className="text-green-600" />
               </div>
               <h3 className="text-sm font-semibold text-gray-600">Tổng Lợi nhuận</h3>
             </div>
             <p className="text-2xl font-bold text-gray-900 mb-1 relative z-10">{formatter.format(totalProfit)}</p>
             <div className="flex items-center gap-1.5 text-xs font-medium text-green-600 relative z-10">
                <span>Biên LN: {totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : 0}%</span>
             </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm relative overflow-hidden group">
             <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <FileText size={64} className="text-amber-500" />
             </div>
             <div className="flex items-center gap-3 mb-3 relative z-10">
               <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                 <Package size={20} className="text-amber-600" />
               </div>
               <h3 className="text-sm font-semibold text-gray-600">Tổng Số Đơn Hàng</h3>
             </div>
             <p className="text-2xl font-bold text-gray-900 mb-1 relative z-10">{numFormatter.format(totalOrders)} <span className="text-lg font-medium text-gray-500">đơn</span></p>
             <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 relative z-10">
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

        {/* MẶT HÀNG BEST SELLER */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-8 overflow-hidden">
           <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Star size={18} className="text-amber-500" /> Top 10 Mặt hàng mang lại Doanh thu & Sản lượng tốt nhất
              </h3>
           </div>
           <div className="overflow-x-auto">
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
                    <tr key={i} className="hover:bg-amber-50/30 transition-colors">
                       <td className="px-5 py-4 font-medium text-gray-900">
                          <div className="flex items-center gap-3">
                             <span className={\`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold \${i < 3 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}\`}>{i + 1}</span>
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
           <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
             <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  <TrendingUp size={18} className="text-blue-600" /> Xu hướng Doanh thu & Lợi nhuận
                </h3>
             </div>
             <ResponsiveContainer width="100%" height={300}>
               <LineChart data={monthlyTrendData} margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                 <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dy={10} />
                 <YAxis 
                    yAxisId="left"
                    tickFormatter={(value) => \`\${(value / 1000000).toFixed(0)}M\`} 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 12, fill: '#6b7280' }}
                 />
                 <Tooltip 
                    formatter={(value: number) => formatter.format(value)}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                 />
                 <Legend wrapperStyle={{ paddingTop: '20px' }} />
                 <Line yAxisId="left" type="monotone" dataKey="revenue" name="Doanh thu" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                 <Line yAxisId="left" type="monotone" dataKey="profit" name="Lợi nhuận" stroke="#10b981" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
               </LineChart>
             </ResponsiveContainer>
           </div>

           <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
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
                   label={({ name, percent }) => \`\${name} (\${(percent * 100).toFixed(0)}%)\`}
                   labelLine={false}
                 >
                   {categoryStats.map((entry, index) => (
                     <Cell key={\`cell-\${index}\`} fill={COLORS[index % COLORS.length]} />
                   ))}
                 </Pie>
                 <Tooltip 
                    formatter={(value: number) => formatter.format(value)}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                 />
                 <Legend wrapperStyle={{ paddingTop: '20px' }} />
               </PieChart>
             </ResponsiveContainer>
           </div>
        </div>

        {/* Charts Row 2: Customer & Supplier */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
           <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
             <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  <Users size={18} className="text-blue-600" /> Top Khách hàng theo Doanh thu
                </h3>
             </div>
             <ResponsiveContainer width="100%" height={300}>
               <BarChart data={customerStats} margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                 <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dy={10} />
                 <YAxis 
                    yAxisId="left"
                    tickFormatter={(value) => \`\${(value / 1000000).toFixed(0)}M\`} 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 12, fill: '#6b7280' }}
                 />
                 <Tooltip 
                    formatter={(value: number) => formatter.format(value)}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                 />
                 <Legend wrapperStyle={{ paddingTop: '20px' }} />
                 <Bar yAxisId="left" dataKey="revenue" name="Doanh thu" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={50} />
                 <Bar yAxisId="left" dataKey="profit" name="Lợi nhuận" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={50} />
               </BarChart>
             </ResponsiveContainer>
           </div>

           <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
             <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  <Briefcase size={18} className="text-indigo-600" /> Top Nhà cung cấp
                </h3>
             </div>
             <ResponsiveContainer width="100%" height={300}>
               <BarChart data={supplierStats} margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                 <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dy={10} />
                 <YAxis 
                    yAxisId="left"
                    tickFormatter={(value) => \`\${(value / 1000000).toFixed(0)}M\`} 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 12, fill: '#6b7280' }}
                 />
                 <Tooltip 
                    formatter={(value: number) => formatter.format(value)}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                 />
                 <Legend wrapperStyle={{ paddingTop: '20px' }} />
                 <Bar yAxisId="left" dataKey="revenue" name="Doanh thu" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={50} />
                 <Bar yAxisId="left" dataKey="profit" name="Lợi nhuận" fill="#14b8a6" radius={[4, 4, 0, 0]} maxBarSize={50} />
               </BarChart>
             </ResponsiveContainer>
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
            <div className="p-0 overflow-auto flex-1 max-h-[400px]">
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
                    
                    return (
                    <tr key={i} className="hover:bg-blue-50/30 transition-colors">
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
                              <div className={\`h-2 rounded-full \${isCompleted ? 'bg-green-500' : 'bg-blue-500'}\`} style={{ width: \`\${Math.min(calculatedProgress, 100)}%\` }}></div>
                            </div>
                         </div>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <span className={\`inline-flex items-center justify-center px-2.5 py-1 text-[11px] font-bold rounded-md uppercase tracking-wider \${isCompleted ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-blue-100 text-blue-700 border border-blue-200'}\`}>
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
            <div className="p-5 flex-1 flex flex-col gap-4 overflow-y-auto max-h-[400px]">
               {filteredDelivery.filter(d => d["Sự cố"] && d["Sự cố"] !== "0" && String(d["Sự cố"]).trim() !== "").length > 0 ? (
                 filteredDelivery.filter(d => d["Sự cố"] && d["Sự cố"] !== "0" && String(d["Sự cố"]).trim() !== "").map((incident, idx) => (
                    <div key={idx} className="bg-red-50/80 border border-red-100 rounded-xl p-4 flex gap-3 hover:shadow-md transition-shadow">
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
                 ))
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
    </div>
  );
}
`

fs.writeFileSync('src/components/DashboardView.tsx', code);
