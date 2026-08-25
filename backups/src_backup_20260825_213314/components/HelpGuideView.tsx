import React, { useState } from 'react';
import { 
  BookOpen, 
  Sparkles, 
  TrendingUp, 
  Truck, 
  Camera, 
  HardDrive, 
  Bot, 
  CheckCircle, 
  ChevronRight, 
  Search, 
  ExternalLink, 
  Layers, 
  Scale, 
  FileText, 
  Package, 
  DollarSign, 
  ShieldCheck,
  CalendarDays,
  HelpCircle,
  ArrowRight,
  Database,
  ArrowUpRight
} from 'lucide-react';
import clsx from 'clsx';
import MacTrafficLights from './MacTrafficLights';

interface HelpGuideViewProps {
  onNavigateTab?: (tab: string) => void;
}

export default function HelpGuideView({ onNavigateTab }: HelpGuideViewProps) {
  const [activeCategory, setActiveCategory] = useState<'quickstart' | 'workflow' | 'logistics' | 'ocr' | 'storage' | 'ai' | 'faq'>('quickstart');
  const [searchQuery, setSearchQuery] = useState('');

  const navigate = (tab: string) => {
    if (onNavigateTab) {
      onNavigateTab(tab);
    }
  };

  return (
    <div className="space-y-6 max-w-[1700px] mx-auto p-4 sm:p-6 lg:p-8 font-sans animate-in fade-in duration-200">
      {/* 🌟 HERO HEADER BANNER */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0F172A] rounded-3xl p-6 sm:p-8 text-white shadow-2xl border border-slate-700/50">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-80 h-80 bg-gradient-to-bl from-blue-500/20 via-teal-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-12 w-64 h-64 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-[11px] font-bold uppercase tracking-wider backdrop-blur-md">
                  <BookOpen size={13} className="text-blue-400" />
                  TSG Business OS Knowledge Base
                </span>
                <span className="text-slate-500">•</span>
                <div className="flex items-center gap-1.5 text-xs text-slate-300 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                  <span>Tài liệu hướng dẫn sử dụng chính thức v2.6 (2026)</span>
                </div>
              </div>
              
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
                <Sparkles className="text-blue-400" size={30} />
                <span>Trung Tâm Trợ Giúp & Cẩm Nang Sử Dụng</span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 max-w-3xl leading-relaxed">
                Hướng dẫn vận hành toàn diện hệ thống quản trị kinh doanh, đơn hàng PO, điều độ logistics 360°, bóc tách chứng từ OCR bằng AI Gemini và sổ đối soát 2 bên.
              </p>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => navigate('workflow')}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-xs font-bold shadow-lg shadow-blue-600/30 transition flex items-center gap-2 cursor-pointer"
              >
                <TrendingUp size={15} />
                <span>Xem Quy Trình 5 Bước</span>
              </button>

              <button
                type="button"
                onClick={() => navigate('assistant')}
                className="px-4 py-2.5 bg-white/10 hover:bg-white/20 border border-white/15 text-white rounded-2xl text-xs font-semibold backdrop-blur-md transition flex items-center gap-2 cursor-pointer"
              >
                <Bot size={15} className="text-purple-300" />
                <span>Hỏi Trợ Lý AI</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2-COLUMN ENTERPRISE GUIDE LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Navigation Sidebar (4 cols) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="bg-white rounded-3xl p-3 border border-slate-200/80 shadow-2xs space-y-1.5">
            <div className="px-3 py-2 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
              Danh Mục Hướng Dẫn
            </div>

            <button
              onClick={() => setActiveCategory('quickstart')}
              className={clsx(
                "w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-bold transition text-left cursor-pointer",
                activeCategory === 'quickstart' 
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/20" 
                  : "text-slate-700 hover:bg-slate-100/80"
              )}
            >
              <div className="flex items-center gap-3">
                <div className={clsx("w-8 h-8 rounded-xl flex items-center justify-center", activeCategory === 'quickstart' ? "bg-white/20 text-white" : "bg-blue-50 text-blue-600")}>
                  <Sparkles size={16} />
                </div>
                <div>
                  <span className="block font-extrabold text-xs">1. Giới Thiệu & Bắt Đầu</span>
                  <span className={clsx("text-[10px] block font-normal", activeCategory === 'quickstart' ? "text-blue-100" : "text-slate-400")}>
                    Kiến trúc ERP & 13 bảng CSDL
                  </span>
                </div>
              </div>
              <ChevronRight size={15} className={activeCategory === 'quickstart' ? "text-white" : "text-slate-400"} />
            </button>

            <button
              onClick={() => setActiveCategory('workflow')}
              className={clsx(
                "w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-bold transition text-left cursor-pointer",
                activeCategory === 'workflow' 
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/20" 
                  : "text-slate-700 hover:bg-slate-100/80"
              )}
            >
              <div className="flex items-center gap-3">
                <div className={clsx("w-8 h-8 rounded-xl flex items-center justify-center", activeCategory === 'workflow' ? "bg-white/20 text-white" : "bg-indigo-50 text-indigo-600")}>
                  <TrendingUp size={16} />
                </div>
                <div>
                  <span className="block font-extrabold text-xs">2. Quy Trình 5 Bước Khép Kín</span>
                  <span className={clsx("text-[10px] block font-normal", activeCategory === 'workflow' ? "text-blue-100" : "text-slate-400")}>
                    Dòng chảy dữ liệu từ PO $\rightarrow$ PXK
                  </span>
                </div>
              </div>
              <ChevronRight size={15} className={activeCategory === 'workflow' ? "text-white" : "text-slate-400"} />
            </button>

            <button
              onClick={() => setActiveCategory('logistics')}
              className={clsx(
                "w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-bold transition text-left cursor-pointer",
                activeCategory === 'logistics' 
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/20" 
                  : "text-slate-700 hover:bg-slate-100/80"
              )}
            >
              <div className="flex items-center gap-3">
                <div className={clsx("w-8 h-8 rounded-xl flex items-center justify-center", activeCategory === 'logistics' ? "bg-white/20 text-white" : "bg-teal-50 text-teal-600")}>
                  <Truck size={16} />
                </div>
                <div>
                  <span className="block font-extrabold text-xs">3. Kế Hoạch & Giao Hàng 360°</span>
                  <span className={clsx("text-[10px] block font-normal", activeCategory === 'logistics' ? "text-blue-100" : "text-slate-400")}>
                    Lịch 4 tầng & Đối soát 3 chiều
                  </span>
                </div>
              </div>
              <ChevronRight size={15} className={activeCategory === 'logistics' ? "text-white" : "text-slate-400"} />
            </button>

            <button
              onClick={() => setActiveCategory('ocr')}
              className={clsx(
                "w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-bold transition text-left cursor-pointer",
                activeCategory === 'ocr' 
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/20" 
                  : "text-slate-700 hover:bg-slate-100/80"
              )}
            >
              <div className="flex items-center gap-3">
                <div className={clsx("w-8 h-8 rounded-xl flex items-center justify-center", activeCategory === 'ocr' ? "bg-white/20 text-white" : "bg-purple-50 text-purple-600")}>
                  <Camera size={16} />
                </div>
                <div>
                  <span className="block font-extrabold text-xs">4. Quét OCR & Định Giá Đa Bảng</span>
                  <span className={clsx("text-[10px] block font-normal", activeCategory === 'ocr' ? "text-blue-100" : "text-slate-400")}>
                    Gemini Vision bóc tách & liên kết giá
                  </span>
                </div>
              </div>
              <ChevronRight size={15} className={activeCategory === 'ocr' ? "text-white" : "text-slate-400"} />
            </button>

            <button
              onClick={() => setActiveCategory('storage')}
              className={clsx(
                "w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-bold transition text-left cursor-pointer",
                activeCategory === 'storage' 
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/20" 
                  : "text-slate-700 hover:bg-slate-100/80"
              )}
            >
              <div className="flex items-center gap-3">
                <div className={clsx("w-8 h-8 rounded-xl flex items-center justify-center", activeCategory === 'storage' ? "bg-white/20 text-white" : "bg-emerald-50 text-emerald-600")}>
                  <HardDrive size={16} />
                </div>
                <div>
                  <span className="block font-extrabold text-xs">5. Kho Drive & Sổ Đối Soát 2 Bên</span>
                  <span className={clsx("text-[10px] block font-normal", activeCategory === 'storage' ? "text-blue-100" : "text-slate-400")}>
                    Cây thư mục & Kiểm tra chéo
                  </span>
                </div>
              </div>
              <ChevronRight size={15} className={activeCategory === 'storage' ? "text-white" : "text-slate-400"} />
            </button>

            <button
              onClick={() => setActiveCategory('ai')}
              className={clsx(
                "w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-bold transition text-left cursor-pointer",
                activeCategory === 'ai' 
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/20" 
                  : "text-slate-700 hover:bg-slate-100/80"
              )}
            >
              <div className="flex items-center gap-3">
                <div className={clsx("w-8 h-8 rounded-xl flex items-center justify-center", activeCategory === 'ai' ? "bg-white/20 text-white" : "bg-indigo-50 text-indigo-600")}>
                  <Bot size={16} />
                </div>
                <div>
                  <span className="block font-extrabold text-xs">6. Trợ Lý AI Gemini 3.6 Flash</span>
                  <span className={clsx("text-[10px] block font-normal", activeCategory === 'ai' ? "text-blue-100" : "text-slate-400")}>
                    Truy vấn dữ liệu & Báo cáo thông minh
                  </span>
                </div>
              </div>
              <ChevronRight size={15} className={activeCategory === 'ai' ? "text-white" : "text-slate-400"} />
            </button>

            <button
              onClick={() => setActiveCategory('faq')}
              className={clsx(
                "w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-bold transition text-left cursor-pointer",
                activeCategory === 'faq' 
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/20" 
                  : "text-slate-700 hover:bg-slate-100/80"
              )}
            >
              <div className="flex items-center gap-3">
                <div className={clsx("w-8 h-8 rounded-xl flex items-center justify-center", activeCategory === 'faq' ? "bg-white/20 text-white" : "bg-amber-50 text-amber-600")}>
                  <HelpCircle size={16} />
                </div>
                <div>
                  <span className="block font-extrabold text-xs">7. Câu Hỏi Thường Gặp (FAQ)</span>
                  <span className={clsx("text-[10px] block font-normal", activeCategory === 'faq' ? "text-blue-100" : "text-slate-400")}>
                    Lưu trữ dữ liệu & Khắc phục lỗi
                  </span>
                </div>
              </div>
              <ChevronRight size={15} className={activeCategory === 'faq' ? "text-white" : "text-slate-400"} />
            </button>
          </div>

          {/* Keyboard Shortcuts Card */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-2xs space-y-3">
            <span className="text-[10.5px] font-extrabold text-slate-400 uppercase tracking-wider block">
              Phím Tắt Nhanh Tiện Ích
            </span>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600 font-medium">Về Bảng Điều Hành</span>
                <kbd className="px-2 py-1 bg-slate-100 text-slate-800 rounded-lg border border-slate-200 font-mono text-[11px] font-bold">⌘W</kbd>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600 font-medium">Tìm kiếm nhanh tính năng</span>
                <kbd className="px-2 py-1 bg-slate-100 text-slate-800 rounded-lg border border-slate-200 font-mono text-[11px] font-bold">⌘K</kbd>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600 font-medium">Chế độ toàn màn hình</span>
                <kbd className="px-2 py-1 bg-slate-100 text-slate-800 rounded-lg border border-slate-200 font-mono text-[11px] font-bold">⌃⌘F</kbd>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-slate-600 font-medium">Đóng cửa sổ / Modal</span>
                <kbd className="px-2 py-1 bg-slate-100 text-slate-800 rounded-lg border border-slate-200 font-mono text-[11px] font-bold">Esc</kbd>
              </div>
            </div>
          </div>
        </div>

        {/* Right Detail Content Panel (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Quickstart Tab */}
          {activeCategory === 'quickstart' && (
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-2xs space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                    <Sparkles className="text-blue-600" size={22} />
                    <span>Tổng Quan Hệ Điều Hành TSG Business OS</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Cấu trúc tổng thể và mối liên kết giữa 13 bảng cơ sở dữ liệu
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => navigate('dashboard')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold transition"
                >
                  <span>Mở Bàn Làm Việc</span>
                  <ArrowUpRight size={14} />
                </button>
              </div>

              <div className="space-y-4 text-xs sm:text-sm text-slate-700 leading-relaxed">
                <p>
                  <strong>TSG Business OS</strong> được thiết kế theo tư duy <em>Liên kết dữ liệu thời gian thực (Relational Real-time Engine)</em>. Khi có bất kỳ phát sinh nghiệp vụ nào (như tạo đơn hàng PO mới, chia lịch giao hàng, hoặc quét hóa đơn xuất kho), dữ liệu sẽ tự động tính toán giá vốn, doanh thu, lợi nhuận và đồng bộ sang tất cả các phân hệ liên quan.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/70 space-y-2">
                    <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                      <Database size={16} />
                    </div>
                    <h4 className="font-bold text-slate-900 text-xs">Cơ Chế Bộ Nhớ Kép (Double Engine)</h4>
                    <p className="text-xs text-slate-500">
                      Tự động lưu trữ cục bộ bảo toàn 100% dữ liệu ngoại tuyến và tự động đồng bộ tức thì lên đám mây Firestore khi có mạng.
                    </p>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/70 space-y-2">
                    <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                      <Camera size={16} />
                    </div>
                    <h4 className="font-bold text-slate-900 text-xs">Trí Tuệ Nhân Tạo Thị Giác Gemini</h4>
                    <p className="text-xs text-slate-500">
                      Bóc tách siêu tốc các văn bản scan, hóa đơn ảnh chụp, tự động liên kết mã giá sản phẩm 2026 và hợp đồng căn cứ.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Workflow Tab */}
          {activeCategory === 'workflow' && (
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-2xs space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                    <TrendingUp className="text-indigo-600" size={22} />
                    <span>Quy Trình Nghiệp Vụ Khép Kín 5 Bước</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Chu kỳ tuần hoàn từ khi nhận đơn PO đến khi xuất hóa đơn & đối soát
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => navigate('workflow')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition"
                >
                  <span>Mở Quy Trình 5 Bước</span>
                  <ArrowUpRight size={14} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-200/70 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-blue-800">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">1</span>
                    <span>Bước 1: Tiếp Nhận PO & Chọn Khách Hàng</span>
                  </div>
                  <p className="text-xs text-blue-950/80 leading-relaxed pl-7">
                    Khi nhận được đơn hàng (PO) từ Khách hàng $\rightarrow$ Bạn vào mục <strong>Quản Lý Đơn Hàng PO</strong> hoặc <strong>Quét OCR</strong> để tạo đơn. Hệ thống sẽ tự động lọc danh mục sản phẩm và giá niêm yết theo Hợp Đồng 2026 của khách hàng đó.
                  </p>
                </div>

                <div className="p-4 bg-teal-50/50 rounded-2xl border border-teal-200/70 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-teal-800">
                    <span className="w-5 h-5 rounded-full bg-teal-600 text-white flex items-center justify-center text-[10px]">2</span>
                    <span>Bước 2: Đối Chiếu Giá Bán (SO) $\leftrightarrow$ Giá Mua Xưởng (PO)</span>
                  </div>
                  <p className="text-xs text-teal-950/80 leading-relaxed pl-7">
                    Tự động phân rã đơn giá bán cho khách hàng và đơn giá mua (COGS) từ Nhà Cung Cấp, tính toán ngay Doanh thu kỳ vọng, Chi phí và Biên lợi nhuận gộp (%) trước khi thực hiện giao dịch.
                  </p>
                </div>

                <div className="p-4 bg-amber-50/50 rounded-2xl border border-amber-200/70 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-800">
                    <span className="w-5 h-5 rounded-full bg-amber-600 text-white flex items-center justify-center text-[10px]">3</span>
                    <span>Bước 3: Lập Kế Hoạch Điều Độ & Chia Đợt Giao</span>
                  </div>
                  <p className="text-xs text-amber-950/80 leading-relaxed pl-7">
                    Vào <strong>Kế Hoạch & Giao Hàng 360°</strong> $\rightarrow$ Bấm <strong>"Chia Nhiều Đợt"</strong> để phân bổ 1 đơn hàng lớn thành nhiều chuyến xe, chỉ định ngày giao cụ thể trên lịch 4 tầng.
                  </p>
                </div>

                <div className="p-4 bg-orange-50/50 rounded-2xl border border-orange-200/70 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-orange-800">
                    <span className="w-5 h-5 rounded-full bg-orange-600 text-white flex items-center justify-center text-[10px]">4</span>
                    <span>Bước 4: Xuất Kho Thực Tế & Quét OCR Biên Bản Giao Hàng</span>
                  </div>
                  <p className="text-xs text-orange-950/80 leading-relaxed pl-7">
                    Khi hàng được xuất xưởng và giao tới nơi $\rightarrow$ Quét ảnh chụp Phiếu xuất kho (PXK) tại mục <strong>Quét OCR</strong> $\rightarrow$ AI tự động bóc tách và khớp với kế hoạch đã lập.
                  </p>
                </div>

                <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-200/70 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-800">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">5</span>
                    <span>Bước 5: Đối Soát 3 Chiều & Báo Cáo Doanh Thu / Lợi Nhuận</span>
                  </div>
                  <p className="text-xs text-emerald-950/80 leading-relaxed pl-7">
                    Hệ thống tự động cân bằng số liệu: <strong>Tổng Đặt (PO) $\leftrightarrow$ Đã Lên Kế Hoạch $\leftrightarrow$ Thực Giao (PXK) $\leftrightarrow$ Còn Lại</strong>. Bấm nút "Xuất Excel" để in báo cáo phục vụ thanh quyết toán.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Logistics 360 Tab */}
          {activeCategory === 'logistics' && (
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-2xs space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                    <Truck className="text-teal-600" size={22} />
                    <span>Trung Tâm Điều Độ & Kế Hoạch Giao Hàng 360°</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Hợp nhất 4 trụ cột nghiệp vụ giao nhận trong 1 không gian duy nhất
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => navigate('logistics')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-teal-50 hover:bg-teal-100 text-teal-700 rounded-xl text-xs font-bold transition"
                >
                  <span>Mở Logistics 360°</span>
                  <ArrowUpRight size={14} />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/70 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-blue-700">
                    <CalendarDays size={16} />
                    <span>1. Lịch Giao Nhận 4 Tầng</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Cho phép quan sát toàn cục theo <strong>Năm / Tháng / Tuần / Ngày</strong>. Các chuyến xe được tô màu theo trạng thái (Mới, Đang giao, Đã hoàn thành).
                  </p>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/70 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-teal-700">
                    <Layers size={16} />
                    <span>2. Kế Hoạch Điều Độ Phân Cấp</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Xem danh sách các đơn hàng PO đang chờ giao, số lượng đã lên kế hoạch và số lượng còn tồn đọng chưa bố trí chuyến.
                  </p>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/70 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-orange-700">
                    <FileText size={16} />
                    <span>3. Sổ Giao Hàng PXK</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Sổ cái toàn bộ các phiếu xuất kho thực tế: Biển số xe, người vận chuyển, giá bán, giá vốn và biên lợi nhuận gộp chi tiết từng phiếu.
                  </p>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/70 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-purple-700">
                    <Scale size={16} />
                    <span>4. Ma Trận Đối Soát 3 Chiều</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Tự động tổng hợp và kiểm tra chéo tiến độ giao hàng của từng sản phẩm. Phát hiện ngay các đơn hàng bị giao thừa hoặc giao thiếu.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* OCR Tab */}
          {activeCategory === 'ocr' && (
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-2xs space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                    <Camera className="text-purple-600" size={22} />
                    <span>Quét OCR & Tự Động Định Giá Đa Bảng</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Bóc tách tài liệu thông minh bằng Google Gemini 2.5 Flash Vision
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => navigate('ocr')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl text-xs font-bold transition"
                >
                  <span>Mở Quét OCR</span>
                  <ArrowUpRight size={14} />
                </button>
              </div>

              <div className="space-y-3 text-xs text-slate-700">
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/70 space-y-1">
                  <strong className="text-slate-900 text-xs block">1. Tải ảnh hoặc file PDF chứng từ</strong>
                  <p className="text-slate-600 leading-relaxed">
                    Kéo thả hoặc tải lên hình ảnh Phiếu xuất kho (PXK), Biên bản bàn giao hàng hóa hoặc Đơn hàng (PO).
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/70 space-y-1">
                  <strong className="text-slate-900 text-xs block">2. AI nhận diện và đối chiếu Bảng Giá 2026</strong>
                  <p className="text-slate-600 leading-relaxed">
                    AI tự động đọc mã hàng, số lượng và liên kết với Bảng Giá 2026 để điền Đơn giá bán, Giá vốn (COGS) và Hợp đồng căn cứ.
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/70 space-y-1">
                  <strong className="text-slate-900 text-xs block">3. Tự chọn lại bảng giá linh hoạt</strong>
                  <p className="text-slate-600 leading-relaxed">
                    Bấm vào nút <strong>"🏷️ Chọn Bảng Giá..."</strong> để mở hộp thoại tìm kiếm trực quan và thay đổi mức giá hoặc hợp đồng khác.
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/70 space-y-1">
                  <strong className="text-slate-900 text-xs block">4. Tự động đồng bộ liên hoàn sang 4 bảng CSDL</strong>
                  <p className="text-slate-600 leading-relaxed">
                    Khi bấm <strong>"Lưu Vào Hệ Thống"</strong>, hệ thống tự động: Ghi vào sổ PXK (`deliveries`), Cập nhật tiến độ PO (`po_lines`), Chuyển trạng thái Kế hoạch giao (`delivery_plans`) sang Hoàn thành, và tải file scan lên Google Drive.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Storage Tab */}
          {activeCategory === 'storage' && (
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-2xs space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                    <HardDrive className="text-emerald-600" size={22} />
                    <span>Kho Lưu Trữ Google Drive & Sổ Đối Soát 2 Bên</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Cấu trúc cây thư mục đám mây và cơ chế kiểm soát chéo
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => navigate('storage')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold transition"
                >
                  <span>Mở Kho Tệp & Sổ Đối Soát</span>
                  <ArrowUpRight size={14} />
                </button>
              </div>

              <div className="space-y-4 text-xs text-slate-700">
                <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-200/80 space-y-1.5">
                  <strong className="text-emerald-950 font-bold block text-xs">📂 Cấu Trúc Cây Thư Mục Chuẩn Trên Google Drive:</strong>
                  <code className="text-[11px] font-mono text-emerald-800 bg-white px-3 py-1.5 rounded-xl block border border-emerald-200">
                    TSG_Business_Documents / 2026 / [Loại_Chứng_Từ] / Thang_[XX]
                  </code>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/70 space-y-2">
                  <strong className="text-slate-900 font-bold block text-xs">🟢 Trạng Thái Đối Soát 2 Chiều:</strong>
                  <p>• <strong>🟢 Đã khớp 100%</strong>: Dữ liệu trên file scan hoàn toàn trùng khớp với đơn giá và số lượng trên hệ thống.</p>
                  <p>• <strong>🟡 Chờ rà soát</strong>: Chứng từ mới tải lên cần kế toán kiểm tra lại chữ ký/con dấu.</p>
                  <p>• <strong>🔴 Lệch số liệu</strong>: Phát hiện chênh lệch giữa thực tế giao và hợp đồng/bảng giá.</p>
                </div>
              </div>
            </div>
          )}

          {/* AI Tab */}
          {activeCategory === 'ai' && (
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-2xs space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                    <Bot className="text-indigo-600" size={22} />
                    <span>Trợ Lý Thông Minh Gemini 3.6 Flash</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Trực tiếp phân tích và truy vấn dữ liệu từ 13 bảng CSDL
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => navigate('assistant')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition"
                >
                  <span>Mở Trợ Lý AI</span>
                  <ArrowUpRight size={14} />
                </button>
              </div>

              <div className="space-y-3">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Bạn có thể đặt bất kỳ câu hỏi nào bằng tiếng Việt tự nhiên, trợ lý sẽ trích xuất số liệu và đưa ra phân tích chính xác:
                </p>

                <div className="space-y-2 pt-1">
                  <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-200/70 text-xs text-indigo-900 font-medium">
                    💡 <em>"Tổng doanh thu và lợi nhuận tháng này của khách hàng Thuốc lá Thanh Hóa là bao nhiêu?"</em>
                  </div>
                  <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-200/70 text-xs text-indigo-900 font-medium">
                    💡 <em>"Những đơn hàng PO nào đang bị giao thiếu và cần giao bổ sung trong tuần này?"</em>
                  </div>
                  <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-200/70 text-xs text-indigo-900 font-medium">
                    💡 <em>"Sản phẩm nào có biên lợi nhuận thấp hơn 15% cần đàm phán lại giá với nhà cung cấp?"</em>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* FAQ Tab */}
          {activeCategory === 'faq' && (
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-2xs space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                    <HelpCircle className="text-amber-600" size={22} />
                    <span>Câu Hỏi Thường Gặp (FAQ)</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Giải đáp các thắc mắc phổ biến về vận hành và an toàn dữ liệu
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <details className="p-4 bg-slate-50 rounded-2xl border border-slate-200/70 text-xs text-slate-700 space-y-2 cursor-pointer" open>
                  <summary className="font-bold text-slate-900 text-xs">Dữ liệu của tôi được lưu ở đâu? Có bị mất khi tắt trình duyệt không?</summary>
                  <p className="text-slate-600 pt-2 leading-relaxed">
                    Hệ thống sử dụng cơ chế lưu trữ kép <strong>Double Storage Engine</strong>: Vừa lưu trữ an toàn trong bộ nhớ máy cục bộ (IndexedDB/Local Engine), vừa tự động đồng bộ lên máy chủ đám mây Google Firestore. Mọi thay đổi đều được bảo toàn 100% khi tắt hoặc mở lại trình duyệt.
                  </p>
                </details>

                <details className="p-4 bg-slate-50 rounded-2xl border border-slate-200/70 text-xs text-slate-700 space-y-2 cursor-pointer">
                  <summary className="font-bold text-slate-900 text-xs">Tôi muốn kết nối Google Drive thì làm như thế nào?</summary>
                  <p className="text-slate-600 pt-2 leading-relaxed">
                    Bạn chỉ cần bấm vào nút <strong>"Đăng nhập Google"</strong> trong mục <em>Kho Tệp & Sổ Đối Soát</em> hoặc khi lưu tệp OCR một lần duy nhất trong phiên làm việc. Hệ thống sẽ tự động ghi nhớ mã xác thực trong suốt phiên.
                  </p>
                </details>

                <details className="p-4 bg-slate-50 rounded-2xl border border-slate-200/70 text-xs text-slate-700 space-y-2 cursor-pointer">
                  <summary className="font-bold text-slate-900 text-xs">Làm thế nào để xuất dữ liệu ra file Excel hoặc PDF?</summary>
                  <p className="text-slate-600 pt-2 leading-relaxed">
                    Ở mỗi bảng (Đơn hàng, Bảng giá, Sổ giao hàng, Ma trận đối soát), bạn đều có nút <strong>"Xuất Excel"</strong> hoặc <strong>"In PDF"</strong> ở góc phải phía trên để tải về báo cáo định dạng chuẩn A4 landscape.
                  </p>
                </details>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
